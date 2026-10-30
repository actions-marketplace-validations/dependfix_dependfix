import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { isAllFilteredSelected, useRepoSelection } from '../../app/composables/use-repo-selection'

/**
 * use-repo-selection 单测：caomei-ui 1.0.0 全选语义适配的纯逻辑面。
 *
 * 覆盖「按 id 判定全选（不依赖对象引用）/ 空筛选不算全选 / 隐藏行仍在集合内仍算全选 /
 * 全选替换为筛选集合 / 清空」五条，浏览器侧行为由 `tests/e2e/repos-select-all.e2e.test.ts` 覆盖。
 */

const row = (id: string) => ({ id, name: `repo-${id}` })

describe('isAllFilteredSelected', () => {
    it('按 id 判定：另一份对象引用的同一批行也算全选', () => {
        expect(isAllFilteredSelected([row('1'), row('2')], [row('2'), row('1')])).toBe(true)
    })

    it('缺任意一行即不是全选', () => {
        expect(isAllFilteredSelected([row('1')], [row('1'), row('2')])).toBe(false)
    })

    it('空筛选集合不算全选（避免空态显示「清空选择」）', () => {
        expect(isAllFilteredSelected([], [])).toBe(false)
    })

    it('已选集合含筛选外的隐藏行时仍算全选', () => {
        expect(isAllFilteredSelected([row('1'), row('2'), row('hidden')], [row('1'), row('2')])).toBe(true)
    })
})

describe('useRepoSelection', () => {
    it('全选替换为筛选集合、清空归零，并同步驱动 allFilteredSelected', async () => {
        const selected = ref([row('hidden')])
        const filtered = ref([row('1'), row('2')])
        const { allFilteredSelected, selectAllFiltered, clearSelection } = useRepoSelection(
            selected,
            () => filtered.value,
        )

        expect(allFilteredSelected.value).toBe(false)

        selectAllFiltered()
        await nextTick()
        expect(selected.value.map((item) => item.id)).toEqual(['1', '2'])
        expect(allFilteredSelected.value).toBe(true)

        clearSelection()
        await nextTick()
        expect(selected.value).toEqual([])
        expect(allFilteredSelected.value).toBe(false)
    })
})
