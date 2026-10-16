import { scanRequestSchema } from '#server/schemas/scan'
import { ScanRun } from '#server/entities/scan-run'
import { Repository } from '#server/entities/repository'
import { ensureDatabaseInitialized } from '#server/database'
import {
    ScanAlreadyCompletedError,
    serializeScanRun,
    triggerScanForRepository,
} from '#server/services/scan-trigger.service'
import { requireOrgResource, requireRole } from '#server/utils/guard'
import { createLocalizedError } from '#server/utils/localized-error'

/**
 * POST /api/repos/[id]/scan：触发单仓库扫描（写操作限 admin/org_admin）。
 *
 * 执行模式（渐进式降级）与「同仓库去重合并」语义见 `#server/services/scan-trigger.service`
 * （单一事实源；运行失败「受约束重试入口」`POST /api/runs/[id]/retry` 复用同一路径）。
 *
 * reuseScanRunId（todo.md §M16.2 C66-D）：
 * - alerts 视图 "立即修复此仓库" 入口触发复用既有 ScanRun（report-only run 的结果作为输入）
 * - 跳过 createPendingScanRun，复用 run_id 直接入队 / 同步执行；扫描结果不变更 run_id，
 *   历史与告警可继续按 id 关联
 * - 校验归属（repositoryId 必须等于 [id]）+ 校验不与进行中任务冲突（running → 409）
 */
export default defineEventHandler(async (event) => {
    await requireRole(event, ['admin', 'org_admin'])

    const id = getRouterParam(event, 'id') as string
    if (!id) {
        throw createLocalizedError(event, { statusCode: 400, code: 'REPO_ID_MISSING' })
    }

    // 扫描目标仓库必须存在且归属当前组织
    const ds = await ensureDatabaseInitialized()
    const repo = ds.getRepository(Repository)
    const found = await repo.findOne({ where: { id } })
    if (!found) {
        throw createLocalizedError(event, { statusCode: 404, code: 'REPO_NOT_FOUND' })
    }
    await requireOrgResource(event, found.organizationId)

    const body = await readBody<Record<string, unknown>>(event).catch(() => ({}))
    const parsed = scanRequestSchema.safeParse(body)

    if (!parsed.success) {
        throw createLocalizedError(event, {
            statusCode: 400,
            code: 'REPO_VALIDATION_FAILED',
            data: { issues: parsed.error.issues },
        })
    }

    // reuseScanRunId 校验：存在 / 归属 / 非 running
    // —— running 状态拒绝复用（与同仓库互斥锁 withRepoLock 冲突，会出现两个 worker 写同一 workDir）
    let reuseExisting: ScanRun | null = null
    if (parsed.data.reuseScanRunId) {
        const runRepo = ds.getRepository(ScanRun)
        const existing = await runRepo.findOne({ where: { id: parsed.data.reuseScanRunId } })
        if (!existing) {
            throw createLocalizedError(event, { statusCode: 404, code: 'SCAN_RUN_NOT_FOUND' })
        }
        if (existing.repositoryId !== id) {
            throw createLocalizedError(event, {
                statusCode: 400,
                code: 'REUSE_RUN_NOT_IN_REPO',
            })
        }
        if (existing.status === 'running') {
            throw createLocalizedError(event, {
                statusCode: 409,
                code: 'REUSE_RUN_RUNNING',
            })
        }
        reuseExisting = existing
    }

    try {
        const { run, merged } = await triggerScanForRepository(id, parsed.data, { reuseExisting })
        return { ...serializeScanRun(run), ...(merged ? { merged } : {}) }
    } catch (error) {
        if (error instanceof ScanAlreadyCompletedError) {
            // 终态冲突（入队半成功且 worker 已抢先完成）：409 提示而非 500 裸错误
            throw createLocalizedError(event, { statusCode: 409, code: 'SCAN_ALREADY_COMPLETED' })
        }
        throw error
    }
})
