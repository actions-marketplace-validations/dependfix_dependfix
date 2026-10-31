import 'reflect-metadata'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMemoryDatabase, teardownMemoryDatabase } from '../../tests/api-helper'
import { enqueueScanJob } from './scan-trigger.service'
import type { ScanRequest } from './scan-orchestrator.service'
import type { ScanQueue } from './queue/scan-queue'
import { Repository } from '#server/entities/repository'
import { ScanRun } from '#server/entities/scan-run'
import { ensureDatabaseInitialized } from '#server/database'

const REQUEST: ScanRequest = { mode: 'report-only', severityThreshold: 'high' }

const clearAllTables = async (): Promise<void> => {
    const ds = await ensureDatabaseInitialized()
    await ds.getRepository(ScanRun).clear()
    await ds.getRepository(Repository).clear()
}

const createRepo = async (id: string): Promise<void> => {
    const ds = await ensureDatabaseInitialized()
    const repo = ds.getRepository(Repository)
    await repo.save(repo.create({
        id,
        organizationId: null,
        owner: 'test-owner',
        name: `test-repo-${id}`,
        defaultBranch: 'main',
        packageManager: 'pnpm',
        executorKind: 'container',
    }))
}

const createRun = async (params: {
    id: string
    repositoryId: string
    status: 'pending' | 'running' | 'completed' | 'failed' | 'dispatched' | 'degraded'
}): Promise<ScanRun> => {
    const ds = await ensureDatabaseInitialized()
    const runRepo = ds.getRepository(ScanRun)
    return runRepo.save(runRepo.create({
        id: params.id,
        repositoryId: params.repositoryId,
        mode: 'report-only',
        severityThreshold: 'high',
        executorKind: 'container',
        status: params.status,
        startedAt: params.status === 'pending' ? null : new Date(),
        finishedAt: ['completed', 'failed', 'dispatched', 'degraded'].includes(params.status) ? new Date() : null,
    }))
}

/**
 * `enqueueScanJob` 僵尸去重键自愈：单仓 / 批量触发共用的入队入口，
 * 这里以 fake queue 锁定「归属终态 / 不存在 → remove 后重试」与「非终态 → 保持合并」。
 */
describe('enqueueScanJob（僵尸 job 自愈）', () => {
    beforeAll(() => {
        setupMemoryDatabase()
    })

    afterAll(() => {
        teardownMemoryDatabase()
    })

    beforeEach(async () => {
        await clearAllTables()
        await createRepo('repo-trigger')
    })

    const makeQueue = (addResults: { reused: boolean, existingRunId: string | null }[]) => {
        const add = vi.fn()
        for (const result of addResults) {
            add.mockResolvedValueOnce({ jobId: 'scan-repo-trigger', ...result })
        }
        const remove = vi.fn().mockResolvedValue({ removed: true })
        return { add, remove, queue: { add, remove } as unknown as ScanQueue }
    }

    it('既有 job 归属已终态 run → remove 后重试入队（不再被永久合并）', async () => {
        const owner = await createRun({ id: 'run-old', repositoryId: 'repo-trigger', status: 'failed' })
        const current = await createRun({ id: 'run-new', repositoryId: 'repo-trigger', status: 'pending' })
        const { add, remove, queue } = makeQueue([
            { reused: true, existingRunId: owner.id },
            { reused: false, existingRunId: null },
        ])

        const result = await enqueueScanJob(queue, 'repo-trigger', REQUEST, current)

        expect(result.reused).toBe(false)
        expect(remove).toHaveBeenCalledWith('repo-trigger', owner.id)
        expect(add).toHaveBeenCalledTimes(2)
    })

    it('既有 job 归属不存在的 run → remove 后重试入队', async () => {
        const current = await createRun({ id: 'run-new', repositoryId: 'repo-trigger', status: 'pending' })
        const { add, remove, queue } = makeQueue([
            { reused: true, existingRunId: 'run-missing' },
            { reused: false, existingRunId: null },
        ])

        const result = await enqueueScanJob(queue, 'repo-trigger', REQUEST, current)

        expect(result.reused).toBe(false)
        expect(remove).toHaveBeenCalledWith('repo-trigger', 'run-missing')
        expect(add).toHaveBeenCalledTimes(2)
    })

    it('既有 job 归属另一个非终态 run → 保持合并语义（不抢占）', async () => {
        const owner = await createRun({ id: 'run-live', repositoryId: 'repo-trigger', status: 'running' })
        const current = await createRun({ id: 'run-new', repositoryId: 'repo-trigger', status: 'pending' })
        const { add, remove, queue } = makeQueue([{ reused: true, existingRunId: owner.id }])

        const result = await enqueueScanJob(queue, 'repo-trigger', REQUEST, current)

        expect(result.reused).toBe(true)
        expect(remove).not.toHaveBeenCalled()
        expect(add).toHaveBeenCalledTimes(1)
    })

    it('既有 job 无 runId（旧 job）→ 无法判定归属，保持合并语义', async () => {
        const current = await createRun({ id: 'run-new', repositoryId: 'repo-trigger', status: 'pending' })
        const { add, remove, queue } = makeQueue([{ reused: true, existingRunId: null }])

        const result = await enqueueScanJob(queue, 'repo-trigger', REQUEST, current)

        expect(result.reused).toBe(true)
        expect(remove).not.toHaveBeenCalled()
        expect(add).toHaveBeenCalledTimes(1)
    })

    it('remove 失败（active 锁未过期）→ 保持合并；下一轮清理再处理', async () => {
        const owner = await createRun({ id: 'run-old-locked', repositoryId: 'repo-trigger', status: 'failed' })
        const current = await createRun({ id: 'run-new', repositoryId: 'repo-trigger', status: 'pending' })
        const add = vi.fn().mockResolvedValueOnce({ jobId: 'scan-repo-trigger', reused: true, existingRunId: owner.id })
        const remove = vi.fn().mockResolvedValue({ removed: false })

        const result = await enqueueScanJob(
            { add, remove } as unknown as ScanQueue,
            'repo-trigger',
            REQUEST,
            current,
        )

        expect(result.reused).toBe(true)
        expect(add).toHaveBeenCalledTimes(1)
    })
})
