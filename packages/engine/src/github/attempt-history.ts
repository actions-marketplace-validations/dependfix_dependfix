// attempt-history.ts — 最近关闭 dependfix PR 的尝试索引（运行级缓存）。
//
// 读取面：`pulls.list(state: 'closed', sort: 'updated', per_page: N)` → 按分支前缀 +
// PR 正文尝试标记（见 ./fix-fingerprint.ts）索引「尝试键 → 关闭次数」。
//
// 口径与边界（设计稿 §6.2 / §6.4）：
// - 只统计**未合并**的已关闭 PR：合并意味着修复已落地，不该再消耗尝试额度；
// - 每仓库每轮只查询一次（运行级缓存；`maxAlertsPerRepository` 条告警共用一次 API 调用）；
// - 查询失败 / 超限 / 标记被人工改写 → 计数偏小（fail-open），最坏结果是多尝试一次；
// - 只覆盖最近 N 条（默认 50），更早关闭的 PR 漏计同样只是 fail-open。
import type { Octokit } from '@octokit/rest'
import { toErrorMessage, type Logger } from '@dependfix/core'
import { parseAttemptMarkers, type AttemptMarker } from './fix-fingerprint'
import { DEPENDFIX_BRANCH_PREFIX } from './pr-creator'

/** 默认查询条数（设计稿 §6.2：最近 50 条关闭 PR）。 */
export const CLOSED_ATTEMPT_QUERY_LIMIT = 50

/** 一条已关闭的 dependfix PR（仅保留尝试计数所需字段）。 */
export interface ClosedAttemptPR {
    number: number
    /** PR 链接（证据 / 后续报告展示用） */
    htmlUrl: string
    /** head 分支名（后续 PR 创建后 CI 回环按分支定位 PR 时使用） */
    headRef: string
    markers: AttemptMarker[]
}

export interface ClosedAttemptIndexOptions {
    /** 单仓库查询条数（默认 `CLOSED_ATTEMPT_QUERY_LIMIT`；仅用于测试与调优） */
    limit?: number
    /** 失败告警输出（缺省静默；由调用方决定是否可见） */
    logger?: Pick<Logger, 'warn'>
}

/**
 * 运行级「已关闭 PR 尝试索引」。
 *
 * 缓存按 `owner/repo` 存 **Promise**：同仓库并发告警共享同一次请求（也缓存失败结果，
 * 避免一次限流把后续每条告警都变成一次重试）。
 */
export class ClosedAttemptIndex {
    private readonly cache = new Map<string, Promise<ClosedAttemptPR[]>>()
    private readonly limit: number
    private readonly logger?: Pick<Logger, 'warn'>

    constructor(options: ClosedAttemptIndexOptions = {}) {
        this.limit = options.limit ?? CLOSED_ATTEMPT_QUERY_LIMIT
        this.logger = options.logger
    }

    /** 读取仓库最近关闭的 dependfix PR（运行级缓存；失败返回空数组）。 */
    closedPRs(octokit: Octokit, owner: string, repo: string): Promise<ClosedAttemptPR[]> {
        const cacheKey = `${owner}/${repo}`
        const cached = this.cache.get(cacheKey)
        if (cached) {
            return cached
        }
        const task = this.load(octokit, owner, repo)
        this.cache.set(cacheKey, task)
        return task
    }

    /** 同键已关闭（未合并）PR 数。 */
    async closedAttemptCount(
        octokit: Octokit,
        owner: string,
        repo: string,
        key: string,
    ): Promise<number> {
        const prs = await this.closedPRs(octokit, owner, repo)
        return prs.filter((pr) => pr.markers.some((marker) => marker.key === key)).length
    }

    private async load(octokit: Octokit, owner: string, repo: string): Promise<ClosedAttemptPR[]> {
        try {
            const { data } = await octokit.rest.pulls.list({
                owner,
                repo,
                state: 'closed',
                sort: 'updated',
                direction: 'desc',
                per_page: this.limit,
            })
            return data
                .filter((pr) => pr.head.ref.startsWith(DEPENDFIX_BRANCH_PREFIX) && pr.merged_at === null)
                .map((pr) => ({
                    number: pr.number,
                    htmlUrl: pr.html_url,
                    headRef: pr.head.ref,
                    markers: parseAttemptMarkers(pr.body),
                }))
        } catch (error: unknown) {
            // fail-open：读不到历史只影响「是否跳过」，不影响本次修复正确性
            this.logger?.warn(
                `[attempt] failed to list closed PRs for ${owner}/${repo}: ${toErrorMessage(error)} — attempt counting falls back to 0`,
            )
            return []
        }
    }
}
