// ci-alignment.test.ts — 口径记录的可渲染文案（PR 正文与报告共用单一事实源）。
import { describe, expect, it } from 'vitest'
import {
    describeCiAlignment,
    formatCiAlignmentLines,
    formatCiAlignmentSection,
    isFailedWorkflowConclusion,
    type CiAlignmentRecord,
} from './ci-alignment'
import { generateMarkdownReport } from './markdown-generator'
import { generateJsonReport } from './json-generator'
import { EMPTY_RUN_RESULT } from './report.test-helpers'

function makeRecord(overrides: Partial<CiAlignmentRecord> = {}): CiAlignmentRecord {
    return {
        repository: 'owner/repo',
        commands: ['pnpm install --frozen-lockfile', 'pnpm lint', 'pnpm build', 'pnpm typecheck', 'pnpm test'],
        status: 'aligned',
        ciCategories: ['lint', 'build', 'test'],
        extraInExecution: ['typecheck'],
        missingInExecution: [],
        workflows: [{ path: '.github/workflows/ci.yml', categories: ['lint', 'build', 'test'], unrecognized: [] }],
        ...overrides,
    }
}

describe('describeCiAlignment', () => {
    it('aligned：结论含依据 workflow，并披露本次更严格的类别', () => {
        const description = describeCiAlignment(makeRecord())

        expect(description.statusLabel).toBe('一致')
        expect(description.headline).toBe('CI 口径：一致（依据 `.github/workflows/ci.yml`）')
        expect(description.notes).toContain('本仓库 CI 未跑 typecheck，本次已验证')
    })

    it('differs：结论列出 CI 运行而本次未执行的类别', () => {
        const description = describeCiAlignment(makeRecord({
            status: 'differs',
            extraInExecution: [],
            missingInExecution: ['test'],
        }))

        expect(description.statusLabel).toBe('不一致')
        expect(description.headline).toBe('CI 口径：不一致（CI 运行、本次未执行：test）')
    })

    it('inconclusive：用 comparisonNote 说明无法比对的原因', () => {
        const description = describeCiAlignment(makeRecord({
            status: 'inconclusive',
            extraInExecution: [],
            comparisonNote: '本次验证链未包含可识别的验证命令（自定义命令），无法按类别比对',
        }))

        expect(description.statusLabel).toBe('无法比对')
        expect(description.headline).toContain('CI 口径：无法比对')
        expect(description.headline).toContain('自定义命令')
    })

    it('unreadable：标注未能读取 CI 配置及原因', () => {
        const description = describeCiAlignment(makeRecord({
            status: 'unreadable',
            workflows: [],
            ciCategories: [],
            extraInExecution: [],
            unreadableReason: '未找到 .github/workflows',
        }))

        expect(description.statusLabel).toBe('未能读取 CI 配置')
        expect(description.headline).toBe('CI 口径：未能读取 CI 配置（未找到 .github/workflows）')
        expect(description.notes).toEqual([])
    })

    it('未识别命令显式披露（不静默丢弃）', () => {
        const description = describeCiAlignment(makeRecord({
            workflows: [{
                path: '.github/workflows/ci.yml',
                categories: ['lint'],
                unrecognized: ['pnpm test:e2e', 'pnpm format'],
            }],
        }))

        expect(description.notes.some((note) => note.includes('未识别命令') && note.includes('2 条'))).toBe(true)
    })

    it('依据超过 3 个 workflow 时折叠为「等 N 个」', () => {
        const description = describeCiAlignment(makeRecord({
            workflows: ['a', 'b', 'c', 'd'].map((name) => ({
                path: `.github/workflows/${name}.yml`,
                categories: ['lint' as const],
                unrecognized: [],
            })),
        }))

        expect(description.headline).toContain('a.yml')
        expect(description.headline).toContain('等 4 个')
        expect(description.headline).not.toContain('d.yml')
    })

    it('依据只列真正贡献语义项的 workflow（零命中文件不进入结论）', () => {
        const description = describeCiAlignment(makeRecord({
            workflows: [
                { path: '.github/workflows/ci.yml', categories: ['lint', 'build'], unrecognized: [] },
                { path: '.github/workflows/release.yml', categories: [], unrecognized: [] },
            ],
        }))

        expect(description.headline).toContain('ci.yml')
        expect(description.headline).not.toContain('release.yml')
    })

    it('解析原因 / workflow 路径做行内净化（反引号与换行不破坏正文）', () => {
        const description = describeCiAlignment(makeRecord({
            status: 'unreadable',
            workflows: [],
            ciCategories: [],
            extraInExecution: [],
            unreadableReason: 'bad `thing`\nnext line',
        }))

        expect(description.headline).not.toContain('`thing`')
        expect(description.headline).not.toContain('\n')
        expect(description.headline).toContain('bad \u0027thing\u0027 next line')
    })

    it('默认分支失败只在 failure / timed_out / startup_failure 时标注「非本 PR 引入」', () => {
        const failed = describeCiAlignment(makeRecord({
            defaultBranchHealth: [
                { path: '.github/workflows/ci.yml', conclusion: 'failure' },
                { path: '.github/workflows/lint.yml', conclusion: 'timed_out' },
                { path: '.github/workflows/release.yml', conclusion: 'startup_failure' },
                { path: '.github/workflows/other.yml', conclusion: 'success' },
            ],
        }))
        const healthy = describeCiAlignment(makeRecord({
            defaultBranchHealth: [{ path: '.github/workflows/ci.yml', conclusion: 'success' }],
        }))

        expect(failed.notes.filter((note) => note.includes('非本 PR 引入'))).toHaveLength(1)
        expect(failed.notes.join('\n')).toContain('.github/workflows/lint.yml')
        expect(failed.notes.join('\n')).toContain('release.yml')
        expect(failed.notes.join('\n')).not.toContain('other.yml')
        expect(healthy.notes.some((note) => note.includes('非本 PR 引入'))).toBe(false)
    })

    it('mirror 开启时披露「已镜像执行 N 条 / 跳过 M 条」（0 条也展示，证明开关生效）', () => {
        const withMirror = describeCiAlignment(makeRecord({
            mirrored: ['pnpm run coverage'],
            mirrorSkipped: [
                { command: 'docker build -t app .', reason: 'unsupported-command' },
                { command: 'pnpm run e2e', reason: 'over-limit' },
            ],
        }))
        const emptyMirror = describeCiAlignment(makeRecord({ mirrored: [], mirrorSkipped: [] }))

        expect(withMirror.notes[0]).toBe('已镜像执行 1 条 / 跳过 2 条')
        expect(emptyMirror.notes[0]).toBe('已镜像执行 0 条 / 跳过 0 条')
    })

    it('mirror 关闭（字段缺省）时不渲染镜像行（与现状等价）', () => {
        expect(describeCiAlignment(makeRecord()).notes.some((note) => note.includes('已镜像执行'))).toBe(false)
    })
})

