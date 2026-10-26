// pr-check-watch.ts — PR 创建后的 CI check 回环（CLI / Action 侧，单次运行内等待）。
//
// 目标：发出去的 PR 不再「红了没人管」。等待本次创建 PR 的 check 终态，失败时默认评论
// 失败摘要（job 名 + URL + 尝试标记），显式 `--close-failed-pr` 才在归因 `self_caused` 时
// 关闭 PR 并删除分支。归因来自 core 的 `classifyCheckFailure`（单一事实源）。
//
// 边界（设计 §8.4）：
// - 只等本次运行创建的 PR，不跨进程续等、不写平台库、不做 webhook；
// - 轮询 / 评论 / 关闭失败一律降级（记录），**不改变修复结果与 exit code**；
// - 宽限期后仍观测不到任何 check → `no_ci_detected`，绝不判 `passed`；
// - 未知归因一律 `unknown`：只评论、不关闭。
import type { Octokit } from '@octokit/rest'
import {
    aggregateCheckAttribution,
    classifyCheckFailure,
    isFailedConclusion,
    type CheckAttribution,
    type CheckConclusion,
    type Logger,
    type PrCheckFailureSummary,
    type PrCheckWatchState,
} from '@dependfix/core'
import { closePullRequest, commentOnPullRequest, deleteRemoteBranch } from './pr-creator'
import { formatAttemptMarker, type AttemptMarker } from './fix-fingerprint'
import { escapeTableCell } from './markdown-table'

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 首次轮询间隔。 */
export const PR_CHECK_POLL_INITIAL_MS = 15_000

/** 轮询间隔退避上限。 */
export const PR_CHECK_POLL_MAX_MS = 60_000

/** 宽限期：创建后至少等这么久、且至少两轮轮询才允许判定 `no_ci_detected`。 */
export const PR_CHECK_GRACE_MS = 60_000

/** 单 PR 等待上限默认值（15 分钟）。 */
export const DEFAULT_PR_CHECK_TIMEOUT_MS = 900_000

/** 运行级等待总预算默认值（20 分钟）。 */
export const DEFAULT_PR_CHECK_RUN_BUDGET_MS = 1_200_000

/** GitHub Actions job 预算基线（与 `security-auto-fix.yml` 的 `timeout-minutes: 25` 对齐）。 */
export const DEFAULT_JOB_BUDGET_MS = 25 * 60_000

/** 等待最多占用「剩余 job 预算」的比例（给 install / 验证 / 收尾留余量）。 */
export const JOB_BUDGET_MAX_SHARE = 0.7

/** 报告与评论中保留的失败 job 数上限。 */
export const FAILED_CHECK_SUMMARY_LIMIT = 5

/** 单 PR 轮询次数上限（按 15s→60s 退避，15 分钟预算约 20 轮；上限防注入时钟不前进导致空转）。 */
export const PR_CHECK_MAX_POLLS = 200

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

/** 归一化观测到的一条 check（check run 或 commit status）。 */
export interface ObservedCheck {
    name: string
    conclusion: CheckConclusion
    /** 详情页 URL */
    url?: string
    /** 失败详情文本（用于 external_noise 文本签名） */
    detail?: string
}

/** 单次采集结果（`ok=false` 表示至少一个 API 源失败，本轮不参与终态判定）。 */
interface CollectResult {
    ok: boolean
    checks: ObservedCheck[]
    error?: string
}

export interface WatchPrChecksParams {
    octokit: Octokit
    owner: string
    repo: string
    pr: { number: number, htmlUrl: string }
    /** PR head 分支（作为 check 查询 ref 的兜底） */
    headBranch: string
    /** PR head 提交 SHA（用于精确查询与父提交比对；缺省回退分支名） */
    headSha?: string
    /** 本次 PR 携带的尝试标记（写进失败评论，便于后续计数追溯） */
    attempts?: readonly AttemptMarker[]
    /** 单 PR 等待上限（毫秒） */
    timeoutMs: number
    /** 运行级等待总预算（毫秒） */
    runBudgetMs: number
    /** 剩余 job 预算（毫秒）；缺省不参与折算 */
    jobBudgetRemainingMs?: number
    dryRun: boolean
    closeFailedPr: boolean
    logger: Pick<Logger, 'info' | 'warn' | 'error'>
    /** 注入时钟 / 休眠（测试用；缺省真实实现） */
    sleep?: (ms: number) => Promise<void>
    now?: () => number
}

