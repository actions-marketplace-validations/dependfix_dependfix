// pr-check-watch-run.ts — 把 PR check 回环接到编排层（从 app/index.ts 拆出，控制文件行数）。
//
// 职责：折算预算 → 调 [watchPullRequestChecks] → 把结果写进 run 级报告与 summary 计数器。
// 等待链自身异常一律吞掉（只记日志）：设计 §8 / §11 降级矩阵要求轮询不改变修复结果与 exit code。
import type { Octokit } from '@octokit/rest'
import { toErrorMessage } from '@dependfix/core'
import {
    DEFAULT_JOB_BUDGET_MS,
    DEFAULT_PR_CHECK_RUN_BUDGET_MS,
    DEFAULT_PR_CHECK_TIMEOUT_MS,
    watchPullRequestChecks,
} from '../github'
import { collectAttemptMarkers } from '../github/fix-fingerprint'
import type { AppContext } from './helpers'

export interface RunPrCheckWatchParams {
    ctx: Pick<AppContext, 'config' | 'logger' | 'allActions' | 'attemptTracking' | 'summary' | 'startedAt' | 'prCheckWatch'>
    octokit: Octokit
    owner: string
    repo: string
    pr: { number: number, htmlUrl: string, headSha?: string }
    branchName: string
    /** 注入等待实现（测试用；缺省真实轮询） */
    watch?: typeof watchPullRequestChecks
    /** 注入「当前时间」（测试用；缺省 Date.now） */
    now?: () => number
}

/**
 * 等待本次创建 PR 的 check 终态并按归因处置。
 *
 * - 双预算：per-PR 上限 + per-run 总预算，且不超过剩余 job 预算的 70%
 * - 只等本次创建的 PR；不跨进程续等、不写平台库
 * - 任何失败（API / 评论 / 关闭）只记录，不影响修复结果与 exit code
 */
export async function runPrCheckWatch(params: RunPrCheckWatchParams): Promise<void> {
    const { ctx, octokit, owner, repo, pr, branchName } = params
    const { config, logger, summary, prCheckWatch } = ctx
    const timeoutMs = config.prCheckTimeoutMs ?? DEFAULT_PR_CHECK_TIMEOUT_MS
    const runBudgetMs = config.prCheckRunBudgetMs ?? DEFAULT_PR_CHECK_RUN_BUDGET_MS
    const now = params.now ?? (() => Date.now())
    const startedAtMs = Date.parse(ctx.startedAt)
    const elapsedMs = Number.isNaN(startedAtMs) ? 0 : Math.max(0, now() - startedAtMs)
    // job 预算基线：显式配置优先；否则只在 GitHub Actions 环境按 25 分钟套用
    // （本地 / 平台执行没有 Actions job 超时语义，不臆造上限）
    const jobBudgetMs = config.jobBudgetMs
        ?? (process.env.GITHUB_ACTIONS === 'true' ? DEFAULT_JOB_BUDGET_MS : undefined)
    const jobBudgetRemainingMs = jobBudgetMs === undefined ? undefined : jobBudgetMs - elapsedMs
    const watch = params.watch ?? watchPullRequestChecks
    // per-run 总预算跨 PR 累计：已消耗 = 已记录 attempt 的 durationMs 之和
    const spentRunBudgetMs = prCheckWatch?.attempts.reduce((sum, attempt) => sum + attempt.durationMs, 0) ?? 0
    const remainingRunBudgetMs = Math.max(0, runBudgetMs - spentRunBudgetMs)

    if (prCheckWatch?.runBudgetExhausted) {
        // 预算已在先前 PR 上耗尽：不再发起等待（单 PR/run 时不可达，多 PR 场景的短路）
        logger.warn('PR check watch skipped: run budget already exhausted')
        prCheckWatch.attempts.push({
            pr: { number: pr.number, htmlUrl: pr.htmlUrl },
            state: 'timeout',
            closed: false,
            commented: false,
            polls: 0,
            durationMs: 0,
            reason: 'run budget exhausted earlier in this run',
        })
        summary.checksTimedOut += 1
        return
    }

    try {
        const result = await watch({
            octokit,
            owner,
            repo,
            pr: { number: pr.number, htmlUrl: pr.htmlUrl },
            headBranch: branchName,
            headSha: pr.headSha,
            attempts: collectAttemptMarkers(ctx.attemptTracking ?? [], ctx.allActions),
            timeoutMs,
            runBudgetMs: remainingRunBudgetMs,
            jobBudgetRemainingMs,
            dryRun: config.dryRun,
            closeFailedPr: config.closeFailedPr ?? false,
            logger,
        })

        if (prCheckWatch) {
            prCheckWatch.attempts.push({
                pr: { number: pr.number, htmlUrl: pr.htmlUrl },
                state: result.state,
                attribution: result.attribution,
                closed: result.closed,
                commented: result.commented,
                polls: result.polls,
                durationMs: result.durationMs,
                failedChecks: result.failedChecks,
                reason: result.reason,
                commentError: result.commentError,
                closeError: result.closeError,
            })
            if (result.state === 'timeout' && result.budgetLimit === 'run') {
                prCheckWatch.runBudgetExhausted = true
            }
        }
        if (result.state === 'timeout') {
            summary.checksTimedOut += 1
        }
        if (result.closed) {
            summary.prsClosedAfterFailure += 1
        }
    } catch (error: unknown) {
        // 等待链自身异常不得影响修复结论（设计 §8 / §11 降级矩阵）；报告仍留一条未判定记录
        const message = toErrorMessage(error)
        logger.error(`PR check watch failed (ignored): ${message}`)
        summary.checksTimedOut += 1
        prCheckWatch?.attempts.push({
            pr: { number: pr.number, htmlUrl: pr.htmlUrl },
            // durationMs=0：异常可能发生在真实等待之后，per-run 预算会少计一次（方向偏「多等」）
            state: 'timeout',
            closed: false,
            commented: false,
            polls: 0,
            durationMs: 0,
            reason: `watch failed: ${message}`,
        })
    }
}
