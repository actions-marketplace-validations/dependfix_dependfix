import { describe, expect, it } from 'vitest'
import { DOC_GATES } from '../run-doc-gates.mjs'
import {
    LOG_WINDOW_LIMITS,
    PERIODIC_REGRESSION_PROFILES,
    assessRegressionLogWindow,
    buildRegressionWindowEntry,
    resolveRegressionFailureSummary,
    resolveRegressionProfile,
    summarizeRegressionRun,
} from './run-periodic-regression.mjs'

describe('resolveRegressionProfile', () => {
    it('返回 weekly 配置', () => {
        const profile = resolveRegressionProfile('weekly')
        expect(profile.key).toBe('weekly')
        expect(profile.title).toBe('周级周期性回归')
        expect(profile.steps.length).toBeGreaterThan(0)
    })

    it('返回 pre-release 配置', () => {
        const profile = resolveRegressionProfile('pre-release')
        expect(profile.key).toBe('pre-release')
    })

    it('三个 profile 均纳入完整文档与治理门禁集（与 Test / release 同集合）', () => {
        for (const key of ['weekly', 'pre-release', 'phase-close']) {
            const labels = PERIODIC_REGRESSION_PROFILES[key].steps.map((step) => step.label)
            for (const gate of DOC_GATES) {
                expect(labels, `${key} 缺少 ${gate}`).toContain(gate)
            }
        }
    })

    it('pre-release / phase-close 保留 changelog 校验（weekly 不要求）', () => {
        const labelsOf = (key) => PERIODIC_REGRESSION_PROFILES[key].steps.map((step) => step.label)
        expect(labelsOf('pre-release')).toContain('verify:changelog')
        expect(labelsOf('phase-close')).toContain('verify:changelog')
        expect(labelsOf('weekly')).not.toContain('verify:changelog')
    })

    it('返回 phase-close 配置', () => {
        const profile = resolveRegressionProfile('phase-close')
        expect(profile.key).toBe('phase-close')
    })

    it('未知 profile 抛出错误', () => {
        expect(() => resolveRegressionProfile('unknown')).toThrow('Unsupported regression profile: unknown')
    })
})

describe('assessRegressionLogWindow', () => {
    it('空内容返回健康状态', () => {
        const result = assessRegressionLogWindow('')
        expect(result.shouldArchive).toBe(false)
        expect(result.entryCount).toBe(0)
        expect(result.reasons).toEqual([])
    })

    it('正常内容返回健康状态', () => {
        const content = '# 标题\n\n## 2026-09-01 测试\n\n内容\n'
        const result = assessRegressionLogWindow(content)
        expect(result.shouldArchive).toBe(false)
        expect(result.entryCount).toBe(1)
    })

    it('超过 maxLines 时需要归档', () => {
        const lines = Array.from({ length: LOG_WINDOW_LIMITS.maxLines + 10 }, (_, i) => `line ${i}`)
        const content = lines.join('\n')
        const result = assessRegressionLogWindow(content)
        expect(result.shouldArchive).toBe(true)
        expect(result.reasons.length).toBeGreaterThan(0)
        expect(result.reasons[0]).toContain('行')
    })

    it('超过 maxEntries 时需要归档', () => {
        const headings = Array.from(
            { length: LOG_WINDOW_LIMITS.maxEntries + 2 },
            (_, i) => `## 2026-09-${String(i + 1).padStart(2, '0')} 标题${i}\n\n内容\n`,
        )
        const content = headings.join('\n')
        const result = assessRegressionLogWindow(content)
        expect(result.shouldArchive).toBe(true)
        expect(result.reasons[0]).toContain('条记录')
    })

    it('排除 NON_RECORD_HEADINGS 不计入记录数', () => {
        const content = [
            '## 当前窗口与索引',
            '',
            '## 维护规则',
            '',
            '## 归档规则',
            '',
            '## 2026-09-01 真实记录',
            '',
            '内容',
        ].join('\n')
        const result = assessRegressionLogWindow(content)
        expect(result.entryCount).toBe(1)
    })

    it('同时超行数和条数时有两个原因', () => {
        const headings = Array.from(
            { length: LOG_WINDOW_LIMITS.maxEntries + 1 },
            (_, i) => `## 2026-09-${String(i + 1).padStart(2, '0')} 标题${i}\n\n${'x\n'.repeat(50)}`,
        )
        const content = headings.join('\n')
        const result = assessRegressionLogWindow(content)
        expect(result.reasons.length).toBe(2)
    })
})

