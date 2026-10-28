/**
 * logger.ts 单测
 *
 * 覆盖矩阵（与 exports 一一对应）：
 * - parseLogLevel / readEnv / resolveLogDir / tryInitLogDir
 * - buildFileMetaLine / buildConsoleMetaLine / buildFileFormatLine / buildConsoleFormatLine
 * - buildFileFormat / buildConsoleFormat / pickConsoleFormat / buildAuditFilePath
 * - createWinstonLogger / getLoggerState / formatLogStartupLine
 * - initLogger / getWinstonLogger / winstonLogger (Proxy)
 * - createPlatformLogger / logger / isDirectExecution / sanitizeLogData
 *
 * 真实文件落盘（命名 / 轮转参数 / 错误文件）见 logger.files.test.ts（不 mock node:fs）。
 */

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock node:fs (vi.mock 自动 hoist)
vi.mock('node:fs', () => ({
    default: {
        existsSync: vi.fn(() => true),
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
        unlinkSync: vi.fn(),
        appendFileSync: vi.fn(),
    },
}))

// Mock winston
vi.mock('winston', () => {
    const mockFormat = { format: Symbol('format') }
    return {
        default: {
            format: {
                combine: vi.fn(() => mockFormat),
                timestamp: vi.fn(() => mockFormat),
                errors: vi.fn(() => mockFormat),
                splat: vi.fn(() => mockFormat),
                printf: vi.fn(() => mockFormat),
                ms: vi.fn(() => mockFormat),
                colorize: vi.fn(() => mockFormat),
            },
            transports: {
                Console: vi.fn(),
            },
            createLogger: vi.fn(() => ({
                log: vi.fn(),
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
                close: vi.fn(),
            })),
        },
    }
})

// Mock winston-daily-rotate-file
vi.mock('winston-daily-rotate-file', () => ({
    default: vi.fn(),
}))

import {
    buildAuditFilePath,
    buildConsoleFormat,
    buildConsoleFormatLine,
    buildConsoleMetaLine,
    buildFileFormat,
    buildFileFormatLine,
    buildFileMetaLine,
    createPlatformLogger,
    createWinstonLogger,
    formatLogStartupLine,
    getLoggerState,
    getWinstonLogger,
    initLogger,
    isDirectExecution,
    isUnsupportedLogDir,
    LOG_LEVELS,
    logger,
    parseLogFiles,
    parseLogLevel,
    pickConsoleFormat,
    readEnv,
    resolveLogDir,
    safeStringify,
    sanitizeLogData,
    tryInitLogDir,
    winstonLogger,
} from './logger'
import { sanitizeDeep } from './sanitize'

const mockedFs = vi.mocked(fs)
const mockedWinston = vi.mocked(winston)
const mockedDailyRotate = vi.mocked(DailyRotateFile)

const consoleTransportOptions = (): Record<string, unknown> =>
    (mockedWinston.transports.Console as unknown as { mock: { calls: [Record<string, unknown>][] } })
        .mock.calls.map(([options]) => options)[0]!

const rotateOptions = (): Record<string, unknown>[] =>
    (mockedDailyRotate as unknown as { mock: { calls: [Record<string, unknown>][] } })
        .mock.calls.map(([options]) => options)

beforeEach(() => {
    vi.clearAllMocks()
})

afterEach(() => {
    vi.resetAllMocks()
})

// ---------------------------------------------------------------------------
// sanitizeLogData (re-export)
// ---------------------------------------------------------------------------

describe('sanitizeLogData', () => {
    it('re-exports sanitizeDeep from ./sanitize', () => {
        expect(sanitizeLogData).toBe(sanitizeDeep)
    })

    it('sanitizes nested tokens in context', () => {
        const result = sanitizeLogData({ token: 'abc123', nested: { password: 'secret' } }) as Record<string, unknown>
        expect(result.token).toBe('***')
        expect((result.nested as Record<string, unknown>).password).toBe('***')
    })
})

