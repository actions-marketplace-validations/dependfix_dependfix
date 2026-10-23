// ci-alignment.test.ts — 验证链与目标仓库 CI 口径的解析 / 比对 / 健康预检口径。
//
// 覆盖验收面：① 单 job lint/build/test → aligned + 缺 typecheck 披露；
// ② 无 workflow / 非法 YAML → unreadable 且不阻断；③ 默认分支 failure 只在真失败时标注。
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Octokit } from '@octokit/rest'
import type { CiWorkflowEvidence } from '@dependfix/core'
import {
    buildCiAlignmentRecord,
    classifyCommandFragment,
    compareVerificationChains,
    fetchDefaultBranchWorkflowHealth,
    MAX_WORKFLOW_BYTES,
    MAX_WORKFLOW_FILES,
    parseWorkflowCommands,
    readWorkflowSources,
    type CiAlignmentLogger,
} from './ci-alignment'

const DEFAULT_CHAIN = [
    'pnpm install --frozen-lockfile',
    'pnpm lint',
    'pnpm build',
    'pnpm typecheck',
    'pnpm test',
]

type WorkflowClient = Pick<Octokit, 'rest'>

function makeClient(runs: Record<string, { conclusion: string | null, html_url?: string, run_number?: number } | Error>): {
    client: WorkflowClient
    calls: Array<Record<string, unknown>>
} {
    const calls: Array<Record<string, unknown>> = []
    const listWorkflowRuns = vi.fn(async (params: Record<string, unknown>) => {
        calls.push(params)
        const path = String(params.workflow_id)
        const found = runs[path]
        if (found instanceof Error) {
            throw found
        }
        return {
            data: {
                workflow_runs: found
                    ? [{ conclusion: found.conclusion, html_url: found.html_url ?? 'https://example.test/run', run_number: found.run_number ?? 1 }]
                    : [],
            },
        }
    })
    return {
        client: { rest: { actions: { listWorkflowRuns } } } as unknown as WorkflowClient,
        calls,
    }
}

function makeLogger(): { logger: CiAlignmentLogger, warn: ReturnType<typeof vi.fn> } {
    const warn = vi.fn()
    return {
        logger: { warn: (message: string) => { warn(message) } },
        warn,
    }
}

describe('classifyCommandFragment', () => {
    it('识别包管理器脚本语义项', () => {
        expect(classifyCommandFragment('pnpm lint')).toEqual({ kind: 'category', category: 'lint' })
        expect(classifyCommandFragment('pnpm run build')).toEqual({ kind: 'category', category: 'build' })
        expect(classifyCommandFragment('npm test')).toEqual({ kind: 'category', category: 'test' })
        expect(classifyCommandFragment('yarn typecheck')).toEqual({ kind: 'category', category: 'typecheck' })
    })

    it('兼容 corepack / workspace 过滤 / 环境变量前缀', () => {
        expect(classifyCommandFragment('corepack pnpm@10.5.2 install --frozen-lockfile')).toEqual({ kind: 'install' })
        expect(classifyCommandFragment('pnpm --filter @dependfix/platform run typecheck')).toEqual({ kind: 'category', category: 'typecheck' })
        expect(classifyCommandFragment('pnpm -r build')).toEqual({ kind: 'category', category: 'build' })
        expect(classifyCommandFragment('CI=1 npm run lint')).toEqual({ kind: 'category', category: 'lint' })
    })

    it('识别直接二进制（npx / tsc / eslint / vitest）', () => {
        expect(classifyCommandFragment('npx vitest run')).toEqual({ kind: 'category', category: 'test' })
        expect(classifyCommandFragment('tsc -b')).toEqual({ kind: 'category', category: 'typecheck' })
        expect(classifyCommandFragment('eslint .')).toEqual({ kind: 'category', category: 'lint' })
    })

    it('非语义项命令不误报（install / audit / echo）', () => {
        expect(classifyCommandFragment('pnpm install')).toEqual({ kind: 'install' })
        expect(classifyCommandFragment('pnpm audit --prod')).toEqual({ kind: 'ignore' })
        expect(classifyCommandFragment('echo hello')).toEqual({ kind: 'ignore' })
    })

    it('脚本名无法归类时显式标为未识别（不得静默当成已覆盖）', () => {
        expect(classifyCommandFragment('pnpm test:e2e')).toEqual({ kind: 'unrecognized', command: 'pnpm test:e2e' })
    })
})

