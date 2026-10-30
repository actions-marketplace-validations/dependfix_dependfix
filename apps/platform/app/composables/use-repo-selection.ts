import { computed, type Ref } from 'vue'

/** 行选择所需的最小形状（仓库行、结果行共用）。 */
export interface SelectableRow {
    id: string
}

/**
 * 当前筛选结果是否已全部选中（按 `id` 比对）。
 *
 * 不按对象引用比对：`selectedRows` 可能来自接口返回的另一份对象，或被筛选隐藏的行仍在集合中；
 * 只要筛选集合内每一行的 id 都在已选集合里即视为「全选」。
 */
export function isAllFilteredSelected<T extends SelectableRow>(
    selected: readonly T[],
    filtered: readonly T[],
): boolean {
    return filtered.length > 0 && filtered.every((row) => selected.some((item) => item.id === row.id))
}

/**
 * 跨页选择的派生状态与动作。
 *
 * caomei-ui 1.0.0 起 DataTable 表头全选只作用于当前页，本组合式承担「全选全部筛选结果」：
 * - `allFilteredSelected`：筛选集合是否已全选（驱动选择栏在全选 / 清空之间切换）；
 * - `selectAllFiltered`：整集合替换（与 DataTable 回写「当前过滤集合」的既有语义一致，
 *   被筛选隐藏的已选行会被移出）；
 * - `clearSelection`：清空已选。
 */
export function useRepoSelection<T extends SelectableRow>(
    selectedRows: Ref<T[]>,
    filteredRows: () => T[],
) {
    const allFilteredSelected = computed(() => isAllFilteredSelected(selectedRows.value, filteredRows()))

    const selectAllFiltered = () => {
        selectedRows.value = [...filteredRows()]
    }

    const clearSelection = () => {
        selectedRows.value = []
    }

    return { allFilteredSelected, selectAllFiltered, clearSelection }
}
