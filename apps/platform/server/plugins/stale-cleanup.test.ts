import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * stale-cleanup 插件单测：覆盖 runStaleCleanupOnce 的三类任务编排、队列模式接线
 * （queueJobProbe 下行 + 本轮 / 近期孤儿 job 按 run 归属释放）与失败降级路径。
 * 依赖模块全部 mock，不触达真实 DB / Redis。
 */
const {
    cleanupStaleRunsMock,
    findRecentOrphanedRunsMock,
    reconcileMock,
    pendingMock,
    getQueueServiceMock,
    logErrorMock,
    logInfoMock,
    logWarnMock,
} = vi.hoisted(() => ({
    cleanupStaleRunsMock: vi.fn(),
    findRecentOrphanedRunsMock: vi.fn(),
    reconcileMock: vi.fn(),
    pendingMock: vi.fn(),
    getQueueServiceMock: vi.fn(),
    logErrorMock: vi.fn(),
    logInfoMock: vi.fn(),
    logWarnMock: vi.fn(),
}))

vi.mock('nitropack/runtime', () => ({
    defineNitroPlugin: (fn: unknown) => fn,
}))
vi.mock('#server/services/batch/stale-cleanup', () => ({
    cleanupStaleRuns: cleanupStaleRunsMock,
    findRecentOrphanedRuns: findRecentOrphanedRunsMock,
}))
vi.mock('#server/services/batch/batch-reconciler', () => ({ reconcileRunningBatchRuns: reconcileMock }))
vi.mock('#server/services/batch/cleanup-pending-workdirs', () => ({ cleanupPendingWorkdirs: pendingMock }))
vi.mock('#server/services/queue/queue.service', () => ({ getQueueService: getQueueServiceMock }))
vi.mock('#server/utils/logger', () => ({
    logger: { debug: vi.fn(), info: logInfoMock, warn: logWarnMock, error: logErrorMock },
}))

import staleCleanupPlugin, { runStaleCleanupOnce } from './stale-cleanup'
import { resolveExecutionTimeoutMs } from '#server/services/executor/container-executor'

const syncQueueService = () => ({ mode: 'sync', queue: null, close: vi.fn() })