// ---------------------------------------------------------------------------
// parseLogLevel
// ---------------------------------------------------------------------------

describe('parseLogLevel', () => {
    it('accepts every supported level', () => {
        for (const level of LOG_LEVELS) {
            expect(parseLogLevel(level)).toEqual({ level, invalid: null })
        }
    })

    it('normalizes case and surrounding whitespace', () => {
        expect(parseLogLevel('  WARN ')).toEqual({ level: 'warn', invalid: null })
    })

    it('falls back to info and reports the raw value when unknown', () => {
        expect(parseLogLevel('verbose+')).toEqual({ level: 'info', invalid: 'verbose+' })
    })

    it('treats empty / undefined as unset (no warn)', () => {
        expect(parseLogLevel(undefined)).toEqual({ level: 'info', invalid: null })
        expect(parseLogLevel('')).toEqual({ level: 'info', invalid: null })
        expect(parseLogLevel('   ')).toEqual({ level: 'info', invalid: null })
    })
})

// ---------------------------------------------------------------------------
// readEnv
// ---------------------------------------------------------------------------

describe('readEnv', () => {
    it('returns defaults when env is empty', () => {
        const env = readEnv({})
        expect(env.LOG_LEVEL).toBe('info')
        expect(env.LOG_LEVEL_INVALID).toBeNull()
        expect(env.LOG_DIR).toBe('data/logs')
        expect(env.LOGFILES).toBe(true)
        expect(env.PROCESS_ROLE).toBe('server')
        expect(env.__PROD__).toBe(false)
        expect(env.__DEV__).toBe(false)
    })

    it('honors LOG_LEVEL override', () => {
        expect(readEnv({ LOG_LEVEL: 'debug' }).LOG_LEVEL).toBe('debug')
    })

    it('exposes invalid LOG_LEVEL for the caller to warn about', () => {
        const env = readEnv({ LOG_LEVEL: 'nope' })
        expect(env.LOG_LEVEL).toBe('info')
        expect(env.LOG_LEVEL_INVALID).toBe('nope')
    })

    it('exposes invalid LOGFILES too (no silent fallback)', () => {
        expect(readEnv({}).LOGFILES_INVALID).toBeNull()
        expect(readEnv({ LOGFILES: 'true' }).LOGFILES_INVALID).toBeNull()
        expect(readEnv({ LOGFILES: 'maybe' }).LOGFILES_INVALID).toBe('maybe')
    })

    it('honors LOG_DIR override', () => {
        expect(readEnv({ LOG_DIR: '/var/log/app' }).LOG_DIR).toBe('/var/log/app')
    })

    it('treats empty LOG_DIR as unset', () => {
        expect(readEnv({ LOG_DIR: '' }).LOG_DIR).toBe('data/logs')
    })

    it('LOGFILES=false disables file logging', () => {
        expect(readEnv({ LOGFILES: 'false' }).LOGFILES).toBe(false)
    })

    it('LOGFILES=true enables file logging explicitly', () => {
        expect(readEnv({ LOGFILES: 'true' }).LOGFILES).toBe(true)
    })

    it('LOGFILES accepts 1/0 · yes/no · on/off (case + whitespace tolerant)', () => {
        expect(readEnv({ LOGFILES: '1' }).LOGFILES).toBe(true)
        expect(readEnv({ LOGFILES: 'YES' }).LOGFILES).toBe(true)
        expect(readEnv({ LOGFILES: ' On ' }).LOGFILES).toBe(true)
        expect(readEnv({ LOGFILES: '0' }).LOGFILES).toBe(false)
        expect(readEnv({ LOGFILES: 'no' }).LOGFILES).toBe(false)
        expect(readEnv({ LOGFILES: 'Off' }).LOGFILES).toBe(false)
    })

    it('LOGFILES unknown values fall back to the default and surface the raw value', () => {
        const env = readEnv({ LOGFILES: 'flase' })
        expect(env.LOGFILES).toBe(true)
        expect(env.LOGFILES_INVALID).toBe('flase')
        expect(readEnv({ NODE_ENV: 'test', LOGFILES: 'flase' }).LOGFILES).toBe(false)
    })

    it('LOGFILES empty string falls back to the environment default', () => {
        expect(readEnv({ LOGFILES: '' }).LOGFILES).toBe(true)
    })

    it('defaults LOGFILES off under NODE_ENV=test (avoid writing repo data/)', () => {
        expect(readEnv({ NODE_ENV: 'test' }).LOGFILES).toBe(false)
    })

    it('explicit LOGFILES=true still wins under NODE_ENV=test', () => {
        expect(readEnv({ NODE_ENV: 'test', LOGFILES: 'true' }).LOGFILES).toBe(true)
    })

    it('reads process role for audit file isolation', () => {
        expect(readEnv({ DEPENDFIX_ROLE: 'worker' }).PROCESS_ROLE).toBe('worker')
        expect(readEnv({ DEPENDFIX_ROLE: 'WORKER' }).PROCESS_ROLE).toBe('worker')
        expect(readEnv({ DEPENDFIX_ROLE: 'server' }).PROCESS_ROLE).toBe('server')
        expect(readEnv({ DEPENDFIX_ROLE: 'typo' }).PROCESS_ROLE).toBe('server')
    })

    it('NODE_ENV=production sets __PROD__ true', () => {
        expect(readEnv({ NODE_ENV: 'production' }).__PROD__).toBe(true)
    })

    it('NODE_ENV=development sets __DEV__ true', () => {
        expect(readEnv({ NODE_ENV: 'development' }).__DEV__).toBe(true)
    })
})

