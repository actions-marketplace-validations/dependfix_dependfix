import { dispatchNotification, loadOrganizationNotificationSettings } from './delivery'
import { queryUnfixedSecurityAlerts } from './high-risk'
import { renderRunCompletedNotification, renderRunFailureNotification, renderSecurityNotification } from './business-templates'
import { parseSupportedLocale } from './channel'
import { ensureDatabaseInitialized } from '#server/database'
import { ScanRun } from '#server/entities/scan-run'
import type { BatchRun } from '#server/entities/batch-run'

const resolveBaseUrl = (): string =>
    (process.env.NUXT_PUBLIC_BETTER_AUTH_URL || process.env.NUXT_PUBLIC_BASE_URL || '').replace(/\/$/, '')

const parseSummary = (raw: string | null): { alertsTotal: number, fixedCount: number } => {
    if (!raw) {
        return { alertsTotal: 0, fixedCount: 0 }
    }
    try {
        const parsed = JSON.parse(raw) as { alertsTotal?: unknown, fixedCount?: unknown }
        return {
            alertsTotal: typeof parsed.alertsTotal === 'number' ? parsed.alertsTotal : 0,
            fixedCount: typeof parsed.fixedCount === 'number' ? parsed.fixedCount : 0,
        }
    } catch {
        return { alertsTotal: 0, fixedCount: 0 }
    }
}

/**
 * 批次终态通知（设计稿 §6.3 / §15 D4）：一个批次只发一封 security_critical、一封 security_high
 * 与一封 run_failure / run_completed。
 * 调用方须在条件写回成功且状态首次进入终态后触发；deliveryKey / 指纹去重兜底并发重复调用。
 */
export const notifyBatchTerminal = async (batch: BatchRun): Promise<void> => {
    if (batch.status === 'running') {
        return
    }
    const ds = await ensureDatabaseInitialized()
    const runs = await ds.getRepository(ScanRun).find({ where: { batchRunId: batch.id } })
    const { settings } = await loadOrganizationNotificationSettings()
    const baseUrl = resolveBaseUrl()
    const locale = parseSupportedLocale(process.env.DEPENDFIX_LOCALE)
    const link = baseUrl ? `${baseUrl}/batch-runs/${batch.id}` : undefined
    const triggeredByUserId = batch.triggeredByUserId

    if (batch.status === 'failed') {
        const failedCount = runs.filter((run) => run.status === 'failed').length || batch.failedCount
        await dispatchNotification({
            category: 'run_failure',
            scopeType: 'batch',
            scopeId: batch.id,
            message: renderRunFailureNotification({
                scopeLabel: 'batch',
                scopeId: batch.id,
                failedCount,
                totalCount: batch.repositoryCount,
                link,
            }, locale),
            triggeredByUserId,
            settings,
        })
        return
    }

    const runIds = runs.map((run) => run.id)
    const criticalRisk = await queryUnfixedSecurityAlerts(runIds, 'security_critical')
    if (criticalRisk.counts.total > 0) {
        await dispatchNotification({
            category: 'security_critical',
            scopeType: 'batch',
            scopeId: batch.id,
            fingerprint: criticalRisk.fingerprint,
            message: renderSecurityNotification({
                scopeLabel: 'batch',
                scopeId: batch.id,
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
        const highRisk = await queryUnfixedSecurityAlerts(runIds, 'security_high')
        if (highRisk.counts.total > 0) {
            await dispatchNotification({
                category: 'security_high',
                scopeType: 'batch',
                scopeId: batch.id,
                fingerprint: highRisk.fingerprint,
                message: renderSecurityNotification({
                    scopeLabel: 'batch',
                    scopeId: batch.id,
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

    if (!settings.categories.runCompleted) {
        return
    }
    const summary = parseSummary(batch.summaryJson)
    await dispatchNotification({
        category: 'run_completed',
        scopeType: 'batch',
        scopeId: batch.id,
        message: renderRunCompletedNotification({
            scopeLabel: 'batch',
            scopeId: batch.id,
            repositoryCount: batch.repositoryCount,
            alertsFound: summary.alertsTotal,
            alertsFixed: summary.fixedCount,
            link,
        }, locale),
        triggeredByUserId,
        settings,
    })
}
