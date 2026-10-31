// repository-tags.test.ts — 仓库标签归一（写入 / 读取同源函数）的口径。
//
// 该函数同时被写入闸门（`schemas/repository.ts` 的 transform）与读取侧（`parseTags`）使用，
// 因此这里锁定的是「两端看到同一集合」所依赖的最小语义：trim / 去空 / 去重保序。
import { describe, expect, it } from 'vitest'
import { MAX_REPOSITORY_TAGS, MAX_REPOSITORY_TAG_LENGTH, normalizeRepositoryTags } from './repository-tags'

describe('repository tags constants', () => {
    it('数量与长度上限取固定值（共用以外的行为断言在 repository.test.ts）', () => {
        expect(MAX_REPOSITORY_TAGS).toBe(20)
        expect(MAX_REPOSITORY_TAG_LENGTH).toBe(50)
    })
})

describe('normalizeRepositoryTags', () => {
    it('逐项 trim 并去重（保留首次出现顺序）', () => {
        expect(normalizeRepositoryTags([' frontend ', 'frontend', 'critical', ' critical ']))
            .toEqual(['frontend', 'critical'])
    })

    it('丢弃 trim 后为空的项（不产生空标签）', () => {
        expect(normalizeRepositoryTags(['', '   ', 'prod'])).toEqual(['prod'])
    })

    it('不施加容量上限（容量只在写入侧把关，读取保持宽容）', () => {
        const many = Array.from({ length: MAX_REPOSITORY_TAGS + 1 }, (_, i) => `tag-${i}`)
        expect(normalizeRepositoryTags(many)).toHaveLength(MAX_REPOSITORY_TAGS + 1)
    })

    it('空数组 → 空数组（不返回共享引用以外的东西）', () => {
        expect(normalizeRepositoryTags([])).toEqual([])
    })
})