describe('parseLogFiles', () => {
    it('treats undefined / blank as unset (env default wins)', () => {
        expect(parseLogFiles(undefined, true)).toEqual({ enabled: true, invalid: null })
        expect(parseLogFiles('', false)).toEqual({ enabled: false, invalid: null })
        expect(parseLogFiles('   ', true)).toEqual({ enabled: true, invalid: null })
    })

    it('maps every accepted spelling', () => {
        for (const raw of ['true', 'TRUE', '1', 'yes', 'on']) {
            expect(parseLogFiles(raw, false).enabled).toBe(true)
        }
        for (const raw of ['false', '0', 'no', 'off']) {
            expect(parseLogFiles(raw, true).enabled).toBe(false)
        }
    })

    it('reports unknown spellings instead of silently keeping file logging on', () => {
        expect(parseLogFiles('flase', true)).toEqual({ enabled: true, invalid: 'flase' })
        expect(parseLogFiles('flase', false)).toEqual({ enabled: false, invalid: 'flase' })
    })
})

// ---------------------------------------------------------------------------
// resolveLogDir
// ---------------------------------------------------------------------------

describe('resolveLogDir', () => {
    it('returns absolute path as-is', () => {
        expect(resolveLogDir('/var/log/app')).toBe('/var/log/app')
    })

    it('joins relative path with cwd', () => {
        expect(resolveLogDir('logs', '/tmp/app')).toBe(path.join('/tmp/app', 'logs'))
    })

    it('joins relative path with default process.cwd() when cwd omitted', () => {
        expect(resolveLogDir('logs')).toBe(path.join(process.cwd(), 'logs'))
    })
})

// ---------------------------------------------------------------------------
// isUnsupportedLogDir / tryInitLogDir
// ---------------------------------------------------------------------------

