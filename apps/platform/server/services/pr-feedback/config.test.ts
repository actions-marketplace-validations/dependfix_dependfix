import { describe, expect, it } from 'vitest'
import { DEFAULT_PR_FEEDBACK_CONFIG, MAX_PR_FEEDBACK_WINDOW_HOURS, parsePrFeedbackConfig, serializePrFeedbackConfig } from './config'

describe('pr-feedback config', () => {
    it('缺省 / 空 / 非法 JSON → 全默认', () => {
        for (const raw of [null, undefined, '', '   ', 'not-json', '[]', '"text"', '123']) {
            expect(parsePrFeedbackConfig(raw)).toEqual(DEFAULT_PR_FEEDBACK_CONFIG)
        }
    })

    it('部分覆盖：只改给出的键，其余保持默认', () => {
        expect(parsePrFeedbackConfig('{"closeFailed":true}')).toEqual({
            comment: true,
            closeFailed: true,
            retryFailed: false,
            windowHours: 24,
        })
    })

    it('非法类型回退该键默认；未知键忽略；窗口截断到上限', () => {
        const config = parsePrFeedbackConfig(JSON.stringify({
            comment: 'yes',
            closeFailed: 1,
            retryFailed: true,
            windowHours: 10_000,
            unknown: 'ignored',
        }))
        expect(config).toEqual({
            comment: true,
            closeFailed: false,
            retryFailed: true,
            windowHours: MAX_PR_FEEDBACK_WINDOW_HOURS,
        })
    })

    it('windowHours 负数 / 非数字回退默认；0 保留（= 停止观察）', () => {
        expect(parsePrFeedbackConfig('{"windowHours":-1}').windowHours).toBe(24)
        expect(parsePrFeedbackConfig('{"windowHours":"12"}').windowHours).toBe(24)
        expect(parsePrFeedbackConfig('{"windowHours":0}').windowHours).toBe(0)
    })

    it('serialize 只写已知键且可往返', () => {
        const raw = serializePrFeedbackConfig({ comment: false, closeFailed: true, retryFailed: false, windowHours: 6 })
        expect(raw).toBe('{"comment":false,"closeFailed":true,"retryFailed":false,"windowHours":6}')
        expect(parsePrFeedbackConfig(raw)).toEqual({ comment: false, closeFailed: true, retryFailed: false, windowHours: 6 })
    })
})