describe('resolveRegressionFailureSummary', () => {
    it('无嵌套失败时返回标签 + failed', () => {
        const result = resolveRegressionFailureSummary({ output: 'some output', label: 'test:coverage' })
        expect(result).toBe('test:coverage failed')
    })

    it('output 为非字符串时仍返回标签', () => {
        const result = resolveRegressionFailureSummary({ output: null, label: 'lint' })
        expect(result).toBe('lint failed')
    })

    it('output 为 undefined 时仍返回标签', () => {
        const result = resolveRegressionFailureSummary({ output: undefined, label: 'build' })
        expect(result).toBe('build failed')
    })
})

describe('summarizeRegressionRun', () => {
    const logHealth = { shouldArchive: false, reasons: [], lineCount: 10, entryCount: 2, recordHeadings: [] }
    const profile = PERIODIC_REGRESSION_PROFILES.weekly

    it('全部通过时结论为 Pass', () => {
        const results = [
            { ok: true, skipped: false, required: true, label: 'test', command: 'pnpm', commandArgs: ['run', 'test'], timeoutBudget: '10m' },
        ]
        const summary = summarizeRegressionRun({ logHealth, profile, results })
        expect(summary.conclusion).toBe('Pass')
        expect(summary.blockers).toEqual([])
        expect(summary.warnings).toEqual([])
    })

    it('required 步骤失败时结论为 Reject', () => {
        const results = [
            { ok: false, skipped: false, required: true, label: 'test', output: '', command: 'pnpm', commandArgs: ['run', 'test'], timeoutBudget: '10m' },
        ]
        const summary = summarizeRegressionRun({ logHealth, profile, results })
        expect(summary.conclusion).toBe('Reject')
        expect(summary.blockers.length).toBe(1)
    })

    it('非 required 步骤失败时为 warning', () => {
        const results = [
            { ok: false, skipped: false, required: false, label: 'lint', output: '', command: 'pnpm', commandArgs: ['run', 'lint'], timeoutBudget: '10m' },
        ]
        const summary = summarizeRegressionRun({ logHealth, profile, results })
        expect(summary.conclusion).toBe('Pass')
        expect(summary.blockers).toEqual([])
        expect(summary.warnings.length).toBe(1)
    })

    it('skipped 步骤不影响结论', () => {
        const results = [
            { ok: false, skipped: true, required: true, label: 'test', output: '', command: 'pnpm', commandArgs: ['run', 'test'], timeoutBudget: '10m' },
        ]
        const summary = summarizeRegressionRun({ logHealth, profile, results })
        expect(summary.conclusion).toBe('Pass')
    })

    it('dry-run 模式下 blocker 为 Reject', () => {
        const results = [
            { ok: false, skipped: false, required: true, label: 'test', output: '', command: 'pnpm', commandArgs: ['run', 'test'], timeoutBudget: '10m' },
        ]
        const summary = summarizeRegressionRun({ dryRun: true, logHealth, profile, results })
        expect(summary.conclusion).toBe('Reject')
    })

    it('dry-run 模式无 blocker 时为 Prepared', () => {
        const results = [
            { ok: true, skipped: false, required: true, label: 'test', command: 'pnpm', commandArgs: ['run', 'test'], timeoutBudget: '10m' },
        ]
        const summary = summarizeRegressionRun({ dryRun: true, logHealth, profile, results })
        expect(summary.conclusion).toBe('Prepared')
    })

    it('phase-close archivePolicy=block 时归档需求升级为 blocker', () => {
        const archiveLogHealth = { shouldArchive: true, reasons: ['超出窗口'], lineCount: 500, entryCount: 10, recordHeadings: [] }
        const phaseCloseProfile = PERIODIC_REGRESSION_PROFILES['phase-close']
        const results = [
            { ok: true, skipped: false, required: true, label: 'test', command: 'pnpm', commandArgs: ['run', 'test'], timeoutBudget: '10m' },
        ]
        const summary = summarizeRegressionRun({ logHealth: archiveLogHealth, profile: phaseCloseProfile, results })
        expect(summary.conclusion).toBe('Reject')
        expect(summary.blockers.length).toBeGreaterThan(0)
    })

    it('weekly archivePolicy=warn 时归档需求升级为 warning', () => {
        const archiveLogHealth = { shouldArchive: true, reasons: ['超出窗口'], lineCount: 500, entryCount: 10, recordHeadings: [] }
        const results = [
            { ok: true, skipped: false, required: true, label: 'test', command: 'pnpm', commandArgs: ['run', 'test'], timeoutBudget: '10m' },
        ]
        const summary = summarizeRegressionRun({ logHealth: archiveLogHealth, profile, results })
        expect(summary.conclusion).toBe('Pass')
        expect(summary.warnings.length).toBeGreaterThan(0)
    })

    it('混合 required/非 required 失败', () => {
        const results = [
            { ok: false, skipped: false, required: true, label: 'test', output: '', command: 'pnpm', commandArgs: ['run', 'test'], timeoutBudget: '10m' },
            { ok: false, skipped: false, required: false, label: 'lint', output: '', command: 'pnpm', commandArgs: ['run', 'lint'], timeoutBudget: '10m' },
        ]
        const summary = summarizeRegressionRun({ logHealth, profile, results })
        expect(summary.blockers.length).toBe(1)
        expect(summary.warnings.length).toBe(1)
        expect(summary.conclusion).toBe('Reject')
    })
})

