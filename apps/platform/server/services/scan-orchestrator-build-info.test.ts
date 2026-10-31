import 'reflect-metadata'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeEvent, setupMemoryDatabase, teardownMemoryDatabase } from '../../tests/api-helper'
import reposIndexHandler from '../api/repos/index'
import { createPendingScanRun, runScanForRepository } from './scan-orchestrator.service'
import { ensureDatabaseInitialized } from '#server/database'
import { ScanRun } from '#server/entities/scan-run'

/**
 * 构建版本回执落库（`ScanRun.buildVersion` / `buildCommit`）。
 *
 * 覆盖「写入来源 = runtimeConfig」与「执行者刷新」两个不变量：
 * 1. 入队（pending）就按当前部署产物落两列，未注入时为 `unknown`（不是 null）；
 * 2. 队列续跑 / 用户复用跨部署时，两列随**本次执行者**刷新，而不是保留最初入队者。
 */

const { ContainerExecutorMock, containerIsAvailable, containerExecute, notifyEnvEvent } = vi.hoisted(() => ({
    ContainerExecutorMock: vi.fn(),
    containerIsAvailable: vi.fn(),
    containerExecute: vi.fn(),
    notifyEnvEvent: vi.fn(),
}))

vi.mock('./executor/container-executor', () => ({
    ContainerExecutor: class {
        constructor(...args: unknown[]) {
            ContainerExecutorMock(...args)
        }

        isAvailable = containerIsAvailable
        execute = containerExecute
    },
}))

vi.mock('#server/utils/guard', () => ({
    requireAuth: vi.fn(async () => ({ user: { id: 'u1', email: 'admin@test.dev' } })),
    requireRole: vi.fn(async () => ({ user: { id: 'u1', email: 'admin@test.dev' } })),
}))

vi.mock('./notification', () => ({
    notifyEnvEvent: (...args: unknown[]) => notifyEnvEvent(...args),
}))

/** stub 部署产物版本戳（与 `/api/health` 同源：runtimeConfig.buildVersion/buildCommit） */
const stubBuildInfo = (buildVersion?: unknown, buildCommit?: unknown) => {
    vi.stubGlobal('useRuntimeConfig', () => ({
        encryptionKey: 'test-encryption-key-32-bytes!!',
        e2eFixturesAllowed: false,
        ...(buildVersion === undefined ? {} : { buildVersion }),
        ...(buildCommit === undefined ? {} : { buildCommit }),
    }))
}

describe('scan-orchestrator 构建版本回执', () => {
    let repositoryId: string

    beforeAll(async () => {
        setupMemoryDatabase()
        const created = await reposIndexHandler(makeEvent('POST', '/api/repos', {
            owner: 'demo',
            name: `build-info-${Math.random().toString(36).slice(2, 8)}`,
            platform: 'github',
            packageManager: 'pnpm',
            defaultBranch: 'main',
            executorKind: 'container',
        })) as { id: string }
        repositoryId = created.id
    })

    afterAll(() => {
        teardownMemoryDatabase()
    })

    beforeEach(() => {
        vi.clearAllMocks()
        containerIsAvailable.mockReset()
        containerIsAvailable.mockResolvedValue(true)
        containerExecute.mockReset()
        containerExecute.mockResolvedValue({
            exitCode: 0,
            result: undefined,
            error: undefined,
            logsJson: undefined,
        })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    const persistedRun = async (id: string) => {
        const ds = await ensureDatabaseInitialized()
        const run = await ds.getRepository(ScanRun).findOne({ where: { id } })
        if (!run) {
            throw new Error(`run not found: ${id}`)
        }
        return run
    }

    it('persists injected build version and commit when the run is created', async () => {
        stubBuildInfo('2026.10.23', 'deadbeefcafe')

        const run = await createPendingScanRun(repositoryId, { mode: 'fix', severityThreshold: 'high' })

        const stored = await persistedRun(run.id)
        expect(stored.buildVersion).toBe('2026.10.23')
        expect(stored.buildCommit).toBe('deadbeefcafe')
    })

    it('falls back to unknown (not null) when the build stamp is not injected', async () => {
        stubBuildInfo()

        const run = await createPendingScanRun(repositoryId, { mode: 'fix', severityThreshold: 'high' })

        const stored = await persistedRun(run.id)
        expect(stored.buildVersion).toBe('unknown')
        expect(stored.buildCommit).toBe('unknown')
    })

    it('refreshes the build stamp to the executor when a queued run is continued', async () => {
        stubBuildInfo('old-build', 'oldcommit')
        const pending = await createPendingScanRun(repositoryId, { mode: 'fix', severityThreshold: 'high' })

        // 部署漂移：续跑发生在另一个构建上
        stubBuildInfo('new-build', 'newcommit')
        const executed = await runScanForRepository(
            repositoryId,
            { mode: 'fix', severityThreshold: 'high' },
            { runId: pending.id },
        )

        const stored = await persistedRun(executed.id)
        expect(stored.buildVersion).toBe('new-build')
        expect(stored.buildCommit).toBe('newcommit')
        // 执行链确实跑到了（不是提前短路）——否则刷新断言会掩盖「根本没执行」
        expect(containerExecute).toHaveBeenCalledTimes(1)
    })

    it('persists the build stamp on the synchronous create path too', async () => {
        stubBuildInfo('sync-build', 'synccommit')

        const executed = await runScanForRepository(repositoryId, { mode: 'fix', severityThreshold: 'high' })

        const stored = await persistedRun(executed.id)
        expect(stored.buildVersion).toBe('sync-build')
        expect(stored.buildCommit).toBe('synccommit')
    })

    it('refreshes the build stamp when an existing run is reused', async () => {
        stubBuildInfo('first-build', 'firstcommit')
        const pending = await createPendingScanRun(repositoryId, { mode: 'fix', severityThreshold: 'high' })

        stubBuildInfo('reuse-build', 'reusecommit')
        const executed = await runScanForRepository(
            repositoryId,
            { mode: 'fix', severityThreshold: 'high' },
            { runId: pending.id, reuse: true },
        )

        const stored = await persistedRun(executed.id)
        expect(stored.buildVersion).toBe('reuse-build')
        expect(stored.buildCommit).toBe('reusecommit')
    })

    it('forwards the build stamp to the engine RuntimeConfig (startup log source)', async () => {
        stubBuildInfo('host-build', 'hostcommit')

        await runScanForRepository(repositoryId, { mode: 'fix', severityThreshold: 'high' })

        const ctx = containerExecute.mock.calls[0]?.[0] as { config?: { buildVersion?: string, buildCommit?: string } }
        expect(ctx.config).toMatchObject({ buildVersion: 'host-build', buildCommit: 'hostcommit' })
    })
})
