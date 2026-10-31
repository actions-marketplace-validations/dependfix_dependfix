import { IsNull, type EntityManager, type Repository } from 'typeorm'
import { alertOutcomeKey, isAlertOutcomeStatus, type AlertFixOutcome, type NormalizedSecurityAlert } from '@dependfix/core'
import { ScanResult } from '#server/entities/scan-result'
import { ensureDatabaseInitialized } from '#server/database'

/**
 * reconcile 规则（2026-08-31 M20.3 实施 todo.md §M20.3 决策 1-4）：
 *
 * | 情况 | upstreamId | 现有行 fixStatus | 当前是否在上游 | 操作 |
 * |---|---|---|---|---|
 * | 新告警 | 不存在 | — | — | INSERT（新行） |
 * | 活跃告警 | 存在 | 任意 | 在 | UPDATE lastSeenAt / occurrenceCount++ / scanRunId / severity；`fixStatus` 按本次结论回写（缺结论保留原值） |
 * | 消失告警 + 未修复 | 存在 | ≠ 'success' | 不在 | UPDATE supersededAt = NOW() |
 * | 消失告警 + 已修复 | 存在 | = 'success' | 不在 | **不操作**（决策 1：fixStatus='success' 永不被 supersede，保留修复记录） |
 *
 * 幂等性：重复 reconcile 同一 newAlerts 结果一致：
 * - 重复 INSERT：被复合唯一索引 `(repositoryId, upstreamId)` 拒掉，TypeORM 抛 QueryFailedError
 *   → reconcile 改用先 findOne 再 INSERT/UPDATE 模式，避免依赖数据库 INSERT ... ON CONFLICT 语法
 * - 重复 UPDATE supersededAt：每次都 SET 同一 NOW()，supplier set 与 NOT NULL check 无关，幂等
 * - 重复 UPDATE 活跃告警：occurrenceCount 重复 +1（非幂等）—— **修复后 reconcile 用 +1 + lastSeenAt 刷新保持幂等**：
 *   实际上"重复扫描同一份告警列表"也是合理行为（业务语义："看到 N 次"），符合决策 1 期望
 *
 * 不在本函数范围（M20.5+ scope）：
 * - API 端 `supersededAt IS NULL` 默认过滤
 * - dashboard `alertsTotal` 改为数活跃告警
 * - 前端 "包含已解决" 开关
 * - backfill 数据迁移
 */
export interface ReconcileAlertsParams {
    /** 仓库 id（来自 ScanRun.repositoryId；冗余写入 ScanResult.repositoryId 便于索引） */
    repositoryId: string
    /** 当前 scanRun.id（写入新行 / 刷新活跃行） */
    newRunId: string
    /** 当前扫描结果中的所有告警（已含 upstreamId 字段；引擎侧注入） */
    newAlerts: readonly NormalizedSecurityAlert[]
    /** TypeORM EntityManager（可选；提供时事务化 reconcile + 后续 INSERT） */
    manager?: EntityManager
    /** 当前 reconcile 时间（backfill 复用需要传入固定时间便于幂等测试） */
    now?: Date
    /**
     * 本次运行是否为 dry-run（计划模式）。
     *
     * dry-run 的动作 `success` 只是「计划执行」，磁盘 / PR 未真实交付——此时忽略 `outcomes`，
     * 保持既有写入口径（新行 `not-tried`、活跃行保留原值）。平台当前不产生 dry-run run，
     * 该参数为防御性开关。
     */
    dryRun?: boolean
    /**
     * 本次运行的告警级处置结果（`RunResult.alertOutcomes`）。
     *
     * 缺省 / 空数组 ⇒ 不改写 `fixStatus`（存量行为：新行 `not-tried`、活跃行保留原值）。
     * 匹配键 `(repository, source, upstreamId, manifestPath)` 与引擎同源（`alertOutcomeKey`）；
     * 写入规则见 [data-model.md 告警级修复结果回写](../../../../docs/design/modules/data-model.md)
     * 与 [alert-outcome-writeback.md](../../../../docs/design/governance/alert-outcome-writeback.md)。
     */
    outcomes?: readonly AlertFixOutcome[]
}

