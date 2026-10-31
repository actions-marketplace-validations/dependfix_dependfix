/**
 * logger 文件通道集成测试（不 mock node:fs / winston）。
 *
 * 验证验收口径里必须"真的写到磁盘"的部分：
 * - 文件名按日期：`YYYY-MM-DD.log` / `YYYY-MM-DD.errors.log`
 * - 错误单独留档：errors 文件只有 error 级，普通文件同时包含 info / error
 * - audit 文件按进程角色隔离（容器 HTTP + worker 双进程共享目录）
 * - 目录不可创建时回退控制台且不抛错
 *
 * 使用系统临时目录，结束即清理；不触碰仓库内 data/。
 */

import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { createWinstonLogger, getWinstonLogger, initLogger, logger as platformLogger, readEnv } from './logger'
import { formatLogDateStamp } from './process-log'

const created: string[] = []

const makeTempDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'dependfix-logger-'))
    created.push(dir)
    return dir
}

const waitFor = async (predicate: () => boolean, timeout = 5000): Promise<void> => {
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
        if (predicate()) {
            return
        }
        await new Promise((resolve) => setTimeout(resolve, 20))
    }
    throw new Error('waitFor 超时')
}

afterAll(() => {
    for (const dir of created.splice(0)) {
        rmSync(dir, { recursive: true, force: true })
    }
})

