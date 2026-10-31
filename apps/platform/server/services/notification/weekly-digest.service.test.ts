import 'reflect-metadata'
import { IsNull } from 'typeorm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMemoryDatabase, teardownMemoryDatabase } from '../../../tests/api-helper'
import { sendWeeklyDigest } from './weekly-digest.service'
import { DEFAULT_NOTIFICATION_SETTINGS } from './settings'
import { registerNotificationChannel, unregisterNotificationChannel } from './registry'
import { EmailNotificationChannel } from './email-channel'
import { buildDigestDeliveryKey } from './dedupe'
import { ensureDatabaseInitialized } from '#server/database'
import { NotificationLog } from '#server/entities/notification-log'
import { NotificationPreference } from '#server/entities/notification-preference'
import { Organization } from '#server/entities/organization'
import { Repository } from '#server/entities/repository'
import { ScanResult } from '#server/entities/scan-result'
import { ScanRun } from '#server/entities/scan-run'
import { User } from '#server/entities/user'
import { DEFAULT_ORGANIZATION_ID } from '#server/utils/organization'

/** 周一 09:01（本地时区），对应 2026-W44 */
const MONDAY = new Date(2026, 9, 26, 9, 1)
const NEXT_MONDAY = new Date(2026, 10, 2, 9, 1)
const WEEK_KEY = '2026-W44'

const sendMessage = vi.fn(async () => ({ delivered: true, channel: 'email', messageId: 'm1' }))

const installSpyChannel = (available = true) => {
    unregisterNotificationChannel('email')
    registerNotificationChannel({
        name: 'email',
        isAvailable: () => available,
        send: vi.fn(),
        sendMessage,
    })
}

const restoreEmail = () => {
    unregisterNotificationChannel('email')
    registerNotificationChannel(new EmailNotificationChannel())
}

let userSeq = 0
const makeAdmin = async (enableDigest = true): Promise<User> => {
    const ds = await ensureDatabaseInitialized()
    const email = `digest-admin-${++userSeq}@x.com`
    const user = await ds.getRepository(User).save(ds.getRepository(User).create({
        email,
        name: email,
        role: 'admin',
        banned: false,
    }))
    if (enableDigest) {
        await ds.getRepository(NotificationPreference).save(ds.getRepository(NotificationPreference).create({
            userId: user.id,
            category: 'weekly_digest',
            channel: 'email',
            enabled: true,
        }))
    }
    return user
}

const setOrganizationSettings = async (overrides: Partial<typeof DEFAULT_NOTIFICATION_SETTINGS> = {}) => {
    const ds = await ensureDatabaseInitialized()
    const repo = ds.getRepository(Organization)
    const org = await repo.findOne({ where: { id: DEFAULT_ORGANIZATION_ID } })
    if (!org) {
        throw new Error('default organization missing')
    }
    org.notificationSettingsJson = JSON.stringify({
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...overrides,
        categories: {
            ...DEFAULT_NOTIFICATION_SETTINGS.categories,
            weeklyDigest: true,
            ...(overrides.categories ?? {}),
        },
    })
    await repo.save(org)
}

/** 活跃快照：1 critical（未修复）+ 1 high（failed）；可选 1 条 converged 豁免。 */
const seedSnapshot = async (input: { converged?: boolean, truncated?: boolean } = {}) => {
    const ds = await ensureDatabaseInitialized()
    const repository = await ds.getRepository(Repository).save(ds.getRepository(Repository).create({
        owner: 'acme',
        name: 'digest-app',
    }))
    const run = await ds.getRepository(ScanRun).save(ds.getRepository(ScanRun).create({
        repositoryId: repository.id,
        mode: 'fix',
        severityThreshold: 'high',
        executorKind: 'container',
        status: 'completed',
        summaryJson: JSON.stringify({
            alertsFound: 3,
            alertsConverged: input.converged ? 1 : 0,
            alertsTruncated: input.truncated ? 5 : 0,
            alertsTruncatedBySeverity: input.truncated ? { critical: 2, high: 3 } : {},
        }),
    }))
    const now = new Date()
    const resultRepo = ds.getRepository(ScanResult)
    const rows = [
        resultRepo.create({ scanRunId: run.id, repositoryId: repository.id, upstreamId: 'dependabot:1', source: 'dependabot', severity: 'critical', packageName: 'a', fixStatus: 'not-tried', firstSeenAt: now, lastSeenAt: now }),
        resultRepo.create({ scanRunId: run.id, repositoryId: repository.id, upstreamId: 'dependabot:2', source: 'dependabot', severity: 'high', packageName: 'b', fixStatus: 'failed', firstSeenAt: now, lastSeenAt: now }),
    ]
    await resultRepo.save(rows)
}

