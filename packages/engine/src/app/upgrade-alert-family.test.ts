// upgrade-alert-family.test.ts — 常规分组路径的家族锁步接线。
//
// 覆盖 upgradeAlert 的两条分支：
// - 家族计划可执行 → 返回家族动作，不再调用单包 upgradeDependency；
// - 不属家族 / 只有触发包可写 → 照旧走单包路径（行为不变）。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NormalizedSecurityAlert } from '@dependfix/core'

const { mockUpgradeDependency, mockOverrideTransitiveDependency, mockRunTrackedCommand, mockFamilyResolver } = vi.hoisted(() => ({
    mockUpgradeDependency: vi.fn(),
    mockOverrideTransitiveDependency: vi.fn(),
    mockRunTrackedCommand: vi.fn(),
    mockFamilyResolver: { resolve: vi.fn(), describe: vi.fn() },
}))

vi.mock('../fixers/dependency', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../fixers/dependency')>()
    return {
        ...actual,
        upgradeDependency: mockUpgradeDependency,
        overrideTransitiveDependency: mockOverrideTransitiveDependency,
    }
})

vi.mock('../runners/process-control', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../runners/process-control')>()
    return {
        ...actual,
        runTrackedCommand: mockRunTrackedCommand,
    }
})

vi.mock('../fixers/dependency/family-versions', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../fixers/dependency/family-versions')>()
    return {
        ...actual,
        getFamilyVersionResolver: () => mockFamilyResolver,
    }
})

import { cleanup, createTempProject } from '../fixers/dependency/dependency.test-helpers'
import { upgradeAlert } from './upgrade-alert'

function makeCtx(workDir: string) {
    return {
        config: { dryRun: false } as never,
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
        workDir,
        allErrors: [] as { category?: string, message: string }[],
        summary: { alertsSkipped: 0, alertsSkippedByReason: {} as Record<string, number> },
    }
}

function alert(packageName: string, recommendedVersion: string): NormalizedSecurityAlert {
    return { repository: 'owner/repo', packageName, recommendedVersion } as NormalizedSecurityAlert
}

const projects: ReturnType<typeof createTempProject>[] = []

beforeEach(() => {
    mockUpgradeDependency.mockReset()
    mockUpgradeDependency.mockResolvedValue({
        packageName: 'lodash',
        fromVersion: '^4.17.20',
        toVersion: '^4.17.21',
        isMajor: false,
        success: true,
    })
    mockFamilyResolver.resolve.mockReset()
    mockFamilyResolver.describe.mockReset()
    mockRunTrackedCommand.mockReset()
    mockRunTrackedCommand.mockResolvedValue({
        started: true,
        exitCode: 0,
        signal: null,
        timedOut: false,
        aborted: false,
        errno: null,
        stdout: '',
        stderr: '',
        durationMs: 0,
    })
})

afterEach(() => {
    for (const project of projects.splice(0)) {
        cleanup(project)
    }
})

describe('upgradeAlert family lockstep wiring', () => {
    it('returns the family action and skips the single-package path', async () => {
        const project = createTempProject(
            { vitest: '^3.2.4' },
            { devDeps: { '@vitest/coverage-v8': '^3.2.4' } },
        )
        projects.push(project)
        mockFamilyResolver.resolve.mockResolvedValue({
            ok: true,
            info: { version: '4.6.3', peerDependencies: {} },
        })

        const ctx = makeCtx(project.dir)
        const action = await upgradeAlert(ctx as never, alert('vitest', '4.0.1'))

        expect(action.strategy).toBe('family-lockstep')
        expect(action.success).toBe(true)
        expect(action.family).toEqual({
            id: 'vitest',
            members: ['vitest', '@vitest/coverage-v8'],
            skipped: ['@vitest/ui', '@vitest/browser'],
        })
        expect(mockUpgradeDependency).not.toHaveBeenCalled()
        expect(mockRunTrackedCommand).toHaveBeenCalledTimes(1)
    })

    it('falls back to the single-package path when no other family member is writable', async () => {
        const project = createTempProject({ lodash: '^4.17.20' })
        projects.push(project)

        const ctx = makeCtx(project.dir)
        const action = await upgradeAlert(ctx as never, alert('lodash', '4.17.21'))

        expect(action.strategy).toBeUndefined()
        expect(action.success).toBe(true)
        expect(mockUpgradeDependency).toHaveBeenCalledTimes(1)
        expect(mockRunTrackedCommand).not.toHaveBeenCalled()
    })

    it('passes same-batch targets through to the family plan', async () => {
        const project = createTempProject(
            { vitest: '^3.2.4' },
            { devDeps: { '@vitest/coverage-v8': '^3.2.4' } },
        )
        projects.push(project)

        const ctx = makeCtx(project.dir)
        const action = await upgradeAlert(ctx as never, alert('vitest', '4.0.1'), {
            familyTargets: { '@vitest/coverage-v8': '4.2.0' },
        })

        expect(action.family?.members).toEqual(['vitest', '@vitest/coverage-v8'])
        expect(mockFamilyResolver.resolve).not.toHaveBeenCalled()
    })
})
