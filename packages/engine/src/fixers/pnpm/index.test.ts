import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest'

// 安装类调用已从同步 `execFileSync` 迁到受管异步执行（`runners/process-control.ts` 的
// `runTrackedCommand`）——测试替身接管该**单一入口**，无需真实 pnpm；其余导出保持真实实现
// （取消状态与 killProcessTree 的真实语义由 process-control 自身用例承担）。
const { mockRunTrackedCommand } = vi.hoisted(() => ({
    mockRunTrackedCommand: vi.fn(),
}))

vi.mock('../../runners/process-control', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../runners/process-control')>()
    return { ...original, runTrackedCommand: mockRunTrackedCommand }
})

import { DEFAULT_INSTALL_TIMEOUT_MS, INSTALL_TIMEOUT_ENV } from '../install-timeouts'
import { resetProcessControlState, requestAbort } from '../../runners/process-control'
import {
    classifyLockfileFailure,
    computeLockfileDiff,
    extractLockfileVersion,
    resolvePnpmVersion,
    repairLockfile,
} from './index'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TempProject {
    dir: string
    pkgPath: string
    lockfilePath: string
}

function createTempProject(
    options?: {
        packageManager?: string
        withLockfile?: boolean
    },
): TempProject {
    const dir = mkdtempSync(join(tmpdir(), 'dependfix-test-pnpm-'))
    const pkg: Record<string, unknown> = { name: 'test-project', version: '1.0.0' }
    if (options?.packageManager) {
        pkg.packageManager = options.packageManager
    }
    const pkgPath = join(dir, 'package.json')
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
    const lockfilePath = join(dir, 'pnpm-lock.yaml')
    if (options?.withLockfile !== false) {
        writeFileSync(lockfilePath, generateLockfileContent(5, 10))
    }
    return { dir, pkgPath, lockfilePath }
}

function generateLockfileContent(lineCount: number, packageCount: number): string {
    const lines = ['lockfileVersion: \'9.0\'', '', 'importers:', '  .: {}', '', 'packages:']
    for (let i = 0; i < packageCount; i++) {
        lines.push(`  /pkg-${i}@${i % 2 === 0 ? '1.0.0' : '2.0.0'}:`)
        lines.push(`    resolution: {integrity: sha512-${i}}`)
    }
    while (lines.length < lineCount) {
        lines.push('')
    }
    return `${lines.join('\n')}\n`
}

function makeExecError(stderr: string): Error & { stderr: Buffer } {
    const err = new Error(`Command failed: ${stderr.slice(0, 40)}`) as Error & { stderr: Buffer }
    err.stderr = Buffer.from(stderr, 'utf-8')
    return err
}

/** 受管命令执行结果（与 `runTrackedCommand` 返回结构一致）。 */
type TrackedOutcome = import('../../runners/process-control').TrackedCommandResult

/** 成功结果（缺省 stdout / stderr 为空）。 */
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

/** 替身：所有调用均成功。 */
function stubSuccess(): void {
    mockRunTrackedCommand.mockImplementation(async () => okOutcome())
}

/**
 * 旧 stub 形态适配：`impl` 正常返回 = 命令成功；抛出 `execFileSync` 形态错误 = 命令失败。
 *
 * 让既有用例（诊断 / frozen 校验 / 策略执行三类调用共用同一替身）在迁移到受管异步执行后
 * 保持原有断言口径（分类 / 退出码 / 信号 / 环境性判定），无需逐条重写。
 */
function stubExecImplementation(impl: () => unknown): void {
    mockRunTrackedCommand.mockImplementation(async () => {
        try {
            impl()
            return okOutcome()
        } catch (err) {
            return outcomeFromExecError(err)
        }
    })
}

/** 把 `execFileSync` 形态错误翻译为受管执行结果（stderr / status / signal / code 语义一一对应）。 */
function outcomeFromExecError(err: unknown): TrackedOutcome {
    const e = err as { stderr?: Buffer | string, status?: number, signal?: string, code?: string }
    const stderr = typeof e.stderr === 'string' ? e.stderr : e.stderr?.toString('utf-8') ?? ''
    const timedOut = e.code === 'ETIMEDOUT'
    return okOutcome({
        exitCode: typeof e.status === 'number' ? e.status : null,
        signal: (e.signal as TrackedOutcome['signal']) ?? null,
        timedOut,
        errno: timedOut ? null : e.code ?? null,
        stderr,
    })
}

function cleanupTemp(dir: string): void {
    try {
        rmSync(dir, { recursive: true, force: true })
    } catch {
        /* ignore */
    }
}

beforeEach(() => {
    mockRunTrackedCommand.mockReset()
})

// ---------------------------------------------------------------------------
// classifyLockfileFailure
// ---------------------------------------------------------------------------

