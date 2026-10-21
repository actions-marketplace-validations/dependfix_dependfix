import { createHash } from 'node:crypto'

/** 内容指纹：sha256(sorted(repositoryId + ':' + upstreamId)) 前 16 位。 */
export const computeNotificationFingerprint = (keys: readonly string[]): string =>
    createHash('sha256').update([...keys].sort().join('|')).digest('hex').slice(0, 16)

/**
 * 并发占位窗口：cooldownHours=0 时回落 1 分钟，避免除零。
 * 同一窗口内的重复尝试共享 deliveryKey，由唯一约束兜底。
 */
export const computeAttemptWindow = (now: number, cooldownHours: number): number => {
    const windowMs = Math.max(cooldownHours * 3_600_000, 60_000)
    return Math.floor(now / windowMs)
}

/** 常规业务投递键（仅用于并发占位，不承担内容变化判定）。 */
export const buildNotificationDeliveryKey = (input: {
    scopeType: string
    scopeId: string
    category: string
    fingerprint: string
    now: number
    cooldownHours: number
}): string => createHash('sha256')
    .update([
        input.scopeType,
        input.scopeId,
        input.category,
        input.fingerprint,
        String(computeAttemptWindow(input.now, input.cooldownHours)),
    ].join(':'))
    .digest('hex')

/** 平台事件按 auditId 幂等（不参与指纹 / 冷却）。 */
export const buildPlatformDeliveryKey = (auditId: string): string => `platform:${auditId}`

/** 距上次发送是否仍在冷却窗口内（cooldownHours=0 → 永不冷却）。 */
export const isNotificationCooldownActive = (
    lastSentAt: Date | null | undefined,
    now: Date,
    cooldownHours: number,
): boolean => {
    if (!lastSentAt || cooldownHours <= 0) {
        return false
    }
    return now.getTime() - lastSentAt.getTime() < cooldownHours * 3_600_000
}

/** 每小时上限判定（>= maxPerHour 即限流）。 */
export const isNotificationThrottled = (sentInLastHour: number, maxPerHour: number): boolean =>
    sentInLastHour >= maxPerHour
