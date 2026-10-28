/**
 * 平台层统一日志（Winston + 文件轮转）。
 *
 * 通道分工（见 docs/design/governance/platform-logging.md）：
 * - 进程级日志（本模块）：启动 / 队列 / 执行器 / 通知等进程事件 → 控制台 + `LOG_DIR` 文件（按日轮转）
 * - 运行级日志（`MemoryLogger`）：单次 run 的引擎输出 → 控制台 + `ScanRun.logsJson`，**不重复**落文件
 *
 * 能力：
 * - 控制台输出（TTY 带颜色，非 TTY JSON）
 * - 文件输出（DailyRotateFile，按日期轮转，生产压缩，31 天保留，`*.errors.log` 单独留档）
 * - 敏感信息脱敏（token/密码/URL 凭据；消息与 context 均脱敏）
 *
 * 环境变量：
 * - LOG_LEVEL：日志级别（error/warn/info/http/verbose/debug/silly，默认 info；未知值回退 info 并 warn）
 * - LOG_DIR：日志文件目录（默认 data/logs；容器入口转成 `$DATA_DIR/logs` 并导出）
 * - LOGFILES：是否启用文件日志（默认 true；`NODE_ENV=test` 默认 false，避免单测写仓库 data/）
 *
 * 不接入远程日志通道：Axiom 的传输层已移除（原先 `require('@axiomhq/winston')` 在 ESM 产物下
 * 不可用且依赖未声明）；P2 接入时按动态 `import()` 重新实现，默认关闭、不发外部请求。
 *
 * 重构（2026-09-10）：
 * - 顶层副作用（fs 检测 + winstonLogger 创建）封装到 initLogger() 函数
 * - 拆分 createWinstonLogger 为可测纯函数（readEnv / resolveLogDir / tryInitLogDir /
 *   buildFileFormat / buildConsoleFormat）
 * - 加 isDirectExecution(import.meta.url) 顶层守卫（与 scripts/shared/cli.mjs 模式一致）
 * - 导出所有核心函数让 vitest 可 import 测试（与 check-readme-i18n.mjs 守卫惯例一致）
 * - 顶层 if (isDirectExecution(...)) 守卫按惯例不可测，保持未覆盖
 *
 * 2026-10-28（本地日志通道统一）：
 * - 移除 Axiom 传输与相关 env；日志级别白名单校验；LOGFILES 测试环境默认关
 * - 文件 audit 按「进程角色 + 文件类型」隔离（容器默认 HTTP + worker 双进程共享日志目录）
 * - 写探针文件名带 pid + 时间戳（双进程同名探针会互删并误判不可写）
 * - 记录初始化状态（getLoggerState），供启动行与致命错误落盘复用同一份 env / 目录 / 可用性判定
 */

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import { PROCESS_ROLE_ENV, parseProcessRole, type ProcessRole } from './process-role'

// ---------------------------------------------------------------------------
// 敏感信息脱敏（复用 sanitize.ts 统一规则）
// ---------------------------------------------------------------------------

/**
 * 脱敏敏感信息（token/密码/URL 凭据）。
 * 已迁移至 ./sanitize.ts，此处 re-export 以兼容既有导入。
 */
import { sanitizeDeep, sanitizeString } from './sanitize'
export const sanitizeLogData = sanitizeDeep

// ---------------------------------------------------------------------------
// 纯函数：环境变量解析
// ---------------------------------------------------------------------------

/** 支持的日志级别（winston npm levels）。 */
export const LOG_LEVELS = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'] as const

export type LogLevel = (typeof LOG_LEVELS)[number]

/**
 * 解析日志级别（白名单校验）。
 * 未知值回退 `info` 并回传原始值，供调用方输出一次 warn（非法级别会让 winston 只放行同名级别，
 * 等价于静默丢日志，必须显式回退）。
 */
export function parseLogLevel(raw: string | undefined): { level: LogLevel, invalid: string | null } {
    if (!raw) {
        return { level: 'info', invalid: null }
    }
    const normalized = raw.trim()
    if (!normalized) {
        return { level: 'info', invalid: null }
    }
    const level = LOG_LEVELS.find((candidate) => candidate === normalized.toLowerCase())
    return level ? { level, invalid: null } : { level: 'info', invalid: normalized }
}

