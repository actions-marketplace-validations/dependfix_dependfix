import { dispatchNotification, loadOrganizationNotificationSettings } from './delivery'
import { queryUnfixedSecurityAlerts } from './high-risk'
import { renderRunCompletedNotification, renderRunFailureNotification, renderSecurityNotification } from './business-templates'
import { parseSupportedLocale } from './channel'
import type { ScanRun } from '#server/entities/scan-run'

const resolveBaseUrl = (): string =>
    (process.env.NUXT_PUBLIC_BETTER_AUTH_URL || process.env.NUXT_PUBLIC_BASE_URL || '').replace(/\/$/, '')

const parseSummary = (raw: string | null): { alertsFound: number, alertsFixed: number } => {
    if (!raw) {
        return { alertsFound: 0, alertsFixed: 0 }
    }
    try {
        const parsed = JSON.parse(raw) as { alertsFound?: unknown, alertsFixed?: unknown }
        return {
            alertsFound: typeof parsed.alertsFound === 'number' ? parsed.alertsFound : 0,
            alertsFixed: typeof parsed.alertsFixed === 'number' ? parsed.alertsFixed : 0,
        }
    } catch {
        return { alertsFound: 0, alertsFixed: 0 }
    }
}

/**
 * 单仓 run 终态通知（设计稿 §6.2 / §15 D4）：
 * - 批次内 run 不发单仓邮件（由批次终态合并）
 * - failed → run_failure
 * - completed / degraded → security_critical（必选，不受类别开关与阈值影响）
 *   + security_high（阈值含 high 且组织开关开启时）
 * - completed 再评估 run_completed
 */
export const notifyRunTerminal = async (run: ScanRun): Promise<void> => {
    if (run.batchRunId || !['failed', 'completed', 'degraded'].includes(run.status)) {
        return
    }
    const { settings } = await loadOrganizationNotificationSettings()
    const baseUrl = resolveBaseUrl()
    const locale = parseSupportedLocale(process.env.DEPENDFIX_LOCALE)
    const link = baseUrl ? `${baseUrl}/scans?run=${run.id}` : undefined
    const triggeredByUserId = run.triggeredByUserId

    if (run.status === 'failed') {
        const message = renderRunFailureNotification({
            scopeLabel: 'run',
            scopeId: run.id,
            failedCount: 1,
            totalCount: 1,
            failureCode: run.failureCode,
            failureStage: run.failureStage,
            link,
        }, locale)
        await dispatchNotification({
            category: 'run_failure',
            scopeType: 'run',
            scopeId: run.id,
            message,
            triggeredByUserId,
            settings,
        })
        return
    }

    const criticalRisk = await queryUnfixedSecurityAlerts([run.id], 'security_critical')
    if (criticalRisk.counts.total > 0) {
        await dispatchNotification({
            category: 'security_critical',
            scopeType: 'run',
            scopeId: run.id,
            fingerprint: criticalRisk.fingerprint,
            message: renderSecurityNotification({
                scopeLabel: 'run',
                scopeId: run.id,
                counts: criticalRisk.counts,
                repositories: criticalRisk.byRepository,
                truncated: criticalRisk.truncated,
                link,
            }, locale, 'security_critical'),
            triggeredByUserId,
            settings,
        })
    }

    if (settings.severityThreshold === 'high') {
        const highRisk = await queryUnfixedSecurityAlerts([run.id], 'security_high')
        if (highRisk.counts.total > 0) {
            await dispatchNotification({
                category: 'security_high',
                scopeType: 'run',
                scopeId: run.id,
                fingerprint: highRisk.fingerprint,
                message: renderSecurityNotification({
                    scopeLabel: 'run',
                    scopeId: run.id,
                    counts: highRisk.counts,
                    repositories: highRisk.byRepository,
                    truncated: highRisk.truncated,
                    link,
                }, locale, 'security_high'),
                triggeredByUserId,
                settings,
            })
        }
    }

    if (run.status === 'completed' && settings.categories.runCompleted) {
        const summary = parseSummary(run.summaryJson)
        const durationMs = run.startedAt && run.finishedAt
            ? Math.max(0, run.finishedAt.getTime() - run.startedAt.getTime())
            : undefined
        await dispatchNotification({
            category: 'run_completed',
            scopeType: 'run',
            scopeId: run.id,
            message: renderRunCompletedNotification({
                scopeLabel: 'run',
                scopeId: run.id,
                repositoryCount: 1,
                alertsFound: summary.alertsFound,
                alertsFixed: summary.alertsFixed,
                durationMs,
                link,
            }, locale),
            triggeredByUserId,
            settings,
        })
    }
}
