// source-failure-summary.ts — CLI run 结束时的「部分源拉取失败」汇总（从 index.ts 拆出以控制文件行数）。
//
// 行为不变：只在「至少 1 个源成功 + 至少 1 个源失败」时输出，避免与「全部源失败」重复提示。
// 与搬迁前的唯一差异：日志串去掉了流程编号前缀，措辞其余逐字一致。
import type { FixError, Logger } from '@dependfix/core'

/**
 * 输出「部分源拉取失败」汇总（per-source 错误隔离：单源失败不阻断其余源的结果）。
 *
 * 触发条件（必须全部满足，避免与"仓库失败"（无任何成功源）语义重叠）：
 * 1. allErrors 至少包含一个 `stage='fetch' + category='FETCH_FAILED'` 错误（per-source 失败）
 * 2. **至少一个仓库成功拉取了部分告警**（isAnyRepoSuccessful = true）——
 *    否则该仓库已按失败处理（无任何成功源），由 processRepoForReport catch + logger.error 单独处理，
 *    本函数聚焦"warn + 保留成功源"场景的汇总输出，避免重复提示。
 *
 * 汇总按 source 分组（'dependabot' / 'code-scanning' / 'code-quality' / 'pnpm-audit'），
 * 列出每个源失败的仓库数 + 示例错误消息，便于用户快速定位是 token 权限还是网络问题。
 */
export function logPartialSourceFailureSummary(
    allErrors: FixError[],
    logger: Logger,
    isAnyRepoSuccessful: boolean,
): void {
    const fetchErrors = allErrors.filter((e) => e.stage === 'fetch' && e.category === 'FETCH_FAILED')
    if (fetchErrors.length === 0) {
        return
    }
    if (!isAnyRepoSuccessful) {
        // 无成功仓库（仓库失败）：避免与 fetchRepoAlerts 抛错路径的 logger.error 重复提示
        return
    }

    // 按 source 分组
    const bySource = new Map<string, { repos: Set<string>, sampleMessage: string }>()
    for (const err of fetchErrors) {
        const source = err.source ?? 'unknown'
        const existing = bySource.get(source)
        if (existing) {
            existing.repos.add(err.repository)
        } else {
            bySource.set(source, {
                repos: new Set([err.repository]),
                sampleMessage: err.message,
            })
        }
    }

    const summary = [...bySource.entries()]
        .map(([source, { repos, sampleMessage }]) => `${source}（${repos.size} 个仓库: ${[...repos].slice(0, 3).join(', ')}${repos.size > 3 ? '...' : ''}）: ${sampleMessage}`)
        .join('\n  - ')

    logger.warn(
        `[alerts] 部分源拉取失败（per-source 错误隔离）— 成功源已保留继续处理，详细如下：\n  - ${summary}`,
    )
}