/**
 * 解析 LOGFILES（布尔开关）。
 * 接受 true/false、1/0、yes/no、on/off（大小写与空白容忍）；空串视为未设置；
 * 其余取值回退默认并回传原始值——静默按「开」会让设成 `flase` 的部署以为已关闭文件通道。
 */
export function parseLogFiles(raw: string | undefined, logFilesDefault: boolean): { enabled: boolean, invalid: string | null } {
    if (raw === undefined || raw.trim() === '') {
        return { enabled: logFilesDefault, invalid: null }
    }
    const normalized = raw.trim().toLowerCase()
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
        return { enabled: true, invalid: null }
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
        return { enabled: false, invalid: null }
    }
    return { enabled: logFilesDefault, invalid: raw }
}

export interface LoggerEnv {
    LOG_LEVEL: LogLevel
    /** 非法 LOG_LEVEL 原始值（合法 / 未设置时为 null） */
    LOG_LEVEL_INVALID: string | null
    LOG_DIR: string
    LOGFILES: boolean
    /** 非法 LOGFILES 原始值（合法 / 未设置时为 null） */
    LOGFILES_INVALID: string | null
    /** 本进程角色（容器双进程形态由入口注入）：用于隔离文件 audit 文件 */
    PROCESS_ROLE: ProcessRole
    __PROD__: boolean
    __DEV__: boolean
}

/**
 * 解析环境变量为 LoggerEnv（纯函数 + 默认值兜底）。
 * 测试可传入 mock env 对象验证各分支。
 */
export function readEnv(env: NodeJS.ProcessEnv = process.env): LoggerEnv {
    const { level, invalid } = parseLogLevel(env.LOG_LEVEL)
    // 单测默认不写文件（否则 import 即创建仓库内 data/logs）；显式 LOGFILES=true 仍生效
    const logFilesDefault = env.NODE_ENV !== 'test'
    const logFiles = parseLogFiles(env.LOGFILES, logFilesDefault)
    return {
        LOG_LEVEL: level,
        LOG_LEVEL_INVALID: invalid,
        LOG_DIR: env.LOG_DIR || 'data/logs',
        LOGFILES: logFiles.enabled,
        LOGFILES_INVALID: logFiles.invalid,
        PROCESS_ROLE: parseProcessRole(env[PROCESS_ROLE_ENV]),
        __PROD__: env.NODE_ENV === 'production',
        __DEV__: env.NODE_ENV === 'development',
    }
}

/**
 * 解析日志目录绝对路径（绝对路径直接使用，相对路径以 cwd 为基准）。
 */
export function resolveLogDir(rawDir: string, cwd: string = process.cwd()): string {
    return path.isAbsolute(rawDir) ? rawDir : path.join(cwd, rawDir)
}

// ---------------------------------------------------------------------------
// 副作用封装：日志目录初始化（mockable fs）
// ---------------------------------------------------------------------------

/**
 * 伪文件系统根（不支持递归建目录，且部分内核下 Node 的 `mkdirSync(recursive)` 会长时间阻塞）。
 * 实测 `/proc/<新目录>/logs` 在本仓库运行环境里同步 mkdir 不返回——启动期绝不能因此挂住。
 */
const UNSUPPORTED_LOG_DIR_ROOTS = ['/proc', '/sys']

/** 日志目录是否落在不支持的伪文件系统下（/proc、/sys）。 */
export function isUnsupportedLogDir(logDir: string): boolean {
    const normalized = path.resolve(logDir)
    return UNSUPPORTED_LOG_DIR_ROOTS.some(
        (root) => normalized === root || normalized.startsWith(`${root}${path.sep}`),
    )
}


/**
 * 测试日志目录可写性；成功返回 true，失败返回 false 并 warn。
 * fsModule 默认为 node:fs；测试可传入 mock fs 验证边界。
 *
 * 探针文件名带 pid + 时间戳：容器默认 HTTP 与 worker 双进程同时启动，固定名会让两个进程
 * 互相删除对方的探针文件（A 写 → B 删 → A unlink ENOENT），把可写目录误判为不可写。
 */
