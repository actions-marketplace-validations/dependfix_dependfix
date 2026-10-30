// budget.ts — 运行级剩余预算（deadline）：预算不足时停止启动新工作并留痕。
//
// 背景：平台执行器按整体超时（默认 30 分钟）中止运行，但引擎此前不感知剩余预算——
// 预算见底后仍会启动新的安装 / 验证 / 基线采样，这些工作必然被超时打断，只留下
// 「半成品失败」噪声与额外回滚成本。
//
// 口径（单一事实源）：
// - 预算来源是**上层计算的绝对截止时间**（`deadlineAt`，epoch ms）；引擎只消费不解析，
//   与「仓库级执行预算」候选的解析面解耦
// - 启动新步骤要求剩余 ≥ {@link MIN_STEP_BUDGET_MS}；未提供 deadline（CLI 本地运行）
//   一律视为不限
// - 命中只**跳过启动新工作**并写一条 `BUDGET_EXHAUSTED` 审计（跳过类白名单，不影响
//   exit code）：已通过验证的单元仍允许提交，未开始的不再启动
import type { FixError, Logger } from '@dependfix/core'

/**
 * 启动新步骤所需的最小剩余预算。
 *
 * 取 1 分钟：低于该值时，一次安装 / 验证几乎必然被平台超时打断，只会产出
 * 「执行中被杀」的失败噪声；停止启动新工作更符合「已完成的修复仍交付」的取舍。
 */
export const MIN_STEP_BUDGET_MS = 60_000

/** 预算消费方的最小上下文（`RepoFixCtx` / `AppContext` 均满足）。 */
export interface BudgetTarget {
    deadlineAt?: number
    logger: Pick<Logger, 'info' | 'warn'>
    allErrors: FixError[]
    /** 已记录的预算跳过（`stage:work`），避免同一跳过来回刷审计 */
    budgetSkips?: Set<string>
}

/** 剩余预算（毫秒）；未设置截止时间时返回 `undefined`。 */
export function remainingBudgetMs(deadlineAt?: number, now = Date.now()): number | undefined {
    if (deadlineAt === undefined) {
        return undefined
    }
    return deadlineAt - now
}

/** 是否还有足够预算启动下一个步骤（未设置截止时间 → `true`）。 */
export function hasBudgetForNextStep(deadlineAt?: number, now = Date.now()): boolean {
    const remaining = remainingBudgetMs(deadlineAt, now)
    return remaining === undefined || remaining >= MIN_STEP_BUDGET_MS
}

/**
 * 记录一次「预算不足 → 跳过启动新工作」。
 *
 * 审计条目进入 `allErrors`（报告 Errors 表可见），但 `BUDGET_EXHAUSTED` 在跳过类白名单内，
 * 不影响 exit code / 仓库成功判定。同一 `stage:work` 只记一次（循环里逐包命中不刷屏）。
 */
export function recordBudgetExhausted(
    target: BudgetTarget,
    input: { repository: string, stage: FixError['stage'], work: string },
): void {
    const key = `${input.stage}:${input.work}`
    const seen = target.budgetSkips
    if (seen?.has(key)) {
        return
    }
    seen?.add(key)
    const remaining = remainingBudgetMs(target.deadlineAt)
    const remainingText = remaining === undefined ? 'unknown' : `${Math.max(0, remaining)}ms`
    target.logger.warn(
        `[budget] ${input.repository}: run budget exhausted (remaining ${remainingText}, `
        + `minimum ${MIN_STEP_BUDGET_MS}ms) — skipping ${input.work}`,
    )
    target.allErrors.push({
        repository: input.repository,
        stage: input.stage,
        category: 'BUDGET_EXHAUSTED',
        message: `Run budget exhausted before ${input.work} (remaining ${remainingText}); `
            + 'no new work was started. Already-verified units are still delivered.',
    })
}

/**
 * 预算检查 + 留痕的组合入口：返回 `false` 表示调用方应停止启动新工作。
 *
 * 典型用法（每包 / 每组 / 每次验证前）：`if (!budgetAllows(ctx, repo, 'fix', 'package upgrade')) break`。
 */
export function budgetAllows(
    target: BudgetTarget,
    input: { repository: string, stage: FixError['stage'], work: string },
    now = Date.now(),
): boolean {
    if (hasBudgetForNextStep(target.deadlineAt, now)) {
        return true
    }
    recordBudgetExhausted(target, input)
    return false
}
