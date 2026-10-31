import type { WeeklyDigestStatus } from './weekly-digest.service'

/**
 * 周汇总的重试节奏与「本进程单周」尝试状态（设计稿 §6.5 / §7.3 / §15 D6）。
 *
 * 语义边界：
 * - 终态：`sent`（含部分收件人已发、其余仍失败后重试成功）与 `skipped_duplicate`（全部收件人本周已发）；
 * - 可重试：`partial` / `failed` / `noop`（计次 + 退避）、`skipped_no_recipient`（不计次，仅退避，
 *   因为「窗口内开启个人开关后当周补发」是明确要求，发信次数并非噪声源）；
 * - 配置关闭（`skipped_disabled` / `skipped_org_disabled`）：不占用本周，下一次节拍立即重查；
 *   但**不清零**已发生的发信尝试计数（否则「关一下再开」可绕过单周尝试上界）。
 *
 * 真正的「每收件人每周一封」仍由逐用户投递键兜底（见 `dedupe.ts#buildDigestDeliveryKey`）。
 */

/** 失败 / 部分失败后的重试退避（≥30 分钟），避免整窗高频重试放大 SMTP 噪声。 */
export const WEEKLY_DIGEST_RETRY_BACKOFF_MS = 30 * 60 * 1000

/** 本进程单周发送尝试上界（只计真正发信的尝试），触顶后本周不再尝试。 */
export const WEEKLY_DIGEST_MAX_SEND_ATTEMPTS = 6

export interface WeeklyDigestAttemptState {
    /** ISO 周键（`2026-W44`）；跨周即重建状态。 */
    weekKey: string
    /** 已发生的发信尝试次数（不含无收件人尝试）。 */
    sendAttempts: number
    /** 下一次允许尝试的时间戳（毫秒）；0 表示立即。 */
    nextAttemptAtMs: number
    /** 本周已终态，不再尝试。 */
    done: boolean
}

export const createWeeklyDigestAttemptState = (weekKey: string): WeeklyDigestAttemptState => ({
    weekKey,
    sendAttempts: 0,
    nextAttemptAtMs: 0,
    done: false,
})

const RETRYABLE_SEND_STATUSES: readonly WeeklyDigestStatus[] = ['partial', 'failed', 'noop']

/**
 * 根据一次发送结果推进尝试状态（纯函数，便于单测与行为锁定）。
 * 未识别的状态按「不计次、仅退避」处理（fail-safe：宁可多试一次也不静默停发）。
 */
export const reduceWeeklyDigestAttempt = (
    state: WeeklyDigestAttemptState,
    status: WeeklyDigestStatus,
    nowMs: number,
): WeeklyDigestAttemptState => {
    if (status === 'sent' || status === 'skipped_duplicate') {
        return { ...state, done: true }
    }
    if (status === 'skipped_disabled' || status === 'skipped_org_disabled') {
        return { ...state, nextAttemptAtMs: 0, done: false }
    }
    const nextSendAttempts = RETRYABLE_SEND_STATUSES.includes(status) ? state.sendAttempts + 1 : state.sendAttempts
    const done = nextSendAttempts >= WEEKLY_DIGEST_MAX_SEND_ATTEMPTS
    return {
        ...state,
        sendAttempts: nextSendAttempts,
        // 终态时不再排定下一次尝试（`done` 优先于 `nextAttemptAtMs`，此处保持两者不自相矛盾）
        nextAttemptAtMs: done ? 0 : nowMs + WEEKLY_DIGEST_RETRY_BACKOFF_MS,
        done,
    }
}