describe('parseWorkflowCommands', () => {
    it('解析 jobs.*.steps[].run 并汇总语义项', () => {
        const content = [
            'name: CI',
            'on: [push]',
            'jobs:',
            '  test:',
            '    runs-on: ubuntu-latest',
            '    steps:',
            '      - uses: actions/checkout@v4',
            '      - run: pnpm install --frozen-lockfile',
            '      - run: |',
            '          pnpm lint',
            '          pnpm build && pnpm test',
        ].join('\n')

        const result = parseWorkflowCommands('.github/workflows/ci.yml', content)

        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.evidence.categories.sort()).toEqual(['build', 'lint', 'test'])
            expect(result.evidence.unrecognized).toEqual([])
        }
    })

    it('记录未识别命令（保留原文，供 PR 正文披露）', () => {
        const result = parseWorkflowCommands('.github/workflows/ci.yml', [
            'jobs:',
            '  ci:',
            '    steps:',
            '      - run: pnpm lint',
            '      - run: pnpm test:e2e',
        ].join('\n'))

        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.evidence.categories).toEqual(['lint'])
            expect(result.evidence.unrecognized).toEqual(['pnpm test:e2e'])
        }
    })

    it('非法 YAML → 失败结果（不抛错）', () => {
        const result = parseWorkflowCommands('.github/workflows/ci.yml', 'jobs: [unclosed')

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toContain('YAML 解析失败')
            expect(result.reason).toContain('.github/workflows/ci.yml')
        }
    })

    it('缺少 jobs → 非 GitHub Actions', () => {
        const result = parseWorkflowCommands('.github/workflows/release.yml', 'name: Release\non: push')

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toContain('非 GitHub Actions workflow')
        }
    })
})

describe('readWorkflowSources', () => {
    let workDir: string

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), 'dependfix-ci-align-'))
    })

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true })
    })

    it('无 .github/workflows → 降级原因', () => {
        const result = readWorkflowSources(workDir)

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toContain('.github/workflows')
        }
    })

    it('目录存在但无 workflow 文件 → 降级原因', () => {
        mkdirSync(join(workDir, '.github', 'workflows'), { recursive: true })
        writeFileSync(join(workDir, '.github', 'workflows', 'README.md'), '# no workflows')

        const result = readWorkflowSources(workDir)

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toContain('workflow 文件')
        }
    })

    it('读取 .yml / .yaml 并按路径排序', () => {
        mkdirSync(join(workDir, '.github', 'workflows'), { recursive: true })
        writeFileSync(join(workDir, '.github', 'workflows', 'b.yaml'), 'jobs: {}')
        writeFileSync(join(workDir, '.github', 'workflows', 'a.yml'), 'jobs: {}')
        writeFileSync(join(workDir, '.github', 'workflows', 'ignore.txt'), 'x')

        const result = readWorkflowSources(workDir)

        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.sources.map((s) => s.path)).toEqual([
                '.github/workflows/a.yml',
                '.github/workflows/b.yaml',
            ])
        }
    })

    it('文件数超上限 → 降级「未能读取」（不静默截断后宣称一致）', () => {
        mkdirSync(join(workDir, '.github', 'workflows'), { recursive: true })
        for (let index = 0; index <= MAX_WORKFLOW_FILES; index += 1) {
            writeFileSync(join(workDir, '.github', 'workflows', `ci-${index}.yml`), 'jobs: {}')
        }

        const result = readWorkflowSources(workDir)

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toContain('数量超出解析上限')
        }
    })

    it('单文件超字节上限 → 降级「未能读取」', () => {
        mkdirSync(join(workDir, '.github', 'workflows'), { recursive: true })
        writeFileSync(join(workDir, '.github', 'workflows', 'ci.yml'), 'x'.repeat(MAX_WORKFLOW_BYTES + 1))

        const result = readWorkflowSources(workDir)

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toContain('超出解析上限')
        }
    })

    it('软链 / 非普通文件 → 降级「未能读取」（不跟随软链，防设备文件无界读取）', () => {
        mkdirSync(join(workDir, '.github', 'workflows'), { recursive: true })
        symlinkSync('/dev/null', join(workDir, '.github', 'workflows', 'evil.yml'))

        const result = readWorkflowSources(workDir)

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toContain('不是普通文件')
        }
    })
})

