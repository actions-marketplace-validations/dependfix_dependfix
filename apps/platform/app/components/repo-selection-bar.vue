<script setup lang="ts">
/**
 * 仓库列表的跨页选择栏（caomei-ui 1.0.0 全选语义适配）。
 *
 * 上游 DataTable 表头全选只作用于当前页，平台「批量扫描全部筛选结果」需要一次性覆盖跨页集合，
 * 故把「全选全部 / 清空选择 + 已选计数」抽成纯展示组件，选择状态仍由页面持有
 * （`selectedRows` / `filteredRepos` 的单一事实源不迁移）。
 */
defineProps<{
    /** 已选条数（可能含被筛选隐藏的行）。 */
    selected: number
    /** 当前筛选结果总条数。 */
    total: number
    /** 当前筛选结果是否已全部选中（决定按钮在「全选」与「清空」间切换）。 */
    allSelected: boolean
}>()

const emit = defineEmits<{
    'select-all': []
    clear: []
}>()

const { t } = useI18n()
</script>

<template>
    <div class="repo-selection-bar">
        <span class="repo-selection-bar__summary">
            {{ t('repos.selectionSummary', {selected, total}) }}
        </span>
        <div class="repo-selection-bar__actions">
            <CaomeiButton
                v-if="selected > 0"
                size="sm"
                variant="ghost"
                tone="neutral"
                @click="emit('clear')"
            >
                {{ t('repos.clearSelection') }}
            </CaomeiButton>
            <CaomeiButton
                v-if="!allSelected"
                size="sm"
                variant="ghost"
                tone="neutral"
                @click="emit('select-all')"
            >
                {{ t('repos.selectAllFiltered', {count: total}) }}
            </CaomeiButton>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.repo-selection-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: $space-2;
    margin-bottom: $space-2;

    &__summary {
        font-size: $font-size-sm;
        color: $color-text-muted;
    }

    &__actions {
        display: flex;
        align-items: center;
        gap: $space-1;
    }
}
</style>
