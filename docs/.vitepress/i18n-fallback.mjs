// 语言切换兜底入口页（构建期生成）
//
// 背景：VitePress 语言菜单按「当前路径 → 目标 locale 同路径」映射（`useLangs({ correspondingLink: true })`），
// 未翻译页（`plan/roadmap` / `standards/*` / `design/modules/*` 等）会生成不存在的 `/en-US/<同路径>` → 404。
// 依据 [i18n 规范 §2.1 `source-only` 分层](../standards/i18n.md)：此类页面「保留 locale URL 的入口页」，
// 且「必须显式提供中文原文入口」。本模块在构建期（`buildEnd`）为每个无 en 译文的页面生成该入口页。
//
// 边界：只作用于构建产物（`vitepress dev` 不生成）；入口页带 `noindex` 且构建期生成（不进入站内搜索索引）。

/** 兜底入口页标记（断言脚本据此区分「兜底入口页」与「真实译文页」）。 */
export const FALLBACK_MARKER = '<!-- i18n-fallback-entry -->'

/** en-US 的对外 URL 前缀。 */
export const EN_LOCALE_PREFIX = '/en-US'

/** 未翻译页的语言切换目标标记（`<meta>`；由 `transformPageData` 注入 frontmatter head，SPA 导航时随页面更新）。 */
export const FALLBACK_TARGET_META = 'i18n-fallback-target'

/** 语言切换整页导航补丁的标记（断言脚本据此确认脚本已注入）。 */
export const CLICK_HANDLER_MARKER = 'i18n-fallback-click-handler'

/**
 * 语言切换整页导航补丁（注入到站点 `<head>`）。
 *
 * 兜底入口页由 `buildEnd` 直接写入产物，不在 VitePress 客户端路由表（`hashmap.json`）中；
 * 而路由对无 `target` 属性的站内链接会 `preventDefault()` 后走 `go()` → 命中 SPA `NotFound`。
 * 该补丁在捕获阶段先于路由处理器运行，对「指向本页兜底入口页」的语言菜单链接补 `target="_self"`，
 * 使浏览器整页导航到入口页；已翻译页不注入标记，语言菜单保持站内导航。
 */
export const LANGUAGE_SWITCH_CLICK_HANDLER = `/* ${CLICK_HANDLER_MARKER} */
(function () {
    var metaName = '${FALLBACK_TARGET_META}';
    // 链接 href 由 VitePress 渲染为百分号编码（如 \u00a7 → %C2%A7），标记为原文 → 两侧统一解码后比较
    function normalize(value) {
        try {
            return decodeURI(value);
        } catch (error) {
            return value;
        }
    }
    function currentTarget() {
        var meta = document.querySelector('meta[name="' + metaName + '"]');
        return meta ? normalize(meta.getAttribute('content')) : null;
    }
    window.addEventListener('click', function (event) {
        var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
        if (!link || link.hasAttribute('target') || link.closest('.vp-raw')) return;
        var target = currentTarget();
        if (!target) return;
        if (normalize(link.getAttribute('href').split('#')[0]) === target) link.setAttribute('target', '_self');
    }, true);
})();
`

/**
 * 取页面的语言切换兜底目标（无兜底入口页时为 `null`）。
 * @param {string} pageRelativePath 页面源路径（相对 `srcDir`，含扩展名）
 * @param {{ pages: string[], rewrites?: { map?: Record<string, string | undefined> } }} siteConfig VitePress 站点配置
 * @returns {string | null} 形如 `/en-US/plan/roadmap`；已翻译页返回 `null`
 */
export function fallbackTargetOf(pageRelativePath, siteConfig) {
    if (pageRelativePath.startsWith('i18n/')) {
        return null
    }
    if (!fallbackPathsOf(siteConfig).includes(toUrlPath(pageRelativePath))) {
        return null
    }
    return enTargetOf(pageRelativePath)
}

/**
 * 为未翻译页注入语言切换目标标记（`transformPageData` 钩子入口）。
 * @param {import('vitepress').PageData} pageData 页面数据
 * @param {{ siteConfig: { pages: string[], rewrites?: { map?: Record<string, string | undefined> } } }} ctx 钩子上下文
 * @returns {Partial<import('vitepress').PageData> | undefined} 需要合并的页面数据
 */
export function injectFallbackTargetMeta(pageData, ctx) {
    if (process.env.NODE_ENV === 'development') {
        return undefined // dev 不生成入口页：不注入标记，避免整页导航落到 dev 404
    }
    const target = fallbackTargetOf(pageData.relativePath, ctx.siteConfig)
    if (!target) {
        return undefined
    }
    return {
        frontmatter: {
            ...pageData.frontmatter,
            head: [
                ...(pageData.frontmatter.head ?? []),
                ['meta', { name: FALLBACK_TARGET_META, content: target }],
            ],
        },
    }
}

/**
 * 根 locale 页面路径 → 语言菜单指向的 en-US 目标 URL。
 * @param {string} pagePath 源页面路径（相对 `srcDir`，含扩展名）
 * @returns {string} 形如 `/en-US/plan/roadmap` 或 `/en-US/design/modules/`
 */
export function enTargetOf(pagePath) {
    return `${EN_LOCALE_PREFIX}${toUrlPath(pagePath)}`
}

