// lockfile-repair.test.ts — tryLockfileRepair（toolchain 传递 + 格式漂移标注）。
// 拆分自 app/helpers.test.ts（原 1031 行超 max-lines 1000）。
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FixError } from '@dependfix/core'
import { tryLockfileRepair, type AppContext } from './helpers'

// ---------------------------------------------------------------------------
// Mock engine 内部模块（tryLockfileRepair 依赖 repairLockfile，避免真实 pnpm）
// ---------------------------------------------------------------------------

const pnpmFixerMock = vi.hoisted(() => ({
    repairLockfile: vi.fn(),
}))

vi.mock('../fixers/pnpm', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../fixers/pnpm')>()
    return { ...actual, repairLockfile: pnpmFixerMock.repairLockfile }
})

describe('tryLockfileRepair', () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('passes toolchain pnpm version from config to repairLockfile', () => {
        pnpmFixerMock.repairLockfile.mockReturnValue({
            success: true,
            diff: { summary: 'lockfile updated: +10 lines' },
            attemptHistory: [],
        })

        const action = tryLockfileRepair({
            config: { dryRun: false, toolchainPnpmVersion: '10.5.2' } as AppContext['config'],
            logger,
            workDir: '/tmp/work',
            allErrors: [],
        }, 'foo/bar')

        expect(pnpmFixerMock.repairLockfile).toHaveBeenCalledWith({
            workDir: '/tmp/work',
            toolchain: { pnpmVersion: '10.5.2' },
        })
        expect(action.success).toBe(true)
        expect(action.diff).toBe('lockfile updated: +10 lines')
        expect(action.environmentalFailure).toBeUndefined()
    })

    it('annotates diff when lockfileVersion changed (format drift guard)', () => {
        pnpmFixerMock.repairLockfile.mockReturnValue({
            success: true,
            diff: { summary: 'lockfile updated: +10 lines' },
            attemptHistory: [],
            lockfileVersion: '9.0',
            lockfileVersionChanged: true,
        })

        const action = tryLockfileRepair({
            config: { dryRun: false } as AppContext['config'],
            logger,
            workDir: '/tmp/work',
            allErrors: [],
        }, 'foo/bar')

        expect(action.diff).toBe('lockfile updated: +10 lines (lockfileVersion changed)')
    })

    it('returns early success record in dry-run mode', () => {
        const action = tryLockfileRepair({
            config: { dryRun: true } as AppContext['config'],
            logger,
            workDir: '/tmp/work',
            allErrors: [],
        }, 'foo/bar')

        expect(action.success).toBe(true)
        expect(pnpmFixerMock.repairLockfile).not.toHaveBeenCalled()
    })

    // 环境性安装失败（无 stderr 诊断）：标记 environmentalFailure + 记非归因审计条目
    it('marks environmentalFailure and records a non-attributed audit entry', () => {
        pnpmFixerMock.repairLockfile.mockReturnValue({
            success: false,
            failureCategory: 'ENVIRONMENT_ERROR',
            failureDetail: 'environmental install failure (exit code 1): no stderr diagnostics',
            attemptHistory: [],
            environmental: true,
        })
        const allErrors: FixError[] = []

        const action = tryLockfileRepair({
            config: { dryRun: false } as AppContext['config'],
            logger,
            workDir: '/tmp/work',
            allErrors,
        }, 'foo/bar')

        expect(action.success).toBe(false)
        expect(action.environmentalFailure).toBe(true)
        expect(action.error).toContain('environmental install failure')
        expect(allErrors).toHaveLength(1)
        expect(allErrors[0]).toMatchObject({ repository: 'foo/bar', stage: 'repair', category: 'ENVIRONMENT_ERROR' })
    })

    // 非环境性失败（无 environmental 标记）：不记审计条目、不标记环境性
    it('records no audit entry for a plain (non-environmental) repair failure', () => {
        pnpmFixerMock.repairLockfile.mockReturnValue({
            success: false,
            failureCategory: 'MANIFEST_MISMATCH',
            failureDetail: 'lockfile out of sync',
            attemptHistory: [],
        })
        const allErrors: FixError[] = []

        const action = tryLockfileRepair({
            config: { dryRun: false } as AppContext['config'],
            logger,
            workDir: '/tmp/work',
            allErrors,
        }, 'foo/bar')

        expect(action.success).toBe(false)
        expect(action.environmentalFailure).toBeUndefined()
        expect(allErrors).toHaveLength(0)
    })
})
