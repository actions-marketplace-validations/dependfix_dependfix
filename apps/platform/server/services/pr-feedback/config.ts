// config.ts — 仓库级 PR 回环反馈配置（`Repository.prFeedback` JSON 列）。
//
// 解析原则（与平台其他 JSON 列同口径）：缺省 → 全默认；未知键忽略并 warn；非法值回退该键默认。
// 口径见 docs/design/governance/pr-feedback-loop.md §7。

/** 仓库级 PR 回环反馈配置。 */
export interface PrFeedbackConfig {
    /** 失败时在 PR 上评论（默认开：本特性的主价值） */
    comment: boolean
    /** 失败时关闭 PR（默认关：不可逆） */
    closeFailed: boolean
    /** 失败时重新触发修复链（默认关；本批未实现，仅解析） */
    retryFailed: boolean
    /** 观察窗口（小时；0 = 停止观察） */
    windowHours: number
}

/** 缺省值（无配置 / 解析失败一律回退到此）。 */
export const DEFAULT_PR_FEEDBACK_CONFIG: PrFeedbackConfig = {
    comment: true,
    closeFailed: false,
    retryFailed: false,
    windowHours: 24,
}

/** 观察窗口上限（7 天；超过按上限截断，避免无限观察历史 PR）。 */
export const MAX_PR_FEEDBACK_WINDOW_HOURS = 168

const pickBoolean = (value: unknown, fallback: boolean): boolean =>
    typeof value === 'boolean' ? value : fallback

const pickWindowHours = (value: unknown, fallback: number): number => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        return fallback
    }
    return Math.min(Math.floor(value), MAX_PR_FEEDBACK_WINDOW_HOURS)
}

/**
 * 解析仓库级配置。
 *
 * - `null` / 空串 / 非对象 JSON → 全默认（fail-safe，不抛错）
 * - 未知键忽略（不阻断；调用方可用返回值不做处理）
 * - 单键类型非法 → 仅该键回退默认
 */
export function parsePrFeedbackConfig(raw: string | null | undefined): PrFeedbackConfig {
    const text = raw?.trim()
    if (!text) {
        return { ...DEFAULT_PR_FEEDBACK_CONFIG }
    }
    let parsed: unknown
    try {
        parsed = JSON.parse(text)
    } catch {
        return { ...DEFAULT_PR_FEEDBACK_CONFIG }
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ...DEFAULT_PR_FEEDBACK_CONFIG }
    }
    const record = parsed as Record<string, unknown>
    const config: PrFeedbackConfig = { ...DEFAULT_PR_FEEDBACK_CONFIG }
    config.comment = pickBoolean(record.comment, DEFAULT_PR_FEEDBACK_CONFIG.comment)
    config.closeFailed = pickBoolean(record.closeFailed, DEFAULT_PR_FEEDBACK_CONFIG.closeFailed)
    config.retryFailed = pickBoolean(record.retryFailed, DEFAULT_PR_FEEDBACK_CONFIG.retryFailed)
    config.windowHours = pickWindowHours(record.windowHours, DEFAULT_PR_FEEDBACK_CONFIG.windowHours)
    return config
}

/** 序列化（API / 测试写库用）：只写已知键，保持稳定顺序。 */
export function serializePrFeedbackConfig(config: PrFeedbackConfig): string {
    return JSON.stringify({
        comment: config.comment,
        closeFailed: config.closeFailed,
        retryFailed: config.retryFailed,
        windowHours: config.windowHours,
    })
}
