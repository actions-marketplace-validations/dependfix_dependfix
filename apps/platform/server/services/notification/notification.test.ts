import 'reflect-metadata'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMemoryDatabase, teardownMemoryDatabase } from '../../../tests/api-helper'
import { EmailNotificationChannel } from './email-channel'
import {
    ensureNotificationChannelsRegistered,
    listNotificationChannels,
    notifyEnvEvent,
    registerNotificationChannel,
    unregisterNotificationChannel,
} from './index'
import { ensureDatabaseInitialized } from '#server/database'
import { User } from '#server/entities/user'
import { AuditEvent } from '#server/entities/audit-event'
import { NotificationLog } from '#server/entities/notification-log'

const { logWarnMock, logErrorMock } = vi.hoisted(() => ({ logWarnMock: vi.fn(), logErrorMock: vi.fn() }))
vi.mock('#server/utils/logger', () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: logWarnMock, error: logErrorMock },
}))

describe('notification module 注册表', () => {
    it('ensureNotificationChannelsRegistered 后 list 至少含 email 渠道', () => {
        ensureNotificationChannelsRegistered()
        const channels = listNotificationChannels()
        expect(channels.length).toBeGreaterThan(0)
        expect(channels.some((c) => c.name === 'email')).toBe(true)
    })

    it('重复注册同名渠道抛错', () => {
        ensureNotificationChannelsRegistered()
        expect(() => registerNotificationChannel(new EmailNotificationChannel())).toThrow(/already registered/)
    })

    it('unregisterNotificationChannel 移除渠道', () => {
        ensureNotificationChannelsRegistered()
        unregisterNotificationChannel('email')
        expect(listNotificationChannels().some((c) => c.name === 'email')).toBe(false)
        // 重新注册恢复
        registerNotificationChannel(new EmailNotificationChannel())
    })
})

