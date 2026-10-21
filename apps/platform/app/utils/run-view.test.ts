import { describe, expect, it } from 'vitest'
import {
    alertsFound,
    environmentalFailureCount,
    isRunResultMissing,
    summaryNumber,
    unfixedAlerts,
} from './run-view'

/**
 * run-view 工具测试：`alertsFound` 读取契约。
 *
 * 背景：失败 run 现落 summaryJson 快照（告警数如实 / 已修复归零），运行列表「告警数」列经
 * `alertsFound(row.summary)` 读取 `summary.alertsFound`。本用例锁定该读取口径，防止键名漂移
 * 导致失败 run / 各类 run 的告警数恒显 0。
 */
describe('alertsFound', () => {
    it('读取 summary.alertsFound（失败 run 快照如实展示告警数）', () => {
        expect(alertsFound({ alertsFound: 5, alertsFixed: 0 })).toBe(5)
    })

    it('summary 为 null / undefined → 0', () => {
        expect(alertsFound(null)).toBe(0)
        expect(alertsFound(undefined as unknown as Record<string, unknown> | null)).toBe(0)
    })

    it('alertsFound 非有限数字 → 0（脏数据防御）', () => {
        expect(alertsFound({ alertsFound: 'x' })).toBe(0)
        expect(alertsFound({ alertsFound: Number.POSITIVE_INFINITY })).toBe(0)
        expect(alertsFound({})).toBe(0)
    })
})

describe('summaryNumber', () => {
    it('读取非负数值，负数 / 非数字 / 缺失降级为 0', () => {
        expect(summaryNumber({ alertsFixed: 3 }, 'alertsFixed')).toBe(3)
        expect(summaryNumber({ alertsFixed: -1 }, 'alertsFixed')).toBe(0)
        expect(summaryNumber({ alertsFixed: '3' }, 'alertsFixed')).toBe(0)
        expect(summaryNumber({ alertsFixed: Number.NaN }, 'alertsFixed')).toBe(0)
        expect(summaryNumber({ alertsFixed: Number.POSITIVE_INFINITY }, 'alertsFixed')).toBe(0)
        expect(summaryNumber(null, 'alertsFixed')).toBe(0)
    })
})

describe('unfixedAlerts', () => {
    it('found − fixed − converged，converged 不计入未修复', () => {
        expect(unfixedAlerts({ alertsFound: 5, alertsFixed: 2, alertsConverged: 1 })).toBe(2)
    })

    it('旧 summary 缺字段时按 0 降级，结果不为负', () => {
        expect(unfixedAlerts({ alertsFound: 3 })).toBe(3)
        expect(unfixedAlerts({ alertsFound: 1, alertsFixed: 3 })).toBe(0)
        expect(unfixedAlerts(null)).toBe(0)
    })
})

describe('environmentalFailureCount', () => {
    it('优先读落库列，列缺失时回退 summary', () => {
        expect(environmentalFailureCount({ status: 'completed', summary: { environmentalFailures: 2 }, environmentalFailureCount: 3 })).toBe(3)
        expect(environmentalFailureCount({ status: 'completed', summary: { environmentalFailures: 2 }, environmentalFailureCount: null })).toBe(2)
    })

    it('两处都缺失 / 非法时返回 0', () => {
        expect(environmentalFailureCount({ status: 'completed', summary: null })).toBe(0)
        expect(environmentalFailureCount({ status: 'completed', summary: { environmentalFailures: '2' } })).toBe(0)
        expect(environmentalFailureCount({ status: 'completed', summary: null, environmentalFailureCount: -1 })).toBe(0)
    })
})

describe('isRunResultMissing', () => {
    it('失败且无 summary → 结果缺失', () => {
        expect(isRunResultMissing({ status: 'failed', summary: null })).toBe(true)
    })

    it('execution_timeout 即使有 summary 也按结果缺失展示', () => {
        expect(isRunResultMissing({
            status: 'failed',
            summary: { alertsFound: 1 },
            error: { code: 'execution_timeout' },
        })).toBe(true)
    })

    it('pending / running / dispatched 属于尚未就绪，不是缺失', () => {
        expect(isRunResultMissing({ status: 'pending', summary: null })).toBe(false)
        expect(isRunResultMissing({ status: 'running', summary: null })).toBe(false)
        expect(isRunResultMissing({ status: 'dispatched', summary: null })).toBe(false)
    })

    it('有结果的 completed / degraded 正常展示', () => {
        expect(isRunResultMissing({ status: 'completed', summary: { alertsFound: 0 } })).toBe(false)
        expect(isRunResultMissing({ status: 'degraded', summary: { alertsFound: 0 } })).toBe(false)
    })

    it('失败但有可信结果（非超时）不算结果缺失', () => {
        expect(isRunResultMissing({
            status: 'failed',
            summary: { alertsFound: 2 },
            error: { code: 'engine_exit_2' },
        })).toBe(false)
    })

    it('completed 但 summary 缺失按数据异常展示结果缺失', () => {
        expect(isRunResultMissing({ status: 'completed', summary: undefined })).toBe(true)
    })
})