describe('logger 文件通道', () => {
    it('按日期写主日志与错误日志，错误文件只收 error', async () => {
        const dir = makeTempDir()
        const logger = createWinstonLogger({
            env: readEnv({ LOGFILES: 'true', LOG_DIR: dir, NODE_ENV: 'production' }),
        })
        try {
            logger.info('plain-info-line')
            logger.error('error-line', { runId: 'r1' })

            const day = formatLogDateStamp()
            const mainFile = join(dir, `${day}.log`)
            const errorFile = join(dir, `${day}.errors.log`)
            await waitFor(() => {
                try {
                    return readFileSync(mainFile, 'utf8').includes('error-line')
                } catch {
                    return false
                }
            })

            await waitFor(() => {
                try {
                    return readFileSync(errorFile, 'utf8').includes('error-line')
                } catch {
                    return false
                }
            })
            const main = readFileSync(mainFile, 'utf8')
            expect(main).toContain('plain-info-line')
            expect(main).toContain('error-line')
            expect(main).toContain('"runId":"r1"')
            expect(readFileSync(errorFile, 'utf8')).toContain('error-line')
            expect(readFileSync(errorFile, 'utf8')).not.toContain('plain-info-line')
        } finally {
            await new Promise<void>((resolve) => {
                logger.on('finish', () => resolve())
                logger.end()
            })
        }
    })

    it('凭据不落盘：消息 / context / 数据库 URL 均脱敏后再写文件', async () => {
        const dir = makeTempDir()
        // 必须走平台 Logger 门面（直接 createWinstonLogger 得到的是裸 winston 实例，不过脱敏）
        initLogger({ env: readEnv({ LOGFILES: 'true', LOG_DIR: dir, NODE_ENV: 'production' }) })
        try {
            platformLogger.info('clone https://x-access-token:ghp_realsecret@github.com/o/r.git', {
                token: 'ghp_realsecret',
                database: 'postgres://user:pa55@db.internal:5432/app',
            })
            const day = formatLogDateStamp()
            const mainFile = join(dir, `${day}.log`)
            await waitFor(() => {
                try {
                    return readFileSync(mainFile, 'utf8').includes('clone')
                } catch {
                    return false
                }
            })
            const main = readFileSync(mainFile, 'utf8')
            expect(main).not.toContain('ghp_realsecret')
            expect(main).not.toContain('pa55')
            expect(main).toContain('https://***@github.com')
            expect(main).toContain('postgres://***@db.internal:5432/app')
            expect(main).toContain('"token":"***"')
        } finally {
            await new Promise<void>((resolve) => {
                const logger = getWinstonLogger()
                logger.on('finish', () => resolve())
                logger.end()
            })
        }
    })

    it('worker 角色同样写主日志与错误日志（双进程各自有文件通道）', async () => {
        const dir = makeTempDir()
        const logger = createWinstonLogger({
            env: readEnv({ LOGFILES: 'true', LOG_DIR: dir, DEPENDFIX_ROLE: 'worker' }),
        })
        try {
            logger.info('worker-lifecycle-line')
            logger.error('worker-failure-line')
            const day = formatLogDateStamp()
            await waitFor(() => {
                try {
                    return readFileSync(join(dir, `${day}.errors.log`), 'utf8').includes('worker-failure-line')
                } catch {
                    return false
                }
            })
            expect(readFileSync(join(dir, `${day}.log`), 'utf8')).toContain('worker-lifecycle-line')
            expect(readFileSync(join(dir, `${day}.errors.log`), 'utf8')).toContain('worker-failure-line')
        } finally {
            await new Promise<void>((resolve) => {
                logger.on('finish', () => resolve())
                logger.end()
            })
        }
    })

    it('audit 文件按角色隔离（worker 与 server 不共用）', async () => {
        const dir = makeTempDir()
        const serverLogger = createWinstonLogger({
            env: readEnv({ LOGFILES: 'true', LOG_DIR: dir, DEPENDFIX_ROLE: 'server' }),
        })
        const workerLogger = createWinstonLogger({
            env: readEnv({ LOGFILES: 'true', LOG_DIR: dir, DEPENDFIX_ROLE: 'worker' }),
        })
        try {
            await waitFor(() => {
                try {
                    readFileSync(join(dir, '.server-combined-audit.json'), 'utf8')
                    readFileSync(join(dir, '.worker-combined-audit.json'), 'utf8')
                    return true
                } catch {
                    return false
                }
            })
            expect(readFileSync(join(dir, '.server-errors-audit.json'), 'utf8')).toBeTruthy()
            expect(readFileSync(join(dir, '.worker-errors-audit.json'), 'utf8')).toBeTruthy()
        } finally {
            await Promise.all([
                new Promise<void>((resolve) => {
                    serverLogger.on('finish', () => resolve())
                    serverLogger.end()
                }),
                new Promise<void>((resolve) => {
                    workerLogger.on('finish', () => resolve())
                    workerLogger.end()
                }),
            ])
        }
    })

    it('目录不可创建时回退控制台（warn 不阻断）', () => {
        const dir = makeTempDir()
        // 用「文件」充当父目录：mkdir 必然 ENOTDIR，模拟只读 / 非法挂载
        const blocker = join(dir, 'not-a-dir')
        writeFileSync(blocker, 'x')
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        try {
            const logger = createWinstonLogger({
                env: readEnv({ LOGFILES: 'true', LOG_DIR: join(blocker, 'logs') }),
            })
            expect(logger).toBeDefined()
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[logger]'))
        } finally {
            warnSpy.mockRestore()
        }
    })

    it('显式关闭 file logging 时不创建目录', () => {
        const dir = makeTempDir()
        const target = join(dir, 'never-created')
        createWinstonLogger({ env: readEnv({ LOGFILES: 'false', LOG_DIR: target }) })
        expect(() => readFileSync(join(target, '.server-combined-audit.json'))).toThrow()
    })
})

describe('process-log 与文件通道同构', () => {
    it('致命行写入日期错误文件（同步 append）', async () => {
        const { formatFatalLogLine, writeFatalLogLine, resolveErrorLogFilePath } = await import('./process-log')
        const dir = makeTempDir()
        mkdirSync(dir, { recursive: true })
        const at = new Date(2026, 9, 28, 12, 34, 56, 789)
        const line = formatFatalLogLine('uncaughtException', new Error('boom'), at)
        expect(writeFatalLogLine(line, { logDir: dir, at })).toBe(true)
        const content = readFileSync(resolveErrorLogFilePath(dir, at), 'utf8')
        expect(content).toContain('2026-10-28')
        expect(content).toContain('[fatal] uncaughtException: Error: boom')
    })
})
