import { In } from 'typeorm'
import { normalizeNotificationRole, resolveEffectiveNotificationPreference } from './preferences'
import { ORG_CATEGORY_KEYS, type BusinessNotificationCategory, type NotificationCategory, type NotificationRecipient, type NotificationRole, type NotificationSettings } from './types'
import { ensureDatabaseInitialized } from '#server/database'
import { NotificationPreference } from '#server/entities/notification-preference'
import { User } from '#server/entities/user'

const ENV_OVERRIDE_KEY = 'DEPENDFIX_ENV_ALERT_RECIPIENTS'
const RECIPIENT_CAP_ENV = 'DEPENDFIX_NOTIFICATION_RECIPIENT_CAP'
const DEFAULT_RECIPIENT_CAP = 50
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const parseCap = (raw: string | undefined): number => {
    const value = Number(raw)
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_RECIPIENT_CAP
}

const normalizeEmails = (emails: readonly string[]): string[] => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const raw of emails) {
        const email = raw.trim().toLowerCase()
        if (!email || !EMAIL_RE.test(email) || seen.has(email)) {
            continue
        }
        seen.add(email)
        out.push(email)
    }
    return out
}

const truncate = (recipients: NotificationRecipient[]): NotificationRecipient[] => {
    const cap = parseCap(process.env[RECIPIENT_CAP_ENV])
    if (recipients.length <= cap) {
        return recipients
    }
    console.warn(`[notification:recipients] recipient cap ${cap} exceeded; truncating ${recipients.length} → ${cap}`)
    return recipients.slice(0, cap)
}

interface CandidateUser {
    id: string
    email: string
    role: NotificationRole
}

const toCandidate = (user: User): CandidateUser | null => {
    const email = user.email?.trim().toLowerCase()
    if (!email || !EMAIL_RE.test(email) || user.banned) {
        return null
    }
    return { id: user.id, email, role: normalizeNotificationRole(user.role) }
}

const loadAdminCandidates = async (): Promise<CandidateUser[]> => {
    try {
        const ds = await ensureDatabaseInitialized()
        const users = await ds.getRepository(User).find({
            where: [
                { role: 'admin', banned: false },
                { role: 'org_admin', banned: false },
            ],
        })
        return users.map(toCandidate).filter((user): user is CandidateUser => user !== null)
    } catch (error) {
        console.error('[notification:recipients] failed to query admin users:', error)
        return []
    }
}

const loadTriggeredCandidate = async (userId: string | null | undefined): Promise<CandidateUser | null> => {
    if (!userId) {
        return null
    }
    try {
        const ds = await ensureDatabaseInitialized()
        const user = await ds.getRepository(User).findOne({ where: { id: userId } })
        return user ? toCandidate(user) : null
    } catch (error) {
        console.error('[notification:recipients] failed to query triggered user:', error)
        return null
    }
}

const loadPreferenceOverrides = async (
    userIds: string[],
    categories: readonly BusinessNotificationCategory[],
): Promise<Map<string, Map<BusinessNotificationCategory, boolean>>> => {
    const map = new Map<string, Map<BusinessNotificationCategory, boolean>>()
    if (userIds.length === 0) {
        return map
    }
    try {
        const ds = await ensureDatabaseInitialized()
        const rows = await ds.getRepository(NotificationPreference).find({
            where: {
                userId: In(userIds),
                category: In([...categories]) as never,
                channel: 'email',
            },
        })
        for (const row of rows) {
            const byCategory = map.get(row.userId) ?? new Map()
            byCategory.set(row.category, row.enabled)
            map.set(row.userId, byCategory)
        }
    } catch (error) {
        console.error('[notification:recipients] failed to query preferences:', error)
    }
    return map
}

export interface ResolveRecipientsInput {
    category: NotificationCategory
    settings: NotificationSettings
    triggeredByUserId?: string | null
    deploymentEnabled?: boolean
}

/**
 * 收件人路由（设计稿 §5）：
 * - platform_incident：env 覆盖优先；否则 admin / org_admin + extraAdminRecipients
 * - security_high / run_failure：触发者（有效时）+ 管理员（个人生效）+ extra
 * - run_completed：触发者 + 管理员（个人开启，默认关）+ extra
 * - weekly_digest：管理员（个人开启）+ extra
 * 统一按邮箱去重、格式校验与上限截断。
 */
export const resolveNotificationRecipients = async (input: ResolveRecipientsInput): Promise<NotificationRecipient[]> => {
    if (input.deploymentEnabled === false) {
        return []
    }
    if (input.category === 'platform_incident') {
        const env = process.env[ENV_OVERRIDE_KEY]
        if (env?.trim()) {
            return truncate(normalizeEmails(env.split(',')).map((email) => ({ userId: '', email, role: 'admin' })))
        }
        const admins = await loadAdminCandidates()
        const recipients = admins.map((user) => ({ userId: user.id, email: user.email, role: user.role }))
        for (const email of normalizeEmails(input.settings.extraAdminRecipients)) {
            recipients.push({ userId: '', email, role: 'admin' })
        }
        return truncate(dedupeRecipients(recipients))
    }

    const orgKey = ORG_CATEGORY_KEYS[input.category]
    if (!input.settings.categories[orgKey]) {
        return []
    }

    const admins = await loadAdminCandidates()
    const triggered = await loadTriggeredCandidate(input.triggeredByUserId)
    const candidates = [...admins]
    if (triggered && !candidates.some((user) => user.id === triggered.id)) {
        candidates.push(triggered)
    }
    const preferences = await loadPreferenceOverrides(
        candidates.map((user) => user.id),
        [input.category],
    )

    const recipients: NotificationRecipient[] = []
    for (const user of candidates) {
        const effective = resolveEffectiveNotificationPreference({
            category: input.category,
            role: user.role,
            settings: input.settings,
            userEnabled: preferences.get(user.id)?.get(input.category),
            deploymentEnabled: input.deploymentEnabled,
        })
        if (effective.enabled) {
            recipients.push({ userId: user.id, email: user.email, role: user.role })
        }
    }
    for (const email of normalizeEmails(input.settings.extraAdminRecipients)) {
        recipients.push({ userId: '', email, role: 'admin' })
    }
    return truncate(dedupeRecipients(recipients))
}

const dedupeRecipients = (recipients: NotificationRecipient[]): NotificationRecipient[] => {
    const seen = new Set<string>()
    return recipients.filter((recipient) => {
        const email = recipient.email.toLowerCase()
        if (seen.has(email)) {
            return false
        }
        seen.add(email)
        return true
    })
}