describe('buildRegressionWindowEntry', () => {
    const logHealth = { shouldArchive: false, reasons: [], lineCount: 10, entryCount: 2, recordHeadings: [] }
    const profile = PERIODIC_REGRESSION_PROFILES.weekly
    const summary = { conclusion: 'Pass', blockers: [], warnings: [] }
    const results = [
        { ok: true, skipped: false, required: true, label: 'test', command: 'pnpm', commandArgs: ['run', 'test'], timeoutBudget: '10m' },
    ]

    it('生成正确的 id 格式', () => {
        const entry = buildRegressionWindowEntry({
            artifactJsonPath: '/a/result.json',
            artifactMarkdownPath: '/a/result.md',
            dateStr: '2026-09-05',
            logHealth,
            profile,
            projectRoot: '/project',
            results,
            summary,
        })
        expect(entry.id).toBe('periodic-regression:weekly:2026-09-05')
        expect(entry.title).toContain('2026-09-05')
        expect(entry.title).toContain('周级周期性回归')
    })

    it('body 包含关键信息', () => {
        const entry = buildRegressionWindowEntry({
            artifactJsonPath: '/a/result.json',
            artifactMarkdownPath: '/a/result.md',
            dateStr: '2026-09-05',
            logHealth,
            profile,
            projectRoot: '/project',
            results,
            summary,
        })
        expect(entry.body).toContain('PASS')
        expect(entry.body).toContain('blocker=0')
        expect(entry.body).toContain('warning=0')
        expect(entry.body).toContain('窗口健康')
    })

    it('artifact 以行内代码引用，不使用 markdown 链接', () => {
        const entry = buildRegressionWindowEntry({
            artifactJsonPath: '/project/artifacts/review-gate/2026-09-05-weekly-regression.json',
            artifactMarkdownPath: '/project/artifacts/review-gate/2026-09-05-weekly-regression.md',
            dateStr: '2026-09-05',
            logHealth,
            profile,
            projectRoot: '/project',
            results,
            summary,
        })
        // artifacts/ 被 .gitignore 排除，写成链接会被 check-docs 拦下（CI 中文件不存在）
        expect(entry.body).not.toMatch(/\]\(/)
        expect(entry.body).toContain('`artifacts/review-gate/2026-09-05-weekly-regression.md`')
        expect(entry.body).toContain('`artifacts/review-gate/2026-09-05-weekly-regression.json`')
    })

    it('dry-run 时显示 dry-run 标记', () => {
        const entry = buildRegressionWindowEntry({
            artifactJsonPath: '/a/result.json',
            artifactMarkdownPath: '/a/result.md',
            dateStr: '2026-09-05',
            dryRun: true,
            logHealth,
            profile,
            projectRoot: '/project',
            results,
            summary: { conclusion: 'Prepared', blockers: [], warnings: [] },
        })
        expect(entry.body).toContain('--dry-run')
        expect(entry.body).toContain('本轮为 dry-run')
    })

    it('归档需求时显示归档状态', () => {
        const archiveLogHealth = { shouldArchive: true, reasons: ['超出行数'], lineCount: 500, entryCount: 10, recordHeadings: [] }
        const entry = buildRegressionWindowEntry({
            artifactJsonPath: '/a/result.json',
            artifactMarkdownPath: '/a/result.md',
            dateStr: '2026-09-05',
            logHealth: archiveLogHealth,
            profile,
            projectRoot: '/project',
            results,
            summary,
        })
        expect(entry.body).toContain('需要滚动归档')
    })

    it('失败结果显示 FAIL', () => {
        const failResults = [
            { ok: false, skipped: false, required: true, label: 'test', output: '', command: 'pnpm', commandArgs: ['run', 'test'], timeoutBudget: '10m' },
        ]
        const entry = buildRegressionWindowEntry({
            artifactJsonPath: '/a/result.json',
            artifactMarkdownPath: '/a/result.md',
            dateStr: '2026-09-05',
            logHealth,
            profile,
            projectRoot: '/project',
            results: failResults,
            summary: { conclusion: 'Reject', blockers: ['test failed'], warnings: [] },
        })
        expect(entry.body).toContain('FAIL')
        expect(entry.body).toContain('Reject')
    })

    it('skipped 结果显示 DRY RUN', () => {
        const skipResults = [
            { ok: false, skipped: true, required: true, label: 'test', output: '', command: 'pnpm', commandArgs: ['run', 'test'], timeoutBudget: '10m' },
        ]
        const entry = buildRegressionWindowEntry({
            artifactJsonPath: '/a/result.json',
            artifactMarkdownPath: '/a/result.md',
            dateStr: '2026-09-05',
            logHealth,
            profile,
            projectRoot: '/project',
            results: skipResults,
            summary,
        })
        expect(entry.body).toContain('DRY RUN')
    })

    it('空结果时显示无', () => {
        const entry = buildRegressionWindowEntry({
            artifactJsonPath: '/a/result.json',
            artifactMarkdownPath: '/a/result.md',
            dateStr: '2026-09-05',
            logHealth,
            profile,
            projectRoot: '/project',
            results: [],
            summary,
        })
        expect(entry.body).toContain('无')
    })
})