export interface WatchPrChecksResult {
    state: PrCheckWatchState
    attribution?: CheckAttribution
    closed: boolean
    commented: boolean
    polls: number
    durationMs: number
    failedChecks?: PrCheckFailureSummary[]
    reason?: string
    commentError?: string
    closeError?: string
    /** `timeout` 时绑定到哪一层预算 */
    budgetLimit?: BudgetLimit
}

// ---------------------------------------------------------------------------
// 预算
// ---------------------------------------------------------------------------

/** 预算绑定来源（超时时用于报告 / 评论归因）。 */
export type BudgetLimit = 'pr' | 'run' | 'job'

/**
 * 有效等待上限 = min(per-PR 上限, per-run 预算, 剩余 job 预算 × 70%)，并回传绑定来源。
 *
 * 剩余 job 预算为负 / 0 时立即超时（不再占用 job 时间）。非有限值（NaN / Infinity）按耗尽处理，
 * 避免 `sleep(NaN)` 造成空转。
 */
export function resolveEffectiveTimeout(params: {
    timeoutMs: number
    runBudgetMs: number
    jobBudgetRemainingMs?: number
}): { timeoutMs: number, limit: BudgetLimit } {
    let effective = params.timeoutMs
    let limit: BudgetLimit = 'pr'
    if (params.runBudgetMs < effective) {
        effective = params.runBudgetMs
        limit = 'run'
    }
    if (params.jobBudgetRemainingMs !== undefined) {
        const jobCap = Math.max(0, params.jobBudgetRemainingMs) * JOB_BUDGET_MAX_SHARE
        if (jobCap < effective) {
            effective = jobCap
            limit = 'job'
        }
    }
    const safe = Number.isFinite(effective) ? Math.max(0, Math.floor(effective)) : 0
    return { timeoutMs: safe, limit }
}

// ---------------------------------------------------------------------------
// 采集
// ---------------------------------------------------------------------------

/** check run 结论 → 归一化结论（未完成统一 `pending`）。 */
export function normalizeCheckRunConclusion(status: string | null | undefined, conclusion: string | null | undefined): CheckConclusion {
    if (status !== 'completed') {
        return 'pending'
    }
    switch (conclusion) {
        case 'success':
        case 'failure':
        case 'neutral':
        case 'cancelled':
        case 'skipped':
        case 'stale':
        case 'timed_out':
        case 'action_required':
        case 'startup_failure':
            return conclusion
        default:
            return 'unknown'
    }
}

/** commit status state → 归一化结论（`error` 归一为 `failure`）。 */
export function normalizeCommitStatusConclusion(state: string | null | undefined): CheckConclusion {
    switch (state?.trim().toLowerCase()) {
        case 'success':
            return 'success'
        case 'failure':
        case 'error':
            return 'failure'
        case 'pending':
            return 'pending'
        default:
            return 'unknown'
    }
}

/**
 * 清洗来自目标仓库的 check / status URL（不可信文本）。
 *
 * 只接受 `http(s)`；剥离控制字符与空白（防换行截断），并把括号与竖线百分号编码（防 Markdown 链接结构与表格单元格被劫持）。
 */
export function sanitizeCheckUrl(value: string | null | undefined): string | undefined {
    if (!value) {
        return undefined
    }
    const trimmed = value.trim()
    if (!/^https?:\/\//i.test(trimmed)) {
        return undefined
    }
    const cleaned = trimmed
        // eslint-disable-next-line no-control-regex -- 目标仓库可为 URL 注入控制字符 / 换行，必须剥离
        .replace(/[\u0000-\u001f\u007f\s]+/g, '')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29')
        .replace(/\|/g, '%7C')
    // 超长 URL 不截断（截断后不可点）：直接视为无效
    return cleaned.length > 500 ? undefined : cleaned
}

/** 清洗来自目标仓库的 check / job 名（不可信文本）：去控制字符与换行、压缩空白、截断。 */
export function sanitizeCheckName(value: string | null | undefined): string {
    if (!value) {
        return 'check'
    }
    // eslint-disable-next-line no-control-regex -- 目标仓库可为作业名注入控制字符 / 换行，必须剥离
    const cleaned = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
    if (!cleaned) {
        return 'check'
    }
    return cleaned.length > 100 ? `${cleaned.slice(0, 100)}…` : cleaned
}

