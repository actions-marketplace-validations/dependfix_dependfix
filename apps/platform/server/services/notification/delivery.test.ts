import 'reflect-metadata'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMemoryDatabase, teardownMemoryDatabase } from '../../../tests/api-helper'
import { dispatchNotification } from './delivery'
import { DEFAULT_NOTIFICATION_SETTINGS } from './settings'
import { buildNotificationDeliveryKey } from './dedupe'
import { registerNotificationChannel, unregisterNotificationChannel } from './registry'
import type { RenderedNotification } from './channel'
import { EmailNotificationChannel } from './email-channel'
import { User } from '#server/entities/user'
import { NotificationLog } from '#server/entities/notification-log'
import { ensureDatabaseInitialized } from '#server/database'

const message: RenderedNotification = { subject: 's', html: '<p>h</p>', text: 't' }
const sendMessage = vi.fn(async () => ({ delivered: true, channel: 'email', messageId: 'm1' }))

const installSpyChannel = () => {
    unregisterNotificationChannel('email')
    registerNotificationChannel({
        name: 'email',
        isAvailable: () => true,
        send: vi.fn(),
        sendMessage,
    })
}

const restoreEmail = () => {
    unregisterNotificationChannel('email')
    registerNotificationChannel(new EmailNotificationChannel())
}

const makeAdmin = async () => {
    const ds = await ensureDatabaseInitialized()
    return ds.getRepository(User).save(ds.getRepository(User).create({
        email: `admin-${Date.now()}-${Math.random()}@x.com`,
        name: 'admin',
        role: 'admin',
        banned: false,
    }))
}

describe('dispatchNotification', () => {
    beforeEach(async () => {
        setupMemoryDatabase()
        const ds = await ensureDatabaseInitialized()
        await ds.getRepository(NotificationLog).clear()
        await ds.getRepository(User).clear()
        await makeAdmin()
        sendMessage.mockClear()
        installSpyChannel()
    })

    afterEach(() => {
        teardownMemoryDatabase()
        restoreEmail()
    })

    it('发送成功写 sent 日志', async () => {
        const result = await dispatchNotification({
            category: 'security_high', scopeType: 'run', scopeId: 'run-1', fingerprint: 'fp1', message,
            settings: DEFAULT_NOTIFICATION_SETTINGS,
        })
        expect(result).toMatchObject({ status: 'sent', delivered: true, recipientCount: 1 })
        const ds = await ensureDatabaseInitialized()
        const logs = await ds.getRepository(NotificationLog).find({ where: { scopeId: 'run-1' } })
        expect(logs).toHaveLength(1)
        expect(logs[0]?.status).toBe('sent')
        expect(logs[0]?.fingerprint).toBe('fp1')
    })

    it('相同指纹再次投递 → skipped_duplicate，不重复发送', async () => {
        const input = {
            category: 'security_high' as const, scopeType: 'run' as const, scopeId: 'run-2', fingerprint: 'fp2', message,
            settings: DEFAULT_NOTIFICATION_SETTINGS,
        }
        await dispatchNotification(input)
        const second = await dispatchNotification(input)
        expect(second.status).toBe('skipped_duplicate')
        expect(sendMessage).toHaveBeenCalledTimes(1)
    })

    it('指纹变化但冷却窗口内 → skipped_cooldown', async () => {
        await dispatchNotification({
            category: 'security_high', scopeType: 'run', scopeId: 'run-3', fingerprint: 'fp3', message,
            settings: DEFAULT_NOTIFICATION_SETTINGS,
        })
        const second = await dispatchNotification({
            category: 'security_high', scopeType: 'run', scopeId: 'run-3', fingerprint: 'fp4', message,
            settings: DEFAULT_NOTIFICATION_SETTINGS,
        })
        expect(second.status).toBe('skipped_cooldown')
        expect(sendMessage).toHaveBeenCalledTimes(1)
    })

    it('超过每小时上限 → skipped_throttled', async () => {
        const settings = { ...DEFAULT_NOTIFICATION_SETTINGS, maxPerHour: 1 }
        await dispatchNotification({
            category: 'security_high', scopeType: 'run', scopeId: 'run-4', fingerprint: 'fp5', message, settings,
        })
        const second = await dispatchNotification({
            category: 'security_high', scopeType: 'run', scopeId: 'run-5', fingerprint: 'fp6', message, settings,
        })
        expect(second.status).toBe('skipped_throttled')
    })

    it('回收超过 10 分钟的 sending 占位后允许重新投递', async () => {
        const ds = await ensureDatabaseInitialized()
        const now = Date.now()
        const key = buildNotificationDeliveryKey({
            scopeType: 'run', scopeId: 'run-stale', category: 'security_high', fingerprint: 'fp-stale',
            now, cooldownHours: DEFAULT_NOTIFICATION_SETTINGS.cooldownHours,
        })
        const repo = ds.getRepository(NotificationLog)
        const stale = await repo.save(repo.create({
            deliveryKey: key, category: 'security_high', scopeType: 'run', scopeId: 'run-stale',
            channel: 'email', fingerprint: 'fp-stale', recipientsJson: '[]', status: 'sending',
        }))
        await repo.update(stale.id, { createdAt: new Date(now - 11 * 60 * 1000) })

        const result = await dispatchNotification({
            category: 'security_high', scopeType: 'run', scopeId: 'run-stale', fingerprint: 'fp-stale', message,
            settings: DEFAULT_NOTIFICATION_SETTINGS,
        })
        expect(result.status).toBe('sent')
        expect(sendMessage).toHaveBeenCalledTimes(1)
    })

    it('渠道不可用 → noop，不占投递键', async () => {
        unregisterNotificationChannel('email')
        registerNotificationChannel({ name: 'email', isAvailable: () => false, send: vi.fn() })
        const result = await dispatchNotification({
            category: 'security_high', scopeType: 'run', scopeId: 'run-6', fingerprint: 'fp7', message,
            settings: DEFAULT_NOTIFICATION_SETTINGS,
        })
        expect(result.status).toBe('noop')
        const ds = await ensureDatabaseInitialized()
        const logs = await ds.getRepository(NotificationLog).find({ where: { scopeId: 'run-6' } })
        expect(logs[0]?.status).toBe('noop')
        expect(logs[0]?.deliveryKey).toBeNull()
    })

    it('部署总开关关闭 → noop 且不触达渠道', async () => {
        process.env.DEPENDFIX_NOTIFICATION_ENABLED = 'false'
        try {
            const result = await dispatchNotification({
                category: 'security_high', scopeType: 'run', scopeId: 'run-deploy-off', fingerprint: 'fp-off', message,
                settings: DEFAULT_NOTIFICATION_SETTINGS,
            })
            expect(result.status).toBe('noop')
            expect(sendMessage).not.toHaveBeenCalled()
        } finally {
            delete process.env.DEPENDFIX_NOTIFICATION_ENABLED
        }
    })

    it('无收件人 → skipped_no_recipient', async () => {
        const ds = await ensureDatabaseInitialized()
        await ds.getRepository(User).clear()
        const result = await dispatchNotification({
            category: 'security_high', scopeType: 'run', scopeId: 'run-7', fingerprint: 'fp8', message,
            settings: DEFAULT_NOTIFICATION_SETTINGS,
        })
        expect(result.status).toBe('skipped_no_recipient')
    })
})

