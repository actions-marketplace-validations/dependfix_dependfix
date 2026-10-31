/**
 * check-experience-landing：校验经验归档条目的「落点」字段非空（L1 脚本 / L2 检查点 / L3 规范条款）。
 *
 * 设计原则：
 * - 对治「只留条目、不留落点」反模式（[规范与经验管理体系重构设计 §3.3](../docs/design/governance/standards-experience-refactor.md)）。
 * - 判定粒度：`##` 条目下若存在**编号子条目**（`### 1. …` / `### 1、…`），逐个校验；
 *   无编号子条目的 `##`（含以 `### 教训` / `### 挂接治理检查点` 等纯结构小节组织的内容）
 *   整体作为一条校验——避免把结构小节误判为缺落点条目。
 * - 落点形态：`- **落点**：…`（显式）/ `- **沉淀**：…`，或 `### 挂接治理检查点` /
 *   `### 沉淀` / `### 落点` 段内至少一行非空内容。
 * - 占位符（如「（见对应规范条款）」）与**自指落点**（`本条…` / `同上` / `本分片…`
 *   且不含真实目标）均判为空，防止假通过。
 * - 纯函数 + CLI 入口守卫（`isDirectExecution`）：vitest import 时不执行顶层副作用。
 * - 错误格式 `path:line:问题` 与 check-docs / check-orphan-ids 一致。
 *
 * 已知边界：
 * - 共享尾部结构小节（`### 挂接治理检查点` 等出现在编号子条目之后）只归**最后一个**编号子条目；
 *   当前分片无该形态。
 * - 首个编号子条目之前的结构小节不参与校验（当前分片 0 出现）。
 * - 主文档 `experience-archive.md` 不在扫描面（仅分片）；条目回填主文档时需同步扩展扫描面。
 *
 * 用法：
 *   node scripts/check-experience-landing.mjs
 *   node scripts/check-experience-landing.mjs --json
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDirectExecution } from './shared/cli.mjs'

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const ARCHIVE_DIR = 'docs/design/governance'

/** 视为「空落点」的占位串（命中即判为空）。 */
export const PLACEHOLDER_RE = /^[（(]\s*见?对应?规范条款\s*[）)]?$|^[-—\s]*$/

/** 自指落点：未指向任何可执行落点的回指表述（含 `详见本条` / `参见上文` 等变体）。 */
export const SELF_LANDING_RE = /^(?:详见|参见|见)?(?:本条|本条目|本分片|上条|上文|同上|上述|前述|如上)/

/** 真实目标标记：出现任一即视为非自指（可与自指前缀共存）。 */
const TARGET_HINT_RE = /docs\/|\.md\b|\.mjs\b|scripts\/|#L\d+|§|检查点|矩阵|code-auditor|必查|L[123]\b/

/** 落点标记：显式 `**落点**：X` 或 `**沉淀**：X`。 */
const LANDING_LINE_RE = /^\s{0,4}[-*]\s*\*\*(落点|沉淀)\*\*[：:]\s*(.+)$/
/** 落点小节标题（段内任意非空行即可）。 */
const LANDING_SECTION_RE = /^#{3,4}\s*(挂接治理检查点|沉淀|落点)/
/** 编号子条目标题（`### 1. …` / `### 1、…`）。 */
const NUMBERED_SUBENTRY_RE = /^\d+[.、]/

/** 自指且不含真实目标 → 判为空。 */
export function isSelfOnlyLanding(text) {
    const value = text.trim()
    return SELF_LANDING_RE.test(value) && !TARGET_HINT_RE.test(value)
}

/**
 * 解析经验归档文本为「待校验条目」清单。
 * - `##` 下存在编号 `###` 子条目 → 子条目逐条校验；
 * - 否则 `##` 整体作为一条（其纯结构 `###` 小节归入本条）。
 * @param {string} text
 * @returns {Array<{heading: string, line: number, body: string[]}>}
 */
