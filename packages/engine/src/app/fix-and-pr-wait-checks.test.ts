import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveRuntimeConfig } from '../config'
import { DependfixApp } from './index'

// ---------------------------------------------------------------------------
// PR check 回环在 fix-and-pr 编排层的接线（watch 走真实实现，GitHub 调用用 nock 拦截）：
// - 全部成功 → passed，不评论不关闭，报告 prCheckWatch + prsOpened
// - self_caused + --close-failed-pr → 关闭 PR + 删分支 + 评论，计数进 summary
// 升级 / 验证 / lockfile repair / PR 创建 mock，其余 HTTP 走 nock。
// ---------------------------------------------------------------------------

const { mockRunVerification, mockUpgradeDependency, mockTryLockfileRepair, mockCreatePullRequest, mockPushBranch, mockFindDependfixOpenPR } = vi.hoisted(() => ({
    mockRunVerification: vi.fn(),
    mockUpgradeDependency: vi.fn(),
    mockTryLockfileRepair: vi.fn(),
    mockCreatePullRequest: vi.fn(),
    mockPushBranch: vi.fn(),
    mockFindDependfixOpenPR: vi.fn(),
}))

vi.mock('../runners/verification-runner', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../runners/verification-runner')>()
    return { ...actual, runVerification: mockRunVerification }
})

vi.mock('../fixers/dependency', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../fixers/dependency')>()
    return { ...actual, upgradeDependency: mockUpgradeDependency }
})

vi.mock('./helpers', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./helpers')>()
    return { ...actual, tryLockfileRepair: mockTryLockfileRepair }
})

vi.mock('../github/pr-creator', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../github/pr-creator')>()
    return {
        ...actual,
        createPullRequest: mockCreatePullRequest,
        pushBranch: mockPushBranch,
        findDependfixOpenPR: mockFindDependfixOpenPR,
    }
})

