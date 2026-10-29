import { In, MoreThanOrEqual, Not } from 'typeorm'
import { listNotificationChannels } from './registry'
import type { NotificationChannel, RenderedNotification } from './channel'
import { buildDigestDeliveryKey, buildNotificationDeliveryKey, buildPlatformDeliveryKey, isNotificationCooldownActive, isNotificationThrottled } from './dedupe'
import { isDeploymentNotificationEnabled } from './preferences'
import { parseNotificationSettingsJson } from './settings'
import { resolveNotificationRecipients } from './recipients'
import type { NotificationCategory, NotificationDispatchResult, NotificationRecipient, NotificationSettings } from './types'
import { resolveOrganizationId } from '#server/utils/organization'
import { Organization } from '#server/entities/organization'
import { NotificationLog, type NotificationScopeType } from '#server/entities/notification-log'
import { ensureDatabaseInitialized } from '#server/database'
import { logger } from '#server/utils/logger'

export interface LoadedNotificationSettings {
    organizationId: string
    settings: NotificationSettings
}

export const loadOrganizationNotificationSettings = async (): Promise<LoadedNotificationSettings> => {
    const ds = await ensureDatabaseInitialized()
    const organizationId = await resolveOrganizationId(ds)
    const org = await ds.getRepository(Organization).findOne({ where: { id: organizationId } })
    return {
        organizationId,
        settings: parseNotificationSettingsJson(org?.notificationSettingsJson),
    }
}

const isUniqueViolation = (error: unknown): boolean => {
    const code = (error as { code?: string })?.code ?? ''
    const message = error instanceof Error ? error.message : String(error)
    return code === 'SQLITE_CONSTRAINT_UNIQUE'
        || code === '23505'
        || code === 'ER_DUP_ENTRY'
        || message.includes('UNIQUE constraint failed')
        || message.includes('duplicate key value')
}

const STALE_SENDING_MS = 10 * 60 * 1000

/** 回收超过 10 分钟的 sending 占位（进程崩溃遗留），允许下一次尝试重新占位。 */
export const reclaimStaleSendingLog = async (deliveryKey: string, now = new Date()): Promise<void> => {
    if (!deliveryKey) {
        return
    }
    try {
        const ds = await ensureDatabaseInitialized()
        const repo = ds.getRepository(NotificationLog)
        const row = await repo.findOne({ where: { deliveryKey, status: 'sending' } })
        if (row && now.getTime() - row.createdAt.getTime() > STALE_SENDING_MS) {
            await repo.delete(row.id)
        }
    } catch (error) {
        logger.error('[notification:delivery] failed to reclaim stale sending log', { error })
    }
}

export const recordNotificationLog = async (input: {
    deliveryKey: string | null
    category: string
    scopeType: NotificationScopeType
    scopeId: string
    channel: string
    fingerprint: string | null
    recipients: string[]
    status: NotificationLog['status']
    errorMessage?: string | null
    sentAt?: Date | null
    /** 周报逐封投递时写入收件人用户 id；其余类别为 null。 */
    recipientUserId?: string | null
}): Promise<NotificationLog | null> => {
    try {
        const ds = await ensureDatabaseInitialized()
        return await ds.getRepository(NotificationLog).save(ds.getRepository(NotificationLog).create({
            deliveryKey: input.deliveryKey,
            category: input.category,
            scopeType: input.scopeType,
            scopeId: input.scopeId,
            channel: input.channel,
            fingerprint: input.fingerprint,
            recipientUserId: input.recipientUserId ?? null,
            recipientsJson: JSON.stringify(input.recipients),
            status: input.status,
            errorMessage: input.errorMessage ?? null,
            sentAt: input.sentAt ?? null,
        }))
    } catch (error) {
        if (isUniqueViolation(error)) {
            throw error
        }
        logger.error('[notification:delivery] failed to write notification_log', { error })
        return null
    }
}

export const updateNotificationLog = async (log: NotificationLog | null, patch: Partial<NotificationLog>): Promise<void> => {
    if (!log) {
        return
    }
    try {
        const ds = await ensureDatabaseInitialized()
        await ds.getRepository(NotificationLog).update(log.id, patch)
    } catch (error) {
        logger.error('[notification:delivery] failed to update notification_log', { error })
    }
}

const resolveEmailChannel = (): NotificationChannel | null =>
    listNotificationChannels().find((channel) => channel.name === 'email' && typeof channel.sendMessage === 'function') ?? null