describe('classifyLockfileFailure', () => {
    it('ok when frozen-lockfile passes', async () => {
        stubSuccess()
        const result = await classifyLockfileFailure('/tmp/test')
        expect(result).toEqual({
            ok: true,
            stdout: '',
            diagnostics: '',
            exitCode: 0,
            signal: null,
            timedOut: false,
            errno: null,
            noDiagnostics: true,
            environmental: false,
        })
    })

    it('LOCKFILE_NOT_FOUND', async () => {
        stubExecImplementation(() => {
            throw makeExecError('Cannot find pnpm-lock.yaml')
        })
        const result = await classifyLockfileFailure('/tmp/test')
        expect(result).toEqual({
            ok: false,
            category: 'LOCKFILE_NOT_FOUND',
            stderr: expect.stringContaining('Cannot find') as unknown,
            stdout: '',
            diagnostics: expect.stringContaining('Cannot find') as unknown,
            exitCode: null,
            signal: null,
            timedOut: false,
            errno: null,
            noDiagnostics: false,
            environmental: false,
        })
    })

    // pnpm 11 把安装脚本错误写到 stdout：stderr 为空时仍是环境性失败，但证据必须保留 stdout
    // 运行级取消：未启动子进程 → 独立类别 ABORTED，不伪装成环境性失败
    it('classifies as ABORTED (not environmental) when the run was cancelled', async () => {
        // 真实受管执行在取消态返回 started=false 且退出码为占位值；替身须复刻该形态
        mockRunTrackedCommand.mockResolvedValue(okOutcome({ started: false, exitCode: null, aborted: true }))
        requestAbort('execution timeout')
        try {
            const result = await classifyLockfileFailure('/tmp/test')

            expect(result.category).toBe('ABORTED')
            expect(result.environmental).toBe(false)
            expect(result.noDiagnostics).toBe(false)
            expect(result.stderr).toContain('run aborted before diagnosis')
        } finally {
            resetProcessControlState()
        }
    })

    // 2026-10-17 超时口径收敛：诊断 install 与 install / 策略链共用同一解析器（默认 300s、env 可覆盖）
    it('uses the shared install timeout for the diagnosis install', async () => {
        stubSuccess()

        await classifyLockfileFailure('/tmp/test')

        expect(mockRunTrackedCommand).toHaveBeenCalledWith(expect.objectContaining({
            binary: 'pnpm',
            args: ['install', '--frozen-lockfile'],
            timeoutMs: DEFAULT_INSTALL_TIMEOUT_MS,
        }))
    })

    it('honours DEPENDFIX_INSTALL_TIMEOUT_MS override for the diagnosis install', async () => {
        stubSuccess()
        const original = process.env[INSTALL_TIMEOUT_ENV]
        process.env[INSTALL_TIMEOUT_ENV] = '45000'
        try {
            await classifyLockfileFailure('/tmp/test')
        } finally {
            if (original === undefined) {
                delete process.env[INSTALL_TIMEOUT_ENV]
            } else {
                process.env[INSTALL_TIMEOUT_ENV] = original
            }
        }

        expect(mockRunTrackedCommand).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 45_000 }))
    })

    it('MANIFEST_MISMATCH via ERR_PNPM_OUTDATED_LOCKFILE', async () => {
        stubExecImplementation(() => {
            throw makeExecError('ERR_PNPM_OUTDATED_LOCKFILE')
        })
        const result = await classifyLockfileFailure('/tmp/test')
        expect(result.ok).toBe(false)
        expect(result.category).toBe('MANIFEST_MISMATCH')
    })

    it('MANIFEST_MISMATCH via "out of sync"', async () => {
        stubExecImplementation(() => {
            throw makeExecError('lockfile is out of sync')
        })
        const result = await classifyLockfileFailure('/tmp/test')
        expect(result.category).toBe('MANIFEST_MISMATCH')
    })

    it('LOCKFILE_VERSION_MISMATCH', async () => {
        stubExecImplementation(() => {
            throw makeExecError('lockfileVersion incompatible: lockfile had been generated with pnpm v10')
        })
        const result = await classifyLockfileFailure('/tmp/test')
        expect(result.category).toBe('LOCKFILE_VERSION_MISMATCH')
    })

    it('CORRUPTED_LOCKFILE', async () => {
        stubExecImplementation(() => {
            throw makeExecError('ERR_PNPM_BROKEN_LOCKFILE: broken lockfile')
        })
        const result = await classifyLockfileFailure('/tmp/test')
        expect(result.category).toBe('CORRUPTED_LOCKFILE')
    })

    it('CREDENTIAL_ERROR via E401', async () => {
        stubExecImplementation(() => {
            throw makeExecError('E401 Unable to authenticate')
        })
        const result = await classifyLockfileFailure('/tmp/test')
        expect(result.category).toBe('CREDENTIAL_ERROR')
    })

    it('CREDENTIAL_ERROR via authentication failed', async () => {
        stubExecImplementation(() => {
            throw makeExecError('authentication failed')
        })
        const result = await classifyLockfileFailure('/tmp/test')
        expect(result.category).toBe('CREDENTIAL_ERROR')
    })

    it('RESOLVE_ERROR via ERR_PNPM_NO_MATCHING_VERSION', async () => {
        stubExecImplementation(() => {
            throw makeExecError('ERR_PNPM_NO_MATCHING_VERSION')
        })
        const result = await classifyLockfileFailure('/tmp/test')
        expect(result.category).toBe('RESOLVE_ERROR')
    })

    it('MINIMUM_RELEASE_AGE via ERR_PNPM_NO_MATURE_MATCHING_VERSION (resolution)', async () => {
        stubExecImplementation(() => {
            throw makeExecError('ERR_PNPM_NO_MATURE_MATCHING_VERSION: 2 versions do not meet the minimumReleaseAge constraint')
        })
        const result = await classifyLockfileFailure('/tmp/test')
        expect(result.category).toBe('MINIMUM_RELEASE_AGE')
    })

    it('MINIMUM_RELEASE_AGE via ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION (frozen verification)', async () => {
        stubExecImplementation(() => {
            throw makeExecError('ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION: 2 lockfile entries failed verification')
        })
        const result = await classifyLockfileFailure('/tmp/test')
        expect(result.category).toBe('MINIMUM_RELEASE_AGE')
    })

    it('UNKNOWN for recognized-prefix-free stderr', async () => {
        stubExecImplementation(() => {
            throw makeExecError('something unexpected happened')
        })
        const result = await classifyLockfileFailure('/tmp/test')
        expect(result.category).toBe('UNKNOWN')
        expect(result.environmental).toBe(false)
    })

    // 环境性失败：无 stderr 诊断（进程被信号杀死 / 静默非零退出）→ ENVIRONMENT_ERROR + 保留信号
    it('ENVIRONMENT_ERROR when stderr is empty (no diagnostics) and records exit code', async () => {
        stubExecImplementation(() => {
            const err = new Error('Command failed: pnpm install --frozen-lockfile') as Error & {
                stderr?: Buffer
                status?: number
            }
            err.stderr = undefined
            err.status = 1
            throw err
        })
        const result = await classifyLockfileFailure('/tmp/test')
        expect(result.ok).toBe(false)
        expect(result.category).toBe('ENVIRONMENT_ERROR')
        expect(result.environmental).toBe(true)
        expect(result.exitCode).toBe(1)
        expect(result.signal).toBeNull()
        expect(result.stderr).toBe('')
    })

    it('ENVIRONMENT_ERROR with signal name when the process is killed', async () => {
        stubExecImplementation(() => {
            const err = new Error('Command failed: pnpm install --frozen-lockfile') as Error & {
                stderr?: Buffer
                signal?: string
            }
            err.stderr = undefined
            err.signal = 'SIGKILL'
            throw err
        })
        const result = await classifyLockfileFailure('/tmp/test')
        expect(result.category).toBe('ENVIRONMENT_ERROR')
        expect(result.environmental).toBe(true)
        expect(result.signal).toBe('SIGKILL')
        expect(result.exitCode).toBeNull()
    })

    it('ENVIRONMENT_ERROR + timedOut when the process is killed by timeout', async () => {
        stubExecImplementation(() => {
            const err = new Error('Command failed: pnpm install --frozen-lockfile') as Error & {
                stderr?: Buffer
                signal?: string
                code?: string
            }
            err.stderr = undefined
            err.signal = 'SIGTERM'
            err.code = 'ETIMEDOUT'
            throw err
        })
        const result = await classifyLockfileFailure('/tmp/test')
        expect(result.environmental).toBe(true)
        expect(result.timedOut).toBe(true)
        expect(result.signal).toBe('SIGTERM')
    })

    // 信号优先于 stderr 分类（进程被杀过程中可能已吐出部分 stderr）
    it('ENVIRONMENT_ERROR (signal wins) when killed but stderr is present', async () => {
        stubExecImplementation(() => {
            const err = makeExecError('ERR_PNPM_OUTDATED_LOCKFILE') as Error & { stderr: Buffer, signal?: string }
            err.signal = 'SIGKILL'
            throw err
        })
        const result = await classifyLockfileFailure('/tmp/test')
        expect(result.category).toBe('ENVIRONMENT_ERROR')
        expect(result.environmental).toBe(true)
        // stderr 仍保留为证据（信号杀死前可能已输出部分诊断）
        expect(result.stderr).toContain('ERR_PNPM_OUTDATED_LOCKFILE')
        expect(result.noDiagnostics).toBe(false)
    })

    // spawn 级失败（工具链缺失）：无退出码 / 信号 / stderr，errno 是唯一定位信息
    it('ENVIRONMENT_ERROR with errno when the binary cannot be spawned', async () => {
        stubExecImplementation(() => {
            const err = new Error('spawn pnpm ENOENT') as Error & { code?: string }
            err.code = 'ENOENT'
            throw err
        })
        const result = await classifyLockfileFailure('/tmp/test')
        expect(result.category).toBe('ENVIRONMENT_ERROR')
        expect(result.environmental).toBe(true)
        expect(result.errno).toBe('ENOENT')
        expect(result.exitCode).toBeNull()
        expect(result.signal).toBeNull()
        expect(result.noDiagnostics).toBe(true)
    })

    it('preserves exit code for a categorized (non-environmental) failure', async () => {
        stubExecImplementation(() => {
            const err = makeExecError('ERR_PNPM_OUTDATED_LOCKFILE') as Error & { stderr: Buffer, status?: number }
            err.status = 1
            throw err
        })
        const result = await classifyLockfileFailure('/tmp/test')
        expect(result.category).toBe('MANIFEST_MISMATCH')
        expect(result.environmental).toBe(false)
        expect(result.exitCode).toBe(1)
    })
})

