import { expect, test, type Page } from '@playwright/test'
import { waitForHydration } from './helpers/hydration.helper'

/**
 * 运行失败「受约束重试入口」端到端测试（口径见 docs/design/governance/run-failure-taxonomy.md §5.5）。
 *
 * 覆盖三组：入口出现 / 不出现 + 二次确认 + 来源与合并提示（口径见 docs/design/governance/run-failure-taxonomy.md §5.5）：
 * 1. `failureKind === 'transient'` → 运行详情弹窗出现「重试」按钮；点击后有二次确认，
 *    确认后 POST `/api/runs/[id]/retry`（前端只传 runId），成功后提示新运行
 * 2. `failureKind === 'deterministic'` → 不出现重试按钮（前端不可见；后端另有独立守卫）
 * 3. 命中去重合并（响应含顶层 `merged`）→ 提示合并语义、不当作成功
 *
 * 依赖：alert-run-sidebar 的「详情」入口 + run-detail-dialog（重试入口落点）+ use-run-retry composable。
 */
test.use({ storageState: 'tests/e2e/.auth/admin.json' })

const RUN_ID = '22345678-abcdefgh-ijklmnop'

const makeAlert = {
    id: 'alert-retry-1',
    runId: RUN_ID,
    repository: 'foo/bar',
    source: 'dependabot',
    severity: 'high',
    packageName: 'lodash',
    manifestPath: 'package.json',
    ruleId: 'GHSA-xxxx-xxxx-xxxx',
    summary: 'prototype pollution',
    fixable: true,
    fixStrategy: 'dependency-upgrade',
    recommendedVersion: '4.18.0',
    htmlUrl: null,
    fixStatus: 'pending',
    errorMessage: null,
    affectedRunIds: [RUN_ID],
    occurrenceCount: 1,
    firstSeenAt: '2026-08-26T10:00:00.000Z',
    lastSeenAt: '2026-08-26T10:00:12.345Z',
}

const makeRun = (overrides: Record<string, unknown> = {}) => ({
    id: RUN_ID,
    repositoryId: 'repo-1',
    owner: 'foo',
    name: 'bar',
    mode: 'fix',
    severityThreshold: 'high',
    executorKind: 'container',
    status: 'failed',
    startedAt: '2026-08-26T10:00:00.000Z',
    finishedAt: '2026-08-26T10:00:12.345Z',
    runUrl: null,
    summary: { alertsFound: 2, alertsFixed: 1 },
    error: { code: 'ETIMEDOUT', message: '网络超时' },
    failureCode: 'ETIMEDOUT',
    failureStage: 'clone',
    failureKind: 'transient',
    retriedFromRunId: null,
    results: [],
    logs: [],
    logsText: null,
    ...overrides,
})

/** /scans 页所需端点 mock（重试成功后的去向页面；避免真实打 DB） */
const installScansRoutes = async (page: Page): Promise<void> => {
    await page.route('**/api/scan-history/summary*', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
            byStatus: { pending: 1, running: 0, completed: 0, failed: 0, dispatched: 0, degraded: 0 },
            totals: { runs: 1, totalAlerts: 0, totalFixed: 0 },
            repositories: [{
                repositoryId: 'repo-1',
                owner: 'foo',
                name: 'bar',
                runCount: 1,
                alertCount: 0,
                fixedCount: 0,
                lastRunAt: '2026-08-26T10:00:12.345Z',
                lastStatus: 'pending',
            }],
            window: { start: '2026-08-26T10:00:00.000Z', end: '2026-08-26T10:00:12.345Z', included: 1, limit: 500 },
            filtered: { repositoryId: null },
        }),
    }))
}

const installRoutes = async (page: Page, run: Record<string, unknown>): Promise<void> => {
    await page.route('**/api/alerts*', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([makeAlert]),
    }))
    await page.route('**/api/repos*', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'repo-1', owner: 'foo', name: 'bar' }]),
    }))
    await page.route(/\/api\/runs(\/|\?|$)/, async (route) => {
        const url = new URL(route.request().url())
        if (url.pathname === '/api/runs' && url.searchParams.has('ids')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ items: [run], total: 1, page: 1, pageSize: 100 }),
            })
            return
        }
        if (url.pathname === `/api/runs/${RUN_ID}`) {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(run) })
            return
        }
        await route.continue()
    })
}

