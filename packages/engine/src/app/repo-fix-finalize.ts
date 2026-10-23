// repo-fix-finalize.ts — 单仓库修复管线的「基线采样触发」与「收尾（lockfile repair + 修复后验证）」交接面。
//
// 从 repo-fix.ts 迁出：该文件新增语句会越过 eslint `max-lines` 上限，按登记候选自带的触发条件
// 「再次改动需要新增语句时（先拆分再改）」处置；该候选已随之移出候选池，处置记录见 docs/plan/todo.md 的「零告警仓库修复前基线采样成本」闭环登记。
// 两段职责的耦合点只有运行级基线持有器：采样时机决定是否需要付基线成本，收尾消费采样结果做归因豁免。
// 验证链口径见 docs/design/modules/dependency-fixer-records.md §12.9。
import type { Octokit } from '@octokit/rest'
import { formatVerificationError, type CommandResult } from '../runners/verification-runner'
import { tryLockfileRepair } from './helpers'
import type { RepoFixCtx, RepoFixProgress } from './repo-fix'
import { findInstallBaselineFailure, sampleVerificationBaseline, verifyProject } from './verify-project'
import { attemptSelectiveUnitRollback } from './verification-checkpoint'

/**
 * 惰性取得本次运行修复前的验证基线（每运行一次），并返回本仓库的归因豁免判定。
 * dry-run 不做验证，因此也不需要基线。
 *
 * 采样触发面按「本仓库是否有工作」收窄（口径见 docs/design/modules/dependency-fixer-records.md 验证链章节）：
 * - 已有基线（本次运行内任一仓库采样过）→ 复用，运行级「首采一次 + 跨仓库复用」语义不变
 * - 本仓库有工作（存在告警 → 会有写操作）→ 采样
 * - 本仓库无工作且尚无基线 → 不采样，返回 `exemptAttribution: true`：pristine 工作区下修复后验证失败
 *   必然也会在基线中失败（同命令同工作区），故「无改动即豁免」与采样等价，省一次完整验证链成本
 */
export async function ensureVerificationBaseline(
    ctx: RepoFixCtx,
    repo: string,
    options: { hasWork: boolean },
): Promise<{ exemptAttribution: boolean, baseline?: CommandResult[] }> {
    if (ctx.config.dryRun || !ctx.verificationBaseline) {
        return { exemptAttribution: false }
    }
    if (ctx.verificationBaseline.value) {
        return {
            exemptAttribution: false,
            // 运行级首采只对采样仓库自身可信：多仓运行时不能把 A 仓的安装失败套到 B 仓，
            // 否则会把 B 仓的修复链误跳过。归因口径仍沿用运行级基线（见 currentBaseline）。
            baseline: ctx.verificationBaseline.repo === repo ? ctx.verificationBaseline.value : undefined,
        }
    }
    if (!options.hasWork) {
        ctx.logger.info(
            `[baseline] Skipping pre-fix baseline for ${repo}: no alerts → no writes in this run `
            + '(verification failures of this repository are not attributed to this change)',
        )
        return { exemptAttribution: true }
    }
    const value = await sampleVerificationBaseline(ctx, repo)
    if (value) {
        ctx.verificationBaseline.value = value
        ctx.verificationBaseline.repo = repo
    }
    return { exemptAttribution: false, baseline: value }
}

/** 读取本次运行的修复前基线（未采样 / 采样失败时为 undefined ⇒ 全量归因）。 */
function currentBaseline(ctx: RepoFixCtx): CommandResult[] | undefined {
    return ctx.verificationBaseline?.value
}

/**
 * 记录 pristine 安装失败并返回该条结果（供调用方跳过依赖安装链）。
 *
 * 只在基线属于当前仓库时生效（`ensureVerificationBaseline` 已做仓库归属判定）；
 * 审计条目不归因本次运行（`PRE_EXISTING_FAILURE` 在跳过类白名单内），但必须在报告里
 * 留下失败命令与诊断，避免「有可修告警 / 0 修复」再次变成无证据运行。
 */
