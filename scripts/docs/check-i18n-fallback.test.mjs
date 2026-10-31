import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
    CLICK_HANDLER_MARKER,
    FALLBACK_MARKER,
    FALLBACK_TARGET_META,
    LANGUAGE_SWITCH_CLICK_HANDLER,
} from '../../docs/.vitepress/i18n-fallback.mjs'
import {
    assertFallbackEntries,
    extractClickHandler,
    handlerAppliesFullPageNavigation,
    main,
    TRANSLATED_SAMPLES,
    UNTRANSLATED_SAMPLES,
    urlPathOfBuiltPage,
    walkHtmlFiles,
} from './check-i18n-fallback.mjs'

const translatedHtml = '<!DOCTYPE html><html lang="en"><head></head><body>translated</body></html>'

/** 兜底入口页 HTML（含标记 / noindex / 中文原文入口）。 */
function fallbackHtmlFor(urlPath) {
    return `<!DOCTYPE html><html lang="en"><head>${FALLBACK_MARKER}<meta name="robots" content="noindex"></head><body><a href="${urlPath}">中文</a></body></html>`
}

/** 根 locale 页面 HTML（含语言菜单链接 + 点击补丁；未翻译页带兜底目标标记）。 */
function rootHtml(enUrl, { fallbackTarget = null, clickHandler = true } = {}) {
    const meta = fallbackTarget ? `<meta name="${FALLBACK_TARGET_META}" content="${fallbackTarget}">` : ''
    const script = clickHandler ? `<script data-i18n-fallback-handler="${CLICK_HANDLER_MARKER}">${LANGUAGE_SWITCH_CLICK_HANDLER}</script>` : ''
    return `<!DOCTYPE html><html lang="zh-CN"><head>${meta}${script}</head><body><a class="VPLink link" href="${enUrl}">English</a></body></html>`
}

/** 断言用最小抽样：一个未翻译页 + 一个已翻译页。 */
const MINIMAL_SAMPLES = {
    untranslatedSamples: ['plan/roadmap.html'],
    translatedSamples: ['guide/quick-start.html'],
}

async function writeFixture(distDir, files) {
    for (const [relativePath, content] of Object.entries(files)) {
        const targetPath = path.join(distDir, relativePath)
        await mkdir(path.dirname(targetPath), { recursive: true })
        await writeFile(targetPath, content, 'utf8')
    }
}

/** 写出一份满足默认抽样清单的完整产物（main 使用默认抽样）。 */
async function writeDefaultSampleFixture(distDir) {
    const files = { 'index.html': rootHtml('/en-US/'), 'en-US/index.html': translatedHtml }
    for (const page of TRANSLATED_SAMPLES) {
        if (page === 'index.html') {
            continue
        }
        files[page] = rootHtml(`/en-US${urlPathOfBuiltPage(page)}`)
        files[`en-US/${page}`] = translatedHtml
    }
    for (const page of UNTRANSLATED_SAMPLES) {
        const urlPath = urlPathOfBuiltPage(page)
        files[page] = rootHtml(`/en-US${urlPath}`, { fallbackTarget: `/en-US${urlPath}` })
        files[`en-US/${page}`] = fallbackHtmlFor(urlPath)
    }
    await writeFixture(distDir, files)
}

describe('walkHtmlFiles', () => {
    it('递归收集 HTML 相对路径（posix 分隔符）', async () => {
        const distDir = await mkdtemp(path.join(tmpdir(), 'i18n-fallback-check-'))
        try {
            await writeFixture(distDir, {
                'index.html': '',
                'plan/roadmap.html': '',
                'plan/archive/m39.html': '',
                'assets/app.js': '',
            })
            expect(await walkHtmlFiles(distDir)).toEqual([
                'index.html',
                'plan/archive/m39.html',
                'plan/roadmap.html',
            ])
        } finally {
            await rm(distDir, { recursive: true, force: true })
        }
    })
})

describe('urlPathOfBuiltPage', () => {
    it('按 cleanUrls 口径还原 URL 路径（含目录 index 归一）', () => {
        expect(urlPathOfBuiltPage('index.html')).toBe('/')
        expect(urlPathOfBuiltPage('plan/roadmap.html')).toBe('/plan/roadmap')
        expect(urlPathOfBuiltPage('design/modules/index.html')).toBe('/design/modules/')
    })
})

