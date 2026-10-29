import 'reflect-metadata'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMemoryDatabase, teardownMemoryDatabase } from '../../../tests/api-helper'
import { registerNotificationChannel, unregisterNotificationChannel } from './registry'
import { EmailNotificationChannel } from './email-channel'
import { notifyRunTerminal } from './run-notification.service'
import { notifyBatchTerminal } from './batch-notification.service'
import { ensureDatabaseInitialized } from '#server/database'
import { NotificationLog } from '#server/entities/notification-log'
import { Repository } from '#server/entities/repository'
import { ScanResult } from '#server/entities/scan-result'
import { ScanRun } from '#server/entities/scan-run'
import { BatchRun } from '#server/entities/batch-run'
import { Organization } from '#server/entities/organization'
import { User } from '#server/entities/user'
import { DEFAULT_ORGANIZATION_ID } from '#server/utils/organization'

const sendMessage = vi.fn(async () => ({ delivered: true, channel: 'email', messageId: 'm1' }))
let seq = 0

const installSpy = () => {
    unregisterNotificationChannel('email')
    registerNotificationChannel({ name: 'email', isAvailable: () => true, send: vi.fn(), sendMessage })
}

const restore = () => {
    unregisterNotificationChannel('email')
    registerNotificationChannel(new EmailNotificationChannel())
}

const seedAdmin = async () => {
    const ds = await ensureDatabaseInitialized()
    return ds.getRepository(User).save(ds.getRepository(User).create({
        email: `admin-${++seq}@x.com`, name: 'admin', role: 'admin', banned: false,
    }))
}

const seedRepoRun = async (name: string, severity: 'critical' | 'high' = 'high'): Promise<{ repo: Repository, run: ScanRun }> => {
    const ds = await ensureDatabaseInitialized()
    const repo = await ds.getRepository(Repository).save(ds.getRepository(Repository).create({
        owner: `acme-${++seq}`, name,
    }))
    const run = await ds.getRepository(ScanRun).save(ds.getRepository(ScanRun).create({
        repositoryId: repo.id,
        mode: 'fix',
        severityThreshold: 'high',
        executorKind: 'container',
        status: 'completed',
        summaryJson: JSON.stringify({ alertsFound: 1, alertsFixed: 0, alertsUnfixed: 1 }),
    }))
    const now = new Date()
    await ds.getRepository(ScanResult).save(ds.getRepository(ScanResult).create({
        scanRunId: run.id,
        repositoryId: repo.id,
        upstreamId: `dependabot:${++seq}`,
        source: 'dependabot',
        severity,
        packageName: 'lodash',
        fixStatus: 'failed',
        firstSeenAt: now,
        lastSeenAt: now,
    }))
    return { repo, run }
}

/** 直接写组织通知设置（跳过 API 权限链，单位置覆盖 securityHigh 开关场景）。 */
const setOrgNotificationSettings = async (patch: { securityHigh?: boolean }): Promise<void> => {
    const ds = await ensureDatabaseInitialized()
    await ds.getRepository(Organization).update({ id: DEFAULT_ORGANIZATION_ID }, {
        notificationSettingsJson: JSON.stringify({
            categories: { securityHigh: patch.securityHigh ?? true, runFailure: true, runCompleted: false, weeklyDigest: false },
            severityThreshold: 'high',
            cooldownHours: 24,
            maxPerHour: 6,
            extraAdminRecipients: [],
        }),
    })
}

