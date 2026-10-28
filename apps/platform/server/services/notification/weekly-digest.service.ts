/**
 * 周汇总（`weekly_digest`）投递服务（设计稿 §6.5 / §7.3）。
 *
 * 职责边界：
 * - 何时触发由 `plugins/weekly-digest.ts` + `weekly-digest-schedule.ts` 决定；
 * - 本文件负责「组织 / 个人 / 部署三层开关 → 收件人 → 活跃快照 → 逐用户投递」；
 * - 幂等由逐用户投递键（`buildDigestDeliveryKey`：用户 + 渠道 + ISO 周）兜底，
 *   内容未变化也按周发送（周期摘要的显式语义，豁免内容指纹 / 冷却 / 每小时上限）。
 *
 * 失败语义：所有投递失败均落 `notification_log` 并计入返回值，不抛错、不影响平台其它任务。
 */
import { dispatchNotification, loadOrganizationNotificationSettings, recordNotificationLog } from './delivery'
import { queryActiveUnfixedHighRisk } from './high-risk'
import { renderWeeklyDigestNotification } from './business-templates'
import { parseSupportedLocale } from './channel'
import { isDeploymentNotificationEnabled } from './preferences'
import { resolveNotificationRecipients } from './recipients'
import { resolveWeeklyDigestHour, resolveWeeklyDigestSlot } from './weekly-digest-schedule'
import { logger } from '#server/utils/logger'

const resolveBaseUrl = (): string =>
    (process.env.NUXT_PUBLIC_BETTER_AUTH_URL || process.env.NUXT_PUBLIC_BASE_URL || '').replace(/\/$/, '')

export type WeeklyDigestStatus =
    | 'sent'
    | 'partial'
    | 'failed'
    | 'noop'
    | 'skipped_disabled'
    | 'skipped_org_disabled'
    | 'skipped_no_recipient'
    | 'skipped_duplicate'

export interface WeeklyDigestResult {
    weekKey: string
    status: WeeklyDigestStatus
    /** 通过三层开关的收件人数量（逐封投递）。 */
    recipients: number
    sent: number
    failed: number
    /** 渠道不可用（noop）数量。 */
    noop: number
    /** 其它跳过（并发占位 / 无收件人）数量。 */
    skipped: number
}

/**
 * 发送本周周报（按用户逐封）。
 *
 * 判定顺序：部署总开关 → 组织 `weeklyDigest` → 收件人（个人偏好 / 额外管理员）→ 活跃快照。
 * 三层任一关闭都不产生邮件；组织关闭时连查询都不做（默认关闭是常态）。
 */
export const sendWeeklyDigest = async (now: Date = new Date()): Promise<WeeklyDigestResult> => {
    const { weekKey } = resolveWeeklyDigestSlot(now, resolveWeeklyDigestHour())
    const base: WeeklyDigestResult = {
        weekKey,
        status: 'skipped_disabled',
        recipients: 0,
        sent: 0,
        failed: 0,
        noop: 0,
        skipped: 0,
    }

    if (!isDeploymentNotificationEnabled()) {
        logger.info(`[weekly-digest] ${weekKey} deployment notifications disabled; skip`)
        return base
    }

    const { settings } = await loadOrganizationNotificationSettings()
    if (!settings.categories.weeklyDigest) {
        logger.info(`[weekly-digest] ${weekKey} organization weekly digest disabled; skip`)
        return { ...base, status: 'skipped_org_disabled' }
    }

    const recipients = await resolveNotificationRecipients({ category: 'weekly_digest', settings })
    if (recipients.length === 0) {
        await recordNotificationLog({
            deliveryKey: null,
            category: 'weekly_digest',
            scopeType: 'digest',
            scopeId: weekKey,
            channel: 'email',
            fingerprint: null,
            recipients: [],
            status: 'skipped_no_recipient',
        })
        logger.info(`[weekly-digest] ${weekKey} no recipients enabled; skip`)
        return { ...base, status: 'skipped_no_recipient' }
    }

    const snapshot = await queryActiveUnfixedHighRisk(settings.severityThreshold)
    const baseUrl = resolveBaseUrl()
    const locale = parseSupportedLocale(process.env.DEPENDFIX_LOCALE)
    const message = renderWeeklyDigestNotification({
        weekKey,
        counts: snapshot.counts,
        repositories: snapshot.byRepository,
        truncated: snapshot.truncated,
        exempted: snapshot.exempted,
        link: baseUrl ? `${baseUrl}/alerts` : undefined,
    }, locale)

    const result: WeeklyDigestResult = { ...base, status: 'sent', recipients: recipients.length }
    for (const recipient of recipients) {
        const dispatchResult = await dispatchNotification({
            category: 'weekly_digest',
            scopeType: 'digest',
            scopeId: weekKey,
            message,
            recipients: [recipient],
            recipientUserId: recipient.userId || null,
            recipientIdentity: recipient.userId || recipient.email,
            settings,
        })
        if (dispatchResult.status === 'sent') {
            result.sent++
        } else if (dispatchResult.status === 'failed') {
            result.failed++
        } else if (dispatchResult.status === 'noop') {
            result.noop++
        } else {
            result.skipped++
        }
    }

    if (result.failed > 0 || result.noop > 0) {
        if (result.sent > 0) {
            result.status = 'partial'
        } else {
            result.status = result.noop > 0 ? 'noop' : 'failed'
        }
    } else if (result.sent === 0) {
        // 同周重复触发：逐用户投递键全部命中，未产生新邮件
        result.status = result.skipped > 0 ? 'skipped_duplicate' : 'failed'
    }
    logger.info(
        `[weekly-digest] ${weekKey} recipients=${result.recipients} sent=${result.sent} failed=${result.failed} noop=${result.noop} skipped=${result.skipped} (${result.status})`,
    )
    return result
}
