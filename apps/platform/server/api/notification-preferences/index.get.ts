import { requireAuth } from '#server/utils/guard'
import { ensureDatabaseInitialized } from '#server/database'
import { NotificationPreference } from '#server/entities/notification-preference'
import { loadOrganizationNotificationSettings } from '#server/services/notification/delivery'
import { isDeploymentNotificationEnabled, normalizeNotificationRole, resolveNotificationPreferenceRows } from '#server/services/notification/preferences'
import { listNotificationChannels } from '#server/services/notification/registry'

/** GET /api/notification-preferences：个人偏好覆盖 + 角色默认 + 生效值。 */
export default defineEventHandler(async (event) => {
    const { user, session } = await requireAuth(event)
    const ds = await ensureDatabaseInitialized()
    const { settings } = await loadOrganizationNotificationSettings()
    const rows = await ds.getRepository(NotificationPreference).find({
        where: { userId: user.id, channel: 'email' },
    })
    const overrides = Object.fromEntries(rows.map((row) => [row.category, row.enabled]))
    const role = normalizeNotificationRole(session.user.role)
    const channelAvailable = listNotificationChannels().some((channel) => channel.name === 'email' && channel.isAvailable())

    return {
        role,
        channelAvailable,
        deploymentEnabled: isDeploymentNotificationEnabled(),
        categories: resolveNotificationPreferenceRows({
            role,
            settings,
            overrides,
            deploymentEnabled: isDeploymentNotificationEnabled(),
        }),
    }
})
