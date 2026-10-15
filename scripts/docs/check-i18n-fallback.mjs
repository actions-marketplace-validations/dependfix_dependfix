// 构建产物断言：文档站未翻译页的语言切换目标必须可用
//
// 依据 [i18n 规范 §2.1](../docs/standards/i18n.md)（`source-only` 页面「保留 locale URL 的入口页」）：
// 语言菜单按「当前路径 → 目标 locale 同路径」映射，未翻译页会落到 `/en-US/<同路径>`；
// 该目标必须存在（真实译文页或构建期生成的兜底入口页），不得落到 404。
//
// 断言面：① 全量——每个根 locale 构建页都必须在 `en-US/` 下有对应产物；② 抽样——未翻译页产物含兜底标记、
// 已翻译页产物不含兜底标记（防「兜底页覆盖真实译文页」回归）。

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { CLICK_HANDLER_MARKER, EN_LOCALE_PREFIX, FALLBACK_MARKER, FALLBACK_TARGET_META } from '../../docs/.vitepress/i18n-fallback.mjs'
import { isDirectExecution } from '../shared/cli.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..', '..')
const defaultDistDir = path.join(projectRoot, 'docs', '.vitepress', 'dist')
const enPrefix = 'en-US/'

/** 抽样：无 en 译文的页面（必须命中兜底入口页）。 */
export const UNTRANSLATED_SAMPLES = [
    'plan/roadmap.html',
    'plan/todo.html',
    'plan/backlog.html',
    'standards/development.html',
    'design/modules/index.html',
    'design/modules/dependabot-fetcher.html',
]

/** 抽样：已有 en 译文的页面（必须命中真实译文页，不得被兜底页覆盖）。 */
export const TRANSLATED_SAMPLES = [
    'index.html',
    'guide/quick-start.html',
    'guide/tech-stack.html',
    'standards/i18n.html',
    'design/governance/architecture.html',
]

/**
 * 判断路径是否存在。
 * @param {string} targetPath 目标路径
 * @returns {Promise<boolean>} 是否存在
 */
export async function pathExists(targetPath) {
    try {
        await readFile(targetPath)
        return true
    } catch {
        return false
    }
}

/**
 * 收集构建产物中的 HTML 相对路径（posix 分隔符）。
 * @param {string} baseDir 起始目录
 * @param {string} [currentDir] 当前相对目录
 * @returns {Promise<string[]>} 相对路径清单
 */
export async function walkHtmlFiles(baseDir, currentDir = '') {
    const targetDir = path.join(baseDir, currentDir)
    const entries = await readdir(targetDir, { withFileTypes: true })
    const files = []

    for (const entry of entries) {
        const relativePath = currentDir ? `${currentDir}/${entry.name}` : entry.name
        if (entry.isDirectory()) {
            files.push(...await walkHtmlFiles(baseDir, relativePath))
        } else if (entry.name.endsWith('.html')) {
            files.push(relativePath)
        }
    }

    return files.sort()
}

/**
 * 从产物 HTML 中提取语言切换点击补丁脚本源码。
 * @param {string} html 页面构建 HTML
 * @returns {string | null} 脚本源码（未注入时为 `null`）
 */
export function extractClickHandler(html) {
    const match = html.match(/<script[^>]*data-i18n-fallback-handler="[^"]*"[^>]*>([\s\S]*?)<\/script>/)
    return match ? match[1] : null
}

/**
 * 在最小 DOM 桩中执行产物内的补丁脚本，判定「该链接是否会被补 `target="_self"`」。
 *
 * 这是运行期真实条件的复现：链接 href 由 VitePress 渲染为百分号编码、标记为原文，
 * 补丁必须在两者间做编码归一后才生效（否则非 ASCII 路径仍落客户端 404）。
 * @param {string} handlerSource 补丁脚本源码（来自产物）
 * @param {{ metaContent: string | null, href: string }} input 页面标记与语言菜单链接
 * @returns {boolean} 补丁是否会对该链接补 `target="_self"`
 */
