import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Logger } from '@dependfix/core'
import { resolveRuntimeConfig } from '../config'
import { DependfixApp } from './index'

// ---------------------------------------------------------------------------
// 禁止真实外联：未匹配请求（含启动安全检查的 GET /user 权限探测）抛错，
// 由 checkTokenPermissions 静默 catch（best-effort 设计），零真实网络调用。
// ---------------------------------------------------------------------------

beforeEach(() => {
    nock.disableNetConnect()
})

// ---------------------------------------------------------------------------
// 跨线升级集成测试（--allow-major-upgrade）：
// mock 掉真实依赖升级（fixers/dependency 的 upgradeDependency）与验证命令执行
// （verification-runner），验证 app/index.ts 2.0.2 跨线链路语义：
// 仅「根直接依赖 + lockfile 单版本」自动跨线；升级后实例复核；强制完整验证；
// 失败回滚；成员独占 / 间接依赖 / 多版本共存维持人工；默认关闭行为不变。
// ---------------------------------------------------------------------------

const { mockRunVerification, mockUpgradeDependency, mockTryLockfileRepair, mockRunTrackedCommand, mockFamilyResolver } = vi.hoisted(() => ({
    mockRunVerification: vi.fn(),
    mockUpgradeDependency: vi.fn(),
    mockTryLockfileRepair: vi.fn(),
    mockRunTrackedCommand: vi.fn(),
    mockFamilyResolver: { resolve: vi.fn(), describe: vi.fn() },
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
        upgradeDependency: mockUpgradeDependency,
    }
})

// lockfile repair 依赖真实 pnpm 命令，与本测试无关——mock 为成功，聚焦跨线链路
vi.mock('./helpers', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./helpers')>()
    return {
        ...actual,
        tryLockfileRepair: mockTryLockfileRepair,
    }
})

// 家族锁步写入会真实调用 pnpm install —— 在本文件中统一替身为「改写 lockfile 的成功安装」
vi.mock('../runners/process-control', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../runners/process-control')>()
    return {
        ...actual,
        runTrackedCommand: mockRunTrackedCommand,
    }
})