describe('isUnsupportedLogDir', () => {
    it('rejects /proc and /sys subtrees (recursive mkdir 会阻塞)', () => {
        expect(isUnsupportedLogDir('/proc/logs')).toBe(true)
        expect(isUnsupportedLogDir('/proc')).toBe(true)
        expect(isUnsupportedLogDir('/sys/fs/logs')).toBe(true)
    })

    it('accepts normal paths, including lookalike prefixes', () => {
        expect(isUnsupportedLogDir('/app/data/logs')).toBe(false)
        expect(isUnsupportedLogDir('/var/log/process-logs')).toBe(false)
        expect(isUnsupportedLogDir('data/logs')).toBe(false)
    })
})

describe('tryInitLogDir', () => {
    it('returns true when log dir exists and is writable', () => {
        mockedFs.existsSync.mockReturnValue(true)
        const result = tryInitLogDir('/tmp/logs')
        expect(result).toBe(true)
        const probe = mockedFs.writeFileSync.mock.calls[0]![0] as string
        expect(probe.startsWith(path.join('/tmp/logs', '.write-test-'))).toBe(true)
        expect(mockedFs.unlinkSync).toHaveBeenCalledWith(probe)
    })

    it('uses a per-process / per-instant probe name (双进程同名探针会互删)', () => {
        mockedFs.existsSync.mockReturnValue(true)
        const nowSpy = vi.spyOn(Date, 'now').mockReturnValueOnce(1_000).mockReturnValueOnce(2_000)
        tryInitLogDir('/tmp/logs')
        tryInitLogDir('/tmp/logs')
        nowSpy.mockRestore()

        const [first, second] = mockedFs.writeFileSync.mock.calls.map(([file]) => String(file))
        expect(first).toBe(path.join('/tmp/logs', `.write-test-${process.pid}-1000`))
        expect(second).toBe(path.join('/tmp/logs', `.write-test-${process.pid}-2000`))
    })

    it('keeps the directory writable when the probe file cannot be removed', () => {
        mockedFs.existsSync.mockReturnValue(true)
        mockedFs.unlinkSync.mockImplementation(() => {
            throw new Error('EPERM')
        })
        expect(tryInitLogDir('/tmp/logs')).toBe(true)
    })

    it('creates log dir when missing', () => {
        mockedFs.existsSync.mockReturnValue(false)
        const result = tryInitLogDir('/tmp/logs')
        expect(result).toBe(true)
        expect(mockedFs.mkdirSync).toHaveBeenCalledWith('/tmp/logs', { recursive: true })
    })

    it('returns false + warn when write throws', () => {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        mockedFs.existsSync.mockReturnValue(true)
        mockedFs.writeFileSync.mockImplementation(() => {
            throw new Error('EACCES')
        })
        const result = tryInitLogDir('/tmp/logs')
        expect(result).toBe(false)
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[logger]'))
        warnSpy.mockRestore()
    })

    it('returns false + warn when mkdir throws', () => {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        mockedFs.existsSync.mockReturnValue(false)
        mockedFs.mkdirSync.mockImplementation(() => {
            throw new Error('EACCES')
        })
        const result = tryInitLogDir('/tmp/logs')
        expect(result).toBe(false)
        expect(warnSpy).toHaveBeenCalled()
        warnSpy.mockRestore()
    })
})

// ---------------------------------------------------------------------------
// buildFileMetaLine / buildConsoleMetaLine
// ---------------------------------------------------------------------------

describe('buildFileMetaLine', () => {
    it('returns empty string when meta is empty', () => {
        expect(buildFileMetaLine({})).toBe('')
    })

    it('returns JSON-stringified meta with leading space when meta has keys', () => {
        const result = buildFileMetaLine({ key: 'value', num: 42 })
        expect(result).toMatch(/^\s/)
        expect(result).toContain('"key":"value"')
        expect(result).toContain('"num":42')
    })
})

