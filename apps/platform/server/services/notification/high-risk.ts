import { In, IsNull } from 'typeorm'
import { computeNotificationFingerprint } from './dedupe'
import { SECURITY_CATEGORY_SEVERITIES, type SecurityNotificationCategory } from './types'
import { ensureDatabaseInitialized } from '#server/database'
import { Repository } from '#server/entities/repository'
import { ScanResult } from '#server/entities/scan-result'
import { ScanRun } from '#server/entities/scan-run'

export interface HighRiskAlertRow {
    repositoryId: string
    repository: string
    upstreamId: string
    severity: 'critical' | 'high'
    packageName: string
    htmlUrl: string | null
}

export interface HighRiskRepositoryGroup {
    repositoryId: string
    repository: string
    critical: number
    high: number
    total: number
}

export interface HighRiskCounts {
    critical: number
    high: number
    total: number
}

export interface HighRiskSummary {
    rows: HighRiskAlertRow[]
    counts: HighRiskCounts
    byRepository: HighRiskRepositoryGroup[]
    truncated: HighRiskCounts
    /**
     * 快照运行汇总里的本地已满足（`converged`）告警数，供周报披露「豁免」。
     * 注意：`ScanResult` 不标记 converged（明细行按活跃告警全量统计），该数只来自 `RunSummary`。
     */
    exempted: number
    fingerprint: string
}

const UNFIXED_STATUSES = ['not-tried', 'failed', 'skipped'] as const

const emptyCounts = (): HighRiskCounts => ({ critical: 0, high: 0, total: 0 })

const emptySummary = (): HighRiskSummary => ({
    rows: [],
    counts: emptyCounts(),
    byRepository: [],
    truncated: emptyCounts(),
    exempted: 0,
    fingerprint: '',
})

const countSeverities = (rows: ReadonlyArray<{ severity: string }>): HighRiskCounts => {
    const counts = emptyCounts()
    for (const row of rows) {
        if (row.severity === 'critical') {
            counts.critical++
        } else if (row.severity === 'high') {
            counts.high++
        }
    }
    counts.total = counts.critical + counts.high
    return counts
}

/**
 * 高危摘要的共享实现：
 * - `scanRunIds = null` → 全局活跃快照（周报口径，`supersededAt IS NULL` 即「当前活跃」）；
 * - `scanRunIds = [...]` → 限定单个 run / 批次内子 run。
 *
 * 未修复口径（设计稿 §7.1）：severity in [critical, high] + supersededAt null +
 * fixStatus in [not-tried, failed, skipped]。`ScanResult` 不标记 converged，周报的「豁免」
 * 取自快照运行的 `RunSummary.alertsConverged`（仅披露，不改明细计数）。
 *
 * 截断计数来自产出快照的扫描运行（`RunSummary.alertsTruncatedBySeverity`）——run 限定查询用
 * 调用方传入的 run 集合，全局快照用活跃行去重后的 `scanRunId`。
 */
const queryHighRiskSummary = async (
    severities: readonly ('critical' | 'high')[],
    scanRunIds: string[] | null,
): Promise<HighRiskSummary> => {
    if (scanRunIds?.length === 0 || severities.length === 0) {
        return emptySummary()
    }
    const ds = await ensureDatabaseInitialized()
    const resultRepo = ds.getRepository(ScanResult)
    const scopeWhere = scanRunIds ? { scanRunId: In(scanRunIds) } : {}
    const severityWhere = { severity: In(severities) as never }

    const results = await resultRepo.find({
        where: {
            ...scopeWhere,
            ...severityWhere,
            supersededAt: IsNull(),
            fixStatus: In([...UNFIXED_STATUSES]) as never,
        },
    })
    if (results.length === 0) {
        return emptySummary()
    }

    const repositoryIds = [...new Set(results.map((row) => row.repositoryId))]
    const repositories = await ds.getRepository(Repository).find({ where: { id: In(repositoryIds) } })
    const repositoryNames = new Map(repositories.map((repo) => [repo.id, `${repo.owner}/${repo.name}`]))

    const rows: HighRiskAlertRow[] = results.map((row) => ({
        repositoryId: row.repositoryId,
        repository: repositoryNames.get(row.repositoryId) ?? row.repositoryId,
        upstreamId: row.upstreamId,
        severity: row.severity as 'critical' | 'high',
        packageName: row.packageName,
        htmlUrl: row.htmlUrl,
    }))
    const counts = countSeverities(rows)
    const groupMap = new Map<string, HighRiskRepositoryGroup>()
    for (const row of rows) {
        const group = groupMap.get(row.repositoryId) ?? {
            repositoryId: row.repositoryId,
            repository: row.repository,
            critical: 0,
            high: 0,
            total: 0,
        }
        group[row.severity]++
        group.total++
        groupMap.set(row.repositoryId, group)
    }
    const byRepository = [...groupMap.values()].sort((a, b) => b.total - a.total)

    const truncationRunIds = scanRunIds ?? [...new Set(results.map((row) => row.scanRunId))]
    const runs = truncationRunIds.length > 0
        ? await ds.getRepository(ScanRun).find({ where: { id: In(truncationRunIds) } })
        : []
    let truncatedCritical = 0
    let truncatedHigh = 0
    let exempted = 0
    for (const run of runs) {
        if (!run.summaryJson) {
            continue
        }
        try {
            const summary = JSON.parse(run.summaryJson) as {
                alertsConverged?: unknown
                alertsTruncatedBySeverity?: { critical?: unknown, high?: unknown }
            }
            if (typeof summary.alertsConverged === 'number') {
                exempted += summary.alertsConverged
            }
            const grouped = summary.alertsTruncatedBySeverity
            if (!grouped) {
                continue
            }
            if (severities.includes('critical')) {
                truncatedCritical += typeof grouped.critical === 'number' ? grouped.critical : 0
            }
            if (severities.includes('high')) {
                truncatedHigh += typeof grouped.high === 'number' ? grouped.high : 0
            }
        } catch {
            // 脏 summary 不影响高危明细查询
        }
    }
    return {
        rows,
        counts,
        byRepository,
        truncated: {
            critical: truncatedCritical,
            high: truncatedHigh,
            total: truncatedCritical + truncatedHigh,
        },
        exempted,
        fingerprint: computeNotificationFingerprint(rows.map((row) => `${row.repositoryId}:${row.upstreamId}`)),
    }
}

/**
 * 按通知类别查询未修复告警（设计稿 §15 D4）：
 * `security_critical` 只取 critical、`security_high` 只取 high——两类各发一封，避免同一 run 内互相掩盖。
 */
export const queryUnfixedSecurityAlerts = (
    scanRunIds: string[],
    category: SecurityNotificationCategory,
): Promise<HighRiskSummary> => queryHighRiskSummary(SECURITY_CATEGORY_SEVERITIES[category], scanRunIds)

/**
 * 查询全局活跃未修复高危快照（周报口径）：
 * 不限定 scanRunId——`ScanResult` 为 per-alert 模型，`supersededAt IS NULL` 即当前活跃。
 * 截断计数取快照内各告警所属运行（去重）的 summary。
 */
export const queryActiveUnfixedHighRisk = (
    severityThreshold: 'critical' | 'high',
): Promise<HighRiskSummary> =>
    queryHighRiskSummary(severityThreshold === 'critical' ? ['critical'] : ['critical', 'high'], null)
