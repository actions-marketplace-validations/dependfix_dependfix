import { describe, expect, it, vi } from 'vitest'
import {
    assertRepositorySet,
    cleanRepositoryExtras,
    diffRepositorySet,
    formatRepositorySetDiff,
    repositoryKey,
    type RepositoryKey,
    type VisualRepositoryClient,
} from './visual-repository-set'

const EXPECTED: RepositoryKey[] = [
    { owner: 'acme', name: 'web-app' },
    { owner: 'acme', name: 'api-gateway' },
    { owner: 'acme', name: 'unlabeled-tool' },
]

const createClient = (initial: RepositoryKey[]) => {
    let repos = [...initial]
    const list = vi.fn(async () => [...repos])
    const remove = vi.fn(async (toRemove: RepositoryKey[]) => {
        const keys = new Set(toRemove.map(repositoryKey))
        repos = repos.filter((repo) => !keys.has(repositoryKey(repo)))
    })
    const client: VisualRepositoryClient = { list, remove }
    return { client, list, remove, repos: () => repos }
}

describe('diffRepositorySet', () => {
    it('returns empty diff for identical sets', () => {
        expect(diffRepositorySet(EXPECTED, EXPECTED)).toEqual({ extra: [], missing: [] })
    })

    it('reports extra repositories only', () => {
        const actual = [...EXPECTED, { owner: 'parp3', name: 'probe-a' }, { owner: 'parp3', name: 'probe-b' }]
        expect(diffRepositorySet(actual, EXPECTED)).toEqual({
            extra: [
                { owner: 'parp3', name: 'probe-a' },
                { owner: 'parp3', name: 'probe-b' },
            ],
            missing: [],
        })
    })

    it('reports missing repositories only', () => {
        const actual = EXPECTED.slice(0, 1)
        expect(diffRepositorySet(actual, EXPECTED)).toEqual({
            extra: [],
            missing: [
                { owner: 'acme', name: 'api-gateway' },
                { owner: 'acme', name: 'unlabeled-tool' },
            ],
        })
    })

    it('deduplicates input and sorts both sides by repository key', () => {
        const actual = [
            { owner: 'zeta', name: 'extra' },
            { owner: 'acme', name: 'web-app' },
            { owner: 'zeta', name: 'extra' },
        ]
        const diff = diffRepositorySet(actual, EXPECTED)
        expect(diff.extra).toEqual([{ owner: 'zeta', name: 'extra' }])
        expect(diff.missing.map(repositoryKey)).toEqual(['acme/api-gateway', 'acme/unlabeled-tool'])
    })
})

describe('cleanRepositoryExtras', () => {
    it('removes only extra repositories and leaves the allowlist untouched', async () => {
        const extras = [{ owner: 'parp3', name: 'probe' }]
        const fake = createClient([...EXPECTED, ...extras])

        await expect(cleanRepositoryExtras(fake.client, EXPECTED)).resolves.toEqual(extras)
        expect(fake.remove).toHaveBeenCalledTimes(1)
        expect(fake.remove).toHaveBeenCalledWith(extras)
        expect(fake.repos()).toEqual(EXPECTED)
    })

    it('is idempotent: a second run performs no delete', async () => {
        const fake = createClient([...EXPECTED, { owner: 'parp3', name: 'probe' }])

        await cleanRepositoryExtras(fake.client, EXPECTED)
        await expect(cleanRepositoryExtras(fake.client, EXPECTED)).resolves.toEqual([])
        expect(fake.remove).toHaveBeenCalledTimes(1)
    })

    it('does not delete when the set is already exact', async () => {
        const fake = createClient(EXPECTED)
        await expect(cleanRepositoryExtras(fake.client, EXPECTED)).resolves.toEqual([])
        expect(fake.remove).not.toHaveBeenCalled()
    })

    it('does not clean a missing-only set (reset injects fixtures later)', async () => {
        const fake = createClient([])
        await expect(cleanRepositoryExtras(fake.client, EXPECTED)).resolves.toEqual([])
        expect(fake.remove).not.toHaveBeenCalled()
    })

    it('propagates delete failures', async () => {
        const client: VisualRepositoryClient = {
            list: async () => [{ owner: 'parp3', name: 'probe' }],
            remove: async () => {
                throw new Error('DELETE failed')
            },
        }
        await expect(cleanRepositoryExtras(client, EXPECTED)).rejects.toThrow('DELETE failed')
    })

    it('cleans extras even when some expected repositories are missing', async () => {
        const fake = createClient([{ owner: 'acme', name: 'web-app' }, { owner: 'parp3', name: 'probe' }])

        await expect(cleanRepositoryExtras(fake.client, EXPECTED)).resolves.toEqual([{ owner: 'parp3', name: 'probe' }])
        expect(fake.remove).toHaveBeenCalledWith([{ owner: 'parp3', name: 'probe' }])
    })

    it('refuses an empty allowlist instead of cleaning the whole visual database', async () => {
        const fake = createClient(EXPECTED)
        await expect(cleanRepositoryExtras(fake.client, [])).rejects.toThrow('allowlist is empty')
        expect(fake.remove).not.toHaveBeenCalled()
    })

    it('refuses an invalid allowlist entry before deleting anything', async () => {
        const fake = createClient(EXPECTED)
        await expect(cleanRepositoryExtras(fake.client, [{ owner: '', name: 'web-app' }])).rejects.toThrow(
            'invalid repository',
        )
        expect(fake.remove).not.toHaveBeenCalled()
    })
})

describe('assertRepositorySet', () => {
    it('resolves for an exact set', async () => {
        const fake = createClient(EXPECTED)
        await expect(assertRepositorySet(fake.client, EXPECTED)).resolves.toBeUndefined()
    })

    it('throws a diagnostic error for extra repositories', async () => {
        const fake = createClient([...EXPECTED, { owner: 'parp3', name: 'probe' }])
        await expect(assertRepositorySet(fake.client, EXPECTED)).rejects.toThrow(/parp3\/probe/)
    })

    it('throws a diagnostic error for missing repositories', async () => {
        const fake = createClient([{ owner: 'acme', name: 'web-app' }])
        const error = await assertRepositorySet(fake.client, EXPECTED).catch((e: unknown) => e)
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('acme/api-gateway')
        expect((error as Error).message).toContain('acme/unlabeled-tool')
    })

    it('refuses an empty allowlist', async () => {
        const fake = createClient([])
        await expect(assertRepositorySet(fake.client, [])).rejects.toThrow('allowlist is empty')
    })

    it('deduplicates the allowlist count in diagnostics', () => {
        const message = formatRepositorySetDiff({ extra: [], missing: [] }, [...EXPECTED, EXPECTED[0]!])
        expect(message).toContain('共 3 个')
    })
})

describe('formatRepositorySetDiff', () => {
    it('lists allowed set, extra and missing entries', () => {
        const message = formatRepositorySetDiff(
            { extra: [{ owner: 'parp3', name: 'probe' }], missing: [{ owner: 'acme', name: 'web-app' }] },
            EXPECTED,
        )
        expect(message).toContain('多余（非 fixtures）: parp3/probe')
        expect(message).toContain('缺失（fixtures 未注入）: acme/web-app')
        expect(message).toContain('允许集合（VISUAL_FIXTURES.repos，共 3 个）')
        expect(message).toContain('VISUAL_FIXTURES_AUTO_CLEAN=0')
    })
})
