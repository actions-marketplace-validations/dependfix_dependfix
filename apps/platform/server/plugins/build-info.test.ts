import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * 启动期版本戳插件单测（任务登记见 docs/plan/todo-archive.md §M40.1）：
 * 验证启动时通过统一 logger 输出含 version / commit / startedAt 的日志行。
 */
const { infoMock, warnMock } = vi.hoisted(() => ({ infoMock: vi.fn(), warnMock: vi.fn() }))

vi.mock('nitropack/runtime', () => ({
    defineNitroPlugin: (fn: unknown) => fn,
}))
vi.mock('#server/utils/logger', () => ({
    logger: { debug: vi.fn(), info: infoMock, warn: warnMock, error: vi.fn() },
}))

import buildInfoPlugin from './build-info'

const runPlugin = (config: Record<string, unknown>): string[] => {
    vi.stubGlobal('useRuntimeConfig', () => config)
    vi.clearAllMocks()
    ;(buildInfoPlugin as unknown as () => void)()
    return [...infoMock.mock.calls, ...warnMock.mock.calls].map((args) => String(args[0]))
}

describe('build-info 插件', () => {
    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it('注入值：打印 version / commit / startedAt', () => {
        const lines = runPlugin({ buildVersion: '1.2.3', buildCommit: 'abcdef0' })
        expect(lines).toHaveLength(1)
        expect(lines[0]).toMatch(/^\[build\] version=1\.2\.3 commit=abcdef0 startedAt=.+Z$/)
    })

    it('未注入：回退 unknown 且不抛错', () => {
        const lines = runPlugin({})
        expect(lines).toHaveLength(1)
        expect(lines[0]).toContain('version=unknown commit=unknown')
    })

    it('worker 角色：跳过版本戳（只留一行跳过日志），HTTP 主进程行为不变', () => {
        process.env.DEPENDFIX_ROLE = 'worker'
        try {
            const lines = runPlugin({ buildVersion: '1.2.3', buildCommit: 'abcdef0' })
            expect(lines.some((line) => line.startsWith('[build]'))).toBe(false)
            expect(lines.some((line) => line.includes('跳过 HTTP-only 插件'))).toBe(true)
        } finally {
            delete process.env.DEPENDFIX_ROLE
        }
    })

    it('server 角色与未设置：正常打印版本戳', () => {
        process.env.DEPENDFIX_ROLE = 'server'
        try {
            expect(runPlugin({ buildVersion: '1.2.3', buildCommit: 'abcdef0' })[0]).toMatch(/^\[build\] /)
        } finally {
            delete process.env.DEPENDFIX_ROLE
        }
        expect(runPlugin({ buildVersion: '1.2.3', buildCommit: 'abcdef0' })[0]).toMatch(/^\[build\] /)
    })
})
