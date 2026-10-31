import { describe, expect, it } from 'vitest'
import {
    isPrFeedbackObservationOpen,
    pickFeedbackReferenceAt,
    PR_FEEDBACK_DEFAULT_WINDOW_HOURS,
} from './observation'

const now = new Date('2026-10-30T12:00:00Z')
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000)

describe('pr-feedback observation', () => {
    it('交付时刻起默认窗口内为观察态；超窗即停止', () => {
        expect(isPrFeedbackObservationOpen({ prNumber: 7, reference: { runFinishedAt: hoursAgo(1) }, now })).toBe(true)
        expect(isPrFeedbackObservationOpen({ prNumber: 7, reference: { runFinishedAt: hoursAgo(23) }, now })).toBe(true)
        expect(isPrFeedbackObservationOpen({
            prNumber: 7,
            reference: { runFinishedAt: hoursAgo(PR_FEEDBACK_DEFAULT_WINDOW_HOURS + 1) },
            now,
        })).toBe(false)
    })

    it('边界时刻算在窗口内（now === reference + window）', () => {
        const reference = new Date(now.getTime() - PR_FEEDBACK_DEFAULT_WINDOW_HOURS * 3_600_000)
        expect(isPrFeedbackObservationOpen({ prNumber: 7, reference: { runFinishedAt: reference }, now })).toBe(true)
        expect(isPrFeedbackObservationOpen({
            prNumber: 7,
            reference: { runFinishedAt: new Date(reference.getTime() - 1) },
            now,
        })).toBe(false)
    })

    it('非 PR 交付 / 无参照时刻 / 非法 prNumber 一律不在观察态（fail-safe）', () => {
        expect(isPrFeedbackObservationOpen({ prNumber: null, reference: { runFinishedAt: hoursAgo(1) }, now })).toBe(false)
        expect(isPrFeedbackObservationOpen({ prNumber: 0, reference: { runFinishedAt: hoursAgo(1) }, now })).toBe(false)
        expect(isPrFeedbackObservationOpen({ prNumber: 1.5, reference: { runFinishedAt: hoursAgo(1) }, now })).toBe(false)
        expect(isPrFeedbackObservationOpen({ prNumber: 7, reference: {}, now })).toBe(false)
        expect(isPrFeedbackObservationOpen({ prNumber: 7, reference: { runFinishedAt: 'not-a-date' }, now })).toBe(false)
    })

    it('windowHours <= 0 显式关闭观察；自定义窗口生效', () => {
        expect(isPrFeedbackObservationOpen({ prNumber: 7, reference: { runFinishedAt: hoursAgo(1) }, now, windowHours: 0 })).toBe(false)
        expect(isPrFeedbackObservationOpen({ prNumber: 7, reference: { runFinishedAt: hoursAgo(2) }, now, windowHours: 1 })).toBe(false)
        expect(isPrFeedbackObservationOpen({ prNumber: 7, reference: { runFinishedAt: hoursAgo(2) }, now, windowHours: 3 })).toBe(true)
    })

    it('参照时刻优先交付时刻，缺失回退 PRCheck 创建时刻（支持 ISO 字符串）', () => {
        expect(pickFeedbackReferenceAt({
            runFinishedAt: '2026-10-30T10:00:00Z',
            prCheckCreatedAt: '2026-10-30T11:00:00Z',
        })).toBe(Date.parse('2026-10-30T10:00:00Z'))
        expect(pickFeedbackReferenceAt({ prCheckCreatedAt: '2026-10-30T11:00:00Z' }))
            .toBe(Date.parse('2026-10-30T11:00:00Z'))
        expect(pickFeedbackReferenceAt({ runFinishedAt: 'invalid', prCheckCreatedAt: '2026-10-30T11:00:00Z' }))
            .toBe(Date.parse('2026-10-30T11:00:00Z'))
        expect(pickFeedbackReferenceAt({})).toBeNull()
    })
})
