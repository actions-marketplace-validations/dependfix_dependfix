// repo-report.ts — report-only 模式的单仓库处理（抓取 → 过滤 → 优先级 → 限流 → 结果记录）。
//
// 拆出理由（2026-10-17）：`app/index.ts` 触及 `max-lines` 上限，按既有处置「先拆分再改」把
// 与 fix 管线对称的 report 管线单独成模块（`app/repo-fix.ts` 为同族先例）。
import type { Octokit } from '@octokit/rest'
import { addTruncatedBySeverity, filterAlerts, limitAlerts, prioritizeAlerts, toErrorMessage } from '@dependfix/core'
import type { AppContext } from './helpers'
import { fetchRepoAlerts, fetchDefaultBranch, hasSourceScopedFetchFailure, truncatedWarning } from './repo-alerts'
import { alertsFetchTokenHint } from './token-hints'

/**
 * 处理单个仓库的 report-only 抓取，把告警与仓库结果写入上下文。
 *
 * 失败处理：仓库级异常记 `FETCH_FAILED`（仅在无 per-source 信号时补记，避免与
 * `fetchRepoAlerts` 已写入的带 source 条目重复）并写一条零指标仓库结果。
 */
export async function processRepoForReport(ctx: AppContext, client: Octokit | null, repo: string): Promise<void> {
    const startTime = Date.now()
    const [owner, name] = repo.split('/')

    try {
        const alerts = await fetchRepoAlerts(ctx, repo)
        const { filtered } = filterAlerts(alerts, { severityThreshold: ctx.config.severityThreshold })
        const prioritized = prioritizeAlerts(filtered)
        const { limited, truncated } = limitAlerts(prioritized, ctx.config.maxAlertsPerRepository)
        if (truncated.length > 0) {
            addTruncatedBySeverity(ctx.summary, truncated.map((item) => item.alert))
            ctx.logger.warn(truncatedWarning(ctx.config, truncated.length))
        }

        const defaultBranch = await fetchDefaultBranch(client, owner, name)

        ctx.allAlerts.push(...limited)
        ctx.repoResults.push({
            repository: repo,
            defaultBranch,
            alertsCount: limited.length,
            fixable: limited.filter((a) => a.fixable).length,
            fixed: 0,
            failed: 0,
            lockfileRepaired: false,
            durationMs: Date.now() - startTime,
        })

        ctx.logger.info(`Fetched ${limited.length} alerts for ${repo}`)
    } catch (error: unknown) {
        const message = toErrorMessage(error)
        const hint = alertsFetchTokenHint(error)
        ctx.logger.error(`Failed to fetch alerts for ${repo}: ${message}${hint ? ` — ${hint}` : ''}`)
        // 仓库级错误只在「没有 per-source 信号」时补记：全部启用源失败时 fetchRepoAlerts 已写入
        // 带 source 的 FETCH_FAILED，再追加无 source 的同类会形成重复信号并落入日志汇总的 unknown 分组
        if (!hasSourceScopedFetchFailure(ctx.allErrors, repo)) {
            ctx.allErrors.push({
                repository: repo,
                stage: 'fetch',
                category: 'FETCH_FAILED',
                message: hint ? `${message}（${hint}）` : message,
            })
        }
        ctx.repoResults.push({
            repository: repo,
            defaultBranch: '',
            alertsCount: 0,
            fixable: 0,
            fixed: 0,
            failed: 0,
            lockfileRepaired: false,
            durationMs: Date.now() - startTime,
        })
    }
}
