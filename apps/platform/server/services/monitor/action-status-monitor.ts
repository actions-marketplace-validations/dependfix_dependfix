import type { DataSource } from 'typeorm'
import {
    isFailureConclusion,
    type PRCheckSnapshot,
    type PRCheckSyncSource,
} from './types'
import { shouldSkipTerminalPr, summarizeFailureSources } from './build-signals'
import { Repository as RepositoryEntity } from '#server/entities/repository'
import { PRCheck, type PRCheckConclusion } from '#server/entities/pr-check'

/**
 * 依赖更新 PR Check 状态监测器（详见 docs/plan/todo.md §M24.1 关键决策 D2/D3/D6）。
 *
 * 业务定位：监测 dependfix 自身 PR（author 含 `dependfix[bot]`）+ dependabot PR
 * （author=`dependabot[bot]`）最新 `Test` check 状态，让"发出去"的修复 PR 在 CI
 * 跑挂时通过 alerts 系统 firing 并提供 ack UI。
 *
 * 核心方法 `pollOnce` 数据流：
 * 1. 拉取目标仓库列表（schedule.selectorKind 解析；MVP 阶段 per-org scope，D6）
 * 2. 对每个仓库：syncSource.fetchSnapshots → 快照数组（PR + check run）
 * 3. 对每个快照：INSERT/UPDATE PRCheck 表（按 `(repositoryId, prNumber, headSha)` 复合唯一索引幂等）
 * 4. 状态机推断（关键决策 D3）：
 *    - 快照失败（failure / timed_out / action_required）→ alertFiring=true
 *    - 快照成功（success）→ alertFiring=false（自动 ack；acknowledgedAt 留原值）
 *    - 其他（pending / skipped / cancelled 等）→ alertFiring=false
 * 5. lastPolledAt = observedAt
 *
 * 用户 ack 操作（PATCH /api/pr-checks/[id] { alertFiring: false }）由 Phase 3 API 层实现，
 * 本 service 仅负责落库 + 状态机推断，不处理 ack 操作。
 *
 * 与 ScanResult 的语义边界：
 * - ScanResult 是 per-alert 模型，reconcile 按 upstreamId 复合唯一索引去重
 * - PRCheck 是 per-PR-head 模型，pollOnce 按 (repositoryId, prNumber, headSha) 幂等，
 *   同一 PR HEAD 只存最新一行
 *
 * 注意：本 service **不**自动启动 polling 循环（避免与现有 scheduler 双源触发）；
 * Phase 2 末尾由 scheduler.service.ts registerSchedule 按 kind='pr-check' 分支调用。
 */
export class ActionStatusMonitor {
    private readonly ds: DataSource
    private readonly source: PRCheckSyncSource

    constructor(ds: DataSource, source: PRCheckSyncSource) {
        this.ds = ds
        this.source = source
    }

    /**
     * 单轮 polling：拉取 target 仓库的所有目标 PR check 状态 → 落库。
     *
     * @param options.organizationId 组织 id（per-org scope）
     * @param options.repositoryIds 限定仓库 id 列表（undefined = 当前组织全部仓库；Phase 2 scheduler 触发时会传入 schedule 解析后的 id 列表）
     * @returns 处理汇总（processed = 落库快照数；errors = 失败快照数）
     */
    async pollOnce(options: {
        organizationId: string | null
        repositoryIds?: string[]
    }): Promise<{ processed: number, errors: number }> {
        // 1. 解析目标仓库列表
        const repos = await this.loadTargetRepositories(options)
        let processed = 0
        let errors = 0

        for (const repo of repos) {
            try {
                // 终态节流：读取既有行，构造「终态 + HEAD 未变 + 静默窗口内」的跳过集（省三源 API）
                const knownTerminalHeads = await this.loadTerminalHeadMap(repo.id)
                const snapshots = await this.source.fetchSnapshots({
                    owner: repo.owner,
                    repo: repo.name,
                    repositoryId: repo.id,
                    knownTerminalHeads,
                })
                for (const snapshot of snapshots) {
                    const applied = await this.applyOne(snapshot)
                    if (applied) {
                        processed += 1
                    }
                }
            } catch (error) {
                // 单仓失败不影响其他仓库继续 polling（错误隔离 + fail-open）
                console.error(
                    `[pr-check-monitor] 仓库 ${repo.owner}/${repo.name} polling 失败：`,
                    error,
                )
                errors += 1
            }
        }

        return { processed, errors }
    }

    /**
     * 加载目标仓库列表（per-org scope）：
     * - 显式传 repositoryIds 时 → 仅监测该列表（schedule explicit 策略解析结果）
     * - 未传时 → 加载当前组织全部仓库（schedule all / organization 策略解析结果）
     */
    private async loadTargetRepositories(options: {
        organizationId: string | null
        repositoryIds?: string[]
    }): Promise<RepositoryEntity[]> {
        const repo = this.ds.getRepository(RepositoryEntity)
        if (options.repositoryIds && options.repositoryIds.length > 0) {
            return repo.find({ where: options.repositoryIds.map((id) => ({ id })) })
        }
        const where = options.organizationId
            ? { organizationId: options.organizationId }
            : {}
        return repo.find({ where })
    }

