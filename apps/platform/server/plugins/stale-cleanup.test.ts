import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * stale-cleanup 插件单测：覆盖 runStaleCleanupOnce 的三类任务编排、队列模式接线
 * （isPendingOrphan 下行 + 孤儿 job 按 run 归属释放）与失败降级路径。
 * 依赖模块全部 mock，不触达真实 DB / Redis。
 */
const { cleanupStaleRunsMock, reconcileMock, pendingMock, getQueueServiceMock } = vi.hoisted(() => ({
    cleanupStaleRunsMock: vi.fn(),
    reconcileMock: vi.fn(),
    pendingMock: vi.fn(),
    getQueueServiceMock: vi.fn(),
}))

vi.mock('nitropack/runtime', () => ({
    defineNitroPlugin: (fn: unknown) => fn,
}))
vi.mock('#server/services/batch/stale-cleanup', () => ({ cleanupStaleRuns: cleanupStaleRunsMock }))
vi.mock('#server/services/batch/batch-reconciler', () => ({ reconcileRunningBatchRuns: reconcileMock }))
vi.mock('#server/services/batch/cleanup-pending-workdirs', () => ({ cleanupPendingWorkdirs: pendingMock }))
vi.mock('#server/services/queue/queue.service', () => ({ getQueueService: getQueueServiceMock }))

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
        getQueueServiceMock.mockResolvedValue(syncQueueService())
    })

    it('async 模式：下行 isPendingOrphan（基于 hasLiveJob）+ 按 run 归属释放孤儿 job', async () => {
        const remove = vi.fn().mockResolvedValue({ removed: true })
        const hasLiveJob = vi.fn().mockResolvedValue(true)
        getQueueServiceMock.mockResolvedValue({ mode: 'async', queue: { remove, hasLiveJob }, close: vi.fn() })
        cleanupStaleRunsMock.mockResolvedValue({
            scanRunsFailed: 1,
            batchRunsFailed: 0,
            orphanedRuns: [{ repositoryId: 'repo-1', runId: 'run-1' }],
            checkedAt: 'T',
        })

        await runStaleCleanupOnce()

        expect(cleanupStaleRunsMock).toHaveBeenCalledWith({ scanRunTimeoutMs: resolveExecutionTimeoutMs(), isPendingOrphan: expect.any(Function) })
        const options = cleanupStaleRunsMock.mock.calls[0]![0] as { isPendingOrphan: (run: { repositoryId: string }) => Promise<boolean> }
        // hasLiveJob=true → isPendingOrphan 返回 false（非孤儿，不误杀）
        await expect(options.isPendingOrphan({ repositoryId: 'repo-1' })).resolves.toBe(false)
        expect(hasLiveJob).toHaveBeenCalledWith('repo-1')
        expect(remove).toHaveBeenCalledWith('repo-1', 'run-1')
    })

    it('sync 模式：isPendingOrphan 为 undefined，且不触发队列释放', async () => {
        const remove = vi.fn()
        getQueueServiceMock.mockResolvedValue({ mode: 'sync', queue: { remove, hasLiveJob: vi.fn() }, close: vi.fn() })
        cleanupStaleRunsMock.mockResolvedValue({
            scanRunsFailed: 1,
            batchRunsFailed: 0,
            orphanedRuns: [{ repositoryId: 'repo-1', runId: 'run-1' }],
            checkedAt: 'T',
        })

        await runStaleCleanupOnce()

        expect(cleanupStaleRunsMock).toHaveBeenCalledWith({ scanRunTimeoutMs: resolveExecutionTimeoutMs(), isPendingOrphan: undefined })
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
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

        await runStaleCleanupOnce()

        expect(cleanupStaleRunsMock).toHaveBeenCalledWith({ scanRunTimeoutMs: resolveExecutionTimeoutMs(), isPendingOrphan: undefined })
        expect(errSpy).toHaveBeenCalled()
        errSpy.mockRestore()
    })

    it('cleanupStaleRuns 抛错：捕获后继续兜底对账与 pending workdir 清理', async () => {
        cleanupStaleRunsMock.mockRejectedValue(new Error('db down'))
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

        await runStaleCleanupOnce()

        expect(reconcileMock).toHaveBeenCalledTimes(1)
        expect(pendingMock).toHaveBeenCalledTimes(1)
        expect(errSpy).toHaveBeenCalled()
        errSpy.mockRestore()
    })

    it('单 run 释放抛错：捕获记录且不阻断其余孤儿释放', async () => {
        const remove = vi.fn()
            .mockRejectedValueOnce(new Error('remove failed'))
            .mockResolvedValueOnce({ removed: true })
        getQueueServiceMock.mockResolvedValue({ mode: 'async', queue: { remove, hasLiveJob: vi.fn().mockResolvedValue(false) }, close: vi.fn() })
        cleanupStaleRunsMock.mockResolvedValue({
            scanRunsFailed: 2,
            batchRunsFailed: 0,
            orphanedRuns: [
                { repositoryId: 'repo-1', runId: 'run-1' },
                { repositoryId: 'repo-2', runId: 'run-2' },
            ],
            checkedAt: 'T',
        })
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

        await runStaleCleanupOnce()

        expect(remove).toHaveBeenCalledTimes(2)
        expect(errSpy).toHaveBeenCalled()
        errSpy.mockRestore()
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
        // console spy 兜底清理（用例中途失败时不残留）
        vi.restoreAllMocks()
        delete process.env.DEPENDFIX_ROLE
    })

    it('worker 角色：不注册周期定时器与 close 钩子，并输出跳过日志', () => {
        process.env.DEPENDFIX_ROLE = 'worker'
        const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined)
        const nitroApp = runPlugin()

        expect(nitroApp.hooks.hook).not.toHaveBeenCalled()
        expect(vi.getTimerCount()).toBe(0)
        expect(infoSpy).toHaveBeenCalled()
        infoSpy.mockRestore()
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
