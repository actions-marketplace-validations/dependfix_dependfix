import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * logger 插件单测：启动行 + 致命错误钩子安装 + close 钩子卸载 / 关闭文件流。
 * logger 与 process-log 均 mock（真实文件落盘见 utils/logger.files.test.ts）。
 */
const { infoMock, uninstallMock, closeMock, installSpy } = vi.hoisted(() => ({
    infoMock: vi.fn(),
    uninstallMock: vi.fn(),
    closeMock: vi.fn(),
    installSpy: vi.fn(),
}))

vi.mock('nitropack/runtime', () => ({
    defineNitroPlugin: (fn: unknown) => fn,
}))

vi.mock('#server/utils/logger', () => ({
    logger: { debug: vi.fn(), info: infoMock, warn: vi.fn(), error: vi.fn() },
    getLoggerState: () => ({ env: { LOG_LEVEL: 'info', PROCESS_ROLE: 'server' }, logDir: '/app/data/logs', fileLogging: true }),
    formatLogStartupLine: () => '[logger] files=/app/data/logs level=info role=server',
    getWinstonLogger: () => ({ close: closeMock }),
}))

vi.mock('#server/utils/process-log', () => ({
    installProcessErrorHandlers: () => {
        installSpy()
        return uninstallMock
    },
}))

import loggerPlugin from './logger'

const makeNitroApp = () => ({ hooks: { hook: vi.fn() } })

const runPlugin = (): ReturnType<typeof makeNitroApp> => {
    const nitroApp = makeNitroApp()
    ;(loggerPlugin as unknown as (app: unknown) => void)(nitroApp)
    return nitroApp
}

afterEach(() => {
    vi.clearAllMocks()
})

describe('logger 插件', () => {
    it('安装致命错误钩子并打印启动行', () => {
        runPlugin()
        expect(installSpy).toHaveBeenCalledTimes(1)
        expect(infoMock).toHaveBeenCalledWith('[logger] files=/app/data/logs level=info role=server')
    })

    it('close 钩子卸载钩子并关闭文件流', () => {
        const nitroApp = runPlugin()
        expect(nitroApp.hooks.hook).toHaveBeenCalledWith('close', expect.any(Function))

        const closeHandler = nitroApp.hooks.hook.mock.calls[0]![1] as () => void
        closeHandler()

        expect(uninstallMock).toHaveBeenCalledTimes(1)
        expect(closeMock).toHaveBeenCalledTimes(1)
    })

    it('关闭文件流失败不阻断退出', () => {
        closeMock.mockImplementationOnce(() => {
            throw new Error('already closed')
        })
        const nitroApp = runPlugin()
        const closeHandler = nitroApp.hooks.hook.mock.calls[0]![1] as () => void
        expect(() => closeHandler()).not.toThrow()
        expect(uninstallMock).toHaveBeenCalled()
    })
})