describe('stale-cleanup 插件 runStaleCleanupOnce', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        cleanupStaleRunsMock.mockResolvedValue({
            scanRunsFailed: 0,
            batchRunsFailed: 0,
            orphanedRuns: [],
            checkedAt: '2026-10-03T00:00:00.000Z',
        })
        reconcileMock.mockResolvedValue({ checkedAt: 'T', scanned: 0, completed: 0, progressUpdated: 0, orphaned: 0 })
        pendingMock.mockResolvedValue({ checkedAt: 'T', removed: 0, skippedMissingMeta: 0 })
        findRecentOrphanedRunsMock.mockResolvedValue([])
        getQueueServiceMock.mockResolvedValue(syncQueueService())
    })

    it('async 模式：下行 queueJobProbe（inspect + hasConsumers）+ 按 run 归属释放孤儿 job', async () => {
        const remove = vi.fn().mockResolvedValue({ removed: true })
        const inspect = vi.fn().mockResolvedValue({
            jobId: 'scan-repo-1',
            state: 'waiting',
            runId: 'run-1',
            runIdKey: 'run-1',
            ageMs: 10 * 60 * 1000,
        })
        const hasConsumers = vi.fn().mockResolvedValue(true)
        getQueueServiceMock.mockResolvedValue({ mode: 'async', queue: { remove, inspect, hasConsumers }, close: vi.fn() })
        cleanupStaleRunsMock.mockResolvedValue({
            scanRunsFailed: 1,
            batchRunsFailed: 0,
            orphanedRuns: [{ repositoryId: 'repo-1', runId: 'run-1' }],
            checkedAt: 'T',
        })

        await runStaleCleanupOnce()

        expect(cleanupStaleRunsMock).toHaveBeenCalledWith(expect.objectContaining({
            scanRunTimeoutMs: resolveExecutionTimeoutMs(),
            queueJobProbe: expect.objectContaining({
                inspect: expect.any(Function),
                hasConsumers: expect.any(Function),
            }),
        }))
        const options = cleanupStaleRunsMock.mock.calls[0]![0] as {
            queueJobProbe: {
                inspect: (repositoryId: string) => Promise<unknown>
                hasConsumers: () => Promise<boolean | null>
            }
        }
        await expect(options.queueJobProbe.inspect('repo-1')).resolves.toMatchObject({ runId: 'run-1' })
        await expect(options.queueJobProbe.hasConsumers()).resolves.toBe(true)
        // 一轮内消费者探测只执行一次（多个 pending run 复用）
        expect(hasConsumers).toHaveBeenCalledTimes(1)
        expect(remove).toHaveBeenCalledWith('repo-1', 'run-1')
    })

    it('释放候选合并：本轮孤儿 + 近期 orphan_run，按 runId 去重', async () => {
        const remove = vi.fn().mockResolvedValue({ removed: true })
        const inspect = vi.fn(async (repositoryId: string) => ({
            jobId: `scan-${repositoryId}`,
            state: 'waiting',
            runId: repositoryId === 'repo-1' ? 'run-1' : 'run-recent',
            runIdKey: repositoryId === 'repo-1' ? 'run-1' : 'run-recent',
            ageMs: 0,
        }))
        getQueueServiceMock.mockResolvedValue({
            mode: 'async',
            queue: { remove, inspect, hasConsumers: vi.fn().mockResolvedValue(true) },
            close: vi.fn(),
        })
        cleanupStaleRunsMock.mockResolvedValue({
            scanRunsFailed: 1,
            batchRunsFailed: 0,
            orphanedRuns: [{ repositoryId: 'repo-1', runId: 'run-1' }],
            checkedAt: 'T',
        })
        findRecentOrphanedRunsMock.mockResolvedValue([
            { repositoryId: 'repo-1', runId: 'run-1' }, // 与本轮重复 → 去重
            { repositoryId: 'repo-recent', runId: 'run-recent' },
        ])

        await runStaleCleanupOnce()

        expect(remove).toHaveBeenCalledTimes(2)
        expect(remove).toHaveBeenCalledWith('repo-1', 'run-1')
        expect(remove).toHaveBeenCalledWith('repo-recent', 'run-recent')
    })

    it('sync 模式：queueJobProbe 为 undefined，且不触发队列释放', async () => {
        const remove = vi.fn()
        getQueueServiceMock.mockResolvedValue({ mode: 'sync', queue: { remove, hasLiveJob: vi.fn() }, close: vi.fn() })
        cleanupStaleRunsMock.mockResolvedValue({
            scanRunsFailed: 1,
            batchRunsFailed: 0,
            orphanedRuns: [{ repositoryId: 'repo-1', runId: 'run-1' }],
            checkedAt: 'T',
        })

        await runStaleCleanupOnce()

        expect(cleanupStaleRunsMock).toHaveBeenCalledWith(expect.objectContaining({
            scanRunTimeoutMs: resolveExecutionTimeoutMs(),
            queueJobProbe: undefined,
        }))
        expect(remove).not.toHaveBeenCalled()
    })

    it('队列服务初始化失败：降级为无队列语义，DB 清理仍执行', async () => {
        getQueueServiceMock.mockRejectedValue(new Error('redis unavailable'))
        cleanupStaleRunsMock.mockResolvedValue({
            scanRunsFailed: 1,
            batchRunsFailed: 0,
            orphanedRuns: [{ repositoryId: 'repo-1', runId: 'run-1' }],
            checkedAt: 'T',
        })
        await runStaleCleanupOnce()

        expect(cleanupStaleRunsMock).toHaveBeenCalledWith(expect.objectContaining({
            scanRunTimeoutMs: resolveExecutionTimeoutMs(),
            queueJobProbe: undefined,
        }))
        expect(logErrorMock).toHaveBeenCalled()
    })

    it('cleanupStaleRuns 抛错：捕获后继续兜底对账与 pending workdir 清理', async () => {
        cleanupStaleRunsMock.mockRejectedValue(new Error('db down'))
        await runStaleCleanupOnce()

        expect(reconcileMock).toHaveBeenCalledTimes(1)
        expect(pendingMock).toHaveBeenCalledTimes(1)
        expect(logErrorMock).toHaveBeenCalled()
    })

    it('单 run 释放抛错：捕获记录且不阻断其余孤儿释放', async () => {
        const remove = vi.fn()
            .mockRejectedValueOnce(new Error('remove failed'))
            .mockResolvedValueOnce({ removed: true })
        const inspect = vi.fn(async (repositoryId: string) => ({
            jobId: `scan-${repositoryId}`,
            state: 'waiting',
            runId: repositoryId === 'repo-1' ? 'run-1' : 'run-2',
            runIdKey: repositoryId === 'repo-1' ? 'run-1' : 'run-2',
            ageMs: 0,
        }))
        getQueueServiceMock.mockResolvedValue({
            mode: 'async',
            queue: { remove, inspect, hasConsumers: vi.fn().mockResolvedValue(false) },
            close: vi.fn(),
        })
        cleanupStaleRunsMock.mockResolvedValue({
            scanRunsFailed: 2,
            batchRunsFailed: 0,
            orphanedRuns: [
                { repositoryId: 'repo-1', runId: 'run-1' },
                { repositoryId: 'repo-2', runId: 'run-2' },
            ],
            checkedAt: 'T',
        })
        await runStaleCleanupOnce()

        expect(remove).toHaveBeenCalledTimes(2)
        expect(logErrorMock).toHaveBeenCalled()
    })

    it('ScanRun 孤儿阈值与执行超时同源联动（EXECUTION_TIMEOUT_MS 覆盖生效）', async () => {
        process.env.EXECUTION_TIMEOUT_MS = '900000'
        try {
            await runStaleCleanupOnce()
            expect(cleanupStaleRunsMock).toHaveBeenCalledWith(
                expect.objectContaining({ scanRunTimeoutMs: 900_000 }),
            )
        } finally {
            delete process.env.EXECUTION_TIMEOUT_MS
        }
    })
})