describe('safeStringify', () => {
    it('serializes BigInt as text instead of throwing', () => {
        expect(safeStringify({ n: 10n })).toBe('{"n":"10n"}')
    })

    it('returns a placeholder when serialization throws (circular / toJSON)', () => {
        const circular: Record<string, unknown> = {}
        circular.self = circular
        expect(safeStringify(circular)).toBe('[unserializable]')
        const throwing = {
            toJSON: () => {
                throw new Error('nope')
            },
        }
        expect(safeStringify(throwing)).toBe('[unserializable]')
    })
})

describe('buildConsoleMetaLine', () => {
    it('returns empty string when meta is empty', () => {
        expect(buildConsoleMetaLine({})).toBe('')
    })

    it('returns k=v pairs joined by space when meta has keys', () => {
        const result = buildConsoleMetaLine({ key: 'value', num: 42 })
        expect(result).toMatch(/^\s/)
        expect(result).toContain('key="value"')
        expect(result).toContain('num=42')
    })

    it('JSON-stringifies nested values', () => {
        const result = buildConsoleMetaLine({ obj: { nested: true } })
        expect(result).toContain('obj={"nested":true}')
    })
})

// ---------------------------------------------------------------------------
// buildFileFormatLine / buildConsoleFormatLine
// ---------------------------------------------------------------------------

describe('buildFileFormatLine', () => {
    it('formats line with timestamp + level + message (no meta)', () => {
        expect(buildFileFormatLine({ timestamp: '2026-09-10', level: 'info', message: 'hello' }))
            .toBe('2026-09-10 INFO  hello')
    })

    it('includes meta JSON-serialized when present', () => {
        const line = buildFileFormatLine({ timestamp: '2026-09-10', level: 'warn', message: 'm', foo: 'bar' })
        expect(line).toContain('2026-09-10 WARN ')
        expect(line).toContain('m')
        expect(line).toContain('"foo":"bar"')
    })
})

describe('buildConsoleFormatLine', () => {
    it('formats line with timestamp + level + message (no meta)', () => {
        expect(buildConsoleFormatLine({ timestamp: '2026-09-10', level: 'info', message: 'hello' }))
            .toBe('2026-09-10 info hello')
    })

    it('includes meta k=v pairs when present', () => {
        const line = buildConsoleFormatLine({ timestamp: '2026-09-10', level: 'info', message: 'm', foo: 'bar' })
        expect(line).toContain('2026-09-10 info m')
        expect(line).toContain('foo="bar"')
    })
})

// ---------------------------------------------------------------------------
// buildFileFormat / buildConsoleFormat / pickConsoleFormat
// ---------------------------------------------------------------------------

describe('buildFileFormat', () => {
    it('returns winston format (combine chain)', () => {
        expect(buildFileFormat()).toBeDefined()
        expect(mockedWinston.format.combine).toHaveBeenCalled()
        expect(mockedWinston.format.timestamp).toHaveBeenCalledWith({ format: 'YYYY-MM-DD HH:mm:ss.SSSZ' })
        expect(mockedWinston.format.errors).toHaveBeenCalledWith({ stack: true })
        expect(mockedWinston.format.splat).toHaveBeenCalled()
        expect(mockedWinston.format.printf).toHaveBeenCalled()
    })
})

describe('buildConsoleFormat', () => {
    it('returns winston format with colorize', () => {
        expect(buildConsoleFormat()).toBeDefined()
        expect(mockedWinston.format.colorize).toHaveBeenCalledWith({ all: true })
        expect(mockedWinston.format.ms).toHaveBeenCalled()
    })
})

describe('pickConsoleFormat', () => {
    it('returns console format in dev', () => {
        const result = pickConsoleFormat({ __DEV__: true, __PROD__: false } as never)
        expect(result).toBeDefined()
        expect(mockedWinston.format.colorize).toHaveBeenCalled()
    })

    it('returns file format in prod', () => {
        const result = pickConsoleFormat({ __DEV__: false, __PROD__: true } as never)
        expect(result).toBeDefined()
    })
})

// ---------------------------------------------------------------------------
// buildAuditFilePath
// ---------------------------------------------------------------------------

