import {
    BUSINESS_NOTIFICATION_CATEGORIES,
    ORG_CATEGORY_KEYS,
    type BusinessNotificationCategory,
    type EffectiveNotificationPreference,
    type NotificationRole,
    type NotificationSettings,
} from './types'

/** 角色默认值（无偏好行时生效；viewer 不接收业务类通知）。 */
export const ROLE_NOTIFICATION_DEFAULTS: Record<NotificationRole, Record<BusinessNotificationCategory, boolean>> = {
    admin: {
        security_high: true,
        run_failure: true,
        run_completed: false,
        weekly_digest: false,
    },
    org_admin: {
        security_high: true,
        run_failure: true,
        run_completed: false,
        weekly_digest: false,
    },
    viewer: {
        security_high: false,
        run_failure: false,
        run_completed: false,
        weekly_digest: false,
    },
}

export const normalizeNotificationRole = (raw: string | null | undefined): NotificationRole => {
    if (raw === 'admin' || raw === 'org_admin') {
        return raw
    }
    return 'viewer'
}

/** 部署层总开关（仅 `false` 熔断；未设置 / 其它值视为开启）。 */
export const isDeploymentNotificationEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
    env.DEPENDFIX_NOTIFICATION_ENABLED !== 'false'

/**
 * 解析单个业务类别的生效值：
 * - viewer → 永不可接收且不可编辑；
 * - 组织关闭 → 不可接收且不可编辑（个人无法越权开启）；
 * - 无偏好行 → 取角色默认；
 * - 部署总开关关闭 → 全部不可接收（但 editable 仍按组织 / 角色判定，便于 UI 展示配置）。
 */
export const resolveEffectiveNotificationPreference = (input: {
    category: BusinessNotificationCategory
    role: NotificationRole
    settings: NotificationSettings
    userEnabled?: boolean
    deploymentEnabled?: boolean
}): EffectiveNotificationPreference => {
    const { category, role, settings, userEnabled, deploymentEnabled = true } = input
    const orgEnabled = settings.categories[ORG_CATEGORY_KEYS[category]]
    const roleDefault = ROLE_NOTIFICATION_DEFAULTS[role][category]
    const resolvedUserEnabled = userEnabled ?? roleDefault

    if (role === 'viewer') {
        return {
            category,
            enabled: false,
            orgEnabled,
            userEnabled: resolvedUserEnabled,
            roleDefault,
            editable: false,
            reason: 'viewer',
        }
    }
    if (!orgEnabled) {
        return {
            category,
            enabled: false,
            orgEnabled,
            userEnabled: resolvedUserEnabled,
            roleDefault,
            editable: false,
            reason: 'org_disabled',
        }
    }
    return {
        category,
        enabled: deploymentEnabled && orgEnabled && resolvedUserEnabled,
        orgEnabled,
        userEnabled: resolvedUserEnabled,
        roleDefault,
        editable: true,
    }
}

/** 批量解析（个人设置页 / 路由共用）。 */
export const resolveAllNotificationPreferences = (input: {
    role: NotificationRole
    settings: NotificationSettings
    overrides?: Partial<Record<BusinessNotificationCategory, boolean>>
    deploymentEnabled?: boolean
}): EffectiveNotificationPreference[] => BUSINESS_NOTIFICATION_CATEGORIES.map((category) =>
    resolveEffectiveNotificationPreference({
        category,
        role: input.role,
        settings: input.settings,
        userEnabled: input.overrides?.[category],
        deploymentEnabled: input.deploymentEnabled,
    }),
)

/** 必选类别：仅受部署总开关约束（组织 / 个人不可关闭）。 */
export const isPlatformIncidentEnabled = (deploymentEnabled = true): boolean => deploymentEnabled