describe('run / batch terminal notification', () => {
    beforeEach(async () => {
        setupMemoryDatabase()
        const ds = await ensureDatabaseInitialized()
        await ds.getRepository(NotificationLog).clear()
        await ds.getRepository(User).clear()
        await seedAdmin()
        // 组织设置是跨用例共享单行：每个用例回到默认值，避免上一个用例的 securityHigh / 阈值渗漏
        await setOrgNotificationSettings({})
        sendMessage.mockClear()
        installSpy()
    })

    afterEach(() => {
        teardownMemoryDatabase()
        restore()
    })

    it('completed run 有未修复高危时发送一封 security_high；重复触发被指纹去重', async () => {
        const { run } = await seedRepoRun('app')
        await notifyRunTerminal(run)
        await notifyRunTerminal(run)

        const ds = await ensureDatabaseInitialized()
        const sent = await ds.getRepository(NotificationLog).find({ where: { category: 'security_high', scopeType: 'run', scopeId: run.id, status: 'sent' } })
        expect(sent).toHaveLength(1)
        expect(sendMessage).toHaveBeenCalledTimes(1)
    })

    it('critical 未修复时组织关闭 securityHigh 仍发送 security_critical', async () => {
        const { run } = await seedRepoRun('critical-app', 'critical')
        await setOrgNotificationSettings({ securityHigh: false })
        await notifyRunTerminal(run)

        const ds = await ensureDatabaseInitialized()
        const logs = await ds.getRepository(NotificationLog).find({ where: { scopeType: 'run', scopeId: run.id } })
        const critical = logs.filter((log) => log.category === 'security_critical')
        const high = logs.filter((log) => log.category === 'security_high')
        expect(critical).toHaveLength(1)
        expect(critical[0]?.status).toBe('sent')
        // 只有 critical 告警，且 high 类别已关闭 → 不产生 security_high 投递
        expect(high).toHaveLength(0)
        expect(sendMessage).toHaveBeenCalledTimes(1)
    })

    it('critical 与 high 同时存在时分别投递两封且各自只含自身级别', async () => {
        const { run } = await seedRepoRun('mixed-app', 'critical')
        const ds = await ensureDatabaseInitialized()
        const repo = await ds.getRepository(Repository).findOneByOrFail({ id: run.repositoryId })
        const now = new Date()
        await ds.getRepository(ScanResult).save(ds.getRepository(ScanResult).create({
            scanRunId: run.id,
            repositoryId: repo.id,
            upstreamId: `dependabot:mixed-high-${++seq}`,
            source: 'dependabot',
            severity: 'high',
            packageName: 'minimist',
            fixStatus: 'failed',
            firstSeenAt: now,
            lastSeenAt: now,
        }))
        await notifyRunTerminal(run)

        const sent = await ds.getRepository(NotificationLog).find({ where: { scopeType: 'run', scopeId: run.id, status: 'sent' } })
        const byCategory = new Map(sent.map((log) => [log.category, log]))
        expect(byCategory.get('security_critical')?.fingerprint).toBeTruthy()
        expect(byCategory.get('security_high')?.fingerprint).toBeTruthy()
        // 两个类别的指纹不同：各自只覆盖自身级别的告警
        expect(byCategory.get('security_critical')?.fingerprint).not.toBe(byCategory.get('security_high')?.fingerprint)
        expect(sendMessage).toHaveBeenCalledTimes(2)
    })

    it('组织关闭 securityHigh 且 critical 与 high 同时存在时只投递 critical', async () => {
        const { run } = await seedRepoRun('critical-mixed-off', 'critical')
        const ds = await ensureDatabaseInitialized()
        const repo = await ds.getRepository(Repository).findOneByOrFail({ id: run.repositoryId })
        const now = new Date()
        await ds.getRepository(ScanResult).save(ds.getRepository(ScanResult).create({
            scanRunId: run.id,
            repositoryId: repo.id,
            upstreamId: `dependabot:mixed-off-high-${++seq}`,
            source: 'dependabot',
            severity: 'high',
            packageName: 'minimist',
            fixStatus: 'failed',
            firstSeenAt: now,
            lastSeenAt: now,
        }))
        await setOrgNotificationSettings({ securityHigh: false })
        await notifyRunTerminal(run)

        const logs = await ds.getRepository(NotificationLog).find({ where: { scopeType: 'run', scopeId: run.id } })
        expect(logs.filter((log) => log.category === 'security_critical' && log.status === 'sent')).toHaveLength(1)
        // high 类别被组织关闭 → 不会出现 sent；最多留下 skipped_no_recipient 记录
        expect(logs.filter((log) => log.category === 'security_high' && log.status === 'sent')).toHaveLength(0)
        expect(sendMessage).toHaveBeenCalledTimes(1)
    })

    it('阈值仅 critical 时 critical 仍投递、high 不投递', async () => {
        const { run } = await seedRepoRun('threshold-critical-critical', 'critical')
        const ds = await ensureDatabaseInitialized()
        const repo = await ds.getRepository(Repository).findOneByOrFail({ id: run.repositoryId })
        const now = new Date()
        await ds.getRepository(ScanResult).save(ds.getRepository(ScanResult).create({
            scanRunId: run.id,
            repositoryId: repo.id,
            upstreamId: `dependabot:threshold-critical-high-${++seq}`,
            source: 'dependabot',
            severity: 'high',
            packageName: 'minimist',
            fixStatus: 'failed',
            firstSeenAt: now,
            lastSeenAt: now,
        }))
        await ds.getRepository(Organization).update({ id: DEFAULT_ORGANIZATION_ID }, {
            notificationSettingsJson: JSON.stringify({
                categories: { securityHigh: true, runFailure: true, runCompleted: false, weeklyDigest: false },
                severityThreshold: 'critical',
                cooldownHours: 24,
                maxPerHour: 6,
                extraAdminRecipients: [],
            }),
        })
        await notifyRunTerminal(run)

        const logs = await ds.getRepository(NotificationLog).find({ where: { scopeType: 'run', scopeId: run.id } })
        expect(logs.filter((log) => log.category === 'security_critical' && log.status === 'sent')).toHaveLength(1)
        expect(logs.filter((log) => log.category === 'security_high')).toHaveLength(0)
    })

    it('阈值仅 critical 时 high 告警不投递', async () => {
        const { run } = await seedRepoRun('critical-only-threshold', 'high')
        const ds = await ensureDatabaseInitialized()
        await ds.getRepository(Organization).update({ id: DEFAULT_ORGANIZATION_ID }, {
            notificationSettingsJson: JSON.stringify({
                categories: { securityHigh: true, runFailure: true, runCompleted: false, weeklyDigest: false },
                severityThreshold: 'critical',
                cooldownHours: 24,
                maxPerHour: 6,
                extraAdminRecipients: [],
            }),
        })
        await notifyRunTerminal(run)

        const sent = await ds.getRepository(NotificationLog).find({ where: { scopeType: 'run', scopeId: run.id, status: 'sent' } })
        expect(sent).toEqual([])
        expect(sendMessage).not.toHaveBeenCalled()
    })

    it('completed run 无未修复高危时，默认不发完成摘要', async () => {
        const ds = await ensureDatabaseInitialized()
        const repo = await ds.getRepository(Repository).save(ds.getRepository(Repository).create({
            owner: `quiet-${++seq}`, name: 'app',
        }))
        const run = await ds.getRepository(ScanRun).save(ds.getRepository(ScanRun).create({
            repositoryId: repo.id,
            mode: 'fix',
            severityThreshold: 'high',
            executorKind: 'container',
            status: 'completed',
            summaryJson: JSON.stringify({ alertsFound: 1, alertsFixed: 1, alertsUnfixed: 0 }),
        }))
        await notifyRunTerminal(run)

        const sent = await ds.getRepository(NotificationLog).find({ where: { scopeId: run.id, status: 'sent' } })
        expect(sent).toEqual([])
        expect(sendMessage).not.toHaveBeenCalled()
    })

    it('failed run 默认发送 run_failure', async () => {
        const ds = await ensureDatabaseInitialized()
        const repo = await ds.getRepository(Repository).save(ds.getRepository(Repository).create({
            owner: `failed-${++seq}`, name: 'app',
        }))
        const run = await ds.getRepository(ScanRun).save(ds.getRepository(ScanRun).create({
            repositoryId: repo.id,
            mode: 'fix',
            severityThreshold: 'high',
            executorKind: 'container',
            status: 'failed',
            failureCode: 'execution_timeout',
            failureStage: 'runtime',
        }))
        await notifyRunTerminal(run)

        const sent = await ds.getRepository(NotificationLog).find({ where: { scopeId: run.id, category: 'run_failure', status: 'sent' } })
        expect(sent).toHaveLength(1)
    })

    it('批次终态只发一封 security_high（跨仓库合并）', async () => {
        const ds = await ensureDatabaseInitialized()
        const batch = await ds.getRepository(BatchRun).save(ds.getRepository(BatchRun).create({
            source: 'manual',
            mode: 'fix',
            severityThreshold: 'high',
            repositoryCount: 2,
            status: 'completed',
            summaryJson: JSON.stringify({ alertsTotal: 2, fixedCount: 0, severityCounts: {} }),
        }))
        const first = await seedRepoRun('app')
        const second = await seedRepoRun('api')
        await ds.getRepository(ScanRun).update(first.run.id, { batchRunId: batch.id })
        await ds.getRepository(ScanRun).update(second.run.id, { batchRunId: batch.id })

        await notifyBatchTerminal(batch)
        await notifyBatchTerminal(batch)

        const sent = await ds.getRepository(NotificationLog).find({ where: { category: 'security_high', scopeType: 'batch', scopeId: batch.id, status: 'sent' } })
        expect(sent).toHaveLength(1)
        expect(sendMessage).toHaveBeenCalledTimes(1)
    })
})