function truncateDetail(value: string | null | undefined): string | undefined {
    if (!value) {
        return undefined
    }
    const trimmed = value.trim()
    return trimmed.length > 500 ? `${trimmed.slice(0, 500)}…` : trimmed
}

/** 采集一个 ref 上的全部 check run + commit status（单源失败不阻断另一源）。 */
async function collectObservedChecks(
    octokit: Octokit,
    owner: string,
    repo: string,
    ref: string,
): Promise<CollectResult> {
    const checks: ObservedCheck[] = []
    const errors: string[] = []

    try {
        const checkRuns = await octokit.paginate(octokit.rest.checks.listForRef, {
            owner,
            repo,
            ref,
            per_page: 100,
        })
        for (const run of checkRuns) {
            if (run?.id === undefined || run?.id === null) {
                continue
            }
            checks.push({
                name: sanitizeCheckName(run.name),
                conclusion: normalizeCheckRunConclusion(run.status, run.conclusion),
                url: sanitizeCheckUrl(run.details_url ?? run.html_url),
                detail: truncateDetail([run.output?.title, run.output?.summary].filter(Boolean).join(' — ')),
            })
        }
    } catch (error: unknown) {
        errors.push(`checks.listForRef: ${error instanceof Error ? error.message : String(error)}`)
    }

    try {
        const statuses = await octokit.paginate(octokit.rest.repos.listCommitStatusesForRef, {
            owner,
            repo,
            ref,
            per_page: 100,
        })
        for (const status of statuses) {
            if (status?.id === undefined || status?.id === null) {
                continue
            }
            checks.push({
                name: sanitizeCheckName(status.context),
                conclusion: normalizeCommitStatusConclusion(status.state),
                url: sanitizeCheckUrl(status.target_url),
                detail: truncateDetail(status.description),
            })
        }
    } catch (error: unknown) {
        errors.push(`repos.listCommitStatusesForRef: ${error instanceof Error ? error.message : String(error)}`)
    }

    return {
        ok: errors.length === 0,
        checks,
        error: errors.length > 0 ? errors.join('; ') : undefined,
    }
}

/** 父提交同名作业的结论（按作业名聚合：任一失败 → 失败，任一未完成 → 未完成）。 */
async function collectParentConclusions(
    params: WatchPrChecksParams,
): Promise<Map<string, CheckConclusion>> {
    const { octokit, owner, repo, pr, headSha, logger } = params
    const parentSha = await resolveParentSha({
        octokit,
        owner,
        repo,
        headSha,
        prNumber: pr.number,
        onError: (message) => {
            logger.warn(`PR #${pr.number} parent commit lookup failed: ${message}（归因退化为 unknown）`)
        },
    })
    if (!parentSha) {
        return new Map()
    }
    const collected = await collectObservedChecks(octokit, owner, repo, parentSha)
    if (!collected.ok) {
        logger.warn(`PR #${pr.number} parent checks collection failed: ${collected.error}（归因退化为 unknown）`)
        return new Map()
    }
    const byName = new Map<string, CheckConclusion>()
    for (const check of collected.checks) {
        const current = byName.get(check.name)
        if (current === undefined) {
            byName.set(check.name, check.conclusion)
            continue
        }
        // 同一作业名的多次运行（re-run）：失败优先，其次未完成，其次成功。
        // 父侧 `unknown` / `startup_failure` 折叠为「失败」→ 本次同 job 失败会归 `pre_existing`
        // 而非 `unknown`：方向保守（只评论、不关闭），标签精度略低属已知取舍。
        if (isFailedConclusion(current) || isFailedConclusion(check.conclusion)) {
            byName.set(check.name, 'failure')
        } else if (current === 'pending' || check.conclusion === 'pending') {
            byName.set(check.name, 'pending')
        } else if (current === 'success' || check.conclusion === 'success') {
            byName.set(check.name, 'success')
        }
    }
    return byName
}

/** 解析父提交 SHA：head 提交的 first parent 优先，其次 PR base。失败返回 undefined（归因退化为 unknown）。 */
async function resolveParentSha(params: {
    octokit: Octokit
    owner: string
    repo: string
    headSha: string | undefined
    prNumber: number
    onError: (message: string) => void
}): Promise<string | undefined> {
    const { octokit, owner, repo, headSha, prNumber, onError } = params
    if (headSha) {
        try {
            const { data } = await octokit.rest.repos.getCommit({ owner, repo, ref: headSha })
            const parent = data.parents?.[0]?.sha
            if (parent) {
                return parent
            }
        } catch (error: unknown) {
            onError(error instanceof Error ? error.message : String(error))
        }
    }
    try {
        const { data } = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber })
        return data.base?.sha ?? undefined
    } catch (error: unknown) {
        onError(error instanceof Error ? error.message : String(error))
        return undefined
    }
}

