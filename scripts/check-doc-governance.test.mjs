import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    checkCharBudgets,
    checkSectionBudgets,
    countChars,
    extractPhaseNumber,
    extractSection,
    hasBatchNarrative,
    hasBlockingFindings,
    measureRuleTable,
    parseArchiveIndex,
    parseBudgetTables,
    parseFreshnessDays,
    resolveBudgetTargets,
    validateArchiveGovernance,
    validateArchiveIndex,
} from './check-doc-governance.mjs'

const BUDGET_FIXTURE = `# 文档治理

### 4.2 字符与密度预算

| 文档 | 健康字符 | 阻断字符 | 说明 |
|:--|:--:|:--:|:--|
| \`docs/standards/*.md\` | 24,000 | 30,000 | 规范 |
| \`docs/plan/todo-archive.md\` | 8,000 | 12,000 | 索引 |

**规则条数预算**：

| 文件 | 章节 | 健康条数 | 阻断条数 | 单条最大字符 |
|:--|:--|:--:|:--:|:--:|
| \`docs/standards/development.md\` | 工程实践规则 | 24 | 32 | 260 |

## 5. 下一节
`

function makeRepo(files) {
    const root = mkdtempSync(join(tmpdir(), 'doc-governance-'))
    for (const [path, content] of Object.entries(files)) {
        const full = join(root, path)
        mkdirSync(join(full, '..'), { recursive: true })
        writeFileSync(full, content)
    }
    return root
}

describe('parseBudgetTables', () => {
    it('解析字符与规则条数预算', () => {
        const { charBudgets, sectionBudgets } = parseBudgetTables(BUDGET_FIXTURE)
        expect(charBudgets).toHaveLength(2)
        expect(charBudgets[0]).toMatchObject({ pattern: 'docs/standards/*.md', healthy: 24000, block: 30000 })
        expect(sectionBudgets[0]).toMatchObject({
            file: 'docs/standards/development.md',
            section: '工程实践规则',
            healthy: 24,
            block: 32,
            maxEntryChars: 260,
        })
    })

    it('缺少预算标题时抛错', () => {
        expect(() => parseBudgetTables('# 空')).toThrow('未找到预算标题')
    })
})

describe('resolveBudgetTargets', () => {
    const files = ['docs/standards/a.md', 'docs/standards/b.md', 'docs/plan/todo.md']
    it('glob 匹配', () => {
        expect(resolveBudgetTargets('docs/standards/*.md', files)).toEqual(['docs/standards/a.md', 'docs/standards/b.md'])
    })
    it('精确路径只匹配自身', () => {
        expect(resolveBudgetTargets('docs/plan/todo.md', files)).toEqual(['docs/plan/todo.md'])
    })
})

describe('parseFreshnessDays', () => {
    it('从 §4.4 文案解析天数', () => {
        expect(parseFreshnessDays('最近一次实质修改超过 **180 天**时输出 warning')).toBe(180)
    })

    it('缺少阈值抛错', () => {
        expect(() => parseFreshnessDays('无阈值')).toThrow('未找到 freshness 阈值')
    })
})

describe('checkCharBudgets', () => {
    it('区分 healthy / warning / block / missing', () => {
        const root = makeRepo({ 'docs/standards/a.md': 'x'.repeat(120) })
        const budgets = [
            { pattern: 'docs/standards/*.md', healthy: 200, block: 300 },
            { pattern: 'docs/standards/*.md', healthy: 100, block: 300 },
            { pattern: 'docs/standards/*.md', healthy: 50, block: 100 },
            { pattern: 'docs/plan/missing.md', healthy: 10, block: 20 },
        ]
        const results = checkCharBudgets(root, budgets, ['docs/standards/a.md'])
        expect(results.map((r) => r.verdict)).toEqual(['healthy', 'warning', 'block', 'missing-row-target'])
    })
})

