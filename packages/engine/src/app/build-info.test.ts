import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Logger } from '@dependfix/core'
import { resolveRuntimeConfig } from '../config'
import {
    formatEngineBuildLine,
    resolvePackageVersion,
    resolveRunBuildInfo,
    UNKNOWN_BUILD_VALUE,
} from './build-info'
import { DependfixApp } from './index'

// pnpm-audit 源：集成用例不需要真实外联（无 token 本地回退），fetcher 用固定空结果替换
const auditFetcherMock = vi.hoisted(() => ({
    fetchPnpmAuditAlerts: vi.fn(),
}))

vi.mock('../alerts/pnpm-audit-fetcher', () => auditFetcherMock)

const enginePackageVersion = (): string => {
    const pkg = JSON.parse(
        readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'),
    ) as { version: string }
    return pkg.version
}

const makeLogger = () => {
    const entries: string[] = []
    const logger: Logger = {
        debug: (message: string) => { entries.push(message) },
        info: (message: string) => { entries.push(message) },
        warn: (message: string) => { entries.push(message) },
        error: (message: string) => { entries.push(message) },
    }
    return { logger, entries }
}

describe('resolveRunBuildInfo', () => {
    it('uses host-injected build version and commit (source=host)', () => {
        expect(resolveRunBuildInfo({ buildVersion: '1.2.3', buildCommit: 'abc1234' }))
            .toEqual({ version: '1.2.3', commit: 'abc1234', source: 'host' })
    })

    it('keeps source=host when the host passes its unknown default', () => {
        // 平台 runtimeConfig 的缺省值就是字符串 unknown：来源仍是宿主，不是引擎包版本
        expect(resolveRunBuildInfo({ buildVersion: UNKNOWN_BUILD_VALUE, buildCommit: UNKNOWN_BUILD_VALUE }))
            .toEqual({ version: UNKNOWN_BUILD_VALUE, commit: UNKNOWN_BUILD_VALUE, source: 'host' })
    })

    it('trims injected values and treats empty / non-string as absent', () => {
        expect(resolveRunBuildInfo({ buildVersion: '  1.2.3  ', buildCommit: '  ' }))
            .toEqual({ version: '1.2.3', commit: UNKNOWN_BUILD_VALUE, source: 'host' })
        expect(resolveRunBuildInfo({ buildVersion: 123, buildCommit: null }))
            .toEqual({ version: enginePackageVersion(), commit: UNKNOWN_BUILD_VALUE, source: 'engine-package' })
    })

    it('falls back to the engine package version for local CLI runs', () => {
        // 单测场景即「CLI / MCP 本地执行」：无宿主注入 → 读引擎自身 package.json
        expect(resolvePackageVersion()).toBe(enginePackageVersion())
        expect(resolveRunBuildInfo())
            .toEqual({ version: enginePackageVersion(), commit: UNKNOWN_BUILD_VALUE, source: 'engine-package' })
    })

    it('falls back to unknown when the package manifest cannot be resolved or parsed', () => {
        const throwMissing = () => {
            throw new Error('MODULE_NOT_FOUND')
        }
        expect(resolvePackageVersion({ resolvePath: throwMissing })).toBe(UNKNOWN_BUILD_VALUE)
        expect(resolvePackageVersion({ resolvePath: () => '/tmp/package.json', readFile: () => '{not json' }))
            .toBe(UNKNOWN_BUILD_VALUE)
        expect(resolvePackageVersion({ resolvePath: () => '/tmp/package.json', readFile: () => '{"version":""}' }))
            .toBe(UNKNOWN_BUILD_VALUE)
    })

    it('formats a grep-friendly startup line with its value source', () => {
        expect(formatEngineBuildLine({ version: '0.4.0', commit: 'unknown', source: 'engine-package' }))
            .toBe('[build] dependfix version=0.4.0 commit=unknown source=engine-package')
        expect(formatEngineBuildLine({ version: '2026.10.23', commit: 'deadbee', source: 'host' }))
            .toBe('[build] dependfix version=2026.10.23 commit=deadbee source=host')
    })
})

describe('DependfixApp startup build receipt', () => {
    let workDir: string | undefined

    afterEach(() => {
        if (workDir) {
            rmSync(workDir, { recursive: true, force: true })
            workDir = undefined
        }
    })

    const runReportOnly = async (configOverrides: { buildVersion?: string, buildCommit?: string }) => {
        workDir = mkdtempSync(join(tmpdir(), 'dependfix-build-info-'))
        auditFetcherMock.fetchPnpmAuditAlerts.mockResolvedValue([])
        const config = resolveRuntimeConfig({
            env: {
                DEPENDFIX_ALERTS_SOURCE: 'pnpm-audit',
                DEPENDFIX_MODE: 'report-only',
                DEPENDFIX_REPOSITORIES: 'owner/repo',
            },
            workDir,
        })
        const { logger, entries } = makeLogger()
        const app = new DependfixApp({
            config: { ...config, ...configOverrides },
            workDir,
            reportOutputDir: join(workDir, 'reports'),
            logger,
        })
        await app.run()
        return entries
    }

    it('logs the host build version and commit before the run header', async () => {
        const entries = await runReportOnly({ buildVersion: '2026.10.23', buildCommit: 'deadbee' })

        const buildLine = entries.find((entry) => entry.startsWith('[build] '))
        expect(buildLine).toBe('[build] dependfix version=2026.10.23 commit=deadbee source=host')
        expect(entries.indexOf(String(buildLine)))
            .toBeLessThan(entries.findIndex((entry) => entry.startsWith('Starting dependfix run ')))
    }, 30_000)

    it('falls back to the engine package version when the host injects nothing', async () => {
        const entries = await runReportOnly({})

        expect(entries.find((entry) => entry.startsWith('[build] ')))
            .toBe(`[build] dependfix version=${enginePackageVersion()} commit=${UNKNOWN_BUILD_VALUE} source=engine-package`)
    }, 30_000)
})
