import type { PRCheck } from '#server/entities/pr-check'
import type { BuildFailureSource } from '#server/services/monitor/build-signals'
import type { UnifiedBuildSignal } from '#server/services/monitor/types'

/**
 * PRCheck API 视图（列表 / 详情共用单一事实源）。
 *
 * 存在理由：列表（`pr-checks/index.get.ts`）与详情（`pr-checks/[id].get.ts`）必须给出**同一契约**
 * —— 新增字段只改一处，避免两端漂移（历史教训：详情端点曾长期缺少 `repository` 字段）。
 *
 * 字段口径：
 * - `repository`：服务端解析的 `owner/name`（与 alerts / env-events / dashboard 同源口径；
 *   调用方须加载 `repository` 关系，否则回退 `null`）
 * - `overallStatus` / `signals` / `failureSources`：三源聚合字段（M43.2b）；JSON 列解析，
 *   列值缺失或损坏时回退 `null`（不抛错）
 */
export type PRCheckSignalView = Omit<UnifiedBuildSignal, 'observedAt'> & { observedAt: string }

export type PRCheckFailureSourceView = BuildFailureSource

/** JSON 列安全解析（缺失 / 非 JSON / 非数组时回退 null，不抛错） */
const parseJsonArrayColumn = <T>(value: string | null | undefined): T[] | null => {
    if (!value) {
        return null
    }
    try {
        const parsed: unknown = JSON.parse(value)
        return Array.isArray(parsed) ? parsed as T[] : null
    } catch {
        return null
    }
}

export const toPRCheckView = (row: PRCheck) => ({
    id: row.id,
    repositoryId: row.repositoryId,
    repository: row.repository ? `${row.repository.owner}/${row.repository.name}` : null,
    prNumber: row.prNumber,
    headSha: row.headSha,
    authorLogin: row.authorLogin,
    conclusion: row.conclusion,
    overallStatus: row.overallStatus,
    signals: parseJsonArrayColumn<PRCheckSignalView>(row.signalsJson),
    failureSources: parseJsonArrayColumn<PRCheckFailureSourceView>(row.failureSourcesJson),
    checkRunId: row.checkRunId,
    detailsUrl: row.detailsUrl,
    errorMessage: row.errorMessage,
    alertFiring: row.alertFiring,
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    acknowledgedByUserId: row.acknowledgedByUserId,
    lastPolledAt: row.lastPolledAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
})

export type PRCheckView = ReturnType<typeof toPRCheckView>