describe('extractClickHandler / handlerAppliesFullPageNavigation', () => {
    const handler = `(function () {
        function normalize(value) { try { return decodeURI(value); } catch (error) { return value; } }
        window.addEventListener('click', function (event) {
            var link = event.target.closest('a[href]');
            var meta = document.querySelector('meta[name="i18n-fallback-target"]');
            if (!link || link.hasAttribute('target') || !meta) return;
            if (normalize(link.getAttribute('href').split('#')[0]) === normalize(meta.getAttribute('content'))) {
                link.setAttribute('target', '_self');
            }
        }, true);
    })();`

    it('从产物 HTML 提取补丁脚本', () => {
        const html = `<script data-i18n-fallback-handler="i18n-fallback-click-handler">${handler}</script>`
        expect(extractClickHandler(html)).toBe(handler)
        expect(extractClickHandler('<script>other</script>')).toBeNull()
    })

    it('编码形态失配时判定补丁不生效（非 ASCII 路径回归）', () => {
        // 链接为百分号编码、标记为原文 → 归一后应生效
        expect(handlerAppliesFullPageNavigation(handler, {
            metaContent: '/en-US/design/archive-§49-x',
            href: '/en-US/design/archive-%C2%A749-x',
        })).toBe(true)
        // 去掉归一的补丁（R2 blocker 形态）→ 应判定不生效
        const withoutNormalize = handler.replace('return decodeURI(value)', 'return value')
        expect(handlerAppliesFullPageNavigation(withoutNormalize, {
            metaContent: '/en-US/design/archive-§49-x',
            href: '/en-US/design/archive-%C2%A749-x',
        })).toBe(false)
    })

    it('无标记 / 已有 target 时不干预', () => {
        expect(handlerAppliesFullPageNavigation(handler, { metaContent: null, href: '/en-US/plan/roadmap' })).toBe(false)
        expect(handlerAppliesFullPageNavigation(handler, { metaContent: '/en-US/plan/roadmap', href: '/en-US/plan/roadmap#sec' })).toBe(true)
    })
})