describe('PERIODIC_REGRESSION_PROFILES', () => {
    it('weekly 步骤数 = 覆盖 / 审计 + 文档门禁集 + lint 门禁 / 样式门禁 / typecheck / build', () => {
        expect(PERIODIC_REGRESSION_PROFILES.weekly.steps.length).toBe(2 + DOC_GATES.length + 4)
    })

    it('pre-release / phase-close 在 weekly 基础上追加 changelog 校验', () => {
        const expected = 2 + DOC_GATES.length + 4 + 1
        expect(PERIODIC_REGRESSION_PROFILES['pre-release'].steps.length).toBe(expected)
        expect(PERIODIC_REGRESSION_PROFILES['phase-close'].steps.length).toBe(expected)
    })

    it('weekly archivePolicy 为 warn', () => {
        expect(PERIODIC_REGRESSION_PROFILES.weekly.archivePolicy).toBe('warn')
    })

    it('phase-close archivePolicy 为 block', () => {
        expect(PERIODIC_REGRESSION_PROFILES['phase-close'].archivePolicy).toBe('block')
    })

    it('证据落点统一指向 artifacts/regression/current.md', () => {
        for (const profile of Object.values(PERIODIC_REGRESSION_PROFILES)) {
            const text = profile.responsibilityBoundary.join('\n')
            expect(text).toContain('artifacts/regression/current.md')
            expect(text).not.toContain('docs/reports')
        }
    })
})

describe('LOG_WINDOW_LIMITS', () => {
    it('maxEntries 为正整数', () => {
        expect(LOG_WINDOW_LIMITS.maxEntries).toBeGreaterThan(0)
        expect(Number.isInteger(LOG_WINDOW_LIMITS.maxEntries)).toBe(true)
    })

    it('maxLines 为正整数', () => {
        expect(LOG_WINDOW_LIMITS.maxLines).toBeGreaterThan(0)
        expect(Number.isInteger(LOG_WINDOW_LIMITS.maxLines)).toBe(true)
    })
})