export function recordInstallBaselineFailure(
    ctx: Pick<RepoFixCtx, 'logger' | 'allErrors'>,
    repo: string,
    baseline?: CommandResult[],
): CommandResult | undefined {
    const failure = findInstallBaselineFailure(baseline)
    if (!failure) {
        return undefined
    }
    const detail = formatVerificationError(failure)
    ctx.logger.warn(
        `[baseline] pristine install failed for ${repo}: ${failure.command} — ${detail}; `
        + 'skipping dependency install attempts for this run (fix the execution environment or lockfile first)',
    )
    ctx.allErrors.push({
        repository: repo,
        target: failure.command,
        stage: 'verify',
        category: 'PRE_EXISTING_FAILURE',
        message: `Pre-existing failure (already failing before this run; not caused by this change): `
            + `${failure.command} — ${detail}`,
    })
    return failure
}

/**
 * 步骤 5：收尾——lockfile repair + 完整验证（dry-run 跳过验证）。零告警仓库跳过 lockfile repair
 * （无升级改动即无锁文件待修复）+ 跳过修复前基线采样（无改动即无「本次引入」可归因，
 * 见 `ensureVerificationBaseline`；`options.exemptAttribution` 承载该判定），
 * 但保留修复后验证链——其 `verificationPassed` 是零告警仓库唯一的「处理成功」信号。
 */
export async function finalizeRepoFix(
    ctx: RepoFixCtx,
    repo: string,
    progress: RepoFixProgress,
    options: { exemptAttribution?: boolean, client?: Octokit | null } = {},
): Promise<void> {
    let lockfileRepairFailed = false
    if (progress.alertsCount > 0) {
        const repairAction = await tryLockfileRepair(ctx, repo)
        ctx.allActions.push(repairAction)
        lockfileRepairFailed = !repairAction.success && !repairAction.noOp
        if (repairAction.success && !repairAction.noOp) {
            progress.lockfileRepaired = true
        }
    } else {
        ctx.logger.info(`[skip] No alerts for ${repo} — skipping lockfile repair`)
    }
    // 仅当首次 repair 真正改了文件时，选择性回滚后才需要重做；noOp 不额外跑安装
    const lockfileRepairChanged = progress.lockfileRepaired

    if (!ctx.config.dryRun) {
        const verifyOptions = {
            baseline: currentBaseline(ctx),
            // 「无改动即豁免」：零告警仓库未采样基线（无任何写操作）——其失败一律视为既有失败，
            // 与「基线中同命令也失败」等价（同命令 + 同一 pristine 工作区），故归因口径零退化
            noChanges: options.exemptAttribution === true,
            // CI 口径比对上下文（只读 + 不阻断；无 GitHub client 时只做本地解析）
            ciAlignment: { client: options.client ?? null, defaultBranch: progress.defaultBranch },
        }
        let verifyActions = await verifyProject(ctx, repo, verifyOptions)
        let blocking = verifyActions.some((a) => !a.success && !a.preExisting)

        // 终验存在本次引入失败时，默认先尝试回退最近一个已通过 probe 的单元并重验一次。
        // 通过 → 保留更早单元继续交付；仍失败 / 无 checkpoint → 原 actions 保持不变，门禁整仓回滚。
        if (blocking && (ctx.config.rollbackGranularity ?? 'unit') === 'unit' && !options.exemptAttribution
            && !ctx.preExistingDirty && !lockfileRepairFailed) {
            const outcome = await attemptSelectiveUnitRollback(
                ctx,
                repo,
                progress,
                () => verifyProject(ctx, repo, verifyOptions),
                {
                    beforeVerify: async () => {
                        // checkpoint 在 lockfile repair 之前：恢复后重做 repair，避免把「安装已合规」
                        // 这一修复一并回退导致重验假红。
                        if (lockfileRepairChanged && progress.alertsCount > 0) {
                            const repairAction = await tryLockfileRepair(ctx, repo)
                            ctx.allActions.push(repairAction)
                            if (repairAction.success && !repairAction.noOp) {
                                progress.lockfileRepaired = true
                            }
                        }
                    },
                },
            )
            if (outcome.applied) {
                verifyActions = outcome.verifyActions
                blocking = outcome.blocking
            }
        }

        ctx.allActions.push(...verifyActions)
        // 原始口径：修复后链路是否全绿（报告与「成功交付」启发式沿用）
        progress.verificationPassed = verifyActions.every((a) => a.success)
        // 归因口径：是否存在**本次引入**的失败（门禁据此回滚；既有失败不归因）
        progress.verificationBlocking = blocking
    } else {
        ctx.logger.info(`[dry-run] Skipping verification for ${repo}`)
        progress.verificationPassed = undefined
        progress.verificationBlocking = undefined
    }
}
