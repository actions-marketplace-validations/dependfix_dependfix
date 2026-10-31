// family-versions.test.ts — 族成员目标版本的 registry 解析（注入 fetch，不触网）。
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    createFamilyVersionResolver,
    getFamilyVersionResolver,
    resetFamilyVersionResolvers,
    resolveRegistryBaseUrl,
} from './family-versions'

function packument(versions: Record<string, { peerDependencies?: Record<string, string> }>): Response {
    return new Response(JSON.stringify({ versions }), { status: 200 })
}

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status })
}

describe('createFamilyVersionResolver', () => {
    it('picks the highest stable version in the target major (numeric sort, pre-release excluded)', async () => {
        const fetchFn = vi.fn().mockResolvedValue(packument({
            '3.2.4': {},
            '4.0.0': {},
            '4.6.3': { peerDependencies: { vite: '^5.0.0 || ^6.0.0' } },
            '4.10.0': {},
            '4.11.0-beta.1': {},
            latest: {},
            '4.9': {},
            '5.0.0': {},
        }))
        const resolver = createFamilyVersionResolver({ fetchFn: fetchFn as unknown as typeof fetch })

        const result = await resolver.resolve({ packageName: '@vitest/coverage-v8', lockstep: 'major', value: '4.0.1' })

        expect(result).toEqual({
            ok: true,
            info: { version: '4.10.0', peerDependencies: {} },
        })
        expect(fetchFn).toHaveBeenCalledWith(
            'https://registry.npmjs.org/%40vitest%2Fcoverage-v8',
            expect.objectContaining({
                headers: { accept: 'application/vnd.npm.install-v1+json' },
                signal: expect.any(AbortSignal),
                redirect: 'error',
            }),
        )
    })

    it('requires the exact version for same-version families', async () => {
        const fetchFn = vi.fn().mockResolvedValue(packument({ '8.46.0': {}, '8.45.0': {} }))
        const resolver = createFamilyVersionResolver({ fetchFn: fetchFn as unknown as typeof fetch })

        expect(await resolver.resolve({
            packageName: '@typescript-eslint/eslint-plugin',
            lockstep: 'version',
            value: '8.46.0',
        })).toEqual({ ok: true, info: { version: '8.46.0', peerDependencies: {} } })

        const missing = await resolver.resolve({
            packageName: '@typescript-eslint/eslint-plugin',
            lockstep: 'version',
            value: '8.47.0',
        })
        expect(missing.ok).toBe(false)
        expect(missing.ok ? '' : missing.error).toContain('8.47.0')
    })

    it('fails when no stable version matches the target major', async () => {
        const fetchFn = vi.fn().mockResolvedValue(packument({ '3.2.4': {}, '4.0.0-beta.1': {} }))
        const resolver = createFamilyVersionResolver({ fetchFn: fetchFn as unknown as typeof fetch })

        const result = await resolver.resolve({ packageName: 'vitest', lockstep: 'major', value: '4.0.0' })

        expect(result.ok).toBe(false)
        expect(result.ok ? '' : result.error).toContain('no stable version')
    })

    it('describes peerDependencies of an exact installed version', async () => {
        const fetchFn = vi.fn().mockResolvedValue(packument({
            '29.1.0': { peerDependencies: { jest: '^29.0.0' } },
        }))
        const resolver = createFamilyVersionResolver({ fetchFn: fetchFn as unknown as typeof fetch })

        expect(await resolver.describe('ts-jest', '29.1.0')).toEqual({
            ok: true,
            info: { version: '29.1.0', peerDependencies: { jest: '^29.0.0' } },
        })
    })

    it('caches the packument per package (single request for repeated lookups)', async () => {
        const fetchFn = vi.fn().mockResolvedValue(packument({ '4.6.3': {} }))
        const resolver = createFamilyVersionResolver({ fetchFn: fetchFn as unknown as typeof fetch })

        await resolver.resolve({ packageName: '@vitest/coverage-v8', lockstep: 'major', value: '4.0.0' })
        await resolver.resolve({ packageName: '@vitest/coverage-v8', lockstep: 'major', value: '4.0.0' })
        await resolver.describe('@vitest/coverage-v8', '4.6.3')

        expect(fetchFn).toHaveBeenCalledTimes(1)
    })

    it('caches in-flight lookups (concurrent requests share one fetch)', async () => {
        const fetchFn = vi.fn().mockResolvedValue(packument({ '4.6.3': {} }))
        const resolver = createFamilyVersionResolver({ fetchFn: fetchFn as unknown as typeof fetch })

        await Promise.all([
            resolver.resolve({ packageName: 'vitest', lockstep: 'major', value: '4.0.0' }),
            resolver.resolve({ packageName: 'vitest', lockstep: 'major', value: '4.0.0' }),
        ])

        expect(fetchFn).toHaveBeenCalledTimes(1)
    })

    it('does not cache failures (a transient error is retried on the next lookup)', async () => {
        const fetchFn = vi.fn()
            .mockRejectedValueOnce(new Error('ECONNRESET'))
            .mockResolvedValueOnce(packument({ '4.6.3': {} }))
        const resolver = createFamilyVersionResolver({ fetchFn: fetchFn as unknown as typeof fetch })

        const first = await resolver.resolve({ packageName: 'vitest', lockstep: 'major', value: '4.0.0' })
        expect(first.ok).toBe(false)

        const second = await resolver.resolve({ packageName: 'vitest', lockstep: 'major', value: '4.0.0' })
        expect(second).toEqual({ ok: true, info: { version: '4.6.3', peerDependencies: {} } })
        expect(fetchFn).toHaveBeenCalledTimes(2)
    })

    it('strips credentials from the registry URL before requesting', async () => {
        const fetchFn = vi.fn().mockResolvedValue(packument({ '4.6.3': {} }))
        const resolver = createFamilyVersionResolver({
            registryBaseUrl: 'https://user:pass@mirror.example.com/npm/',
            fetchFn: fetchFn as unknown as typeof fetch,
        })

        await resolver.resolve({ packageName: 'vitest', lockstep: 'major', value: '4.0.0' })

        const [url] = fetchFn.mock.calls[0] as [string, RequestInit]
        expect(url).toBe('https://mirror.example.com/npm/vitest')
        expect(url).not.toContain('user')
        expect(url).not.toContain('pass')
    })

    it('reports 404 / non-2xx / network failures as errors', async () => {
        const notFound = createFamilyVersionResolver({
            registryBaseUrl: 'https://mirror.example.com/secret-token',
            fetchFn: vi.fn().mockResolvedValue(jsonResponse({ error: 'not found' }, 404)) as unknown as typeof fetch,
        })
        const missing = await notFound.resolve({ packageName: 'vitest', lockstep: 'major', value: '4.0.0' })
        expect(missing.ok ? '' : missing.error).toContain('not found in npm registry')
        // 错误消息只暴露 host，不落 path token
        expect(missing.ok ? '' : missing.error).toContain('mirror.example.com')
        expect(missing.ok ? '' : missing.error).not.toContain('secret-token')

        const serverError = createFamilyVersionResolver({
            fetchFn: vi.fn().mockResolvedValue(jsonResponse({}, 500)) as unknown as typeof fetch,
        })
        const failed = await serverError.resolve({ packageName: 'vitest', lockstep: 'major', value: '4.0.0' })
        expect(failed.ok ? '' : failed.error).toContain('HTTP 500')

        const offline = createFamilyVersionResolver({
            fetchFn: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')) as unknown as typeof fetch,
        })
        const unreachable = await offline.resolve({ packageName: 'vitest', lockstep: 'major', value: '4.0.0' })
        expect(unreachable.ok ? '' : unreachable.error).toContain('failed to fetch npm registry')
        expect(unreachable.ok ? '' : unreachable.error).toContain('ECONNREFUSED')
    })
})

