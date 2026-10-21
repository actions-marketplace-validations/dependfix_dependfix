import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FixError } from '@dependfix/core'
import { sampleVerificationBaseline, verifyProject } from './verify-project'

const runVerificationMock = vi.hoisted(() => vi.fn())

vi.mock('../runners/verification-runner', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../runners/verification-runner')>()
    return { ...actual, runVerification: runVerificationMock }
})

const commandResult = (
    command: string,
    exitCode: number,
    stderr = '',
) => ({ command, exitCode, durationMs: 1, stdout: '', stderr })

const makeCtx = (workDir: string) => ({
    config: {
        rollbackGranularity: 'unit' as const,
    } as never,
    customCommands: ['pnpm install --frozen-lockfile', 'pnpm test'],
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
    workDir,
    allErrors: [] as FixError[],
})

describe('修复前基线完整链（nest-template 形态）', () => {
    let workDir: string

    afterEach(() => {
        runVerificationMock.mockReset()
        if (workDir) {
            rmSync(workDir, { recursive: true, force: true })
        }
    })

    it('install 失败后仍采样 test 的 No tests found，并在修复后按同命令既有失败豁免', async () => {
        workDir = mkdtempSync(join(tmpdir(), 'dependfix-baseline-chain-'))
        const ctx = makeCtx(workDir)

        runVerificationMock
            .mockResolvedValueOnce({
                success: false,
                commandResults: [
                    commandResult('pnpm install --frozen-lockfile', 1, 'ERR_PNPM_BROKEN_LOCKFILE'),
                    commandResult('pnpm test', 1, 'No tests found'),
                ],
                failedCommand: 'pnpm install --frozen-lockfile',
            })
            .mockResolvedValueOnce({
                success: false,
                commandResults: [
                    commandResult('pnpm install --frozen-lockfile', 0),
                    commandResult('pnpm test', 1, 'No tests found'),
                ],
                failedCommand: 'pnpm test',
            })

        const baseline = await sampleVerificationBaseline(ctx, 'foo/bar')
        expect(runVerificationMock.mock.calls[0]?.[0]).toMatchObject({ stopOnFailure: false })
        expect(baseline?.map((item) => item.command)).toEqual([
            'pnpm install --frozen-lockfile',
            'pnpm test',
        ])

        const actions = await verifyProject(ctx, 'foo/bar', { baseline })
        const testAction = actions.find((action) => action.target === 'pnpm test')
        expect(testAction).toMatchObject({ success: false, preExisting: true })
        expect(ctx.allErrors).toEqual([
            expect.objectContaining({
                category: 'PRE_EXISTING_FAILURE',
                target: 'pnpm test',
            }),
        ])
    })
})
