// family-upgrade.test.ts — 家族锁步编排：计划 / registry 解析 / 一次写盘 / 失败与阻断口径。
import { readFileSync, writeFileSync } from 'node:fs'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { FixError, NormalizedSecurityAlert } from '@dependfix/core'

const { mockRunTrackedCommand } = vi.hoisted(() => ({
    mockRunTrackedCommand: vi.fn(),
}))

vi.mock('../runners/process-control', () => ({
    runTrackedCommand: mockRunTrackedCommand,
}))

import { resetFamilyVersionResolvers } from '../fixers/dependency/family-versions'
import { cleanup, createTempProject, type TempProject } from '../fixers/dependency/dependency.test-helpers'
import { attemptFamilyUpgrade } from './family-upgrade'

function okInstallOutcome(): import('../runners/process-control').TrackedCommandResult {
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
}

function packument(versions: Record<string, { peerDependencies?: Record<string, string> }>): Response {
    return new Response(JSON.stringify({ versions }), { status: 200 })
}

function makeCtx(workDir: string, options: { dryRun?: boolean, overrideProtect?: Record<string, string[]> } = {}) {
    return {
        config: { dryRun: options.dryRun ?? false, overrideProtect: options.overrideProtect },
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        workDir,
        allErrors: [] as FixError[],
        summary: { alertsSkipped: 0, alertsSkippedByReason: {} as Record<string, number> },
    }
}

function alert(packageName: string, recommendedVersion: string): NormalizedSecurityAlert {
    return { repository: 'owner/repo', packageName, recommendedVersion } as NormalizedSecurityAlert
}

function readManifest(project: TempProject): Record<string, Record<string, string> | undefined> {
    return JSON.parse(readFileSync(project.pkgPath, 'utf-8')) as Record<string, Record<string, string> | undefined>
}

const projects: TempProject[] = []

function projectWithDevDeps(deps: Record<string, string>, devDeps: Record<string, string>): TempProject {
    const project = createTempProject(deps, { devDeps })
    projects.push(project)
    return project
}

beforeEach(() => {
    mockRunTrackedCommand.mockReset()
    mockRunTrackedCommand.mockResolvedValue(okInstallOutcome())
    vi.stubEnv('npm_config_registry', 'https://registry.test')
    resetFamilyVersionResolvers()
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    resetFamilyVersionResolvers()
    for (const project of projects.splice(0)) {
        cleanup(project)
    }
})