describe('isFailedWorkflowConclusion', () => {
    it('failure / timed_out 视为失败，其余不算', () => {
        expect(isFailedWorkflowConclusion('failure')).toBe(true)
        expect(isFailedWorkflowConclusion('timed_out')).toBe(true)
        expect(isFailedWorkflowConclusion('startup_failure')).toBe(true)
        expect(isFailedWorkflowConclusion('cancelled')).toBe(false)
        expect(isFailedWorkflowConclusion('success')).toBe(false)
    })
})

describe('formatCiAlignmentLines / Section', () => {
    it('单仓库 ≤5 行：命令链 + 结论 + 补充说明', () => {
        const lines = formatCiAlignmentLines(makeRecord())

        expect(lines.length).toBeLessThanOrEqual(5)
        expect(lines[0]).toContain('本次验证链：')
        expect(lines[1]).toBe('- CI 口径：一致（依据 `.github/workflows/ci.yml`）')
    })

    it('无执行命令时给出显式占位（不渲染空命令链）', () => {
        expect(formatCiAlignmentLines(makeRecord({ commands: [] }))[0]).toContain('本次未执行验证命令')
    })

    it('mirror 行进入正文区块且总行数仍 ≤5（优先级最高）', () => {
        const lines = formatCiAlignmentLines(makeRecord({
            mirrored: ['pnpm run coverage'],
            mirrorSkipped: [{ command: 'docker build -t app .', reason: 'unsupported-command' }],
            workflows: [{
                path: '.github/workflows/ci.yml',
                categories: ['lint'],
                unrecognized: ['pnpm test:e2e', 'pnpm format', 'pnpm release'],
            }],
            defaultBranchHealth: [{ path: '.github/workflows/ci.yml', conclusion: 'failure' }],
        }))

        expect(lines.length).toBe(5)
        expect(lines[2]).toBe('- 已镜像执行 1 条 / 跳过 1 条')
    })

    it('多仓库共享总行预算并显式收尾', () => {
        const lines = formatCiAlignmentSection([
            makeRecord({ repository: 'owner/a' }),
            makeRecord({
                repository: 'owner/b',
                workflows: [{
                    path: '.github/workflows/ci.yml',
                    categories: ['lint'],
                    unrecognized: ['pnpm test:e2e', 'pnpm format', 'pnpm release'],
                }],
                defaultBranchHealth: [{ path: '.github/workflows/ci.yml', conclusion: 'failure' }],
            }),
        ], 5)

        expect(lines.length).toBeLessThanOrEqual(5)
        expect(lines.join('\n')).toContain('owner/a')
        expect(lines.join('\n')).toContain('其余')
    })

    it('首仓占满预算时仍补「其余仓库」指针（不静默丢弃）', () => {
        const lines = formatCiAlignmentSection([
            makeRecord({
                repository: 'owner/a',
                workflows: [{
                    path: '.github/workflows/ci.yml',
                    categories: ['lint'],
                    unrecognized: ['pnpm test:e2e', 'pnpm format', 'pnpm release'],
                }],
                defaultBranchHealth: [{ path: '.github/workflows/ci.yml', conclusion: 'failure' }],
            }),
            makeRecord({ repository: 'owner/b' }),
        ], 5)

        expect(lines.length).toBe(5)
        expect(lines.join('\n')).toContain('owner/a')
        expect(lines.join('\n')).toContain('其余 2 个仓库')
    })

    it('剩余预算仅 1 行时不保留无仓库标识的命令链（整块跳过只留指针）', () => {
        const first = makeRecord({
            repository: 'owner/a',
            extraInExecution: [],
            workflows: [{
                path: '.github/workflows/ci.yml',
                categories: ['lint', 'build', 'typecheck', 'test'],
                unrecognized: ['pnpm test:e2e'],
            }],
        })
        const lines = formatCiAlignmentSection([first, makeRecord({ repository: 'owner/b' })], 5)

        expect(lines.length).toBeLessThanOrEqual(5)
        expect(lines.join('\n')).toContain('其余 1 个仓库')
        expect(lines.join('\n')).not.toContain('owner/b')
    })

    it('单仓库不渲染「其余仓库」指针', () => {
        expect(formatCiAlignmentSection([makeRecord()], 5).join('\n')).not.toContain('其余')
    })

    it('无记录时返回空数组', () => {
        expect(formatCiAlignmentSection([], 5)).toEqual([])
    })
})