// 家族成员版本解析走 registry（fetch）——注入替身，避免与 nock / Octokit 的全局 fetch 抢拦截
vi.mock('../fixers/dependency/family-versions', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../fixers/dependency/family-versions')>()
    return {
        ...actual,
        getFamilyVersionResolver: () => mockFamilyResolver,
    }
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * 模拟真实 upgradeDependency 行为：修改 package.json 声明（同前缀策略）并返回结果。
 * 同时更新 lockfile 模拟 install 结果：
 * - `keepOldInstance: false`（默认）：单版本跟随——lockfile 中旧实例替换为目标版本
 * - `keepOldInstance: true`：模拟 workspace 成员同 range / 传递依赖 pin 残留——
 *   lockfile 中旧实例保留并追加目标版本（共存状态，触发实例复核回滚）
 */
function mockUpgradeWritingManifest(
    packageName: string,
    targetVersion: string,
    options: { keepOldInstance?: boolean } = {},
) {
    const { keepOldInstance = false } = options
    mockUpgradeDependency.mockImplementation(async ({ workDir }: { workDir: string }) => {
        const pkgPath = join(workDir, 'package.json')
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<string, Record<string, string>>
        const groups = ['dependencies', 'devDependencies', 'optionalDependencies']
        for (const group of groups) {
            const deps = pkg[group]
            if (deps && packageName in deps) {
                const from = deps[packageName]
                deps[packageName] = `^${targetVersion}`
                writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
                // 更新 lockfile 实例：替换旧实例（跟随）或追加目标实例（残留共存）
                const lockPath = join(workDir, 'pnpm-lock.yaml')
                const lockContent = readFileSync(lockPath, 'utf-8')
                // 从 lockfile 提取该包实际实例版本（非声明前缀，如声明 ^5.4.0 而实例 5.4.14）
                const instanceMatch = new RegExp(`^\\s+${packageName}@(\\d+\\.\\d+\\.\\d+):`, 'm').exec(lockContent)
                let updated = lockContent
                if (!keepOldInstance && instanceMatch) {
                    updated = lockContent.replace(
                        `  ${packageName}@${instanceMatch[1]}:`,
                        `  ${packageName}@${targetVersion}:`,
                    )
                }
                const lockContentAfter = keepOldInstance
                    ? `${updated}  ${packageName}@${targetVersion}:\n    resolution: {integrity: sha512-new}\n\n`
                    : updated
                writeFileSync(lockPath, lockContentAfter)
                return {
                    packageName,
                    fromVersion: from,
                    toVersion: `^${targetVersion}`,
                    isMajor: true,
                    success: true,
                }
            }
        }
        return {
            packageName,
            fromVersion: '',
            toVersion: targetVersion,
            isMajor: true,
            success: false,
            error: `${packageName} not found in dependencies`,
        }
    })
}

function verificationResult(success: boolean) {
    /** 默认链 5 条命令（与 DEFAULT_VERIFY_COMMANDS 同序） */
    const chain = [
        'pnpm install --frozen-lockfile',
        'pnpm lint',
        'pnpm build',
        'pnpm typecheck',
        'pnpm test',
    ]
    return {
        success,
        // 与 runVerification「首个失败即停」语义一致：失败时结果集在首个失败命令处截断
        // （全红形态会给读者「后续命令仍被执行」的错觉；断言只消费 success，形态仍须忠实）
        commandResults: (success ? chain : chain.slice(0, 1)).map((command) => ({
            command,
            exitCode: success ? 0 : 1,
            durationMs: 0,
            stdout: '',
            stderr: success ? '' : 'mock verification failure',
        })),
    }
}

function makeViteAlert(number: number, recommended: string): Record<string, unknown> {
    return {
        number,
        state: 'open',
        html_url: `https://github.com/foo/bar/security/dependabot/${number}`,
        security_advisory: { ghsa_id: `GHSA-${number}`, severity: 'high', summary: 'vite vuln' },
        security_vulnerability: {
            package: { ecosystem: 'npm', name: 'vite' },
            severity: 'high',
            vulnerable_version_range: `< ${recommended}`,
            first_patched_version: { identifier: recommended },
        },
        dependency: { package: { ecosystem: 'npm', name: 'vite' }, manifest_path: 'pnpm-lock.yaml' },
    }
}

/** 单版本 lockfile（vite@5.4.14，无其他 major 实例） */
function writeSingleVersionLockfile(workDir: string): void {
    writeFileSync(join(workDir, 'pnpm-lock.yaml'), [
        'lockfileVersion: \'9.0\'',
        '',
        '  vite@5.4.14:',
        '    resolution: {integrity: sha512-a}',
        '',
    ].join('\n'))
}

/** 多版本共存 lockfile（vite@5.4.14 + vite@8.2.0） */
function writeMultiVersionLockfile(workDir: string): void {
    writeFileSync(join(workDir, 'pnpm-lock.yaml'), [
        'lockfileVersion: \'9.0\'',
        '',
        '  vite@5.4.14:',
        '    resolution: {integrity: sha512-a}',
        '',
        '  vite@8.2.0:',
        '    resolution: {integrity: sha512-b}',
        '',
    ].join('\n'))
}

function nockAlerts(alerts: Record<string, unknown>[]): void {
    nock('https://api.github.com')
        .get('/repos/foo/bar/dependabot/alerts')
        .query({ state: 'open', per_page: '100' })
        .reply(200, alerts)
    nock('https://api.github.com')
        .get('/repos/foo/bar')
        .reply(200, { default_branch: 'main' })
}

describe('DependfixApp cross-major upgrade (--allow-major-upgrade)', () => {
    let workDir: string

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), 'dependfix-major-upgrade-'))
        mockRunVerification.mockReset()
        mockUpgradeDependency.mockReset()
        mockTryLockfileRepair.mockReset().mockReturnValue({
            type: 'lockfile-repair',
            repository: 'foo/bar',
            target: 'pnpm-lock.yaml',
            success: true,
            durationMs: 0,
        })
        mockRunVerification.mockResolvedValue(verificationResult(true))
        mockFamilyResolver.resolve.mockReset()
        mockFamilyResolver.describe.mockReset()
        mockRunTrackedCommand.mockReset()
        mockRunTrackedCommand.mockResolvedValue({
            started: true,
            exitCode: 0,
            signal: null,
            timedOut: false,
            aborted: false,
            errno: null,
            stdout: '',
            stderr: '',
            durationMs: 0,
        })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        nock.cleanAll()
        rmSync(workDir, { recursive: true, force: true })
    })

    function makeLogger(): Logger & { warn: ReturnType<typeof vi.fn> } {
        return {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        } as never
    }

    function runApp(overrides: { env?: Record<string, string>, cliOverrides?: NonNullable<Parameters<typeof resolveRuntimeConfig>[0]>['cliOverrides'], logger?: Logger } = {}): Promise<Awaited<ReturnType<DependfixApp['run']>>> {
        const config = resolveRuntimeConfig({
            env: {
                GITHUB_TOKEN: 'main-token-value',
                DEPENDFIX_MODE: 'fix',
                DEPENDFIX_REPOSITORIES: 'foo/bar',
                ...overrides.env,
            },
            cliOverrides: overrides.cliOverrides,
        })
        const app = new DependfixApp({ config, workDir, reportOutputDir: join(workDir, 'reports'), logger: overrides.logger })
        return app.run()
    }

    it('keeps skipping cross-major alerts by default (PR #28 semantics, backward compatible)', async () => {
        // 直接依赖（vite 声明）+ lockfile 单版本 5.4.14，推荐 6.4.3（跨线）
        writeFileSync(join(workDir, 'package.json'), JSON.stringify({
            name: 'fixture',
            version: '1.0.0',
            devDependencies: { vite: '^5.4.0' },
        }, null, 2))
        writeSingleVersionLockfile(workDir)
        nockAlerts([makeViteAlert(1, '6.4.3')])

        const { result } = await runApp({ env: { DEPENDFIX_DRY_RUN: 'true' } })

        // 未开启：跨线告警不修复、不误标 fixed/converged → skipped
        expect(result.summary.alertsSkipped).toBe(1)
        expect(result.summary.alertsSkippedByReason['cross-major']).toBe(1)
        expect(Object.values(result.summary.alertsSkippedByReason).reduce((sum, value) => sum + value, 0)).toBe(1)
        expect(result.summary.alertsConverged).toBe(0)
        expect(result.summary.alertsFixed).toBe(0)
        const majorActions = result.actions.filter((a) => a.strategy === 'major-upgrade')
        expect(majorActions).toHaveLength(0)
    })

    it('marks environmental install failures on the cross-major path and stops remaining chains', async () => {
        writeFileSync(join(workDir, 'package.json'), JSON.stringify({
            name: 'fixture',
            version: '1.0.0',
            scripts: { lint: 'exit 0', build: 'exit 0', typecheck: 'exit 0', test: 'exit 0' },
            devDependencies: { vite: '^5.4.0' },
        }, null, 2))
        writeSingleVersionLockfile(workDir)
        nockAlerts([makeViteAlert(1, '6.4.3')])
        mockUpgradeDependency.mockResolvedValue({
            packageName: 'vite',
            fromVersion: '^5.4.0',
            toVersion: '^6.4.3',
            isMajor: true,
            success: false,
            error: 'pnpm install failed: signal SIGKILL',
            environmental: true,
        })

        const logger = makeLogger()
        const { exitCode, result } = await runApp({ cliOverrides: { allowMajorUpgrade: true }, logger })

        // 不归因：出口码 0，环境性单列可见，失败计数为 0
        expect(exitCode).toBe(0)
        expect(result.summary.environmentalFailures).toBe(1)
        expect(result.summary.alertsFailed).toBe(0)
        expect(result.errors.some((error) => error.category === 'ENVIRONMENT_ERROR')).toBe(true)
        const majorActions = result.actions.filter((a) => a.strategy === 'major-upgrade')
        expect(majorActions).toHaveLength(1)
        expect(majorActions[0]).toMatchObject({ success: false, environmentalFailure: true })
        // 环境性失败后跳过成员 / 分组安装链（仅一次升级尝试）
        expect(mockUpgradeDependency).toHaveBeenCalledTimes(1)
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('dependency install chain stopped (environmental)'))
    })

    it('upgrades direct-dep single-version cross-major alerts with full verification when enabled', async () => {
        writeFileSync(join(workDir, 'package.json'), JSON.stringify({
            name: 'fixture',
            version: '1.0.0',
            scripts: { lint: 'exit 0', build: 'exit 0', typecheck: 'exit 0', test: 'exit 0' },
            devDependencies: { vite: '^5.4.0' },
        }, null, 2))
        writeSingleVersionLockfile(workDir)
        nockAlerts([makeViteAlert(1, '6.4.3')])
        mockUpgradeWritingManifest('vite', '6.4.3')

        const { result } = await runApp({ cliOverrides: { allowMajorUpgrade: true } })

        // 跨线告警进入 2.0.2：真实升级 + 强制完整验证（install+lint+build+typecheck+test）→ fixed
        expect(result.summary.alertsSkipped).toBe(0)
        expect(result.summary.alertsFixed).toBe(1)
        const majorActions = result.actions.filter((a) => a.strategy === 'major-upgrade')
        expect(majorActions).toHaveLength(1)
        expect(majorActions[0]).toMatchObject({
            target: 'vite',
            toVersion: '^6.4.3',
            isMajor: true,
            success: true,
        })
        // 完整验证链（5 条命令：install + lint + build + typecheck + test），非 lint-only
        // （基线采样与修复后验证使用同一链，`find` 命中任一条即可断言链形态）
        const verificationCalls = mockRunVerification.mock.calls
        const fullVerifyCall = verificationCalls.find(([params]) => params.commands.length === 5)
        expect(fullVerifyCall).toBeDefined()
        expect(fullVerifyCall![0].commands).toEqual([
            'pnpm install --frozen-lockfile',
            'pnpm lint',
            'pnpm build',
            'pnpm typecheck',
            'pnpm test',
        ])
        // 声明已更新为 ^6.4.3
        const pkg = JSON.parse(readFileSync(join(workDir, 'package.json'), 'utf-8')) as { devDependencies: Record<string, string> }
        expect(pkg.devDependencies.vite).toBe('^6.4.3')
    })

    it('rolls back the manifest when full verification fails (failed, not fixed)', async () => {
        writeFileSync(join(workDir, 'package.json'), JSON.stringify({
            name: 'fixture',
            version: '1.0.0',
            scripts: { lint: 'exit 0', build: 'exit 0', typecheck: 'exit 0', test: 'exit 0' },
            devDependencies: { vite: '^5.4.0' },
        }, null, 2))
        writeSingleVersionLockfile(workDir)
        nockAlerts([makeViteAlert(1, '6.4.3')])
        mockUpgradeWritingManifest('vite', '6.4.3')
        mockRunVerification
            .mockResolvedValueOnce(verificationResult(true)) // 修复前基线：安装成功（失败来自本次改动）
            .mockResolvedValue(verificationResult(false)) // 修复后验证：失败

        const { result } = await runApp({ cliOverrides: { allowMajorUpgrade: true } })

        expect(result.summary.alertsFailed).toBe(1)
        expect(result.summary.alertsFixed).toBe(0)
        const majorActions = result.actions.filter((a) => a.strategy === 'major-upgrade')
        expect(majorActions).toHaveLength(1)
        expect(majorActions[0].success).toBe(false)
        expect(majorActions[0].error).toContain('rolled back')
        // 声明已回滚到 ^5.4.0
        const pkg = JSON.parse(readFileSync(join(workDir, 'package.json'), 'utf-8')) as { devDependencies: Record<string, string> }
        expect(pkg.devDependencies.vite).toBe('^5.4.0')
    })

    it('logs the install failure reason when the cross-major upgrade cannot be applied', async () => {
        writeFileSync(join(workDir, 'package.json'), JSON.stringify({
            name: 'fixture',
            version: '1.0.0',
            scripts: { lint: 'exit 0', build: 'exit 0', typecheck: 'exit 0', test: 'exit 0' },
            devDependencies: { vite: '^5.4.0' },
        }, null, 2))
        writeSingleVersionLockfile(workDir)
        nockAlerts([makeViteAlert(1, '6.4.3')])
        mockUpgradeDependency.mockResolvedValue({
            packageName: 'vite',
            fromVersion: '^5.4.0',
            toVersion: '^6.4.3',
            isMajor: true,
            success: false,
            error: 'pnpm install failed: signal SIGKILL',
        })

        const logger = makeLogger()
        const { result } = await runApp({ cliOverrides: { allowMajorUpgrade: true }, logger })

        // 失败原因进执行日志（不只在随工作目录清理一并消失的 action 里）
        expect(logger.warn).toHaveBeenCalledWith(
            '[major-upgrade] vite: upgrade failed — pnpm install failed: signal SIGKILL',
        )
        expect(result.summary.alertsFailed).toBe(1)
    })

    it('keeps indirect-dependency cross-major alerts manual even when enabled', async () => {
        // vite 未声明（间接依赖），lockfile 单版本 5.4.14，推荐 6.4.3（跨线）
        writeFileSync(join(workDir, 'package.json'), JSON.stringify({
            name: 'fixture',
            version: '1.0.0',
            dependencies: { '@dependfix/core': '^1.0.0' },
        }, null, 2))
        writeSingleVersionLockfile(workDir)
        nockAlerts([makeViteAlert(1, '6.4.3')])

        const { result } = await runApp({ cliOverrides: { allowMajorUpgrade: true } })

        // 间接依赖跨线：仍 skipped + 人工提示，不自动升级
        expect(result.summary.alertsSkipped).toBe(1)
        expect(result.summary.alertsFixed).toBe(0)
        expect(mockUpgradeDependency).not.toHaveBeenCalled()
    })

    it('keeps multi-version coexistence cross-major alerts manual even when enabled', async () => {
        // vite 直接依赖（^8.2.0）+ lockfile 5.4.14 + 8.2.0 共存，推荐 6.4.3（跨线）
        writeFileSync(join(workDir, 'package.json'), JSON.stringify({
            name: 'fixture',
            version: '1.0.0',
            devDependencies: { vite: '^8.2.0' },
        }, null, 2))
        writeMultiVersionLockfile(workDir)
        nockAlerts([makeViteAlert(1, '6.4.3')])

        const { result } = await runApp({ cliOverrides: { allowMajorUpgrade: true } })

        // 多版本共存：跨线 overrides 会破坏依赖方 range / 全局 override 会降级声明 → 人工
        expect(result.summary.alertsSkipped).toBe(1)
        expect(result.summary.alertsFixed).toBe(0)
        expect(mockUpgradeDependency).not.toHaveBeenCalled()
    })

    it('records planned major-upgrade action in dry-run without writing files', async () => {
        writeFileSync(join(workDir, 'package.json'), JSON.stringify({
            name: 'fixture',
            version: '1.0.0',
            devDependencies: { vite: '^5.4.0' },
        }, null, 2))
        writeSingleVersionLockfile(workDir)
        nockAlerts([makeViteAlert(1, '6.4.3')])

        const { result } = await runApp({ env: { DEPENDFIX_DRY_RUN: 'true' }, cliOverrides: { allowMajorUpgrade: true } })

        expect(result.summary.alertsFixed).toBe(1)
        const majorActions = result.actions.filter((a) => a.strategy === 'major-upgrade')
        expect(majorActions).toHaveLength(1)
        expect(majorActions[0]).toMatchObject({ target: 'vite', isMajor: true, success: true })
        // dry-run 不写盘、不执行升级与验证
        expect(mockUpgradeDependency).not.toHaveBeenCalled()
        expect(mockRunVerification).not.toHaveBeenCalled()
        const pkg = JSON.parse(readFileSync(join(workDir, 'package.json'), 'utf-8')) as { devDependencies: Record<string, string> }
        expect(pkg.devDependencies.vite).toBe('^5.4.0')
    })

    it('rolls back when a vulnerable instance remains after the upgrade (workspace member / transitive pin)', async () => {
        // 根声明 + workspace 成员同 range（docs/ 也声明 ^5.4.0）：跨线只改 root 声明，
        // 成员 pin 仍锁旧 major → lockfile 残留脆弱实例 → 复核回滚，不标 fixed
        writeFileSync(join(workDir, 'package.json'), JSON.stringify({
            name: 'fixture',
            version: '1.0.0',
            scripts: { lint: 'exit 0', build: 'exit 0', typecheck: 'exit 0', test: 'exit 0' },
            devDependencies: { vite: '^5.4.0' },
        }, null, 2))
        writeFileSync(join(workDir, 'pnpm-workspace.yaml'), 'packages:\n  - docs\n')
        mkdirSync(join(workDir, 'docs'))
        writeFileSync(join(workDir, 'docs/package.json'), JSON.stringify({
            name: 'docs',
            version: '1.0.0',
            devDependencies: { vite: '^5.4.0' },
        }, null, 2))
        writeSingleVersionLockfile(workDir)
        nockAlerts([makeViteAlert(1, '6.4.3')])
        mockUpgradeWritingManifest('vite', '6.4.3', { keepOldInstance: true })

        const { result } = await runApp({ cliOverrides: { allowMajorUpgrade: true } })

        // 残留脆弱实例 → 回滚 + failed；跨线链路未执行完整验证
        // （仅修复前基线采样 + 最终 repo 级 verifyProject 各一次，2.0.2 未触发验证）
        expect(result.summary.alertsFailed).toBe(1)
        expect(result.summary.alertsFixed).toBe(0)
        expect(mockRunVerification).toHaveBeenCalledTimes(2)
        const majorActions = result.actions.filter((a) => a.strategy === 'major-upgrade')
        expect(majorActions).toHaveLength(1)
        expect(majorActions[0].success).toBe(false)
        expect(majorActions[0].error).toContain('vulnerable instance(s) remain')
        // 声明与 lockfile 均已回滚
        const pkg = JSON.parse(readFileSync(join(workDir, 'package.json'), 'utf-8')) as { devDependencies: Record<string, string> }
        expect(pkg.devDependencies.vite).toBe('^5.4.0')
        const lockContent = readFileSync(join(workDir, 'pnpm-lock.yaml'), 'utf-8')
        expect(lockContent).not.toContain('vite@6.4.3')
    })

    it('uses the highest recommended version when a package has multiple cross-major alerts', async () => {
        // 同包两条跨线告警（6.4.3 + 6.5.0）：按包取最高目标升级，不静默丢计数
        writeFileSync(join(workDir, 'package.json'), JSON.stringify({
            name: 'fixture',
            version: '1.0.0',
            scripts: { lint: 'exit 0', build: 'exit 0', typecheck: 'exit 0', test: 'exit 0' },
            devDependencies: { vite: '^5.4.0' },
        }, null, 2))
        writeSingleVersionLockfile(workDir)
        nockAlerts([makeViteAlert(1, '6.4.3'), makeViteAlert(2, '6.5.0')])
        mockUpgradeWritingManifest('vite', '6.5.0')

        const { result } = await runApp({ cliOverrides: { allowMajorUpgrade: true } })

        // 升级目标为最高推荐 6.5.0（非首条 6.4.3）
        expect(mockUpgradeDependency).toHaveBeenCalledTimes(1)
        expect(mockUpgradeDependency.mock.calls[0][0].targetVersion).toBe('6.5.0')
        const majorActions = result.actions.filter((a) => a.strategy === 'major-upgrade')
        expect(majorActions).toHaveLength(1)
        expect(majorActions[0]).toMatchObject({ toVersion: '^6.5.0', success: true })
        expect(result.summary.alertsFixed).toBe(1)
    })

    it('keeps member-only declared cross-major alerts manual (root not declared)', async () => {
        // 包仅在 workspace 成员声明（root 未声明）：修复器只改根 manifest → 必然失败，
        // 准入收窄为根直接依赖 → 维持人工（skipped）
        writeFileSync(join(workDir, 'package.json'), JSON.stringify({
            name: 'fixture',
            version: '1.0.0',
            scripts: { lint: 'exit 0', build: 'exit 0', typecheck: 'exit 0', test: 'exit 0' },
            dependencies: { '@dependfix/core': '^1.0.0' },
        }, null, 2))
        writeFileSync(join(workDir, 'pnpm-workspace.yaml'), 'packages:\n  - docs\n')
        mkdirSync(join(workDir, 'docs'))
        writeFileSync(join(workDir, 'docs/package.json'), JSON.stringify({
            name: 'docs',
            version: '1.0.0',
            devDependencies: { vite: '^5.4.0' },
        }, null, 2))
        writeSingleVersionLockfile(workDir)
        nockAlerts([makeViteAlert(1, '6.4.3')])

        const { result } = await runApp({ cliOverrides: { allowMajorUpgrade: true } })

        expect(result.summary.alertsSkipped).toBe(1)
        expect(result.summary.alertsFixed).toBe(0)
        expect(mockUpgradeDependency).not.toHaveBeenCalled()
    })

    it('records cross-major verification actions into the report (auditable evidence)', async () => {
        writeFileSync(join(workDir, 'package.json'), JSON.stringify({
            name: 'fixture',
            version: '1.0.0',
            scripts: { lint: 'exit 0', build: 'exit 0', typecheck: 'exit 0', test: 'exit 0' },
            devDependencies: { vite: '^5.4.0' },
        }, null, 2))
        writeSingleVersionLockfile(workDir)
        nockAlerts([makeViteAlert(1, '6.4.3')])
        mockUpgradeWritingManifest('vite', '6.4.3')

        const { result } = await runApp({ cliOverrides: { allowMajorUpgrade: true } })

        // 跨线验证链（install+lint+build+typecheck+test）作为 verification 动作写入报告（可审计）
        const verifyActions = result.actions.filter((a) => a.type === 'verification')
        expect(verifyActions.length).toBeGreaterThanOrEqual(3)
        const majorVerifyCommands = verifyActions.map((a) => a.target)
        expect(majorVerifyCommands).toContain('pnpm install --frozen-lockfile')
        expect(majorVerifyCommands).toContain('pnpm lint')
        expect(majorVerifyCommands).toContain('pnpm build')
        expect(majorVerifyCommands).toContain('pnpm typecheck')
        // 成功证据可审计：验证动作全部 success
        expect(verifyActions.every((a) => a.success)).toBe(true)
    })

    it('locks family members to the same major line on the cross-major path (vitest 3 -> 4)', async () => {
        writeFileSync(join(workDir, 'package.json'), JSON.stringify({
            name: 'fixture',
            version: '1.0.0',
            scripts: { lint: 'exit 0', build: 'exit 0', typecheck: 'exit 0', test: 'exit 0' },
            devDependencies: { vitest: '^3.2.4', '@vitest/coverage-v8': '^3.2.4' },
        }, null, 2))
        writeFileSync(join(workDir, 'pnpm-lock.yaml'), [
            'lockfileVersion: \'9.0\'',
            '',
            '  vitest@3.2.4:',
            '    resolution: {integrity: sha512-a}',
            '',
            '  "@vitest/coverage-v8@3.2.4":',
            '    resolution: {integrity: sha512-b}',
            '',
        ].join('\n'))
        nockAlerts([{
            number: 1,
            state: 'open',
            html_url: 'https://github.com/foo/bar/security/dependabot/1',
            security_advisory: { ghsa_id: 'GHSA-family', severity: 'high', summary: 'vitest vuln' },
            security_vulnerability: {
                package: { ecosystem: 'npm', name: 'vitest' },
                severity: 'high',
                vulnerable_version_range: '< 4.0.1',
                first_patched_version: { identifier: '4.0.1' },
            },
            dependency: { package: { ecosystem: 'npm', name: 'vitest' }, manifest_path: 'pnpm-lock.yaml' },
        }])
        // registry 解析：coverage-v8 取 4.x 最高稳定版
        mockFamilyResolver.resolve.mockResolvedValue({
            ok: true,
            info: { version: '4.6.3', peerDependencies: {} },
        })
        // 安装替身：把 lockfile 更新为升级后的实例（跨线复核要求脆弱实例消失）
        mockRunTrackedCommand.mockImplementation(async () => {
            writeFileSync(join(workDir, 'pnpm-lock.yaml'), [
                'lockfileVersion: \'9.0\'',
                '',
                '  vitest@4.0.1:',
                '    resolution: {integrity: sha512-a}',
                '',
                '  "@vitest/coverage-v8@4.6.3":',
                '    resolution: {integrity: sha512-b}',
                '',
            ].join('\n'))
            return {
                started: true,
                exitCode: 0,
                signal: null,
                timedOut: false,
                aborted: false,
                errno: null,
                stdout: '',
                stderr: '',
                durationMs: 0,
            }
        })

        const { result } = await runApp({ cliOverrides: { allowMajorUpgrade: true } })

        expect(result.summary.alertsFixed).toBe(1)
        const action = result.actions.find((item) => item.target === 'vitest' && item.strategy === 'major-upgrade')
        expect(action?.success).toBe(true)
        expect(action?.family).toEqual({
            id: 'vitest',
            members: ['vitest', '@vitest/coverage-v8'],
            skipped: ['@vitest/ui', '@vitest/browser'],
        })
        const pkg = JSON.parse(readFileSync(join(workDir, 'package.json'), 'utf-8')) as { devDependencies: Record<string, string> }
        expect(pkg.devDependencies.vitest).toBe('^4.0.1')
        expect(pkg.devDependencies['@vitest/coverage-v8']).toBe('^4.6.3')
        // 单包升级路径未被调用（家族写入一次完成）
        expect(mockUpgradeDependency).not.toHaveBeenCalled()
    })
})
