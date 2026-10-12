import type { Octokit } from '@octokit/rest'
import type {
    PRCheckSnapshot,
    PRCheckSyncInput,
    PRCheckSyncSource,
    UnifiedBuildSignal,
} from './types'
import {
    aggregateOverallStatus,
    capSignals,
    deriveWorstConclusion,
    isWithinUpdatedWindow,
    normalizeCheckRun,
    normalizeCommitStatus,
    normalizeDeployment,
    pickCheckRunId,
    pickErrorSummary,
} from './build-signals'

/** deployment status 的最小字段集（归一化输入） */
type DeploymentStatusInput = {
    state?: string | null
    description?: string | null
    environment_url?: string | null
    target_url?: string | null
    log_url?: string | null
}

/**
 * 轮询同步源：通过 GitHub REST API 拉取"目标 PR"的**三源**构建 / 部署信号。
 *
 * 数据流（详见 [pr-build-deploy-signals.md](../../../../docs/design/governance/pr-build-deploy-signals.md) §3.3）：
 * 1. `octokit.paginate(octokit.rest.pulls.list, { state: 'open', sort: 'updated' })` 拉取仓库 open PRs
 * 2. 过滤 author ∈ TARGET_PR_AUTHOR_LOGINS（`dependfix[bot]` / `dependabot[bot]`）
 * 3. 轮询节流：仅处理 `updated_at` 在窗口内的 PR（`isWithinUpdatedWindow`）；另跳过调用方传入的
 *    「终态 + HEAD 未变 + 静默窗口内」PR（`knownTerminalHeads`）
 * 4. 对每个目标 PR HEAD 调三组 API（各自 fail-open，单源失败不阻断其它源）：
 *    - `checks.listForRef` → check runs（GitHub Actions / Cloudflare Workers Builds 等）
 *    - `repos.listCommitStatusesForRef` → commit statuses（Vercel 每 project 一个 context / 其它 CI）
 *    - `repos.listDeployments` + `repos.listDeploymentStatuses` → deployments（取每 deployment 最新 status）
 * 5. 归一化为 `UnifiedBuildSignal[]`（provider 归因 + 状态映射，见 `build-signals.ts`）
 * 6. 聚合出 `overallStatus`（失败优先）与派生 `conclusion`（保留 `timed_out` / `action_required` 粒度）
 * 7. 组装 PRCheckSnapshot 返回给 ActionStatusMonitor
 *
 * 与设计稿的一处实现细化：commit statuses 改用**分页版** `listCommitStatusesForRef`
 * （设计稿列 `getCombinedStatusForRef`）——combined status 的 `statuses` 数组有上限，
 * 分页版才能满足「列出全部 commit statuses」的语义。
 *
 * 无任何信号的 PR（无 check / 无 status / 无 deployment）**不产出快照**（保持「无信号不落库」语义）。
 *
 * 凭据要求：依赖 AuthProvider 实例由调用方注入（M18.x 已落地 AuthProvider 抽象层）；
 * service 构造时校验 Octokit 实例非空，401 错误由上游 Octokit retry policy 自动重试。
 *
 * GitHub API 限流：三源合计 3+ 次/PR/轮，polling 默认 5min/仓（关键决策 D2）足够支撑小规模部署；
 * 429/secondary rate limit 由 packages/engine retry policy 自动 backoff
 * （详见 packages/engine/src/github/client.ts §applyRetryPolicy）；节流（窗口 + 终态跳过）进一步降频。
 */
export class PollingSource implements PRCheckSyncSource {
    constructor(private readonly octokit: Octokit) {}

    async fetchSnapshots(input: PRCheckSyncInput): Promise<PRCheckSnapshot[]> {
        const { owner, repo, repositoryId, knownTerminalHeads } = input
        const observedAt = new Date()

        // 1. 拉取所有 open PRs（按 updated_at 降序）
        const pulls = await this.octokit.paginate(this.octokit.rest.pulls.list, {
            owner,
            repo,
            state: 'open',
            sort: 'updated',
            direction: 'desc',
            per_page: 100,
        })

        const snapshots: PRCheckSnapshot[] = []
        for (const pr of pulls) {
            const authorLogin = pr.user?.login
            if (!authorLogin || !isTargetAuthor(authorLogin)) {
                continue
            }

            const headSha = pr.head.sha
            if (!headSha) {
                continue
            }

            // 2. 轮询节流：仅处理最近有更新的 open PR（陈旧 PR 不再打三源 API）
            if (!isWithinUpdatedWindow(pr.updated_at, observedAt)) {
                continue
            }

            // 3. 终态节流：已确认「终态 + HEAD 未变 + 静默窗口内」的 PR 本轮跳过（省三源 API）
            if (knownTerminalHeads?.get(pr.number) === headSha) {
                continue
            }

            // 4. 三源采集 + 归一化（各源 fail-open）
            const signals = capSignals(await this.fetchSignals({ owner, repo, ref: headSha, observedAt }))
            if (signals.length === 0) {
                continue
            }

            snapshots.push({
                repositoryId,
                owner,
                repo,
                prNumber: pr.number,
                headSha,
                authorLogin,
                conclusion: deriveWorstConclusion(signals),
                signals,
                overallStatus: aggregateOverallStatus(signals),
                checkRunId: pickCheckRunId(signals),
                detailsUrl: pr.html_url,
                errorMessage: pickErrorSummary(signals),
                observedAt,
            })
        }

        return snapshots
    }

