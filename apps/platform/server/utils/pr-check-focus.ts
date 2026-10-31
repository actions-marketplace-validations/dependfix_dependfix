import type { UnifiedBuildSignal } from '#server/services/monitor/types'

/**
 * PR Check 告警关注集（仓库级白名单）。
 *
 * 业务口径（详见 [pr-build-deploy-signals.md §9](../../../../docs/design/governance/pr-build-deploy-signals.md)）：
 * - 未配置（null）= 现状：任一归一化信号失败即告警（「全量只报警不阻断」）。
 * - 已配置 = 只有命中关注集的信号参与聚合与告警判定；未命中的信号仍全量落库、仍可在 UI 展开查看。
 * - 匹配维度为 **provider / name / kind** 三个白名单：维度内取并集（OR），维度间取交集（AND），
 *   留空表示该维度不限；三维全空等价于未配置。
 * - 比较为大小写不敏感的**精确匹配**（不做通配 / 子串，避免「配置看起来生效但匹配面失控」）。
 * - **不引入 state 维度**：忽略 `pending` 会把未完成的信号变成假成功——关注集回答「哪些信号算数」，
 *   不回答「哪些状态算失败」（失败判据仍由 `build-signals.ts` 的聚合层固定）。
 * - 条目数 / 长度上限只在**写入闸门**（`server/schemas/repository.ts` 的 Zod 校验）强制；
 *   本模块的解析侧保持宽容（不因超限抛错），避免单条脏数据阻塞轮询或列表渲染。
 * - 数组元素缺失字段 / 类型异常时按**非命中**处理（返回 `false`），不抛异常。
 *
 * 本模块只放纯函数（解析 / 规范化 / 匹配 / 过滤），供实体列解析、监控器聚合、API 视图与仓库表单共用；
 * 不读写数据库，也不发起 GitHub 请求。
 */

/** 关注集可筛选的信号来源类型（与 `UnifiedBuildSignal.kind` 同值域） */
export const PR_CHECK_FOCUS_KINDS = ['check', 'status', 'deployment'] as const

/** 关注集来源类型 */
export type PRCheckFocusKind = (typeof PR_CHECK_FOCUS_KINDS)[number]

/** 关注集（三个维度均为数组；空数组 = 该维度不限） */
export interface PRCheckFocus {
    providers: string[]
    names: string[]
    kinds: PRCheckFocusKind[]
}

/** 单维度条目数上限（与 `repository.ts` 的 Zod 校验共用，避免写入与解析口径漂移） */
export const MAX_PR_CHECK_FOCUS_ENTRIES = 20

/** provider 单条长度上限（GitHub App slug / status context 前缀） */
export const MAX_PR_CHECK_FOCUS_PROVIDER_LENGTH = 100

/** check 名 / commit status context / deployment environment 单条长度上限 */
export const MAX_PR_CHECK_FOCUS_NAME_LENGTH = 200

const isFocusKind = (value: string): value is PRCheckFocusKind =>
    (PR_CHECK_FOCUS_KINDS as readonly string[]).includes(value)

/**
 * 字符串数组规范化：丢弃非字符串 / 空串，trim（可按需转小写），按大小写不敏感键去重且保留首次出现的写法。
 * 非数组输入返回空数组（与实体层 `parseTags` / `parseSandboxLimits` 的容错口径一致，不抛错）。
 */
const toUniqueStrings = (value: unknown, normalize: (item: string) => string): string[] => {
    if (!Array.isArray(value)) {
        return []
    }
    const seen = new Set<string>()
    const result: string[] = []
    for (const item of value) {
        if (typeof item !== 'string') {
            continue
        }
        const normalized = normalize(item)
        if (!normalized) {
            continue
        }
        const key = normalized.toLowerCase()
        if (seen.has(key)) {
            continue
        }
        seen.add(key)
        result.push(normalized)
    }
    return result
}

/**
 * 规范化关注集输入：三个维度分别 trim / 去重，provider 与 kind 转小写（GitHub 侧取值恒小写），
 * name 保留原始写法（GitHub check 名区分展示形态，匹配时再按大小写不敏感比较）。
 *
 * @returns 规范化结果；输入非法（非对象）或三维全空时返回 `null`（= 未配置）。
 */
export const normalizePRCheckFocus = (input: unknown): PRCheckFocus | null => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return null
    }
    const raw = input as Record<string, unknown>
    const providers = toUniqueStrings(raw.providers, (item) => item.trim().toLowerCase())
    const names = toUniqueStrings(raw.names, (item) => item.trim())
    const kinds = toUniqueStrings(raw.kinds, (item) => item.trim().toLowerCase()).filter(isFocusKind)
    if (providers.length === 0 && names.length === 0 && kinds.length === 0) {
        return null
    }
    return { providers, names, kinds }
}

/**
 * 解析实体 `Repository.prCheckFocus` 的 JSON 字符串列。
 * 非法 JSON / 非对象 / 三维全空 / 缺失均回退 `null`（容错不抛错，避免单条脏数据阻塞轮询或列表渲染）。
 */
export const parsePRCheckFocus = (raw: string | null | undefined): PRCheckFocus | null => {
    if (!raw) {
        return null
    }
    try {
        return normalizePRCheckFocus(JSON.parse(raw))
    } catch {
        return null
    }
}

/**
 * 匹配所需的最小信号形态（`observedAt` / `rawState` 等不影响匹配）。
 *
 * 字段为可选：本模块按「容错不抛错」家族口径处理脏数据——元素缺失 / 类型异常时按**非命中**
 * 处理（返回 `false`），不抛异常（避免单条脏行阻塞 `/api/pr-checks` 列表渲染）。
 */
export type PRCheckFocusSignal = Partial<Pick<UnifiedBuildSignal, 'kind' | 'provider' | 'name'>>

/** 字段按大小写不敏感比较读取；非字符串（含缺失 / null）一律视为空串 */
const readFocusField = (value: unknown): string =>
    typeof value === 'string' ? value.trim().toLowerCase() : ''

/**
 * 判定单个信号是否命中关注集。
 *
 * 语义：三个维度均非空时须同时命中（AND）；单个维度内任一取值命中即可（OR）；某维度为空表示不限制。
 * 比较统一按大小写不敏感精确匹配（`provider` / `kind` 已由规范化转小写，`name` 在比较时再转）。
 * 信号为 `null` / `undefined` / 字段缺失时返回 `false`（非命中，不抛错）。
 */
export const matchesPRCheckFocus = (
    signal: PRCheckFocusSignal | null | undefined,
    focus: PRCheckFocus,
): boolean => {
    if (!signal) {
        return false
    }
    const provider = readFocusField(signal.provider)
    const name = readFocusField(signal.name)
    const kind = typeof signal.kind === 'string' ? signal.kind : ''
    if (focus.providers.length > 0 && !focus.providers.includes(provider)) {
        return false
    }
    if (focus.names.length > 0 && !focus.names.some((entry) => entry.toLowerCase() === name)) {
        return false
    }
    if (focus.kinds.length > 0 && !focus.kinds.some((entry) => entry === kind)) {
        return false
    }
    return true
}

/**
 * 按关注集过滤信号：未配置（`null`）时返回原数组副本（调用方语义不变）。
 * 已配置时只保留命中项——调用方须同时保留原始信号用于落库 / 展示（审计面）。
 */
export const filterSignalsByFocus = <T extends PRCheckFocusSignal>(
    signals: readonly T[],
    focus: PRCheckFocus | null,
): T[] => focus ? signals.filter((signal) => matchesPRCheckFocus(signal, focus)) : [...signals]
