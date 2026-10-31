/**
 * 进程级致命错误落盘（未捕获异常 / 未处理的 Promise 拒绝）。
 *
 * 为什么不直接用 winston 的 `exceptionHandlers` / `rejectionHandlers`：
 * winston 内置 handler 走异步流（`fs.createWriteStream`），且 `exitOnError` 默认在日志写入
 * 完成前就 `process.exit(1)`——致命错误有概率只出现在控制台、错误文件里查不到。本模块改为
 * 「stderr（保留 `docker logs`）+ 同步 `appendFileSync` 错误文件 + exit(1)」，验收口径
 * 「未捕获异常与 Promise 拒绝进入错误文件」可被确定性验证。
 *
 * 语义保持 Node 默认 fail-fast：
 * - `uncaughtException`：记录后 exit(1)（Node 文档明确不建议在未捕获异常后继续运行）
 * - `unhandledRejection`：Node 15+ 默认 `--unhandled-rejections=throw` → 进程退出；此处记录后同样退出，
 *   不把崩溃语义改成静默吞掉
 *
 * 幂等：安装标记挂在进程对象上的 `Symbol.for`（dev 热重载后模块重新求值也不会重复注册）。
 */

import fs from 'node:fs'
import path from 'node:path'
import { buildFileFormatLine, getLoggerState, type LoggerState } from './logger'
import { sanitizeDeep, sanitizeString } from './sanitize'

/** 致命错误类型（与进程事件同名，便于日志检索）。 */
export type FatalLogKind = 'uncaughtException' | 'unhandledRejection'

const INSTALLED_KEY = Symbol.for('dependfix.platform.process-log.installed')

const pad = (value: number, length = 2): string => String(value).padStart(length, '0')

/**
 * 本地时间日期戳（与轮转文件名同口径，`file-stream-rotator` 默认 `utc: false`）。
 * 形如 `2026-10-28`。
 */
export function formatLogDateStamp(date: Date = new Date()): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * 本地时间时间戳（与 `buildFileFormat` 的 `YYYY-MM-DD HH:mm:ss.SSSZ` 同构）。
 * 形如 `2026-10-28 12:34:56.789+08:00`。
 */
export function formatLogTimestamp(date: Date = new Date()): string {
    const offsetMinutes = -date.getTimezoneOffset()
    const sign = offsetMinutes >= 0 ? '+' : '-'
    const absOffset = Math.abs(offsetMinutes)
    const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
        + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
        + `.${pad(date.getMilliseconds(), 3)}`
    return `${stamp}${sign}${pad(Math.floor(absOffset / 60))}:${pad(absOffset % 60)}`
}

/** 错误文件绝对路径（`YYYY-MM-DD.errors.log`，与 DailyRotateFile 的 `%DATE%.errors.log` 同名）。 */
export function resolveErrorLogFilePath(logDir: string, date: Date = new Date()): string {
    return path.join(logDir, `${formatLogDateStamp(date)}.errors.log`)
}

/** 安全序列化任意拒绝原因（循环引用 / BigInt 等不抛错）。 */
function serializeUnknownReason(reason: unknown): unknown {
    if (typeof reason === 'string') {
        return reason
    }
    if (typeof reason === 'number' || typeof reason === 'boolean' || reason === null || reason === undefined) {
        return String(reason)
    }
    try {
        return JSON.stringify(reason) ?? Object.prototype.toString.call(reason)
    } catch {
        return Object.prototype.toString.call(reason)
    }
}

/**
 * 归一化致命错误文本（已脱敏）。
 * Error 实例取 `name` + `message` + `stack`；其余值安全序列化。
 */
export function describeFatalReason(reason: unknown): { message: string, stack?: string, code?: string } {
    const sanitized = sanitizeDeep(reason)
    if (sanitized && typeof sanitized === 'object' && 'message' in sanitized && 'name' in sanitized) {
        const { name, message, stack, code } = sanitized as { name: string, message: string, stack?: string, code?: string }
        return {
            message: `${name}: ${message}`,
            ...(stack ? { stack } : {}),
            ...(code ? { code } : {}),
        }
    }
    if (typeof sanitized === 'string') {
        return { message: sanitizeString(sanitized) }
    }
    const serialized = serializeUnknownReason(sanitized)
    return { message: typeof serialized === 'string' ? sanitizeString(serialized) : String(serialized) }
}

/** 同步写日志级别（致命路径与「即将 exit(1) 的启动失败」共用）。 */
export type SyncLogLevel = 'error' | 'warn' | 'info'

/** 同步写目标文件：error → `*.errors.log`，其余 → 当日主日志。 */
export function resolveLogFilePath(logDir: string, level: SyncLogLevel, date: Date = new Date()): string {
    return level === 'error'
        ? resolveErrorLogFilePath(logDir, date)
        : path.join(logDir, `${formatLogDateStamp(date)}.log`)
}

