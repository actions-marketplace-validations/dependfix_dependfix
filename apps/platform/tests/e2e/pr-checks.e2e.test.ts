import { expect, test } from '@playwright/test'
import { waitForHydration } from './helpers/hydration.helper'

/**
 * PR Check 页「立即检查」手动触发入口 e2e。
 *
 * 覆盖点：
 * - 按钮在页面头部可见（admin 登录态）
 * - 点击后：e2e 环境默认未启用总开关 `ACTION_STATUS_MONITOR_ENABLED` → 服务端返回 `skipped: true`
 *   → 前端以 warning toast 呈现「监测未启用」提示（不视为失败、不跳转）
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
