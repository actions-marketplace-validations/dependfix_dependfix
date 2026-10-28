/**
 * process-log.ts 单测：时间戳 / 致命行 / 同步落盘 / 进程钩子语义。
 *
 * 钩子用 fake 进程对象（EventEmitter + exit spy），不触碰真实进程；
 * fs 走 mock，只断言写入参数与失败降级。
 */

import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:fs', () => ({
    default: {
        appendFileSync: vi.fn(),
        writeSync: vi.fn(),
    },
}))

import { readEnv, type LoggerState } from './logger'
import { sanitizeDeep } from './sanitize'
import {
    describeFatalReason,
    formatFatalLogLine,
    formatLogDateStamp,
    formatLogTimestamp,
    formatSyncLogLine,
    installProcessErrorHandlers,
    resolveErrorLogFilePath,
    resolveLogFilePath,
    writeFatalLogLine,
    writeSyncLogLine,
} from './process-log'

const mockedFs = vi.mocked(fs)

class FakeProcess extends EventEmitter {
    exit = vi.fn()
}

const makeState = (fileLogging: boolean): LoggerState => ({
    env: readEnv({ LOGFILES: fileLogging ? 'true' : 'false', LOG_DIR: '/tmp/logs' }),
    logDir: '/tmp/logs',
    fileLogging,
})

const makeProcess = (): FakeProcess => new FakeProcess()

beforeEach(() => {
    vi.clearAllMocks()
})

afterEach(() => {
    vi.restoreAllMocks()
    // 模块级 vi.fn 的 mockImplementation 不受 restoreAllMocks 影响，显式复位（避免串场）
    vi.resetAllMocks()
})

describe('formatLogDateStamp / formatLogTimestamp', () => {
    it('derives the file date from local time', () => {
        expect(formatLogDateStamp(new Date(2026, 9, 28, 0, 5))).toBe('2026-10-28')
        expect(formatLogDateStamp(new Date(2026, 0, 1, 23, 59))).toBe('2026-01-01')
    })

    it('renders the winston timestamp layout with timezone offset', () => {
        const at = new Date(2026, 9, 28, 12, 34, 56, 789)
        const stamp = formatLogTimestamp(at)
        expect(stamp).toMatch(/^2026-10-28 12:34:56\.789[+-]\d{2}:\d{2}$/)
        const offsetMinutes = -at.getTimezoneOffset()
        const sign = offsetMinutes >= 0 ? '+' : '-'
        const abs = Math.abs(offsetMinutes)
        const expectedOffset = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
        expect(stamp.endsWith(expectedOffset)).toBe(true)
    })

    it('resolves the error file path by date', () => {
        expect(resolveErrorLogFilePath('/app/data/logs', new Date(2026, 9, 28))).toBe('/app/data/logs/2026-10-28.errors.log')
    })
})

describe('describeFatalReason', () => {
    it('expands Error name / message / stack', () => {
        const described = describeFatalReason(new TypeError('boom'))
        expect(described.message).toBe('TypeError: boom')
        expect(described.stack).toContain('TypeError: boom')
    })

    it('sanitizes credentials inside the error message and stack', () => {
        const described = describeFatalReason(new Error('failed https://x-access-token:ghp_abc123@github.com/o/r.git'))
        expect(described.message).not.toContain('ghp_abc123')
        expect(JSON.stringify(described)).not.toContain('ghp_abc123')
    })

    it('keeps Error.code / cause for diagnostics', () => {
        const error = Object.assign(new Error('fs failed'), { code: 'EACCES' })
        error.cause = new Error('permission https://x-access-token:ghp_abc123@github.com/o/r.git')
        const described = describeFatalReason(error)
        expect(described.message).toBe('Error: fs failed')
        expect(JSON.stringify({ error: described })).not.toContain('ghp_abc123')
        // code / cause 通过 context（Error 展开）保留，而不是丢成 {}
        expect(sanitizeDeep(error)).toMatchObject({ code: 'EACCES', cause: { message: expect.stringContaining('permission') } })
    })

    it('handles string rejections', () => {
        expect(describeFatalReason('plain reason').message).toBe('plain reason')
        expect(describeFatalReason('token is ghp_abc123').message).toBe('token is ghp_***')
    })

    it('serializes plain objects and masks sensitive keys', () => {
        const described = describeFatalReason({ code: 'E1', token: 'abc' })
        expect(described.message).toContain('E1')
        expect(described.message).toContain('***')
        expect(described.message).not.toContain('abc')
    })

    it('falls back safely on circular values (不抛错)', () => {
        const circular: Record<string, unknown> = {}
        circular.self = circular
        expect(() => describeFatalReason(circular)).not.toThrow()
        expect(describeFatalReason(circular).message).toBeTruthy()
    })

    it('handles null / undefined / numbers', () => {
        expect(describeFatalReason(null).message).toBe('null')
        expect(describeFatalReason(undefined).message).toBe('undefined')
        expect(describeFatalReason(42).message).toBe('42')
    })
})