describe('generateMarkdownReport Verification Alignment 段', () => {
    it('渲染仓库 / 状态 / 命令链 / 说明', () => {
        const md = generateMarkdownReport({
            ...EMPTY_RUN_RESULT,
            ciAlignment: [makeRecord()],
        })

        expect(md).toContain('## Verification Alignment')
        expect(md).toContain('| Repository | Status | Commands | Notes |')
        expect(md).toContain('| owner/repo | 一致 |')
        expect(md).toContain('本仓库 CI 未跑 typecheck，本次已验证')
    })

    it('命令含竖线时转义（不破坏表格）', () => {
        const md = generateMarkdownReport({
            ...EMPTY_RUN_RESULT,
            ciAlignment: [makeRecord({ commands: ['pnpm lint | tee log'] })],
        })

        expect(md).toContain('pnpm lint \\| tee log')
    })

    it('无记录时不渲染该段（旧报告格式不变）', () => {
        expect(generateMarkdownReport(EMPTY_RUN_RESULT)).not.toContain('Verification Alignment')
    })

    it('JSON 报告透出 ciAlignment（报告可归档、可复算）', () => {
        const json = JSON.parse(generateJsonReport({ ...EMPTY_RUN_RESULT, ciAlignment: [makeRecord()] }))

        expect(json.ciAlignment[0].repository).toBe('owner/repo')
        expect(json.ciAlignment[0].status).toBe('aligned')
    })
})
