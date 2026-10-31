#!/usr/bin/env node

/**
 * Session Wisdom 蒸馏辅助脚本（dependfix 适配版）
 *
 * 读取 .session/wisdom.md，输出结构化分析报告：
 * - 按日期分组的条目清单
 * - 每条的类型标签（从标题关键词推断）、内容预览
 * - 推荐迁移目标（按 dependfix docs 目录结构）
 * - 统计摘要
 *
 * 兼容两种条目格式与两个小节：
 * - `## 当前条目 (Active)`：`### N. 标题` + 内容行（`- **字段**: 内容`），
 *   或蒸馏后压缩行 `[YYYY-MM-DD] [type] 摘要 → 详见 docs/...`（仍属活跃，只是摘要化）
 * - `## 已蒸馏条目 (Historical)`：`[YYYY-MM-DD] [type] 摘要 → 已迁移至 docs/...`
 *
 * 日期+类型形态另支持 `### [YYYY-MM-DD] [type] 标题`（+ `- ` 正文行）与
 * `- **[YYYY-MM-DD] [type] 标题**：正文`；完整可接受形态表与 stdout / 退出码契约见
 * [docs/design/governance/session-wisdom-distillation.md §6](../docs/design/governance/session-wisdom-distillation.md)。
 *
 * 活跃/已蒸馏按**小节标题**区分，不按行格式（蒸馏后无日期标题也不会死锁）。
 *
 * 用法:
 *   node scripts/distill-wisdom.mjs
 *   node scripts/distill-wisdom.mjs --check          # 仅检查条目数是否超阈值（供 hook 调用）
 *   node scripts/distill-wisdom.mjs --threshold=15   # 自定义阈值（默认 20）
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')
const WISDOM_PATH = path.join(PROJECT_ROOT, '.session', 'wisdom.md')

// ---------------------------------------------------------------------------
// 条目行形态（单一事实源：解析与「疑似条目」探测共用，避免两处漂移）
// 可接受形态见 [docs/design/governance/session-wisdom-distillation.md §6 格式约定]
// ---------------------------------------------------------------------------

/** 蒸馏摘要行：`[YYYY-MM-DD] [type] 摘要 [→ [详见/已迁移至] target]`（可带 `- ` 前缀）。 */
const DISTILLED_LINE_RE = /^[-*]?\s*\[(\d{4}-\d{2}-\d{2})\]\s*\[(\w+)\]\s*(.+?)\s*(?:→\s*(?:(?:详见|已迁移至)\s*)?(.+?))?\s*$/u

/** 活跃条目标题：`### [YYYY-MM-DD] [type] 标题`（本仓 wisdom.md 实际写法）。 */
const HEADING_ENTRY_RE = /^###\s+\[(\d{4}-\d{2}-\d{2})\]\s*\[([\w-]+)\]\s*(.+?)\s*$/u

/** 列表形态活跃条目：`- **[YYYY-MM-DD] [type] 标题**：正文` 或 `...** → [详见/已迁移至] target`。 */
const LIST_DATE_TYPE_RE = /^[-*]\s+\*\*\[(\d{4}-\d{2}-\d{2})\]\s*\[([\w-]+)\]\s*(.+?)\*\*(?:\s*[：:]\s*(.*)|\s*→\s*(?:(?:详见|已迁移至)\s*)?(.+))?$/u

/** 摘要行（新格式）：`- **[type-id]** 标题 [→ 详见/已迁移至 target]`。 */
const TYPE_ID_SUMMARY_RE = /^[-*]\s+\*\*\[([^\]]+)\]\*\*\s+(.+?)\s*(?:→\s*(?:详见|已迁移至)\s*(.+?))?\s*$/u

/** 疑似条目探测（宽口径）：行内含 `[YYYY-MM-DD]` 日期 token。 */
const SUSPECT_LINE_RE = /\[\d{4}-\d{2}-\d{2}\]/u

// 类型 → 推荐迁移目标（dependfix docs 目录结构，见 session-wisdom-distillation.md §3.1）
const TYPE_MIGRATION_TARGETS = {
    bug: '`docs/design/governance/` 对应治理文档',
    pattern: '`docs/standards/` 对应规范文档',
    decision: '`docs/design/modules/` 或 `docs/design/governance/`',
    env: '`docs/guide/tech-stack.md` 或 `docs/guide/ai-development.md`',
    test: '`docs/standards/testing.md`',
    baseline: '`docs/research/`',
}

