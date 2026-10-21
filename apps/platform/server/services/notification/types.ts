/** 平台通知类别（见 docs/design/governance/platform-notification.md §3）。 */
export const NOTIFICATION_CATEGORIES = [
    'platform_incident',
    'security_high',
    'run_failure',
    'run_completed',
    'weekly_digest',
] as const

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]

/** 可由组织 / 个人配置的业务类别（平台事件必选）。 */
export type BusinessNotificationCategory = Exclude<NotificationCategory, 'platform_incident'>

export const BUSINESS_NOTIFICATION_CATEGORIES: readonly BusinessNotificationCategory[] = [
    'security_high',
    'run_failure',
    'run_completed',
    'weekly_digest',
] as const

/** 标题类别标签（设计稿 §10）。 */
export const NOTIFICATION_CATEGORY_TAGS: Record<NotificationCategory, string> = {
    platform_incident: '[平台]',
    security_high: '[告警]',
    run_failure: '[运行]',
    run_completed: '[摘要]',
    weekly_digest: '[周报]',
}

/** 组织设置 JSON 的类别键（与个人偏好 category 值的映射单一事实源）。 */
export const ORG_CATEGORY_KEYS: Record<BusinessNotificationCategory, 'securityHigh' | 'runFailure' | 'runCompleted' | 'weeklyDigest'> = {
    security_high: 'securityHigh',
    run_failure: 'runFailure',
    run_completed: 'runCompleted',
    weekly_digest: 'weeklyDigest',
}

export type NotificationRole = 'admin' | 'org_admin' | 'viewer'

export interface NotificationSettings {
    categories: {
        securityHigh: boolean
        runFailure: boolean
        runCompleted: boolean
        weeklyDigest: boolean
    }
    severityThreshold: 'critical' | 'high'
    cooldownHours: number
    maxPerHour: number
    extraAdminRecipients: string[]
}

export interface EffectiveNotificationPreference {
    category: BusinessNotificationCategory
    /** 最终是否接收（组织 + 个人 + 角色约束后） */
    enabled: boolean
    /** 组织层是否开启 */
    orgEnabled: boolean
    /** 个人层值；无偏好行时取角色默认 */
    userEnabled: boolean
    /** 无偏好行时的角色默认值 */
    roleDefault: boolean
    /** 是否允许当前用户修改（viewer / 组织关闭时为 false） */
    editable: boolean
    /** 不可修改原因（UI 文案键） */
    reason?: 'viewer' | 'org_disabled'
}

/** 收件人（含 userId 便于日志 / 周报逐用户投递）。 */
export interface NotificationRecipient {
    userId: string
    email: string
    role: NotificationRole
}

/** 投递结果（供调用方更新 AuditEvent / 测试断言）。 */
export interface NotificationDispatchResult {
    status: 'sent' | 'noop' | 'failed' | 'skipped_duplicate' | 'skipped_cooldown' | 'skipped_throttled' | 'skipped_no_recipient'
    delivered: boolean
    channel: string | null
    recipientCount: number
    messageId?: string
}
