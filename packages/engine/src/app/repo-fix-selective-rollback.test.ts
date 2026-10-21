import { execSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyRunSummary, type FixAction } from '@dependfix/core'
import type { RepoFixCtx, RepoFixProgress } from './repo-fix'
import { recordVerificationCheckpoint } from './verification-checkpoint'
import { finalizeRepoFix } from './repo-fix-finalize'

const verifyProjectMock = vi.hoisted(() => vi.fn())
const tryLockfileRepairMock = vi.hoisted(() => vi.fn())

vi.mock('./verify-project', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./verify-project')>()
    return { ...actual, verifyProject: verifyProjectMock }
})

vi.mock('./helpers', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./helpers')>()
    return { ...actual, tryLockfileRepair: tryLockfileRepairMock }
})

const action = (target: string, success = true): FixAction => ({
    type: 'dependency-upgrade',
    repository: 'foo/bar',
    target,
    success,
})

const verification = (success: boolean): FixAction => ({
    type: 'verification',
    repository: 'foo/bar',
    target: 'pnpm typecheck',
    success,
})

const makeProgress = (): RepoFixProgress => ({
    alertsCount: 1,
    fixable: 1,
    fixed: 1,
    failed: 0,
    lockfileRepaired: false,
    verificationPassed: undefined,
    verificationBlocking: undefined,
    defaultBranch: 'main',
})

const makeCtx = (workDir: string): RepoFixCtx => ({
    config: { dryRun: false, rollbackGranularity: 'unit' } as never,
    workDir,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
    runId: 'run-1',
    allAlerts: [],
    allActions: [action('first')],
    allErrors: [],
    alertsDisabled: [],
    repoResults: [],
    summary: { ...createEmptyRunSummary(), alertsFixed: 1 },
    startedAt: new Date().toISOString(),
    finishedAt: '',
    aiUsageRef: { aggregate: undefined },
    verificationCheckpoints: [],
    verificationBaseline: {},
})

describe('finalizeRepoFix selective unit rollback', () => {
    let workDir: string
    let ctx: RepoFixCtx
    let progress: RepoFixProgress

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), 'dependfix-finalize-rollback-'))
        execSync('git init -q', { cwd: workDir })
        execSync('git config user.name test', { cwd: workDir })
        execSync('git config user.email test@test', { cwd: workDir })
        writeFileSync(join(workDir, 'package.json'), 'v1\n')
        execSync('git add . && git commit -qm init', { cwd: workDir })
        ctx = makeCtx(workDir)
        progress = makeProgress()
        tryLockfileRepairMock.mockResolvedValue({
            type: 'lockfile-repair', repository: 'foo/bar', target: 'pnpm-lock.yaml',
            success: true, noOp: false, durationMs: 1,
        })
    })

    afterEach(() => {
        verifyProjectMock.mockReset()
        tryLockfileRepairMock.mockReset()
        rmSync(workDir, { recursive: true, force: true })
    })

    it('skips selective rollback when the worktree was dirty before the run', async () => {
        writeFileSync(join(workDir, 'package.json'), 'v2\n')
        expect(recordVerificationCheckpoint(ctx, 'foo/bar', progress, 'unit-first')).toBeDefined()
        ctx.allActions.push(action('second'))
        ctx.summary.alertsFixed = 2
        progress.fixed = 2
        writeFileSync(join(workDir, 'package.json'), 'v3\n')
        ctx.preExistingDirty = true
        verifyProjectMock.mockResolvedValueOnce([verification(false)])

        await finalizeRepoFix(ctx, 'foo/bar', progress)

        expect(readFileSync(join(workDir, 'package.json'), 'utf-8')).toBe('v3\n')
        expect(progress.verificationBlocking).toBe(true)
        expect(verifyProjectMock).toHaveBeenCalledTimes(1)
    })

    it('reverts the latest unit and preserves the earlier verified unit when retry turns green', async () => {
        writeFileSync(join(workDir, 'package.json'), 'v2\n')
        expect(recordVerificationCheckpoint(ctx, 'foo/bar', progress, 'unit-first')).toBeDefined()

        // 第二个单元：动作 / 计数 / 文件都前进；终验失败
        ctx.allActions.push(action('second'))
        ctx.summary.alertsFixed = 2
        progress.fixed = 2
        writeFileSync(join(workDir, 'package.json'), 'v3\n')
        verifyProjectMock
            .mockResolvedValueOnce([verification(false)])
            .mockResolvedValueOnce([verification(true)])

        await finalizeRepoFix(ctx, 'foo/bar', progress)

        expect(readFileSync(join(workDir, 'package.json'), 'utf-8')).toBe('v2\n')
        expect(progress.verificationBlocking).toBe(false)
        expect(progress.verificationPassed).toBe(true)
        expect(progress.fixed).toBe(1)
        expect(ctx.summary.alertsFixed).toBe(1)
        expect(ctx.allActions.map((item) => item.target)).toEqual([
            'first',
            'pnpm-lock.yaml',
            'pnpm typecheck',
        ])
    })
})
