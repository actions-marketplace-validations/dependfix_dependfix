// repeated-failure.ts — 同告警尝试上限的跳过判定（fix-and-pr 专用，升级链之前生效）。
//
// 判定时点：告警分区完成（成员 / 根 manifest 已区分）后、任何写盘与安装之前——
// 命中即跳过，不白跑一次完整安装与验证链。
//
// 计数口径（设计稿 §6.3）：
// - 尝试键 = source / packageName / targetVersion / planStrategy（见 ../github/fix-fingerprint.ts）
// - 同键已关闭（未合并）PR 数 ≥ 2（即本次为第 3 次尝试）→ 跳过
// - `--retry-failed` → 忽略命中并强制再试，记录标注「人工强制」
// - 跳过不增 `alertsFailed`：落 `FixAction.noOp` + `alertsSkippedByReason['repeated-failure']`，
//   维持 `sum(alertsSkippedByReason) === alertsSkipped` 不变式
import type { Octokit } from '@octokit/rest'
import {
    addSkipped,
    type FixAction,
    type Logger,
    type NormalizedSecurityAlert,
    type RepeatedAttemptRecord,
    type RepeatedAttemptStatus,
    type RunSummary,
} from '@dependfix/core'
import { resolveFamily } from '../fixers/dependency/families'
import type { ClosedAttemptIndex } from '../github/attempt-history'
import { computeAttemptKey, type PlanStrategy } from '../github/fix-fingerprint'
import type { MemberManifestAlert } from '../helpers'

/** 同键允许的已关闭尝试次数：第 1 / 2 次执行，第 3 次起跳过。 */
export const REPEATED_FAILURE_ATTEMPT_LIMIT = 2

/** 跳过判定只依赖的配置面（避免把 RuntimeConfig 整体带入）。 */
export interface RepeatedFailureConfig {
    mode: string
    retryFailed?: boolean
}

/** 跳过判定写入的上下文面（AppContext 的结构兼容子集）。 */
export interface RepeatedFailureContext {
    config: RepeatedFailureConfig
    logger: Logger
    summary: Pick<RunSummary, 'alertsSkipped' | 'alertsSkippedByReason'>
    allActions: FixAction[]
    /** run 级尝试记录（缺省时不记录，仅保留跳过动作与计数） */
    attemptTracking?: RepeatedAttemptRecord[]
}

export interface RepeatedFailureOptions {
    ctx: RepeatedFailureContext
    /** 已关闭 PR 尝试索引（运行级缓存）；缺省 = 不启用判定 */
    index?: ClosedAttemptIndex
    client?: Octokit | null
    /** 仓库（`owner/repo`） */
    repo: string
    /** PR 落点仓库：只有它承载的 PR 才产生可读回的尝试标记 */
    attemptRepo?: string
    rootAlerts: NormalizedSecurityAlert[]
    memberAlerts: MemberManifestAlert[]
}

export interface RepeatedFailurePartition {
    rootAlerts: NormalizedSecurityAlert[]
    memberAlerts: MemberManifestAlert[]
}

/**
 * 解析告警的**计划**策略（尝试键的策略维度）。
 *
 * 这是计划标签而非执行结果标签：同一告警在两次运行中的计划路径一致即视为「同一策略」，
 * 目标版本或路径变化（如从直接升级转为成员升级）会改变键并让历史计数自然失效。
 *
 * 判定顺序与修复链路的优先级对齐：成员 manifest（成员链）→ 间接依赖（overrides）→
 * 家族成员（家族锁步）→ 直接升级。
 */
export function resolvePlanStrategy(
    alert: Pick<NormalizedSecurityAlert, 'packageName' | 'dependencyType'>,
    options: { memberManifest?: boolean } = {},
): PlanStrategy {
    if (options.memberManifest) {
        return 'member-upgrade'
    }
    if (alert.dependencyType === 'transitive') {
        return 'override'
    }
    if (resolveFamily(alert.packageName)) {
        return 'family-lockstep'
    }
    return 'direct-upgrade'
}

/** 本次运行是否启用同告警尝试判定（fix-and-pr + 索引 + 客户端 + PR 落点仓库）。 */
export function isRepeatedFailureTrackingEnabled(options: RepeatedFailureOptions): boolean {
    return options.ctx.config.mode === 'fix-and-pr'
        && !!options.index
        && !!options.client
        && !!options.attemptRepo
        && options.repo === options.attemptRepo
}

