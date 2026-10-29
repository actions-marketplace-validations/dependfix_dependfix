import { describe, expect, it } from 'vitest'
import { notificationSeverityThresholdOptions } from '../../app/utils/notification-options'

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

    it('阈值标签复用扫描侧严重级别专有名词，不另写一套中文译名', () => {
        const labels = notificationSeverityThresholdOptions(t).map((option) => option.label)
        expect(labels).toEqual(['Critical + High', '仅 Critical'])
        // 关键断言：High 专有名词来自 scanSeverityLabel，而非本文件字面量
        expect(labels[0]).toContain('High')
        expect(labels[1]).not.toContain('High')
    })

    it('未命中的插值占位符不会被静默吞掉（模板缺 key 时暴露原文）', () => {
        const labels = notificationSeverityThresholdOptions((key) => key).map((option) => option.label)
        expect(labels).toEqual(['notifications.severityHigh', 'notifications.severityCritical'])
    })
})
