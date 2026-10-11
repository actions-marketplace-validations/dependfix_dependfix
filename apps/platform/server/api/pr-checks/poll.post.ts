import { ensureDatabaseInitialized } from '#server/database'
import { requireOrgResource, requireRole } from '#server/utils/guard'
import { resolveOrganizationId } from '#server/utils/organization'
import { resolveRepositoryIds } from '#server/services/scheduler/selector'
import { runPrCheckPoll } from '#server/services/scheduler/scheduler.service'

/**
 * POST /api/pr-checks/poll：手动触发当前组织一轮 PR Check 状态 polling（同步）。
 *
 * 动机：PR Check 数据由 `schedule.kind='pr-check'` 的定时计划驱动，页面本身只有 ack 操作；
 * 无 pr-check 计划时列表只能显示数据库缓存值。本端点让管理员即时刷新监测链路
 * （也可用于人工验证 polling 配置是否正确）。
 *
 * 语义（与 scheduled 链路同源，共享 `runPrCheckPoll`）：
 * - 总开关 `ACTION_STATUS_MONITOR_ENABLED` 未启用 → 返回 `{ skipped: true }`（不报错；前端据此提示「监测未启用」）
 * - 已启用 → 按仓库聚合 credential → Octokit → `pollOnce`，返回 `processed` / `errors` 统计
 *
 * 范围收敛：`resolveRepositoryIds(kind='all', organizationId)` 只返回**当前组织**仓库
 * （`organizationId` 由服务端派生、无客户端入参，跨组织仓库不可被选中）；`requireOrgResource`
 * 用于与其他写端点保持一致的归属校验形状（单组织模型下其为恒真校验，不额外收敛范围）。
 *
 * 性能边界：请求路径内直调 GitHub API，耗时随仓库数线性增长；单次仓库数受 `MAX_POLL_REPOSITORIES`
 * 上限约束，超出部分本次不 polling 并在响应 `truncated` / `candidateCount` 披露（前端提示本次仅处理部分仓库；
 * 当前无 offset 轮转，重复触发仍取同一批——如需覆盖剩余仓库请另开候选）。
 * HTTP 请求未加显式超时（与既有 scheduled 链路同源；超时兜底来自底层 transport）。
 */
const MAX_POLL_REPOSITORIES = 50

export default defineEventHandler(async (event) => {
    await requireRole(event, ['admin', 'org_admin'])

    const ds = await ensureDatabaseInitialized()
    const organizationId = await resolveOrganizationId(ds)
    await requireOrgResource(event, organizationId)

    const candidates = await resolveRepositoryIds(ds, {
        kind: 'all',
        data: {},
        organizationId,
    })
    const repositoryIds = candidates.slice(0, MAX_POLL_REPOSITORIES)
    const truncated = candidates.length > repositoryIds.length

    const result = await runPrCheckPoll(ds, repositoryIds, {
        organizationId,
        logLabel: 'manual trigger',
    })

    return {
        skipped: result.skipped === true,
        processed: result.processed,
        errors: result.errors,
        candidateCount: candidates.length,
        truncated,
    }
})
