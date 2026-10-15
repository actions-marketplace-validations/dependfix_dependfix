// upgrade-failure.test.ts — 升级失败的取证留痕（「失败计数 + 日志」成对记录）。
// 覆盖 2026-10-16 生产复盘暴露的缺口：版本化 overrides 安装失败只计数不打日志，
// 「抓到告警、已修复 0」的运行事后没有失败原因可查。
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Logger } from '@dependfix/core'
import { resolveRuntimeConfig } from '../config'
import { recordUpgradeFailure } from './upgrade-failure'
import { DependfixApp } from './index'

// ---------------------------------------------------------------------------
// 禁止真实外联：未匹配请求（含启动安全检查的 GET /user 权限探测）抛错，
// 由 checkTokenPermissions 静默 catch（best-effort 设计），零真实网络调用。
// ---------------------------------------------------------------------------

beforeEach(() => {
    nock.disableNetConnect()
})

// ---------------------------------------------------------------------------
// 单元：recordUpgradeFailure
// ---------------------------------------------------------------------------

describe('recordUpgradeFailure', () => {
    function makeLogger(): Logger & { warn: ReturnType<typeof vi.fn> } {
        return {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        } as never
    }

    it('increments the failure counter and logs the error text', () => {
        const logger = makeLogger()
        const progress = { failed: 0 }

        recordUpgradeFailure({ logger }, progress, 'multi-version', 'fast-uri', 'pnpm install failed: boom')

        expect(progress.failed).toBe(1)
        expect(logger.warn).toHaveBeenCalledWith('[multi-version] fast-uri: upgrade failed — pnpm install failed: boom')
    })

    it('uses a placeholder when the action carries no error text', () => {
        const logger = makeLogger()
        const progress = { failed: 0 }

        recordUpgradeFailure({ logger }, progress, 'member-upgrade', 'vite (packages/web/package.json)', undefined)

        expect(progress.failed).toBe(1)
        expect(logger.warn).toHaveBeenCalledWith(
            '[member-upgrade] vite (packages/web/package.json): upgrade failed — no error detail',
        )
    })
})

// ---------------------------------------------------------------------------
// 集成：版本化 overrides 安装失败（2.0.1 链路）——失败原因必须进执行日志
// ---------------------------------------------------------------------------

const { mockRunVerification, mockApplyVersionedOverrides, mockTryLockfileRepair } = vi.hoisted(() => ({
    mockRunVerification: vi.fn(),
    mockApplyVersionedOverrides: vi.fn(),
    mockTryLockfileRepair: vi.fn(),
}))

vi.mock('../runners/verification-runner', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../runners/verification-runner')>()
    return {
        ...actual,
        runVerification: mockRunVerification,
    }
})

vi.mock('../fixers/dependency', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../fixers/dependency')>()
    return {
        ...actual,
        applyVersionedOverrides: mockApplyVersionedOverrides,
    }
})

// lockfile repair 依赖真实 pnpm 命令，与本测试无关——mock 为成功，聚焦失败留痕
vi.mock('./helpers', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./helpers')>()
    return {
        ...actual,
        tryLockfileRepair: mockTryLockfileRepair,
    }
})

describe('DependfixApp versioned-override install failure', () => {
    let workDir: string

    const installFailureText = 'pnpm install failed: signal SIGTERM, timed out: spawnSync /bin/sh ETIMEDOUT'

    function makeLogger(): Logger & { warn: ReturnType<typeof vi.fn> } {
        return {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        } as never
    }

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), 'dependfix-upgrade-failure-'))
        writeFileSync(join(workDir, 'package.json'), JSON.stringify({
            name: 'fixture',
            version: '1.0.0',
            scripts: { lint: 'exit 0' },
        }, null, 2))
        // 同 major 多版本共存（3.1.0 脆弱 + 3.1.5 安全）→ 版本化 overrides 链路
        writeFileSync(join(workDir, 'pnpm-lock.yaml'), [
            'lockfileVersion: \'9.0\'',
            '',
            '  fast-uri@3.1.0:',
            '    resolution: {integrity: sha512-a}',
            '',
            '  fast-uri@3.1.5:',
            '    resolution: {integrity: sha512-b}',
            '',
        ].join('\n'))

        mockRunVerification.mockReset().mockResolvedValue({
            success: true,
            commandResults: [{
                command: 'pnpm lint',
                exitCode: 0,
                durationMs: 0,
                stdout: '',
                stderr: '',
            }],
        })
        mockApplyVersionedOverrides.mockReset()
        mockTryLockfileRepair.mockReset().mockReturnValue({
            type: 'lockfile-repair',
            repository: 'foo/bar',
            target: 'pnpm-lock.yaml',
            success: true,
            durationMs: 0,
        })
    })

    afterEach(() => {
        nock.cleanAll()
        rmSync(workDir, { recursive: true, force: true })
    })

    it('logs the install failure reason when versioned overrides cannot be applied', async () => {
        nock('https://api.github.com')
            .get('/repos/foo/bar/dependabot/alerts')
            .query({ state: 'open', per_page: '100' })
            .reply(200, [{
                number: 1,
                state: 'open',
                security_advisory: { ghsa_id: 'GHSA-f8p3-7c7w-h6x4', severity: 'high' },
                security_vulnerability: {
                    package: { ecosystem: 'npm', name: 'fast-uri' },
                    severity: 'high',
                    vulnerable_version_range: '< 3.1.5',
                    first_patched_version: { identifier: '3.1.5' },
                },
                dependency: { package: { ecosystem: 'npm', name: 'fast-uri' }, manifest_path: 'pnpm-lock.yaml' },
            }])
        nock('https://api.github.com')
            .get('/repos/foo/bar')
            .reply(200, { default_branch: 'master' })

        mockApplyVersionedOverrides.mockResolvedValue({
            packageName: 'fast-uri',
            fromVersion: '',
            toVersion: '^3.1.5',
            isMajor: false,
            success: false,
            error: installFailureText,
        })

        const logger = makeLogger()
        const config = resolveRuntimeConfig({
            env: {
                GITHUB_TOKEN: 'main-token-value',
                DEPENDFIX_MODE: 'fix',
                DEPENDFIX_REPOSITORIES: 'foo/bar',
            },
        })
        const app = new DependfixApp({ config, workDir, reportOutputDir: join(workDir, 'reports'), logger })
        const { exitCode, result } = await app.run()

        // 动作与计数口径不变：失败动作 + alertsFailed 计数
        const voActions = result.actions.filter((a) => a.strategy === 'versioned-override')
        expect(voActions).toHaveLength(1)
        expect(voActions[0].success).toBe(false)
        expect(result.summary.alertsFailed).toBe(1)
        expect(exitCode).toBe(1)

        // 本次改动核心：失败原因进执行日志（而不是只留在随工作目录清理一并消失的 action 里）
        expect(logger.warn).toHaveBeenCalledWith(`[multi-version] fast-uri: upgrade failed — ${installFailureText}`)
    })
})
