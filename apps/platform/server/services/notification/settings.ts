import { z } from 'zod'
import type { NotificationSettings } from './types'

const emailSchema = z.preprocess(
    (value) => typeof value === 'string' ? value.trim().toLowerCase() : value,
    z.email().max(255),
)

/** 组织通知设置（完整形状；`.strict()` 拒绝未知键）。 */
export const notificationSettingsSchema = z.object({
    categories: z.object({
        securityHigh: z.boolean(),
        runFailure: z.boolean(),
        runCompleted: z.boolean(),
        weeklyDigest: z.boolean(),
    }).strict(),
    severityThreshold: z.enum(['critical', 'high']),
    cooldownHours: z.number().int().min(0).max(168),
    maxPerHour: z.number().int().min(1).max(60),
    extraAdminRecipients: z.array(emailSchema).max(20),
}).strict()

/** PATCH 部分更新形状：嵌套 categories 也允许部分键。 */
export const notificationSettingsPatchSchema = z.object({
    categories: z.object({
        securityHigh: z.boolean().optional(),
        runFailure: z.boolean().optional(),
        runCompleted: z.boolean().optional(),
        weeklyDigest: z.boolean().optional(),
    }).strict().optional(),
    severityThreshold: z.enum(['critical', 'high']).optional(),
    cooldownHours: z.number().int().min(0).max(168).optional(),
    maxPerHour: z.number().int().min(1).max(60).optional(),
    extraAdminRecipients: z.array(emailSchema).max(20).optional(),
}).strict()

export type NotificationSettingsPatch = z.infer<typeof notificationSettingsPatchSchema>

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
    categories: {
        securityHigh: true,
        runFailure: true,
        runCompleted: false,
        weeklyDigest: false,
    },
    severityThreshold: 'high',
    cooldownHours: 24,
    maxPerHour: 6,
    extraAdminRecipients: [],
}

const cloneDefaults = (): NotificationSettings => ({
    ...DEFAULT_NOTIFICATION_SETTINGS,
    categories: { ...DEFAULT_NOTIFICATION_SETTINGS.categories },
    extraAdminRecipients: [],
})

/** 存储前规范化：邮箱 trim + 小写 + 去重（保持首次出现顺序）。 */
export const normalizeNotificationSettings = (settings: NotificationSettings): NotificationSettings => ({
    ...settings,
    extraAdminRecipients: [...new Set(settings.extraAdminRecipients.map((email) => email.trim().toLowerCase()).filter(Boolean))],
})

/**
 * 读取组织设置 JSON：null / 解析失败 / 形状非法 → 默认值降级并 warn（不阻断扫描）。
 */
export const parseNotificationSettingsJson = (
    raw: string | null | undefined,
    log: Pick<Console, 'warn'> = console,
): NotificationSettings => {
    if (!raw) {
        return cloneDefaults()
    }
    try {
        const parsed = notificationSettingsSchema.safeParse(JSON.parse(raw))
        if (!parsed.success) {
            log.warn(`[notification:settings] invalid organization settings; fallback to defaults: ${parsed.error.message}`)
            return cloneDefaults()
        }
        return normalizeNotificationSettings(parsed.data)
    } catch (error) {
        log.warn('[notification:settings] failed to parse organization settings; fallback to defaults:', error)
        return cloneDefaults()
    }
}

/** 合并 PATCH 与当前设置，并用完整 schema 校验（非法值抛 ZodError）。 */
export const mergeNotificationSettings = (
    current: NotificationSettings,
    patch: NotificationSettingsPatch,
): NotificationSettings => {
    const merged = {
        ...current,
        ...patch,
        categories: {
            ...current.categories,
            ...(patch.categories ?? {}),
        },
        extraAdminRecipients: patch.extraAdminRecipients ?? current.extraAdminRecipients,
    }
    return normalizeNotificationSettings(notificationSettingsSchema.parse(merged))
}

export const serializeNotificationSettings = (settings: NotificationSettings): string =>
    JSON.stringify(normalizeNotificationSettings(settings))
