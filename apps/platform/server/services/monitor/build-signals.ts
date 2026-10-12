import type { OverallBuildStatus, UnifiedBuildSignal, UnifiedBuildSignalState } from './types'
import { PR_CHECK_CONCLUSIONS, type PRCheckConclusion } from '#server/entities/pr-check'

/**
 * 构建 / 部署信号归一化与聚合（三源统一模型）。
 *
 * 设计依据：[pr-build-deploy-signals.md §3.2 归一化模型 / §3.3 三源采集 / §3.4 聚合](../../../../docs/design/governance/pr-build-deploy-signals.md)。
 *
 * 三源与 GitHub 落点（provider 无关，零新增凭据）：
 * - `checks.listForRef` → check runs（GitHub Actions / Cloudflare Workers Builds 等）
 * - `repos.listCommitStatusesForRef`（分页；设计稿列 combined status，实现取分页版以保证「全部」语义，见设计稿 §3.7）→ commit statuses（Vercel 每 project 一个 context / 其它 CI）
 * - `repos.listDeployments` + `listDeploymentStatuses` → deployments（Vercel 等）
 *
 * 本模块只做**纯函数**转换（无 IO），便于单测；HTTP 采集在 `polling-source.ts`。
 *
 * 与设计稿 §3.2 的一处扩展：`UnifiedBuildSignal` 额外保留 `rawState`（原始 GitHub 取值）与
 * `sourceId`（源侧 id）——前者用于**保留既有 `conclusion` 粒度**（`timed_out` / `action_required`
 * 等不被粗化为 `failure`），后者供落库（`checkRunId`）与前端链接使用。
 */

/** 单条信号摘要限长（避免单行 JSON 膨胀；见 docs/design/governance/pr-build-deploy-signals.md §6 风险表） */
export const SIGNAL_SUMMARY_MAX_LENGTH = 300

/**
 * 信号 URL 字段限长（`targetUrl` / `logUrl`）。
 *
 * 理由：`environment_url` / `target_url` 由部署方提供、长度不受控；`MAX_SIGNALS_PER_PR` 只限条数，
 * 不限单条体积。上限取 500——与实体 `PRCheck.detailsUrl`（varchar(500)）同口径。
 */
export const SIGNAL_URL_MAX_LENGTH = 500

/** 单 PR 信号条数上限（超出按严重度保留；避免异常仓库产生超大 JSON） */
export const MAX_SIGNALS_PER_PR = 50

/**
 * check run conclusion → 归一化状态。
 * GitHub checks conclusion enum：`success | failure | neutral | cancelled | skipped | timed_out | action_required | stale | null`。
 * `timed_out` / `action_required` 归 `failure`（设计稿 §3.3：任一 `failure | error | timed_out | action_required` → 聚合 failed）。
 */
const CHECK_CONCLUSION_STATE: Readonly<Record<string, UnifiedBuildSignalState>> = {
    success: 'success',
    failure: 'failure',
    neutral: 'neutral',
    cancelled: 'skipped',
    skipped: 'skipped',
    timed_out: 'failure',
    action_required: 'failure',
    stale: 'skipped',
}

/** commit status state → 归一化状态（`repos.listCommitStatusesForRef` 的 [].state） */
const COMMIT_STATUS_STATE: Readonly<Record<string, UnifiedBuildSignalState>> = {
    success: 'success',
    failure: 'failure',
    error: 'error',
    pending: 'pending',
}

/** deployment status state → 归一化状态（`repos.listDeploymentStatuses` 的 state） */
const DEPLOYMENT_STATE: Readonly<Record<string, UnifiedBuildSignalState>> = {
    success: 'success',
    failure: 'failure',
    error: 'error',
    pending: 'pending',
    queued: 'pending',
    in_progress: 'pending',
    inactive: 'skipped',
}

/** 触发「聚合 failed」的信号状态集合（设计稿 §3.3） */
const FAILING_SIGNAL_STATES: readonly UnifiedBuildSignalState[] = ['failure', 'error']

/** 未完成信号状态 */
const PENDING_SIGNAL_STATE: UnifiedBuildSignalState = 'pending'

/** 轮询窗口：仅处理 `updated_at` 在窗口内的 open PR（避免为陈旧 PR 反复打 3+ API；设计稿 §3.5 节流） */
export const PR_UPDATED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

const truncate = (text: string | null | undefined, max: number): string | null => {
    if (!text) {
        return null
    }
    return text.length > max ? `${text.slice(0, max)}...` : text
}

