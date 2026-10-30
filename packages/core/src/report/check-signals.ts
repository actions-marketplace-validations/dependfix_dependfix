// check-signals.ts：PR check 信号的跨端单一事实源（同名多轮收敛 + provider 归因）。
//
// 平台（apps/platform 监控器）与 CLI（packages/engine 回环）对同一 ref 的信号必须给出
// **同一结论**，因此「同名多轮取最新一轮」的排序算法与组键所用的 provider 归因都收敛到本模块，
// 避免两侧各写一份后漂移（口径见 docs/design/governance/pr-build-deploy-signals.md §3.10）。

/**
 * check run 的 provider 归因：`app.slug` 小写化；缺失 / 空白回退 `unknown`。
 *
 * 组键的一部分：同名 job 由不同 GitHub App 上报时不得合并（如两个 app 都叫 `Test`）。
 */
export function resolveCheckProvider(slug: string | null | undefined): string {
    const value = slug?.trim().toLowerCase()
    return value && value.length > 0 ? value : 'unknown'
}

/**
 * commit status 的 provider 归因：取 `context` 前缀（如 `Vercel – web` → `vercel`；
 * `ci/circleci: build` → `ci`）。
 *
 * 分隔符取 `/`、`–`（en dash）、`:`、空格中最先出现者——**不含 `-`**：连字符是 context
 * 标识符的常见组成（如 `continuous-integration/travis-ci/push` 应归 `continuous-integration`）。
 * 前缀为空时回退 `unknown`。
 */
export function resolveStatusProvider(context: string | null | undefined): string {
    const raw = context?.trim()
    if (!raw) {
        return 'unknown'
    }
    const match = /^[^/–:\s]+/u.exec(raw)
    const prefix = match?.[0]?.trim().toLowerCase()
    return prefix && prefix.length > 0 ? prefix : 'unknown'
}

/**
 * 从 check run 的详情链接提取 GitHub Actions workflow run id
 * （`https://github.com/{owner}/{repo}/actions/runs/{runId}/job/{jobId}`）。
 *
 * **用途**：GitHub 的「重跑（re-run）」会为同一 workflow run 产出同名新 check run（run id 不变、
 * job id 变化），而「push 触发」与「pull_request 触发」是**两个不同的 workflow run**——即便 job 名
 * 相同也不能合并（否则后启动的那个会掩蔽另一个的失败）。因此该 id 是「同名是否属于同一条血缘」
 * 的判据：取不到时**不收敛**（保留全部，维持「任一失败即失败」）。
 *
 * 非 Actions 的 check（Cloudflare 等）没有该链接 → 返回 `null`。
 */
export function extractActionsRunId(url: string | null | undefined): string | null {
    const match = url ? /\/actions\/runs\/(\d+)/u.exec(url) : null
    return match?.[1] ?? null
}

/** 参与「同名多轮」判定的组键输入（两端结构兼容子集）。 */
export interface CheckRoundIdentity {
    kind: 'check' | 'status' | 'deployment'
    provider: string
    name: string
    /** 详情链接（check 用它提取 Actions run id） */
    url?: string | null
    /** 源侧 id（取不到 run id 时作为血缘边界） */
    sourceId?: string | number | null
}

/**
 * 构造「同名多轮」组键（两端共用，避免键算法漂移）。
 *
 * - `check`：`(app, name)` + **workflow run id**——只有能证明「同一条 workflow run 的重跑」才收敛；
 *   取不到 run id 时以 `sourceId` 作边界（每个 check run 自成一组，宁可不合并也不掩蔽失败）。
 * - `status`：`(provider, context)`——同一 context 是状态机（pending → success/failure），取最新即正确。
 * - `deployment`：`(provider, environment)`——同一环境的当前状态由最新部署决定。
 */
export function checkRoundKey(identity: CheckRoundIdentity, unmargeableFallback?: string): string {
    const base = `${identity.kind}\u0000${identity.provider}\u0000${identity.name}`
    if (identity.kind !== 'check') {
        return base
    }
    const lineage = extractActionsRunId(identity.url) ?? (identity.sourceId === null || identity.sourceId === undefined
        ? undefined
        : String(identity.sourceId))
    if (lineage !== undefined) {
        return `${base}\u0000${lineage}`
    }
    // 拿不到任何血缘标识时不得合并（调用方传入唯一兜底，见 dedupeByLatestRound 的索引）
    return `${base}\u0000?${unmargeableFallback ?? ''}`
}

/** 参与「同名多轮」判定的最小信号形态（两端结构兼容子集）。 */
export interface CheckRoundLike {
    /** 轮次时间戳（ISO 8601；缺失 = 不可比） */
    roundAt?: string | null
    /** 源侧 id（CLI `ObservedCheck` / 平台 `UnifiedBuildSignal.sourceId` 二选一） */
    id?: string | number | null
    /** 源侧 id 的平台字段名（与 `id` 等价，便于直接传信号对象） */
    sourceId?: string | number | null
}

const parseRoundAt = (value: string | null | undefined): number => {
    const parsed = value ? Date.parse(value) : Number.NaN
    return Number.isFinite(parsed) ? parsed : Number.NaN
}

const idOf = (item: CheckRoundLike): string | number | null | undefined => item.id ?? item.sourceId

const parseNumericId = (value: string | number | null | undefined): number => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : Number.NaN
    }
    return value && /^\d+$/u.test(value) ? Number(value) : Number.NaN
}

/**
 * 判断 `candidate` 是否严格新于 `current`。
 *
 * 规则（针对「新一轮还没 `started_at`」的真实形态）：
 * 1. 两侧 `roundAt` 都可比 → 比时间（相等时再比数值 id）
 * 2. 任一侧时间不可比 → 比数值 id（GitHub 三源 id 单调递增；同源比较安全，组键已含 kind/provider）
 * 3. 两者都不可比 → 不判定为更新（保留先出现者，避免引入新的不确定性）
 */
const isNewerRound = (candidate: CheckRoundLike, current: CheckRoundLike): boolean => {
    const candidateAt = parseRoundAt(candidate.roundAt)
    const currentAt = parseRoundAt(current.roundAt)
    if (!Number.isNaN(candidateAt) && !Number.isNaN(currentAt)) {
        if (candidateAt !== currentAt) {
            return candidateAt > currentAt
        }
    }
    const candidateId = parseNumericId(idOf(candidate))
    const currentId = parseNumericId(idOf(current))
    if (!Number.isNaN(candidateId) && !Number.isNaN(currentId)) {
        return candidateId > currentId
    }
    return false
}

/**
 * 同名多轮收敛：每个键只保留**最新一轮**。
 *
 * 组键由调用方提供（平台与 CLI 均用 {@link checkRoundKey}，保证两端不因键不同而漂移）；
 * 调用方还必须保证「不同 workflow run 的同名 check」落在不同键里（见 {@link extractActionsRunId}）。
 * `keyOf` 收到元素索引，供「拿不到血缘标识」时构造唯一兜底键（不合并）。
 * 返回顺序按各键**首次出现**的位置，便于上层保持稳定排序。
 *
 * @param items 待收敛的信号（同一 ref 的全量观测）
 * @param keyOf 组键（相同键视为同名多轮）
 */
export function dedupeByLatestRound<T extends CheckRoundLike>(
    items: readonly T[],
    keyOf: (item: T, index: number) => string,
): T[] {
    const latest = new Map<string, T>()
    for (const [index, item] of items.entries()) {
        const key = keyOf(item, index)
        const current = latest.get(key)
        if (current === undefined || isNewerRound(item, current)) {
            latest.set(key, item)
        }
    }
    return [...latest.values()]
}
