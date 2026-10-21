// scan-trigger.service.ts — 扫描触发路径（异步入队 / 同仓库去重合并 / 入队失败降级同步）与运行序列化。
//
// 从 `api/repos/[id]/scan.post.ts` 抽出：运行失败「受约束重试入口」（`api/runs/[id]/retry.post.ts`）
// 复用同一路径，使「同仓库去重合并」与「降级同步」语义单点，避免两条触发链漂移
// （口径见 docs/design/governance/run-failure-taxonomy.md §5.5）。
//
// 端点侧仍负责各自的鉴权 / 归属 / 请求校验（scan 走 schema 校验，retry 走来源 run 校验）。
import { SCAN_JOB_PRIORITY } from './queue/queue-mode'
import { getQueueService } from './queue/queue.service'
import type { ScanQueue } from './queue/scan-queue'
import { applyFailureClassification } from './run-failure-classify'
import { createPendingScanRun, runScanForRepository, type ScanRequest } from './scan-orchestrator.service'
import { isTerminalScanRunStatus } from './scan-run-status'
import { ensureDatabaseInitialized } from '#server/database'
import { ScanRun } from '#server/entities/scan-run'
import type { ScanRequestInput } from '#server/schemas/scan'

/** 入队半成功且 worker 已抢先完成：终态冲突（端点映射 409 SCAN_ALREADY_COMPLETED）。 */
export class ScanAlreadyCompletedError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ScanAlreadyCompletedError'
    }
}

export interface TriggerScanOptions {
    /**
     * 用户主动复用既有 ScanRun（alerts 视图「立即修复」：report-only 结果作为 fix 输入）。
     * 「受约束重试入口」**不传**——重试必须新建 run，原失败记录不得被覆写。
     */
    reuseExisting?: ScanRun | null
    /** 「受约束重试入口」的来源 run id（写入新 run 的 `retriedFromRunId`，供审计与来源链追溯） */
    retriedFromRunId?: string
    /** 手动触发 / 重试操作者（写入 triggeredByUserId，供业务通知定向投递） */
    triggeredByUserId?: string
}

export interface TriggerScanOutcome {
    run: ScanRun
    /** 去重合并提示（存在即表示本次触发被合并、未真正执行；前端据此提示且不跳转） */
    merged?: { code: string, message: string }
}

export interface EnqueueScanJobOptions {
    priority?: number
    /** 用户主动复用既有 run（透传给 worker，绕过终态校验） */
    reuse?: boolean
}

/**
 * 入队扫描 job（单仓触发 / 批量触发共用，含僵尸去重键自愈）。
 *
 * 自愈规则：`add` 命中复用后，若既有 job 承载的 run 已终态或不存在，说明该 job 是
 * 「worker 死后遗留的僵尸 job」（或归属历史 run 的残留），直接 remove 后重试一次。
 * 这样新的触发不会被 `SCAN_PENDING_MERGED` 永久合并——即使周期清理尚未跑到。
 *
 * 归属另一个**非终态** run 时保持既有合并语义（真正排队 / 执行中的任务不应被抢占）。
 */
export const enqueueScanJob = async (
    queue: ScanQueue,
    repositoryId: string,
    request: ScanRequest,
    run: ScanRun,
    options: EnqueueScanJobOptions = {},
): Promise<{ reused: boolean }> => {
    const add = () => queue.add(repositoryId, request, {
        priority: options.priority,
        runId: run.id,
        reuse: options.reuse,
    })
    let result = await add()
    if (!result.reused) {
        return { reused: false }
    }
    // 无 runId 的旧 job / 就是当前 run：保持既有合并语义
    if (!result.existingRunId || result.existingRunId === run.id) {
        return { reused: true }
    }
    const ds = await ensureDatabaseInitialized()
    const owner = await ds.getRepository(ScanRun).findOne({
        where: { id: result.existingRunId },
        select: { id: true, status: true },
    })
    if (owner && !isTerminalScanRunStatus(owner.status)) {
        return { reused: true }
    }
    const { removed } = await queue.remove(repositoryId, result.existingRunId)
    if (!removed) {
        return { reused: true }
    }
    result = await add()
    return { reused: result.reused }
}

/**
 * 触发单仓库扫描（渐进式降级）：
 * - async（Redis 可用）：预创建 pending run + 入队，立即返回（前端轮询状态）；
 *   入队失败 failover 同步执行（续用 pending run，任务不丢失）
 * - sync（无 Redis / QUEUE_ENABLED=false）：请求内同步完成（既有行为）
 */
