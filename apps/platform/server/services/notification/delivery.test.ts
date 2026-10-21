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