    /**
     * 采集三源并归一化。每个源独立 try/catch（fail-open）：
     * 单源 API 失败只记录日志并跳过该源，其余源照常产出（AC ④）。
     */
    private async fetchSignals(input: {
        owner: string
        repo: string
        ref: string
        observedAt: Date
    }): Promise<UnifiedBuildSignal[]> {
        const { owner, repo, ref, observedAt } = input
        const signals: UnifiedBuildSignal[] = []

        // 源 1：check runs（GitHub Actions / Cloudflare Workers Builds / 其它注册 app）
        try {
            const checkRuns = await this.octokit.paginate(this.octokit.rest.checks.listForRef, {
                owner,
                repo,
                ref,
                per_page: 100,
            })
            // 形态守卫：仅接受带 id 的条目。Octokit `paginate` 在响应缺少 `total_count`（非标准形态，
            // 如代理 / 兼容层返回）时会把**整个 body 当作单个元素**返回，若不守卫会产出无 id 的伪信号。
            signals.push(
                ...checkRuns
                    .filter((run) => run?.id !== undefined && run?.id !== null)
                    .map((run) => normalizeCheckRun(run, observedAt)),
            )
        } catch (error) {
            console.warn(`[pr-check-monitor] ${owner}/${repo}@${ref} check runs 采集失败（fail-open）：`, error)
        }

        // 源 2：commit statuses（Vercel / GitLab CI / 自建 CI）
        try {
            const statuses = await this.octokit.paginate(this.octokit.rest.repos.listCommitStatusesForRef, {
                owner,
                repo,
                ref,
                per_page: 100,
            })
            signals.push(
                ...statuses
                    .filter((status) => status?.id !== undefined && status?.id !== null)
                    .map((status) => normalizeCommitStatus(status, observedAt)),
            )
        } catch (error) {
            console.warn(`[pr-check-monitor] ${owner}/${repo}@${ref} commit statuses 采集失败（fail-open）：`, error)
        }

        // 源 3：deployments（+ 每 deployment 最新 status）
        try {
            const deployments = await this.octokit.paginate(this.octokit.rest.repos.listDeployments, {
                owner,
                repo,
                sha: ref,
                per_page: 100,
            })
            for (const deployment of deployments) {
                if (deployment?.id === undefined || deployment?.id === null) {
                    continue
                }
                let latestStatus: DeploymentStatusInput | null = null
                try {
                    latestStatus = await this.fetchLatestDeploymentStatus({
                        owner,
                        repo,
                        deploymentId: deployment.id,
                    })
                } catch (error) {
                    // 单个 deployment 的 status 失败不影响其它 deployment / 其它源
                    console.warn(
                        `[pr-check-monitor] ${owner}/${repo} deployment ${deployment.id} status 采集失败（fail-open）：`,
                        error,
                    )
                }
                signals.push(normalizeDeployment(deployment, latestStatus, observedAt))
            }
        } catch (error) {
            console.warn(`[pr-check-monitor] ${owner}/${repo}@${ref} deployments 采集失败（fail-open）：`, error)
        }

        return signals
    }

    /** 取某 deployment 的最新 status（列表按 created_at 降序，取首条；无 status 时返回 null） */
    private async fetchLatestDeploymentStatus(input: {
        owner: string
        repo: string
        deploymentId: number
    }): Promise<DeploymentStatusInput | null> {
        const statuses = await this.octokit.paginate(this.octokit.rest.repos.listDeploymentStatuses, {
            owner: input.owner,
            repo: input.repo,
            deployment_id: input.deploymentId,
            per_page: 100,
        })
        return statuses[0] ?? null
    }
}

/**
 * 判定 PR 作者是否为监测目标（详见 docs/plan/todo.md §M24.1）。
 *
 * 匹配规则（小写不敏感）：
 * - login === 'dependabot[bot]'（GitHub 官方 bot，所有 dependabot PR 一致）
 * - login.toLowerCase().endsWith('[bot]') && login.toLowerCase().includes('dependfix')：
 *   兼容 M18.x 接入 GitHub App 后动态生成的 bot 名（如 `12345+dependfix[bot]`）
 *
 * 不匹配的 PR（如人工创建的 PR）一律忽略，避免 alerts 噪声。
 */
const isTargetAuthor = (login: string): boolean => {
    const lower = login.toLowerCase()
    if (lower === 'dependabot[bot]') {
        return true
    }
    if (lower.endsWith('[bot]') && lower.includes('dependfix')) {
        return true
    }
    return false
}

/** 导出供 ActionStatusMonitor 单测引用 */
export { isTargetAuthor }
