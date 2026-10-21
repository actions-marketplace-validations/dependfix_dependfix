import { test, expect } from '@playwright/test'
import { waitForHydration } from './helpers/hydration.helper'

/** 通知管理员页权限与基础渲染。 */
test.describe('/notifications 管理员页', () => {
    test.use({ storageState: 'tests/e2e/.auth/admin.json' })

    test('admin 个人设置可见通知偏好卡片', async ({ page }) => {
        await page.goto('/settings')
        await waitForHydration(page)
        await expect(page.getByText('通知偏好')).toBeVisible()
        await expect(page.getByText('平台自身问题', { exact: true })).toBeVisible()
        await expect(page.getByText('高危告警')).toBeVisible()
    })

    test('admin 可访问并看到组织设置与投递记录', async ({ page }) => {
        await page.goto('/notifications')
        await waitForHydration(page)
        await expect(page.getByRole('heading', { name: '通知与邮件' })).toBeVisible()
        await expect(page.getByText('事件类别')).toBeVisible()
        await expect(page.getByText('最近投递记录')).toBeVisible()
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
