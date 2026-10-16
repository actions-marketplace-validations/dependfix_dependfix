/**
 * 进程级失败信号抽取（`execSync` / `execFileSync` 抛出错误的统一读取口径）。
 *
 * 单一事实源：lockfile 修复链与依赖升级链都要从同一形态的错误里判定「环境性失败」并把证据
 * 写进失败详情；两处各持一份实现时口径会漂移——曾出现「stderr 为空即丢失 `err.message`，
 * 日志只剩 `pnpm install failed: `」的取证缺口（超时 / 被信号杀死时 pnpm 的进度写在 stdout，
 * stderr 为空是常态，此时 `err.message` 里的 `spawnSync … ETIMEDOUT` 是唯一证据）。
 *
 * 本模块只做读取与渲染，无副作用；读者为 `fixers/pnpm`（lockfile 修复）与
 * `fixers/dependency`（依赖升级）。
 */

/** `execSync` / `execFileSync` 抛出错误的最小结构（只取诊断所需字段）。 */
export interface ExecError extends Error {
    stderr?: Buffer | string
    stdout?: Buffer | string
    status?: number
    /** 终止进程的信号（被 kill / 超时终止时设置） */
    signal?: string
    /** Node 错误码（超时时为 `ETIMEDOUT`；spawn 失败时为 `ENOENT` 等） */
    code?: string
}

/** 进程级信号：退出码 / 信号 / 超时标记 / spawn errno。 */
export interface ProcessSignals {
    exitCode: number | null
    signal: string | null
    timedOut: boolean
    errno: string | null
}

/** 读取原始 stderr 文本（不含 `err.message` 回退）；无 stderr 时返回空串。 */
export function getRawStderrText(err: ExecError): string {
    if (!err.stderr) {
        return ''
    }
    return typeof err.stderr === 'string' ? err.stderr : err.stderr.toString('utf-8')
}

/** 读取 stderr 文本（无 stderr 时回退 `err.message`，保持既有展示口径）。 */
export function getStderrText(err: ExecError): string {
    return getRawStderrText(err) || ((err as Error).message ?? '')
}

/** 从 `execFileSync` 抛出的错误中提取进程级信号（退出码 / 信号 / 超时标记 / spawn errno）。 */
export function extractProcessSignals(err: ExecError): ProcessSignals {
    return {
        exitCode: typeof err.status === 'number' ? err.status : null,
        signal: typeof err.signal === 'string' ? err.signal : null,
        // execFileSync 超时：以 killSignal（默认 SIGTERM）终止进程并置 code='ETIMEDOUT'
        timedOut: err.code === 'ETIMEDOUT',
        // spawn 级 errno（ENOENT 等；超时的 ETIMEDOUT 已由 timedOut 表达，此处避免重复）
        errno: typeof err.code === 'string' && err.code !== 'ETIMEDOUT' ? err.code : null,
    }
}

/** 渲染进程级信号的简短描述（用于失败详情）；无可用信号时返回空串。 */
export function describeProcessSignals(signals: ProcessSignals): string {
    const parts: string[] = []
    if (signals.signal !== null) {
        parts.push(`signal ${signals.signal}`)
    } else if (signals.exitCode !== null) {
        parts.push(`exit code ${signals.exitCode}`)
    } else if (signals.errno !== null) {
        // spawn 失败（如工具链缺失）：无退出码 / 信号，errno 是唯一定位信息
        parts.push(`spawn error ${signals.errno}`)
    }
    if (signals.timedOut) {
        parts.push('timed out')
    }
    return parts.join(', ')
}

/**
 * 受管命令执行结果的最小结构（与 `runners/process-control.ts` 的 `TrackedCommandResult`
 * 结构兼容；此处以结构类型声明，避免 fixers → runners 的模块方向耦合）。
 */
export interface CommandOutcomeLike {
    exitCode: number | null
    signal: string | null
    timedOut: boolean
    errno: string | null
    stdout: string
    stderr: string
}

/**
 * 把受管命令（异步 `spawn`）的结果适配为既有 `execSync` / `execFileSync` 形态的错误对象。
 *
 * 目的：安装类调用从同步 `execFileSync` 迁到 `runTrackedCommand` 后，
 * `extractProcessSignals` / `getRawStderrText` / `describeInstallError` 的读取口径**零漂移**
 * ——`status` / `signal` / `code` / `stderr` 字段与 Node 抛出的形态一致（`status` 仅在有退出码时
 * 设置，`code` 在超时时为 `ETIMEDOUT`、spawn 失败时为 `errno`）。
 */
export function toExecLikeError(command: string, outcome: CommandOutcomeLike): ExecError {
    let message = `Command failed: ${command}`
    if (outcome.timedOut) {
        message = `spawnSync ${command} ETIMEDOUT`
    } else if (outcome.errno) {
        message = `spawn ${command} ${outcome.errno}`
    }
    const err = new Error(message) as ExecError
    if (outcome.stderr) {
        err.stderr = outcome.stderr
    }
    if (outcome.exitCode !== null) {
        err.status = outcome.exitCode
    }
    if (outcome.signal !== null) {
        err.signal = outcome.signal
    }
    if (outcome.timedOut) {
        err.code = 'ETIMEDOUT'
    } else if (outcome.errno !== null) {
        err.code = outcome.errno
    }
    return err
}
