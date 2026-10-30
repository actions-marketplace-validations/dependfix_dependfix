// repository-tags.ts — 仓库标签的口径单一事实源（常量 + 归一函数）。
//
// 背景：`tags` 是 JSON 字符串列，写入侧（`schemas/repository.ts`）经 Zod 逐项 trim，
// 读取侧（`entities/repository.ts` 的 `parseTags`）此前只过滤非字符串项——同一行
// `'[" prod ","prod"]'` 经 GET 读回是 `[' prod ', 'prod']`，而按合法输入重写会得到
// `['prod']`。两端口径不一致会让「写入什么 = 读回什么」不成立（UI 展示重复标签、
// 调度器按标签筛选时漏命中）。
//
// 口径：
// - 写入：Zod 逐项 trim / 非空 / 长度上限 → 本模块 `normalizeRepositoryTags` 去重（保序）
//   → 去重后条目数 ≤ {@link MAX_REPOSITORY_TAGS}（超限 400）
// - 读取：同一归一函数（trim + 去重），保证「存量脏数据读回 = 重写后读回」；
//   容量上限**只在写入侧**把关，读取保持宽容（不截断存量行，避免历史数据静默丢失）
//
// 写入闸门在 `schemas/repository.ts` 的 `repositoryTagsSchema`（POST / PUT / e2e fixtures
// 三处共用同一 schema），禁止在调用点再写字面量。

/** 单仓库标签数量上限（去重后）。 */
export const MAX_REPOSITORY_TAGS = 20

/** 单个标签长度上限（trim 后字符数）。 */
export const MAX_REPOSITORY_TAG_LENGTH = 50

/**
 * 标签归一：逐项 trim → 丢弃空串 → 去重（保留首次出现顺序）。
 *
 * 纯函数、不抛错：非字符串项由调用方先行过滤（写入侧由 Zod 保证类型）。
 */
export function normalizeRepositoryTags(tags: readonly string[]): string[] {
    const seen = new Set<string>()
    const normalized: string[] = []
    for (const tag of tags) {
        const trimmed = tag.trim()
        if (trimmed.length === 0 || seen.has(trimmed)) {
            continue
        }
        seen.add(trimmed)
        normalized.push(trimmed)
    }
    return normalized
}
