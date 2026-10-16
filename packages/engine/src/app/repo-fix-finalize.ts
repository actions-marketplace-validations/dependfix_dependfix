// repo-fix-finalize.ts — 单仓库修复管线的「基线采样触发」与「收尾（lockfile repair + 修复后验证）」交接面。
//
// 从 repo-fix.ts 迁出：该文件新增语句会越过 eslint `max-lines` 上限，按登记候选自带的触发条件
// 「再次改动需要新增语句时（先拆分再改）」处置；该候选已随之移出候选池，处置记录见 docs/plan/todo.md §M45.2 闭环登记。
// 两段职责的耦合点只有运行级基线持有器：采样时机决定是否需要付基线成本，收尾消费采样结果做归因豁免。
// 验证链口径见 docs/design/modules/dependency-fixer-records.md §12.9。
import type { CommandResult } from '../runners/verification-runner'
import { tryLockfileRepair } from './helpers'
import type { RepoFixCtx, RepoFixProgress } from './repo-fix'
import { sampleVerificationBaseline, verifyProject } from './verify-project'

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
): Promise<{ exemptAttribution: boolean }> {
    if (ctx.config.dryRun || !ctx.verificationBaseline) {
        return { exemptAttribution: false }
    }
    if (ctx.verificationBaseline.value) {
        return { exemptAttribution: false }
    }
    if (!options.hasWork) {
        ctx.logger.info(
            `[baseline] Skipping pre-fix baseline for ${repo}: no alerts → no writes in this run `
            + '(verification failures of this repository are not attributed to this change)',
        )
        return { exemptAttribution: true }
    }
    ctx.verificationBaseline.value = await sampleVerificationBaseline(ctx, repo)
    return { exemptAttribution: false }
}

/** 读取本次运行的修复前基线（未采样 / 采样失败时为 undefined ⇒ 全量归因）。 */
function currentBaseline(ctx: RepoFixCtx): CommandResult[] | undefined {
    return ctx.verificationBaseline?.value
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
    options: { exemptAttribution?: boolean } = {},
): Promise<void> {
    if (progress.alertsCount > 0) {
        const repairAction = tryLockfileRepair(ctx, repo)
        ctx.allActions.push(repairAction)
        if (repairAction.success) {
            progress.lockfileRepaired = true
        }
    } else {
        ctx.logger.info(`[skip] No alerts for ${repo} — skipping lockfile repair`)
    }

    if (!ctx.config.dryRun) {
        const verifyActions = await verifyProject(ctx, repo, {
            baseline: currentBaseline(ctx),
            // 「无改动即豁免」：零告警仓库未采样基线（无任何写操作）——其失败一律视为既有失败，
            // 与「基线中同命令也失败」等价（同命令 + 同一 pristine 工作区），故归因口径零退化
            noChanges: options.exemptAttribution === true,
        })
        ctx.allActions.push(...verifyActions)
        // 原始口径：修复后链路是否全绿（报告与「成功交付」启发式沿用）
        progress.verificationPassed = verifyActions.every((a) => a.success)
        // 归因口径：是否存在**本次引入**的失败（门禁据此回滚；既有失败不归因）
        progress.verificationBlocking = verifyActions.some((a) => !a.success && !a.preExisting)
    } else {
        ctx.logger.info(`[dry-run] Skipping verification for ${repo}`)
        progress.verificationPassed = undefined
        progress.verificationBlocking = undefined
    }
}
