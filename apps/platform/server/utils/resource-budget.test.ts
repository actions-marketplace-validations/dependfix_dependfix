import { describe, expect, it } from 'vitest'
import {
    DEFAULT_SCAN_CONCURRENCY,
    RECOMMENDED_EXECUTION_MEMORY_BYTES,
    formatBytes,
    formatStartupResourceLine,
    formatStartupResourceWarning,
    resolveStartupResource,
} from './resource-budget'

const GiB = 1024 ** 3

describe('resource budget startup probe', () => {
    it('marks a 1 GiB cgroup limit as low and warns without blocking', () => {
        const info = resolveStartupResource({
            env: { DEPENDFIX_ROLE: 'worker' },
            hostTotalBytes: 16 * GiB,
            cgroupState: {
                source: 'cgroup-v2',
                memoryMaxBytes: 1 * GiB,
                currentBytes: 512 * 1024 ** 2,
                oomKillCount: 0,
            },
        })

        expect(info).toMatchObject({
            role: 'worker',
            status: 'low',
            memoryLimitBytes: 1 * GiB,
            memoryLimitSource: 'cgroup-v2',
            concurrency: DEFAULT_SCAN_CONCURRENCY,
            executionPlane: true,
            recommendedBytes: RECOMMENDED_EXECUTION_MEMORY_BYTES,
        })
        expect(formatStartupResourceWarning(info)).toContain('低于执行面建议')
        expect(formatStartupResourceLine(info)).toContain('role=worker')
        expect(formatStartupResourceLine(info)).toContain('recommended=8.0 GiB')
    })

    it('uses the 1 GiB control-plane threshold for an isolated HTTP process', () => {
        const info = resolveStartupResource({
            env: { DEPENDFIX_ROLE: 'server', NUXT_IN_PROCESS_WORKER: 'false' },
            hostTotalBytes: 16 * GiB,
            cgroupState: {
                source: 'cgroup-v2',
                memoryMaxBytes: 1 * GiB,
                currentBytes: 512 * 1024 ** 2,
                oomKillCount: 0,
            },
        })

        expect(info).toMatchObject({
            role: 'server',
            executionPlane: false,
            recommendedBytes: 1 * GiB,
            status: 'ok',
        })
        expect(formatStartupResourceWarning(info)).toBeNull()
        expect(formatStartupResourceLine(info)).toContain('plane=control')
        expect(formatStartupResourceLine(info)).toContain('recommended=1.0 GiB')
    })

    it('accepts 8 GiB and above', () => {
        const info = resolveStartupResource({
            env: {},
            hostTotalBytes: 16 * GiB,
            cgroupState: {
                source: 'cgroup-v2',
                memoryMaxBytes: RECOMMENDED_EXECUTION_MEMORY_BYTES,
                currentBytes: 1 * GiB,
                oomKillCount: 0,
            },
        })
        expect(info.status).toBe('ok')
        expect(formatStartupResourceWarning(info)).toBeNull()
    })

    it('warns for a 512 MiB isolated control plane with the control-plane threshold', () => {
        const info = resolveStartupResource({
            env: { DEPENDFIX_ROLE: 'server', NUXT_IN_PROCESS_WORKER: 'false' },
            hostTotalBytes: 16 * GiB,
            cgroupState: {
                source: 'cgroup-v2',
                memoryMaxBytes: 512 * 1024 ** 2,
                currentBytes: 128 * 1024 ** 2,
                oomKillCount: 0,
            },
        })
        expect(info.status).toBe('low')
        expect(formatStartupResourceWarning(info)).toContain('控制面建议')
    })

    it('falls back to host total when cgroup has no limit (unlimited)', () => {
        const info = resolveStartupResource({
            env: {},
            hostTotalBytes: 4 * GiB,
            cgroupState: {
                source: 'cgroup-v2',
                memoryMaxBytes: null,
                currentBytes: 1 * GiB,
                oomKillCount: 0,
                limitReason: 'unlimited',
            },
        })
        expect(info).toMatchObject({
            status: 'low',
            memoryLimitBytes: 4 * GiB,
            memoryLimitSource: 'host',
            limitReason: 'unlimited',
        })
    })

    it('reports unknown when no memory limit can be read', () => {
        const info = resolveStartupResource({
            env: {},
            hostTotalBytes: 0,
            cgroupState: {
                source: 'none',
                memoryMaxBytes: null,
                currentBytes: null,
                oomKillCount: null,
                degradedReason: 'cgroup memory files not found',
            },
        })
        expect(info.status).toBe('unknown')
        expect(info.memoryLimitBytes).toBeNull()
        expect(formatStartupResourceWarning(info)).toBeNull()
    })
})

describe('formatBytes', () => {
    it('formats bytes and avoids fabricating values', () => {
        expect(formatBytes(0)).toBe('0 B')
        expect(formatBytes(1024)).toBe('1.0 KiB')
        expect(formatBytes(8 * GiB)).toBe('8.0 GiB')
        expect(formatBytes(null)).toBe('unknown')
        expect(formatBytes(Number.NaN)).toBe('unknown')
    })
})