describe('buildAuditFilePath', () => {
    it('isolates audit files by process role and file kind', () => {
        const serverLog = buildAuditFilePath('/app/data/logs', 'server', 'combined')
        const serverErrors = buildAuditFilePath('/app/data/logs', 'server', 'errors')
        const workerLog = buildAuditFilePath('/app/data/logs', 'worker', 'combined')
        expect(new Set([serverLog, serverErrors, workerLog]).size).toBe(3)
        expect(serverLog).toBe(path.join('/app/data/logs', '.server-combined-audit.json'))
        expect(workerLog).toBe(path.join('/app/data/logs', '.worker-combined-audit.json'))
    })
})

// ---------------------------------------------------------------------------
// createWinstonLogger
// ---------------------------------------------------------------------------

describe('createWinstonLogger', () => {
    it('creates logger with console transport only (LOGFILES=false)', () => {
        const result = createWinstonLogger({ env: readEnv({ LOGFILES: 'false' }) })
        expect(result).toBeDefined()
        expect(mockedWinston.transports.Console).toHaveBeenCalledTimes(1)
        expect(consoleTransportOptions()).toMatchObject({ stderrLevels: ['error'] })
        expect(mockedDailyRotate).not.toHaveBeenCalled()
        expect(getLoggerState().fileLogging).toBe(false)
    })

    it('adds 2 DailyRotateFile transports when LOGFILES=true and fs ok', () => {
        mockedFs.existsSync.mockReturnValue(true)
        createWinstonLogger({ env: readEnv({ LOGFILES: 'true', LOG_DIR: '/tmp/logs' }) })
        expect(mockedDailyRotate).toHaveBeenCalledTimes(2)
        const [combined, errors] = rotateOptions()
        expect(combined).toMatchObject({
            dirname: '/tmp/logs',
            filename: '%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxFiles: '31d',
            zippedArchive: false,
            auditFile: buildAuditFilePath('/tmp/logs', 'server', 'combined'),
        })
        expect(errors).toMatchObject({
            filename: '%DATE%.errors.log',
            level: 'error',
            auditFile: buildAuditFilePath('/tmp/logs', 'server', 'errors'),
        })
    })

    it('separates audit files per role so HTTP / worker processes do not share them', () => {
        mockedFs.existsSync.mockReturnValue(true)
        createWinstonLogger({ env: readEnv({ LOGFILES: 'true', LOG_DIR: '/tmp/logs', DEPENDFIX_ROLE: 'worker' }) })
        const [combined] = rotateOptions()
        expect(combined!.auditFile).toBe(buildAuditFilePath('/tmp/logs', 'worker', 'combined'))
    })

    it('enables compression only in production', () => {
        mockedFs.existsSync.mockReturnValue(true)
        createWinstonLogger({ env: readEnv({ LOGFILES: 'true', LOG_DIR: '/tmp/logs', NODE_ENV: 'production' }) })
        for (const options of rotateOptions()) {
            expect(options.zippedArchive).toBe(true)
        }
    })

    it('skips DailyRotateFile when fs write fails (fallback to console only, no throw)', () => {
        mockedFs.writeFileSync.mockImplementation(() => {
            throw new Error('EACCES')
        })
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        createWinstonLogger({ env: readEnv({ LOGFILES: 'true' }) })
        expect(mockedDailyRotate).not.toHaveBeenCalled()
        expect(getLoggerState().fileLogging).toBe(false)
        expect(warnSpy).toHaveBeenCalled()
        warnSpy.mockRestore()
    })

    it('disables file logging for /proc and /sys without touching the filesystem', () => {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        createWinstonLogger({ env: readEnv({ LOGFILES: 'true', LOG_DIR: '/proc/dependfix/logs' }) })
        expect(mockedDailyRotate).not.toHaveBeenCalled()
        expect(mockedFs.mkdirSync).not.toHaveBeenCalled()
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('伪文件系统'))
        expect(getLoggerState().fileLogging).toBe(false)
        warnSpy.mockRestore()
    })

    it('warns once when LOG_LEVEL is unknown and falls back to info', () => {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        createWinstonLogger({ env: readEnv({ LOGFILES: 'false', LOG_LEVEL: 'loud' }) })
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('LOG_LEVEL="loud"'))
        expect(consoleTransportOptions()).toMatchObject({ level: 'info' })
        warnSpy.mockRestore()
    })

    it('warns about unknown LOGFILES and keeps the default', () => {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        createWinstonLogger({ env: readEnv({ LOGFILES: 'flase', NODE_ENV: 'test' }) })
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('LOGFILES="flase"'))
        expect(mockedDailyRotate).not.toHaveBeenCalled()
        warnSpy.mockRestore()
    })

    it('uses LOG_LEVEL override', () => {
        createWinstonLogger({ env: readEnv({ LOGFILES: 'false', LOG_LEVEL: 'debug' }) })
        expect(consoleTransportOptions()).toMatchObject({ level: 'debug' })
    })

    it('uses file format when __DEV__=false (prod/test)', () => {
        createWinstonLogger({ env: readEnv({ LOGFILES: 'false', NODE_ENV: 'production' }) })
        expect(mockedWinston.format.colorize).not.toHaveBeenCalled()
    })

    it('passes exitOnError: false to createLogger', () => {
        createWinstonLogger({ env: readEnv({ LOGFILES: 'false' }) })
        expect(mockedWinston.createLogger).toHaveBeenCalledWith(expect.objectContaining({ exitOnError: false }))
    })
})

