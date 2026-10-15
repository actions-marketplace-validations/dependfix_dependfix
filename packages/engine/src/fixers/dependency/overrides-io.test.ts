// overrides-io.test.ts — 依赖升级链的安装失败取证（`describeInstallError`）与既有格式化口径。
// 覆盖 2026-10-16 生产复盘暴露的缺口：stderr 为空（超时 / 被信号杀死）时失败文本被清空，
// 日志与报告里只剩 `pnpm install failed: `，无法区分「超时 / 被杀 / 装不动」。
import { describe, expect, it } from 'vitest'
import { classifyInstallFailure, describeInstallError, formatInstallFailure } from './overrides-io'

/** 构造 `execSync` / `execFileSync` 形态的错误（`stderr` 为 Buffer，与 Node 实际抛出一致）。 */
function makeExecError(options: {
    message?: string
    stderr?: string
    signal?: string
    status?: number
    code?: string
}): Error {
    return Object.assign(new Error(options.message ?? 'Command failed: pnpm install --no-frozen-lockfile'), {
        stderr: Buffer.from(options.stderr ?? '', 'utf-8'),
        ...(options.signal !== undefined ? { signal: options.signal } : {}),
        ...(options.status !== undefined ? { status: options.status } : {}),
        ...(options.code !== undefined ? { code: options.code } : {}),
    })
}

describe('describeInstallError', () => {
    it('keeps the process signal and err.message when stderr is empty (timeout)', () => {
        // 超时形态：Node 抛 `spawnSync … ETIMEDOUT` 且 stderr 为空（pnpm 进度写 stdout）
        const err = makeExecError({
            message: 'spawnSync /bin/sh ETIMEDOUT',
            signal: 'SIGTERM',
            code: 'ETIMEDOUT',
        })

        expect(describeInstallError(err)).toBe('signal SIGTERM, timed out: spawnSync /bin/sh ETIMEDOUT')
    })

    it('keeps the signal when the install is killed (SIGKILL)', () => {
        const err = makeExecError({
            message: 'Command failed: pnpm install --no-frozen-lockfile',
            signal: 'SIGKILL',
        })

        expect(describeInstallError(err)).toBe('signal SIGKILL: Command failed: pnpm install --no-frozen-lockfile')
    })

    it('prefers stderr as evidence when present', () => {
        const err = makeExecError({ stderr: 'ERR_PNPM_OUTDATED_LOCKFILE: lockfile out of sync', status: 1 })

        expect(describeInstallError(err)).toBe('exit code 1: ERR_PNPM_OUTDATED_LOCKFILE: lockfile out of sync')
    })

    it('renders spawn errno when the toolchain is missing', () => {
        const err = makeExecError({ message: 'spawn pnpm ENOENT', code: 'ENOENT' })

        expect(describeInstallError(err)).toBe('spawn error ENOENT: spawn pnpm ENOENT')
    })

    it('falls back to a placeholder instead of an empty detail', () => {
        // 消息与 stderr 均为空：不能把冒号后的内容留空（否则读者无法判断是「无诊断」还是被截断）
        expect(describeInstallError(new Error(''))).toBe('no error detail')
    })

    it('renders non-Error throwables', () => {
        expect(describeInstallError('boom')).toBe('boom')
    })

    it('composes with formatInstallFailure (log / report text carries the evidence)', () => {
        const err = makeExecError({
            message: 'spawnSync /bin/sh ETIMEDOUT',
            signal: 'SIGTERM',
            code: 'ETIMEDOUT',
        })

        expect(formatInstallFailure(describeInstallError(err)))
            .toBe('pnpm install failed: signal SIGTERM, timed out: spawnSync /bin/sh ETIMEDOUT')
    })

    it('keeps the minimumReleaseAge hint alongside the process signal', () => {
        const err = makeExecError({
            stderr: 'ERR_PNPM_NO_MATURE_MATCHING_VERSION: no mature version for undici',
            status: 1,
        })
        const described = describeInstallError(err)

        expect(described).toContain('exit code 1')
        expect(classifyInstallFailure(described)).toContain('minimumReleaseAge')
    })
})