/**
 * 按尝试上限过滤告警分区。
 *
 * @returns 过滤后的根 / 成员分区（跳过项已记入 summary 与 allActions）
 */
export async function applyRepeatedFailureSkips(
    options: RepeatedFailureOptions,
): Promise<RepeatedFailurePartition> {
    const { ctx, index, client, repo, rootAlerts, memberAlerts } = options
    const passThrough: RepeatedFailurePartition = { rootAlerts, memberAlerts }
    if (!isRepeatedFailureTrackingEnabled(options) || !index || !client) {
        return passThrough
    }

    const [owner, name] = repo.split('/')
    const skippedIds = new Set<number>()

    const candidates: Array<{ alert: NormalizedSecurityAlert, memberManifest: boolean }> = [
        ...rootAlerts.map((alert) => ({ alert, memberManifest: false })),
        ...memberAlerts.map(({ alert }) => ({ alert, memberManifest: true })),
    ]

    for (const { alert, memberManifest } of candidates) {
        // 只有依赖告警进入尝试计数：Code Scanning / Code Quality 走模板建议链路，
        // 没有「包 + 目标版本」语义，计入同键会互相覆盖
        if (alert.source !== 'dependabot' && alert.source !== 'pnpm-audit') {
            continue
        }
        // 不可修复 / 无推荐版本的告警不进入修复链路，也就没有「尝试」可计
        if (!alert.fixable || !alert.recommendedVersion) {
            continue
        }
        const key = computeAttemptKey({
            source: alert.source,
            packageName: alert.packageName,
            targetVersion: alert.recommendedVersion,
            planStrategy: resolvePlanStrategy(alert, { memberManifest }),
        })
        const attempt = await index.closedAttemptCount(client, owner, name, key) + 1
        const exhausted = attempt > REPEATED_FAILURE_ATTEMPT_LIMIT
        const forced = exhausted && ctx.config.retryFailed === true

        if (exhausted && !forced) {
            skippedIds.add(alert.id)
            ctx.allActions.push(createSkippedAction(alert))
            addSkipped(ctx.summary, 'repeated-failure')
            ctx.logger.warn(
                `[repeated-failure] ${alert.repository}: ${alert.packageName} → ${alert.recommendedVersion} `
                + `already failed ${attempt - 1} time(s) (attempt ${attempt}/${REPEATED_FAILURE_ATTEMPT_LIMIT}) — skipped; `
                + 'use --retry-failed to force another attempt',
            )
        } else if (forced) {
            ctx.logger.warn(
                `[repeated-failure] ${alert.repository}: ${alert.packageName} → ${alert.recommendedVersion} `
                + `attempt ${attempt}/${REPEATED_FAILURE_ATTEMPT_LIMIT} exceeded — forced retry (--retry-failed)`,
            )
        }

        ctx.attemptTracking?.push({
            repository: alert.repository,
            packageName: alert.packageName,
            key,
            attempt,
            status: resolveAttemptStatus({ exhausted, forced }),
        })
    }

    if (skippedIds.size === 0) {
        return passThrough
    }
    return {
        rootAlerts: rootAlerts.filter((alert) => !skippedIds.has(alert.id)),
        memberAlerts: memberAlerts.filter(({ alert }) => !skippedIds.has(alert.id)),
    }
}

/**
 * 尝试记录状态：达到上限但人工强制 → `forced`；达到上限 → `skipped`；否则正常 `attempt`。
 */
function resolveAttemptStatus(flags: { exhausted: boolean, forced: boolean }): RepeatedAttemptStatus {
    if (!flags.exhausted) {
        return 'attempt'
    }
    return flags.forced ? 'forced' : 'skipped'
}

/**
 * 跳过动作：`noOp` 使 fixed / failed 计数与交付判定都不受影响，
 * 由 `strategy` 与 `addSkipped` 提供可审计的跳过依据。
 */
function createSkippedAction(alert: NormalizedSecurityAlert): FixAction {
    return {
        type: 'dependency-upgrade',
        repository: alert.repository,
        target: alert.packageName,
        toVersion: alert.recommendedVersion,
        isMajor: false,
        strategy: 'repeated-failure',
        success: true,
        noOp: true,
        durationMs: 0,
    }
}
