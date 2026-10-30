// delivery-skip.test.ts — 基线红 / 安装失败的交付降级（`DEPENDFIX_ON_BASELINE_RED`）集成测试。
//
// 覆盖三档语义：
// - `skip`（默认）：审计记录 + 回滚，不建 PR / 不建 issue（行为与引入前一致）
// - `issue`：按失败指纹在落点仓库开 issue；同指纹（含已关闭）不重开
// - `draft`：不回滚，照常提交并创建草稿 PR（正文带草稿说明）
//
// 安装守卫本身由 delivery.test.ts 覆盖；这里 mock `findInstallBlockedReposWithFixes`
// 命中一个仓库，以便在不模拟「多仓基线复用」的前提下验证编排分支。
import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveRuntimeConfig } from '../config'
import { computeDeliverySkipFingerprint, formatDeliverySkipMarker } from '../github/delivery-issue'
import { DependfixApp } from './index'

const {
    mockRunVerification,
    mockUpgradeDependency,
    mockTryLockfileRepair,
    mockCreatePullRequest,
    mockPushBranch,
    mockFindDependfixOpenPR,
    mockRunPrCheckWatch,
} = vi.hoisted(() => ({
    mockRunVerification: vi.fn(),
    mockUpgradeDependency: vi.fn(),
    mockTryLockfileRepair: vi.fn(),
    mockCreatePullRequest: vi.fn(),
    mockPushBranch: vi.fn(),
    mockFindDependfixOpenPR: vi.fn(),
    mockRunPrCheckWatch: vi.fn(),
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

vi.mock('./pr-check-watch-run', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./pr-check-watch-run')>()
    return { ...actual, runPrCheckWatch: mockRunPrCheckWatch }
})

vi.mock('./delivery', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./delivery')>()
    return {
        ...actual,
        // 直接命中「既有安装失败 + 本仓库有修复」分支（真实判定见 delivery.test.ts）：
        // 本用例的基线安装失败会让真实升级链在写盘前停下，故修复动作由 lockfile repair mock 产生
        findInstallBlockedReposWithFixes: () => ['foo/bar'],
        hasDeliverableFixes: () => true,
    }
})

const INSTALL_COMMAND = 'pnpm install --frozen-lockfile'

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

describe('DependfixApp baseline-red delivery degradation', () => {
    let workDir: string

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), 'dependfix-baseline-red-'))
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

        mockRunVerification.mockReset().mockResolvedValue({
            success: false,
            commandResults: [{ command: INSTALL_COMMAND, exitCode: 1, durationMs: 0, stdout: '', stderr: 'ERR_PNPM_OUTDATED_LOCKFILE' }],
        })
        mockUpgradeDependency.mockReset().mockImplementation(({ packageName }: { packageName: string }) => {
            writeFileSync(join(workDir, 'pnpm-lock.yaml'), `lockfileVersion: "9.0"\n# upgraded ${packageName}\n`)
            return { packageName, fromVersion: '0.24.0', toVersion: '0.25.12', isMajor: false, success: true }
        })
        mockTryLockfileRepair.mockReset().mockImplementation(() => {
            writeFileSync(join(workDir, 'pnpm-lock.yaml'), 'lockfileVersion: "9.0"\n# repaired\n')
            return {
                type: 'lockfile-repair',
                repository: 'foo/bar',
                target: 'pnpm-lock.yaml',
                success: true,
                durationMs: 0,
            }
        })
        mockCreatePullRequest.mockReset().mockResolvedValue({ number: 1, htmlUrl: 'https://github.com/foo/bar/pull/1' })
        mockPushBranch.mockReset()
        mockFindDependfixOpenPR.mockReset().mockResolvedValue([])
        mockRunPrCheckWatch.mockReset()
    })

    afterEach(() => {
        nock.cleanAll()
        rmSync(workDir, { recursive: true, force: true })
    })

    function nockRepository(): void {
        nock('https://api.github.com')
            .get('/repos/foo/bar/dependabot/alerts')
            .query({ state: 'open', per_page: '100' })
            .reply(200, [esbuildAlert()])
        nock('https://api.github.com')
            .get('/repos/foo/bar')
            .reply(200, { default_branch: 'master' })
    }

    function runFixAndPr(
        env: Record<string, string> = {},
        configPatch: Record<string, unknown> = {},
    ): Promise<Awaited<ReturnType<DependfixApp['run']>>> {
        const config = {
            ...resolveRuntimeConfig({
                env: {
                    GITHUB_TOKEN: 'token',
                    DEPENDFIX_MODE: 'fix-and-pr',
                    DEPENDFIX_REPOSITORIES: 'foo/bar',
                    ...env,
                },
                cliOverrides: { commands: ['pnpm lint'] },
            }),
            ...configPatch,
        }
        const app = new DependfixApp({ config, workDir, reportOutputDir: join(workDir, 'reports'), commands: ['pnpm lint'] })
        return app.run()
    }

    /** 修复改动是否留在工作区（跳过时回滚 / 草稿时提交；`.gitignore` 与报告目录属运行副产物，不参与断言）。 */
    const lockfileDirty = () => execSync('git status --porcelain pnpm-lock.yaml', { cwd: workDir }).toString().trim() !== ''
    const commitCount = () => Number(execSync('git rev-list --count HEAD', { cwd: workDir }).toString().trim())

    it('预算耗尽（deadlineAt 已过）：不跑验证 / 不交付，写 BUDGET_EXHAUSTED（config → ctx 接线）', async () => {
        nockRepository()
        const { result, exitCode } = await runFixAndPr({}, { deadlineAt: Date.now() - 1 })

        // 预算跳过属跳过类：exit code 保持中性
        expect(exitCode).toBe(0)
        expect(mockCreatePullRequest).not.toHaveBeenCalled()
        expect(result.errors.some((error) => error.category === 'BUDGET_EXHAUSTED')).toBe(true)
        const repoResult = result.repositories[0]
        expect(repoResult?.verificationSkipped).toBe('budget')
        expect(repoResult?.verificationPassed).toBeUndefined()
    }, 30_000)

    it('默认 skip：记录交付跳过 + 回滚，不建 PR / issue', async () => {
        nockRepository()
        const issueScope = nock('https://api.github.com').get('/repos/foo/bar/issues').query(true).reply(200, [])
        const { result, exitCode } = await runFixAndPr()

        // 验收：三档都不改变 exit code（PRE_EXISTING_FAILURE 在跳过类白名单内）
        expect(exitCode).toBe(0)
        expect(mockCreatePullRequest).not.toHaveBeenCalled()
        expect(issueScope.isDone()).toBe(false)
        expect(result.summary.deliverySkipped).toBe(1)
        expect(result.summary.deliverySkipIssues).toBe(0)
        expect(result.summary.deliverySkipDraftPrs).toBe(0)
        expect(result.deliverySkips).toEqual([{
            repositories: ['foo/bar'],
            // mock 的验证结果固定为 install 失败 → 该命令被记为既有失败安装命令
            failingCommands: [INSTALL_COMMAND],
            carrier: { mode: 'skip' },
        }])
        // 改动已回滚：lockfile 不在工作区、没有新增提交，且没有 PR 记录型 action
        expect(lockfileDirty()).toBe(false)
        expect(commitCount()).toBe(1)
        expect(result.actions.some((a) => a.target.startsWith('PR #'))).toBe(false)
        // exit code 中性：PRE_EXISTING_FAILURE 在跳过类白名单内
        expect(result.errors.some((e) => e.category === 'PRE_EXISTING_FAILURE')).toBe(true)
    }, 30_000)

    it('issue 档：按失败指纹创建 issue（marker 置首、带标签），改动仍回滚', async () => {
        nockRepository()
        const fingerprint = computeDeliverySkipFingerprint({ repositories: ['foo/bar'], failingCommands: [INSTALL_COMMAND] })
        const listScope = nock('https://api.github.com')
            .get('/repos/foo/bar/issues')
            .query(true)
            .reply(200, [])
        const createScope = nock('https://api.github.com')
            .post('/repos/foo/bar/issues', (body: Record<string, unknown>) => (
                typeof body.body === 'string'
                && body.body.startsWith(formatDeliverySkipMarker(fingerprint))
                && Array.isArray(body.labels)
            ))
            .reply(201, { number: 7, html_url: 'https://github.com/foo/bar/issues/7' })

        const { result, exitCode } = await runFixAndPr({ DEPENDFIX_ON_BASELINE_RED: 'issue' })

        expect(exitCode).toBe(0)
        expect(listScope.isDone()).toBe(true)
        expect(createScope.isDone()).toBe(true)
        expect(mockCreatePullRequest).not.toHaveBeenCalled()
        expect(result.summary.deliverySkipped).toBe(1)
        expect(result.summary.deliverySkipIssues).toBe(1)
        expect(result.deliverySkips?.[0]?.carrier.issue).toEqual({
            number: 7,
            htmlUrl: 'https://github.com/foo/bar/issues/7',
            created: true,
            fingerprint,
        })
        expect(lockfileDirty()).toBe(false)
        expect(commitCount()).toBe(1)
    }, 30_000)

    it('issue 档：同指纹（已关闭）已存在 → 不重复开', async () => {
        nockRepository()
        const fingerprint = computeDeliverySkipFingerprint({ repositories: ['foo/bar'], failingCommands: [INSTALL_COMMAND] })
        nock('https://api.github.com')
            .get('/repos/foo/bar/issues')
            .query(true)
            .reply(200, [{
                number: 5,
                html_url: 'https://github.com/foo/bar/issues/5',
                state: 'closed',
                body: `${formatDeliverySkipMarker(fingerprint)}\n正文`,
            }])
        const createScope = nock('https://api.github.com')
            .post('/repos/foo/bar/issues')
            .reply(201, { number: 8, html_url: 'https://github.com/foo/bar/issues/8' })

        const { result } = await runFixAndPr({ DEPENDFIX_ON_BASELINE_RED: 'issue' })

        expect(createScope.isDone()).toBe(false)
        expect(result.summary.deliverySkipIssues).toBe(0)
        expect(result.deliverySkips?.[0]?.carrier.issue).toEqual({
            number: 5,
            htmlUrl: 'https://github.com/foo/bar/issues/5',
            created: false,
            fingerprint,
        })
    }, 30_000)

    it('draft 档：不回滚，照常提交并创建草稿 PR（正文带草稿说明，且不等待 check）', async () => {
        nockRepository()
        const { result, exitCode } = await runFixAndPr({
            DEPENDFIX_ON_BASELINE_RED: 'draft',
            DEPENDFIX_WAIT_PR_CHECKS: 'true',
        })

        expect(exitCode).toBe(0)
        expect(mockPushBranch).toHaveBeenCalledTimes(1)
        expect(mockCreatePullRequest).toHaveBeenCalledTimes(1)
        const params = mockCreatePullRequest.mock.calls[0]![0] as { draft?: boolean, body: string }
        expect(params.draft).toBe(true)
        expect(params.body).toContain('草稿交付')

        expect(result.summary.prsOpened).toBe(1)
        expect(result.summary.deliverySkipped).toBe(1)
        expect(result.summary.deliverySkipDraftPrs).toBe(1)
        expect(result.deliverySkips?.[0]?.carrier.draftPr).toEqual({
            number: 1,
            htmlUrl: 'https://github.com/foo/bar/pull/1',
        })
        // 草稿交付不回滚：修复改动已提交（初始提交 + 修复提交）
        expect(lockfileDirty()).toBe(false)
        expect(commitCount()).toBe(2)
        // 草稿 PR 不进入 check 回环（CI 必然复现既有失败，等待只会烧预算）
        expect(mockRunPrCheckWatch).not.toHaveBeenCalled()
        expect(result.summary.checksTimedOut).toBe(0)
    }, 30_000)
})