describe('hasBlockingFindings', () => {
    const base = {
        charResults: [],
        sectionResults: [],
        archiveResult: { errors: [] },
        governanceErrors: [],
        freshness: [],
    }
    it('无阻断项返回 false', () => {
        expect(hasBlockingFindings(base)).toBe(false)
    })
    it('字符超阻断 / 归档错误均返回 true', () => {
        expect(hasBlockingFindings({ ...base, charResults: [{ verdict: 'block' }] })).toBe(true)
        expect(hasBlockingFindings({ ...base, archiveResult: { errors: ['x'] } })).toBe(true)
        expect(hasBlockingFindings({ ...base, governanceErrors: ['x'] })).toBe(true)
    })
})

describe('countChars', () => {
    it('按 UTF-16 长度计量', () => {
        expect(countChars('abc中文')).toBe(5)
    })
})

describe('extractSection + measureRuleTable', () => {
    const markdown = `## 5. TypeScript

### 5.1 工程实践规则

| ID | 规则 | 触发改动 | 执行 |
|:--|:--|:--|:--|
| 5.1.1 | 规则甲 | 触发甲 | L2 |
| 5.1.2 | 规则乙 | 触发乙 | L1 |

## 6. 下一节
`
    it('定位章节并计量规则表', () => {
        const section = extractSection(markdown, '5.1 工程实践规则')
        expect(section).not.toBeNull()
        const measured = measureRuleTable(section.content)
        expect(measured.count).toBe(2)
        expect(measured.maxEntryChars).toBe(3)
    })

    it('章节缺失返回 null', () => {
        expect(extractSection(markdown, '不存在')).toBeNull()
    })
})

describe('checkSectionBudgets', () => {
    it('超健康线判 warning，超阻断线判 block', () => {
        const root = makeRepo({
            'docs/standards/development.md': `### 5.1 工程实践规则

| ID | 规则 |
|:--|:--|
| 5.1.1 | 甲 |
| 5.1.2 | 乙 |
| 5.1.3 | 丙 |
`,
        })
        const warning = checkSectionBudgets(root, [{
            file: 'docs/standards/development.md',
            section: '工程实践规则',
            healthy: 2,
            block: 4,
            maxEntryChars: 10,
        }])
        expect(warning[0].verdict).toBe('warning')
        expect(warning[0].count).toBe(3)

        const block = checkSectionBudgets(root, [{
            file: 'docs/standards/development.md',
            section: '工程实践规则',
            healthy: 1,
            block: 2,
            maxEntryChars: 10,
        }])
        expect(block[0].verdict).toBe('block')
    })

    it('文件或章节缺失判 error', () => {
        const root = makeRepo({ 'docs/standards/development.md': '# 空\n' })
        const results = checkSectionBudgets(root, [{
            file: 'docs/standards/development.md',
            section: '工程实践规则',
            healthy: 1,
            block: 2,
            maxEntryChars: 10,
        }])
        expect(results[0].verdict).toBe('missing-section')
    })
})

describe('extractPhaseNumber', () => {
    it.each([
        ['todo-archive-phases-m48.md', 48],
        ['todo-archive-phases-m0-m1.md', 1],
        ['todo-archive-phases-m2-m55.md', 5.5],
        ['todo-archive-phases-m6-m7-t711.md', 7.5],
        ['todo-archive-phases-m10-c53-c59c61.md', 10],
        ['todo-archive-phases-m39-m40.md', 40],
    ])('%s → M%s', (file, expected) => {
        expect(extractPhaseNumber(file)).toBe(expected)
    })

    it('无阶段号返回 null', () => {
        expect(extractPhaseNumber('readme.md')).toBeNull()
    })
})

describe('parseArchiveIndex', () => {
    it('解析索引行与链接', () => {
        const markdown = `## 阶段索引

| 阶段 | 主题 | 归档文件 | 归档日期 |
|:--|:--|:--|:--|
| M48 | 对外 PR 交付闭环 | [M48](archive/todo-archive-phases-m48.md) | 2026-10-25 |
| M47 | 交付判定可信 | [M47](archive/todo-archive-phases-m47.md#m47) | 2026-10-24 |
`
        const { rows, errors } = parseArchiveIndex(markdown)
        expect(errors).toHaveLength(0)
        expect(rows).toHaveLength(2)
        expect(rows[0]).toMatchObject({ phase: 'M48', file: 'archive/todo-archive-phases-m48.md' })
    })

    it('缺少索引章节报错', () => {
        const { errors } = parseArchiveIndex('# 空')
        expect(errors).toContain('未找到「阶段索引」章节')
    })
})