/** reconcile 操作的统计结果（便于上层 audit_event 记录 + 测试断言） */
export interface ReconcileStats {
    inserted: number
    refreshed: number
    superseded: number
    preservedSuccess: number
    unchanged: number
    /** 本次写入 `fixStatus` 的行数（新行带结论 + 活跃行改写） */
    outcomesApplied: number
    /**
     * 未生效的结果条目数 = 键漂移（有结论但无对应告警）**键数** + 非法条目数；
     * 同键重复条目后者覆盖、不计入。>0 时上层 warn。
     *
     * 正常流水线结构上恒为 0：引擎只对送入链路的告警下结论，平台用同一 `result.alerts` 落库；
     * 非 0 说明报告与告警列表出现键漂移（上游 API 语义变化 / 平台开始过滤 alerts），需排查。
     */
    outcomesUnmatched: number
}

/**
 * 扫描结果 reconcile：把 newAlerts 与数据库中已有 ScanResult 对齐。
 *
 * 工作流：
 * 1. 计算 newAlerts 的 upstreamId 集合
 * 2. 一次性查询数据库中该仓库所有 `supersededAt IS NULL` 行（避免 N+1）
 * 3. 按 upstreamId 分桶：existingMap vs newMap
 * 4. 遍历 newAlerts：
 *    - 不存在 → INSERT（occurrenceCount=1 / firstSeenAt=now / lastSeenAt=now）
 *    - 存在 → UPDATE lastSeenAt / occurrenceCount++ / scanRunId / severity；`fixStatus` 按 `outcomes` 回写
 * 5. 遍历 existingMap 中"未在新告警列表中"的行：
 *    - fixStatus='success' → 不操作（决策 1：永不被 supersede）
 *    - 其他 → UPDATE supersededAt = now
 *
 * 告警级结果回写（`outcomes` 提供时）：
 * - INSERT：`fixStatus` 取本次结论，缺键 `not-tried`（与引入前一致）
 * - UPDATE：有结论即改写（含 `success` → `failed`）——`fixStatus` 反映**本次运行**的结论；
 *   决策 1 的「修复成就保留」由 supersede 路径承担（上游消失的 success 行仍不 supersede）
 * - 缺键保持原值（本次运行未对该告警下结论 ≠ 回到 `not-tried`）
 * - 状态值按 `ALERT_OUTCOME_STATUSES` 白名单过滤（报告来自 JSON；未知值 / `not-tried` 不写库——
 *   缺键已表示 `not-tried`，显式回退无意义）
 * - 已 supersede 的行不参与（本函数只读 `supersededAt IS NULL`）；重新激活语义仍未实现
 *
 * @returns reconcile 统计（inserted / refreshed / superseded / preservedSuccess / unchanged / 结果回写计数）
 */
