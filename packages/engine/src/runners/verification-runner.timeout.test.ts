// 验证命令超时口径：默认链与 CI 镜像脚本共用同一超时，env 覆盖有界回退。
import { describe, expect, it } from 'vitest'
import {
    DEFAULT_COMMAND_TIMEOUT_MS,
    resolveCommandTimeoutMs,
    VERIFY_TIMEOUT_ENV,
} from './verification-runner'

describe('resolveCommandTimeoutMs', () => {
    it('默认 10 分钟；env 合法值覆盖（CI 镜像脚本与默认链同源）', () => {
        expect(resolveCommandTimeoutMs({})).toBe(DEFAULT_COMMAND_TIMEOUT_MS)
        expect(resolveCommandTimeoutMs({ [VERIFY_TIMEOUT_ENV]: '120000' })).toBe(120_000)
    })

    it('越界 / 非整数回退默认（不中断运行）', () => {
        expect(resolveCommandTimeoutMs({ [VERIFY_TIMEOUT_ENV]: '1' })).toBe(DEFAULT_COMMAND_TIMEOUT_MS)
        expect(resolveCommandTimeoutMs({ [VERIFY_TIMEOUT_ENV]: '999999999' })).toBe(DEFAULT_COMMAND_TIMEOUT_MS)
        expect(resolveCommandTimeoutMs({ [VERIFY_TIMEOUT_ENV]: 'abc' })).toBe(DEFAULT_COMMAND_TIMEOUT_MS)
        // 严格整数：不接受尾随字符（与 config normalizeInteger 同口径）
        expect(resolveCommandTimeoutMs({ [VERIFY_TIMEOUT_ENV]: '120000abc' })).toBe(DEFAULT_COMMAND_TIMEOUT_MS)
    })
})