/**
 * provider 归因：check run 取 `app.slug`（如 `github-actions` / Cloudflare 的 check 名）。
 * 无 app（如 fork / 第三方未注册 app）时回退 `unknown`——不臆造 provider（设计稿非目标）。
 */
export const resolveCheckProvider = (appSlug: string | null | undefined): string => {
    const slug = appSlug?.trim().toLowerCase()
    return slug && slug.length > 0 ? slug : 'unknown'
}

/**
 * provider 归因：commit status 取 `context` 前缀（如 `Vercel – web` → `vercel`；`ci/circleci: build` → `ci`）。
 * 分隔符取 `/`、`–`（en dash）、`:`、空格中最先出现者——**不含 `-`**：连字符是 context 标识符的常见组成
 * （如 `continuous-integration/travis-ci/push` 应归 `continuous-integration`）。
 * 前缀为空时回退 `unknown`。
 */
export const resolveStatusProvider = (context: string | null | undefined): string => {
    const raw = context?.trim()
    if (!raw) {
        return 'unknown'
    }
    const match = /^[^/–:\s]+/u.exec(raw)
    const prefix = match?.[0]?.trim().toLowerCase()
    return prefix && prefix.length > 0 ? prefix : 'unknown'
}

/**
 * provider 归因：deployment 取创建者 login，并**归一化机器人形态**——去掉 GitHub App 的
 * `<installation-id>+` 前缀与 `[bot]` 后缀（`vercel[bot]` / `12345+vercel[bot]` → `vercel`）。
 *
 * 归一化理由：同一 provider 在 commit status 侧归因为 `context` 前缀（如 `vercel`），若 deployment
 * 侧保留 `vercel[bot]` / `12345+vercel[bot]`，则按 provider 归组（`failureSources` / 展示）时同一
 * provider 会分裂成多项。缺失时回退 `unknown`。
 */
export const resolveDeploymentProvider = (creatorLogin: string | null | undefined): string => {
    const login = creatorLogin?.trim().toLowerCase()
        .replace(/^\d+\+/u, '')
        .replace(/\[bot\]$/u, '')
    return login && login.length > 0 ? login : 'unknown'
}

/** check run → 归一化信号（status !== 'completed' → `pending`） */
export const normalizeCheckRun = (
    checkRun: {
        id?: number | null
        name?: string | null
        status?: string | null
        conclusion?: string | null
        details_url?: string | null
        html_url?: string | null
        output?: { text?: string | null } | null
        app?: { slug?: string | null } | null
    },
    observedAt: Date,
): UnifiedBuildSignal => {
    const rawConclusion = checkRun.status === 'completed' ? (checkRun.conclusion ?? null) : null
    const state = checkRun.status !== 'completed'
        ? PENDING_SIGNAL_STATE
        : (CHECK_CONCLUSION_STATE[rawConclusion ?? ''] ?? 'skipped')
    return {
        kind: 'check',
        provider: resolveCheckProvider(checkRun.app?.slug),
        name: checkRun.name?.trim() || 'check',
        state,
        rawState: rawConclusion,
        sourceId: checkRun.id !== undefined && checkRun.id !== null ? String(checkRun.id) : null,
        targetUrl: truncate(checkRun.details_url ?? checkRun.html_url, SIGNAL_URL_MAX_LENGTH),
        logUrl: null,
        summary: truncate(checkRun.output?.text, SIGNAL_SUMMARY_MAX_LENGTH),
        observedAt,
    }
}

/** commit status → 归一化信号 */
export const normalizeCommitStatus = (
    status: {
        id?: number | null
        context?: string | null
        state?: string | null
        description?: string | null
        target_url?: string | null
    },
    observedAt: Date,
): UnifiedBuildSignal => {
    const rawState = status.state?.trim().toLowerCase() ?? null
    return {
        kind: 'status',
        provider: resolveStatusProvider(status.context),
        name: status.context?.trim() || 'status',
        state: COMMIT_STATUS_STATE[rawState ?? ''] ?? 'skipped',
        rawState,
        sourceId: status.id !== undefined && status.id !== null ? String(status.id) : null,
        targetUrl: truncate(status.target_url, SIGNAL_URL_MAX_LENGTH),
        logUrl: null,
        summary: truncate(status.description, SIGNAL_SUMMARY_MAX_LENGTH),
        observedAt,
    }
}

/**
 * deployment + 其最新 status → 归一化信号。
 *
 * - 无 status（deployment 刚创建）→ `pending`
 * - `name` 取 environment（如 `Production` / `Preview`）；`targetUrl` 取 status 的
 *   `environment_url`（无则 `target_url`）；`logUrl` 取 status 的 `log_url`（部署日志富化的落点）
 */