describe('attemptFamilyUpgrade', () => {
    it('is not applicable for non-family packages and for trigger-only manifests', async () => {
        const project = projectWithDevDeps({ lodash: '^4.17.20' }, {})
        const fetchFn = vi.fn()
        vi.stubGlobal('fetch', fetchFn)

        const unknown = await attemptFamilyUpgrade(makeCtx(project.dir), { alert: alert('lodash', '4.17.21') })
        expect(unknown.status).toBe('not-applicable')

        const single = projectWithDevDeps({ vitest: '^3.2.4' }, {})
        const singleAttempt = await attemptFamilyUpgrade(makeCtx(single.dir), { alert: alert('vitest', '4.0.1') })
        expect(singleAttempt.status).toBe('not-applicable')
        expect(fetchFn).not.toHaveBeenCalled()
    })

    it('does nothing in dry-run', async () => {
        const project = projectWithDevDeps({ vitest: '^3.2.4' }, { '@vitest/coverage-v8': '^3.2.4' })
        const fetchFn = vi.fn()
        vi.stubGlobal('fetch', fetchFn)

        const attempt = await attemptFamilyUpgrade(makeCtx(project.dir, { dryRun: true }), {
            alert: alert('vitest', '4.0.1'),
        })

        expect(attempt.status).toBe('not-applicable')
        expect(fetchFn).not.toHaveBeenCalled()
        expect(readManifest(project).devDependencies?.['@vitest/coverage-v8']).toBe('^3.2.4')
    })

    it('upgrades every family member to the same major line with a single install', async () => {
        const project = projectWithDevDeps(
            { vitest: '^3.2.4' },
            { '@vitest/coverage-v8': '^3.2.4', '@vitest/ui': '~3.2.4' },
        )
        const fetchFn = vi.fn().mockImplementation(async (url: string) => {
            if (url.includes('coverage-v8')) {
                return packument({ '4.6.3': {} })
            }
            return packument({ '4.6.0': {} })
        })
        vi.stubGlobal('fetch', fetchFn)

        const ctx = makeCtx(project.dir)
        const attempt = await attemptFamilyUpgrade(ctx, { alert: alert('vitest', '4.0.1') })

        expect(attempt.status).toBe('applied')
        expect(attempt.action?.success).toBe(true)
        expect(attempt.action?.strategy).toBe('family-lockstep')
        expect(attempt.family).toEqual({
            id: 'vitest',
            members: ['vitest', '@vitest/coverage-v8', '@vitest/ui'],
            skipped: ['@vitest/browser'],
        })
        expect(attempt.action?.family).toEqual(attempt.family)
        expect(readManifest(project).dependencies?.vitest).toBe('^4.0.1')
        expect(readManifest(project).devDependencies?.['@vitest/coverage-v8']).toBe('^4.6.3')
        expect(readManifest(project).devDependencies?.['@vitest/ui']).toBe('~4.6.0')
        expect(mockRunTrackedCommand).toHaveBeenCalledTimes(1)
        expect(ctx.allErrors).toHaveLength(0)
        expect(ctx.logger.info).toHaveBeenCalledWith(
            expect.stringContaining('familyMemberSkipped @vitest/browser (not in package.json)'),
        )
    })

    it('honours same-batch alert targets instead of registry resolution', async () => {
        const project = projectWithDevDeps(
            { vitest: '^3.2.4' },
            { '@vitest/coverage-v8': '^3.2.4' },
        )
        const fetchFn = vi.fn()
        vi.stubGlobal('fetch', fetchFn)

        const attempt = await attemptFamilyUpgrade(makeCtx(project.dir), {
            alert: alert('vitest', '4.0.1'),
            alertTargets: { '@vitest/coverage-v8': '4.2.0' },
        })

        expect(attempt.status).toBe('applied')
        expect(readManifest(project).devDependencies?.['@vitest/coverage-v8']).toBe('^4.2.0')
        expect(fetchFn).not.toHaveBeenCalled()
    })

    it('abandons the whole family when the registry is unreachable', async () => {
        const project = projectWithDevDeps({ vitest: '^3.2.4' }, { '@vitest/coverage-v8': '^3.2.4' })
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })))

        const ctx = makeCtx(project.dir)
        const attempt = await attemptFamilyUpgrade(ctx, { alert: alert('vitest', '4.0.1') })

        expect(attempt.status).toBe('failed')
        expect(attempt.action?.success).toBe(false)
        expect(attempt.action?.error).toContain('FAMILY_LOCKSTEP_FAILED')
        expect(attempt.action?.error).toContain('HTTP 500')
        expect(ctx.allErrors.map((error) => error.category)).toEqual(['FAMILY_LOCKSTEP_FAILED'])
        expect(readManifest(project).dependencies?.vitest).toBe('^3.2.4')
        expect(readManifest(project).devDependencies?.['@vitest/coverage-v8']).toBe('^3.2.4')
        expect(mockRunTrackedCommand).not.toHaveBeenCalled()
    })

    it('abandons the family when the peer range rejects the installed related package', async () => {
        const project = createTempProject(
            { '@typescript-eslint/parser': '^8.45.0' },
            { devDeps: { eslint: '^10.0.0' } },
        )
        projects.push(project)
        writeFileSync(project.lockfilePath, `lockfileVersion: '9.0'\neslint@10.0.0:\n`)
        vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => packument({
            '8.46.0': { peerDependencies: { eslint: '^8.57.0 || ^9.0.0' } },
        })))

        const ctx = makeCtx(project.dir)
        const attempt = await attemptFamilyUpgrade(ctx, { alert: alert('@typescript-eslint/parser', '8.46.0') })

        expect(attempt.status).toBe('failed')
        expect(attempt.action?.error).toContain('peer compatibility check failed')
        expect(ctx.allErrors[0]?.category).toBe('FAMILY_LOCKSTEP_FAILED')
        expect(mockRunTrackedCommand).not.toHaveBeenCalled()
    })

    it('accepts eslint 9 with typescript-eslint 8 and writes the whole family', async () => {
        const project = createTempProject(
            { '@typescript-eslint/parser': '^8.45.0' },
            { devDeps: { '@typescript-eslint/eslint-plugin': '^8.45.0', eslint: '^9.10.0' } },
        )
        projects.push(project)
        writeFileSync(project.lockfilePath, `lockfileVersion: '9.0'\neslint@9.10.0:\n`)
        vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => packument({
            '8.46.0': { peerDependencies: { eslint: '^8.57.0 || ^9.0.0' } },
        })))

        const attempt = await attemptFamilyUpgrade(makeCtx(project.dir), {
            alert: alert('@typescript-eslint/parser', '8.46.0'),
        })

        expect(attempt.status).toBe('applied')
        expect(readManifest(project).dependencies?.['@typescript-eslint/parser']).toBe('^8.46.0')
        expect(readManifest(project).devDependencies?.['@typescript-eslint/eslint-plugin']).toBe('^8.46.0')
        expect(readManifest(project).devDependencies?.eslint).toBe('^9.10.0')
    })

    it('abandons exact-version families when a member is above the target line', async () => {
        const project = createTempProject(
            { '@typescript-eslint/parser': '^8.46.0' },
            { devDeps: { '@typescript-eslint/eslint-plugin': '^8.47.0' } },
        )
        projects.push(project)

        const ctx = makeCtx(project.dir)
        const attempt = await attemptFamilyUpgrade(ctx, { alert: alert('@typescript-eslint/parser', '8.46.0') })

        expect(attempt.status).toBe('failed')
        expect(attempt.action?.error).toContain('version conflict')
        expect(ctx.allErrors[0]?.category).toBe('FAMILY_LOCKSTEP_FAILED')
        expect(mockRunTrackedCommand).not.toHaveBeenCalled()
    })

    it('abandons the family when override-protect hits any member (noOp, skipped)', async () => {
        const project = projectWithDevDeps({ vitest: '^3.2.4' }, { '@vitest/coverage-v8': '^3.2.4' })
        const fetchFn = vi.fn()
        vi.stubGlobal('fetch', fetchFn)

        const ctx = makeCtx(project.dir, { overrideProtect: { 'owner/repo': ['@vitest/coverage-v8'] } })
        const attempt = await attemptFamilyUpgrade(ctx, { alert: alert('vitest', '4.0.1') })

        expect(attempt.status).toBe('blocked')
        expect(attempt.action?.noOp).toBe(true)
        expect(attempt.action?.success).toBe(true)
        expect(ctx.allErrors.map((error) => error.category)).toEqual(['OVERRIDE_PROTECTED'])
        expect(ctx.summary.alertsSkipped).toBe(1)
        expect(ctx.summary.alertsSkippedByReason['override-protected']).toBe(1)
        expect(fetchFn).not.toHaveBeenCalled()
        expect(mockRunTrackedCommand).not.toHaveBeenCalled()
    })

    it('marks environmental install failures as ENVIRONMENT_ERROR without attributing the repository', async () => {
        const project = projectWithDevDeps({ vitest: '^3.2.4' }, { '@vitest/coverage-v8': '^3.2.4' })
        vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => packument({ '4.6.3': {} })))
        mockRunTrackedCommand.mockResolvedValue({
            ...okInstallOutcome(),
            exitCode: null,
            signal: 'SIGKILL',
            stderr: '',
        })

        const ctx = makeCtx(project.dir)
        const attempt = await attemptFamilyUpgrade(ctx, { alert: alert('vitest', '4.0.1') })

        expect(attempt.status).toBe('failed')
        expect(attempt.environmental).toBe(true)
        expect(attempt.action?.environmentalFailure).toBe(true)
        expect(ctx.allErrors.map((error) => error.category)).toEqual(['ENVIRONMENT_ERROR'])
    })

    it('records non-environmental install failures as FAMILY_LOCKSTEP_FAILED', async () => {
        const project = projectWithDevDeps({ vitest: '^3.2.4' }, { '@vitest/coverage-v8': '^3.2.4' })
        vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => packument({ '4.6.3': {} })))
        mockRunTrackedCommand.mockResolvedValue({
            ...okInstallOutcome(),
            exitCode: 1,
            stderr: 'ERR_PNPM_LOCKFILE_BREAKING_CHANGE',
        })

        const ctx = makeCtx(project.dir)
        const attempt = await attemptFamilyUpgrade(ctx, { alert: alert('vitest', '4.0.1') })

        expect(attempt.status).toBe('failed')
        expect(attempt.action?.environmentalFailure).toBeUndefined()
        expect(attempt.action?.error).toContain('FAMILY_LOCKSTEP_FAILED')
        expect(ctx.allErrors.map((error) => error.category)).toEqual(['FAMILY_LOCKSTEP_FAILED'])
    })

    it('checks the installed ts-jest peer range before upgrading jest', async () => {
        const project = projectWithDevDeps({ jest: '^29.7.0' }, { 'ts-jest': '^29.1.0' })
        writeFileSync(project.lockfilePath, `lockfileVersion: '9.0'\nts-jest@29.1.0:\n`)
        vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
            expect(url).toContain('ts-jest')
            return packument({ '29.1.0': { peerDependencies: { jest: '^29.0.0' } } })
        }))

        const ctx = makeCtx(project.dir)
        const attempt = await attemptFamilyUpgrade(ctx, { alert: alert('jest', '30.0.0') })

        expect(attempt.status).toBe('failed')
        expect(attempt.action?.error).toContain('peer compatibility check failed')
        expect(mockRunTrackedCommand).not.toHaveBeenCalled()
    })
})