describe('compareVerificationChains', () => {
    const ciEvidence = (categories: CiWorkflowEvidence['categories']): CiWorkflowEvidence[] => ([
        { path: '.github/workflows/ci.yml', categories, unrecognized: [] },
    ])

    it('CI 为 lint/build/test + 默认链含 typecheck → aligned 且 typecheck 记为本次更严格', () => {
        const comparison = compareVerificationChains(DEFAULT_CHAIN, ciEvidence(['lint', 'build', 'test']))

        expect(comparison.status).toBe('aligned')
        expect(comparison.extraInExecution).toEqual(['typecheck'])
        expect(comparison.missingInExecution).toEqual([])
    })

    it('CI 跑了本次未执行的类别 → differs（口径缺口）', () => {
        const comparison = compareVerificationChains(
            ['pnpm install --frozen-lockfile', 'pnpm lint', 'pnpm build'],
            ciEvidence(['lint', 'build', 'test']),
        )

        expect(comparison.status).toBe('differs')
        expect(comparison.missingInExecution).toEqual(['test'])
    })

    it('CI 无可识别验证命令 → inconclusive（不得宣称一致）', () => {
        const comparison = compareVerificationChains(DEFAULT_CHAIN, [
            { path: '.github/workflows/ci.yml', categories: [], unrecognized: ['pnpm test:e2e'] },
        ])

        expect(comparison.status).toBe('inconclusive')
        expect(comparison.comparisonNote).toContain('未识别')
    })

    it('本次为自定义命令链（无可识别类别）→ inconclusive', () => {
        const comparison = compareVerificationChains(['make verify'], ciEvidence(['lint', 'build', 'test']))

        expect(comparison.status).toBe('inconclusive')
        expect(comparison.comparisonNote).toContain('自定义命令')
    })

    it('install 类命令不参与比对（仅 install 不足以宣称一致）', () => {
        const comparison = compareVerificationChains(['pnpm install --frozen-lockfile'], ciEvidence(['lint', 'build', 'test']))

        expect(comparison.status).toBe('inconclusive')
        expect(comparison.extraInExecution).toEqual([])
    })
})

describe('fetchDefaultBranchWorkflowHealth', () => {
    it('取最近一次运行结论（含 run 链接与序号）', async () => {
        const { client, calls } = makeClient({
            '.github/workflows/ci.yml': { conclusion: 'failure', html_url: 'https://example.test/run/1', run_number: 7 },
        })

        const result = await fetchDefaultBranchWorkflowHealth(['.github/workflows/ci.yml'], {
            client,
            owner: 'owner',
            repo: 'repo',
            defaultBranch: 'main',
        })

        expect(result.health).toEqual([{
            path: '.github/workflows/ci.yml',
            conclusion: 'failure',
            runUrl: 'https://example.test/run/1',
            runNumber: 7,
        }])
        expect(result.unavailableReason).toBeUndefined()
        expect(calls[0]).toMatchObject({
            owner: 'owner',
            repo: 'repo',
            workflow_id: '.github/workflows/ci.yml',
            branch: 'main',
            per_page: 1,
        })
    })

    it('API 失败 / 限流 / 超时 → 只记 warn 与 unavailableReason（不产生失败结论）', async () => {
        const { client } = makeClient({
            '.github/workflows/ci.yml': new Error('API rate limit exceeded'),
        })
        const { logger, warn } = makeLogger()

        const result = await fetchDefaultBranchWorkflowHealth(['.github/workflows/ci.yml'], {
            client,
            owner: 'owner',
            repo: 'repo',
            defaultBranch: 'main',
            logger,
        })

        expect(result.health).toEqual([])
        expect(result.unavailableReason).toContain('rate limit')
        expect(warn).toHaveBeenCalledTimes(1)
        expect(String(warn.mock.calls[0][0])).toContain('健康预检失败')
    })

    it('去重 + 上限约束（最多 3 个 workflow）', async () => {
        const { client, calls } = makeClient({})

        await fetchDefaultBranchWorkflowHealth([
            '.github/workflows/a.yml',
            '.github/workflows/a.yml',
            '.github/workflows/b.yml',
            '.github/workflows/c.yml',
            '.github/workflows/d.yml',
        ], { client, owner: 'owner', repo: 'repo', defaultBranch: 'main' })

        expect(calls).toHaveLength(3)
    })
})