describe('formatFatalLogLine', () => {
    it('builds a line in the same shape as the file transport', () => {
        const at = new Date(2026, 9, 28, 12, 34, 56, 789)
        const line = formatFatalLogLine('uncaughtException', new Error('boom'), at)
        expect(line).toMatch(/^2026-10-28 12:34:56\.789[+-]\d{2}:\d{2} ERROR\s+\[fatal\] uncaughtException: Error: boom/)
        expect(line).toContain('"stack"')
    })

    it('includes Error.code in the fatal line meta', () => {
        const error = Object.assign(new Error('fs failed'), { code: 'EACCES' })
        expect(formatFatalLogLine('uncaughtException', error)).toContain('"code":"EACCES"')
    })

    it('never throws on circular causes', () => {
        const error = new Error('loop')
        error.cause = error
        expect(() => formatFatalLogLine('uncaughtException', error)).not.toThrow()
        expect(formatFatalLogLine('uncaughtException', error)).toContain('[fatal] uncaughtException: Error: loop')
    })

    it('labels unhandled rejections distinctly', () => {
        expect(formatFatalLogLine('unhandledRejection', 'nope')).toContain('[fatal] unhandledRejection: nope')
    })
})

describe('formatSyncLogLine / writeSyncLogLine', () => {
    it('routes error to *.errors.log and info/warn to the main log', () => {
        const at = new Date(2026, 9, 28)
        expect(resolveLogFilePath('/tmp/logs', 'error', at)).toBe('/tmp/logs/2026-10-28.errors.log')
        expect(resolveLogFilePath('/tmp/logs', 'info', at)).toBe('/tmp/logs/2026-10-28.log')
        expect(resolveLogFilePath('/tmp/logs', 'warn', at)).toBe('/tmp/logs/2026-10-28.log')
    })

    it('builds a sanitized one-line record in file-format shape', () => {
        const at = new Date(2026, 9, 28, 1, 2, 3, 4)
        const line = formatSyncLogLine('error', 'failed ghp_abc123', { token: 'x' }, at)
        expect(line).toMatch(/^2026-10-28 01:02:03\.004[+-]\d{2}:\d{2} ERROR\s+failed ghp_\*\*\*/)
        expect(line).toContain('"token":"***"')
        expect(line).not.toContain('ghp_abc123')
    })

    it('appends synchronously and reports failure without throwing', () => {
        const at = new Date(2026, 9, 28)
        expect(writeSyncLogLine('error', 'boom', { error: new Error('x') }, { logDir: '/tmp/logs', at })).toBe(true)
        expect(mockedFs.appendFileSync).toHaveBeenCalledWith('/tmp/logs/2026-10-28.errors.log', expect.stringContaining('ERROR boom'))
        mockedFs.appendFileSync.mockImplementation(() => {
            throw new Error('EROFS')
        })
        expect(writeSyncLogLine('info', 'boom', {}, { logDir: '/tmp/logs', at })).toBe(false)
    })
})

describe('writeFatalLogLine', () => {
    it('appends one newline-terminated line to the dated error file', () => {
        const at = new Date(2026, 9, 28)
        expect(writeFatalLogLine('line', { logDir: '/tmp/logs', at })).toBe(true)
        expect(mockedFs.appendFileSync).toHaveBeenCalledWith('/tmp/logs/2026-10-28.errors.log', 'line\n')
    })

    it('returns false instead of throwing when the file cannot be written', () => {
        mockedFs.appendFileSync.mockImplementation(() => {
            throw new Error('EROFS')
        })
        expect(writeFatalLogLine('line', { logDir: '/tmp/logs' })).toBe(false)
    })
})