describe('notifyEnvEvent', () => {
    beforeEach(async () => {
        setupMemoryDatabase()
        delete process.env.DEPENDFIX_ENV_ALERT_RECIPIENTS
        logWarnMock.mockClear()
        logErrorMock.mockClear()
        // SMTP 未配置 → EmailNotificationChannel.isAvailable()=false → noop
        vi.stubGlobal('useRuntimeConfig', () => ({ smtpHost: '' }))
    })

    afterEach(() => {
        teardownMemoryDatabase()
        vi.unstubAllGlobals()
    })

    it('无收件人时 warn + AuditEvent 标记 notified=false', async () => {
        const ds = await ensureDatabaseInitialized()
        // 共享内存库可能残留前序用例的 admin；本用例需要「无收件人」形态
        await ds.getRepository(User).clear()
        const event = await ds.getRepository(AuditEvent).save(ds.getRepository(AuditEvent).create({
            type: 'sandbox_unavailable',
            severity: 'error',
            payloadJson: null,
            notified: false,
            notifiedVia: null,
        }))
        await notifyEnvEvent({
            id: event.id,
            type: 'sandbox_unavailable',
            severity: 'error',
            message: 'docker down',
            createdAt: event.createdAt,
        })
        expect(logWarnMock).toHaveBeenCalled()
        const updated = await ds.getRepository(AuditEvent).findOne({ where: { id: event.id } })
        expect(updated?.notified).toBe(false)
        expect(updated?.notifiedVia).toBe(null)
    })

    it('SMTP 未配置 → email 渠道 isAvailable()=false → skip + notified=false', async () => {
        const ds = await ensureDatabaseInitialized()
        const event = await ds.getRepository(AuditEvent).save(ds.getRepository(AuditEvent).create({
            type: 'sandbox_degraded',
            severity: 'warn',
            payloadJson: null,
            notified: false,
            notifiedVia: null,
        }))
        process.env.DEPENDFIX_ENV_ALERT_RECIPIENTS = 'admin@x.com'
        await notifyEnvEvent({
            id: event.id,
            type: 'sandbox_degraded',
            severity: 'warn',
            message: '降级',
            createdAt: event.createdAt,
        })
        const updated = await ds.getRepository(AuditEvent).findOne({ where: { id: event.id } })
        // channel 不可用 → notifyEnvEvent 跳过 send，notified 保持 false（markNotified 不会被调用，因为跳过 continue）
        expect(updated?.notified).toBe(false)
        expect(updated?.notifiedVia).toBe(null)
    })

    it('同一 eventId 重放只发一封，第二次记录 skipped_duplicate', async () => {
        const send = vi.fn(async () => ({ delivered: true, channel: 'spy', messageId: 'm1' }))
        unregisterNotificationChannel('email')
        registerNotificationChannel({ name: 'spy', isAvailable: () => true, send })
        try {
            process.env.DEPENDFIX_ENV_ALERT_RECIPIENTS = 'admin@x.com'
            const event = {
                id: 'evt-duplicate',
                type: 'container_unavailable',
                severity: 'error' as const,
                message: '容器执行器不可用',
                createdAt: new Date(),
            }
            await notifyEnvEvent(event)
            await notifyEnvEvent(event)
            expect(send).toHaveBeenCalledTimes(1)
            const ds = await ensureDatabaseInitialized()
            const logs = await ds.getRepository(NotificationLog).find({ where: { scopeId: event.id } })
            expect(logs.some((log) => log.status === 'sent')).toBe(true)
            expect(logs.some((log) => log.status === 'skipped_duplicate')).toBe(true)
        } finally {
            unregisterNotificationChannel('spy')
            registerNotificationChannel(new EmailNotificationChannel())
        }
    })

    it('部署总开关关闭 → 平台事件不触达渠道并记 noop', async () => {
        const send = vi.fn(async () => ({ delivered: true, channel: 'spy' }))
        unregisterNotificationChannel('email')
        registerNotificationChannel({ name: 'spy', isAvailable: () => true, send })
        process.env.DEPENDFIX_NOTIFICATION_ENABLED = 'false'
        try {
            process.env.DEPENDFIX_ENV_ALERT_RECIPIENTS = 'admin@x.com'
            await notifyEnvEvent({
                id: 'evt-deploy-off',
                type: 'container_unavailable',
                severity: 'error',
                message: '容器执行器不可用',
                createdAt: new Date(),
            })
            expect(send).not.toHaveBeenCalled()
            const ds = await ensureDatabaseInitialized()
            const log = await ds.getRepository(NotificationLog).findOne({ where: { scopeId: 'evt-deploy-off' } })
            expect(log?.status).toBe('noop')
        } finally {
            delete process.env.DEPENDFIX_NOTIFICATION_ENABLED
            unregisterNotificationChannel('spy')
            registerNotificationChannel(new EmailNotificationChannel())
        }
    })

    it('配置留痕类事件（ai_config_update）经策略跳过，不触达渠道', async () => {
        // 注册一个「始终可用」的探针渠道，区分「策略跳过」与「渠道不可用跳过」
        const send = vi.fn(async () => ({ delivered: true, channel: 'spy' }))
        unregisterNotificationChannel('email')
        registerNotificationChannel({ name: 'spy', isAvailable: () => true, send })
        try {
            process.env.DEPENDFIX_ENV_ALERT_RECIPIENTS = 'admin@x.com'
            await notifyEnvEvent({
                id: 'evt-config-only',
                type: 'ai_config_update',
                severity: 'info',
                message: 'AI 配置更新',
                createdAt: new Date(),
            })
            expect(send).not.toHaveBeenCalled()
        } finally {
            unregisterNotificationChannel('spy')
            registerNotificationChannel(new EmailNotificationChannel())
        }
    })

    it('执行器异常类事件（container_unavailable）触达可用渠道', async () => {
        const send = vi.fn(async () => ({ delivered: true, channel: 'spy' }))
        unregisterNotificationChannel('email')
        registerNotificationChannel({ name: 'spy', isAvailable: () => true, send })
        try {
            process.env.DEPENDFIX_ENV_ALERT_RECIPIENTS = 'admin@x.com'
            await notifyEnvEvent({
                id: 'evt-container-down',
                type: 'container_unavailable',
                severity: 'error',
                message: '容器执行器不可用',
                createdAt: new Date(),
            })
            expect(send).toHaveBeenCalledOnce()
        } finally {
            unregisterNotificationChannel('spy')
            registerNotificationChannel(new EmailNotificationChannel())
        }
    })
})
