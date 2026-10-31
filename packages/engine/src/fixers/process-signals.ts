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

import { sanitizeOutput } from '../runners/output-sanitizer'

/** `execSync` / `execFileSync` 抛出错误的最小结构（只取诊断所需字段）。 */
export interface ExecError extends Error {
    stderr?: Buffer | string
    stdout?: Buffer | string
    status?: number
    /** 终止进程的信号（被 kill / 超时终止时设置） */
    signal?: string
    /** Node 错误码（超时时为 `ETIMEDOUT`；spawn 失败时为 `ENOENT` 等） */
    code?: string
    /** 是否为运行级取消导致的终止（优先级高于信号 / 超时的环境性判定） */
    aborted?: boolean
    /** 超时兜底落定时是否未能确认直接子进程已退出 */
    terminationUnconfirmed?: boolean
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

/** 读取原始 stdout 文本；无 stdout 时返回空串。 */
export function getRawStdoutText(err: ExecError): string {
    if (!err.stdout) {
        return ''
    }
    return typeof err.stdout === 'string' ? err.stdout : err.stdout.toString('utf-8')
}

/** 安装失败诊断的展示上限：保留头尾，避免大输出把报告 / 日志撑爆。 */
const INSTALL_DIAGNOSTIC_MAX_CHARS = 4_000

/** 头尾摘要（错误常在输出尾部，进度常在头部；两端都保留）。 */
function summarizeInstallDiagnostics(text: string): string {
    const trimmed = text.trim()
    if (trimmed.length <= INSTALL_DIAGNOSTIC_MAX_CHARS) {
        return trimmed
    }
    const head = trimmed.slice(0, 2_000).trimEnd()
    const tail = trimmed.slice(-1_800).trimStart()
    return `${head}\n... (${trimmed.length - head.length - tail.length} chars omitted) ...\n${tail}`
}

/**
 * 组装安装命令的诊断文本：stderr 与 stdout **都**读取，缺失时回退 `err.message`。
 *
 * 背景：`prebuild-install` 下载预编译包超时、`node-gyp` 找不到 Python 等失败时，
 * pnpm 把子脚本输出写到 stdout，stderr 为空。旧实现只读 stderr，导致失败证据只剩
 * `Command failed: pnpm install …`，无法定位「缺构建工具链 / 预编译包下载失败」。
 *
 * 两路都有内容时按 stderr → stdout 标注来源；只有一路时保持原有纯文本形态（不破坏
 * 既有日志断言与报告列宽度）。
 */
export function getInstallDiagnostics(err: ExecError): string {
    // 先脱敏后截断：避免凭据恰落在截断边界时残留半段
    const stderr = summarizeInstallDiagnostics(sanitizeOutput(getRawStderrText(err)))
    const stdout = summarizeInstallDiagnostics(sanitizeOutput(getRawStdoutText(err)))
    return stderr && stdout
        ? `stderr:\n${stderr}\n--- stdout ---\n${stdout}`
        : stderr || stdout || sanitizeOutput(((err as Error).message ?? '').trim()) || 'no error detail'
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

/**
 * 安装失败是否属于环境性问题（**单一判据**：lockfile 诊断链与依赖升级链共用）。
 *
 * 判定顺序：
 * 1. 运行级取消（`aborted`）→ false：中止是独立类别（`ABORTED`），不得伪装成
 *    「不归因目标仓库」的环境性失败。
 * 2. 信号终止 / 超时 → true：进程可能已吐出部分输出，但被杀死 / 超时本身说明执行环境异常，
 *    不足以把失败归因目标仓库。
 * 3. 有 stderr 诊断 → false：`ERR_PNPM_*` / 解析失败等可读失败归因目标仓库。
 * 4. stderr 为空 → true（静默非零退出）。
 *
 * 归因只看 stderr，**不看 stdout**：pnpm 11 把安装脚本错误（`gyp ERR!` / `prebuild-install`）
 * 写到 stdout，那类原生构建失败仍按环境性处理（stdout 作为证据保留，口径见
 * docs/design/modules/pnpm-lockfile-fixer.md §2.4）。
 */
export function isEnvironmentalInstallError(err: ExecError): boolean {
    if (err.aborted === true) {
        return false
    }
    const signals = extractProcessSignals(err)
    if (signals.signal !== null || signals.timedOut) {
        return true
    }
    return getRawStderrText(err).trim().length === 0
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
 * 结构兼容）。类型以结构声明避免引入 runner 的运行时装配；脱敏复用纯函数模块
 * `runners/output-sanitizer`，不加载 network-audit / registry-discovery。
 */
export interface CommandOutcomeLike {
    exitCode: number | null
    signal: string | null
    timedOut: boolean
    /** 执行期间是否处于"已请求取消"状态（用于把中止与普通信号终止区分开） */
    aborted?: boolean
    /** 超时兜底落定时是否未能确认直接子进程已退出 */
    terminationUnconfirmed?: boolean
    errno: string | null
    stdout: string
    stderr: string
}

/**
 * 把受管命令（异步 `spawn`）的结果适配为既有 `execSync` / `execFileSync` 形态的错误对象。
 *
 * 目的：安装类调用从同步 `execFileSync` 迁到 `runTrackedCommand` 后，
 * `extractProcessSignals` / `getRawStderrText` / `getRawStdoutText` / `describeInstallError`
 * 的读取口径**零漂移**——`status` / `signal` / `code` / `stderr` / `stdout` 字段与 Node 抛出的
 * 形态一致（`status` 仅在有退出码时设置，`code` 在超时时为 `ETIMEDOUT`、spawn 失败时为 `errno`）。
 */
export function toExecLikeError(command: string, outcome: CommandOutcomeLike): ExecError {
    let message = `Command failed: ${command}`
    // 运行级取消导致的终止与「被内核杀死 / 环境异常」外观同形（都是 signal），故显式前置取消标识——
    // 否则证据文本会把「本次运行被中止」读成目标仓库 / 环境问题（与独立类别上报口径同源）
    if (outcome.aborted) {
        message = `run aborted — command terminated by cancellation: ${command}`
    } else if (outcome.timedOut) {
        message = `spawnSync ${command} ETIMEDOUT`
    } else if (outcome.errno) {
        message = `spawn ${command} ${outcome.errno}`
    }
    if (outcome.terminationUnconfirmed) {
        message += ' (termination unconfirmed)'
    }
    const err = new Error(message) as ExecError
    if (outcome.aborted) {
        err.aborted = true
    }
    if (outcome.terminationUnconfirmed) {
        err.terminationUnconfirmed = true
    }
    if (outcome.stderr) {
        err.stderr = outcome.stderr
    }
    // pnpm 11 的安装脚本错误写在 stdout；保留原始输出供下游诊断，不在此处裁剪
    if (outcome.stdout) {
        err.stdout = outcome.stdout
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