describe('installProcessErrorHandlers', () => {
    it('registers both handlers and logs + exits on uncaughtException', () => {
        const processRef = makeProcess()
        const writeStderr = vi.fn()
        const exit = vi.fn()
        const uninstall = installProcessErrorHandlers({
            processRef: processRef as unknown as NodeJS.Process,
            state: makeState(true),
            now: () => new Date(2026, 9, 28),
            writeStderr,
            exit,
        })

        processRef.emit('uncaughtException', new Error('boom'))

        expect(writeStderr).toHaveBeenCalledWith(expect.stringContaining('[fatal] uncaughtException: Error: boom'))
        const [file, line] = mockedFs.appendFileSync.mock.calls[0] as [string, string]
        expect(file).toBe('/tmp/logs/2026-10-28.errors.log')
        expect(line).toContain('[fatal] uncaughtException: Error: boom')
        expect(line.endsWith('\n')).toBe(true)
        expect(exit).toHaveBeenCalledWith(1)
        uninstall()
    })

    it('writes the fatal line to fd 2 synchronously (process.exit 不等异步流)', () => {
        const processRef = makeProcess()
        const exit = vi.fn()
        const uninstall = installProcessErrorHandlers({
            processRef: processRef as unknown as NodeJS.Process,
            state: makeState(true),
            exit,
        })
        processRef.emit('uncaughtException', new Error('boom'))
        expect(mockedFs.writeSync).toHaveBeenCalledWith(2, expect.stringContaining('[fatal] uncaughtException'))
        uninstall()
    })

    it('still exits when stderr itself fails (EPIPE)', () => {
        mockedFs.writeSync.mockImplementation(() => {
            throw new Error('EPIPE')
        })
        const processRef = makeProcess()
        const exit = vi.fn()
        const uninstall = installProcessErrorHandlers({
            processRef: processRef as unknown as NodeJS.Process,
            state: makeState(false),
            exit,
        })
        expect(() => processRef.emit('uncaughtException', new Error('boom'))).not.toThrow()
        expect(exit).toHaveBeenCalledWith(1)
        uninstall()
    })

    it('logs unhandled rejections and keeps the fail-fast exit', () => {
        const processRef = makeProcess()
        const writeStderr = vi.fn()
        const exit = vi.fn()
        const uninstall = installProcessErrorHandlers({
            processRef: processRef as unknown as NodeJS.Process,
            state: makeState(true),
            writeStderr,
            exit,
        })

        processRef.emit('unhandledRejection', 'rejected with token ghp_abc123')

        expect(writeStderr.mock.calls[0]![0]).toContain('ghp_***')
        expect(writeStderr.mock.calls[0]![0]).toContain('[fatal] unhandledRejection')
        expect(exit).toHaveBeenCalledWith(1)
        uninstall()
    })

    it('skips the file write when file logging is unavailable', () => {
        const processRef = makeProcess()
        const exit = vi.fn()
        const uninstall = installProcessErrorHandlers({
            processRef: processRef as unknown as NodeJS.Process,
            state: makeState(false),
            writeStderr: vi.fn(),
            exit,
        })

        processRef.emit('uncaughtException', new Error('boom'))

        expect(mockedFs.appendFileSync).not.toHaveBeenCalled()
        expect(exit).toHaveBeenCalledWith(1)
        uninstall()
    })

    it('still exits when the synchronous append throws', () => {
        mockedFs.appendFileSync.mockImplementation(() => {
            throw new Error('EROFS')
        })
        const processRef = makeProcess()
        const exit = vi.fn()
        const uninstall = installProcessErrorHandlers({
            processRef: processRef as unknown as NodeJS.Process,
            state: makeState(true),
            writeStderr: vi.fn(),
            exit,
        })

        processRef.emit('uncaughtException', new Error('boom'))

        expect(exit).toHaveBeenCalledWith(1)
        uninstall()
    })

    it('is idempotent and uninstallable', () => {
        const processRef = makeProcess()
        const options = {
            processRef: processRef as unknown as NodeJS.Process,
            state: makeState(true),
            writeStderr: vi.fn(),
            exit: vi.fn(),
        }
        const uninstall = installProcessErrorHandlers(options)
        expect(processRef.listenerCount('uncaughtException')).toBe(1)

        // 二次安装返回空操作，不重复注册
        const secondUninstall = installProcessErrorHandlers(options)
        expect(processRef.listenerCount('uncaughtException')).toBe(1)
        secondUninstall()
        expect(processRef.listenerCount('uncaughtException')).toBe(1)

        uninstall()
        expect(processRef.listenerCount('uncaughtException')).toBe(0)
        expect(processRef.listenerCount('unhandledRejection')).toBe(0)

        // 卸载后可重新安装（dev 重载场景）
        const thirdUninstall = installProcessErrorHandlers(options)
        expect(processRef.listenerCount('uncaughtException')).toBe(1)
        thirdUninstall()
    })
})