describe('sendWeeklyDigest', () => {
    beforeEach(async () => {
        setupMemoryDatabase()
        const ds = await ensureDatabaseInitialized()
        await ds.getRepository(NotificationLog).clear()
        await ds.getRepository(NotificationPreference).clear()
        await ds.getRepository(ScanResult).clear()
        await ds.getRepository(ScanRun).clear()
        await ds.getRepository(Repository).clear()
        await ds.getRepository(User).clear()
        // 触发默认组织创建，随后用例按需写入通知设置
        const { resolveOrganizationId } = await import('#server/utils/organization')
        await resolveOrganizationId(ds)
        delete process.env.DEPENDFIX_NOTIFICATION_ENABLED
        delete process.env.DEPENDFIX_LOCALE
        delete process.env.NUXT_PUBLIC_BETTER_AUTH_URL
        sendMessage.mockClear()
        installSpyChannel()
    })

    afterEach(() => {
        teardownMemoryDatabase()
        restoreEmail()
        delete process.env.DEPENDFIX_NOTIFICATION_ENABLED
        delete process.env.DEPENDFIX_LOCALE
    })

    it('组织未开启 → 不发送且不写投递记录（默认关闭是常态）', async () => {
        await makeAdmin()
        await seedSnapshot()
        const result = await sendWeeklyDigest(MONDAY)
        expect(result).toMatchObject({ weekKey: WEEK_KEY, status: 'skipped_org_disabled', recipients: 0 })
        expect(sendMessage).not.toHaveBeenCalled()
        const ds = await ensureDatabaseInitialized()
        expect(await ds.getRepository(NotificationLog).count()).toBe(0)
    })

    it('部署总开关关闭 → 不发送', async () => {
        await makeAdmin()
        await setOrganizationSettings()
        await seedSnapshot()
        process.env.DEPENDFIX_NOTIFICATION_ENABLED = 'false'
        const result = await sendWeeklyDigest(MONDAY)
        expect(result.status).toBe('skipped_disabled')
        expect(sendMessage).not.toHaveBeenCalled()
    })

    it('个人未开启（角色默认关）→ skipped_no_recipient 并留痕', async () => {
        await makeAdmin(false)
        await setOrganizationSettings()
        await seedSnapshot()
        const result = await sendWeeklyDigest(MONDAY)
        expect(result).toMatchObject({ weekKey: WEEK_KEY, status: 'skipped_no_recipient', recipients: 0 })
        expect(sendMessage).not.toHaveBeenCalled()
        const ds = await ensureDatabaseInitialized()
        const logs = await ds.getRepository(NotificationLog).find({ where: { scopeType: 'digest' } })
        expect(logs).toHaveLength(1)
        expect(logs[0]).toMatchObject({ status: 'skipped_no_recipient', scopeId: WEEK_KEY, deliveryKey: null })
    })

    it('组织 + 个人开启 → 发送一次；日志带 recipientUserId、fingerprint=null、周报唯一键', async () => {
        const admin = await makeAdmin()
        await setOrganizationSettings()
        await seedSnapshot()
        const result = await sendWeeklyDigest(MONDAY)
        expect(result).toMatchObject({ weekKey: WEEK_KEY, status: 'sent', recipients: 1, sent: 1 })
        expect(sendMessage).toHaveBeenCalledTimes(1)
        const [, recipients] = sendMessage.mock.calls[0] as unknown as [unknown, string[]]
        expect(recipients).toEqual([admin.email])

        const ds = await ensureDatabaseInitialized()
        const log = await ds.getRepository(NotificationLog).findOne({ where: { status: 'sent' } })
        expect(log).toMatchObject({
            category: 'weekly_digest',
            scopeType: 'digest',
            scopeId: WEEK_KEY,
            recipientUserId: admin.id,
            fingerprint: null,
        })
        expect(log?.deliveryKey).toBe(buildDigestDeliveryKey(WEEK_KEY, admin.id, 'email'))
    })

    it('同一 ISO 周重复调用 → 逐用户投递键去重（skipped_duplicate）', async () => {
        await makeAdmin()
        await setOrganizationSettings()
        await seedSnapshot()
        await sendWeeklyDigest(MONDAY)
        const second = await sendWeeklyDigest(new Date(2026, 9, 26, 18, 0))
        expect(second).toMatchObject({ status: 'skipped_duplicate', recipients: 1, sent: 0, skipped: 1 })
        expect(sendMessage).toHaveBeenCalledTimes(1)
        const ds = await ensureDatabaseInitialized()
        const logs = await ds.getRepository(NotificationLog).find({ where: { scopeId: WEEK_KEY } })
        expect(logs.map((log) => log.status).sort()).toEqual(['sent', 'skipped_duplicate'])
    })

    it('并发调用同一周：唯一键占位保证只投递一封', async () => {
        await makeAdmin()
        await setOrganizationSettings()
        await seedSnapshot()
        const [first, second] = await Promise.all([sendWeeklyDigest(MONDAY), sendWeeklyDigest(MONDAY)])
        expect(first.sent + second.sent).toBe(1)
        expect(first.skipped + second.skipped).toBe(1)
        expect(sendMessage).toHaveBeenCalledTimes(1)
    })

    it('内容未变化跨周仍发送（周报豁免内容指纹 / 24h 冷却）', async () => {
        await makeAdmin()
        await setOrganizationSettings()
        await seedSnapshot()
        await sendWeeklyDigest(MONDAY)
        const nextWeek = await sendWeeklyDigest(NEXT_MONDAY)
        expect(nextWeek).toMatchObject({ weekKey: '2026-W45', status: 'sent', sent: 1 })
        expect(sendMessage).toHaveBeenCalledTimes(2)
    })

    it('多个管理员逐封投递（各自唯一键，不共用多收件人封）', async () => {
        const first = await makeAdmin()
        const second = await makeAdmin()
        await setOrganizationSettings()
        await seedSnapshot()
        const result = await sendWeeklyDigest(MONDAY)
        expect(result).toMatchObject({ status: 'sent', recipients: 2, sent: 2 })
        expect(sendMessage).toHaveBeenCalledTimes(2)
        const recipientLists = sendMessage.mock.calls.map((call) => (call as unknown as [unknown, string[]])[1])
        expect(recipientLists).toEqual([[first.email], [second.email]])
    })

    it('额外管理员收件人（无 userId）也收到，且按邮箱构造唯一键', async () => {
        await makeAdmin()
        await setOrganizationSettings({ extraAdminRecipients: ['ops@x.com'] })
        await seedSnapshot()
        const result = await sendWeeklyDigest(MONDAY)
        expect(result).toMatchObject({ status: 'sent', recipients: 2, sent: 2 })
        const ds = await ensureDatabaseInitialized()
        const extraLog = await ds.getRepository(NotificationLog).findOne({ where: { recipientUserId: IsNull(), status: 'sent' } })
        expect(extraLog?.deliveryKey).toBe(buildDigestDeliveryKey(WEEK_KEY, 'ops@x.com', 'email'))
        // 同周再跑：两个收件人都被键去重
        const second = await sendWeeklyDigest(MONDAY)
        expect(second.sent).toBe(0)
        expect(sendMessage).toHaveBeenCalledTimes(2)
    })

    it('豁免每小时上限与冷却窗口（maxPerHour=1 / cooldown=168 仍逐封送达）', async () => {
        await makeAdmin()
        await makeAdmin()
        await setOrganizationSettings({ maxPerHour: 1, cooldownHours: 168 })
        await seedSnapshot()
        const result = await sendWeeklyDigest(MONDAY)
        expect(result).toMatchObject({ status: 'sent', sent: 2 })
        expect(sendMessage).toHaveBeenCalledTimes(2)
    })

    it('渠道不可用 → noop，不写投递键', async () => {
        await makeAdmin()
        await setOrganizationSettings()
        await seedSnapshot()
        installSpyChannel(false)
        const result = await sendWeeklyDigest(MONDAY)
        expect(result).toMatchObject({ status: 'noop', noop: 1, sent: 0 })
        expect(sendMessage).not.toHaveBeenCalled()
        const ds = await ensureDatabaseInitialized()
        const log = await ds.getRepository(NotificationLog).findOne({ where: { category: 'weekly_digest' } })
        expect(log).toMatchObject({ status: 'noop', deliveryKey: null })
    })

    it('零快照仍发送「本周无未修复告警」（周期任务存活信号）', async () => {
        await makeAdmin()
        await setOrganizationSettings()
        const result = await sendWeeklyDigest(MONDAY)
        expect(result).toMatchObject({ status: 'sent', sent: 1 })
        const [message] = sendMessage.mock.calls[0] as unknown as [{ subject: string }]
        expect(message.subject).toBe('[dependfix][周报] 本周无未修复告警')
    })

    it('部分收件人失败 → status=partial，失败落日志且不影响其余送达', async () => {
        await makeAdmin()
        await makeAdmin()
        await setOrganizationSettings()
        await seedSnapshot()
        sendMessage.mockRejectedValueOnce(new Error('smtp down'))
        const result = await sendWeeklyDigest(MONDAY)
        expect(result).toMatchObject({ status: 'partial', recipients: 2, sent: 1, failed: 1 })
        expect(sendMessage).toHaveBeenCalledTimes(2)
        const ds = await ensureDatabaseInitialized()
        const failed = await ds.getRepository(NotificationLog).findOne({ where: { status: 'failed' } })
        expect(failed).toMatchObject({ category: 'weekly_digest', deliveryKey: null })
        expect(failed?.errorMessage).toContain('smtp down')
    })

    it('部分失败后重试只补发失败收件人（已发者命中逐用户投递键）', async () => {
        const first = await makeAdmin()
        const second = await makeAdmin()
        await setOrganizationSettings()
        await seedSnapshot()
        sendMessage.mockRejectedValueOnce(new Error('smtp down'))
        const round1 = await sendWeeklyDigest(MONDAY)
        expect(round1).toMatchObject({ status: 'partial', recipients: 2, sent: 1, failed: 1 })

        const round2 = await sendWeeklyDigest(new Date(MONDAY.getTime() + 30 * 60 * 1000))
        expect(round2).toMatchObject({ status: 'sent', recipients: 2, sent: 1, failed: 0, skipped: 1 })
        expect(sendMessage).toHaveBeenCalledTimes(3)
        // 首轮失败的是首个收件人，次轮只补发它；另一位命中投递键不发。
        // 用「按收件人计数」断言，避免依赖管理员查询顺序（顺序变化不应导致脆弱失败）。
        const deliveredTo = sendMessage.mock.calls.map((call) => (call as unknown as [unknown, string[]])[1][0])
        expect(deliveredTo).toHaveLength(3)
        expect(deliveredTo.filter((email) => email === first.email)).toHaveLength(2)
        expect(deliveredTo.filter((email) => email === second.email)).toHaveLength(1)
    })

    it('无收件人时同周同状态只落一行（重试不刷日志）', async () => {
        await makeAdmin(false)
        await setOrganizationSettings()
        const first = await sendWeeklyDigest(MONDAY)
        const second = await sendWeeklyDigest(new Date(MONDAY.getTime() + 30 * 60 * 1000))
        expect(first.status).toBe('skipped_no_recipient')
        expect(second.status).toBe('skipped_no_recipient')
        const ds = await ensureDatabaseInitialized()
        const logs = await ds.getRepository(NotificationLog).find({ where: { status: 'skipped_no_recipient' } })
        expect(logs).toHaveLength(1)
        expect(sendMessage).not.toHaveBeenCalled()
    })

    it('无收件人后开启个人开关 → 同周窗口内补发', async () => {
        const admin = await makeAdmin(false)
        await setOrganizationSettings()
        await seedSnapshot()
        expect((await sendWeeklyDigest(MONDAY)).status).toBe('skipped_no_recipient')

        const ds = await ensureDatabaseInitialized()
        await ds.getRepository(NotificationPreference).save(ds.getRepository(NotificationPreference).create({
            userId: admin.id,
            category: 'weekly_digest',
            channel: 'email',
            enabled: true,
        }))
        const second = await sendWeeklyDigest(new Date(MONDAY.getTime() + 30 * 60 * 1000))
        expect(second).toMatchObject({ status: 'sent', recipients: 1, sent: 1 })
        expect(sendMessage).toHaveBeenCalledTimes(1)
    })

    it('正文披露截断 / 豁免计数，主题带 [周报]', async () => {
        await makeAdmin()
        await setOrganizationSettings()
        await seedSnapshot({ converged: true, truncated: true })
        await sendWeeklyDigest(MONDAY)
        const [message] = sendMessage.mock.calls[0] as unknown as [{ subject: string, html: string, text: string }]
        expect(message.subject).toContain('[dependfix][周报]')
        expect(message.subject).toContain('1 个仓库存在未修复告警')
        expect(message.html).toContain('另有 5 条截断未纳入明细')
        expect(message.html).toContain('引擎汇总另有 1 条告警本地已满足（converged）')
        expect(message.text).toContain('2026-W44')
    })
})
