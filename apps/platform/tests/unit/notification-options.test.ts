import { describe, expect, it, vi } from 'vitest'

/**
 * 同源防线：把扫描侧标签替换为哨兵值，断言阈值选项标签确实由 `scanSeverityLabel` 产出。
 * 若实现改回硬编码 `Critical` / `High` 字面量，本文件的用例会失败（mutation 可击杀）。
 */
vi.mock('../../app/utils/scan-options', () => ({
    scanSeverityLabel: (value: string) => `SEV(${value})`,
}))

const { notificationSeverityThresholdOptions } = await import('../../app/utils/notification-options')

/** 最小插值器：用占位模板断言拼接口径，不依赖 locale 文件。 */
const messages: Record<string, string> = {
    'notifications.severityHigh': '{critical} + {high}',
    'notifications.severityCritical': '仅 {critical}',
}
const t = (key: string, params?: Record<string, string | number>): string => {
    let out = messages[key] ?? key
    for (const [name, value] of Object.entries(params ?? {})) {
        out = out.replace(`{${name}}`, String(value))
    }
    return out
}

describe('utils/notification-options', () => {
    it('阈值选项取值与 severityThreshold 枚举一致（high 含 high，critical 仅 critical）', () => {
        expect(notificationSeverityThresholdOptions(t).map((option) => option.value)).toEqual(['high', 'critical'])
    })

    it('阈值标签由扫描侧严重级别标签拼接（哨兵值替代后仍成立，禁止各写一套字面量）', () => {
        const labels = notificationSeverityThresholdOptions(t).map((option) => option.label)
        expect(labels).toEqual(['SEV(critical) + SEV(high)', '仅 SEV(critical)'])
        // high 选项同时携带两个级别，critical 选项只携带 critical
        expect(labels[1]).not.toContain('SEV(high)')
    })

    it('未命中的插值占位符不会被静默吞掉（模板缺 key 时暴露原文）', () => {
        const labels = notificationSeverityThresholdOptions((key) => key).map((option) => option.label)
        expect(labels).toEqual(['notifications.severityHigh', 'notifications.severityCritical'])
    })
})