export function tryInitLogDir(logDir: string, fsModule: typeof fs = fs): boolean {
    try {
        if (!fsModule.existsSync(logDir)) {
            fsModule.mkdirSync(logDir, { recursive: true })
        }
        const testFile = path.join(logDir, `.write-test-${process.pid}-${Date.now()}`)
        fsModule.writeFileSync(testFile, 'test')
        try {
            fsModule.unlinkSync(testFile)
        } catch {
            // 删除失败说明目录本身已可写，探针残留无害（不因此判不可写）
        }
        return true
    } catch {
        console.warn('[logger] Failed to create log directory, file logging disabled')
        return false
    }
}


// ---------------------------------------------------------------------------
// Winston 格式构建器（纯函数 + 闭包）
// ---------------------------------------------------------------------------

/**
 * 安全序列化（BigInt 转 `123n` 文本；循环引用 / toJSON 抛错时返回占位符）。
 * 日志格式化绝不允许抛错——一次 `JSON.stringify` 失败会把业务调用点变成异常源。
 */
export function safeStringify(value: unknown): string {
    try {
        return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? `${item}n` : item)) ?? String(value)
    } catch {
        return '[unserializable]'
    }
}

/**
 * 文件格式 meta 行（无 meta 返回 ''，否则 ' {...}'）。
 * 独立可测函数（重构——避免 printf 闭包逻辑不可覆盖）。
 */
export function buildFileMetaLine(meta: Record<string, unknown>): string {
    return Object.keys(meta).length > 0 ? ` ${safeStringify(meta)}` : ''
}

/**
 * 控制台格式 meta 行（无 meta 返回 ''，否则 ' k1=v1 k2=v2'）。
 * 独立可测函数（重构）。
 */
export function buildConsoleMetaLine(meta: Record<string, unknown>): string {
    return Object.keys(meta).length > 0
        ? ` ${Object.entries(meta).map(([k, v]) => `${k}=${safeStringify(v)}`).join(' ')}`
        : ''
}

/**
 * 文件格式日志行组装（winston format.printf callback）。
 * 独立可测函数（重构）——mock winston printf 不实际调用 callback，
 * 提取为顶层函数让 coverage 工具能跟踪。
 */
export function buildFileFormatLine(info: Record<string, unknown>): string {
    const { timestamp, level, message, ...meta } = info as { timestamp?: unknown, level?: unknown, message?: unknown }
    return `${String(timestamp)} ${String(level).toUpperCase().padEnd(5)} ${String(message)}${buildFileMetaLine(meta)}`
}

/**
 * 控制台格式日志行组装（winston format.printf callback）。
 * 独立可测函数（重构）。
 */
export function buildConsoleFormatLine(info: Record<string, unknown>): string {
    const { timestamp, level, message, ...meta } = info as { timestamp?: unknown, level?: unknown, message?: unknown }
    return `${String(timestamp)} ${String(level)} ${String(message)}${buildConsoleMetaLine(meta)}`
}

/**
 * 文件格式（不带颜色）。
 */
export function buildFileFormat(): winston.Logform.Format {
    return winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSSZ' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.printf(buildFileFormatLine),
    )
}

/**
 * 控制台格式（TTY 带颜色）。
 */
export function buildConsoleFormat(): winston.Logform.Format {
    return winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.errors({ stack: true }),
        winston.format.ms(),
        winston.format.colorize({ all: true }),
        winston.format.printf(buildConsoleFormatLine),
    )
}

/**
 * 选择环境对应格式（dev → console，prod → file）。
 */
export function pickConsoleFormat(env: LoggerEnv): winston.Logform.Format {
    return env.__DEV__ ? buildConsoleFormat() : buildFileFormat()
}

// ---------------------------------------------------------------------------
// 轮转配置（多进程隔离）
// ---------------------------------------------------------------------------

/** 文件类型（决定 audit 文件名后缀）。 */
export type RotateFileKind = 'combined' | 'errors'