export interface DispatchNotificationInput {
    category: NotificationCategory
    scopeType: NotificationScopeType
    scopeId: string
    message: RenderedNotification
    fingerprint?: string | null
    triggeredByUserId?: string | null
    /** 测试 / 调用方已解析时传入，避免重复查询。 */
    recipients?: NotificationRecipient[]
    settings?: NotificationSettings
    /**
     * 周报逐封投递的收件人用户 id（写入 notification_log.recipientUserId）；
     * 额外管理员收件人无 userId 时为 null。
     */
    recipientUserId?: string | null
    /**
     * 周报逐封投递的稳定身份（userId，缺省用邮箱）：用于构造「用户 + 渠道 + ISO 周」唯一键。
     * 仅在 `category === 'weekly_digest'` 时参与投递键计算。
     */
    recipientIdentity?: string
}

/**
 * 统一业务通知投递入口（设计稿 §6.4）：
 * - 收件人 / 渠道检查 → 指纹重复 → 冷却窗口 → 每小时上限 → 唯一键占位 → 发送 → 回写状态
 * - 所有失败均落 notification_log 并返回结果，不抛错阻断扫描
 */
export const dispatchNotification = async (input: DispatchNotificationInput): Promise<NotificationDispatchResult> => {
    if (!isDeploymentNotificationEnabled()) {
        await recordNotificationLog({
            deliveryKey: null,
            category: input.category,
            scopeType: input.scopeType,
            scopeId: input.scopeId,
            channel: 'email',
            fingerprint: input.fingerprint ?? null,
            recipients: [],
            status: 'noop',
        })
        return { status: 'noop', delivered: false, channel: null, recipientCount: 0 }
    }
    const loaded = input.settings
        ? { organizationId: '', settings: input.settings }
        : await loadOrganizationNotificationSettings()
    const settings = loaded.settings
    const recipients = input.recipients ?? await resolveNotificationRecipients({
        category: input.category,
        settings,
        triggeredByUserId: input.triggeredByUserId,
        deploymentEnabled: isDeploymentNotificationEnabled(),
    })
    const emails = recipients.map((recipient) => recipient.email)
    const channel = resolveEmailChannel()
    const now = new Date()

    if (recipients.length === 0) {
        await recordNotificationLog({
            deliveryKey: null,
            category: input.category,
            scopeType: input.scopeType,
            scopeId: input.scopeId,
            channel: channel?.name ?? 'email',
            fingerprint: input.fingerprint ?? null,
            recipientUserId: input.recipientUserId ?? null,
            recipients: [],
            status: 'skipped_no_recipient',
        })
        return { status: 'skipped_no_recipient', delivered: false, channel: null, recipientCount: 0 }
    }

    if (!channel?.isAvailable()) {
        await recordNotificationLog({
            deliveryKey: null,
            category: input.category,
            scopeType: input.scopeType,
            scopeId: input.scopeId,
            channel: channel?.name ?? 'email',
            fingerprint: input.fingerprint ?? null,
            recipientUserId: input.recipientUserId ?? null,
            recipients: emails,
            status: 'noop',
        })
        return { status: 'noop', delivered: false, channel: channel?.name ?? null, recipientCount: recipients.length }
    }

    const ds = await ensureDatabaseInitialized()
    const logRepo = ds.getRepository(NotificationLog)
    const isPlatform = input.category === 'platform_incident'
    const isDigest = input.category === 'weekly_digest'

    // 周报豁免指纹 / 24h 冷却（设计稿 §7.3）：周期摘要按「用户 + 渠道 + ISO 周」唯一键去重。
    if (!isPlatform && !isDigest) {
        const latest = await logRepo.findOne({
            where: {
                scopeType: input.scopeType,
                scopeId: input.scopeId,
                category: input.category,
                channel: channel.name,
                status: 'sent',
            },
            order: { createdAt: 'DESC' },
        })
        if (latest && input.fingerprint && latest.fingerprint === input.fingerprint) {
            await recordNotificationLog({
                deliveryKey: null,
                category: input.category,
                scopeType: input.scopeType,
                scopeId: input.scopeId,
                channel: channel.name,
                fingerprint: input.fingerprint,
                recipients: emails,
                status: 'skipped_duplicate',
            })
            return { status: 'skipped_duplicate', delivered: false, channel: channel.name, recipientCount: recipients.length }
        }
        if (isNotificationCooldownActive(latest?.sentAt, now, settings.cooldownHours)) {
            await recordNotificationLog({
                deliveryKey: null,
                category: input.category,
                scopeType: input.scopeType,
                scopeId: input.scopeId,
                channel: channel.name,
                fingerprint: input.fingerprint ?? null,
                recipients: emails,
                status: 'skipped_cooldown',
            })
            return { status: 'skipped_cooldown', delivered: false, channel: channel.name, recipientCount: recipients.length }
        }
    }

    // 周报豁免每小时上限（自身已有「每用户每渠道每周一次」上限，设计稿 §7.3）。
    if (!isDigest) {
        // 独立计数桶（设计稿 §15 D4）：security_critical 只统计自身 sent 行，其余类别不统计它，
        // 避免批量运行的常规通知把「必发」的 critical 挤成 skipped_throttled；数值上限仍共用 maxPerHour。
        const criticalBucket = input.category === 'security_critical'
        const sentInLastHour = await logRepo.count({
            where: {
                channel: channel.name,
                status: 'sent',
                // 周报逐封写入的 sent 行不占用共享上限，避免一次周报挤掉平台事件 / 安全告警
                category: criticalBucket ? 'security_critical' : Not(In(['weekly_digest', 'security_critical'])),
                createdAt: MoreThanOrEqual(new Date(now.getTime() - 3_600_000)),
            },
        })
        if (isNotificationThrottled(sentInLastHour, settings.maxPerHour)) {
            await recordNotificationLog({
                deliveryKey: null,
                category: input.category,
                scopeType: input.scopeType,
                scopeId: input.scopeId,
                channel: channel.name,
                fingerprint: input.fingerprint ?? null,
                recipients: emails,
                status: 'skipped_throttled',
            })
            return { status: 'skipped_throttled', delivered: false, channel: channel.name, recipientCount: recipients.length }
        }
    }

    let deliveryKey: string
    if (isPlatform) {
        deliveryKey = buildPlatformDeliveryKey(input.scopeId)
    } else if (isDigest) {
        const identity = input.recipientIdentity || (recipients.length === 1 ? recipients[0]?.email : '')
        if (!identity) {
            logger.error('[notification:delivery] weekly_digest requires recipientIdentity for multi-recipient dispatch')
            return { status: 'failed', delivered: false, channel: channel.name, recipientCount: recipients.length }
        }
        deliveryKey = buildDigestDeliveryKey(input.scopeId, identity, channel.name)
    } else {
        deliveryKey = buildNotificationDeliveryKey({
            scopeType: input.scopeType,
            scopeId: input.scopeId,
            category: input.category,
            fingerprint: input.fingerprint ?? '',
            now: now.getTime(),
            cooldownHours: settings.cooldownHours,
        })
    }

    await reclaimStaleSendingLog(deliveryKey, now)

    let log: NotificationLog | null = null
    try {
        log = await logRepo.save(logRepo.create({
            deliveryKey,
            category: input.category,
            scopeType: input.scopeType,
            scopeId: input.scopeId,
            channel: channel.name,
            fingerprint: input.fingerprint ?? null,
            recipientUserId: input.recipientUserId ?? null,
            recipientsJson: JSON.stringify(emails),
            status: 'sending',
            errorMessage: null,
            sentAt: null,
        }))
    } catch (error) {
        if (isUniqueViolation(error)) {
            await recordNotificationLog({
                deliveryKey: null,
                category: input.category,
                scopeType: input.scopeType,
                scopeId: input.scopeId,
                channel: channel.name,
                fingerprint: input.fingerprint ?? null,
                recipientUserId: input.recipientUserId ?? null,
                recipients: emails,
                status: 'skipped_duplicate',
            })
            return { status: 'skipped_duplicate', delivered: false, channel: channel.name, recipientCount: recipients.length }
        }
        logger.error('[notification:delivery] failed to reserve delivery key', { error })
        return { status: 'failed', delivered: false, channel: channel.name, recipientCount: recipients.length }
    }

    try {
        const result = await channel.sendMessage!(input.message, emails)
        if (!result.delivered) {
            await updateNotificationLog(log, { status: 'noop', deliveryKey: null })
            return { status: 'noop', delivered: false, channel: channel.name, recipientCount: recipients.length }
        }
        await updateNotificationLog(log, { status: 'sent', sentAt: new Date() })
        return {
            status: 'sent',
            delivered: true,
            channel: channel.name,
            recipientCount: recipients.length,
            messageId: result.messageId,
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await updateNotificationLog(log, {
            status: 'failed',
            deliveryKey: null,
            errorMessage: message.slice(0, 500),
        })
        return { status: 'failed', delivered: false, channel: channel.name, recipientCount: recipients.length }
    }
}
