import 'reflect-metadata'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setupMemoryDatabase, teardownMemoryDatabase } from '../../../tests/api-helper'
import { resolveNotificationRecipients } from './recipients'
import { DEFAULT_NOTIFICATION_SETTINGS } from './settings'
import { ensureDatabaseInitialized } from '#server/database'
import { NotificationPreference } from '#server/entities/notification-preference'
import { User } from '#server/entities/user'

let userSeq = 0
const makeUser = async (prefix: string, role: string, banned = false): Promise<User> => {
    const ds = await ensureDatabaseInitialized()
    const email = `${prefix}-${++userSeq}@x.com`
    return ds.getRepository(User).save(ds.getRepository(User).create({ email, name: email, role, banned }))
}

describe('resolveNotificationRecipients', () => {
    beforeEach(() => {
        setupMemoryDatabase()
        delete process.env.DEPENDFIX_ENV_ALERT_RECIPIENTS
        delete process.env.DEPENDFIX_NOTIFICATION_RECIPIENT_CAP
    })

    afterEach(() => {
        teardownMemoryDatabase()
        delete process.env.DEPENDFIX_ENV_ALERT_RECIPIENTS
        delete process.env.DEPENDFIX_NOTIFICATION_RECIPIENT_CAP
    })

    it('平台事件：默认管理员 + extra，env 覆盖优先', async () => {
        const admin = await makeUser('admin', 'admin')
        const org = await makeUser('org', 'org_admin')
        await makeUser('viewer', 'viewer')
        await makeUser('banned', 'admin', true)
        const settings = { ...DEFAULT_NOTIFICATION_SETTINGS, extraAdminRecipients: ['extra@x.com'] }

        const recipients = await resolveNotificationRecipients({ category: 'platform_incident', settings })
        expect(recipients.map((r) => r.email).sort()).toEqual([admin.email, 'extra@x.com', org.email].sort())

        process.env.DEPENDFIX_ENV_ALERT_RECIPIENTS = 'ops@x.com, admin@x.com'
        const overridden = await resolveNotificationRecipients({ category: 'platform_incident', settings })
        expect(overridden.map((r) => r.email)).toEqual(['ops@x.com', 'admin@x.com'])
    })

    it('业务事件：组织关闭 → 无收件人；viewer 即使触发也不接收', async () => {
        const viewer = await makeUser('viewer', 'viewer')
        const closed = { ...DEFAULT_NOTIFICATION_SETTINGS, categories: { ...DEFAULT_NOTIFICATION_SETTINGS.categories, securityHigh: false } }
        expect(await resolveNotificationRecipients({ category: 'security_high', settings: closed })).toEqual([])

        const recipients = await resolveNotificationRecipients({
            category: 'security_high',
            settings: DEFAULT_NOTIFICATION_SETTINGS,
            triggeredByUserId: viewer.id,
        })
        expect(recipients.map((r) => r.email)).not.toContain(viewer.email)
    })

    it('run_completed 默认关闭；触发者显式开启后才接收', async () => {
        const admin = await makeUser('admin', 'admin')
        const other = await makeUser('other', 'admin')
        const ds = await ensureDatabaseInitialized()
        await ds.getRepository(NotificationPreference).save(ds.getRepository(NotificationPreference).create({
            userId: admin.id,
            category: 'run_completed',
            channel: 'email',
            enabled: true,
        }))

        const settings = {
            ...DEFAULT_NOTIFICATION_SETTINGS,
            categories: { ...DEFAULT_NOTIFICATION_SETTINGS.categories, runCompleted: true },
        }
        const recipients = await resolveNotificationRecipients({
            category: 'run_completed',
            settings,
            triggeredByUserId: admin.id,
        })
        expect(recipients.map((r) => r.email)).toEqual([admin.email])
        expect(recipients.map((r) => r.email)).not.toContain(other.email)
    })

    it('收件人上限截断并去重', async () => {
        await makeUser('a', 'admin')
        await makeUser('b', 'admin')
        process.env.DEPENDFIX_NOTIFICATION_RECIPIENT_CAP = '1'
        const recipients = await resolveNotificationRecipients({
            category: 'platform_incident',
            settings: DEFAULT_NOTIFICATION_SETTINGS,
        })
        expect(recipients).toHaveLength(1)
    })
})
