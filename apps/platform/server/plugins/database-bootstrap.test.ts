import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * database-bootstrap 插件单测：启动期引导失败 → 统一 logger 记 error；
 * migrate-only 模式下退出前同步补一条错误文件（异步 transport 不保证刷盘）。
 */
const {
    bootstrapMock,
    errorMock,
    getStateMock,
    writeSyncMock,
} = vi.hoisted(() => ({
    bootstrapMock: vi.fn(),
    errorMock: vi.fn(),
    getStateMock: vi.fn(),
    writeSyncMock: vi.fn(),
}))

vi.mock('nitropack/runtime', () => ({
    defineNitroPlugin: (fn: unknown) => fn,
}))
vi.mock('#server/utils/database-bootstrap', () => ({ bootstrapDatabase: bootstrapMock }))
vi.mock('#server/utils/logger', () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: errorMock },
    getLoggerState: getStateMock,
}))
vi.mock('#server/utils/process-log', () => ({ writeSyncLogLine: writeSyncMock }))

import databaseBootstrapPlugin from './database-bootstrap'

/** 冲掉 catch 回调内的微任务 */
const flush = async (): Promise<void> => {
    await Promise.resolve()
    await Promise.resolve()
}

beforeEach(() => {
    bootstrapMock.mockReset()
    errorMock.mockReset()
    writeSyncMock.mockReset()
    getStateMock.mockReset()
    getStateMock.mockReturnValue({ env: {}, logDir: '/app/data/logs', fileLogging: true })
    delete process.env.DEPENDFIX_MIGRATIONS_ONLY
})

afterEach(() => {
    delete process.env.DEPENDFIX_MIGRATIONS_ONLY
    vi.restoreAllMocks()
})

describe('database-bootstrap 插件', () => {
    it('引导成功：不记错误、不退出', async () => {
        bootstrapMock.mockResolvedValue(undefined)
        ;(databaseBootstrapPlugin as unknown as () => void)()
        await flush()
        expect(errorMock).not.toHaveBeenCalled()
    })

    it('引导失败（非 migrate-only）：记 error 但不退出', async () => {
        bootstrapMock.mockRejectedValue(new Error('migration failed'))
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
        ;(databaseBootstrapPlugin as unknown as () => void)()
        await flush()

        expect(errorMock).toHaveBeenCalledWith('[database] 启动期引导异常（非致命）', { error: expect.any(Error) })
        expect(exitSpy).not.toHaveBeenCalled()
        expect(writeSyncMock).not.toHaveBeenCalled()
    })

    it('migrate-only 失败：同步补错误文件后 exit(1)', async () => {
        process.env.DEPENDFIX_MIGRATIONS_ONLY = 'true'
        bootstrapMock.mockRejectedValue(new Error('migration failed'))
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
        ;(databaseBootstrapPlugin as unknown as () => void)()
        await flush()

        expect(writeSyncMock).toHaveBeenCalledWith(
            'error',
            '[database] 启动期引导异常（非致命）',
            { error: expect.any(Error) },
            { logDir: '/app/data/logs' },
        )
        expect(exitSpy).toHaveBeenCalledWith(1)
        // 顺序即价值：同步写必须在 exit 之前发生（mock 下不终止，可用调用序锁定）
        expect(writeSyncMock.mock.invocationCallOrder[0]!).toBeLessThan(exitSpy.mock.invocationCallOrder[0]!)
    })

    it('migrate-only 失败且文件通道关闭：只 exit，不写文件', async () => {
        process.env.DEPENDFIX_MIGRATIONS_ONLY = 'true'
        getStateMock.mockReturnValue({ env: {}, logDir: '/app/data/logs', fileLogging: false })
        bootstrapMock.mockRejectedValue(new Error('migration failed'))
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
        ;(databaseBootstrapPlugin as unknown as () => void)()
        await flush()

        expect(writeSyncMock).not.toHaveBeenCalled()
        expect(exitSpy).toHaveBeenCalledWith(1)
    })
})