describe('validateArchiveIndex', () => {
    const files = {
        'docs/plan/archive/todo-archive-phases-m48.md': '## M48: 甲\n',
        'docs/plan/archive/todo-archive-phases-m47.md': '## M47: 乙\n',
    }
    const reader = (path) => files[path] ?? ''

    it('正确索引通过', () => {
        const markdown = `## 阶段索引

| 阶段 | 主题 | 归档文件 | 归档日期 |
|:--|:--|:--|:--|
| M48 | 甲 | [M48](archive/todo-archive-phases-m48.md) | 2026-10-25 |
| M47 | 乙 | [M47](archive/todo-archive-phases-m47.md) | 2026-10-24 |
`
        const result = validateArchiveIndex(markdown, ['todo-archive-phases-m48.md', 'todo-archive-phases-m47.md'], reader)
        expect(result.errors).toEqual([])
    })

    it('顺序错误、重复、缺失、正文标题均报错', () => {
        const markdown = `## 阶段索引

| 阶段 | 主题 | 归档文件 | 归档日期 |
|:--|:--|:--|:--|
| M47 | 乙 | [M47](archive/todo-archive-phases-m47.md) | 2026-10-24 |
| M48 | 甲 | [M48](archive/todo-archive-phases-m48.md) | 2026-10-25 |
| M48 | 甲 | [M48](archive/todo-archive-phases-m48.md) | 2026-10-25 |

## M46: 旧正文

- **2026-10-25 M48 归档**：批次流水账
`
        const result = validateArchiveIndex(markdown, ['todo-archive-phases-m48.md', 'todo-archive-phases-m47.md', 'todo-archive-phases-m46.md'], reader)
        expect(result.errors).toEqual(expect.arrayContaining([
            expect.stringContaining('索引顺序错误'),
            expect.stringContaining('归档分片重复索引'),
            expect.stringContaining('归档分片未登记到索引：todo-archive-phases-m46.md'),
            expect.stringContaining('出现阶段正文标题'),
            expect.stringContaining('批次流水账'),
        ]))
    })
})

describe('validateArchiveIndex 无标题分片', () => {
    it('分片存在但无阶段标题时报错', () => {
        const markdown = `## 阶段索引

| 阶段 | 主题 | 归档文件 | 归档日期 |
|:--|:--|:--|:--|
| M48 | 甲 | [M48](archive/todo-archive-phases-m48.md) | 2026-10-25 |
`
        const result = validateArchiveIndex(markdown, ['todo-archive-phases-m48.md'], () => '# 空分片\n')
        expect(result.errors).toContain('归档分片缺少阶段正文标题：todo-archive-phases-m48.md')
    })
})

describe('hasBatchNarrative', () => {
    it('识别 bullet / 表格行 / 日期段落三种形态', () => {
        expect(hasBatchNarrative('- **2026-10-25 M48 归档**：流水账')).toBe(true)
        expect(hasBatchNarrative('| 2026-10-25 | M48 归档 |')).toBe(true)
        expect(hasBatchNarrative('2026-10-25 归档批次记录')).toBe(true)
        expect(hasBatchNarrative('## 阶段索引\n\n| M48 | 主题 |')).toBe(false)
    })
})

describe('validateArchiveGovernance', () => {
    it('拒绝索引内的阶段正文并检查日志指针', () => {
        expect(validateArchiveGovernance('## M48: 正文\n')).toEqual(expect.arrayContaining([
            expect.stringContaining('出现阶段正文标题'),
            expect.stringContaining('未指向 archive-log.md'),
        ]))
        expect(validateArchiveGovernance('## 4. 基线\n\n- **2026-10-25 M48 归档**：流水账\n\narchive-log.md\n')).toEqual(expect.arrayContaining([
            expect.stringContaining('批次流水账'),
        ]))
        expect(validateArchiveGovernance('批次日志见 archive-log.md\n')).toEqual([])
    })
})