export const normalizeDeployment = (
    deployment: {
        id?: number | null
        environment?: string | null
        creator?: { login?: string | null } | null
        ref?: string | null
    },
    latestStatus: {
        state?: string | null
        description?: string | null
        environment_url?: string | null
        target_url?: string | null
        log_url?: string | null
    } | null,
    observedAt: Date,
): UnifiedBuildSignal => {
    const rawState = latestStatus?.state?.trim().toLowerCase() ?? null
    return {
        kind: 'deployment',
        provider: resolveDeploymentProvider(deployment.creator?.login),
        name: deployment.environment?.trim() || deployment.ref?.trim() || 'deployment',
        state: rawState ? (DEPLOYMENT_STATE[rawState] ?? 'skipped') : PENDING_SIGNAL_STATE,
        rawState,
        sourceId: deployment.id !== undefined && deployment.id !== null ? String(deployment.id) : null,
        targetUrl: truncate(latestStatus?.environment_url ?? latestStatus?.target_url, SIGNAL_URL_MAX_LENGTH),
        logUrl: truncate(latestStatus?.log_url, SIGNAL_URL_MAX_LENGTH),
        summary: truncate(latestStatus?.description, SIGNAL_SUMMARY_MAX_LENGTH),
        observedAt,
    }
}

/**
 * 聚合判定（设计稿 §3.3）：
 * - 任一 `failure` / `error` → `failed`
 * - 否则任一 `pending` → `pending`
 * - 否则 `success`（全 `neutral` / `skipped` 亦视为无失败）
 */
export const aggregateOverallStatus = (signals: readonly UnifiedBuildSignal[]): OverallBuildStatus => {
    // 注意：空集返回 `success` 属**真空真**——调用方须先判空（采集层对无信号 PR 不产出快照，
    // 落库侧消费前同样需要判空，见设计稿 §3.7「空集真空真」）。
    if (signals.some((s) => FAILING_SIGNAL_STATES.includes(s.state))) {
        return 'failure'
    }
    if (signals.some((s) => s.state === PENDING_SIGNAL_STATE)) {
        return 'pending'
    }
    return 'success'
}

const isPRCheckConclusion = (value: string | null): value is PRCheckConclusion =>
    value !== null && (PR_CHECK_CONCLUSIONS as readonly string[]).includes(value)

/**
 * 派生 `conclusion`（PRCheck 既有枚举，保持向后兼容）：
 * - 存在失败信号 → 取失败 check 的**原始 conclusion**（保留 `timed_out` / `action_required` 粒度）；
 *   失败源为 commit status / deployment（原始值为 `failure` / `error`）时统一落 `failure`
 * - 否则存在 `pending` → `pending`
 * - 否则存在 `neutral` → `neutral`
 * - 否则全 `skipped` → `skipped`
 * - 否则 `success`
 */
export const deriveWorstConclusion = (signals: readonly UnifiedBuildSignal[]): PRCheckConclusion => {
    const failing = signals.filter((s) => FAILING_SIGNAL_STATES.includes(s.state))
    if (failing.length > 0) {
        const granular = failing.find((s) => s.kind === 'check' && isPRCheckConclusion(s.rawState))
        return granular && isPRCheckConclusion(granular.rawState) ? granular.rawState : 'failure'
    }
    if (signals.some((s) => s.state === PENDING_SIGNAL_STATE)) {
        return 'pending'
    }
    if (signals.some((s) => s.state === 'neutral')) {
        return 'neutral'
    }
    if (signals.length > 0 && signals.every((s) => s.state === 'skipped')) {
        return 'skipped'
    }
    return 'success'
}

/** 信号严重度排序（失败优先；用于上限截断时保留最关键信号） */
const signalSeverity = (signal: UnifiedBuildSignal): number => {
    if (FAILING_SIGNAL_STATES.includes(signal.state)) {
        return 0
    }
    if (signal.state === PENDING_SIGNAL_STATE) {
        return 1
    }
    if (signal.state === 'neutral') {
        return 2
    }
    if (signal.state === 'skipped') {
        return 3
    }
    return 4
}

/** 按严重度排序并截断到上限（保持稳定顺序：同严重度维持源侧顺序） */
export const capSignals = (
    signals: readonly UnifiedBuildSignal[],
    max = MAX_SIGNALS_PER_PR,
): UnifiedBuildSignal[] =>
    signals
        .map((signal, index) => ({ signal, index }))
        .sort((a, b) => signalSeverity(a.signal) - signalSeverity(b.signal) || a.index - b.index)
        .slice(0, max)
        .map((entry) => entry.signal)