// ---------------------------------------------------------------------------
// 终态判定
// ---------------------------------------------------------------------------

interface TerminalEvaluation {
    state: PrCheckWatchState
    attribution?: CheckAttribution
    failedChecks?: PrCheckFailureSummary[]
}

/**
 * 判定终态；未到终态返回 `undefined`（继续轮询）。
 *
 * 终态条件：已观测到至少一条 check，且全部 check 已完成（无 `pending`）。
 * - 存在失败 → `failed`（逐条归因后聚合；混合归因 → `unknown`）
 * - 无失败且有成功 → `passed`
 * - 无失败且无成功（全是 cancelled / skipped / neutral）→ `cancelled`
 */
export async function evaluateCheckTerminal(
    params: WatchPrChecksParams,
    observed: readonly ObservedCheck[],
): Promise<TerminalEvaluation | undefined> {
    if (observed.length === 0) {
        return undefined
    }
    if (observed.some((check) => check.conclusion === 'pending')) {
        return undefined
    }

    const failures = observed.filter((check) => isFailedConclusion(check.conclusion))
    if (failures.length === 0) {
        const hasSuccess = observed.some((check) => check.conclusion === 'success')
        return { state: hasSuccess ? 'passed' : 'cancelled' }
    }

    // 失败归因：只对失败项做父提交比对（1 + 2 次 API，失败时 fail-open 到 unknown）
    const parentConclusions = await collectParentConclusions(params)
    const failedChecks: PrCheckFailureSummary[] = failures.map((check) => ({
        name: check.name,
        url: check.url,
        attribution: classifyCheckFailure({
            name: check.name,
            conclusion: check.conclusion,
            detail: check.detail,
            parentConclusion: parentConclusions.get(check.name) ?? 'absent',
        }),
    }))
    const attribution = aggregateCheckAttribution(failedChecks.map((check) => check.attribution))

    return {
        state: 'failed',
        attribution,
        failedChecks: failedChecks.slice(0, FAILED_CHECK_SUMMARY_LIMIT),
    }
}

// ---------------------------------------------------------------------------
// 处置
// ---------------------------------------------------------------------------

const ATTRIBUTION_LABEL: Readonly<Record<CheckAttribution, string>> = {
    self_caused: '本次改动导致（self_caused）',
    pre_existing: '既有失败（pre_existing）',
    external_noise: '外部作业噪音（external_noise）',
    cancelled: '已取消 / 跳过（cancelled）',
    unknown: '未判定（unknown）',
}

/** 构造失败评论正文（job 名 + URL + 归因 + 尝试标记）。 */
export function buildCheckFailureComment(params: {
    prNumber: number
    state: PrCheckWatchState
    attribution?: CheckAttribution
    failedChecks?: readonly PrCheckFailureSummary[]
    reason?: string
    attempts?: readonly AttemptMarker[]
    closed?: boolean
}): string {
    const lines: string[] = []
    if (params.state === 'timeout') {
        lines.push('## dependfix：PR check 等待超时（结果未判定）', '')
        lines.push(`PR #${params.prNumber} 的 check 在预算内未全部完成，dependfix 已停止等待并保留该 PR。`)
        if (params.reason) {
            lines.push('', `原因：${params.reason}`)
        }
    } else {
        lines.push('## dependfix：PR check 未通过', '')
        const label = params.attribution ? ATTRIBUTION_LABEL[params.attribution] : ATTRIBUTION_LABEL.unknown
        lines.push(`归因：**${label}**`, '')
        if (params.failedChecks && params.failedChecks.length > 0) {
            lines.push('| Job | 归因 | 详情 |', '|:--|:--|:--|')
            for (const check of params.failedChecks) {
                const name = escapeTableCell(sanitizeCheckName(check.name))
                const url = sanitizeCheckUrl(check.url)
                const detail = url ? `[查看](${url})` : '—'
                lines.push(`| ${name} | ${ATTRIBUTION_LABEL[check.attribution]} | ${detail} |`)
            }
        }
        if (params.attribution === 'unknown') {
            lines.push('', '归因未判定：dependfix 不会自动关闭该 PR，请人工确认失败原因。')
        }
        if (params.attribution === 'self_caused') {
            lines.push('', params.closed
                ? '该 PR 已由 dependfix 关闭（`--close-failed-pr` + `self_caused`）。'
                : '该失败归因于本次改动；确认后可修复后重跑，或开启 `--close-failed-pr` 自动关闭。')
        }
    }
    if (params.attempts && params.attempts.length > 0) {
        lines.push('', '尝试标记：')
        for (const attempt of params.attempts) {
            lines.push(`- ${formatAttemptMarker(attempt)}`)
        }
    }
    lines.push('', '<!-- dependfix:pr-check -->')
    return lines.join('\n')
}

