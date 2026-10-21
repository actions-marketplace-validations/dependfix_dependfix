import { describe, expect, it } from 'vitest'
import { parseRunResource } from './run-resource'

describe('parseRunResource', () => {
    it('parses a resource object', () => {
        expect(parseRunResource(JSON.stringify({
            source: 'cgroup-v2',
            memoryMaxBytes: 8 * 1024 ** 3,
            peakRssBytes: 6 * 1024 ** 3,
            oomKilled: false,
        }))).toMatchObject({
            source: 'cgroup-v2',
            oomKilled: false,
        })
    })

    it('returns null for null / invalid JSON / array / scalar', () => {
        expect(parseRunResource(null)).toBeNull()
        expect(parseRunResource('{not-json')).toBeNull()
        expect(parseRunResource('[]')).toBeNull()
        expect(parseRunResource('42')).toBeNull()
        expect(parseRunResource('"text"')).toBeNull()
    })
})