export const reconcileAlerts = async (params: ReconcileAlertsParams): Promise<ReconcileStats> => {
    const { repositoryId, newRunId, newAlerts } = params
    const now = params.now ?? new Date()

    const ds = await ensureDatabaseInitialized()
    const resultRepo = (params.manager?.getRepository(ScanResult) ?? ds.getRepository(ScanResult)) as Repository<ScanResult>

    // 防御：upstreamId 必须存在（引擎侧注入 + 类型保证；运行时防御兜底）
    for (const alert of newAlerts) {
        if (!alert.upstreamId) {
            throw new TypeError(
                `reconcileAlerts: alert missing upstreamId (source=${alert.source}, packageName=${alert.packageName})`,
            )
        }
    }

    // 一次性查询该仓库所有未 supersede 行（活跃 + 已修复）—— 决策 1 要求 fixStatus='success'
    // 行保留以便 reconcile 时跳过 supersede 操作
    const existingRows = await resultRepo.find({
        where: { repositoryId, supersededAt: IsNull() },
    })
    const existingByUpstreamId = new Map<string, ScanResult>()
    for (const row of existingRows) {
        existingByUpstreamId.set(row.upstreamId, row)
    }

    const stats: ReconcileStats = {
        inserted: 0,
        refreshed: 0,
        superseded: 0,
        preservedSuccess: 0,
        unchanged: 0,
        outcomesApplied: 0,
        outcomesUnmatched: 0,
    }

    // 告警级结果：按引擎同一键索引；同一键重复出现时后者覆盖（引擎侧已按 Map 去重）。
    // 1) dry-run 一律忽略——计划态结果不得落成修复记录（平台当前不产生 dry-run run，此处为防御参数）
    // 2) 脏条目（缺 repository / upstreamId / source，或状态不在结论白名单）跳过：
    //    未知状态一旦写库会落在「未修复」集合之外，静默退出通知明细；`not-tried` 同理拒绝
    //    （缺键即 not-tried，显式回退会抹掉既有结论）
    const outcomeByKey = new Map<string, AlertFixOutcome>()
    let invalidOutcomes = 0
    for (const outcome of params.dryRun ? [] : (params.outcomes ?? [])) {
        if (!outcome?.repository || !outcome.upstreamId || !outcome.source || !isAlertOutcomeStatus(outcome.status)) {
            invalidOutcomes++
            continue
        }
        outcomeByKey.set(alertOutcomeKey(outcome), outcome)
    }
    const matchedOutcomeKeys = new Set<string>()

    // 1. 处理 newAlerts（INSERT / UPDATE 活跃）
    for (const alert of newAlerts) {
        const upstreamId = alert.upstreamId
        const existing = existingByUpstreamId.get(upstreamId)
        const outcomeKey = alertOutcomeKey(alert)
        const outcome = outcomeByKey.get(outcomeKey)
        if (outcome) {
            matchedOutcomeKeys.add(outcomeKey)
        }

        if (!existing) {
            // 新告警 → INSERT（occurrenceCount=1, firstSeenAt=now, lastSeenAt=now）
            const created = resultRepo.create({
                scanRunId: newRunId,
                repositoryId,
                upstreamId,
                source: alert.source,
                severity: alert.severity,
                packageName: alert.packageName,
                manifestPath: alert.manifestPath,
                ruleId: alert.ruleId,
                summary: alert.summary,
                fixable: alert.fixable,
                fixStrategy: alert.fixStrategy,
                recommendedVersion: alert.recommendedVersion,
                htmlUrl: alert.htmlUrl,
                // 透传 GitHub Advisory ID + CVE 列表（JSON 序列化）
                ghsaId: alert.ghsaId ?? null,
                cveIds: alert.cveIds && alert.cveIds.length > 0 ? JSON.stringify(alert.cveIds) : null,
                fixStatus: outcome?.status ?? 'not-tried',
                errorMessage: outcome?.status === 'failed' ? (outcome.reason ?? null) : null,
                firstSeenAt: now,
                lastSeenAt: now,
                occurrenceCount: 1,
                supersededAt: null,
            })
            await resultRepo.save(created)
            stats.inserted++
            if (outcome) {
                stats.outcomesApplied++
            }
            continue
        }

        // 已存在 → UPDATE 活跃（lastSeenAt / occurrenceCount++ / scanRunId / severity 刷新；fixStatus 按本次结论回写）
        // 注：若 existing.supersededAt 非 NULL（前次被 supersede）且 fixStatus≠success，重新激活：
        // 上游又出现了该告警，语义应是"重新打开"。但本批次决策仅 supersede（不重新打开）：
        // 重新打开属 audit suggest backlog（见 M20.3 待迁移经验），本批次不实现
        if (existing.fixStatus === 'success' && existing.supersededAt !== null) {
            // 不可达分支（查询已按 `supersededAt IS NULL` 过滤，含上方的行恒为活跃）：
            // 保留这段历史语义以便未来实现「重新激活」时不会误改 success 记录（决策 1）。
            // 重新激活当前未实现：supersede 行不会被读出，同一 upstreamId 再现会撞唯一索引。
            stats.preservedSuccess++
            continue
        }

        const previousRunId = existing.scanRunId // eslint-disable-line @typescript-eslint/no-unused-vars -- 保留字段以备未来调试 reconcile 同 run 内跨次扫描关系
        existing.scanRunId = newRunId
        existing.repositoryId = repositoryId
        existing.upstreamId = upstreamId
        existing.source = alert.source
        existing.severity = alert.severity
        existing.packageName = alert.packageName
        existing.manifestPath = alert.manifestPath
        existing.ruleId = alert.ruleId
        existing.summary = alert.summary
        existing.fixable = alert.fixable
        existing.fixStrategy = alert.fixStrategy
        existing.recommendedVersion = alert.recommendedVersion
        existing.htmlUrl = alert.htmlUrl
        // 透传 GitHub Advisory ID + CVE 列表（活跃告警每次刷新）
        existing.ghsaId = alert.ghsaId ?? null
        existing.cveIds = alert.cveIds && alert.cveIds.length > 0 ? JSON.stringify(alert.cveIds) : null
        // firstSeenAt 不变（首次发现时间固定）
        existing.lastSeenAt = now
        existing.occurrenceCount += 1
        // fixStatus / errorMessage：本次运行有结论时回写。该行仍在上游告警列表中，故本次结论是
        // 该实例的最新事实（`success` 也可被后续 `failed` / `converged` 覆盖）——决策 1 的
        // 「修复成就保留」只作用于上游消失时的 supersede 判定，不阻止活跃行更新。
        // 缺键保持原值（本次运行未对该告警下结论 ≠ 回到 not-tried）
        if (outcome) {
            existing.fixStatus = outcome.status
            existing.errorMessage = outcome.status === 'failed' ? (outcome.reason ?? null) : null
            stats.outcomesApplied++
        }

        await resultRepo.save(existing)
        // 同一 run 内同 upstreamId 出现多次（如 executor mock 重复 alert）—— 仍按"刷新"计
        stats.refreshed++

        // 防御：从 existingByUpstreamId 移除以免后续 superseded 误判
        existingByUpstreamId.delete(upstreamId)
        // 注：previousRunId 字段在 line 149 声明（保留以备未来调试 reconcile 同 run 内跨次扫描关系），此处不引用
    }

    // 2. 处理 remaining existingByUpstreamId（newAlerts 中不存在的 upstreamId → 可能需要 supersede）
    // 第一阶段已对"newAlerts 中存在的 existing"做了 delete + refresh；这里 remaining 的全是
    // "newAlerts 中不存在的 upstreamId"——按决策 1-4 处理 supersede / preservedSuccess / unchanged
    for (const [, existing] of existingByUpstreamId) {
        if (existing.fixStatus === 'success') {
            // 决策 1：fixStatus='success' 永不被 supersede（保留修复记录）
            stats.preservedSuccess++
            continue
        }
        if (existing.supersededAt !== null) {
            // 已经 supersede；幂等：保持不变（避免重复 NOW() 影响 occurrenceCount 语义）
            stats.unchanged++
            continue
        }
        // supersede：上游消失 + 未修复 → 标记关闭
        existing.supersededAt = now
        await resultRepo.save(existing)
        stats.superseded++
    }

    // 未生效 = 键漂移（有结论但无对应告警）+ 条目非法（缺字段 / 状态不在白名单）
    stats.outcomesUnmatched = (outcomeByKey.size - matchedOutcomeKeys.size) + invalidOutcomes

    return stats
}