// 标题关键词 → 类型推断（按特异性从高到低排序，避免 "噪音/修复" 等泛词抢占
// 更具体的 "Windows/行尾/测试" 等词）
const KEYWORD_TYPES = [
    { type: 'env', keywords: ['Windows', '行尾', 'CRLF', '环境', '工具链'] },
    { type: 'test', keywords: ['测试', 'Review', '审计', '门禁', '验证', '覆盖'] },
    { type: 'pattern', keywords: ['模式', '纪律', '惯例', '机制', '流程', '方法'] },
    { type: 'decision', keywords: ['决策', '方案', '演进', '选择', '语义', '防护'] },
    { type: 'bug', keywords: ['修复', '教训', '陷阱', '漏网', '回归', '污染', '噪音', '误伤'] },
    { type: 'baseline', keywords: ['规模演进', '数据基线', '对比基线'] },
]

const TYPE_ORDER = ['bug', 'pattern', 'decision', 'env', 'test', 'baseline']

export function inferType(title) {
    for (const { type, keywords } of KEYWORD_TYPES) {
        if (keywords.some((k) => title.includes(k))) {
            return type
        }
    }
    return 'unknown'
}

/** 判断小节标题：active / historical / 其他日期分组（兼容旧格式无小节标题的情况） */
export function classifySection(title) {
    if (title.includes('当前条目') || title.includes('Active')) {
        return 'active'
    }
    if (title.includes('已蒸馏') || title.includes('Historical')) {
        return 'historical'
    }
    return null
}

