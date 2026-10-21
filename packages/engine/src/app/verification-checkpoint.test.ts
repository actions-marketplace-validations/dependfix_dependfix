import { execFileSync, execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyRunSummary, type FixAction } from '@dependfix/core'
import { rollbackChanges } from '../runners/verification-gate'
import type { RepoFixCtx, RepoFixProgress } from './repo-fix'
import { attemptSelectiveUnitRollback, recordVerificationCheckpoint } from './verification-checkpoint'

const makeAction = (target: string): FixAction => ({
    type: 'dependency-upgrade',
    repository: 'foo/bar',
    target,
    success: true,
})

const makeProgress = (): RepoFixProgress => ({
    alertsCount: 1,
    fixable: 1,
    fixed: 0,
    failed: 0,
    lockfileRepaired: false,
    verificationPassed: undefined,
    verificationBlocking: undefined,
    defaultBranch: 'main',
})

const makeCtx = (workDir: string, granularity: 'unit' | 'repo' = 'unit'): RepoFixCtx => ({
    config: { dryRun: false, rollbackGranularity: granularity } as never,
    workDir,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
    runId: 'run-1',
    allAlerts: [],
    allActions: [],
    allErrors: [],
    alertsDisabled: [],
    repoResults: [],
    summary: createEmptyRunSummary(),
    startedAt: new Date().toISOString(),
    finishedAt: '',
    aiUsageRef: { aggregate: undefined },
    verificationCheckpoints: [],
})

