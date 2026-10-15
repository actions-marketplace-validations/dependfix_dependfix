import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
    CLICK_HANDLER_MARKER,
    collectFallbackPaths,
    EN_LOCALE_PREFIX,
    enTargetOf,
    FALLBACK_MARKER,
    FALLBACK_TARGET_META,
    fallbackFileOf,
    fallbackPathsOf,
    fallbackTargetOf,
    injectFallbackTargetMeta,
    LANGUAGE_SWITCH_CLICK_HANDLER,
    renderFallbackHtml,
    toUrlPath,
    writeFallbackEntries,
} from './i18n-fallback.mjs'

describe('toUrlPath', () => {
    it('把页面路径转成 cleanUrls 口径的 URL 路径', () => {
        expect(toUrlPath('plan/roadmap.md')).toBe('/plan/roadmap')
        expect(toUrlPath('index.md')).toBe('/')
        expect(toUrlPath('design/modules/index.md')).toBe('/design/modules/')
        expect(toUrlPath('en-US/index.md')).toBe('/en-US/')
    })
})

describe('collectFallbackPaths', () => {
    it('排除已有 en 译文的页面，保留未翻译页（含 index 归一）', () => {
        const pages = [
            'index.md',
            'plan/roadmap.md',
            'guide/quick-start.md',
            'design/modules/index.md',
            'i18n/en-US/index.md',
            'i18n/en-US/guide/quick-start.md',
        ]
        const rewrites = {
            'i18n/en-US/index.md': 'en-US/index.md',
            'i18n/en-US/guide/quick-start.md': 'en-US/guide/quick-start.md',
        }
        expect(collectFallbackPaths({ pages, rewrites })).toEqual([
            '/design/modules/',
            '/plan/roadmap',
        ])
    })

    it('缺少 rewrites 映射时按源路径判断（identity 改写）', () => {
        const pages = ['index.md', 'plan/todo.md', 'en-US/index.md']
        expect(collectFallbackPaths({ pages })).toEqual(['/plan/todo'])
    })
})

describe('fallbackFileOf', () => {
    it('目录 URL 落 index.html，其余落 <path>.html', () => {
        expect(fallbackFileOf('/plan/roadmap')).toBe('en-US/plan/roadmap.html')
        expect(fallbackFileOf('/design/modules/')).toBe('en-US/design/modules/index.html')
    })
})

describe('renderFallbackHtml', () => {
    it('含兜底标记 / noindex / 中文原文入口 / 英文首页入口', () => {
        const html = renderFallbackHtml('/plan/roadmap')
        expect(html).toContain(FALLBACK_MARKER)
        expect(html).toContain('name="robots" content="noindex"')
        expect(html).toContain('href="/plan/roadmap"')
        expect(html).toContain(`href="${EN_LOCALE_PREFIX}/"`)
        expect(html).toContain('<html lang="en">')
    })

    it('对 URL 路径做 HTML 转义', () => {
        const html = renderFallbackHtml('/plan/a"b<c')
        expect(html).toContain('href="/plan/a&quot;b&lt;c"')
        expect(html).not.toContain('href="/plan/a"b<c"')
    })
})

describe('enTargetOf', () => {
    it('给出语言菜单指向的 en 目标', () => {
        expect(enTargetOf('plan/roadmap.md')).toBe('/en-US/plan/roadmap')
        expect(enTargetOf('index.md')).toBe('/en-US/')
        expect(enTargetOf('design/modules/index.md')).toBe('/en-US/design/modules/')
    })
})

describe('fallbackPathsOf', () => {
    it('同一 siteConfig 复用缓存结果', () => {
        const siteConfig = { pages: ['index.md', 'plan/todo.md', 'en-US/index.md'], rewrites: { map: { 'en-US/index.md': 'en-US/index.md' } } }
        const first = fallbackPathsOf(siteConfig)
        expect(first).toEqual(['/plan/todo'])
        expect(fallbackPathsOf(siteConfig)).toBe(first)
    })
})

