import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FixError } from '@dependfix/core'
import { skipDeliveryForInstallFailure } from './skipped-delivery'

describe('skipDeliveryForInstallFailure', () => {
    let workDir: string
    let logger: { info: ReturnType<typeof vi.fn>, warn: ReturnType<typeof vi.fn>, error: ReturnType<typeof vi.fn> }
    let allErrors: FixError[]

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), 'dependfix-skip-delivery-'))
        execSync('git init -q', { cwd: workDir })
        execSync('git config user.name test', { cwd: workDir })
        execSync('git config user.email test@test', { cwd: workDir })
        writeFileSync(join(workDir, 'tracked.txt'), 'v1\n', 'utf-8')
        execSync('git add . && git commit -qm init', { cwd: workDir })
        logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
        allErrors = []
    })

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true })
    })

    it('records a skipped-delivery audit entry and rolls back clean worktree', async () => {
        writeFileSync(join(workDir, 'tracked.txt'), 'v2\n', 'utf-8')

        await skipDeliveryForInstallFailure({
            logger: logger as never,
            workDir,
            preExistingDirty: false,
            allErrors,
            repos: ['foo/bar'],
        })

        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('foo/bar'))
        expect(allErrors).toEqual([expect.objectContaining({
            repository: 'foo/bar',
            stage: 'report',
            category: 'PRE_EXISTING_FAILURE',
            message: expect.stringContaining('Delivery skipped'),
        })])
        expect(execSync('git status --porcelain --untracked-files=no', { cwd: workDir, encoding: 'utf-8' }).trim()).toBe('')
    })

    it('does not roll back when the worktree was dirty before the run', async () => {
        writeFileSync(join(workDir, 'tracked.txt'), 'v2\n', 'utf-8')

        await skipDeliveryForInstallFailure({
            logger: logger as never,
            workDir,
            preExistingDirty: true,
            allErrors,
            repos: ['foo/bar'],
        })

        expect(execSync('git status --porcelain --untracked-files=no', { cwd: workDir, encoding: 'utf-8' }).trim()).not.toBe('')
    })
})
