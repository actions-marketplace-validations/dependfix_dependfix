// check-attribution.ts — CI check 失败的归因分类（纯函数，单一事实源）。
//
// 用途：CLI / Action 的 PR check 回环（评论 / 关闭）与平台 PR Check 视图共用同一分类，
// 避免两端各写一套标签。归因只驱动呈现与关闭决策，**不豁免** mergify 的 `check-success` 门禁
// （见 docs/design/governance/pr-delivery-closure.md §9）。
//
// 判定口径（顺序即优先级）：
// 1. `cancelled` / `skipped` / `stale` → `cancelled`（记录，不评论）
// 2. Dependabot / updater 作业且文本为 `security_update_not_possible` / advisory withdrawn
//    → `external_noise`
// 3. 镜像 / registry 推送作业且错误签名为 `unknown manifest class` / `manifest unknown`
//    → `external_noise`
// 4. 父提交同名作业已红 → `pre_existing`
// 5. **硬失败**（`failure`）且父提交同名作业为绿 → `self_caused`
//    （`timed_out` / `action_required` 多为基础设施抖动，父提交绿也不归本次改动——只评论不关闭）
// 6. 其余 → `unknown`（含父提交没有该作业 / 父提交未完成）
//
// 失败判定是 **fail-closed**：`unknown` 结论（GitHub 新增 / 未识别的 conclusion）与
// `startup_failure` 都算「失败但未判定」，绝不把未知当作成功或跳过——否则 workflow 无法启动
// （`startup_failure`）这类红 PR 会静默挂在「通过 / 已取消」里。
//
// 未知一律 `unknown`：默认 `self_caused` 会导致误关 PR，默认 `external_noise` 会洗白真实回归。

/** check 失败的归因分类。 */
export type CheckAttribution = 'self_caused' | 'pre_existing' | 'external_noise' | 'cancelled' | 'unknown'

/**
 * 归一化后的 check 结论。
 *
 * - check run：`success` / `failure` / `neutral` / `cancelled` / `skipped` / `timed_out` /
 *   `action_required` / `startup_failure` / `stale`；`status !== 'completed'` → `pending`
 * - commit status：`success` / `failure` / `error`（归一为 `failure`）/ `pending`
 */
export type CheckConclusion =
    | 'success'
    | 'failure'
    | 'neutral'
    | 'cancelled'
    | 'skipped'
    | 'stale'
    | 'timed_out'
    | 'action_required'
    | 'startup_failure'
    | 'pending'
    | 'unknown'

/** 父提交同名作业的结论；`absent` = 父提交没有该作业（无法比对）。 */
export type ParentCheckConclusion = CheckConclusion | 'absent'

export interface CheckAttributionInput {
    /** 作业 / check / status context 名 */
    name: string
    /** 本次运行观测到的归一化结论 */
    conclusion: CheckConclusion
    /** 失败详情文本（check output title/summary/text 或 status description，可空） */
    detail?: string
    /** 父提交（base 分支头）同名作业的结论；缺省 = 未采集，按 `absent` 处理 */
    parentConclusion?: ParentCheckConclusion
}

/**
 * 视为失败的结论集合。
 *
 * `timed_out` / `action_required` 与平台聚合口径一致；`startup_failure`（workflow 无法启动）
 * 与 `unknown`（GitHub 新增 / 未识别结论）按 **fail-closed** 计入失败——未知不得静默记为通过。
 */
const FAILED_CONCLUSIONS: ReadonlySet<CheckConclusion> = new Set([
    'failure',
    'timed_out',
    'action_required',
    'startup_failure',
    'unknown',
])

/** 视为「未产生失败结论」的终止类结论（全部由此类组成时不判 passed，记 cancelled）。 */
const CANCELLED_CONCLUSIONS: ReadonlySet<CheckConclusion> = new Set(['cancelled', 'skipped', 'stale'])

/** Dependabot / updater 作业名。 */
const DEPENDABOT_JOB_NAME = /dependabot|updater/i

/** Dependabot 侧「已无可升级版本 / 公告被撤回」一类非失败错误文本。 */
const DEPENDABOT_DETAIL = /security_update_not_possible|advisory[^\n]{0,40}withdrawn|withdrawn[^\n]{0,40}advisory/i

/** 镜像 / registry 推送类作业名（Docker / ACR / GHCR / ECR / manifest）。 */
const REGISTRY_JOB_NAME = /docker|registry|manifest|image|acr|ghcr|ecr/i

/** registry 侧鉴权 / 仓库不存在一类错误签名。 */
const REGISTRY_DETAIL = /unknown manifest class|manifest unknown/i

/** 结论是否为失败（`failure` / `timed_out` / `action_required`）。 */
export function isFailedConclusion(conclusion: CheckConclusion): boolean {
    return FAILED_CONCLUSIONS.has(conclusion)
}

/** 结论是否为「取消 / 跳过」（不评论，不判 passed）。 */
export function isCancelledConclusion(conclusion: CheckConclusion): boolean {
    return CANCELLED_CONCLUSIONS.has(conclusion)
}

/**
 * 归类单条失败 check。
 *
 * 只应对**已失败**的 check 调用（`cancelled` 一类除外——它们也参与分类，用于「不评论」判定）。
 */
export function classifyCheckFailure(input: CheckAttributionInput): CheckAttribution {
    const { name, conclusion, detail } = input
    if (CANCELLED_CONCLUSIONS.has(conclusion)) {
        return 'cancelled'
    }
    const text = detail ?? ''
    if (DEPENDABOT_JOB_NAME.test(name) && DEPENDABOT_DETAIL.test(text)) {
        return 'external_noise'
    }
    if (REGISTRY_JOB_NAME.test(name) && REGISTRY_DETAIL.test(text)) {
        return 'external_noise'
    }
    const parent = input.parentConclusion ?? 'absent'
    if (parent !== 'absent' && isFailedConclusion(parent)) {
        return 'pre_existing'
    }
    if (parent === 'success' && conclusion === 'failure') {
        return 'self_caused'
    }
    return 'unknown'
}

/**
 * 聚合一个 PR 内全部失败 check 的归因。
 *
 * - 无失败 → `undefined`
 * - 全部同归因 → 该归因
 * - 混合 → `unknown`（关闭要求一致归因，混合一律按未判定处理）
 */
export function aggregateCheckAttribution(
    attributions: readonly CheckAttribution[],
): CheckAttribution | undefined {
    if (attributions.length === 0) {
        return undefined
    }
    const unique = new Set(attributions)
    if (unique.size === 1) {
        return [...unique][0]
    }
    return 'unknown'
}