export function parseWisdom(content) {
    const lines = content.split(/\r?\n/u)
    const entries = []
    let currentSection = null
    let currentDate = null
    let currentEntry = null

    const flushEntry = () => {
        if (currentEntry) {
            entries.push(currentEntry)
            currentEntry = null
        }
    }

    for (const line of lines) {
        const trimmed = line.trim()

        // 小节标题：## 当前条目 / ## 已蒸馏条目
        const sectionMatch = trimmed.match(/^##\s+(.+)$/u)
        if (sectionMatch) {
            const section = classifySection(sectionMatch[1])
            if (section) {
                flushEntry()
                currentSection = section
                currentDate = null
                continue
            }
        }

        // 日期分组标题（旧格式/历史格式）：## YYYY-MM-DD ... 或 ### YYYY-MM-DD ...
        const dateMatch = trimmed.match(/^#{2,3}\s+(\d{4}-\d{2}-\d{2})/u)
        if (dateMatch) {
            flushEntry()
            currentSection = currentSection ?? 'active'
            currentDate = dateMatch[1]
            continue
        }

        // 无小节标题（旧格式整体）→ 默认 active
        if (currentSection === null && currentDate === null) {
            currentSection = 'active'
        }

        // Active 小节中 keep 条目（`### N.` 行）与摘要行（`- [date]` 列表前缀 / `- **[type-N]**` 新格式）需可达；
        // 已进入某个条目（`currentEntry` 非空）时不再过滤——`- ` 行是其正文（见末段收集分支）
        if (!currentEntry && currentDate === null && !trimmed.startsWith('### ') && !/^[-*]?\s*\[/u.test(trimmed) && !/^[-*]\s+\*\*\[/u.test(trimmed)) {
            continue
        }

        // 蒸馏摘要行：[YYYY-MM-DD] [type] 摘要 → 详见/已迁移至 ...
        // 允许可选的 `- ` 列表前缀（markdown 常见写法）
        const distilledMatch = trimmed.match(DISTILLED_LINE_RE)
        if (distilledMatch) {
            flushEntry()
            entries.push({
                date: distilledMatch[1],
                type: distilledMatch[2],
                title: distilledMatch[3],
                target: distilledMatch[4] ?? null,
                // 活跃/已蒸馏按小节判定：Active 区的摘要行仍属活跃（已摘要化）
                isDistilled: currentSection === 'historical',
                lines: [],
            })
            continue
        }

        // 活跃条目标题形态（本仓 wisdom.md 实际写法）：`### [YYYY-MM-DD] [type] 标题`
        // —— 其后的 `- ` 正文行由下方「条目内容行」分支收进 lines
        const headingEntryMatch = trimmed.match(HEADING_ENTRY_RE)
        if (headingEntryMatch) {
            flushEntry()
            currentEntry = {
                date: headingEntryMatch[1],
                type: headingEntryMatch[2].split(/[-\s]/)[0],
                title: headingEntryMatch[3],
                target: null,
                isDistilled: currentSection === 'historical',
                lines: [],
                source: headingEntryMatch[2],
            }
            continue
        }

        // 列表形态：`- **[YYYY-MM-DD] [type] 标题**：正文`（可选 `→ 详见/已迁移至 <target>`）
        const listDateTypeMatch = trimmed.match(LIST_DATE_TYPE_RE)
        if (listDateTypeMatch) {
            flushEntry()
            entries.push({
                date: listDateTypeMatch[1],
                type: listDateTypeMatch[2].split(/[-\s]/)[0],
                title: listDateTypeMatch[3],
                target: listDateTypeMatch[5] ?? null,
                isDistilled: currentSection === 'historical',
                lines: listDateTypeMatch[4] ? [`- ${listDateTypeMatch[4]}`] : [],
                source: listDateTypeMatch[2],
            })
            continue
        }

        // 当前条目摘要行（新格式）：- **[type-id]** 标题 → 详见/已迁移至 docs/...
        // 例：- **[pattern-W6]** `JSON.parse(x) as RunResult` 不做运行时校验 → 详见 [docs/standards/testing.md §2](../docs/standards/testing.md#2-测试设计原则)
        // type-id 允许含 `/`（如 `practice-B1 实战`/`pattern-FsAdapter mock`/`flow-audit 阈值`/`pattern-文档事实校验` 等）
        // type 部分（取首段 - 之前）作为分类键
        const newFormatMatch = trimmed.match(TYPE_ID_SUMMARY_RE)
        if (newFormatMatch) {
            flushEntry()
            const typePart = newFormatMatch[1].split(/[-\s]/)[0]
            currentEntry = {
                date: currentDate ?? 'unknown',
                type: typePart,
                title: newFormatMatch[2],
                target: newFormatMatch[3] ?? null,
                isDistilled: currentSection === 'historical',
                lines: [],
                source: newFormatMatch[1], // 完整 type-id 用于追溯
            }
            continue
        }

        // 当前格式条目标题：### N. 标题
        const entryMatch = trimmed.match(/^###\s+\d+\.\s+(.+)$/u)
        if (entryMatch) {
            flushEntry()
            currentEntry = {
                date: currentDate ?? 'unknown',
                type: null,
                title: entryMatch[1],
                target: null,
                isDistilled: currentSection === 'historical',
                lines: [],
            }
            continue
        }

        // 条目内容行（直到下一个标题）
        if (currentEntry && trimmed.startsWith('- ')) {
            currentEntry.lines.push(trimmed)
        } else if (currentEntry && trimmed === '---') {
            flushEntry()
        }
    }

    flushEntry()

    // 补充推断类型
    for (const entry of entries) {
        if (entry.type === null) {
            entry.type = inferType(entry.title)
        }
    }

    return entries
}

/**
 * 探测**活跃区**的「疑似条目」行（宽口径，仅用于假阴性告警，不改变解析结果）。
 *
 * 判定：活跃区中行内含 `[YYYY-MM-DD]` 日期 token（不额外要求类型括号），**且不被任一可接受
 * 形态的条目正则命中**。目的是让「格式漂移 → `--check` 静默输出 0 条」无法通过
 * （2026-10-13 实测：wisdom.md 用 `### [日期] [类型] 标题` 写法而解析器只认摘要行形态
 * → `0 active entries`）。历史区（`## 已蒸馏条目`）的条目形态不在「活跃计数」告警面内，故不计入。
 */
export function findSuspectedEntries(content) {
    const suspects = []
    let section = null
    for (const [index, raw] of content.split(/\r?\n/u).entries()) {
        const line = raw.trim()
        const sectionMatch = line.match(/^##\s+(.+)$/u)
        if (sectionMatch) {
            const detected = classifySection(sectionMatch[1])
            if (detected) {
                section = detected
                continue
            }
        }
        if ((section ?? 'active') !== 'active') {
            continue
        }
        if (!SUSPECT_LINE_RE.test(line)) {
            continue
        }
        if (DISTILLED_LINE_RE.test(line) || HEADING_ENTRY_RE.test(line) || LIST_DATE_TYPE_RE.test(line)) {
            continue
        }
        suspects.push({ line: index + 1, text: line })
    }
    return suspects
}

/** 输出「疑似条目」告警（stderr；stdout 契约保持可被 hook 无脑解析）。 */
export function warnSuspectedEntries(suspects) {
    if (suspects.length === 0) {
        return
    }
    console.error(
        `[distill-wisdom] 警告：解析到 0 条活跃条目，但文件中存在 ${suspects.length} 处疑似条目行`
        + `（格式未被识别，计数可能失真）——请核对 .session/wisdom.md 与蒸馏机制文档 §6 的格式约定：`,
    )
    for (const suspect of suspects.slice(0, 10)) {
        console.error(`  - L${suspect.line}: ${suspect.text}`)
    }
}

export async function main() {
    const args = process.argv.slice(2)
    const flags = {
        check: args.includes('--check'),
        threshold: 20,
    }

    const thresholdArg = args.find((a) => a.startsWith('--threshold='))
    if (thresholdArg) {
        flags.threshold = Number.parseInt(thresholdArg.split('=')[1], 10) || 20
    }

    let wisdomContent
    try {
        wisdomContent = await readFile(WISDOM_PATH, 'utf8')
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.error('[distill-wisdom] .session/wisdom.md 不存在，跳过')
            process.exit(0)
            // 测试环境 process.exit 被 mock 时不会真的终止；用 return 避免 fall-through 到 throw err
            return
        }
        throw err
    }

    const parsed = parseWisdom(wisdomContent)
    const activeEntries = parsed.filter((e) => !e.isDistilled)
    const distilledEntries = parsed.filter((e) => e.isDistilled)
    // 假阴性防护：解析到 0 条但文件明显含条目行 → 显式告警（不改退出码契约，见蒸馏机制文档 §6）
    const suspectedEntries = activeEntries.length === 0 ? findSuspectedEntries(wisdomContent) : []

    // --check 模式：仅检查活跃条目数
    if (flags.check) {
        const count = activeEntries.length
        const status = count >= flags.threshold ? 'WISDOM_NEEDS_DISTILL' : 'WISDOM_OK'
        console.log(`${status}: ${count} active entries (threshold=${flags.threshold})`)
        if (suspectedEntries.length > 0) {
            // 走 stderr：stdout 契约（WISDOM_OK / WISDOM_NEEDS_DISTILL）保持可被 hook 无脑解析
            warnSuspectedEntries(suspectedEntries)
        }
        process.exit(0)
        // 测试环境 process.exit 被 mock 时不会真的终止；用 return 避免 fall-through 到报告路径
        return
    }

    // 构造报告
    const reportParts = [
        '# Session Wisdom 蒸馏分析报告',
        '',
        `> 生成时间: ${new Date().toISOString().slice(0, 10)}`,
        '',
        '## 统计',
        '',
        `- 总条目: ${parsed.length}`,
        `- 活跃条目 (未蒸馏): ${activeEntries.length}`,
        `- 已蒸馏条目: ${distilledEntries.length}`,
        `- 日期跨度: ${parsed.length > 0 ? `${parsed[0].date} ~ ${parsed[parsed.length - 1].date}` : '无'}`,
        '',
        '---',
        '',
        '## 按类型分布',
        '',
    ]

    const typeCounts = {}
    for (const entry of activeEntries) {
        typeCounts[entry.type] = (typeCounts[entry.type] || 0) + 1
    }

    let hasKnownType = false
    for (const type of TYPE_ORDER) {
        if (typeCounts[type]) {
            hasKnownType = true
            reportParts.push(`- **${type}**: ${typeCounts[type]} 条 → 推荐迁移至 ${TYPE_MIGRATION_TARGETS[type]}`)
        }
    }
    if (typeCounts.unknown) {
        reportParts.push(`- **unknown**: ${typeCounts.unknown} 条 → 人工判断迁移目标`)
    }
    if (!hasKnownType && !typeCounts.unknown) {
        reportParts.push('_无活跃条目_')
    }

    reportParts.push('', '---', '', '## 活跃条目详情', '', '')

    if (activeEntries.length === 0) {
        reportParts.push('_无活跃条目_', '')
    } else {
        let currentDate = null
        for (const entry of activeEntries) {
            if (entry.date !== currentDate) {
                reportParts.push(`### ${entry.date}`, '')
                currentDate = entry.date
            }
            const target = TYPE_MIGRATION_TARGETS[entry.type] || '人工判断'
            reportParts.push(`- \`[${entry.type}]\` ${entry.title}`)
            reportParts.push(`  - 推荐迁移: ${target}`)
            if (entry.lines.length > 0) {
                const firstLine = entry.lines[0].slice(0, 100)
                reportParts.push(`  - 内容预览: ${firstLine}${entry.lines[0].length > 100 ? '…' : ''}`)
            }
            reportParts.push('')
        }
    }

    if (distilledEntries.length > 0) {
        reportParts.push('---', '', '## 已蒸馏条目', '', '')
        for (const entry of distilledEntries) {
            const target = entry.target ? ` → 详见 ${entry.target}` : ''
            reportParts.push(`- [${entry.date}] \`[${entry.type}]\` ${entry.title}${target}`)
        }
        reportParts.push('')
    }

    reportParts.push('---', '', '## 阈值提示', '', '')
    reportParts.push(`当前活跃条目: **${activeEntries.length}** / 蒸馏阈值: **${flags.threshold}**`, '')

    if (activeEntries.length >= flags.threshold) {
        reportParts.push('> ⚠️ **建议立即执行蒸馏**: 活跃条目数已达阈值')
    } else {
        reportParts.push(`> ✅ 距离下次蒸馏阈值还有 ${flags.threshold - activeEntries.length} 条`)
    }

    const report = reportParts.join('\n')
    console.log(report)
    warnSuspectedEntries(suspectedEntries)
}

if (process.argv[1] && !process.env.VITEST && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((err) => {
        console.error('[distill-wisdom] 错误:', err)
        process.exit(1)
    })
}
