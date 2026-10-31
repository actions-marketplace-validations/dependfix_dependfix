import path from 'node:path'
import { chromium, type FullConfig } from '@playwright/test'
import { TEST_ADMIN, apiSignUp, pageSignIn } from '../e2e/helpers/auth.helper'
import { resetVisualFixtures } from './helpers/fixtures'
import { assertVisualRepositorySet, cleanVisualRepositoryExtras } from './helpers/visual-db'

/**
 * 视觉回归全局初始化（独立于 e2e global-setup）：
 * 1. 等待 webServer 就绪
 * 2. 注册 admin（幂等）
 * 3. 登录并保存认证状态到 `tests/visual/.auth/admin.json`
 * 4. 清理视觉库内的非 fixtures 仓库（默认开启，VISUAL_FIXTURES_AUTO_CLEAN=0 可关闭）
 * 5. 重置 + 注入视觉专属 fixtures（见 helpers/fixtures.ts）
 * 6. 断言库内仓库集合与 fixtures 完全一致（不一致在截图前失败，不落成像素差异）
 *
 * 不复用 `tests/e2e/global-setup.ts`：
 * - 其数据集缺省时间戳（运行期取 now()）且不含仓库标签，无法作为像素基线输入；
 * - 其认证状态文件与 e2e 共用会被本套件覆盖（两份 auth 对应各自独立的 SQLite 库，
 *   共用会让另一套的 session 记录失效）。
 * 账号注册 / 登录复用 e2e 的 helper 纯函数（语义一致，无状态耦合）。
 */
async function globalSetup(config: FullConfig): Promise<void> {
    const baseURL = config.projects[0]?.use?.baseURL ?? 'http://127.0.0.1:3102'
    const authDir = path.resolve(process.cwd(), 'tests/visual/.auth')
    const adminAuthFile = path.join(authDir, 'admin.json')
    const browser = await chromium.launch()

    try {
        const setupCtx = await browser.newContext({ baseURL })
        const setupPage = await setupCtx.newPage()
        console.info('[visual global-setup] waiting for server...')
        await setupPage.goto('/', { timeout: 60000 })
        console.info('[visual global-setup] server ready')
        await apiSignUp(setupPage.request, TEST_ADMIN)
        await setupCtx.close()

        const adminCtx = await browser.newContext({ baseURL })
        const adminPage = await adminCtx.newPage()
        console.info('[visual global-setup] signing in admin...')
        await pageSignIn(adminPage, TEST_ADMIN)
        await adminCtx.storageState({ path: adminAuthFile })
        console.info(`[visual global-setup] admin auth state saved to ${adminAuthFile}`)
        await adminCtx.close()

        const fixturesCtx = await browser.newContext({ baseURL, storageState: adminAuthFile })
        try {
            // 视觉库（data/visual.sqlite）是独立测试库；残留的非 fixtures 仓库会让视口级基线
            // 出现与代码无关的整表差异。默认按 VISUAL_FIXTURES.repos 白名单清理，
            // VISUAL_FIXTURES_AUTO_CLEAN=0 时只断言不删除（便于排查）。
            if (process.env.VISUAL_FIXTURES_AUTO_CLEAN === '0') {
                console.info('[visual global-setup] auto clean disabled; asserting repository set only')
            } else {
                const cleaned = await cleanVisualRepositoryExtras(fixturesCtx.request)
                if (cleaned.length > 0) {
                    console.warn(
                        `[visual global-setup] removed ${cleaned.length} non-fixture repositories: ${cleaned.map((repo) => `${repo.owner}/${repo.name}`).join(', ')}`,
                    )
                }
            }

            console.info('[visual global-setup] resetting visual fixtures...')
            await resetVisualFixtures(fixturesCtx.request)
            console.info('[visual global-setup] visual fixtures seeded')

            await assertVisualRepositorySet(fixturesCtx.request)
            console.info('[visual global-setup] repository set verified')
        } finally {
            await fixturesCtx.close()
        }
    } finally {
        await browser.close()
    }
}

export default globalSetup