/**
 * 插件注册守卫：worker 角色不注册周期定时器（无 timer / 无 close 钩子）；
 * server 与未设置照常注册（单进程形态行为不变）。口径见 docs/standards/platform.md §10.6。
 */
describe('stale-cleanup 插件注册守卫', () => {
    const makeNitroApp = () => ({ hooks: { hook: vi.fn() } })

    const runPlugin = (): ReturnType<typeof makeNitroApp> => {
        const nitroApp = makeNitroApp()
        ;(staleCleanupPlugin as unknown as (app: unknown) => void)(nitroApp)
        return nitroApp
    }

    beforeEach(() => {
        vi.useFakeTimers()
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.useRealTimers()
        // 日志 mock 兜底清理（用例中途失败时不残留）
        vi.restoreAllMocks()
        delete process.env.DEPENDFIX_ROLE
    })

    it('worker 角色：不注册周期定时器与 close 钩子，并输出跳过日志', () => {
        process.env.DEPENDFIX_ROLE = 'worker'
        const nitroApp = runPlugin()

        expect(nitroApp.hooks.hook).not.toHaveBeenCalled()
        expect(vi.getTimerCount()).toBe(0)
        expect(logInfoMock).toHaveBeenCalled()
    })

    it('未设置角色：照常注册（单进程形态行为不变）', () => {
        const nitroApp = runPlugin()

        expect(nitroApp.hooks.hook).toHaveBeenCalledWith('close', expect.any(Function))
        expect(vi.getTimerCount()).toBeGreaterThan(0)
        // 触发 close 钩子清理 timer，避免句柄泄漏
        const closeHandler = nitroApp.hooks.hook.mock.calls[0]![1] as () => void
        closeHandler()
    })
})
