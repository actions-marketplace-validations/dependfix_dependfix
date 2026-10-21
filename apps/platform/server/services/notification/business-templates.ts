import { escapeHtml, type NotificationLocale } from './templates'
import { NOTIFICATION_CATEGORY_TAGS } from './types'
import type { RenderedNotification } from './channel'

export interface SecurityNotificationData {
    scopeLabel: 'run' | 'batch'
    scopeId: string
    counts: { critical: number, high: number, total: number }
    repositories: Array<{ repository: string, critical: number, high: number, total: number }>
    truncated: { critical: number, high: number, total: number }
    link?: string
}

export interface RunFailureNotificationData {
    scopeLabel: 'run' | 'batch'
    scopeId: string
    failedCount: number
    totalCount?: number
    failureCode?: string | null
    failureStage?: string | null
    link?: string
}

export interface RunCompletedNotificationData {
    scopeLabel: 'run' | 'batch'
    scopeId: string
    repositoryCount: number
    alertsFound: number
    alertsFixed: number
    durationMs?: number
    link?: string
}

interface Strings {
    securityTitle: (total: number, repos: number) => string
    failureTitle: (scope: string, failed: number) => string
    completedTitle: (scope: string, fixed: number, found: number) => string
    critical: string
    high: string
    total: string
    repository: string
    repositories: string
    truncated: (n: number) => string
    scope: string
    failed: string
    failureCode: string
    failureStage: string
    alertsFound: string
    alertsFixed: string
    duration: string
    viewDetails: string
    footer: string
}

const ZH: Strings = {
    securityTitle: (total, repos) => `${total} 个高危告警未修复 — ${repos} 个仓库`,
    failureTitle: (scope, failed) => `${scope}失败 — ${failed} 个仓库`,
    completedTitle: (scope, fixed, found) => `${scope}完成 — 修复 ${fixed} / 告警 ${found}`,
    critical: '严重',
    high: '高危',
    total: '合计',
    repository: '仓库',
    repositories: '仓库',
    truncated: (n) => `另有 ${n} 条截断未纳入明细`,
    scope: '范围',
    failed: '失败仓库数',
    failureCode: '失败码',
    failureStage: '失败阶段',
    alertsFound: '告警数',
    alertsFixed: '已修复',
    duration: '耗时',
    viewDetails: '查看详情',
    footer: '此邮件由 Dependfix 平台自动发送。请登录平台查看完整详情与处理动作。',
}

const EN: Strings = {
    securityTitle: (total, repos) => `${total} high-risk alerts unfixed — ${repos} repositories`,
    failureTitle: (scope, failed) => `${scope} failed — ${failed} repositories`,
    completedTitle: (scope, fixed, found) => `${scope} completed — ${fixed} fixed / ${found} alerts`,
    critical: 'Critical',
    high: 'High',
    total: 'Total',
    repository: 'Repository',
    repositories: 'Repositories',
    truncated: (n) => `${n} truncated alerts are not included in the details`,
    scope: 'Scope',
    failed: 'Failed repositories',
    failureCode: 'Failure code',
    failureStage: 'Failure stage',
    alertsFound: 'Alerts found',
    alertsFixed: 'Fixed',
    duration: 'Duration',
    viewDetails: 'View details',
    footer: 'This email is sent automatically by the Dependfix platform. Log in to view full details.',
}

const strings = (locale: NotificationLocale): Strings => locale === 'en-US' ? EN : ZH

const scopeLabel = (label: 'run' | 'batch', locale: NotificationLocale): string => {
    if (label === 'run') {
        return locale === 'en-US' ? 'Run' : '运行'
    }
    return locale === 'en-US' ? 'Batch' : '批次'
}

const wrap = (title: string, rows: string, link: string | undefined, footer: string): string => `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; color: #334155;">
    <h2 style="margin: 0 0 16px; font-size: 20px;">${escapeHtml(title)}</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">${rows}</table>
    ${link ? `<p><a href="${escapeHtml(link)}" style="color: #2563eb;">${escapeHtml(link)}</a></p>` : ''}
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
    <p style="font-size: 12px; color: #94a3b8;">${escapeHtml(footer)}</p>
</body></html>`.trim()

const cell = (label: string, value: string): string =>
    `<tr><td style="padding: 8px; font-weight: 600; width: 160px;">${escapeHtml(label)}</td><td style="padding: 8px;">${value}</td></tr>`

const textFooter = (s: Strings, link?: string): string => [s.footer, link ?? ''].filter(Boolean).join('\n')