export function collectExperienceEntries(text) {
    const h2s = []
    let currentH2 = null
    let currentSub = null
    let lastNumbered = null
    text.split(/\r?\n/).forEach((line, index) => {
        if (line.startsWith('## ')) {
            currentH2 = { heading: line.slice(3).trim(), line: index + 1, body: [], subs: [] }
            h2s.push(currentH2)
            currentSub = null
            lastNumbered = null
            return
        }
        if (!currentH2) {
            return
        }
        if (line.startsWith('### ')) {
            const numbered = NUMBERED_SUBENTRY_RE.test(line.slice(4).trim())
            // 编号子条目之后的纯结构小节（教训 / 挂接治理检查点等）归入该子条目正文
            if (!numbered && lastNumbered) {
                currentSub = lastNumbered
                currentSub.body.push(line)
                currentH2.body.push(line)
                return
            }
            currentSub = {
                heading: line.slice(4).trim(),
                line: index + 1,
                body: [],
                numbered,
            }
            currentH2.subs.push(currentSub)
            currentH2.body.push(line)
            if (numbered) {
                lastNumbered = currentSub
            }
            return
        }
        currentH2.body.push(line)
        if (currentSub) {
            currentSub.body.push(line)
        }
    })
    return h2s.flatMap((h2) => {
        const numbered = h2.subs.filter((sub) => sub.numbered)
        return numbered.length > 0 ? numbered : [h2]
    })
}

/**
 * 在条目正文内查找非空落点。
 * @param {string[]} body
 * @returns {{ok: boolean, selfOnly: boolean}}
 */
function evaluateLanding(body) {
    let ok = false
    let selfOnly = false
    let inSection = false
    for (const line of body) {
        if (LANDING_SECTION_RE.test(line)) {
            inSection = true
            continue
        }
        if (/^#{2,4}\s/.test(line)) {
            inSection = false
            continue
        }
        const explicit = line.match(LANDING_LINE_RE)
        if (explicit) {
            inSection = false
            const value = explicit[2].trim()
            if (PLACEHOLDER_RE.test(value)) {
                continue
            }
            if (isSelfOnlyLanding(value)) {
                selfOnly = true
                continue
            }
            ok = true
            continue
        }
        if (inSection) {
            const value = line.trim().replace(/^[-*]\s*/, '')
            if (value === '' || PLACEHOLDER_RE.test(value)) {
                continue
            }
            if (isSelfOnlyLanding(value)) {
                selfOnly = true
                continue
            }
            ok = true
        }
    }
    return { ok, selfOnly }
}

/**
 * 校验单个分片文本，返回「缺落点」条目清单。
 * @param {string} text
 * @returns {Array<{heading: string, line: number, reason: string}>}
 */
export function checkShardText(text) {
    const missing = []
    for (const entry of collectExperienceEntries(text)) {
        const { ok, selfOnly } = evaluateLanding(entry.body)
        if (!ok) {
            missing.push({
                heading: entry.heading,
                line: entry.line,
                reason: selfOnly ? '落点自指（未指向可执行落点）' : '落点为空或缺失',
            })
        }
    }
    return missing
}

/** 扫描仓库内的经验归档分片。 */
export function checkExperienceLanding(root = REPO_ROOT) {
    const dir = join(root, ARCHIVE_DIR)
    const files = readdirSync(dir)
        .filter((f) => f.startsWith('experience-archive-') && f.endsWith('.md') && f !== 'experience-archive.md')
        .sort()
    const findings = []
    for (const file of files) {
        const rel = `${ARCHIVE_DIR}/${file}`
        const missing = checkShardText(readFileSync(join(dir, file), 'utf8'))
        for (const m of missing) {
            findings.push({ file: rel, ...m })
        }
    }
    return findings
}

if (isDirectExecution(import.meta.url)) {
    const json = process.argv.includes('--json')
    const findings = checkExperienceLanding()
    if (json) {
        process.stdout.write(`${JSON.stringify(findings, null, 2)}\n`)
    } else if (findings.length === 0) {
        process.stdout.write('[check-experience-landing] OK：全部经验条目均含非空落点\n')
    } else {
        for (const f of findings) {
            process.stderr.write(`${f.file}:${f.line}: ${f.heading} —— ${f.reason}\n`)
        }
        process.stdout.write(`[check-experience-landing] ${findings.length} 条缺落点\n`)
    }
    process.exit(findings.length > 0 ? 1 : 0)
}
