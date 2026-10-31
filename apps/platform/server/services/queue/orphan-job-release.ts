import { isTerminalScanRunStatus } from '../scan-run-status'
import type { ScanQueue } from './scan-queue'
import { ScanRun } from '#server/entities/scan-run'
import { ensureDatabaseInitialized } from '#server/database'
import { logger } from '#server/utils/logger'

/** 孤儿 run 引用（repositoryId 定位 jobId，runId 用于归属校验） */
export interface OrphanRunRef {
    repositoryId: string
    runId: string
}

export interface OrphanJobReleaseOptions {
    /**
     * 查询 run 状态（缺省读 DB）：仅用于「job 归属另一个 run」分支的归属判定。
     * 返回 null 表示 run 不存在（按孤儿 job 处理）。
     */
    resolveRunStatus?: (runId: string) => Promise<string | null>
}

export interface OrphanJobReleaseResult {
    /** 实际释放的 job 数 */
    removed: number
    /** 因归属另一个非终态 run 而保留的 job 数 */
    skipped: number
}

const defaultResolveRunStatus = async (runId: string): Promise<string | null> => {
    const ds = await ensureDatabaseInitialized()
    const run = await ds.getRepository(ScanRun).findOne({
        where: { id: runId },
        select: { id: true, status: true },
    })
    return run?.status ?? null
}

/**
 * 释放孤儿 run 占用的队列去重键（jobId = scan-<repositoryId>）。
 *
 * 背景：stale cleanup 把 DB ScanRun 置 failed 后，BullMQ job 若仍处于 waiting/active，
 * 去重键会被持续占用 → 后续触发被 SCAN_PENDING_MERGED 永久合并。
 *
 * 归属收敛（三档）：
 * 1. job 无 runId（旧 job / 非 scan job）或 runId 与孤儿 run 一致 → 按孤儿 run 释放；
 * 2. job 归属另一个 run：该 run 已终态 / 不存在 → 释放（僵尸 job）；
 *    该 run 非终态 → 保留（它自己的清理轮次会处理，避免误删新触发任务）；
 * 3. inspect / remove 失败 → 仅告警，不阻断其余释放（下一轮重试）。
 */
export const releaseOrphanQueueJobs = async (
    queue: Pick<ScanQueue, 'inspect' | 'remove'>,
    orphanedRuns: OrphanRunRef[],
    options: OrphanJobReleaseOptions = {},
): Promise<OrphanJobReleaseResult> => {
    const resolveRunStatus = options.resolveRunStatus ?? defaultResolveRunStatus
    let removed = 0
    let skipped = 0

    for (const run of orphanedRuns) {
        try {
            const job = await queue.inspect(run.repositoryId)
            if (!job) {
                continue
            }
            // 档 1a：legacy job 无 runId —— 用原始 runId（`''`）作归属哨兵，
            // remove 内部会再次比对，避免 inspect 与 remove 之间被新触发替换后误删
            if (job.runId === null) {
                const { removed: hit } = await queue.remove(run.repositoryId, job.runIdKey)
                if (hit) {
                    removed++
                }
                continue
            }
            // 档 1b：归属当前孤儿 run
            if (job.runId === run.runId) {
                const { removed: hit } = await queue.remove(run.repositoryId, job.runId)
                if (hit) {
                    removed++
                }
                continue
            }
            // 档 2：归属另一个 run —— 仅当该 run 已终态 / 不存在时释放
            const ownerStatus = await resolveRunStatus(job.runId)
            if (ownerStatus === null || isTerminalScanRunStatus(ownerStatus)) {
                const { removed: hit } = await queue.remove(run.repositoryId, job.runId)
                if (hit) {
                    removed++
                }
            } else {
                skipped++
            }
        } catch (error) {
            logger.error(`[stale-cleanup] 释放孤儿 run ${run.runId} 队列 job 失败`, { error })
        }
    }

    return { removed, skipped }
}