// ---------------------------------------------------------------------------
// getLoggerState / formatLogStartupLine
// ---------------------------------------------------------------------------

describe('getLoggerState', () => {
    it('reflects the most recent initialization', () => {
        mockedFs.existsSync.mockReturnValue(true)
        createWinstonLogger({ env: readEnv({ LOGFILES: 'true', LOG_DIR: '/tmp/logs', DEPENDFIX_ROLE: 'worker' }) })
        const state = getLoggerState()
        expect(state.logDir).toBe('/tmp/logs')
        expect(state.fileLogging).toBe(true)
        expect(state.env.PROCESS_ROLE).toBe('worker')
    })
})

describe('formatLogStartupLine', () => {
    it('prints the log directory when file logging is active', () => {
        const line = formatLogStartupLine({
            env: readEnv({ LOG_LEVEL: 'debug', DEPENDFIX_ROLE: 'worker' }),
            logDir: '/app/data/logs',
            fileLogging: true,
        })
        expect(line).toBe('[logger] files=/app/data/logs level=debug role=worker')
    })

    it('prints disabled when file logging is off', () => {
        const line = formatLogStartupLine({ env: readEnv({}), logDir: '/tmp/logs', fileLogging: false })
        expect(line).toContain('files=disabled')
        expect(line).toContain('role=server')
    })
})

// ---------------------------------------------------------------------------
// initLogger / getWinstonLogger / winstonLogger Proxy
// ---------------------------------------------------------------------------

describe('initLogger', () => {
    it('replaces internal winstonLoggerInstance', () => {
        const before = getWinstonLogger()
        initLogger({ env: readEnv({ LOGFILES: 'false' }) })
        const after = getWinstonLogger()
        expect(after).not.toBe(before)
    })
})

describe('winstonLogger Proxy', () => {
    it('proxies .log to current winstonLoggerInstance', () => {
        const target = getWinstonLogger()
        const logSpy = vi.spyOn(target, 'log')
        winstonLogger.log('info', 'msg')
        expect(logSpy).toHaveBeenCalledWith('info', 'msg')
        logSpy.mockRestore()
    })
})

// ---------------------------------------------------------------------------
// createPlatformLogger + logger constant
// ---------------------------------------------------------------------------

