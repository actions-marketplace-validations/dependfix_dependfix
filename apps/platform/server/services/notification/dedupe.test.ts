import { describe, expect, it } from 'vitest'
import {
    buildDigestDeliveryKey,
    buildNotificationDeliveryKey,
    computeAttemptWindow,
    computeNotificationFingerprint,
    isNotificationCooldownActive,
    isNotificationThrottled,
} from './dedupe'

describe('通知指纹与降噪纯函数', () => {
    it('指纹按输入排序后稳定，与输入顺序无关', () => {
        const a = computeNotificationFingerprint(['repo2:2', 'repo1:1'])
        const b = computeNotificationFingerprint(['repo1:1', 'repo2:2'])
        expect(a).toBe(b)
        expect(a).toHaveLength(16)
        expect(computeNotificationFingerprint(['repo1:1'])).not.toBe(a)
    })

    it('attemptWindow：24h 窗口按天分桶；0 小时回落 1 分钟', () => {
        const now = Date.UTC(2026, 9, 21, 12, 0, 0)
        expect(computeAttemptWindow(now, 24)).toBe(Math.floor(now / 86_400_000))
        expect(computeAttemptWindow(now, 0)).toBe(Math.floor(now / 60_000))
    })

    it('deliveryKey 对同一窗口稳定，跨窗口变化', () => {
        const base = { scopeType: 'batch', scopeId: 'b1', category: 'security_high', fingerprint: 'abc', cooldownHours: 24 }
        const day1 = buildNotificationDeliveryKey({ ...base, now: Date.UTC(2026, 9, 21, 12) })
        const day1Later = buildNotificationDeliveryKey({ ...base, now: Date.UTC(2026, 9, 21, 23) })
        const day2 = buildNotificationDeliveryKey({ ...base, now: Date.UTC(2026, 9, 22, 12) })
        expect(day1).toBe(day1Later)
        expect(day1).not.toBe(day2)
    })

    it('冷却窗口：0 小时不冷却；窗口内冷却、窗口外放行', () => {
        const now = new Date('2026-10-21T12:00:00.000Z')
        expect(isNotificationCooldownActive(new Date('2026-10-21T11:00:00.000Z'), now, 0)).toBe(false)
        expect(isNotificationCooldownActive(new Date('2026-10-21T11:00:00.000Z'), now, 24)).toBe(true)
        expect(isNotificationCooldownActive(new Date('2026-10-20T11:00:00.000Z'), now, 24)).toBe(false)
    })

    it('每小时上限：达到即限流', () => {
        expect(isNotificationThrottled(5, 6)).toBe(false)
        expect(isNotificationThrottled(6, 6)).toBe(true)
    })

    it('周报投递键：同一用户 + 渠道 + 周稳定；周 / 用户 / 渠道任一变化即不同', () => {
        const base = buildDigestDeliveryKey('2026-W44', 'user-1', 'email')
        expect(base).toBe(buildDigestDeliveryKey('2026-W44', 'user-1', 'email'))
        expect(base).toHaveLength(64)
        expect(buildDigestDeliveryKey('2026-W45', 'user-1', 'email')).not.toBe(base)
        expect(buildDigestDeliveryKey('2026-W44', 'user-2', 'email')).not.toBe(base)
        expect(buildDigestDeliveryKey('2026-W44', 'user-1', 'slack')).not.toBe(base)
    })
})
