import { expect, test } from '@playwright/test'
import { seedCustomFixtures } from './helpers/fixtures.helper'
import { waitForHydration } from './helpers/hydration.helper'

/**
 * PR Check 页 e2e。
 *
 * 覆盖点：
 * - 按钮在页面头部可见（admin 登录态）
 * - 点击后：e2e 环境默认未启用总开关 `ACTION_STATUS_MONITOR_ENABLED` → 服务端返回 `skipped: true`
 *   → 前端以 warning toast 呈现「监测未启用」提示（不视为失败、不跳转）
 * - 仓库列：跨仓库同号 PR 并存时行内可辨识归属（仓库标签 `owner/name`）
 *
 * 不覆盖：启用总开关后的真实 polling（需真实 GitHub 凭据 + 网络；启用分支的响应形态由
 * `server/api/pr-checks/poll.post.test.ts` 单测覆盖，真实链路验证登记为待人工验收）。
 */

test.use({ storageState: 'tests/e2e/.auth/admin.json' })

test.describe('PR Check 手动触发', () => {
    test('「立即检查」按钮可见；未启用总开关时点击给出提示', async ({ page }) => {
        await page.goto('/pr-checks')
        await waitForHydration(page)

        const pollButton = page.locator('button:has-text("立即检查")')
        await expect(pollButton).toBeVisible({ timeout: 15000 })

        await pollButton.click()

        // 未启用总开关 → warning 提示（文案来自 prChecks.poll.disabled）
        await expect(
            page.locator('.caomei-toast').filter({ hasText: '监测未启用' }).first(),
        ).toBeVisible({ timeout: 10000 })
    })
})

test.describe('PR Check 列表行内仓库辨识度', () => {
    test('仓库列：跨仓库同号 PR 并存时行内可区分归属', async ({ page }) => {
        // 复用 global-setup 已注入的仓库（foo/bar + foo/baz，幂等），构造「跨仓库同号 PR（#390）」
        await seedCustomFixtures(page.request, {
            repos: [{ owner: 'foo', name: 'bar' }, { owner: 'foo', name: 'baz' }],
            scanRuns: [],
            scanResults: [],
            prChecks: [
                {
                    repositoryOwner: 'foo',
                    repositoryName: 'bar',
                    prNumber: 390,
                    headSha: 'a'.repeat(40),
                    authorLogin: 'dependfix[bot]',
                    conclusion: 'failure',
                    alertFiring: true,
                    lastPolledAt: '2026-08-28T02:00:00.000Z',
                },
                {
                    repositoryOwner: 'foo',
                    repositoryName: 'baz',
                    prNumber: 390,
                    headSha: 'b'.repeat(40),
                    authorLogin: 'dependfix[bot]',
                    conclusion: 'success',
                    alertFiring: false,
                    lastPolledAt: '2026-08-27T02:00:00.000Z',
                },
            ],
        })

        await page.goto('/pr-checks')
        await waitForHydration(page)

        const table = page.locator('.caomei-data-table')
        await expect(table).toBeVisible({ timeout: 15000 })
        await expect(table.locator('th', { hasText: '仓库' }).first()).toBeVisible()

        // 两行同号 PR 并存：若无仓库列则行内无从区分（本用例即锁定该可辨识度）
        const sameNumberRows = table.locator('tbody .caomei-data-table__row').filter({ hasText: '#390' })
        await expect(sameNumberRows).toHaveCount(2)
        // 逐行绑定仓库标签（锁定「值 → 行」映射，而非仅「两个值分别出现在某行」）
        await expect(sameNumberRows.filter({ hasText: 'foo/bar' })).toHaveCount(1)
        await expect(sameNumberRows.filter({ hasText: 'foo/baz' })).toHaveCount(1)

        // 截断策略：完整 `owner/name` 经 title 暴露；超长值下单元内 ellipsis 生效（scrollWidth > clientWidth）
        const repoCell = sameNumberRows.first().locator('.pr-checks__repository')
        await expect(repoCell).toHaveAttribute('title', /foo\/(bar|baz)/)
        const truncation = await repoCell.evaluate((el) => {
            const text = el.textContent
            el.textContent = `${'very-long-organization-name/'.repeat(12)}web-application-with-an-extremely-long-repository-name`
            const metrics = { scroll: el.scrollWidth, client: el.clientWidth }
            el.textContent = text
            return metrics
        })
        expect(truncation.scroll).toBeGreaterThan(truncation.client)
    })
})