/** 评论失败摘要（dry-run 不评论；失败只记录，不改变 PR 状态）。 */
async function commentFailure(
    params: WatchPrChecksParams,
    evaluation: Pick<TerminalEvaluation, 'state' | 'attribution' | 'failedChecks'> & { reason?: string, closed?: boolean },
): Promise<{ commented: boolean, commentError?: string }> {
    if (params.dryRun) {
        params.logger.info(`[dry-run] Would comment failed checks on PR #${params.pr.number}`)
        return { commented: false }
    }
    const body = buildCheckFailureComment({
        prNumber: params.pr.number,
        state: evaluation.state,
        attribution: evaluation.attribution,
        failedChecks: evaluation.failedChecks,
        reason: evaluation.reason,
        attempts: params.attempts,
        closed: evaluation.closed,
    })
    try {
        await commentOnPullRequest(params.octokit, params.owner, params.repo, params.pr.number, body)
        return { commented: true }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        params.logger.warn(`Failed to comment on PR #${params.pr.number}: ${message}`)
        return { commented: false, commentError: message }
    }
}

/** 关闭失败 PR 并删除分支（仅在显式开关 + `self_caused` + 非 dry-run 时调用）。 */
async function closeFailedPullRequest(
    params: WatchPrChecksParams,
): Promise<{ closed: boolean, closeError?: string }> {
    if (params.dryRun) {
        params.logger.info(`[dry-run] Would close failed PR #${params.pr.number} and delete branch ${params.headBranch}`)
        return { closed: false }
    }
    try {
        await closePullRequest(params.octokit, params.owner, params.repo, params.pr.number)
        params.logger.info(`Closed failed PR #${params.pr.number} (attribution: self_caused)`)
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        params.logger.warn(`Failed to close PR #${params.pr.number}: ${message}`)
        return { closed: false, closeError: `close: ${message}` }
    }
    try {
        await deleteRemoteBranch(params.octokit, params.owner, params.repo, params.headBranch)
        params.logger.info(`Deleted branch of closed PR #${params.pr.number}: ${params.headBranch}`)
    } catch (error: unknown) {
        const status = (error as { status?: number } | null)?.status
        const message = error instanceof Error ? error.message : String(error)
        // 404 / 「Reference does not exist」= 分支已不存在（并发删除 / 自动清理）→ 幂等成功
        if (status === 404 || (status === 422 && /reference does not exist/i.test(message))) {
            params.logger.info(`Branch ${params.headBranch} already absent (deleteRef ${status})`)
            return { closed: true }
        }
        // 其余 422（受保护分支等）分支可能仍存在：PR 已关闭是既成事实，但残留需留痕
        params.logger.warn(`Failed to delete branch ${params.headBranch}${status ? ` (${status})` : ''}: ${message}`)
        return { closed: true, closeError: `delete-branch: ${message}` }
    }
    return { closed: true }
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

/**
 * 等待 PR check 终态并按归因处置。
 *
 * 任何 API / 评论 / 关闭失败都只降级记录，不抛错（调用方不因等待失败改变运行结论）。
 */
export async function watchPullRequestChecks(params: WatchPrChecksParams): Promise<WatchPrChecksResult> {
    const now = params.now ?? (() => Date.now())
    const sleep = params.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
    const budget = resolveEffectiveTimeout({
        timeoutMs: params.timeoutMs,
        runBudgetMs: params.runBudgetMs,
        jobBudgetRemainingMs: params.jobBudgetRemainingMs,
    })
    const effectiveTimeoutMs = budget.timeoutMs
    const budgetReason = (detail: string): string => `${detail}（${budget.limit} 预算）`

    const startedAt = now()
    let polls = 0
    let sleepMs = PR_CHECK_POLL_INITIAL_MS
    let lastError: string | undefined

    const resolveBudgetLimit = (
        state: PrCheckWatchState,
        override: BudgetLimit | null | undefined,
    ): BudgetLimit | undefined => {
        if (state !== 'timeout' || override === null) {
            return undefined
        }
        return override ?? budget.limit
    }

    const finish = async (result: {
        state: PrCheckWatchState
        attribution?: CheckAttribution
        failedChecks?: PrCheckFailureSummary[]
        reason?: string
        /** 覆盖 budgetLimit：`null` = 与预算无关（如轮询次数上限） */
        budgetLimit?: BudgetLimit | null
    }): Promise<WatchPrChecksResult> => {
        let commented = false
        let commentError: string | undefined
        let closed = false
        let closeError: string | undefined

        if (result.state === 'failed' || result.state === 'timeout') {
            const shouldClose = result.state === 'failed'
                && result.attribution === 'self_caused'
                && params.closeFailedPr
            // 先关闭再评论：评论正文需要标注「已关闭」的最终状态
            if (shouldClose) {
                const closeOutcome = await closeFailedPullRequest(params)
                closed = closeOutcome.closed
                closeError = closeOutcome.closeError
            }
            const commentOutcome = await commentFailure(params, {
                state: result.state,
                attribution: result.attribution,
                failedChecks: result.failedChecks,
                reason: result.reason,
                closed,
            })
            commented = commentOutcome.commented
            commentError = commentOutcome.commentError
        }

        params.logger.info(`PR #${params.pr.number} check watch: ${result.state}${result.attribution ? ` (${result.attribution})` : ''} after ${polls} poll(s)`)

        return {
            state: result.state,
            attribution: result.attribution,
            closed,
            commented,
            polls,
            durationMs: Math.max(0, now() - startedAt),
            failedChecks: result.failedChecks,
            reason: result.reason,
            commentError,
            closeError,
            budgetLimit: resolveBudgetLimit(result.state, result.budgetLimit),
        }
    }

    if (effectiveTimeoutMs <= 0) {
        // 预算已耗尽：不发起任何 API 调用，PR 保留交给后续运行 / 平台
        return finish({ state: 'timeout', reason: '等待前预算已耗尽' })
    }

    const ref = params.headSha ?? params.headBranch

    while (true) {
        if (polls >= PR_CHECK_MAX_POLLS) {
            return finish({ state: 'timeout', reason: '达到轮询次数上限', budgetLimit: null })
        }
        const elapsed = now() - startedAt
        if (polls > 0 && elapsed >= effectiveTimeoutMs) {
            return finish({
                state: 'timeout',
                reason: lastError
                    ? budgetReason(`等待超时（最后错误：${lastError}）`)
                    : budgetReason(`等待超时（${Math.round(effectiveTimeoutMs / 1000)}s 内未全部完成）`),
            })
        }

        polls++
        const collected = await collectObservedChecks(params.octokit, params.owner, params.repo, ref)
        if (!collected.ok) {
            lastError = collected.error
            params.logger.warn(`PR #${params.pr.number} check poll failed (will retry): ${collected.error}`)
        } else {
            lastError = undefined
            if (collected.checks.length === 0) {
                // 宽限期 + 至少两轮轮询后才允许 no_ci_detected
                if (polls >= 2 && now() - startedAt >= PR_CHECK_GRACE_MS) {
                    return finish({ state: 'no_ci_detected', reason: 'no check observed after grace period' })
                }
            } else {
                const terminal = await evaluateCheckTerminal(params, collected.checks)
                if (terminal) {
                    return finish(terminal)
                }
            }
        }

        const remaining = effectiveTimeoutMs - (now() - startedAt)
        if (remaining <= 0) {
            return finish({
                state: 'timeout',
                reason: lastError
                    ? budgetReason(`等待超时（最后错误：${lastError}）`)
                    : budgetReason(`等待超时（${Math.round(effectiveTimeoutMs / 1000)}s 内未全部完成）`),
            })
        }
        await sleep(Math.min(sleepMs, remaining))
        sleepMs = Math.min(sleepMs * 2, PR_CHECK_POLL_MAX_MS)
    }
}