export function handlerAppliesFullPageNavigation(handlerSource, { metaContent, href }) {
    const listeners = []
    const meta = metaContent === null
        ? null
        : { getAttribute: (name) => (name === 'content' ? metaContent : null) }
    const attributes = {}
    const link = {
        getAttribute(name) {
            return name === 'href' ? href : (attributes[name] ?? null)
        },
        setAttribute(name, value) {
            attributes[name] = value
        },
        hasAttribute(name) {
            return Object.hasOwn(attributes, name)
        },
        closest() {
            return null
        },
    }
    const sandbox = {
        document: { querySelector: (selector) => (String(selector).includes('i18n-fallback-target') ? meta : null) },
        window: { addEventListener: (type, handler, capture) => listeners.push({ type, handler, capture }) },
    }
    runInNewContext(handlerSource, sandbox)
    const clickListener = listeners.find((listener) => listener.type === 'click')
    if (!clickListener) {
        return false
    }
    clickListener.handler({ target: { closest: () => link } })
    return attributes.target === '_self'
}

/**
 * URL 编码归一（链接 href 为百分号编码，标记为原文）。
 * @param {string} value 原始值
 * @returns {string} 解码后的值（非法编码时原样返回）
 */
export function decodeUrl(value) {
    try {
        return decodeURI(value)
    } catch {
        return value
    }
}

/**
 * 构建页相对路径 → 对外 URL 路径（`cleanUrls` 口径）。
 * @param {string} page 构建产物相对路径（含 `.html`）
 * @returns {string} URL 路径
 */
export function urlPathOfBuiltPage(page) {
    const withoutExtension = page.replace(/\.html$/, '')
    if (withoutExtension === 'index') {
        return '/'
    }
    return `/${withoutExtension.replace(/\/index$/, '/')}`
}

/**
 * 断言语言切换目标可用（产物存在性 + 语言菜单行为一致性 + 反向对应）。
 * @param {{ distDir?: string, untranslatedSamples?: string[], translatedSamples?: string[] }} [options] 选项
 * @returns {Promise<{ distDir: string, rootPages: string[], failures: string[] }>} 断言结果
 */