/**
 * 轮转 audit 文件路径：按「进程角色 + 文件类型」隔离。
 *
 * `winston-daily-rotate-file` 用 audit JSON 记录当前文件名与保留文件列表，默认按 options 哈希命名。
 * 容器默认 HTTP + worker 双进程共享同一日志目录且轮转 options 相同 → 默认哈希相同、共写同一份
 * audit JSON（`writeFileSync` 整写，存在互相覆盖 / 截断风险）。按角色拆开后两进程各自记账；
 * 主日志与错误日志也必须分开（否则互相覆盖对方的文件列表）。
 */
export function buildAuditFilePath(logDir: string, role: ProcessRole, kind: RotateFileKind): string {
    return path.join(logDir, `.${role}-${kind}-audit.json`)
}

// ---------------------------------------------------------------------------
// Winston Logger 创建
// ---------------------------------------------------------------------------

export interface CreateWinstonLoggerOptions {
    env?: LoggerEnv
    fsModule?: typeof fs
}

/** 日志初始化状态（启动行与致命错误落盘共用同一份判定）。 */
export interface LoggerState {
    env: LoggerEnv
    logDir: string
    fileLogging: boolean
}

let loggerState: LoggerState | null = null

/**
 * 创建 Winston Logger 实例。
 * 默认从 process.env 读取配置；测试可通过 options.env / options.fsModule 注入。
 */
export function createWinstonLogger(options: CreateWinstonLoggerOptions = {}): winston.Logger {
    const env = options.env ?? readEnv()
    if (env.LOG_LEVEL_INVALID) {
        // JSON.stringify 防止含换行的取值伪造日志行
        console.warn(`[logger] 未识别的 LOG_LEVEL=${JSON.stringify(env.LOG_LEVEL_INVALID)}，回退 info`)
    }
    if (env.LOGFILES_INVALID) {
        console.warn(`[logger] 未识别的 LOGFILES=${JSON.stringify(env.LOGFILES_INVALID)}（支持 true/false · 1/0 · yes/no · on/off），回退默认`)
    }
    const logDir = resolveLogDir(env.LOG_DIR)
    const transports: winston.transport[] = [
        // 控制台输出
        new winston.transports.Console({
            format: pickConsoleFormat(env),
            level: env.LOG_LEVEL,
            // error 走 stderr（保留原 console.error 的流语义，采集侧按流分流仍有效）
            stderrLevels: ['error'],
        }),
    ]

    // 文件输出（DailyRotateFile）
    let fileLogging = false
    if (env.LOGFILES && isUnsupportedLogDir(logDir)) {
        console.warn(`[logger] LOG_DIR=${JSON.stringify(logDir)} 位于不支持的伪文件系统（/proc、/sys），文件日志已禁用`)
    } else if (env.LOGFILES) {
        fileLogging = tryInitLogDir(logDir, options.fsModule)
        if (fileLogging) {
            const rotateBase = {
                dirname: logDir,
                datePattern: 'YYYY-MM-DD',
                zippedArchive: env.__PROD__,
                maxSize: '20m',
                maxFiles: '31d',
                format: buildFileFormat(),
            }
            transports.push(
                new DailyRotateFile({
                    ...rotateBase,
                    filename: '%DATE%.log',
                    level: env.LOG_LEVEL,
                    auditFile: buildAuditFilePath(logDir, env.PROCESS_ROLE, 'combined'),
                }),
                new DailyRotateFile({
                    ...rotateBase,
                    level: 'error',
                    filename: '%DATE%.errors.log',
                    auditFile: buildAuditFilePath(logDir, env.PROCESS_ROLE, 'errors'),
                }),
            )
        }
    }

    loggerState = { env, logDir, fileLogging }

    return winston.createLogger({
        level: env.LOG_LEVEL,
        transports,
        exitOnError: false,
    })
}

/**
 * 获取日志初始化状态（最近一次 createWinstonLogger 的结果）。
 * 未初始化时按当前 env 兜底计算（不创建目录），保证调用方总能拿到结构完整的判定。
 */
export function getLoggerState(): LoggerState {
    if (loggerState) {
        return loggerState
    }
    const env = readEnv()
    return { env, logDir: resolveLogDir(env.LOG_DIR), fileLogging: false }
}

/**
 * 启动行（便于 `docker logs` 直接核对日志落点 / 级别 / 进程角色）。
 */
