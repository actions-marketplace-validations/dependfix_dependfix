// process-signals.test.ts — 受管执行结果 → 同步执行同形错误的适配（`toExecLikeError`）。
//
// 覆盖接缝：`process-control` 侧（spawn → 结果）由该模块自身用例以真实进程覆盖；
// 结果 → 分类（`classifyLockfileFailure` 等）由 fixers 用例覆盖；**本文件守中间那一跳**——
// 生产正向映射若漂移（不再置 `code='ETIMEDOUT'` / 不再回填 stderr / 不再标识中止），
// 下游 `extractProcessSignals` / `describeInstallError` 的读取口径会静默改变。
import { describe, expect, it } from 'vitest'
import { isEnvironmentalInstallError, toExecLikeError, type CommandOutcomeLike } from './process-signals'
import { describeInstallError } from './dependency/overrides-io'

/** 构造受管执行结果（缺省成功形态）。 */
function outcome(overrides: Partial<CommandOutcomeLike> = {}): CommandOutcomeLike {
    return {
        exitCode: 0,
        signal: null,
        timedOut: false,
        errno: null,
        stdout: '',
        stderr: '',
        ...overrides,
    }
}

describe('toExecLikeError', () => {
    it('非零退出：把退出码与 stderr 回填为同步执行形态', () => {
        const err = toExecLikeError('pnpm install --no-frozen-lockfile', outcome({
            exitCode: 1,
            stderr: 'ERR_PNPM_OUTDATED_LOCKFILE: out of sync',
        }))

        expect(err.status).toBe(1)
        expect(err.signal).toBeUndefined()
        expect(err.code).toBeUndefined()
        expect(err.stderr).toBe('ERR_PNPM_OUTDATED_LOCKFILE: out of sync')
        expect(err.message).toBe('Command failed: pnpm install --no-frozen-lockfile')
    })

    it('超时：置 code=ETIMEDOUT（下游据此判定 timedOut）', () => {
        const err = toExecLikeError('pnpm install --frozen-lockfile', outcome({
            exitCode: null,
            signal: 'SIGTERM',
            timedOut: true,
        }))

        expect(err.code).toBe('ETIMEDOUT')
        expect(err.signal).toBe('SIGTERM')
        expect(err.status).toBeUndefined()
        expect(describeInstallError(err)).toBe('signal SIGTERM, timed out: spawnSync pnpm install --frozen-lockfile ETIMEDOUT')
    })

    it('运行级取消：证据文本显式标识中止（与内核 OOM 杀死同形信号区分开）', () => {
        const err = toExecLikeError('pnpm install --no-frozen-lockfile', outcome({
            exitCode: null,
            signal: 'SIGKILL',
            aborted: true,
        }))

        expect(err.message).toContain('run aborted — command terminated by cancellation')
        expect(err.aborted).toBe(true)
        expect(describeInstallError(err)).toContain('run aborted — command terminated by cancellation')
        // 中止是独立类别，不得判为「不归因目标仓库」的环境性失败
        expect(isEnvironmentalInstallError(err)).toBe(false)
    })

    it('超时未能确认退出：证据文本显式标注 termination unconfirmed', () => {
        const err = toExecLikeError('pnpm install', outcome({
            exitCode: null,
            signal: 'SIGKILL',
            timedOut: true,
            terminationUnconfirmed: true,
        }))

        expect(err.terminationUnconfirmed).toBe(true)
        expect(describeInstallError(err)).toContain('termination unconfirmed')
    })

    it('工具链缺失：errno 进 code（spawn 失败无退出码）', () => {
        const err = toExecLikeError('pnpm install', outcome({
            exitCode: null,
            errno: 'ENOENT',
        }))

        expect(err.code).toBe('ENOENT')
        expect(describeInstallError(err)).toBe('spawn error ENOENT: spawn pnpm install ENOENT')
    })

    it('stderr 为空且无信号：退化为纯命令失败文案（不留空尾）', () => {
        const err = toExecLikeError('pnpm install', outcome({ exitCode: 2 }))

        expect(err.stderr).toBeUndefined()
        expect(describeInstallError(err)).toBe('exit code 2: Command failed: pnpm install')
    })

    it('stdout 回填：安装脚本错误只写 stdout 时仍保留证据', () => {
        const err = toExecLikeError('pnpm install', outcome({
            exitCode: 1,
            stdout: 'prebuild-install warn install Request timed out\ngyp ERR! find Python',
        }))

        expect(err.stdout).toContain('gyp ERR! find Python')
        expect(describeInstallError(err)).toContain('gyp ERR! find Python')
        expect(describeInstallError(err)).not.toContain('no error detail')
    })

    it('安装诊断与验证链共用脱敏规则（凭据不进入报告）', () => {
        const err = toExecLikeError('pnpm install', outcome({
            exitCode: 1,
            stdout: 'NPM_TOKEN=secret-token\n'
                + 'fetch https://x-access-token:ghp_abcdef@github.com/foo/bar',
        }))

        const described = describeInstallError(err)

        expect(described).not.toContain('secret-token')
        expect(described).not.toContain('ghp_abcdef')
    })
})