describe('verification checkpoint / selective rollback', () => {
    let workDir: string
    let ctx: RepoFixCtx
    let progress: RepoFixProgress

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), 'dependfix-checkpoint-'))
        execSync('git init -q', { cwd: workDir })
        execSync('git config user.name test', { cwd: workDir })
        execSync('git config user.email test@test', { cwd: workDir })
        writeFileSync(join(workDir, 'package.json'), 'v1\n')
        execSync('git add . && git commit -qm init', { cwd: workDir })
        ctx = makeCtx(workDir)
        progress = makeProgress()
    })

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true })
    })

    it('records a checkpoint and preserves earlier unit while reverting the latest one', async () => {
        ctx.allActions.push(makeAction('first'))
        progress.fixed = 1
        ctx.summary.alertsFixed = 1
        writeFileSync(join(workDir, 'package.json'), 'v2\n')
        // 第二个单元开始前：checkpoint 记录的是「已保留第一个单元」的状态
        expect(recordVerificationCheckpoint(ctx, 'foo/bar', progress, 'unit-before-second')).toBeDefined()

        ctx.allActions.push(makeAction('second'))
        progress.fixed = 2
        ctx.summary.alertsFixed = 2
        writeFileSync(join(workDir, 'package.json'), 'v3\n')

        const outcome = await attemptSelectiveUnitRollback(ctx, 'foo/bar', progress, async () => [])

        expect(outcome).toMatchObject({ applied: true, blocking: false })
        expect(readFileSync(join(workDir, 'package.json'), 'utf-8')).toBe('v2\n')
        expect(ctx.allActions.map((action) => action.target)).toEqual(['first'])
        expect(progress.fixed).toBe(1)
        expect(ctx.summary.alertsFixed).toBe(1)
        // HEAD 不移动，checkpoint 只是游离对象
        expect(execSync('git log -1 --format=%s', { cwd: workDir, encoding: 'utf-8' }).trim()).toBe('init')
        expect(execSync('git status --porcelain', { cwd: workDir, encoding: 'utf-8' }).trim()).not.toBe('')
    })

    it('falls back with explicit degraded audit when re-verification still blocks', async () => {
        ctx.allActions.push(makeAction('first'))
        progress.fixed = 1
        writeFileSync(join(workDir, 'package.json'), 'v2\n')
        expect(recordVerificationCheckpoint(ctx, 'foo/bar', progress, 'unit-before-second')).toBeDefined()

        ctx.allActions.push(makeAction('second'))
        progress.fixed = 2
        writeFileSync(join(workDir, 'package.json'), 'v3\n')

        const blockingAction: FixAction = {
            type: 'verification',
            repository: 'foo/bar',
            target: 'pnpm test',
            success: false,
        }
        const outcome = await attemptSelectiveUnitRollback(ctx, 'foo/bar', progress, async () => [blockingAction])

        expect(outcome).toMatchObject({ applied: true, blocking: true })
        expect(readFileSync(join(workDir, 'package.json'), 'utf-8')).toBe('v2\n')
        expect(ctx.allErrors).toEqual([
            expect.objectContaining({
                category: 'ROLLBACK_GRANULARITY_DEGRADED',
                repository: 'foo/bar',
            }),
        ])
    })

    it('repo granularity records no checkpoint and keeps repository-level rollback', async () => {
        ctx = makeCtx(workDir, 'repo')
        ctx.allActions.push(makeAction('first'))
        writeFileSync(join(workDir, 'package.json'), 'v2\n')

        expect(recordVerificationCheckpoint(ctx, 'foo/bar', progress, 'unit-first')).toBeUndefined()
        const outcome = await attemptSelectiveUnitRollback(ctx, 'foo/bar', progress, async () => [])
        expect(outcome).toMatchObject({ applied: false, blocking: true })
        expect(readFileSync(join(workDir, 'package.json'), 'utf-8')).toBe('v2\n')
    })

    it('real TypeScript regression: reverts the latest invalid unit and keeps earlier verified code', async () => {
        const require = createRequire(import.meta.url)
        const tsc = require.resolve('typescript/bin/tsc')
        writeFileSync(join(workDir, 'tsconfig.json'), JSON.stringify({
            compilerOptions: { strict: true, noEmit: true },
            files: ['index.ts'],
        }))
        writeFileSync(join(workDir, 'index.ts'), 'export const value: string = "ok"\n')
        execSync('git add . && git commit -qm ts-init', { cwd: workDir })

        // 第一个单元（已通过 probe）保持有效；第二个单元引入真实 TS 错误
        writeFileSync(join(workDir, 'index.ts'), 'export const value: string = "ok"\nexport const safe = true\n')
        ctx.allActions.push(makeAction('first'))
        progress.fixed = 1
        expect(recordVerificationCheckpoint(ctx, 'foo/bar', progress, 'before-ts-regression')).toBeDefined()
        writeFileSync(join(workDir, 'index.ts'), 'export const value: number = "bad"\n')
        ctx.allActions.push(makeAction('second'))
        progress.fixed = 2

        const outcome = await attemptSelectiveUnitRollback(ctx, 'foo/bar', progress, async () => {
            try {
                execFileSync(process.execPath, [tsc, '--noEmit', '-p', workDir], { stdio: 'pipe' })
                return [{ type: 'verification', repository: 'foo/bar', target: 'tsc --noEmit', success: true }]
            } catch (error) {
                return [{
                    type: 'verification', repository: 'foo/bar', target: 'tsc --noEmit', success: false,
                    error: error instanceof Error ? error.message : String(error),
                }]
            }
        })

        expect(outcome).toMatchObject({ applied: true, blocking: false })
        expect(readFileSync(join(workDir, 'index.ts'), 'utf-8')).toContain('export const safe = true')
        expect(ctx.allActions.map((item) => item.target)).toEqual(['first'])
    }, 30_000)

    it('degrades without restoring when later failed unit outcomes exist', async () => {
        ctx.allActions.push(makeAction('first'))
        progress.fixed = 1
        writeFileSync(join(workDir, 'package.json'), 'v2\n')
        expect(recordVerificationCheckpoint(ctx, 'foo/bar', progress, 'before-second')).toBeDefined()

        ctx.allActions.push(makeAction('second'))
        progress.failed = 1
        writeFileSync(join(workDir, 'package.json'), 'v3\n')
        const outcome = await attemptSelectiveUnitRollback(ctx, 'foo/bar', progress, async () => [])

        expect(outcome).toMatchObject({ applied: false, blocking: true })
        expect(readFileSync(join(workDir, 'package.json'), 'utf-8')).toBe('v3\n')
        expect(ctx.allErrors).toEqual([
            expect.objectContaining({ category: 'ROLLBACK_GRANULARITY_DEGRADED' }),
        ])
    })

    it('records degraded audit when no unit checkpoint exists', async () => {
        const outcome = await attemptSelectiveUnitRollback(ctx, 'foo/bar', progress, async () => [])
        expect(outcome).toMatchObject({ applied: false, blocking: true })
        expect(ctx.allErrors).toEqual([
            expect.objectContaining({ category: 'ROLLBACK_GRANULARITY_DEGRADED' }),
        ])
    })

    it('negative control: repository-level rollback discards the earlier unit too', () => {
        ctx.allActions.push(makeAction('first'))
        writeFileSync(join(workDir, 'package.json'), 'v2\n')
        expect(recordVerificationCheckpoint(ctx, 'foo/bar', progress, 'unit-first')).toBeDefined()

        ctx.allActions.push(makeAction('second'))
        writeFileSync(join(workDir, 'package.json'), 'v3\n')
        rollbackChanges(workDir)

        expect(readFileSync(join(workDir, 'package.json'), 'utf-8')).toBe('v1\n')
        expect(ctx.allActions.map((action) => action.target)).toEqual(['first', 'second'])
    })
})
