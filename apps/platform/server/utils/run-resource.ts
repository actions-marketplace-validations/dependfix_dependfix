import type { ExecutorResourceUsage } from '#server/services/executor/types'

/**
 * 解析 `ScanRun.resourceJson`：非法 JSON / 非对象 → null（消费方按不可采集降级）。
 * 不做字段级强校验：历史数据 / 未来新增辅助字段不应导致整个详情 500。
 */
export const parseRunResource = (raw: string | null | undefined): ExecutorResourceUsage | null => {
    if (!raw) {
        return null
    }
    try {
        const parsed = JSON.parse(raw) as unknown
        return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed as ExecutorResourceUsage
            : null
    } catch {
        return null
    }
}
