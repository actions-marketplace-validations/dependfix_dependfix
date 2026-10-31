import { beforeEach, describe, expect, it, vi } from 'vitest'
import { releaseOrphanQueueJobs } from './orphan-job-release'
import type { ScanJobInspection } from './scan-queue'

const { logErrorMock } = vi.hoisted(() => ({ logErrorMock: vi.fn() }))
vi.mock('#server/utils/logger', () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: logErrorMock },
}))

const ORPHAN = { repositoryId: 'repo-1', runId: 'run-1' }

const makeQueue = (inspection: ScanJobInspection | null, removeResult = { removed: true }) => {
    const inspect = vi.fn().mockResolvedValue(inspection)
    const remove = vi.fn().mockResolvedValue(removeResult)
    return { inspect, remove, queue: { inspect, remove } }
}

describe('releaseOrphanQueueJobs（孤儿去重键释放）', () => {
    beforeEach(() => {
        logErrorMock.mockClear()
    })

    it('job 归属当前孤儿 run → 按 runId 释放', async () => {
        const { queue, remove } = makeQueue({
            jobId: 'scan-repo-1',
            state: 'waiting',
            runId: ORPHAN.runId,
            runIdKey: ORPHAN.runId,
            ageMs: 0,
        })

        const result = await releaseOrphanQueueJobs(queue, [ORPHAN])

        expect(result).toEqual({ removed: 1, skipped: 0 })
        expect(remove).toHaveBeenCalledWith('repo-1', ORPHAN.runId)
    })

    it('job 无 runId（旧 job）→ 以空串归属哨兵释放（防止 inspect 后被替换）', async () => {
        const { queue, remove } = makeQueue({
            jobId: 'scan-repo-1',
            state: 'waiting',
            runId: null,
            runIdKey: '',
            ageMs: 0,
        })

        const result = await releaseOrphanQueueJobs(queue, [ORPHAN])

        expect(result).toEqual({ removed: 1, skipped: 0 })
        expect(remove).toHaveBeenCalledWith('repo-1', '')
    })

    it('job 归属另一个已终态 run → 按该 run 归属释放', async () => {
        const { queue, remove } = makeQueue({
            jobId: 'scan-repo-1',
            state: 'waiting',
            runId: 'run-old',
            runIdKey: 'run-old',
            ageMs: 0,
        })
        const resolveRunStatus = vi.fn().mockResolvedValue('failed')

        const result = await releaseOrphanQueueJobs(queue, [ORPHAN], { resolveRunStatus })

        expect(result).toEqual({ removed: 1, skipped: 0 })
        expect(resolveRunStatus).toHaveBeenCalledWith('run-old')
        expect(remove).toHaveBeenCalledWith('repo-1', 'run-old')
    })

    it('job 归属另一个不存在的 run → 按僵尸 job 释放', async () => {
        const { queue, remove } = makeQueue({
            jobId: 'scan-repo-1',
            state: 'active',
            runId: 'run-missing',
            runIdKey: 'run-missing',
            ageMs: 0,
        })
        const resolveRunStatus = vi.fn().mockResolvedValue(null)

        const result = await releaseOrphanQueueJobs(queue, [ORPHAN], { resolveRunStatus })

        expect(result).toEqual({ removed: 1, skipped: 0 })
        expect(remove).toHaveBeenCalledWith('repo-1', 'run-missing')
    })

    it('job 归属另一个非终态 run → 保留，不误删新任务', async () => {
        const { queue, remove } = makeQueue({
            jobId: 'scan-repo-1',
            state: 'waiting',
            runId: 'run-live',
            runIdKey: 'run-live',
            ageMs: 0,
        })
        const resolveRunStatus = vi.fn().mockResolvedValue('running')

        const result = await releaseOrphanQueueJobs(queue, [ORPHAN], { resolveRunStatus })

        expect(result).toEqual({ removed: 0, skipped: 1 })
        expect(remove).not.toHaveBeenCalled()
    })

    it('job 不存在 → 跳过', async () => {
        const { queue, remove } = makeQueue(null)

        const result = await releaseOrphanQueueJobs(queue, [ORPHAN])

        expect(result).toEqual({ removed: 0, skipped: 0 })
        expect(remove).not.toHaveBeenCalled()
    })

    it('remove 失败（active 锁未过期）→ 不计数，继续处理下一个', async () => {
        const inspect = vi.fn()
            .mockResolvedValueOnce({ jobId: 'scan-repo-1', state: 'active', runId: 'run-1', runIdKey: 'run-1', ageMs: 0 })
            .mockResolvedValueOnce({ jobId: 'scan-repo-2', state: 'waiting', runId: 'run-2', runIdKey: 'run-2', ageMs: 0 })
        const remove = vi.fn()
            .mockResolvedValueOnce({ removed: false })
            .mockResolvedValueOnce({ removed: true })

        const result = await releaseOrphanQueueJobs(
            { inspect, remove },
            [ORPHAN, { repositoryId: 'repo-2', runId: 'run-2' }],
        )

        expect(result).toEqual({ removed: 1, skipped: 0 })
        expect(remove).toHaveBeenCalledTimes(2)
    })

    it('inspect 抛错 → 仅告警，不阻断其余释放', async () => {
        const inspect = vi.fn()
            .mockRejectedValueOnce(new Error('redis unavailable'))
            .mockResolvedValueOnce({ jobId: 'scan-repo-2', state: 'waiting', runId: 'run-2', runIdKey: 'run-2', ageMs: 0 })
        const remove = vi.fn().mockResolvedValue({ removed: true })
        const result = await releaseOrphanQueueJobs(
            { inspect, remove },
            [ORPHAN, { repositoryId: 'repo-2', runId: 'run-2' }],
        )

        expect(result).toEqual({ removed: 1, skipped: 0 })
        expect(logErrorMock).toHaveBeenCalled()
    })
})
