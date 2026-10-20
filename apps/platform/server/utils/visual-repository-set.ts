/**
 * 视觉回归仓库集合校验（apps/platform/server/utils/visual-repository-set.ts）。
 *
 * 背景：`apps/platform/data/visual.sqlite` 是视觉回归专属库（gitignored）。本地多次运行、
 * 审计探针或手工操作会在库内累积非 fixtures 仓库，使 `/repos` 与「弹窗内首个 Select」等
 * 视口级基线的背景行数 / 表格几何变化，表现为与代码无关的像素失配。
 *
 * 本模块提供纯函数与客户端编排，供 `tests/visual/global-setup.ts` 在截图前校验
 * 「库内仓库集合 == VISUAL_FIXTURES.repos」，不一致时给出可操作提示而不是像素差异。
 *
 * 边界：
 * - 只比较 owner/name（视觉库为独立测试库，fixtures 均为默认 github 平台）。
 * - 清理只允许删除 `extra`（非白名单）集合；`expected`（fixtures）永不由本模块删除。
 * - 集合比较与排序均按 key 归一化，重复输入去重，保证错误信息稳定可复现。
 */

export interface RepositoryKey {
    owner: string
    name: string
}

export interface RepositorySetDiff {
    /** 库内存在、fixtures 未声明的仓库。 */
    extra: RepositoryKey[]
    /** fixtures 声明、库内缺失的仓库。 */
    missing: RepositoryKey[]
}

/** 仓库集合键（owner/name，大小写敏感，与 Repository 复合唯一索引口径一致）。 */
export const repositoryKey = (repo: RepositoryKey): string => `${repo.owner}/${repo.name}`

const normalize = (repos: readonly RepositoryKey[]): RepositoryKey[] => {
    const seen = new Set<string>()
    const result: RepositoryKey[] = []
    for (const repo of repos) {
        const key = repositoryKey(repo)
        if (seen.has(key)) {
            continue
        }
        seen.add(key)
        result.push({ owner: repo.owner, name: repo.name })
    }
    return result
}

const byKey = (a: RepositoryKey, b: RepositoryKey): number => {
    const left = repositoryKey(a)
    const right = repositoryKey(b)
    if (left === right) {
        return 0
    }
    return left < right ? -1 : 1
}

/** 计算「库内仓库集合」与「fixtures 允许集合」的差集（按 key 排序，去重）。 */
export function diffRepositorySet(
    actual: readonly RepositoryKey[],
    expected: readonly RepositoryKey[],
): RepositorySetDiff {
    const actualKeys = new Map(normalize(actual).map((repo) => [repositoryKey(repo), repo]))
    const expectedKeys = new Map(normalize(expected).map((repo) => [repositoryKey(repo), repo]))
    const extra = [...actualKeys.entries()]
        .filter(([key]) => !expectedKeys.has(key))
        .map(([, repo]) => repo)
        .sort(byKey)
    const missing = [...expectedKeys.entries()]
        .filter(([key]) => !actualKeys.has(key))
        .map(([, repo]) => repo)
        .sort(byKey)
    return { extra, missing }
}

/** 生成可直接展示给开发者的差异说明。 */
export function formatRepositorySetDiff(diff: RepositorySetDiff, expected: readonly RepositoryKey[]): string {
    const allowed = normalize(expected)
    const lines = [
        '视觉回归库的仓库集合与 fixtures 不一致（截图前校验失败，未进入像素比对）：',
        `- 多余（非 fixtures）: ${diff.extra.length > 0 ? diff.extra.map(repositoryKey).join(', ') : '无'}`,
        `- 缺失（fixtures 未注入）: ${diff.missing.length > 0 ? diff.missing.map(repositoryKey).join(', ') : '无'}`,
        `- 允许集合（VISUAL_FIXTURES.repos，共 ${allowed.length} 个）: ${allowed.map(repositoryKey).join(', ')}`,
        '处置：默认 global-setup 会按允许集合清理多余仓库；若已设置 VISUAL_FIXTURES_AUTO_CLEAN=0，',
        '请删除上述多余仓库后重跑，或移除该环境变量让 global-setup 自动清理。',
    ]
    return lines.join('\n')
}

/**
 * 允许集合防线：
 * - 空 allowlist 会让 `extra = 全库仓库`，清理通道退化为「清空视觉库」，而随后的注入 + 断言
 *   又会以 0 == 0 通过；视觉套件必须至少声明一个 fixtures 仓库。
 * - 条目缺 owner/name 同样会退化为「删除全部真实仓库 + 断言报缺失」，必须在删除前拒绝。
 */
function assertValidAllowlist(expected: readonly RepositoryKey[]): void {
    if (expected.length === 0) {
        throw new Error('[visual fixtures] allowlist is empty; refusing to clean or assert the visual repository set')
    }
    for (const repo of expected) {
        if (
            !repo
            || typeof repo.owner !== 'string'
            || typeof repo.name !== 'string'
            || repo.owner.trim().length === 0
            || repo.name.trim().length === 0
        ) {
            throw new Error('[visual fixtures] allowlist contains an invalid repository (owner/name are required)')
        }
    }
}

/**
 * 视觉库客户端抽象：由 Playwright 适配器注入（见 `tests/visual/helpers/visual-db.ts`），
 * 使清理 / 断言逻辑可在 vitest 中用替身覆盖，不依赖真实浏览器或 HTTP 服务。
 */
export interface VisualRepositoryClient {
    list: () => Promise<RepositoryKey[]>
    remove: (repos: RepositoryKey[]) => Promise<void>
}

/**
 * 删除库内非 fixtures 仓库（幂等）。
 *
 * @returns 实际被清理的仓库；空数组表示集合已一致或仅存在缺失项（缺失由 reset 注入修复）。
 */
export async function cleanRepositoryExtras(
    client: VisualRepositoryClient,
    expected: readonly RepositoryKey[],
): Promise<RepositoryKey[]> {
    assertValidAllowlist(expected)
    const diff = diffRepositorySet(await client.list(), expected)
    if (diff.extra.length === 0) {
        return []
    }
    await client.remove(diff.extra)
    return diff.extra
}

/** 断言库内仓库集合与 fixtures 完全一致；不一致抛出带差异清单的错误。 */
export async function assertRepositorySet(
    client: VisualRepositoryClient,
    expected: readonly RepositoryKey[],
): Promise<void> {
    assertValidAllowlist(expected)
    const diff = diffRepositorySet(await client.list(), expected)
    if (diff.extra.length === 0 && diff.missing.length === 0) {
        return
    }
    throw new Error(formatRepositorySetDiff(diff, expected))
}