/** 同步日志行（与文件通道同构：`<时间戳> LEVEL <消息> {<meta>}`，消息与 meta 均脱敏）。 */
export function formatSyncLogLine(
    level: SyncLogLevel,
    message: string,
    meta: Record<string, unknown> = {},
    at: Date = new Date(),
): string {
    let sanitizedMeta: Record<string, unknown> = {}
    let sanitizedMessage = '[unserializable]'
    try {
        sanitizedMeta = sanitizeDeep(meta) as Record<string, unknown>
        sanitizedMessage = sanitizeString(message)
    } catch {
        // 脱敏失败只降级本条记录，不影响「必须写出最后一行」的语义
    }
    return buildFileFormatLine({
        timestamp: formatLogTimestamp(at),
        level,
        message: sanitizedMessage,
        ...sanitizedMeta,
    })
}

/** 致命日志行（复用同步行格式；脱敏 / 属性访问抛错时降级为占位，不阻断落盘）。 */
export function formatFatalLogLine(kind: FatalLogKind, reason: unknown, at: Date = new Date()): string {
    let described: { message: string, stack?: string, code?: string }
    try {
        described = describeFatalReason(reason)
    } catch {
        described = { message: '[unserializable]' }
    }
    return formatSyncLogLine(
        'error',
        `[fatal] ${kind}: ${described.message}`,
        {
            ...(described.stack ? { stack: described.stack } : {}),
            ...(described.code ? { code: described.code } : {}),
        },
        at,
    )
}

/**
 * 同步追加一行（`level` 决定目标文件）；失败返回 false。
 * 用途：`process.exit` 前的最后一行（致命错误 / migrate-only 启动失败）——异步 transport 不保证刷盘。
 */
export function writeSyncLogLine(
    level: SyncLogLevel,
    message: string,
    meta: Record<string, unknown>,
    options: { logDir: string, at?: Date, fsModule?: typeof fs },
): boolean {
    const fsModule = options.fsModule ?? fs
    const at = options.at ?? new Date()
    try {
        fsModule.appendFileSync(resolveLogFilePath(options.logDir, level, at), `${formatSyncLogLine(level, message, meta, at)}\n`)
        return true
    } catch {
        return false
    }
}

/** 同步追加一行到错误文件；失败返回 false（致命路径不再二次抛错）。 */
export function writeFatalLogLine(
    line: string,
    options: { logDir: string, at?: Date, fsModule?: typeof fs },
): boolean {
    const fsModule = options.fsModule ?? fs
    try {
        fsModule.appendFileSync(resolveErrorLogFilePath(options.logDir, options.at ?? new Date()), `${line}\n`)
        return true
    } catch {
        return false
    }
}

export interface InstallProcessErrorHandlersOptions {
    /** 进程对象（测试注入 fake） */
    processRef?: NodeJS.Process
    /** 日志初始化状态（缺省取 logger 模块当前状态） */
    state?: LoggerState
    now?: () => Date
    fsModule?: typeof fs
    /** 退出实现（测试注入，避免真的结束进程） */
    exit?: (code: number) => void
    /** stderr 写入实现（测试注入） */
    writeStderr?: (line: string) => void
}

/**
 * 安装进程级致命错误钩子，返回卸载函数。
 * 已安装时返回空操作（不重复注册，也不会把别人安装的钩子卸掉）。
 */
export function installProcessErrorHandlers(options: InstallProcessErrorHandlersOptions = {}): () => void {
    const processRef = options.processRef ?? process
    const flags = processRef as unknown as Record<symbol, unknown>
    if (flags[INSTALLED_KEY]) {
        // 已安装：返回空操作，不得卸载别人注册的钩子
        return (): void => undefined
    }

    const state = options.state ?? getLoggerState()
    const now = options.now ?? (() => new Date())
    const fsModule = options.fsModule ?? fs
    const exit = options.exit ?? ((code: number) => process.exit(code))
    // 同步写 fd 2：process.exit 不等待异步流刷新，stderr 是「文件通道不可用」时的唯一通道
    const writeStderr = options.writeStderr ?? ((line: string) => {
        try {
            fsModule.writeSync(2, `${line}\n`)
        } catch {
            // EPIPE / fd 关闭等：致命路径已无更可靠的通道，忽略
        }
    })

    const fatal = (kind: FatalLogKind) => (reason: unknown): void => {
        try {
            const at = now()
            const line = formatFatalLogLine(kind, reason, at)
            // 1) stderr：保证 `docker logs` 可见（即使文件通道不可用）
            writeStderr(line)
            // 2) 错误文件：同步写，保证 process.exit 前已落盘
            if (state.fileLogging) {
                writeFatalLogLine(line, { logDir: state.logDir, at, fsModule })
            }
        } catch {
            // 记录链路任何异常都不得改变「致命错误必退出」的语义
        } finally {
            // 3) 保持 Node 默认 fail-fast 语义
            exit(1)
        }
    }

    const onUncaughtException = fatal('uncaughtException')
    const onUnhandledRejection = fatal('unhandledRejection')
    processRef.on('uncaughtException', onUncaughtException)
    processRef.on('unhandledRejection', onUnhandledRejection)

    const uninstall = (): void => {
        processRef.removeListener('uncaughtException', onUncaughtException)
        processRef.removeListener('unhandledRejection', onUnhandledRejection)
        delete flags[INSTALLED_KEY]
    }
    flags[INSTALLED_KEY] = true
    return uninstall
}