export async function assertFallbackEntries(options = {}) {
    const {
        distDir = defaultDistDir,
        untranslatedSamples = UNTRANSLATED_SAMPLES,
        translatedSamples = TRANSLATED_SAMPLES,
    } = options
    const failures = []

    if (!await pathExists(path.join(distDir, 'index.html'))) {
        throw new Error(`未找到构建产物：${distDir}（请先执行 pnpm run docs:build）`)
    }

    const builtPages = await walkHtmlFiles(distDir)
    const rootPages = builtPages.filter((page) => page !== '404.html' && !page.startsWith(enPrefix))
    const enPages = builtPages.filter((page) => page.startsWith(enPrefix))

    // ① 全量：每个根页面的语言切换目标必须存在，且「目标标记 + 点击补丁」与目标形态一致
    //    （兜底入口页不在客户端路由表中 → 需标记触发整页导航；真实译文页 → 不标记，保持站内导航）
    for (const page of rootPages) {
        const enPage = `${enPrefix}${page}`
        const enUrl = `${EN_LOCALE_PREFIX}${urlPathOfBuiltPage(page)}`
        if (!builtPages.includes(enPage)) {
            failures.push(`缺少语言切换目标：${enUrl}`)
            continue
        }
        const enContent = await readFile(path.join(distDir, enPage), 'utf8')
        const isFallback = enContent.includes(FALLBACK_MARKER)
        const html = await readFile(path.join(distDir, page), 'utf8')
        // 运行期真实条件：标记 content 与语言菜单链接 href（去 hash、编码归一后）必须一致
        const metaMatch = html.match(new RegExp(`<meta[^>]*name="${FALLBACK_TARGET_META}"[^>]*>`))
        const metaContent = metaMatch ? (metaMatch[0].match(/content="([^"]*)"/) ?? [])[1] ?? null : null
        const hasTargetMeta = metaContent !== null && decodeUrl(metaContent) === enUrl
        const hasMatchingHref = [...html.matchAll(/href="([^"]+)"/g)]
            .some(([, href]) => decodeUrl(href.split('#')[0]) === enUrl)
        // 内联脚本注释会被压缩移除 → 用 data 属性标记判定
        const hasClickHandler = html.includes(`data-i18n-fallback-handler="${CLICK_HANDLER_MARKER}"`)
        const languageHref = (html.match(/href="(\/en-US\/[^"]*)"/) ?? [])[1] ?? null
        const handlerSource = hasClickHandler ? extractClickHandler(html) : null
        const handlerWorks = handlerSource !== null && languageHref !== null
            && handlerAppliesFullPageNavigation(handlerSource, { metaContent, href: languageHref })
        if (isFallback && (!hasTargetMeta || !hasMatchingHref)) {
            failures.push(`未翻译页语言切换标记与链接不一致（会命中客户端 404）：${page} → ${enUrl}`)
        }
        if (!isFallback && hasTargetMeta) {
            failures.push(`已翻译页被注入语言切换目标标记（站内导航能力回退）：${page} → ${enUrl}`)
        }
        if (!hasClickHandler) {
            failures.push(`缺少语言切换点击补丁：${page}`)
        }
        if (isFallback && hasClickHandler && !handlerWorks) {
            failures.push(`未翻译页语言切换补丁未生效（会命中客户端 404）：${page} → ${enUrl}`)
        }
        if (!isFallback && handlerWorks) {
            failures.push(`已翻译页被补丁改为整页导航（站内导航能力回退）：${page} → ${enUrl}`)
        }
    }

    // ② 反向：每个 en 页面必须有根 locale 对应页（防 en-only 页产生反向 404）
    for (const page of enPages) {
        const rootPage = page.slice(enPrefix.length)
        if (!builtPages.includes(rootPage)) {
            failures.push(`en 页面缺少根 locale 对应页：/${page}`)
        }
    }

    // ③ 抽样：未翻译页目标必须是兜底入口页（含标记 / noindex / 中文原文入口），已翻译页不得被覆盖
    for (const page of untranslatedSamples) {
        if (!rootPages.includes(page)) {
            failures.push(`抽样页不在构建产物中：/${page.replace(/\.html$/, '')}`)
            continue
        }
        const targetPath = path.join(distDir, enPrefix, page)
        if (!await pathExists(targetPath)) {
            // 目标缺失已由全量检查报出（避免同一缺口重复计数）
            continue
        }
        const content = await readFile(targetPath, 'utf8')
        const urlPath = urlPathOfBuiltPage(page)
        const hasZhEntry = [`href="${urlPath}"`, `href="${encodeURI(urlPath)}"`]
            .some((href) => content.includes(href))
        if (!content.includes(FALLBACK_MARKER)
            || !content.includes('name="robots" content="noindex"')
            || !hasZhEntry) {
            failures.push(`未翻译页目标不是兜底入口页：${EN_LOCALE_PREFIX}${urlPath}`)
        }
    }

    for (const page of translatedSamples) {
        if (!rootPages.includes(page)) {
            failures.push(`抽样页不在构建产物中：/${page.replace(/\.html$/, '')}`)
            continue
        }
        const targetPath = path.join(distDir, enPrefix, page)
        if (!await pathExists(targetPath)) {
            // 目标缺失已由全量检查报出（避免同一缺口重复计数）
            continue
        }
        const content = await readFile(targetPath, 'utf8')
        if (content.includes(FALLBACK_MARKER)) {
            failures.push(`已翻译页被兜底入口页覆盖：${EN_LOCALE_PREFIX}${urlPathOfBuiltPage(page)}`)
        }
    }

    return { distDir, rootPages, failures }
}

/**
 * CLI 入口。
 * @param {string[]} [argv] 参数（支持 `--dist=<dir>`）
 * @returns {Promise<number>} 退出码
 */
export async function main(argv = process.argv.slice(2)) {
    const distArg = argv.find((arg) => arg.startsWith('--dist='))
    const distDir = distArg ? path.resolve(projectRoot, distArg.slice('--dist='.length)) : defaultDistDir
    const { rootPages, failures } = await assertFallbackEntries({ distDir })

    if (failures.length > 0) {
        console.error(`i18n fallback check failed: ${failures.length} issue(s) in ${distDir}`)
        for (const failure of failures) {
            console.error(`- ${failure}`)
        }
        process.exitCode = 1
        return 1
    }

    console.log(`i18n fallback check passed: ${rootPages.length} root page(s) all have a usable /en-US/ target`)
    return 0
}

if (isDirectExecution(import.meta.url)) {
    main().catch((error) => {
        console.error('i18n fallback check failed:', error)
        process.exitCode = 1
    })
}
