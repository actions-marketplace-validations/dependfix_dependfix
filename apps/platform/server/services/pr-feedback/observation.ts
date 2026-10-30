// observation.ts — PR 回环反馈的「观察态」判定（纯函数，无 IO）。
//
// 观察态的唯一事实源是数据库：`ScanRun.prNumber`（平台交付过 PR）+ `PRCheck`（监测器采集结果）。
// 本模块只负责「这条 PR 现在还该不该被反馈服务处理」，口径见
// docs/design/governance/pr-feedback-loop.md §3 / §5。

/** 默认观察窗口（小时）：自交付时刻起 24h 内可评论 / 关闭，超窗停止观察。 */
export const PR_FEEDBACK_DEFAULT_WINDOW_HOURS = 24

/** 观察窗口的参照时刻来源（按优先级）。 */
export interface PrFeedbackReference {
    /** 平台交付完成时刻（`ScanRun.finishedAt`） */
    runFinishedAt?: Date | string | null
    /** 落库的 PRCheck 行创建时刻（回退来源） */
    prCheckCreatedAt?: Date | string | null
}

const toTime = (value: Date | string | null | undefined): number | null => {
    if (value instanceof Date) {
        const time = value.getTime()
        return Number.isFinite(time) ? time : null
    }
    if (typeof value === 'string' && value.trim().length > 0) {
        const time = new Date(value).getTime()
        return Number.isFinite(time) ? time : null
    }
    return null
}

/** 取观察窗口的参照时刻（交付时刻优先，缺失回退 PRCheck 创建时刻；都不可得 → null）。 */
export function pickFeedbackReferenceAt(reference: PrFeedbackReference): number | null {
    return toTime(reference.runFinishedAt) ?? toTime(reference.prCheckCreatedAt)
}

/**
 * 观察是否仍在窗口内。
 *
 * - `prNumber` 非正整数（非 PR 交付 / 历史行）→ 不在观察态
 * - `windowHours <= 0` → 停止观察（显式关闭）
 * - 参照时刻不可得 → 不在观察态（**fail-safe**：宁可不动，也不对来历不明的历史 PR 做不可逆动作）
 * - `now <= reference + window` → 在窗口内（边界时刻算在窗口内）
 */
export function isPrFeedbackObservationOpen(params: {
    prNumber: number | null | undefined
    reference: PrFeedbackReference
    now: Date
    windowHours?: number
}): boolean {
    const prNumber = params.prNumber
    if (typeof prNumber !== 'number' || !Number.isInteger(prNumber) || prNumber <= 0) {
        return false
    }
    const windowHours = params.windowHours ?? PR_FEEDBACK_DEFAULT_WINDOW_HOURS
    if (!Number.isFinite(windowHours) || windowHours <= 0) {
        return false
    }
    const referenceAt = pickFeedbackReferenceAt(params.reference)
    if (referenceAt === null) {
        return false
    }
    const now = params.now.getTime()
    if (!Number.isFinite(now)) {
        return false
    }
    return now <= referenceAt + windowHours * 3_600_000
}