describe('buildCiAlignmentRecord', () => {
    let workDir: string

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), 'dependfix-ci-record-'))
        mkdirSync(join(workDir, '.github', 'workflows'), { recursive: true })
        writeFileSync(join(workDir, '.github', 'workflows', 'ci.yml'), [
            'jobs:',
            '  ci:',
            '    steps:',
            '      - run: pnpm install --frozen-lockfile',
            '      - run: pnpm lint',
            '      - run: pnpm build',
            '      - run: pnpm test',
        ].join('\n'))
    })

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true })
    })

    it('aligned 记录含命令集 / 依据 workflow / 默认分支健康', async () => {
        const { client } = makeClient({
            '.github/workflows/ci.yml': { conclusion: 'failure', run_number: 12 },
        })

        const record = await buildCiAlignmentRecord({
            repository: 'owner/repo',
            workDir,
            commands: DEFAULT_CHAIN,
            client,
            defaultBranch: 'main',
        })

        expect(record.status).toBe('aligned')
        expect(record.commands).toEqual(DEFAULT_CHAIN)
        expect(record.extraInExecution).toEqual(['typecheck'])
        expect(record.workflows.map((w) => w.path)).toEqual(['.github/workflows/ci.yml'])
        expect(record.defaultBranchHealth).toEqual([{
            path: '.github/workflows/ci.yml',
            conclusion: 'failure',
            runUrl: 'https://example.test/run',
            runNumber: 12,
        }])
        expect(record.healthUnavailableReason).toBeUndefined()
    })

    it('无 workflow → unreadable，且不发起健康预检', async () => {
        rmSync(join(workDir, '.github'), { recursive: true, force: true })
        const { client, calls } = makeClient({})

        const record = await buildCiAlignmentRecord({
            repository: 'owner/repo',
            workDir,
            commands: DEFAULT_CHAIN,
            client,
            defaultBranch: 'main',
        })

        expect(record.status).toBe('unreadable')
        expect(record.unreadableReason).toContain('.github/workflows')
        expect(calls).toHaveLength(0)
    })

    it('非法 YAML → unreadable（不阻断、不宣称一致）', async () => {
        writeFileSync(join(workDir, '.github', 'workflows', 'ci.yml'), 'jobs: [broken')

        const record = await buildCiAlignmentRecord({
            repository: 'owner/repo',
            workDir,
            commands: DEFAULT_CHAIN,
            client: null,
        })

        expect(record.status).toBe('unreadable')
        expect(record.unreadableReason).toContain('YAML 解析失败')
    })

    it('无 GitHub 客户端 → 保留本地比对结果，健康预检标记未获取', async () => {
        const record = await buildCiAlignmentRecord({
            repository: 'owner/repo',
            workDir,
            commands: DEFAULT_CHAIN,
            client: null,
        })

        expect(record.status).toBe('aligned')
        expect(record.defaultBranchHealth).toBeUndefined()
        expect(record.healthUnavailableReason).toContain('无 GitHub 客户端')
    })

    it('多文件任一非法 YAML → 整体降级（不拿半个配置宣称一致）', async () => {
        writeFileSync(join(workDir, '.github', 'workflows', 'broken.yml'), 'jobs: [broken')

        const record = await buildCiAlignmentRecord({
            repository: 'owner/repo',
            workDir,
            commands: DEFAULT_CHAIN,
            client: null,
        })

        expect(record.status).toBe('unreadable')
        expect(record.unreadableReason).toContain('broken.yml')
        expect(record.workflows).toEqual([])
    })

    it('默认分支哨兵值 unknown / 仓库标识不可解析 → 不发起健康预检', async () => {
        const { client, calls } = makeClient({})
        const unknownBranch = await buildCiAlignmentRecord({
            repository: 'owner/repo',
            workDir,
            commands: DEFAULT_CHAIN,
            client,
            defaultBranch: 'unknown',
        })
        const localRepo = await buildCiAlignmentRecord({
            repository: 'local',
            workDir,
            commands: DEFAULT_CHAIN,
            client,
            defaultBranch: 'main',
        })

        expect(unknownBranch.healthUnavailableReason).toContain('未取得默认分支')
        expect(unknownBranch.defaultBranch).toBeUndefined()
        expect(localRepo.healthUnavailableReason).toContain('仓库标识不可解析')
        expect(calls).toHaveLength(0)
    })

    it('健康预检 API 失败 → 记录保留、warn 留痕、不产生失败结论', async () => {
        const { client } = makeClient({
            '.github/workflows/ci.yml': new Error('connect ETIMEDOUT'),
        })
        const { logger, warn } = makeLogger()

        const record = await buildCiAlignmentRecord({
            repository: 'owner/repo',
            workDir,
            commands: DEFAULT_CHAIN,
            client,
            defaultBranch: 'main',
            logger,
        })

        expect(record.status).toBe('aligned')
        expect(record.defaultBranchHealth).toBeUndefined()
        expect(record.healthUnavailableReason).toContain('ETIMEDOUT')
        expect(warn).toHaveBeenCalledTimes(1)
    })
})
