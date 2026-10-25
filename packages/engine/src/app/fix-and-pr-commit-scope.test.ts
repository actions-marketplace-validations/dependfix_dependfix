import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveRuntimeConfig } from '../config'
import { DependfixApp } from './index'

// ---------------------------------------------------------------------------
// 提交集合判定在 fix-and-pr 编排层的接线（stageAndCommit 走真实实现）：
// - 未声明的已跟踪改动 → 不 push、不建 PR，错误记 UNEXPECTED_CHANGES（stage=report）
// - 只有生成物 / 未跟踪文件 → NO_CHANGES（不再创建空 PR）
// 升级 / 验证 / lockfile repair / PR 创建之外的 GitHub 调用均 mock 或 fail-open。
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

describe('DependfixApp fix-and-pr 提交集合判定', () => {
    let workDir: string

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), 'dependfix-commit-scope-app-'))
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
        writeFileSync(join(workDir, 'notes.txt'), 'v0\n')
        // 已跟踪的生成物：被构建重写后属「黑名单」——有 tracked 改动但不应进入提交
        writeFileSync(join(workDir, 'auto-imports.d.ts'), '// v1\n')
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
        mockCreatePullRequest.mockReset().mockResolvedValue({ number: 1, htmlUrl: 'https://github.com/foo/bar/pull/1' })
        mockPushBranch.mockReset()
        mockFindDependfixOpenPR.mockReset().mockResolvedValue([])
    })

    afterEach(() => {
        nock.cleanAll()
        rmSync(workDir, { recursive: true, force: true })
    })

    function nockAlerts(alerts: Record<string, unknown>[]): void {
        nock('https://api.github.com')
            .get('/repos/foo/bar/dependabot/alerts')
            .query({ state: 'open', per_page: '100' })
            .reply(200, alerts)
        nock('https://api.github.com')
            .get('/repos/foo/bar')
            .reply(200, { default_branch: 'master' })
    }

    function runFixAndPr(): Promise<Awaited<ReturnType<DependfixApp['run']>>> {
        const config = resolveRuntimeConfig({
            env: {
                GITHUB_TOKEN: 'token',
                DEPENDFIX_MODE: 'fix-and-pr',
                DEPENDFIX_REPOSITORIES: 'foo/bar',
            },
            cliOverrides: { commands: ['pnpm lint'] },
        })
        const app = new DependfixApp({ config, workDir, reportOutputDir: join(workDir, 'reports'), commands: ['pnpm lint'] })
        return app.run()
    }

    it('未声明的已跟踪改动 → 不 push / 不建 PR，记 UNEXPECTED_CHANGES（stage=report）', async () => {
        nockAlerts([esbuildAlert()])
        // 不在白名单、也没有 fixer 声明的已跟踪改动
        writeFileSync(join(workDir, 'notes.txt'), 'hacked\n')

        const { result } = await runFixAndPr()

        expect(mockCreatePullRequest).not.toHaveBeenCalled()
        expect(mockPushBranch).not.toHaveBeenCalled()
        expect(result.errors).toContainEqual(expect.objectContaining({
            category: 'UNEXPECTED_CHANGES',
            stage: 'report',
            message: expect.stringContaining('notes.txt'),
        }))
    }, 30_000)

    it('只有生成物与未跟踪文件 → NO_CHANGES（不建空 PR）', async () => {
        nockAlerts([esbuildAlert()])
        // 升级 mock 改为只写生成物 + 未跟踪文件：白名单内文件没有变化
        mockUpgradeDependency.mockReset().mockImplementation(() => {
            writeFileSync(join(workDir, 'auto-imports.d.ts'), '// regenerated\n')
            writeFileSync(join(workDir, 'scratch.log'), 'noise\n')
            return { packageName: 'esbuild', fromVersion: '0.24.0', toVersion: '0.25.12', isMajor: false, success: true }
        })

        const { result } = await runFixAndPr()

        expect(mockCreatePullRequest).not.toHaveBeenCalled()
        expect(result.errors).toContainEqual(expect.objectContaining({ category: 'NO_CHANGES', stage: 'report' }))
    }, 30_000)
})
