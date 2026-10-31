import { test, expect } from '@playwright/test'
import { waitForHydration } from './helpers/hydration.helper'

/**
 * 组件库语义文本角色 token 回归（caomei-ui 1.0.0 起的 token 拆分防护）。
 *
 * 背景：1.0.0 把 Tag / Badge / Message / Tabs / Toast / 指示器的「文本色」从
 * `--caomei-color-primary` 拆到 `--caomei-color-primary-text`，且亮色档在基础预设里给了
 * **静态值** `#1d4ed8`（蓝）。平台把 `--caomei-color-primary` 改成 teal-600（见 nuxt.config.ts
 * 的 `caomeiUI.theme`），若不同步覆盖文本角色，就会渲染成「teal 软底 + 蓝字」的错配。
 *
 * 守卫意图（不是快照式锁色）：
 * 1. 亮色档文本角色必须跟随平台主色（teal-700 `#0f766e`），且**不等于**库默认蓝 `#1d4ed8`；
 * 2. 暗色档文本角色由平台暗色主色（`#5eead4`）解析，必须与 `--caomei-color-primary` 一致；
 * 3. 真实组件的计算色与 token 一致，证明覆盖真的被消费——取 `/scans` 的 `CaomeiTabs` 激活态
 *    （库内 `--caomei-tabs-trigger-active-color` 默认回退到 `--caomei-color-primary-text`），
 *    该页不依赖任何种子数据。
 *
 * 另守卫 `--caomei-color-control-border`（同批新增）：上游单值按自家暗底标定，平台暗色面更亮，
 * 故以「与实际 surface 的对比度 ≥ 3:1」（WCAG 1.4.11）为判据，而不是锁死色值。
 */

/** 平台 SCSS 覆盖中的亮色文本角色（app/assets/styles/_caomei-tokens.scss）。 */
const LIGHT_PRIMARY_TEXT = '#0f766e'
const LIB_DEFAULT_PRIMARY_TEXT = '#1d4ed8'

/**
 * 断言激活态 Tab 的文本色。
 *
 * 用 `expect.poll` 而不是固定睡眠：颜色受 `transition` 影响，切主题瞬间读到的是插值中间态；
 * 轮询到稳定值既去掉隐式时序依赖，也不掩盖真实错配（值不对会在超时后失败）。
 */
async function expectActiveTabColor(page: import('@playwright/test').Page, expected: string): Promise<void> {
    const trigger = page.locator('.caomei-tabs__trigger[data-state="active"]').first()
    await expect(trigger).toBeVisible({ timeout: 15000 })
    await expect
        .poll(() => trigger.evaluate((el) => getComputedStyle(el).color), { timeout: 5000 })
        .toBe(expected)
}

async function openScans(page: import('@playwright/test').Page): Promise<void> {
    await page.goto('/scans')
    await waitForHydration(page)
    await expect(page.locator('.caomei-tabs__trigger').first()).toBeVisible({ timeout: 15000 })
}

/** 读取控件边界与 elevated surface 的 token，并计算 WCAG 对比度。 */
async function readBorderContrast(page: import('@playwright/test').Page): Promise<{
    border: string
    surface: string
    ratio: number
    triggerBorder: string | null
}> {
    return page.evaluate(() => {
        const style = getComputedStyle(document.documentElement)
        const toRgb = (value: string): [number, number, number] => {
            const match = /^#([0-9a-f]{6})$/i.exec(value.trim())
            const hex = match?.[1]
            if (!hex) {
                throw new Error(`unexpected color format: ${value}`)
            }
            const n = Number.parseInt(hex, 16)
            return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
        }
        const channel = (c: number): number => {
            const s = c / 255
            return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
        }
        const luminance = (rgb: [number, number, number]): number => {
            const [r, g, b] = rgb
            return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
        }
        const border = style.getPropertyValue('--caomei-color-control-border').trim()
        const surface = style.getPropertyValue('--caomei-color-bg-elevated').trim()
        const a = luminance(toRgb(border))
        const b = luminance(toRgb(surface))
        // 消费面：页面上真实控件的边框色，证明 token 真的生效（而不是只改了变量）
        const trigger = document.querySelector('.caomei-select.caomei-field')
        const triggerBorder = trigger ? getComputedStyle(trigger).borderTopColor : null
        return {
            border,
            surface,
            ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
            triggerBorder,
        }
    })
}