// ---------------------------------------------------------------------------
// computeLockfileDiff
// ---------------------------------------------------------------------------

describe('computeLockfileDiff', () => {
    it('returns zero diff when lockfiles are identical', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'dependfix-diff-test-'))
        const beforePath = join(dir, 'before.yaml')
        const afterPath = join(dir, 'after.yaml')
        const content = generateLockfileContent(20, 5)
        writeFileSync(beforePath, content)
        writeFileSync(afterPath, content)
        const diff = computeLockfileDiff(beforePath, afterPath)
        expect(diff).toEqual({
            linesChanged: 0,
            packagesChanged: 0,
            summary: 'lockfile unchanged',
        })
        cleanupTemp(dir)
    })

    it('detects line count changes', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'dependfix-diff-test-'))
        const beforePath = join(dir, 'before.yaml')
        const afterPath = join(dir, 'after.yaml')
        writeFileSync(beforePath, generateLockfileContent(20, 5))
        writeFileSync(afterPath, generateLockfileContent(25, 5))
        const diff = computeLockfileDiff(beforePath, afterPath)
        expect(diff.linesChanged).toBe(5)
        expect(diff.summary).toContain('+5 lines')
        cleanupTemp(dir)
    })

    it('detects package count changes', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'dependfix-diff-test-'))
        const beforePath = join(dir, 'before.yaml')
        const afterPath = join(dir, 'after.yaml')
        writeFileSync(beforePath, generateLockfileContent(20, 3))
        writeFileSync(afterPath, generateLockfileContent(20, 8))
        const diff = computeLockfileDiff(beforePath, afterPath)
        expect(diff.packagesChanged).toBe(5)
        expect(diff.summary).toContain('+5 packages')
        cleanupTemp(dir)
    })

    it('handles missing before file', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'dependfix-diff-test-'))
        const beforePath = join(dir, 'nonexistent.yaml')
        const afterPath = join(dir, 'after.yaml')
        writeFileSync(afterPath, generateLockfileContent(10, 2))
        const diff = computeLockfileDiff(beforePath, afterPath)
        // linesChanged = afterLineCount - 0 = afterLineCount
        expect(diff.linesChanged).toBeGreaterThan(0)
        expect(diff.packagesChanged).toBe(2)
        cleanupTemp(dir)
    })
})

