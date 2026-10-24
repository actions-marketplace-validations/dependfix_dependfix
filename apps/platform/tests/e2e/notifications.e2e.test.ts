import { test, expect, type Page } from '@playwright/test'
import { waitForHydration } from './helpers/hydration.helper'

/** 通知管理员页权限与基础渲染。 */
test.describe('/notifications 管理员页', () => {
    test.use({ storageState: 'tests/e2e/.auth/admin.json' })

    /** 持久化 e2e 库可能残留前次运行的组织设置：显式钉住默认关闭，避免默认态断言假失败。 */
    const setWeeklyDigest = async (page: Page, enabled: boolean) => {
        const response = await page.request.patch('/api/organizations/current/notification-settings', {
            data: { categories: { weeklyDigest: enabled } },
        })
        expect(response.ok()).toBe(true)
    }

    test('admin 个人设置可见通知偏好卡片', async ({ page }) => {
        await setWeeklyDigest(page, false)
        await page.goto('/settings')
        await waitForHydration(page)
        await expect(page.getByText('通知偏好')).toBeVisible()
        await expect(page.getByText('平台自身问题', { exact: true })).toBeVisible()
        await expect(page.getByText('高危告警')).toBeVisible()
        // 周汇总已是可配置类别：不再显示「后续版本提供」占位说明
        await expect(page.getByText('每周汇总将在后续版本提供，当前开关暂不生效。')).toHaveCount(0)
        await expect(page.locator('#notification-weekly_digest')).toHaveCount(1)
    })

    test('组织开启周汇总后个人开关可配置（组织关闭时置灰）', async ({ page }) => {
        await setWeeklyDigest(page, false)
        await page.goto('/settings')
        await waitForHydration(page)
        const personal = page.locator('#notification-weekly_digest')
        await expect(personal).toBeDisabled()

        try {
            await setWeeklyDigest(page, true)
            await page.reload()
            await waitForHydration(page)
            await expect(page.locator('#notification-weekly_digest')).toBeEnabled()
            await expect(page.getByText(/默认每周一 09:00/)).toBeVisible()
        } finally {
            await setWeeklyDigest(page, false)
        }
    })

    test('admin 可访问并看到组织设置与投递记录', async ({ page }) => {
        await setWeeklyDigest(page, false)
        await page.goto('/notifications')
        await waitForHydration(page)
        await expect(page.getByRole('heading', { name: '通知与邮件' })).toBeVisible()
        await expect(page.getByText('事件类别')).toBeVisible()
        await expect(page.getByText('最近投递记录')).toBeVisible()
        // 组织级周汇总开关可配置（回归：曾置灰并提示后续版本提供）
        const weekly = page.locator('#org-notify-weekly')
        await expect(weekly).toBeEnabled()
        await expect(weekly).toHaveAttribute('aria-checked', 'false')
        await expect(page.getByText(/默认每周一 09:00/)).toBeVisible()
        await expect(page.getByText('每周汇总将在后续版本提供，当前开关暂不生效。')).toHaveCount(0)
        // 导航项可见
        await expect(page.locator('a:has-text("通知")')).toBeVisible()
    })
})

test.describe('/notifications viewer 权限', () => {
    test.use({ storageState: 'tests/e2e/.auth/viewer.json' })

    test('viewer 直访 /notifications 被重定向到 /dashboard', async ({ page }) => {
        await page.goto('/notifications')
        await waitForHydration(page)
        await expect(page).toHaveURL(/\/dashboard/)
    })
})