describe('fallbackTargetOf', () => {
    const siteConfig = {
        pages: ['index.md', 'plan/roadmap.md', 'design/governance/archive-§49-x.md', 'i18n/en-US/index.md'],
        rewrites: { map: { 'i18n/en-US/index.md': 'en-US/index.md' } },
    }

    it('未翻译页返回 en 目标；已翻译页与 en 页面返回 null', () => {
        expect(fallbackTargetOf('plan/roadmap.md', siteConfig)).toBe('/en-US/plan/roadmap')
        expect(fallbackTargetOf('design/governance/archive-§49-x.md', siteConfig)).toBe('/en-US/design/governance/archive-§49-x')
        expect(fallbackTargetOf('index.md', siteConfig)).toBeNull()
        expect(fallbackTargetOf('i18n/en-US/index.md', siteConfig)).toBeNull()
    })
})

describe('injectFallbackTargetMeta', () => {
    const siteConfig = {
        pages: ['index.md', 'plan/roadmap.md', 'i18n/en-US/index.md'],
        rewrites: { map: { 'i18n/en-US/index.md': 'en-US/index.md' } },
    }

    it('未翻译页注入 meta head 并保留既有 frontmatter head', () => {
        const result = injectFallbackTargetMeta(
            { relativePath: 'plan/roadmap.md', frontmatter: { head: [['meta', { name: 'x', content: 'y' }]] } },
            { siteConfig },
        )
        expect(result.frontmatter.head).toContainEqual([
            'meta',
            { name: FALLBACK_TARGET_META, content: '/en-US/plan/roadmap' },
        ])
        expect(result.frontmatter.head).toHaveLength(2)
    })

    it('已翻译页返回 undefined（不注入）', () => {
        expect(injectFallbackTargetMeta({ relativePath: 'index.md', frontmatter: {} }, { siteConfig })).toBeUndefined()
    })
})

describe('LANGUAGE_SWITCH_CLICK_HANDLER', () => {
    it('含标记、捕获阶段注册、只对当前页兜底目标补 target', () => {
        expect(LANGUAGE_SWITCH_CLICK_HANDLER).toContain(CLICK_HANDLER_MARKER)
        expect(LANGUAGE_SWITCH_CLICK_HANDLER).toContain(FALLBACK_TARGET_META)
        expect(LANGUAGE_SWITCH_CLICK_HANDLER).toContain('}, true);')
        expect(LANGUAGE_SWITCH_CLICK_HANDLER).toContain('setAttribute(\'target\', \'_self\')')
        expect(LANGUAGE_SWITCH_CLICK_HANDLER).toContain('link.hasAttribute(\'target\')')
        // 非 ASCII 路径：链接 href 为百分号编码、标记为原文 → 必须两侧归一后比较
        expect(LANGUAGE_SWITCH_CLICK_HANDLER).toContain('decodeURI')
        expect(LANGUAGE_SWITCH_CLICK_HANDLER).toContain('normalize(link.getAttribute(\'href\').split(\'#\')[0])')
    })
})

describe('writeFallbackEntries', () => {
    let outDir

    beforeEach(async () => {
        outDir = await mkdtemp(join(tmpdir(), 'i18n-fallback-'))
    })

    afterEach(async () => {
        await rm(outDir, { recursive: true, force: true })
    })

    it('按页面清单写入入口页并跳过已有译文页', async () => {
        const messages = []
        await writeFallbackEntries({
            outDir,
            pages: ['plan/roadmap.md', 'design/modules/index.md', 'i18n/en-US/index.md'],
            rewrites: { map: { 'i18n/en-US/index.md': 'en-US/index.md' } },
            logger: { info: (message) => messages.push(message) },
        })
        const roadmap = await readFile(join(outDir, 'en-US/plan/roadmap.html'), 'utf8')
        const modulesIndex = await readFile(join(outDir, 'en-US/design/modules/index.html'), 'utf8')
        expect(roadmap).toContain(FALLBACK_MARKER)
        expect(modulesIndex).toContain(FALLBACK_MARKER)
        await expect(readFile(join(outDir, 'en-US/index.html'), 'utf8')).rejects.toThrow()
        expect(messages.join(' ')).toContain('2')
    })
})