// ---------------------------------------------------------------------------
// resolvePnpmVersion
// ---------------------------------------------------------------------------

describe('resolvePnpmVersion', () => {
    it('returns toolchain.pnpmVersion when provided', async () => {
        const proj = createTempProject({ packageManager: 'pnpm@10.5.2' })
        const version = resolvePnpmVersion(proj.dir, { pnpmVersion: '9.0.0' })
        expect(version).toBe('9.0.0')
        cleanupTemp(proj.dir)
    })

    it('falls back to packageManager field', async () => {
        const proj = createTempProject({ packageManager: 'pnpm@10.5.2' })
        const version = resolvePnpmVersion(proj.dir)
        expect(version).toBe('10.5.2')
        cleanupTemp(proj.dir)
    })

    it('returns null when neither source available', async () => {
        const proj = createTempProject()
        const version = resolvePnpmVersion(proj.dir)
        expect(version).toBeNull()
        cleanupTemp(proj.dir)
    })

    it('returns null for invalid packageManager format', async () => {
        const proj = createTempProject({ packageManager: 'yarn@1.22.19' })
        const version = resolvePnpmVersion(proj.dir)
        expect(version).toBeNull()
        cleanupTemp(proj.dir)
    })
})

// ---------------------------------------------------------------------------
// extractLockfileVersion
// ---------------------------------------------------------------------------