describe('resolveRegistryBaseUrl', () => {
    const dirs: string[] = []

    function tempDir(npmrc?: string): string {
        const dir = mkdtempSync(join(tmpdir(), 'dependfix-family-registry-'))
        if (npmrc !== undefined) {
            writeFileSync(join(dir, '.npmrc'), npmrc)
        }
        dirs.push(dir)
        return dir
    }

    afterEach(() => {
        for (const dir of dirs.splice(0)) {
            rmSync(dir, { recursive: true, force: true })
        }
    })

    it('prefers the environment variable and strips credentials', () => {
        const dir = tempDir('registry=https://registry.example.com/\n')
        expect(resolveRegistryBaseUrl(dir, { npm_config_registry: 'https://user:pass@mirror.example.com/npm/' }))
            .toBe('https://mirror.example.com/npm')
    })

    it('falls back to the target repo .npmrc (last registry line wins)', () => {
        const dir = tempDir([
            '# registry=https://ignored.example.com/',
            'registry=https://first.example.com/',
            'registry="https://second.example.com/"',
        ].join('\n'))
        expect(resolveRegistryBaseUrl(dir, {})).toBe('https://second.example.com')
    })

    it('falls back to the official registry for missing / invalid config', () => {
        expect(resolveRegistryBaseUrl(tempDir(), {})).toBe('https://registry.npmjs.org')
        expect(resolveRegistryBaseUrl(tempDir('registry=ftp://mirror.example.com'), {})).toBe('https://registry.npmjs.org')
    })
})

describe('getFamilyVersionResolver', () => {
    afterEach(() => {
        resetFamilyVersionResolvers()
    })

    it('returns a shared resolver per registry base URL', () => {
        const first = getFamilyVersionResolver('https://registry.example.com')
        const second = getFamilyVersionResolver('https://registry.example.com')
        const other = getFamilyVersionResolver('https://other.example.com')

        expect(first).toBe(second)
        expect(first).not.toBe(other)
        expect(getFamilyVersionResolver()).toBe(getFamilyVersionResolver())
    })
})
