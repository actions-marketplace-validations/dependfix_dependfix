import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * resource-probe 插件单测：启动期资源行经统一 logger 输出（info / warn），
 * 资源探测本身 mock（真实 cgroup 读取属 resource-budget 单测）。
 */
const { infoMock, warnMock, warning } = vi.hoisted(() => ({
    infoMock: vi.fn(),
    warnMock: vi.fn(),
    warning: { value: null as string | null },
}))

vi.mock('nitropack/runtime', () => ({
    defineNitroPlugin: (fn: unknown) => fn,
}))
vi.mock('#server/utils/logger', () => ({
    logger: { debug: vi.fn(), info: infoMock, warn: warnMock, error: vi.fn() },
}))
vi.mock('#server/utils/resource-budget', () => ({
    resolveStartupResource: () => ({}),
    formatStartupResourceLine: () => '[resource] stub line',
    formatStartupResourceWarning: () => warning.value,
}))

import resourceProbePlugin from './resource-probe'

afterEach(() => {
    vi.clearAllMocks()
    warning.value = null
})

describe('resource-probe 插件', () => {
    it('资源正常：只输出一行 info（不产生 warn）', () => {
        ;(resourceProbePlugin as unknown as () => void)()
        expect(infoMock).toHaveBeenCalledWith('[resource] stub line')
        expect(warnMock).not.toHaveBeenCalled()
    })

    it('资源低于建议值：额外输出 warn', () => {
        warning.value = '[resource] memory below recommendation'
        ;(resourceProbePlugin as unknown as () => void)()
        expect(warnMock).toHaveBeenCalledWith('[resource] memory below recommendation')
    })
})