describe('extractLockfileVersion', () => {
    it('extracts quoted and unquoted lockfileVersion values', async () => {
        expect(extractLockfileVersion('lockfileVersion: \'9.0\'')).toBe('9.0')
        expect(extractLockfileVersion('lockfileVersion: 6.0')).toBe('6.0')
        expect(extractLockfileVersion('lockfileVersion: "9.0"')).toBe('9.0')
    })

    it('returns null when version is absent', async () => {
        expect(extractLockfileVersion('packages:\n  /a@1: {}')).toBeNull()
        expect(extractLockfileVersion('')).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// repairLockfile
// ---------------------------------------------------------------------------

describe('repairLockfile', () => {
    let proj: TempProject
    let commandSequence: ('success' | { stderr: string } | Error)[]

    /**
     * 设置 execFileSync 按调用次数返回不同结果。
     * 每次调用取 commandSequence.shift()。
     */
    function setupExecSequence(): void {
        stubExecImplementation(() => {
            const action = commandSequence.shift()
            if (!action) {
                return
            }
            if (action === 'success') {
                return
            }
            if (action instanceof Error) {
                throw action
            }
            throw makeExecError(action.stderr)
        })
    }

    /** 典型修复流程需要的 commandSequence（按调用顺序）:
     *  1. frozen-lockfile 诊断（应失败）
     *  2. 策略命令（应成功）
     *  3. frozen-lockfile 验证（应成功）
     */
    function setupFixableScenario(diagnosisStderr: string): void {
        commandSequence = [
            { stderr: diagnosisStderr }, // diagnosis fails
            'success', // strategy command succeeds
            'success', // verify succeeds
        ]
        setupExecSequence()
    }

    beforeEach(() => {
        proj = createTempProject({ withLockfile: true, packageManager: 'pnpm@10.5.2' })
    })

    afterEach(() => {
        cleanupTemp(proj.dir)
    })

    it('returns success when frozen-lockfile already passes', async () => {
        commandSequence = ['success']
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir })
        expect(result.success).toBe(true)
        expect(result.strategy).toBeUndefined()
        expect(result.diff).toBeNull()
        expect(result.changed).toBe(false)
        expect(result.attemptHistory).toHaveLength(0)
    })

    // 诊断 / 策略 / frozen 校验三类调用共用同一安装超时口径（旧实现为 120s / 180s / 120s 三份硬编码）
    it('applies the same install timeout to diagnosis, strategy and frozen verification', async () => {
        setupFixableScenario('ERR_PNPM_OUTDATED_LOCKFILE')

        await repairLockfile({ workDir: proj.dir })

        const timeouts = mockRunTrackedCommand.mock.calls.map((call) => (call[0] as { timeoutMs: number }).timeoutMs)
        expect(timeouts).toEqual([DEFAULT_INSTALL_TIMEOUT_MS, DEFAULT_INSTALL_TIMEOUT_MS, DEFAULT_INSTALL_TIMEOUT_MS])
    })

    it('skips the repair chain entirely when the run was cancelled (ABORTED)', async () => {
        requestAbort('execution timeout')
        try {
            const result = await repairLockfile({ workDir: proj.dir })

            expect(result.success).toBe(false)
            expect(result.failureCategory).toBe('ABORTED')
            expect(result.strategy).toBe('SKIP')
            expect(result.attemptHistory).toHaveLength(0)
            // 未启动任何安装命令（取消态不做备份 / 诊断 / 策略）
            expect(mockRunTrackedCommand).not.toHaveBeenCalled()
            // lockfile 备份未残留
            expect(existsSync(`${proj.lockfilePath}.bak`)).toBe(false)
        } finally {
            resetProcessControlState()
        }
    })

    it('LOCKFILE_NOT_FOUND → REGENERATE succeeds', async () => {
        setupFixableScenario('Cannot find pnpm-lock.yaml')
        const result = await repairLockfile({ workDir: proj.dir })
        expect(result.success).toBe(true)
        expect(result.strategy).toBe('REGENERATE')
        expect(result.diff?.summary).toBeDefined()
        expect(result.attemptHistory).toHaveLength(1)
        expect(result.attemptHistory[0].strategy).toBe('REGENERATE')
        expect(result.attemptHistory[0].success).toBe(true)
    })

    it('MANIFEST_MISMATCH → REGENERATE succeeds', async () => {
        setupFixableScenario('ERR_PNPM_OUTDATED_LOCKFILE')
        const result = await repairLockfile({ workDir: proj.dir })
        expect(result.success).toBe(true)
        expect(result.strategy).toBe('REGENERATE')
    })

    it('CORRUPTED_LOCKFILE → FIX_ENTRIES succeeds', async () => {
        setupFixableScenario('ERR_PNPM_BROKEN_LOCKFILE: broken lockfile')
        const result = await repairLockfile({ workDir: proj.dir })
        expect(result.success).toBe(true)
        expect(result.strategy).toBe('FIX_ENTRIES')
    })

    it('CREDENTIAL_ERROR → SKIP, no repair attempted', async () => {
        commandSequence = [{ stderr: 'E401 authentication failed' }]
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir })
        expect(result.success).toBe(false)
        expect(result.strategy).toBe('SKIP')
        expect(result.failureCategory).toBe('CREDENTIAL_ERROR')
        expect(result.attemptHistory).toHaveLength(0)
    })

    it('REGENERATE fails → escalates to REINSTALL', async () => {
        commandSequence = [
            { stderr: 'ERR_PNPM_OUTDATED_LOCKFILE' }, // diagnosis fails
            makeExecError('REGENERATE failed'), // REGENERATE fails
            'success', // REINSTALL succeeds
            'success', // verify succeeds
        ]
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir })
        expect(result.success).toBe(true)
        expect(result.strategy).toBe('REINSTALL')
        expect(result.attemptHistory).toHaveLength(2)
        expect(result.attemptHistory[0].strategy).toBe('REGENERATE')
        expect(result.attemptHistory[0].success).toBe(false)
        expect(result.attemptHistory[1].strategy).toBe('REINSTALL')
        expect(result.attemptHistory[1].success).toBe(true)
    })

    it('all strategies fail → rollback, returns failure', async () => {
        commandSequence = [
            { stderr: 'ERR_PNPM_OUTDATED_LOCKFILE' },
            makeExecError('REGENERATE fail'),
            makeExecError('REINSTALL fail'),
        ]
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir })
        expect(result.success).toBe(false)
        expect(result.failureCategory).toBe('MANIFEST_MISMATCH')
        // attemptHistory should include the failed strategies + rollback SKIP
        expect(result.attemptHistory.length).toBeGreaterThanOrEqual(2)
    })

    it('strategy command succeeds but verify fails → escalate', async () => {
        commandSequence = [
            { stderr: 'ERR_PNPM_OUTDATED_LOCKFILE' },
            'success', // REGENERATE succeeds
            makeExecError('ERR_PNPM_OUTDATED_LOCKFILE'), // verify fails (same error)
            'success', // REINSTALL succeeds
            'success', // verify succeeds
        ]
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir })
        expect(result.success).toBe(true)
        expect(result.strategy).toBe('REINSTALL')
    })

    it('records attemptHistory with duration and errors', async () => {
        commandSequence = [
            { stderr: 'ERR_PNPM_OUTDATED_LOCKFILE' },
            makeExecError('REGENERATE error details'),
            'success',
            'success',
        ]
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir })
        expect(result.attemptHistory[0]).toMatchObject({
            strategy: 'REGENERATE',
            success: false,
            command: 'pnpm install --lockfile-only',
            error: expect.stringContaining('REGENERATE') as unknown,
        })
        expect(result.attemptHistory[0].durationMs).toBeGreaterThanOrEqual(0)
    })

    it('LOCKFILE_VERSION_MISMATCH includes PIN_TOOLCHAIN in chain', async () => {
        // PIN_TOOLCHAIN first (fails) → REGENERATE succeeds
        commandSequence = [
            { stderr: 'lockfile had been generated with pnpm v7' },
            makeExecError('corepack not found'), // PIN_TOOLCHAIN fails
            'success', // REGENERATE succeeds
            'success', // verify succeeds
        ]
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir })
        expect(result.success).toBe(true)
        expect(result.strategy).toBe('REGENERATE')
        expect(result.attemptHistory[0].strategy).toBe('PIN_TOOLCHAIN')
    })

    it('RESOLVE_ERROR → REGENERATE then FIX_ENTRIES then REINSTALL', async () => {
        // Chain: REGENERATE → FIX_ENTRIES → REINSTALL
        commandSequence = [
            { stderr: 'ERR_PNPM_NO_MATCHING_VERSION No matching version found' },
            makeExecError('REGENERATE fail'),
            'success', // FIX_ENTRIES succeeds
            'success', // verify succeeds
        ]
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir })
        expect(result.success).toBe(true)
        expect(result.strategy).toBe('FIX_ENTRIES')
    })

    it('UNKNOWN → REGENERATE then REINSTALL', async () => {
        commandSequence = [
            { stderr: 'completely unexpected error XYZ' },
            'success', // REGENERATE succeeds
            'success', // verify succeeds
        ]
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir })
        expect(result.success).toBe(true)
        expect(result.strategy).toBe('REGENERATE')
    })

    it('MINIMUM_RELEASE_AGE: all strategies fail → rollback with readable hint', async () => {
        // 诊断失败（frozen 校验被冷却期阻止）→ REGENERATE/REINSTALL 重新解析仍选到太新版本 → 全失败回滚
        commandSequence = [
            { stderr: 'ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION: 2 lockfile entries failed verification' },
            makeExecError('ERR_PNPM_NO_MATURE_MATCHING_VERSION: still too fresh'), // REGENERATE fails
            makeExecError('ERR_PNPM_NO_MATURE_MATCHING_VERSION: still too fresh'), // REINSTALL fails
        ]
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir })
        expect(result.success).toBe(false)
        expect(result.failureCategory).toBe('MINIMUM_RELEASE_AGE')
        expect(result.failureDetail).toContain('minimumReleaseAge policy')
        expect(result.attemptHistory.length).toBeGreaterThanOrEqual(2)
    })

    it('uses corepack with pinned pnpm version for PIN_TOOLCHAIN', async () => {
        // LOCKFILE_VERSION_MISMATCH → PIN_TOOLCHAIN 用 toolchain 版本 + corepack；验证通过
        commandSequence = [
            { stderr: 'lockfile had been generated with pnpm v7' },
            'success', // corepack pnpm@10.5.2 install --lockfile-only succeeds
            'success', // verify succeeds
        ]
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir, toolchain: { pnpmVersion: '10.5.2' } })

        expect(result.success).toBe(true)
        expect(result.strategy).toBe('PIN_TOOLCHAIN')
        expect(result.attemptHistory[0].command).toBe('corepack pnpm@10.5.2 install --lockfile-only')
        // 修复后 lockfile 版本被记录（格式漂移检测基线）
        expect(result.lockfileVersion).toBe('9.0')
        expect(result.lockfileVersionChanged).toBe(false)
    })

    it('PIN_TOOLCHAIN falls back to bare command when pnpm version is unavailable', async () => {
        // 无 toolchain 且 package.json 无 packageManager → PIN_TOOLCHAIN 用裸命令（旧 stub 语义）
        proj = createTempProject({ withLockfile: true }) // 无 packageManager
        commandSequence = [
            { stderr: 'lockfile had been generated with pnpm v7' },
            'success',
            'success',
        ]
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir })

        expect(result.strategy).toBe('PIN_TOOLCHAIN')
        expect(result.attemptHistory[0].command).toBe('pnpm install --lockfile-only')
    })

    it('corepack failure degrades to REGENERATE (behavior no worse than before)', async () => {
        // PIN_TOOLCHAIN（corepack 不可用）失败 → REGENERATE 兜底成功
        commandSequence = [
            { stderr: 'lockfile had been generated with pnpm v7' },
            makeExecError('corepack not found or invalid'), // PIN_TOOLCHAIN fails
            'success', // REGENERATE succeeds
            'success', // verify succeeds
        ]
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir, toolchain: { pnpmVersion: '10.5.2' } })

        expect(result.success).toBe(true)
        expect(result.strategy).toBe('REGENERATE')
        expect(result.attemptHistory[0].command).toBe('corepack pnpm@10.5.2 install --lockfile-only')
        expect(result.attemptHistory[1].command).toBe('pnpm install --lockfile-only')
    })

    it('records lockfileVersion after successful repair (drift detection baseline)', async () => {
        commandSequence = [
            { stderr: 'lockfile had been generated with pnpm v7' },
            'success',
            'success', // verify
        ]
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir })

        expect(result.success).toBe(true)
        expect(result.lockfileVersion).toBe('9.0')
        // 测试 mock 不写文件 → before/after 相同 → 无漂移；字段存在（undefined → false 语义）
        expect(result.lockfileVersionChanged).toBe(false)
    })

    it('uses packageManager-resolved pnpm version for PIN_TOOLCHAIN without explicit toolchain', async () => {
        // beforeEach 的 proj 有 packageManager: 'pnpm@10.5.2' → resolvePnpmVersion 激活（原死代码）
        commandSequence = [
            { stderr: 'lockfile had been generated with pnpm v7' },
            'success', // corepack pnpm@10.5.2 install --lockfile-only succeeds
            'success', // verify succeeds
        ]
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir })

        expect(result.success).toBe(true)
        expect(result.strategy).toBe('PIN_TOOLCHAIN')
        expect(result.attemptHistory[0].command).toBe('corepack pnpm@10.5.2 install --lockfile-only')
    })

    it('rejects unsafe pnpm versions (command injection guard)', async () => {
        // packageManager 注入构造（不可信仓库输入）→ 解析为 null → PIN_TOOLCHAIN 裸命令兜底
        proj = createTempProject({ packageManager: 'pnpm@1; touch /tmp/pwned' })
        commandSequence = [
            { stderr: 'lockfile had been generated with pnpm v7' },
            'success',
            'success',
        ]
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir })

        expect(result.attemptHistory[0].command).toBe('pnpm install --lockfile-only')
        expect(result.attemptHistory[0].command).not.toContain('touch')
    })

    it('rejects newline-injected pnpm versions (regex is fully anchored)', async () => {
        // 内嵌换行（trim 只剥首尾）→ 全串锚点 ^$ 失配 → 拒绝
        proj = createTempProject({ packageManager: 'pnpm@10.5.2\n; touch /tmp/pwned' })
        commandSequence = [
            { stderr: 'lockfile had been generated with pnpm v7' },
            'success',
            'success',
        ]
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir })

        expect(result.attemptHistory[0].command).toBe('pnpm install --lockfile-only')
        expect(result.attemptHistory[0].command).not.toContain('touch')
    })

    it('accepts corepack sha512 hash suffix in pnpm version', async () => {
        proj = createTempProject({ packageManager: 'pnpm@10.5.2+sha512.1f2a3b4c' })
        commandSequence = [
            { stderr: 'lockfile had been generated with pnpm v7' },
            'success',
            'success',
        ]
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir })

        expect(result.attemptHistory[0].command).toBe('corepack pnpm@10.5.2+sha512.1f2a3b4c install --lockfile-only')
    })

    it('accepts toolchain param when lockfile already passes', async () => {
        commandSequence = ['success']
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir, toolchain: { pnpmVersion: '9.0.0' } })
        expect(result.success).toBe(true)
    })

    it('diff is null when no repair needed', async () => {
        commandSequence = ['success']
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir })
        expect(result.diff).toBeNull()
    })

    it('failureDetail is truncated when very long (CREDENTIAL_ERROR)', async () => {
        const longStderr = `E401 ${'X'.repeat(600)}`
        commandSequence = [{ stderr: longStderr }]
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir })
        expect(result.failureCategory).toBe('CREDENTIAL_ERROR')
        // failureDetail should be ≤ prefix + truncate(500) + "…"
        expect(result.failureDetail!.length).toBeLessThanOrEqual(550)
        expect(result.failureDetail).toContain('\u2026')
    })

    // -----------------------------------------------------------------------
    // 环境性安装失败（无 stderr 诊断）——可观测性 + 非归因标记
    // -----------------------------------------------------------------------

    it('marks environmental when the diagnosis dies without stderr', async () => {
        commandSequence = [
            Object.assign(new Error('Command failed: pnpm install --frozen-lockfile'), { status: 1 }), // 诊断：无 stderr
            new Error('Command failed: pnpm install --lockfile-only'), // REGENERATE 失败
            new Error('Command failed: pnpm install --no-frozen-lockfile'), // REINSTALL 失败
        ]
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir })

        expect(result.success).toBe(false)
        expect(result.environmental).toBe(true)
        expect(result.failureCategory).toBe('ENVIRONMENT_ERROR')
        // 不再只看到裸 `Command failed: …` —— 失败详情显式说明无诊断 + 进程信号
        expect(result.failureDetail).toContain('environmental install failure')
        expect(result.failureDetail).toContain('exit code 1')
        expect(result.failureDetail).toContain('no stderr/stdout diagnostics')
    })

    it('reports signal + timeout in the environmental failure detail', async () => {
        const killedWithTimeout = Object.assign(new Error('Command failed: pnpm install --frozen-lockfile'), {
            signal: 'SIGTERM',
            code: 'ETIMEDOUT',
        })
        commandSequence = [killedWithTimeout, killedWithTimeout, killedWithTimeout]
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir })

        expect(result.environmental).toBe(true)
        expect(result.failureDetail).toContain('signal SIGTERM')
        expect(result.failureDetail).toContain('timed out')
    })

    it('keeps stderr as evidence when the process is killed mid-way', async () => {
        const killedWithStderr = Object.assign(
            makeExecError('ERR_PNPM_BROKEN_LOCKFILE: partial output'),
            { signal: 'SIGKILL' },
        )
        commandSequence = [killedWithStderr, killedWithStderr, killedWithStderr]
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir })

        expect(result.environmental).toBe(true)
        expect(result.failureDetail).toContain('signal SIGKILL')
        // stderr 作为证据保留（不再无条件声称「无诊断」）
        expect(result.failureDetail).toContain('diagnostics: ERR_PNPM_BROKEN_LOCKFILE')
        expect(result.failureDetail).not.toContain('no stderr/stdout diagnostics')
    })

    it('reports spawn errno when the binary is missing and no stderr is produced', async () => {
        const spawnError = Object.assign(new Error('spawn pnpm ENOENT'), { code: 'ENOENT' })
        commandSequence = [spawnError, spawnError, spawnError]
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir })

        expect(result.environmental).toBe(true)
        expect(result.failureDetail).toContain('spawn error ENOENT')
        expect(result.failureDetail).toContain('no stderr/stdout diagnostics')
    })

    it('records exit code / signal on failed strategy attempts', async () => {
        const diagError = makeExecError('ERR_PNPM_OUTDATED_LOCKFILE')
        const killed = Object.assign(new Error('Command failed: pnpm install --lockfile-only'), {
            signal: 'SIGKILL',
            status: undefined,
        })
        commandSequence = [diagError, killed, killed]
        setupExecSequence()
        const result = await repairLockfile({ workDir: proj.dir })

        expect(result.success).toBe(false)
        // 非环境性（诊断有可分类 stderr）→ 不带 environmental 标记
        expect(result.environmental).toBeUndefined()
        // 策略尝试仍保留进程级信号（AC ① 可观测性）
        expect(result.attemptHistory[0].strategy).toBe('REGENERATE')
        expect(result.attemptHistory[0].signal).toBe('SIGKILL')
        expect(result.attemptHistory[0].exitCode).toBeNull()
    })
})

