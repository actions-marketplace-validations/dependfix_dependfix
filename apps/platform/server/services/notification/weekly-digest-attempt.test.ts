import { describe, expect, it } from 'vitest'
import {
    createWeeklyDigestAttemptState,
    reduceWeeklyDigestAttempt,
    WEEKLY_DIGEST_MAX_SEND_ATTEMPTS,
    WEEKLY_DIGEST_RETRY_BACKOFF_MS,
} from './weekly-digest-attempt'

const NOW = new Date(2026, 9, 26, 9, 1).getTime()

describe('周报尝试状态推进', () => {
    it('sent / 全量已发 为终态', () => {
        const base = createWeeklyDigestAttemptState('2026-W44')
        expect(reduceWeeklyDigestAttempt(base, 'sent', NOW).done).toBe(true)
        expect(reduceWeeklyDigestAttempt(base, 'skipped_duplicate', NOW).done).toBe(true)
    })

    it('partial / failed / noop 计次并退避 30 分钟', () => {
        const base = createWeeklyDigestAttemptState('2026-W44')
        for (const status of ['partial', 'failed', 'noop'] as const) {
            const next = reduceWeeklyDigestAttempt(base, status, NOW)
            expect(next.sendAttempts).toBe(1)
            expect(next.nextAttemptAtMs).toBe(NOW + WEEKLY_DIGEST_RETRY_BACKOFF_MS)
            expect(next.done).toBe(false)
        }
    })

    it('skipped_no_recipient 只退避不计次（窗口内开启开关仍可补发）', () => {
        const base = { ...createWeeklyDigestAttemptState('2026-W44'), sendAttempts: 3 }
        const next = reduceWeeklyDigestAttempt(base, 'skipped_no_recipient', NOW)
        expect(next.sendAttempts).toBe(3)
        expect(next.nextAttemptAtMs).toBe(NOW + WEEKLY_DIGEST_RETRY_BACKOFF_MS)
        expect(next.done).toBe(false)
    })

    it('配置关闭不占用本周：下一次节拍立即重查，但不清零已发生的发信尝试', () => {
        const base = { ...createWeeklyDigestAttemptState('2026-W44'), sendAttempts: 4, nextAttemptAtMs: NOW + 1 }
        for (const status of ['skipped_disabled', 'skipped_org_disabled'] as const) {
            const next = reduceWeeklyDigestAttempt(base, status, NOW)
            // 保留计数：避免「关一下再开」绕过单周尝试上界
            expect(next).toMatchObject({ sendAttempts: 4, nextAttemptAtMs: 0, done: false })
        }
    })

    it('发信尝试触顶后本周停止（无收件人尝试不消耗额度）', () => {
        let state = createWeeklyDigestAttemptState('2026-W44')
        for (let attempt = 1; attempt <= WEEKLY_DIGEST_MAX_SEND_ATTEMPTS; attempt++) {
            state = reduceWeeklyDigestAttempt(state, 'failed', NOW)
            expect(state.sendAttempts).toBe(attempt)
            expect(state.done).toBe(attempt >= WEEKLY_DIGEST_MAX_SEND_ATTEMPTS)
            // 终态不再排定下一次尝试
            expect(state.nextAttemptAtMs).toBe(attempt >= WEEKLY_DIGEST_MAX_SEND_ATTEMPTS ? 0 : NOW + WEEKLY_DIGEST_RETRY_BACKOFF_MS)
        }
        // 触顶后再来「无收件人」也不会复活（状态已终态，由插件侧 done 拦截）
        const afterCap = reduceWeeklyDigestAttempt(state, 'skipped_no_recipient', NOW + 1)
        expect(afterCap.sendAttempts).toBe(WEEKLY_DIGEST_MAX_SEND_ATTEMPTS)
    })

    it('未知状态按「不计次 + 退避」fail-safe 处理', () => {
        const base = createWeeklyDigestAttemptState('2026-W44')
        const next = reduceWeeklyDigestAttempt(base, 'unknown' as never, NOW)
        expect(next.sendAttempts).toBe(0)
        expect(next.nextAttemptAtMs).toBe(NOW + WEEKLY_DIGEST_RETRY_BACKOFF_MS)
        expect(next.done).toBe(false)
    })
})