/** 取失败 check 的 run id（回填既有 `PRCheck.checkRunId` 列；无失败 check 时取任一 check） */
export const pickCheckRunId = (signals: readonly UnifiedBuildSignal[]): string | null => {
    const checks = signals.filter((s) => s.kind === 'check')
    const failing = checks.find((s) => FAILING_SIGNAL_STATES.includes(s.state))
    return failing?.sourceId ?? checks[0]?.sourceId ?? null
}

/** 取失败信号的摘要（回填既有 `PRCheck.errorMessage` 列；优先失败信号，其次首条带摘要者） */
export const pickErrorSummary = (signals: readonly UnifiedBuildSignal[]): string | null => {
    const failing = signals.find((s) => FAILING_SIGNAL_STATES.includes(s.state) && s.summary)
    return failing?.summary ?? signals.find((s) => s.summary)?.summary ?? null
}

/**
 * 轮询节流（设计稿 §3.5）：`updated_at` 在窗口内才处理。
 * 缺失 / 非法时间戳按「需处理」fail-open（避免漏监测）。
 */
export const isWithinUpdatedWindow = (
    updatedAt: string | null | undefined,
    now: Date,
    windowMs: number = PR_UPDATED_WINDOW_MS,
): boolean => {
    if (!updatedAt) {
        return true
    }
    const time = new Date(updatedAt).getTime()
    if (!Number.isFinite(time)) {
        return true
    }
    return now.getTime() - time <= windowMs
}

/**
 * 终态判定：供监控器侧「终态且 HEAD 未变 → 跳过」节流使用。
 * 取值域为库内字符串（含 NULL，历史行）——仅 `success` / `failure` 视为终态，
 * `pending` / NULL / 未知值一律视为**非终态**（保守重采，避免漏掉状态推进）。
 */
export const isTerminalOverallStatus = (status: string | null | undefined): boolean =>
    status === 'success' || status === 'failure'

/**
 * 终态静默窗口：终态且 HEAD 未变的 PR 在该窗口内不再重复采集（三源 API 降频）。
 *
 * 窗口外**重新采集**：GitHub 允许在同一 SHA 上重跑 workflow / 迟到写入部署状态，
 * 永久跳过会漏掉「同一 SHA 上的重跑失败 / 迟到部署失败」——即本特性要捕获的核心场景。
 * 取值理由：兼顾降频（默认 5min/仓轮询下，终态 PR 由「每轮」降为「每 30min」）与检出时效。
 */
export const TERMINAL_REPOLL_QUIET_MS = 30 * 60 * 1000

/**
 * 判定某既有行是否应在本轮跳过采集：终态 + `lastPolledAt` 落在静默窗口内。
 * （HEAD 比对由调用方完成——跳过键为 `prNumber → headSha`，采集层按当前 HEAD 命中判定。）
 */
export const shouldSkipTerminalPr = (
    row: { overallStatus: string | null, lastPolledAt: Date } | null | undefined,
    now: Date,
    quietMs: number = TERMINAL_REPOLL_QUIET_MS,
): boolean => {
    if (!row) {
        return false
    }
    if (!isTerminalOverallStatus(row.overallStatus)) {
        return false
    }
    return now.getTime() - row.lastPolledAt.getTime() < quietMs
}

/** 失败源清单上限（去重后截断；供 UI / 筛选直接消费） */
export const MAX_FAILURE_SOURCES = 20

/** 失败源条目（`failureSourcesJson` 的元素形态） */
export interface BuildFailureSource {
    provider: string
    name: string
    kind: UnifiedBuildSignal['kind']
}

/**
 * 汇总失败源清单：仅取失败信号，按 `provider + name + kind` 去重（保持源侧顺序），截断到上限。
 */
export const summarizeFailureSources = (
    signals: readonly UnifiedBuildSignal[],
    max = MAX_FAILURE_SOURCES,
): BuildFailureSource[] => {
    const seen = new Set<string>()
    const sources: BuildFailureSource[] = []
    for (const signal of signals) {
        if (!FAILING_SIGNAL_STATES.includes(signal.state)) {
            continue
        }
        const key = `${signal.provider}\u0000${signal.name}\u0000${signal.kind}`
        if (seen.has(key)) {
            continue
        }
        seen.add(key)
        sources.push({ provider: signal.provider, name: signal.name, kind: signal.kind })
        if (sources.length >= max) {
            break
        }
    }
    return sources
}