export const triggerScanForRepository = async (
    repositoryId: string,
    params: ScanRequestInput,
    options: TriggerScanOptions = {},
): Promise<TriggerScanOutcome> => {
    const reuseExisting = options.reuseExisting ?? null
    const retriedFromRunId = options.retriedFromRunId
    const triggeredByUserId = options.triggeredByUserId
    const queueService = await getQueueService()

    if (queueService.mode === 'async' && queueService.queue) {
        // reuse 路径：复用既有 run.id；新建路径：createPendingScanRun 返回实体。
        // 来源仅在存在时透传第三参（不向既有调用点注入 undefined 第三参——调用约定与既有断言一致）
        let pendingRun: ScanRun
        if (reuseExisting) {
            pendingRun = reuseExisting
        } else if (retriedFromRunId === undefined) {
            pendingRun = await createPendingScanRun(repositoryId, params, { triggeredByUserId })
        } else {
            pendingRun = await createPendingScanRun(repositoryId, params, { retriedFromRunId, triggeredByUserId })
        }
        try {
            const { reused } = await enqueueScanJob(queueService.queue, repositoryId, params, pendingRun, {
                priority: SCAN_JOB_PRIORITY.manual,
                reuse: !!reuseExisting, // 用户主动复用：worker 端透传 reuse=true 绕过终态校验
            })
            if (!reused) {
                return { run: pendingRun }
            }
            if (reuseExisting) {
                // 复用既有终态 run + 同仓库已有进行中任务（去重合并）：
                // **既有 run 记录保持不变**（用户指定的历史结果不得被推翻、不得落 failed），
                // 仅回应「已合并」提示；后续按既有 run.id 关联的历史 / 告警不受影响。
                return {
                    run: pendingRun,
                    merged: {
                        code: 'SCAN_PENDING_MERGED',
                        message: '该仓库已有进行中的扫描任务，本次触发已合并（既有 run 记录保持不变）',
                    },
                }
            }
            // 新建路径产生**孤儿 pending run**（无任何 job 承载它）：置 failed + duplicate 提示，
            // 避免前端轮询 10 分钟后误报"扫描仍在进行"
            pendingRun.status = 'failed'
            pendingRun.finishedAt = new Date()
            const mergedFailure = {
                code: 'SCAN_PENDING_MERGED', // 与 ServerErrorCode 联合类型对齐（已定义 SCAN_PENDING_MERGED 但 throw 路径未使用）
                message: '该仓库已有进行中的扫描任务，本次触发已合并',
            }
            pendingRun.errorJson = JSON.stringify(mergedFailure)
            applyFailureClassification(pendingRun, { status: 'failed', error: mergedFailure })
            const ds = await ensureDatabaseInitialized()
            await ds.getRepository(ScanRun).save(pendingRun)
            return { run: pendingRun, merged: mergedFailure }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            if (message.includes('已处于终态')) {
                // 终态冲突（入队半成功且 worker 已抢先完成）：端点映射 409 提示而非 500 裸错误
                throw new ScanAlreadyCompletedError(message)
            }
            console.warn(`[scan] 入队失败，降级同步执行：${message}`)
            // 降级路径须与入队成功路径（`reuse: !!reuseExisting`）及同步路径同源透传 reuse——
            // 否则「复用终态 run」+ 入队失败叠加时，orchestrator 终态校验会抛「已处于终态」
            const run = await runScanForRepository(repositoryId, params, {
                runId: pendingRun.id,
                reuse: !!reuseExisting,
                triggeredByUserId,
            })
            return { run }
        }
    }

    // 同步降级：请求内完成扫描（既有行为；reuse 路径传 runId + reuse:true 让 orchestrator
    // 绕过终态校验并重置既有 record 的 finishedAt / errorJson / summaryJson）
    if (reuseExisting) {
        const reusedRun = await runScanForRepository(repositoryId, params, {
            runId: reuseExisting.id,
            reuse: true,
            triggeredByUserId,
        })
        return { run: reusedRun }
    }
    const run = retriedFromRunId === undefined
        ? await runScanForRepository(repositoryId, params, { triggeredByUserId })
        : await runScanForRepository(repositoryId, params, { retriedFromRunId, triggeredByUserId })
    return { run }
}

/** 返回视图（不含敏感字段）：scan / retry 两端点共用，避免两套序列化漂移。 */
export const serializeScanRun = (run: ScanRun): Record<string, unknown> => ({
    id: run.id,
    repositoryId: run.repositoryId,
    mode: run.mode,
    severityThreshold: run.severityThreshold,
    executorKind: run.executorKind,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    runUrl: run.runUrl,
    summary: run.summaryJson ? JSON.parse(run.summaryJson) as Record<string, unknown> : null,
    error: run.errorJson ? JSON.parse(run.errorJson) as { code: string, message: string } : null,
    /** 重试来源（非重试触发为 null）；前端据此展示来源链 */
    retriedFromRunId: run.retriedFromRunId ?? null,
})