describe('dispatchNotification 周报例外', () => {
    beforeEach(() => {
        setupMemoryDatabase()
        sendMessage.mockClear()
        installSpyChannel()
    })

    afterEach(() => {
        teardownMemoryDatabase()
        restoreEmail()
    })

    it('weekly_digest：豁免指纹 / 冷却 / 每小时上限，按用户 + 渠道 + 周唯一键占位', async () => {
        const settings = { ...DEFAULT_NOTIFICATION_SETTINGS, cooldownHours: 24, maxPerHour: 1 }
        const base = {
            category: 'weekly_digest' as const,
            scopeType: 'digest' as const,
            scopeId: '2026-W44',
            message,
            settings,
        }
        const first = await dispatchNotification({
            ...base,
            recipients: [{ userId: 'u1', email: 'u1@x.com', role: 'admin' }],
            recipientUserId: 'u1',
            recipientIdentity: 'u1',
        })
        expect(first.status).toBe('sent')

        // 同用户同周：键冲突 → skipped_duplicate（内容指纹为 null 也照样去重）
        const duplicate = await dispatchNotification({
            ...base,
            recipients: [{ userId: 'u1', email: 'u1@x.com', role: 'admin' }],
            recipientUserId: 'u1',
            recipientIdentity: 'u1',
        })
        expect(duplicate.status).toBe('skipped_duplicate')

        // 不同用户：即使 maxPerHour=1 也照常发送（周报豁免每小时上限）
        const other = await dispatchNotification({
            ...base,
            recipients: [{ userId: 'u2', email: 'u2@x.com', role: 'admin' }],
            recipientUserId: 'u2',
            recipientIdentity: 'u2',
        })
        expect(other.status).toBe('sent')
        expect(sendMessage).toHaveBeenCalledTimes(2)

        const ds = await ensureDatabaseInitialized()
        const logs = await ds.getRepository(NotificationLog).find({ where: { category: 'weekly_digest' } })
        expect(logs.find((log) => log.status === 'sent' && log.recipientUserId === 'u1')?.deliveryKey).toHaveLength(64)
        expect(logs.find((log) => log.status === 'skipped_duplicate')?.recipientUserId).toBe('u1')
        expect(logs.every((log) => log.fingerprint === null)).toBe(true)
    })

    it('周报 sent 行不占用共享每小时上限（后续安全告警不被限流）', async () => {
        const settings = { ...DEFAULT_NOTIFICATION_SETTINGS, maxPerHour: 1 }
        for (const userId of ['u1', 'u2']) {
            const result = await dispatchNotification({
                category: 'weekly_digest',
                scopeType: 'digest',
                scopeId: '2026-W50',
                message,
                settings,
                recipients: [{ userId, email: `${userId}@x.com`, role: 'admin' }],
                recipientUserId: userId,
                recipientIdentity: userId,
            })
            expect(result.status).toBe('sent')
        }
        const security = await dispatchNotification({
            category: 'security_high',
            scopeType: 'run',
            scopeId: 'run-after-digest',
            fingerprint: 'fp-after-digest',
            message,
            settings,
            recipients: [{ userId: 'u3', email: 'u3@x.com', role: 'admin' }],
        })
        expect(security.status).toBe('sent')
    })

    it('weekly_digest 多收件人且缺 recipientIdentity → failed，不静默共键', async () => {
        const result = await dispatchNotification({
            category: 'weekly_digest',
            scopeType: 'digest',
            scopeId: '2026-W44',
            message,
            settings: DEFAULT_NOTIFICATION_SETTINGS,
            recipients: [
                { userId: 'u1', email: 'u1@x.com', role: 'admin' },
                { userId: 'u2', email: 'u2@x.com', role: 'admin' },
            ],
        })
        expect(result).toMatchObject({ status: 'failed', delivered: false, recipientCount: 2 })
        expect(sendMessage).not.toHaveBeenCalled()
    })
})