export function formatLogStartupLine(state: LoggerState): string {
    return `[logger] files=${state.fileLogging ? state.logDir : 'disabled'} level=${state.env.LOG_LEVEL} role=${state.env.PROCESS_ROLE}`
}

// ---------------------------------------------------------------------------
// Logger 初始化与获取
// ---------------------------------------------------------------------------

let winstonLoggerInstance: winston.Logger = createWinstonLogger()

/**
 * 重新初始化 Winston Logger（CLI 模式 / 测试模式）。
 * 测试可通过此函数重置 winstonLogger 引用。
 */
export function initLogger(options: CreateWinstonLoggerOptions = {}): winston.Logger {
    winstonLoggerInstance = createWinstonLogger(options)
    return winstonLoggerInstance
}

/**
 * 获取当前 Winston Logger 实例。
 */
export function getWinstonLogger(): winston.Logger {
    return winstonLoggerInstance
}

// 兼容既有导入 `import { winstonLogger } from ...`
// ⚠️ 原始 winston 实例绕过脱敏与消息换行归一：业务代码一律用 `logger` / `createPlatformLogger`；
// 仅进程级基础设施（测试、关闭 transport）可直接访问。
export const winstonLogger = new Proxy({} as winston.Logger, {
    get(_target, prop) {
        return Reflect.get(winstonLoggerInstance, prop)
    },
})

// ---------------------------------------------------------------------------
// Logger 接口（兼容 @dependfix/core Logger）
// ---------------------------------------------------------------------------

export interface PlatformLogger {
    debug(message: string, context?: Record<string, unknown>): void
    info(message: string, context?: Record<string, unknown>): void
    warn(message: string, context?: Record<string, unknown>): void
    error(message: string, context?: Record<string, unknown>): void
}

/**
 * 创建平台 Logger 实例。
 * 与 @dependfix/core 的 createLogger 接口兼容，但输出到 Winston。
 *
 * 消息与 context 都过脱敏：消息里可能拼接了仓库 URL / token / 错误文本，
 * 只脱敏 context 会让凭据随消息原文落盘。消息内的换行归一为字面 `\n`，
 * 避免单条消息伪造多行日志（日志注入）。
 *
 * 写日志本身**不得抛错**：格式化 / transport 异常降级到 console，绝不把业务调用点变成异常源。
 */
export function createPlatformLogger(name: string): PlatformLogger {
    const log = (level: string, message: string, context?: Record<string, unknown>) => {
        let normalized = message
        let sanitized: Record<string, unknown> | undefined
        try {
            normalized = sanitizeString(message).replace(/[\r\n]+/g, '\\n')
            sanitized = context ? sanitizeDeep(context) as Record<string, unknown> : undefined
            winstonLoggerInstance.log(level, `[${name}] ${normalized}`, sanitized ?? {})
        } catch (error) {
            // 脱敏 / 格式化 / transport 任一步抛错都不得把调用点变成异常源
            try {
                console.error(`[logger] 写日志失败（已降级到控制台）: [${name}] ${normalized}`, sanitized ?? {}, error)
            } catch {
                // 控制台也不可用：放弃本条日志
            }
        }
    }
    return {
        debug: (message, context) => log('debug', message, context),
        info: (message, context) => log('info', message, context),
        warn: (message, context) => log('warn', message, context),
        error: (message, context) => log('error', message, context),
    }
}

/** 默认平台 logger */
export const logger = createPlatformLogger('platform')

// ---------------------------------------------------------------------------
// 顶层守卫（与 scripts/shared/cli.mjs 模式一致）
// ---------------------------------------------------------------------------

/**
 * 判断当前模块是否作为 CLI 入口执行（vitest 测试环境下永远 false）。
 */
export function isDirectExecution(importMetaUrl: string, argvEntry: string | undefined = process.argv[1]): boolean {
    if (!argvEntry) {
        return false
    }
    return importMetaUrl === pathToFileURL(path.resolve(argvEntry)).href
}

// 顶层守卫：CLI 模式下不调用 initLogger（已由 createWinstonLogger() 默认初始化）；
// vitest 下 isDirectExecution 永远 false，不触发重置。
if (isDirectExecution(import.meta.url)) {
    initLogger()
}
