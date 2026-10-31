// stdout-evidence.test.ts — pnpm 11 安装脚本错误写 stdout 时的失败取证。
//
// 生产形态：prebuild-install 下载预编译包超时 → 回退 node-gyp → 环境缺 Python，
// pnpm 把子脚本错误写到 stdout，stderr 为空。旧实现只读 stderr，日志只剩
// `no stderr diagnostics` / `Command failed: pnpm install …`，无法定位根因。
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRunTrackedCommand } = vi.hoisted(() => ({
    mockRunTrackedCommand: vi.fn(),
}))

vi.mock('../../runners/process-control', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../runners/process-control')>()
    return { ...original, runTrackedCommand: mockRunTrackedCommand }
})

import { classifyLockfileFailure, repairLockfile } from './index'

type TrackedOutcome = import('../../runners/process-control').TrackedCommandResult

function okOutcome(overrides: Partial<TrackedOutcome> = {}): TrackedOutcome {
    return {
        started: true,
        exitCode: 0,
        signal: null,
        timedOut: false,
        aborted: false,
        errno: null,
        stdout: '',
        stderr: '',
        durationMs: 0,
        ...overrides,
    }
}

function createTempProject(): string {
    const dir = mkdtempSync(join(tmpdir(), 'dependfix-pnpm-stdout-'))
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0' }, null, 2))
    writeFileSync(join(dir, 'pnpm-lock.yaml'), 'lockfileVersion: \'9.0\'\n')
    return dir
}

beforeEach(() => {
    mockRunTrackedCommand.mockReset()
})

describe('pnpm stdout 失败取证', () => {
    let workDir: string

    afterEach(() => {
        if (workDir) {
            rmSync(workDir, { recursive: true, force: true })
        }
    })

    it('classifyLockfileFailure 把运行中取消映射为 ABORTED（不伪装成环境性失败）', async () => {
        mockRunTrackedCommand.mockResolvedValue(okOutcome({
            exitCode: null,
            signal: 'SIGKILL',
            aborted: true,
        }))

        const result = await classifyLockfileFailure('/tmp/test')

        expect(result.category).toBe('ABORTED')
        expect(result.environmental).toBe(false)
        expect(result.diagnostics).toContain('run aborted')
    })

    it('classifyLockfileFailure 在 stderr 为空时保留 stdout 诊断', async () => {
        mockRunTrackedCommand.mockResolvedValue(okOutcome({
            exitCode: 1,
            stderr: '',
            stdout: 'gyp ERR! find Python\ngyp ERR! not ok',
        }))

        const result = await classifyLockfileFailure('/tmp/test')

        expect(result.category).toBe('ENVIRONMENT_ERROR')
        expect(result.environmental).toBe(true)
        expect(result.noDiagnostics).toBe(false)
        expect(result.stdout).toContain('gyp ERR! find Python')
        expect(result.diagnostics).toContain('gyp ERR! find Python')
    })

    it('repairLockfile 的环境性失败详情包含 stdout 证据', async () => {
        workDir = createTempProject()
        mockRunTrackedCommand.mockResolvedValue(okOutcome({
            exitCode: 1,
            stderr: '',
            stdout: 'prebuild-install warn install Request timed out\n'
                + 'gyp ERR! find Python\n[ELIFECYCLE] Command failed with exit code 1.',
        }))

        const result = await repairLockfile({ workDir })

        expect(result.success).toBe(false)
        expect(result.environmental).toBe(true)
        expect(result.failureDetail).toContain('gyp ERR! find Python')
        expect(result.failureDetail).not.toContain('no stderr/stdout diagnostics')
    })

    it('长输出时失败详情保留尾部根因（不从头部截断）', async () => {
        workDir = createTempProject()
        const progressLines = Array.from({ length: 200 }, (_, i) => `Progress: resolved ${i}, downloaded ${i}`).join('\n')
        mockRunTrackedCommand.mockResolvedValue(okOutcome({
            exitCode: 1,
            stderr: '',
            stdout: `${progressLines}\nprebuild-install warn install Request timed out\ngyp ERR! find Python`,
        }))

        const result = await repairLockfile({ workDir })

        expect(result.success).toBe(false)
        expect(result.failureDetail).toContain('gyp ERR! find Python')
    })
})
