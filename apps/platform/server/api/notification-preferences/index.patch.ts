import { z } from 'zod'
import { requireAuth } from '#server/utils/guard'
import { createLocalizedError } from '#server/utils/localized-error'
import { ensureDatabaseInitialized } from '#server/database'
import { NotificationPreference } from '#server/entities/notification-preference'
import { loadOrganizationNotificationSettings } from '#server/services/notification/delivery'
import { isDeploymentNotificationEnabled, normalizeNotificationRole, resolveNotificationPreferenceRows } from '#server/services/notification/preferences'
import { ORG_CATEGORY_KEYS, type BusinessNotificationCategory } from '#server/services/notification/types'

const bodySchema = z.object({
    preferences: z.object({
        security_high: z.boolean().optional(),
        run_failure: z.boolean().optional(),
        run_completed: z.boolean().optional(),
        weekly_digest: z.boolean().optional(),
    }).strict(),
}).strict()

/** PATCH /api/notification-preferences：更新本人业务类别开关（viewer / 组织关闭时拒绝）。 */
export default defineEventHandler(async (event) => {
    const { user, session } = await requireAuth(event)
    const role = normalizeNotificationRole(session.user.role)
    if (role === 'viewer') {
        throw createLocalizedError(event, { statusCode: 403, code: 'NOTIFICATION_VIEWER_FORBIDDEN' })
    }

    const body = await readBody<Record<string, unknown>>(event).catch(() => ({}))
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
        throw createLocalizedError(event, {
            statusCode: 400,
            code: 'NOTIFICATION_PREFERENCE_VALIDATION_FAILED',
            data: { issues: parsed.error.issues },
        })
    }
    const entries = Object.entries(parsed.data.preferences) as [BusinessNotificationCategory, boolean][]
    if (entries.length === 0) {
        throw createLocalizedError(event, { statusCode: 400, code: 'NOTIFICATION_PREFERENCE_EMPTY' })
    }

    const ds = await ensureDatabaseInitialized()
    const { settings } = await loadOrganizationNotificationSettings()
    for (const [category] of entries) {
        if (!settings.categories[ORG_CATEGORY_KEYS[category]]) {
            throw createLocalizedError(event, {
                statusCode: 400,
                code: 'NOTIFICATION_CATEGORY_DISABLED',
                data: { category },
            })
        }
    }

    const repo = ds.getRepository(NotificationPreference)
    for (const [category, enabled] of entries) {
        const existing = await repo.findOne({ where: { userId: user.id, category, channel: 'email' } })
        if (existing) {
            existing.enabled = enabled
            await repo.save(existing)
        } else {
            await repo.save(repo.create({ userId: user.id, category, channel: 'email', enabled }))
        }
    }

    const rows = await repo.find({ where: { userId: user.id, channel: 'email' } })
    const overrides = Object.fromEntries(rows.map((row) => [row.category, row.enabled]))
    return {
        categories: resolveNotificationPreferenceRows({
            role,
            settings,
            overrides,
            deploymentEnabled: isDeploymentNotificationEnabled(),
        }),
    }
})