export const renderSecurityNotification = (
    data: SecurityNotificationData,
    locale: NotificationLocale = 'zh-CN',
): RenderedNotification => {
    const s = strings(locale)
    const scope = scopeLabel(data.scopeLabel, locale)
    const title = `[dependfix]${NOTIFICATION_CATEGORY_TAGS.security_high} ${s.securityTitle(data.counts.total, data.repositories.length)}`
    const shown = data.repositories.slice(0, 50)
    const repoRows = shown.map((repo) =>
        `<tr><td style="padding: 6px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(repo.repository)}</td><td style="padding: 6px; border-bottom: 1px solid #e2e8f0;">${repo.critical}</td><td style="padding: 6px; border-bottom: 1px solid #e2e8f0;">${repo.high}</td><td style="padding: 6px; border-bottom: 1px solid #e2e8f0;">${repo.total}</td></tr>`,
    ).join('')
    const remaining = data.repositories.length - shown.length
    const rows = [
        cell(s.scope, escapeHtml(`${scope} ${data.scopeId}`)),
        cell(s.critical, String(data.counts.critical)),
        cell(s.high, String(data.counts.high)),
        cell(s.total, String(data.counts.total)),
        data.truncated.total > 0 ? cell(s.truncated(data.truncated.total), `${data.truncated.critical} ${s.critical} / ${data.truncated.high} ${s.high}`) : '',
    ].join('')
    const repoTable = shown.length > 0
        ? `<h3 style="font-size: 16px;">${escapeHtml(s.repositories)}</h3><table style="width: 100%; border-collapse: collapse;"><thead><tr><th style="text-align:left;padding:6px;">${escapeHtml(s.repository)}</th><th style="text-align:left;padding:6px;">${escapeHtml(s.critical)}</th><th style="text-align:left;padding:6px;">${escapeHtml(s.high)}</th><th style="text-align:left;padding:6px;">${escapeHtml(s.total)}</th></tr></thead><tbody>${repoRows}</tbody></table>${remaining > 0 ? `<p style="font-size: 12px;color:#64748b;">+${remaining}</p>` : ''}`
        : ''
    const html = wrap(title, rows, data.link, s.footer).replace('</table>', `</table>${repoTable}`)
    const text = [
        title,
        `${s.scope}: ${scope} ${data.scopeId}`,
        `${s.critical}: ${data.counts.critical}`,
        `${s.high}: ${data.counts.high}`,
        `${s.total}: ${data.counts.total}`,
        data.truncated.total > 0 ? s.truncated(data.truncated.total) : '',
        ...shown.map((repo) => `${repo.repository}: ${repo.critical}/${repo.high}/${repo.total}`),
        data.link ?? '',
        s.footer,
    ].filter(Boolean).join('\n')
    return { subject: title, html, text }
}

export const renderRunFailureNotification = (
    data: RunFailureNotificationData,
    locale: NotificationLocale = 'zh-CN',
): RenderedNotification => {
    const s = strings(locale)
    const scope = scopeLabel(data.scopeLabel, locale)
    const title = `[dependfix]${NOTIFICATION_CATEGORY_TAGS.run_failure} ${s.failureTitle(scope, data.failedCount)}`
    const rows = [
        cell(s.scope, escapeHtml(`${scope} ${data.scopeId}`)),
        cell(s.failed, String(data.failedCount)),
        data.totalCount !== undefined ? cell(s.total, String(data.totalCount)) : '',
        data.failureCode ? cell(s.failureCode, escapeHtml(data.failureCode)) : '',
        data.failureStage ? cell(s.failureStage, escapeHtml(data.failureStage)) : '',
    ].join('')
    const html = wrap(title, rows, data.link, s.footer)
    const text = [
        title,
        `${s.scope}: ${scope} ${data.scopeId}`,
        `${s.failed}: ${data.failedCount}`,
        data.totalCount !== undefined ? `${s.total}: ${data.totalCount}` : '',
        data.failureCode ? `${s.failureCode}: ${data.failureCode}` : '',
        data.failureStage ? `${s.failureStage}: ${data.failureStage}` : '',
        textFooter(s, data.link),
    ].filter(Boolean).join('\n')
    return { subject: title, html, text }
}

export const renderRunCompletedNotification = (
    data: RunCompletedNotificationData,
    locale: NotificationLocale = 'zh-CN',
): RenderedNotification => {
    const s = strings(locale)
    const scope = scopeLabel(data.scopeLabel, locale)
    const title = `[dependfix]${NOTIFICATION_CATEGORY_TAGS.run_completed} ${s.completedTitle(scope, data.alertsFixed, data.alertsFound)}`
    const rows = [
        cell(s.scope, escapeHtml(`${scope} ${data.scopeId}`)),
        cell(s.repositories, String(data.repositoryCount)),
        cell(s.alertsFound, String(data.alertsFound)),
        cell(s.alertsFixed, String(data.alertsFixed)),
        data.durationMs !== undefined ? cell(s.duration, `${Math.max(0, Math.round(data.durationMs / 1000))}s`) : '',
        data.link ? cell(s.viewDetails, `<a href="${escapeHtml(data.link)}">${escapeHtml(data.link)}</a>`) : '',
    ].join('')
    const html = wrap(title, rows, data.link, s.footer)
    const text = [
        title,
        `${s.scope}: ${scope} ${data.scopeId}`,
        `${s.repositories}: ${data.repositoryCount}`,
        `${s.alertsFound}: ${data.alertsFound}`,
        `${s.alertsFixed}: ${data.alertsFixed}`,
        data.durationMs !== undefined ? `${s.duration}: ${Math.max(0, Math.round(data.durationMs / 1000))}s` : '',
        textFooter(s, data.link),
    ].filter(Boolean).join('\n')
    return { subject: title, html, text }
}
