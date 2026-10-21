import { requireRole } from '#server/utils/guard'
import { loadOrganizationNotificationSettings } from '#server/services/notification/delivery'
import { listNotificationChannels } from '#server/services/notification/registry'
import { isDeploymentNotificationEnabled } from '#server/services/notification/preferences'

/** GET /api/organizations/current/notification-settings：组织通知设置（admin / org_admin）。 */
export default defineEventHandler(async (event) => {
    await requireRole(event, ['admin', 'org_admin'])
    const { settings } = await loadOrganizationNotificationSettings()
    return {
        settings,
        channelAvailable: listNotificationChannels().some((channel) => channel.name === 'email' && channel.isAvailable()),
        deploymentEnabled: isDeploymentNotificationEnabled(),
    }
})