/**
 * HTML 文本转义（文件名进入生成 HTML 时的兜底防护）。
 * @param {string} value 原始文本
 * @returns {string} 转义后文本
 */
export function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
}

/** 兜底清单缓存（同一构建内按 `siteConfig` 记忆，`transformPageData` / `buildEnd` 多次调用时避免重复计算）。 */
const fallbackCache = new WeakMap()

/**
 * 取某次构建的兜底入口页清单（带缓存）。
 * @param {{ pages: string[], rewrites?: { map?: Record<string, string | undefined> } }} siteConfig VitePress 站点配置
 * @returns {string[]} 需要生成兜底入口页的根 locale URL 路径
 */
export function fallbackPathsOf(siteConfig) {
    if (!fallbackCache.has(siteConfig)) {
        fallbackCache.set(siteConfig, collectFallbackPaths({
            pages: siteConfig.pages,
            rewrites: siteConfig.rewrites?.map,
        }))
    }
    return fallbackCache.get(siteConfig)
}

/**
 * 源页面路径（相对 `srcDir`，含扩展名）→ 对外 URL 路径（`cleanUrls` 口径，`index` 归一为目录 URL）。
 * @param {string} pagePath 源页面路径
 * @returns {string} 形如 `/plan/roadmap` 或 `/design/modules/`
 */
export function toUrlPath(pagePath) {
    const withoutExtension = pagePath.replace(/\.md$/, '')
    const normalized = withoutExtension.replace(/(^|\/)index$/, '$1')
    return `/${normalized.replace(/^\/+/, '')}`
}

/**
 * 计算需要生成兜底入口页的根 locale URL 路径（无 en 译文的页面）。
 * @param {{ pages: string[], rewrites?: Record<string, string | undefined> }} input 构建期页面清单与 rewrites 映射
 * @returns {string[]} 升序排列的根 locale URL 路径
 */
export function collectFallbackPaths({ pages, rewrites = {} }) {
    const translatedPaths = new Set()
    const rootPaths = []
    for (const page of pages) {
        const outputPath = rewrites[page] ?? page
        const urlPath = toUrlPath(outputPath)
        if (urlPath === EN_LOCALE_PREFIX || urlPath.startsWith(`${EN_LOCALE_PREFIX}/`)) {
            translatedPaths.add(urlPath.replace(EN_LOCALE_PREFIX, '') || '/')
        } else {
            rootPaths.push(urlPath)
        }
    }
    return rootPaths.filter((urlPath) => !translatedPaths.has(urlPath)).sort()
}

/**
 * URL 路径 → 兜底入口页的输出文件相对路径（`cleanUrls` 口径：目录 URL 落 `index.html`）。
 * @param {string} urlPath 根 locale URL 路径
 * @returns {string} 相对 `outDir` 的文件路径
 */
export function fallbackFileOf(urlPath) {
    const relative = urlPath.replace(/^\//, '')
    return relative.endsWith('/') || relative === ''
        ? `${EN_LOCALE_PREFIX.replace(/^\//, '')}/${relative}index.html`
        : `${EN_LOCALE_PREFIX.replace(/^\//, '')}/${relative}.html`
}

/**
 * 渲染兜底入口页（英文提示 + 中文原文入口 + 英文首页入口 + `noindex`）。
 * @param {string} urlPath 根 locale URL 路径（中文原文位置）
 * @returns {string} 完整 HTML
 */
export function renderFallbackHtml(urlPath) {
    const href = escapeHtml(urlPath)
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Not translated yet | dependfix</title>
${FALLBACK_MARKER}
<style>
:root { color-scheme: light dark; }
body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; line-height: 1.7; }
main { max-width: 34rem; padding: 2rem; }
h1 { font-size: 1.4rem; margin: 0 0 1rem; }
p { margin: 0 0 1rem; }
ul { margin: 0; padding-left: 1.2rem; }
a { color: var(--vp-c-brand-1, #3451b2); }
@media (prefers-color-scheme: dark) { a { color: #a8b1ff; } }
</style>
</head>
<body>
<main>
<h1>This page isn’t available in English yet</h1>
<p>The Chinese version is the source of truth for this page. English translation is tracked separately and this entry page exists so the language switch never lands on a missing page.</p>
<ul>
<li><a href="${href}">View this page in Chinese</a></li>
<li><a href="${EN_LOCALE_PREFIX}/">Back to the English home page</a></li>
</ul>
</main>
</body>
</html>
`
}

/**
 * 在构建产物中写入全部兜底入口页（`buildEnd` 钩子入口）。
 * @param {{ outDir: string, pages: string[], rewrites?: { map?: Record<string, string | undefined> }, logger?: { info?: (message: string) => void } }} siteConfig VitePress 站点配置
 * @returns {Promise<void>}
 */
export async function writeFallbackEntries(siteConfig) {
    const { mkdir, writeFile } = await import('node:fs/promises')
    const { dirname, join } = await import('node:path')
    const urlPaths = fallbackPathsOf(siteConfig)
    for (const urlPath of urlPaths) {
        const filePath = join(siteConfig.outDir, fallbackFileOf(urlPath))
        await mkdir(dirname(filePath), { recursive: true })
        await writeFile(filePath, renderFallbackHtml(urlPath), 'utf8')
    }
    siteConfig.logger?.info?.(`i18n fallback entries generated: ${urlPaths.length}`)
}
