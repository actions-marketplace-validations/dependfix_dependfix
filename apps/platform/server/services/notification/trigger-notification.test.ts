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
import { User } from '#server/entities/user'

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

const seedRepoRun = async (name: string): Promise<{ repo: Repository, run: ScanRun }> => {
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
        severity: 'high',
        packageName: 'lodash',
        fixStatus: 'failed',
        firstSeenAt: now,
        lastSeenAt: now,
    }))
    return { repo, run }
}

describe('run / batch terminal notification', () => {
    beforeEach(async () => {
        setupMemoryDatabase()
        const ds = await ensureDatabaseInitialized()
        await ds.getRepository(NotificationLog).clear()
        await ds.getRepository(User).clear()
        await seedAdmin()
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