/** `#rrggbb` → `rgb(r, g, b)`（与 getComputedStyle 的返回格式对齐）。 */
function hexToRgb(hex: string): string {
    const n = Number.parseInt(hex.replace('#', ''), 16)
    return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

test.use({ storageState: 'tests/e2e/.auth/admin.json' })

test.describe('组件库文本角色 token（1.0 拆分防护）', () => {
    test('亮色档文本角色跟随平台主色，不被库默认蓝覆盖', async ({ page }) => {
        await openScans(page)

        const token = await page.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue('--caomei-color-primary-text').trim(),
        )
        expect(token).toBe(LIGHT_PRIMARY_TEXT)
        expect(token).not.toBe(LIB_DEFAULT_PRIMARY_TEXT)

        // 端到端：激活态 Tab 文本色 = token 值（teal-700 → rgb(15, 118, 110)）
        await expectActiveTabColor(page, 'rgb(15, 118, 110)')
    })

    test('暗色档文本角色随暗色主色解析', async ({ page, context }) => {
        await context.addInitScript(() => {
            localStorage.setItem('dependfix-color-mode', 'dark')
        })
        await openScans(page)
        await expect(page.locator('html')).toHaveClass(/dark/, { timeout: 5000 })

        const tokens = await page.evaluate(() => {
            const style = getComputedStyle(document.documentElement)
            return {
                primary: style.getPropertyValue('--caomei-color-primary').trim(),
                primaryText: style.getPropertyValue('--caomei-color-primary-text').trim(),
            }
        })
        // 暗色主色 #5eead4（teal-300），文本角色须与其一致（不是亮色档的深 teal）
        expect(tokens.primary).toBe('#5eead4')
        expect(tokens.primaryText).toBe(tokens.primary)

        // 端到端：暗色激活态 Tab 文本色 = rgb(94, 234, 212)
        await expectActiveTabColor(page, 'rgb(94, 234, 212)')
    })

    test('亮色档控件边界在 elevated 面不低于 3:1', async ({ page }) => {
        await openScans(page)
        const result = await readBorderContrast(page)
        expect(result.surface).toBe('#f8fafc')
        expect(result.ratio).toBeGreaterThanOrEqual(3)
        // 消费面：真实 Select 触发器边框 = token 值（证明字段边框确实走 control-border）；
        // 用 poll 读，避开切主题时 border-color 过渡的中间态
        await expect.poll(async () => (await readBorderContrast(page)).triggerBorder, { timeout: 5000 })
            .toBe(hexToRgb(result.border))
    })

    test('暗色档控件边界在 elevated 面不低于 3:1（平台面比库默认面亮）', async ({ page, context }) => {
        await context.addInitScript(() => {
            localStorage.setItem('dependfix-color-mode', 'dark')
        })
        await openScans(page)
        await expect(page.locator('html')).toHaveClass(/dark/, { timeout: 5000 })

        const result = await readBorderContrast(page)
        // 平台 dark elevated = #1e293b；上游默认值 #67676a 在此面仅 2.59:1
        expect(result.surface).toBe('#1e293b')
        expect(result.ratio).toBeGreaterThanOrEqual(3)
        // 消费面：真实 Select 触发器边框 = 抬档后的 token 值（同上用 poll 避开过渡中间态）
        await expect.poll(async () => (await readBorderContrast(page)).triggerBorder, { timeout: 5000 })
            .toBe(hexToRgb(result.border))
    })
})
