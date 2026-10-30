import { expect, test } from '@playwright/test'
import { authedCookieHeader } from './helpers/auth-cookie.helper'
import { waitForHydration } from './helpers/hydration.helper'

/**
 * 仓库列表跨页全选语义 e2e（caomei-ui 1.0.0 升级适配）。
 *
 * 背景：1.0.0 起 DataTable 表头全选改用 `getIsAllPageRowsSelected` / `toggleAllPageRowsSelected`，
 * 作用域从「全部行」收窄为「当前页」。平台「批量扫描」需要一次性选中全部筛选结果，
 * 因此改由表格上方的选择栏承载（`全选全部（N）` / `清空选择`），表头保持上游语义。
 *
 * 守卫点：
 * 1. 表头全选只选当前页（12 条筛选结果、每页 10 条 → 选中 10 条）；
 * 2. 翻页后上一页的选择仍然保留（受控 selection 按 row id 跨页保持）；
 * 3. `全选全部（N）` 一次覆盖全部筛选结果（含第 2 页），`清空选择` 归零。
 *
 * 数据：本用例自建 12 个带唯一前缀的仓库并在结束时删除，不依赖库中其它数据。
 */

const RUN_ID = Date.now().toString(36)
const OWNER = `select-all-e2e-${RUN_ID}`
const REPO_COUNT = 12
const PAGE_SIZE = 10
const E2E_ORIGIN = 'http://127.0.0.1:3101'

test.use({ storageState: 'tests/e2e/.auth/admin.json' })

test.describe('仓库列表跨页全选', () => {
    test('表头全选按页、选择栏全选覆盖全部筛选结果', async ({ page }) => {
        const cookieHeader = await authedCookieHeader(page)
        const createdIds: string[] = []

        try {
            for (let i = 0; i < REPO_COUNT; i++) {
                const response = await page.request.post('/api/repos', {
                    headers: { cookie: cookieHeader, origin: E2E_ORIGIN },
                    data: {
                        owner: OWNER,
                        name: `repo-${RUN_ID}-${String(i).padStart(2, '0')}`,
                        platform: 'github',
                        packageManager: 'pnpm',
                        defaultBranch: 'main',
                        executorKind: 'container',
                    },
                })
                expect(response.ok()).toBeTruthy()
                const body = await response.json()
                createdIds.push(body.id)
            }
            expect(createdIds).toHaveLength(REPO_COUNT)

            await page.goto('/repos')
            await waitForHydration(page)

            const rows = page.locator('tbody .caomei-data-table__row')
            const selectedRows = page.locator('tbody .caomei-data-table__row--selected')
            const summary = page.locator('.repo-selection-bar__summary')

            // 限定到本用例前缀：12 条筛选结果、默认每页 10 条
            await page.locator('#repos-filter-search').fill(OWNER)
            await expect(rows).toHaveCount(PAGE_SIZE, { timeout: 15000 })
            await expect(summary).toBeVisible()
            await expect(summary).toHaveText(`已选 0 条，当前筛选 ${REPO_COUNT} 条`)

            // 版面守卫：选择栏在表格上方且不重叠（新增 UI 不压住表头）
            const barBox = await page.locator('.repo-selection-bar').boundingBox()
            const tableBox = await page.locator('.caomei-data-table').boundingBox()
            expect(barBox).not.toBeNull()
            expect(tableBox).not.toBeNull()
            expect(barBox!.y + barBox!.height).toBeLessThanOrEqual(tableBox!.y + 1)

            // 表头全选 = 当前页（10 条），不是全部 12 条
            await page.locator('.caomei-data-table thead .caomei-checkbox__control').click()
            await expect(summary).toHaveText(`已选 ${PAGE_SIZE} 条，当前筛选 ${REPO_COUNT} 条`)

            // 第 2 页：2 行且未被表头全选波及（上游「当前页」语义）
            await page.locator('.caomei-paginator__control[aria-label="第 2 页"]').click()
            await expect(rows).toHaveCount(REPO_COUNT - PAGE_SIZE, { timeout: 10000 })
            await expect(selectedRows).toHaveCount(0)
            // 上一页已选 10 条仍在（受控选择跨页保持）
            await expect(summary).toHaveText(`已选 ${PAGE_SIZE} 条，当前筛选 ${REPO_COUNT} 条`)

            // 选择栏「全选全部」：覆盖全部筛选结果（含第 2 页）
            await page.getByRole('button', { name: `全选全部（${REPO_COUNT}）` }).click()
            await expect(summary).toHaveText(`已选 ${REPO_COUNT} 条，当前筛选 ${REPO_COUNT} 条`)
            await expect(selectedRows).toHaveCount(REPO_COUNT - PAGE_SIZE)

            // 回到第 1 页：10 条仍为选中态
            await page.locator('.caomei-paginator__control[aria-label="第 1 页"]').click()
            await expect(rows).toHaveCount(PAGE_SIZE, { timeout: 10000 })
            await expect(selectedRows).toHaveCount(PAGE_SIZE)

            // 刷新一致性：编辑保存触发 fetchData（列表对象全部换新）→ 选择必须按 id 保住，
            // 否则会出现「已选 12 条」但没有任何行勾选的视图矛盾
            await page.getByRole('button', { name: '编辑' }).first().click()
            const dialog = page.locator('.caomei-dialog__content')
            await expect(dialog).toBeVisible({ timeout: 15000 })
            await dialog.getByRole('button', { name: '保存' }).click()
            await expect(dialog).not.toBeVisible({ timeout: 15000 })
            await expect(summary).toHaveText(`已选 ${REPO_COUNT} 条，当前筛选 ${REPO_COUNT} 条`)
            await expect(selectedRows).toHaveCount(PAGE_SIZE)

            // 筛选变化不清空已选（「全选全部 / 批量扫描」语义依赖该不变量）；
            // 用本次 runId 限定到 10 条（00-09），证明筛选收窄后选择仍在
            await page.locator('#repos-filter-search').fill(`${RUN_ID}-0`)
            await expect(rows).toHaveCount(PAGE_SIZE, { timeout: 10000 })
            await expect(summary).toHaveText(`已选 ${REPO_COUNT} 条，当前筛选 ${PAGE_SIZE} 条`)

            // 清空选择
            await page.getByRole('button', { name: '清空选择' }).click()
            await expect(summary).toHaveText(`已选 0 条，当前筛选 ${PAGE_SIZE} 条`)
            await expect(selectedRows).toHaveCount(0)
        } finally {
            // 单条删除失败不阻断其余清理（共享 e2e 库不因一条残留而放大）
            await Promise.allSettled(createdIds.map((id) => page.request.delete(`/api/repos/${id}`, {
                headers: { cookie: cookieHeader, origin: E2E_ORIGIN },
            })))
        }
    })
})