/** 打开 alerts 视图 → 行详情抽屉 → 运行详情弹窗（重试入口落点） */
const openRunDetail = async (page: Page): Promise<void> => {
    await page.goto('/alerts')
    await waitForHydration(page)
    await page.locator('#view-mode').click()
    await page.locator('.caomei-select__content .caomei-select__item').filter({ hasText: '原始列表' }).click()
    const row = page.locator('.caomei-data-table__row').filter({ hasText: 'lodash' }).first()
    await expect(row).toBeVisible()
    await row.locator('button[aria-label="详情"]').click()

    const sidebar = page.locator('.caomei-drawer__content')
    await expect(sidebar).toContainText('22345678')
    await sidebar.locator('button[aria-label="详情"]').first().click()
    await expect(page.getByRole('dialog', { name: /扫描详情/ })).toBeVisible()
}

test.describe('运行失败「受约束重试入口」', () => {
    test('transient 失败：详情弹窗出现重试入口 + 二次确认后只传 runId 触发', async ({ page }) => {
        await installRoutes(page, makeRun())

        const retryRequests: { url: string, body: string | null }[] = []
        await page.route(`**/api/runs/${RUN_ID}/retry`, async (route) => {
            retryRequests.push({ url: route.request().url(), body: route.request().postData() })
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ id: 'retry-run-1', retriedFromRunId: RUN_ID }),
            })
        })
        await installScansRoutes(page)

        await openRunDetail(page)

        // 失败归因块 + 重试入口可见（transient）
        const dialog = page.getByRole('dialog', { name: /扫描详情/ })
        await expect(dialog).toContainText('失败归因')
        await expect(dialog).toContainText('ETIMEDOUT')
        await expect(dialog).toContainText('可重试')
        const retryButton = page.getByRole('button', { name: '重试' })
        await expect(retryButton).toBeVisible()

        // 二次确认文案（消耗队列 / 容器资源）
        await retryButton.click()
        const confirmDialog = page.getByRole('alertdialog', { name: '确认重试该运行？' })
        await expect(confirmDialog).toBeVisible()
        await expect(confirmDialog).toContainText('占用扫描队列与容器资源')

        // 二次确认取消分支：不触发请求（守卫 mutation 覆盖）
        await confirmDialog.getByRole('button', { name: '取消' }).click()
        await expect(confirmDialog).toBeHidden()
        await page.waitForTimeout(300)
        expect(retryRequests).toHaveLength(0)

        // 确认后触发：前端只传 runId（请求体为空）
        await retryButton.click()
        await page.getByRole('alertdialog', { name: '确认重试该运行？' }).getByRole('button', { name: '确定' }).click()
        await expect.poll(() => retryRequests.length, { timeout: 5000 }).toBe(1)
        expect(retryRequests[0]!.url).toContain(`/api/runs/${RUN_ID}/retry`)
        expect(retryRequests[0]!.body).toBeNull()

        // 成功去向：跳转扫描历史并直接打开新运行（与「立即修复」同口径）
        await page.waitForURL((u) => {
            const sp = new URL(u).searchParams
            return sp.get('repository') === 'repo-1' && sp.get('run') === 'retry-run-1'
        }, { timeout: 10000 })
    })

    test('deterministic 失败：不出现重试入口 + 展示重试来源链', async ({ page }) => {
        await installRoutes(page, makeRun({
            failureKind: 'deterministic',
            failureStage: 'verify',
            failureCode: 'VERIFICATION_FAILED',
            retriedFromRunId: '11112222-3333-4444-5555-666677778888',
        }))

        await openRunDetail(page)

        const dialog = page.getByRole('dialog', { name: /扫描详情/ })
        await expect(dialog).toContainText('失败归因')
        await expect(dialog).toContainText('需研判')
        // 来源链：短 id 可见（非重试触发的运行不展示该字段，由单测覆盖 null 口径）
        await expect(dialog).toContainText('重试来源')
        await expect(dialog).toContainText('11112222')
        // deterministic 不出现入口（前端不可见；后端另有守卫）
        await expect(page.getByRole('button', { name: '重试' })).toHaveCount(0)
    })

    test('命中去重合并：提示合并语义且不提示成功', async ({ page }) => {
        await installRoutes(page, makeRun())

        await page.route(`**/api/runs/${RUN_ID}/retry`, (route) => route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: 'retry-run-2',
                retriedFromRunId: RUN_ID,
                merged: { code: 'SCAN_PENDING_MERGED', message: '该仓库已有进行中的扫描任务，本次触发已合并' },
            }),
        }))

        await openRunDetail(page)
        await page.getByRole('button', { name: '重试' }).click()
        await page.getByRole('alertdialog', { name: '确认重试该运行？' }).getByRole('button', { name: '确定' }).click()

        const dialog = page.getByRole('dialog', { name: /扫描详情/ })
        await expect(dialog).toContainText('本次触发已合并')
        await expect(dialog).not.toContainText('已重新入队')
    })
})
