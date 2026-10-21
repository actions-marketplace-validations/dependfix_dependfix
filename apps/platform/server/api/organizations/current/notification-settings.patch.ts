import { requireRole } from '#server/utils/guard'
import { createLocalizedError } from '#server/utils/localized-error'
import { ensureDatabaseInitialized } from '#server/database'
import { Organization } from '#server/entities/organization'
import { AuditEvent } from '#server/entities/audit-event'
import { resolveOrganizationId } from '#server/utils/organization'
import { mergeNotificationSettings, notificationSettingsPatchSchema, parseNotificationSettingsJson, serializeNotificationSettings } from '#server/services/notification/settings'

/** PATCH /api/organizations/current/notification-settings：组织通知设置（admin / org_admin，Zod strict）。 */
export default defineEventHandler(async (event) => {
    await requireRole(event, ['admin', 'org_admin'])
    const body = await readBody<Record<string, unknown>>(event).catch(() => ({}))
    const parsed = notificationSettingsPatchSchema.safeParse(body)
    if (!parsed.success) {
        throw createLocalizedError(event, {
            statusCode: 400,
            code: 'NOTIFICATION_SETTINGS_VALIDATION_FAILED',
            data: { issues: parsed.error.issues },
        })
    }

    const ds = await ensureDatabaseInitialized()
    const organizationId = await resolveOrganizationId(ds)
    const repo = ds.getRepository(Organization)
    const org = await repo.findOne({ where: { id: organizationId } })
    if (!org) {
        throw createLocalizedError(event, { statusCode: 404, code: 'ORG_NOT_FOUND' })
    }
    const current = parseNotificationSettingsJson(org.notificationSettingsJson)
    let merged
    try {
        merged = mergeNotificationSettings(current, parsed.data)
    } catch (error) {
        throw createLocalizedError(event, {
            statusCode: 400,
            code: 'NOTIFICATION_SETTINGS_VALIDATION_FAILED',
            data: { message: error instanceof Error ? error.message : String(error) },
        })
    }
    const before = current
    org.notificationSettingsJson = serializeNotificationSettings(merged)
    // 设置与审计同事务，避免写设置成功但审计失败导致 500 + 半落库
    await ds.transaction(async (manager) => {
        await manager.getRepository(Organization).save(org)
        const auditRepo = manager.getRepository(AuditEvent)
        await auditRepo.save(auditRepo.create({
            type: 'notification_settings_update',
            severity: 'info',
            repositoryId: null,
            scanRunId: null,
            payloadJson: JSON.stringify({
                scope: 'organization',
                organizationId,
                before,
                after: merged,
            }),
            notified: false,
            notifiedVia: null,
        }))
    })
    return { settings: merged }
})
