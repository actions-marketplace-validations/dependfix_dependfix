import type { ScanRunStatus } from '#server/entities/scan-run'

/**
 * ScanRun 终态集合（不再推进状态的状态值）。
 *
 * 口径与「受约束重试入口」/ 批次聚合 / 孤儿清理共用：
 * - `completed` / `failed`：正常终态；
 * - `dispatched`：GitHub Action 已触发、结果未回执（不再由本平台推进）；
 * - `degraded`：业务结果完整但执行路径偏离（等价完成）。
 */
export const TERMINAL_SCAN_RUN_STATUSES: readonly ScanRunStatus[] = [
    'completed',
    'failed',
    'dispatched',
    'degraded',
] as const

/** 是否为终态（未知状态按非终态处理，避免误判为可覆盖）。 */
export const isTerminalScanRunStatus = (status: string): boolean =>
    (TERMINAL_SCAN_RUN_STATUSES as readonly string[]).includes(status)