describe('assertFallbackEntries', () => {
    let distDir

    beforeEach(async () => {
        distDir = await mkdtemp(path.join(tmpdir(), 'i18n-fallback-check-'))
    })

    afterEach(async () => {
        await rm(distDir, { recursive: true, force: true })
    })

    it('产物与语言切换标记一致时通过', async () => {
        await writeFixture(distDir, {
            '404.html': '',
            'index.html': rootHtml('/en-US/'),
            'plan/roadmap.html': rootHtml('/en-US/plan/roadmap', { fallbackTarget: '/en-US/plan/roadmap' }),
            'guide/quick-start.html': rootHtml('/en-US/guide/quick-start'),
            'en-US/index.html': translatedHtml,
            'en-US/plan/roadmap.html': fallbackHtmlFor('/plan/roadmap'),
            'en-US/guide/quick-start.html': translatedHtml,
        })
        const result = await assertFallbackEntries({
            distDir,
            untranslatedSamples: ['plan/roadmap.html'],
            translatedSamples: ['guide/quick-start.html', 'index.html'],
        })
        expect(result.failures).toEqual([])
        expect(result.rootPages).toEqual(['guide/quick-start.html', 'index.html', 'plan/roadmap.html'])
    })

    it('未翻译页缺少 en 目标时失败', async () => {
        await writeFixture(distDir, {
            'index.html': rootHtml('/en-US/'),
            'plan/roadmap.html': rootHtml('/en-US/plan/roadmap', { fallbackTarget: '/en-US/plan/roadmap' }),
            'guide/quick-start.html': rootHtml('/en-US/guide/quick-start'),
            'en-US/index.html': translatedHtml,
            'en-US/guide/quick-start.html': translatedHtml,
        })
        const { failures } = await assertFallbackEntries({ distDir, ...MINIMAL_SAMPLES })
        expect(failures).toEqual(['缺少语言切换目标：/en-US/plan/roadmap'])
    })

    it('未翻译页缺少语言切换目标标记时失败（会命中客户端 404）', async () => {
        await writeFixture(distDir, {
            'index.html': rootHtml('/en-US/'),
            'plan/roadmap.html': rootHtml('/en-US/plan/roadmap'),
            'guide/quick-start.html': rootHtml('/en-US/guide/quick-start'),
            'en-US/index.html': translatedHtml,
            'en-US/plan/roadmap.html': fallbackHtmlFor('/plan/roadmap'),
            'en-US/guide/quick-start.html': translatedHtml,
        })
        const { failures } = await assertFallbackEntries({ distDir, ...MINIMAL_SAMPLES })
        expect(failures).toEqual([
            '未翻译页语言切换标记与链接不一致（会命中客户端 404）：plan/roadmap.html → /en-US/plan/roadmap',
            '未翻译页语言切换补丁未生效（会命中客户端 404）：plan/roadmap.html → /en-US/plan/roadmap',
        ])
    })

    it('已翻译页被注入目标标记时失败（站内导航能力回退）', async () => {
        await writeFixture(distDir, {
            'index.html': rootHtml('/en-US/'),
            'plan/roadmap.html': rootHtml('/en-US/plan/roadmap', { fallbackTarget: '/en-US/plan/roadmap' }),
            'guide/quick-start.html': rootHtml('/en-US/guide/quick-start', { fallbackTarget: '/en-US/guide/quick-start' }),
            'en-US/index.html': translatedHtml,
            'en-US/plan/roadmap.html': fallbackHtmlFor('/plan/roadmap'),
            'en-US/guide/quick-start.html': translatedHtml,
        })
        const { failures } = await assertFallbackEntries({ distDir, ...MINIMAL_SAMPLES })
        expect(failures).toEqual([
            '已翻译页被注入语言切换目标标记（站内导航能力回退）：guide/quick-start.html → /en-US/guide/quick-start',
            '已翻译页被补丁改为整页导航（站内导航能力回退）：guide/quick-start.html → /en-US/guide/quick-start',
        ])
    })

    it('非 ASCII 路径：链接为百分号编码、标记为原文时通过（编码归一）', async () => {
        const urlPath = '/design/governance/archive-§49-x'
        await writeFixture(distDir, {
            'index.html': rootHtml('/en-US/'),
            'design/governance/archive-§49-x.html': rootHtml(encodeURI(`/en-US${urlPath}`), { fallbackTarget: `/en-US${urlPath}` }),
            'guide/quick-start.html': rootHtml('/en-US/guide/quick-start'),
            'en-US/index.html': translatedHtml,
            'en-US/design/governance/archive-§49-x.html': fallbackHtmlFor(urlPath),
            'en-US/guide/quick-start.html': translatedHtml,
        })
        const { failures } = await assertFallbackEntries({
            distDir,
            untranslatedSamples: ['design/governance/archive-§49-x.html'],
            translatedSamples: ['guide/quick-start.html'],
        })
        expect(failures).toEqual([])
    })

    it('标记与语言菜单链接指向不同路径时失败（编码/路径失配）', async () => {
        await writeFixture(distDir, {
            'index.html': rootHtml('/en-US/'),
            'plan/roadmap.html': rootHtml('/en-US/plan/roadmap-other', { fallbackTarget: '/en-US/plan/roadmap' }),
            'guide/quick-start.html': rootHtml('/en-US/guide/quick-start'),
            'en-US/index.html': translatedHtml,
            'en-US/plan/roadmap.html': fallbackHtmlFor('/plan/roadmap'),
            'en-US/guide/quick-start.html': translatedHtml,
        })
        const { failures } = await assertFallbackEntries({ distDir, ...MINIMAL_SAMPLES })
        expect(failures).toEqual([
            '未翻译页语言切换标记与链接不一致（会命中客户端 404）：plan/roadmap.html → /en-US/plan/roadmap',
            '未翻译页语言切换补丁未生效（会命中客户端 404）：plan/roadmap.html → /en-US/plan/roadmap',
        ])
    })

    it('缺少语言切换点击补丁时失败', async () => {
        await writeFixture(distDir, {
            'index.html': rootHtml('/en-US/', { clickHandler: false }),
            'plan/roadmap.html': rootHtml('/en-US/plan/roadmap', { fallbackTarget: '/en-US/plan/roadmap' }),
            'guide/quick-start.html': rootHtml('/en-US/guide/quick-start'),
            'en-US/index.html': translatedHtml,
            'en-US/plan/roadmap.html': fallbackHtmlFor('/plan/roadmap'),
            'en-US/guide/quick-start.html': translatedHtml,
        })
        const { failures } = await assertFallbackEntries({ distDir, ...MINIMAL_SAMPLES })
        expect(failures).toEqual(['缺少语言切换点击补丁：index.html'])
    })

    it('en 页面缺少根 locale 对应页时失败（反向 404）', async () => {
        await writeFixture(distDir, {
            'index.html': rootHtml('/en-US/'),
            'plan/roadmap.html': rootHtml('/en-US/plan/roadmap', { fallbackTarget: '/en-US/plan/roadmap' }),
            'guide/quick-start.html': rootHtml('/en-US/guide/quick-start'),
            'en-US/index.html': translatedHtml,
            'en-US/plan/roadmap.html': fallbackHtmlFor('/plan/roadmap'),
            'en-US/guide/quick-start.html': translatedHtml,
            'en-US/plan/extra.html': translatedHtml,
        })
        const { failures } = await assertFallbackEntries({ distDir, ...MINIMAL_SAMPLES })
        expect(failures).toEqual(['en 页面缺少根 locale 对应页：/en-US/plan/extra.html'])
    })

    it('未翻译页目标不是兜底入口页时失败', async () => {
        await writeFixture(distDir, {
            'index.html': rootHtml('/en-US/'),
            'plan/roadmap.html': rootHtml('/en-US/plan/roadmap'),
            'guide/quick-start.html': rootHtml('/en-US/guide/quick-start'),
            'en-US/index.html': translatedHtml,
            'en-US/plan/roadmap.html': translatedHtml,
            'en-US/guide/quick-start.html': translatedHtml,
        })
        const { failures } = await assertFallbackEntries({ distDir, ...MINIMAL_SAMPLES })
        expect(failures).toEqual(['未翻译页目标不是兜底入口页：/en-US/plan/roadmap'])
    })

    it('已翻译页被兜底入口页覆盖时失败', async () => {
        await writeFixture(distDir, {
            'index.html': rootHtml('/en-US/'),
            'plan/roadmap.html': rootHtml('/en-US/plan/roadmap', { fallbackTarget: '/en-US/plan/roadmap' }),
            'guide/quick-start.html': rootHtml('/en-US/guide/quick-start'),
            'en-US/index.html': translatedHtml,
            'en-US/plan/roadmap.html': fallbackHtmlFor('/plan/roadmap'),
            'en-US/guide/quick-start.html': fallbackHtmlFor('/guide/quick-start'),
        })
        const { failures } = await assertFallbackEntries({ distDir, ...MINIMAL_SAMPLES })
        expect(failures).toEqual([
            '未翻译页语言切换标记与链接不一致（会命中客户端 404）：guide/quick-start.html → /en-US/guide/quick-start',
            '未翻译页语言切换补丁未生效（会命中客户端 404）：guide/quick-start.html → /en-US/guide/quick-start',
            '已翻译页被兜底入口页覆盖：/en-US/guide/quick-start',
        ])
    })

    it('缺少构建产物时抛错', async () => {
        await expect(assertFallbackEntries({ distDir })).rejects.toThrow('未找到构建产物')
    })
})

describe('main', () => {
    it('通过时返回 0，失败时返回 1', async () => {
        const distDir = await mkdtemp(path.join(tmpdir(), 'i18n-fallback-check-'))
        try {
            await writeDefaultSampleFixture(distDir)
            expect(await main([`--dist=${distDir}`])).toBe(0)

            // 制造缺口：移除一个未翻译页的兜底入口页
            await rm(path.join(distDir, 'en-US', UNTRANSLATED_SAMPLES[0]), { force: true })
            expect(await main([`--dist=${distDir}`])).toBe(1)
        } finally {
            await rm(distDir, { recursive: true, force: true })
            process.exitCode = 0
        }
    })
})