describe('createPlatformLogger', () => {
    beforeEach(() => {
        initLogger({ env: readEnv({ LOGFILES: 'false' }) })
    })

    const lastCall = (): unknown[] => {
        const logSpy = getWinstonLogger().log as unknown as { mock: { calls: unknown[][] } }
        return logSpy.mock.calls.at(-1)!
    }

    it('debug forwards to winstonLogger.log with prefix', () => {
        createPlatformLogger('test').debug('hello')
        expect(lastCall()).toEqual(['debug', '[test] hello', {}])
    })

    it('info forwards with context', () => {
        createPlatformLogger('test').info('hello', { runId: 'r1' })
        expect(lastCall()).toEqual(['info', '[test] hello', { runId: 'r1' }])
    })

    it('warn forwards to warn level', () => {
        createPlatformLogger('test').warn('careful')
        expect(lastCall()[0]).toBe('warn')
    })

    it('error forwards to error level', () => {
        createPlatformLogger('test').error('boom')
        expect(lastCall()[0]).toBe('error')
    })

    it('sanitizes context', () => {
        createPlatformLogger('test').info('hello', { token: 'abc123' })
        expect(lastCall()[2]).toEqual({ token: '***' })
    })

    it('sanitizes the message itself (凭据可能拼在消息里)', () => {
        createPlatformLogger('test').info('clone https://x-access-token:ghp_abc123@github.com/o/r.git')
        expect(String(lastCall()[1])).toContain('https://***@github.com')
    })

    it('expands Error context instead of collapsing it to {}', () => {
        createPlatformLogger('test').error('failed', { error: new Error('boom') })
        const context = lastCall()[2] as { error: { name: string, message: string, stack?: string } }
        expect(context.error.name).toBe('Error')
        expect(context.error.message).toBe('boom')
        expect(context.error.stack).toBeTruthy()
    })

    it('normalizes newlines in the message (防日志注入)', () => {
        createPlatformLogger('test').info('line1\nline2\r\nline3\r2026-01-01 ERROR forged')
        const message = String(lastCall()[1])
        expect(message).not.toContain('\n')
        expect(message).not.toContain('\r')
        expect(message).toContain('line1\\nline2\\nline3\\n2026-01-01 ERROR forged')
    })

    it('never throws on circular Error causes (环状 cause 不得冒泡到调用点)', () => {
        const error = new Error('loop')
        error.cause = error
        expect(() => createPlatformLogger('test').error('failed', { error })).not.toThrow()
    })

    it('never throws when the transport throws (降级到 console)', () => {
        const instance = getWinstonLogger()
        vi.spyOn(instance, 'log').mockImplementation(() => {
            throw new Error('transport broken')
        })
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        expect(() => createPlatformLogger('test').info('still-safe')).not.toThrow()
        expect(errorSpy).toHaveBeenCalled()
        errorSpy.mockRestore()
    })

    it('keeps logger usable with BigInt context (格式化不抛错)', () => {
        expect(() => createPlatformLogger('test').info('bigint', { n: 10n })).not.toThrow()
    })

    it('exposes a default platform logger', () => {
        logger.info('default')
        expect(String(lastCall()[1])).toBe('[platform] default')
    })
})

// ---------------------------------------------------------------------------
// isDirectExecution
// ---------------------------------------------------------------------------

describe('isDirectExecution', () => {
    it('returns false without argv entry', () => {
        expect(isDirectExecution('file:///a.mjs', undefined)).toBe(false)
    })

    it('returns true when argv entry resolves to the module url', () => {
        const file = path.resolve('/tmp/x/logger.mjs')
        expect(isDirectExecution(pathToFileURL(file).href, file)).toBe(true)
    })

    it('returns false for a different entry', () => {
        expect(isDirectExecution('file:///a.mjs', '/tmp/b.mjs')).toBe(false)
    })
})
