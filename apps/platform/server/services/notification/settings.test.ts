import { describe, expect, it, vi } from 'vitest'
import {
    DEFAULT_NOTIFICATION_SETTINGS,
    mergeNotificationSettings,
    notificationSettingsSchema,
    parseNotificationSettingsJson,
    serializeNotificationSettings,
} from './settings'

describe('通知组织设置解析', () => {
    it('null / 非法 JSON / 非法形状 → 默认值并 warn', () => {
        const warn = vi.fn()
        expect(parseNotificationSettingsJson(null, { warn })).toEqual(DEFAULT_NOTIFICATION_SETTINGS)
        expect(parseNotificationSettingsJson('not-json', { warn })).toEqual(DEFAULT_NOTIFICATION_SETTINGS)
        expect(parseNotificationSettingsJson(JSON.stringify({ categories: { securityHigh: 'x' } }), { warn }))
            .toEqual(DEFAULT_NOTIFICATION_SETTINGS)
        expect(warn).toHaveBeenCalled()
    })

    it('合法 JSON 读取并规范化邮箱（trim / 小写 / 去重）', () => {
        const raw = JSON.stringify({
            ...DEFAULT_NOTIFICATION_SETTINGS,
            extraAdminRecipients: [' Ops@Example.com ', 'ops@example.com', 'a@b.com'],
        })
        const parsed = parseNotificationSettingsJson(raw)
        expect(parsed.extraAdminRecipients).toEqual(['ops@example.com', 'a@b.com'])
    })

    it('未知键 / 越界值被拒绝（写路径 strict）', () => {
        expect(notificationSettingsSchema.safeParse({ ...DEFAULT_NOTIFICATION_SETTINGS, unknown: true }).success).toBe(false)
        expect(notificationSettingsSchema.safeParse({ ...DEFAULT_NOTIFICATION_SETTINGS, cooldownHours: 169 }).success).toBe(false)
        expect(notificationSettingsSchema.safeParse({ ...DEFAULT_NOTIFICATION_SETTINGS, maxPerHour: 0 }).success).toBe(false)
    })

    it('PATCH 合并保留未提供字段并规范化', () => {
        const merged = mergeNotificationSettings(
            { ...DEFAULT_NOTIFICATION_SETTINGS, categories: { ...DEFAULT_NOTIFICATION_SETTINGS.categories, runCompleted: true } },
            { cooldownHours: 0, extraAdminRecipients: ['X@Y.COM'] },
        )
        expect(merged.cooldownHours).toBe(0)
        expect(merged.categories.runCompleted).toBe(true)
        expect(merged.extraAdminRecipients).toEqual(['x@y.com'])
    })

    it('序列化后可无损解析', () => {
        const normalized = { ...DEFAULT_NOTIFICATION_SETTINGS, extraAdminRecipients: ['a@b.com'] }
        expect(parseNotificationSettingsJson(serializeNotificationSettings(normalized))).toEqual(normalized)
    })
})
