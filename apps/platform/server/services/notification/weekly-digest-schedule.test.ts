import { describe, expect, it } from 'vitest'
import {
    DEFAULT_WEEKLY_DIGEST_HOUR,
    isWeeklyDigestDue,
    parseWeeklyDigestHour,
    resolveIsoWeekKey,
    resolveWeeklyDigestHour,
    resolveWeeklyDigestSlot,
    WEEKLY_DIGEST_CATCH_UP_MS,
} from './weekly-digest-schedule'

/** 周汇总周期纯函数：ISO 周边界（注入本地时钟）+ 触发窗口 + 小时 env 解析。 */
describe('resolveIsoWeekKey', () => {
    it('按 ISO 8601 周计算，跨年与 53 周年正确', () => {
        expect(resolveIsoWeekKey(new Date(2026, 9, 24))).toBe('2026-W43')
        expect(resolveIsoWeekKey(new Date(2026, 9, 26))).toBe('2026-W44')
        // 2026 有 53 个 ISO 周：12-31（周四）与 2027-01-01（周五）同属 2026-W53
        expect(resolveIsoWeekKey(new Date(2026, 11, 31))).toBe('2026-W53')
        expect(resolveIsoWeekKey(new Date(2027, 0, 1))).toBe('2026-W53')
        expect(resolveIsoWeekKey(new Date(2027, 0, 4))).toBe('2027-W01')
        // 2021-01-01（周五）仍属 2020-W53；2024-12-30（周一）属 2025-W01
        expect(resolveIsoWeekKey(new Date(2021, 0, 1))).toBe('2020-W53')
        expect(resolveIsoWeekKey(new Date(2024, 11, 30))).toBe('2025-W01')
    })
})

describe('resolveWeeklyDigestSlot / isWeeklyDigestDue', () => {
    const hour = 9

    it('窗口起点为本周一 hour 时，下一窗口为下周一', () => {
        const slot = resolveWeeklyDigestSlot(new Date(2026, 9, 27, 8, 59), hour)
        expect(slot.weekKey).toBe('2026-W44')
        expect(slot.slotStart.getTime()).toBe(new Date(2026, 9, 26, 9, 0).getTime())
        expect(slot.nextSlotStart.getTime()).toBe(new Date(2026, 10, 2, 9, 0).getTime())
    })

    it('周一触发时刻前不触发，到达后 24 小时内触发（含补发），之后关闭', () => {
        expect(isWeeklyDigestDue(new Date(2026, 9, 26, 8, 59), hour)).toBe(false)
        expect(isWeeklyDigestDue(new Date(2026, 9, 26, 9, 0), hour)).toBe(true)
        expect(isWeeklyDigestDue(new Date(2026, 9, 26, 23, 59), hour)).toBe(true)
        expect(isWeeklyDigestDue(new Date(2026, 9, 27, 8, 59), hour)).toBe(true)
        expect(isWeeklyDigestDue(new Date(2026, 9, 27, 9, 0), hour)).toBe(false)
        expect(isWeeklyDigestDue(new Date(2026, 10, 1, 12, 0), hour)).toBe(false)
        expect(isWeeklyDigestDue(new Date(2026, 10, 2, 9, 0), hour)).toBe(true)
    })

    it('窗口长度常量为 24 小时', () => {
        expect(WEEKLY_DIGEST_CATCH_UP_MS).toBe(24 * 60 * 60 * 1000)
    })

    it('周日仍归属本周（下一窗口未到）且下一窗口键正确', () => {
        const slot = resolveWeeklyDigestSlot(new Date(2026, 10, 1, 12, 0), hour)
        expect(slot.weekKey).toBe('2026-W44')
        expect(isWeeklyDigestDue(new Date(2026, 10, 1, 12, 0), hour)).toBe(false)
    })
})

describe('parseWeeklyDigestHour / resolveWeeklyDigestHour', () => {
    it('未设置 / 空串 → 默认值且不算非法', () => {
        expect(parseWeeklyDigestHour(undefined)).toEqual({ hour: DEFAULT_WEEKLY_DIGEST_HOUR, invalid: false })
        expect(parseWeeklyDigestHour('  ')).toEqual({ hour: DEFAULT_WEEKLY_DIGEST_HOUR, invalid: false })
    })

    it('0-23 整数生效（含字符串形态）', () => {
        for (const raw of ['0', '9', '23', ' 7 ']) {
            const parsed = parseWeeklyDigestHour(raw)
            expect(parsed.invalid).toBe(false)
            expect(parsed.hour).toBe(Number(raw))
        }
    })

    it('非法值回退默认并标记 invalid（负数 / 越界 / 小数 / 非数字）', () => {
        for (const raw of ['-1', '24', '9.5', 'nine']) {
            expect(parseWeeklyDigestHour(raw)).toEqual({ hour: DEFAULT_WEEKLY_DIGEST_HOUR, invalid: true })
        }
    })

    it('resolveWeeklyDigestHour 显式参数优先（便于测试注入）', () => {
        expect(resolveWeeklyDigestHour('18')).toBe(18)
        expect(resolveWeeklyDigestHour('99')).toBe(DEFAULT_WEEKLY_DIGEST_HOUR)
    })
})
