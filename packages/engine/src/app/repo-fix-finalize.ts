// repo-fix-finalize.ts — 单仓库修复管线的「修复前基线采样」与「收尾（lockfile repair + 修复后验证）」交接面。
//
// 从 repo-fix.ts 迁出：该文件新增语句会越过 eslint `max-lines` 上限，按登记候选自带的触发条件
// 「再次改动需要新增语句时（先拆分再改）」处置；该候选已随之移出候选池，处置记录见 docs/plan/todo.md §M45.2 闭环登记。
// 纯搬迁：函数签名与行为不变（验证链口径见 docs/design/modules/dependency-fixer-records.md §12.9）。
import type { CommandResult } from '../runners/verification-runner'
import { tryLockfileRepair } from './helpers'
import type { RepoFixCtx, RepoFixProgress } from './repo-fix'
import { sampleVerificationBaseline, verifyProject } from './verify-project'

/**
 * 惰性取得本次运行修复前的验证基线（每运行一次）。
 * dry-run 不做验证，因此也不需要基线。
 */
export async function ensureVerificationBaseline(
    ctx: RepoFixCtx,
    repo: string,
): Promise<void> {
    if (ctx.config.dryRun || !ctx.verificationBaseline) {
        return
    }
    if (!ctx.verificationBaseline.value) {
        ctx.verificationBaseline.value = await sampleVerificationBaseline(ctx, repo)
    }
}

/** 读取本次运行的修复前基线（未采样 / 采样失败时为 undefined ⇒ 全量归因）。 */
function currentBaseline(ctx: RepoFixCtx): CommandResult[] | undefined {
    return ctx.verificationBaseline?.value
}

/**
 * 步骤 5：收尾——lockfile repair + 完整验证（dry-run 跳过验证）。零告警仓库跳过 lockfile repair
 * （无升级改动即无锁文件待修复），但保留修复后验证链——其 `verificationPassed` 是零告警仓库唯一的「处理成功」信号。
 */
export async function finalizeRepoFix(
    ctx: RepoFixCtx,
    repo: string,
    progress: RepoFixProgress,
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
        const verifyActions = await verifyProject(ctx, repo, { baseline: currentBaseline(ctx) })
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