function esbuildAlert(): Record<string, unknown> {
    return {
        number: 1,
        state: 'open',
        dependency: {
            package: { ecosystem: 'npm', name: 'esbuild' },
            manifest_path: 'package.json',
            scope: 'runtime',
            relationship: 'direct',
        },
        security_advisory: {
            ghsa_id: 'GHSA-1234',
            cve_id: null,
            summary: 'esbuild vulnerability',
            description: 'test',
            severity: 'high',
            vulnerabilities: [{
                package: { ecosystem: 'npm', name: 'esbuild' },
                severity: 'high',
                vulnerable_version_range: '< 0.25.12',
                first_patched_version: { identifier: '0.25.12' },
            }],
            cvss: { score: 7.5, vector_string: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N' },
            cwes: [{ cwe_id: 'CWE-79', name: 'test' }],
            identifiers: [{ type: 'GHSA', value: 'GHSA-1234' }],
            references: [{ url: 'https://github.com/advisories/test' }],
            published_at: '2021-01-01T00:00:00Z',
            updated_at: '2021-01-01T00:00:00Z',
            withdrawn_at: null,
        },
        security_vulnerability: {
            package: { ecosystem: 'npm', name: 'esbuild' },
            severity: 'high',
            vulnerable_version_range: '< 0.25.12',
            first_patched_version: { identifier: '0.25.12' },
        },
        vulnerability_manifest_path: 'package.json',
        created_at: '2021-01-01T00:00:00Z',
        updated_at: '2021-01-01T00:00:00Z',
        html_url: 'https://github.com/foo/bar/security/dependabot/1',
    }
}

function verificationOk(): { success: boolean, commandResults: { command: string, exitCode: number, durationMs: number, stdout: string, stderr: string }[] } {
    return {
        success: true,
        commandResults: [{ command: 'pnpm lint', exitCode: 0, durationMs: 0, stdout: '', stderr: '' }],
    }
}

describe('DependfixApp fix-and-pr PR check 回环', () => {
    let workDir: string

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), 'dependfix-wait-checks-'))
        execSync('git init -q', { cwd: workDir })
        execSync('git config user.name test', { cwd: workDir })
        execSync('git config user.email test@test', { cwd: workDir })
        writeFileSync(join(workDir, 'package.json'), JSON.stringify({
            name: 'fixture',
            version: '1.0.0',
            dependencies: { esbuild: '^0.24.0' },
            scripts: { lint: 'exit 0' },
        }))
        writeFileSync(join(workDir, '.gitignore'), 'node_modules\n')
        writeFileSync(join(workDir, 'pnpm-lock.yaml'), 'lockfileVersion: "9.0"\n')
        execSync('git add . && git commit -qm init', { cwd: workDir })

        mockRunVerification.mockReset().mockResolvedValue(verificationOk())
        mockUpgradeDependency.mockReset().mockImplementation(({ packageName }: { packageName: string }) => {
            writeFileSync(join(workDir, 'pnpm-lock.yaml'), `lockfileVersion: "9.0"\n# upgraded ${packageName}\n`)
            return { packageName, fromVersion: '0.24.0', toVersion: '0.25.12', isMajor: false, success: true }
        })
        mockTryLockfileRepair.mockReset().mockReturnValue({
            type: 'lockfile-repair',
            repository: 'foo/bar',
            target: 'pnpm-lock.yaml',
            success: true,
            noOp: true,
            durationMs: 0,
        })
        mockCreatePullRequest.mockReset().mockResolvedValue({
            number: 1,
            htmlUrl: 'https://github.com/foo/bar/pull/1',
            headSha: 'head-sha',
        })
        mockPushBranch.mockReset()
        mockFindDependfixOpenPR.mockReset().mockResolvedValue([])
    })

    afterEach(() => {
        nock.cleanAll()
        rmSync(workDir, { recursive: true, force: true })
    })

    function nockBase(): void {
        nock('https://api.github.com')
            .get('/repos/foo/bar/dependabot/alerts')
            .query({ state: 'open', per_page: '100' })
            .reply(200, [esbuildAlert()])
        nock('https://api.github.com')
            .get('/repos/foo/bar')
            .reply(200, { default_branch: 'master' })
    }

    function nockChecks(ref: string, runs: Array<{ name: string, conclusion: string, url?: string }>): void {
        nock('https://api.github.com')
            .get(`/repos/foo/bar/commits/${ref}/check-runs`)
            .query(true)
            .reply(200, {
                total_count: runs.length,
                check_runs: runs.map((run, index) => ({
                    id: index + 1,
                    name: run.name,
                    status: 'completed',
                    conclusion: run.conclusion,
                    details_url: run.url ?? `https://ci.example/${encodeURIComponent(run.name)}`,
                    output: { title: null, summary: null },
                })),
            })
        nock('https://api.github.com')
            .get(`/repos/foo/bar/commits/${ref}/statuses`)
            .query(true)
            .reply(200, [])
    }

    function runFixAndPr(cliOverrides: { closeFailedPr?: boolean, waitPrChecks?: boolean } = {}): Promise<Awaited<ReturnType<DependfixApp['run']>>> {
        const config = resolveRuntimeConfig({
            env: {
                GITHUB_TOKEN: 'token',
                DEPENDFIX_MODE: 'fix-and-pr',
                DEPENDFIX_REPOSITORIES: 'foo/bar',
            },
            cliOverrides: { commands: ['pnpm lint'], waitPrChecks: true, ...cliOverrides },
        })
        const app = new DependfixApp({ config, workDir, reportOutputDir: join(workDir, 'reports'), commands: ['pnpm lint'] })
        return app.run()
    }

    it('全部 check 成功 → passed：报告 prCheckWatch，不评论不关闭', async () => {
        nockBase()
        nockChecks('head-sha', [{ name: 'Test', conclusion: 'success' }, { name: 'Coverage', conclusion: 'success' }])

        const { result } = await runFixAndPr()

        expect(result.summary.prsOpened).toBe(1)
        expect(result.summary.checksTimedOut).toBe(0)
        expect(result.prCheckWatch?.attempts[0]).toMatchObject({
            pr: { number: 1, htmlUrl: 'https://github.com/foo/bar/pull/1' },
            state: 'passed',
            closed: false,
            commented: false,
        })
    }, 30_000)

    it('去重命中同内容 PR → prsSkippedByFingerprint=1，不建新 PR、不等待', async () => {
        nockBase()
        // 第一次运行拿到真实内容指纹（分支名），再以同内容 PR 命中第二次运行
        const first = await runFixAndPr({ waitPrChecks: false })
        expect(first.result.summary.prsOpened).toBe(1)
        const created = mockCreatePullRequest.mock.calls[0]?.[0] as { headBranch: string }
        mockFindDependfixOpenPR.mockResolvedValue([{
            number: 9,
            htmlUrl: 'https://github.com/foo/bar/pull/9',
            headRef: created.headBranch,
        }])
        // 第二次运行需要有可提交的已跟踪改动，否则会在去重判定前就因「无变更」提前返回
        writeFileSync(join(workDir, 'package.json'), JSON.stringify({
            name: 'fixture',
            version: '1.0.1',
            dependencies: { esbuild: '^0.24.0' },
            scripts: { lint: 'exit 0' },
        }))

        nockBase()
        const second = await runFixAndPr({ waitPrChecks: false })

        expect(second.result.summary.prsSkippedByFingerprint).toBe(1)
        expect(second.result.summary.prsOpened).toBe(0)
        expect(mockCreatePullRequest).toHaveBeenCalledTimes(1)
        expect(second.result.prCheckWatch).toBeUndefined()
    }, 30_000)

    it('self_caused + --close-failed-pr → 关闭 PR、删分支并评论（计数入 summary）', async () => {
        nockBase()
        // head 上 Test 失败；父提交上 Test 绿 → self_caused
        nock('https://api.github.com')
            .get('/repos/foo/bar/commits/head-sha')
            .query(true)
            .reply(200, { sha: 'head-sha', parents: [{ sha: 'parent-sha' }] })
        nockChecks('head-sha', [{ name: 'Test', conclusion: 'failure' }])
        nockChecks('parent-sha', [{ name: 'Test', conclusion: 'success' }])

        const closeScope = nock('https://api.github.com')
            .patch('/repos/foo/bar/pulls/1')
            .reply(200, { number: 1, state: 'closed' })
        const deleteScope = nock('https://api.github.com')
            .delete(/\/repos\/foo\/bar\/git\/refs\/.+/)
            .reply(204)
        const commentScope = nock('https://api.github.com')
            .post('/repos/foo/bar/issues/1/comments')
            .reply(201, { id: 1 })

        const { result } = await runFixAndPr({ closeFailedPr: true })

        expect(result.summary.prsClosedAfterFailure).toBe(1)
        expect(result.prCheckWatch?.attempts[0]).toMatchObject({
            state: 'failed',
            attribution: 'self_caused',
            closed: true,
            commented: true,
        })
        expect(closeScope.isDone()).toBe(true)
        expect(deleteScope.isDone()).toBe(true)
        expect(commentScope.isDone()).toBe(true)
    }, 30_000)
})