    /**
     * 构造「终态 + 静默窗口内」跳过集（`prNumber → headSha`）。
     *
     * 静默窗口外的终态行**不跳过**——同一 SHA 上可能发生 workflow 重跑 / 迟到写入的部署状态，
     * 永久跳过会漏掉本特性要捕获的失败场景（口径见 `build-signals.ts` 的 `TERMINAL_REPOLL_QUIET_MS`）。
     */
    private async loadTerminalHeadMap(repositoryId: string): Promise<Map<number, string>> {
        const rows = await this.ds.getRepository(PRCheck).find({ where: { repositoryId } })
        const now = new Date()
        const map = new Map<number, string>()
        for (const row of rows) {
            if (shouldSkipTerminalPr(row, now)) {
                map.set(row.prNumber, row.headSha)
            }
        }
        return map
    }

    /**
     * 应用单个快照：按 (repositoryId, prNumber, headSha) 复合唯一索引幂等 INSERT/UPDATE。
     *
     * 状态机推断（关键决策 D3 + M43.2b 承接）：
     * - INSERT 路径：alertFiring = isFailureConclusion(snapshot.conclusion)
     * - UPDATE 路径：alertFiring 严格基于 snapshot.conclusion：
     *   - 失败 → firing=true（覆盖原值，包括之前用户 ack 的状态）
     *   - 其他 → firing=false
     * - **自动 ack 清空判定按 `overallStatus === 'success'`**（M43.2b 承接项）：聚合成功（含
     *   `neutral` / `skipped` 信号但无失败 / 无 pending）即视为回归成功并清 ack；
     *   若沿用 `conclusion === 'success'`，含 `neutral` 信号的 PR 将永不清 ack。
     *
     * 注意：用户 ack 操作（alertFiring=false + acknowledgedAt=NOW）**不修改** conclusion；
     * 状态机严格基于 polling 结果，下轮 polling 失败时 alertFiring 会被覆盖回 true。
     *
     * @returns 是否实际落库（`false` = 空信号被守卫跳过，不计入 `processed`）
     */
    private async applyOne(snapshot: PRCheckSnapshot): Promise<boolean> {
        // 空信号守卫：无信号不落库（`aggregateOverallStatus([])` 为真空真，直接消费会把「无信号」
        // 误写为聚合 success；见设计稿 §3.7「空集真空真」）。采集层已过滤，此处为接口级防御。
        if (snapshot.signals.length === 0) {
            return false
        }

        const repo = this.ds.getRepository(PRCheck)
        const inferredAlertFiring = isFailureConclusion(snapshot.conclusion)
        const signalsJson = JSON.stringify(snapshot.signals)
        const failureSourcesJson = JSON.stringify(summarizeFailureSources(snapshot.signals))

        const existing = await repo.findOne({
            where: {
                repositoryId: snapshot.repositoryId,
                prNumber: snapshot.prNumber,
                headSha: snapshot.headSha,
            },
        })

        if (existing) {
            existing.conclusion = snapshot.conclusion
            existing.signalsJson = signalsJson
            existing.overallStatus = snapshot.overallStatus
            existing.failureSourcesJson = failureSourcesJson
            existing.checkRunId = snapshot.checkRunId
            existing.detailsUrl = snapshot.detailsUrl
            existing.errorMessage = snapshot.errorMessage
            existing.authorLogin = snapshot.authorLogin
            existing.alertFiring = inferredAlertFiring
            // 聚合回归成功 → 自动 ack（清空 acknowledgedAt / acknowledgedByUserId）
            if (snapshot.overallStatus === 'success') {
                existing.acknowledgedAt = null
                existing.acknowledgedByUserId = null
            }
            existing.lastPolledAt = snapshot.observedAt
            await repo.save(existing)
        } else {
            const row = new PRCheck()
            row.repositoryId = snapshot.repositoryId
            row.prNumber = snapshot.prNumber
            row.headSha = snapshot.headSha
            row.authorLogin = snapshot.authorLogin
            row.conclusion = snapshot.conclusion
            row.signalsJson = signalsJson
            row.overallStatus = snapshot.overallStatus
            row.failureSourcesJson = failureSourcesJson
            row.checkRunId = snapshot.checkRunId
            row.detailsUrl = snapshot.detailsUrl
            row.errorMessage = snapshot.errorMessage
            row.alertFiring = inferredAlertFiring
            row.acknowledgedAt = null
            row.acknowledgedByUserId = null
            row.lastPolledAt = snapshot.observedAt
            await repo.save(row)
        }
        return true
    }
}

/** 导出 PRCheckConclusion 类型供 Phase 3 API 类型校验引用 */
export type { PRCheckConclusion }
