import { In, IsNull } from 'typeorm'
import { computeNotificationFingerprint } from './dedupe'
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

export interface HighRiskSummary {
    rows: HighRiskAlertRow[]
    counts: { critical: number, high: number, total: number }
    byRepository: HighRiskRepositoryGroup[]
    truncated: { critical: number, high: number, total: number }
    fingerprint: string
}

const UNFIXED_STATUSES = ['not-tried', 'failed', 'skipped'] as const

/**
 * 查询未修复高危告警（设计稿 §7.1）：
 * severity in [critical, high] + supersededAt null + fixStatus in [not-tried, failed, skipped]。
 * 同时读取 run summary 的截断计数（M46.2），按组织阈值过滤严重级别。
 */
export const queryUnfixedHighRisk = async (
    scanRunIds: string[],
    severityThreshold: 'critical' | 'high',
): Promise<HighRiskSummary> => {
    const severities = severityThreshold === 'critical' ? ['critical'] : ['critical', 'high']
    const empty: HighRiskSummary = {
        rows: [],
        counts: { critical: 0, high: 0, total: 0 },
        byRepository: [],
        truncated: { critical: 0, high: 0, total: 0 },
        fingerprint: '',
    }
    if (scanRunIds.length === 0) {
        return empty
    }
    const ds = await ensureDatabaseInitialized()
    const results = await ds.getRepository(ScanResult).find({
        where: {
            scanRunId: In(scanRunIds),
            supersededAt: IsNull(),
            severity: In(severities) as never,
            fixStatus: In([...UNFIXED_STATUSES]) as never,
        },
    })
    if (results.length === 0) {
        return empty
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
    const counts = {
        critical: rows.filter((row) => row.severity === 'critical').length,
        high: rows.filter((row) => row.severity === 'high').length,
        total: rows.length,
    }
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

    const runs = await ds.getRepository(ScanRun).find({ where: { id: In(scanRunIds) } })
    let truncatedCritical = 0
    let truncatedHigh = 0
    for (const run of runs) {
        if (!run.summaryJson) {
            continue
        }
        try {
            const summary = JSON.parse(run.summaryJson) as { alertsTruncatedBySeverity?: { critical?: unknown, high?: unknown } }
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
        fingerprint: computeNotificationFingerprint(rows.map((row) => `${row.repositoryId}:${row.upstreamId}`)),
    }
}
