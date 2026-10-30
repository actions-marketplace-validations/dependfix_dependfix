import { describe, expect, it } from 'vitest'
import { resolveRuntimeConfig } from './index'

describe('onBaselineRed（基线红交付降级档位）', () => {

    it('defaults onBaselineRed to skip and reads issue / draft via env', () => {
        expect(resolveRuntimeConfig({
            env: { GITHUB_TOKEN: 't', DEPENDFIX_REPOSITORIES: 'foo/bar' },
        }).onBaselineRed).toBe('skip')
        expect(resolveRuntimeConfig({
            env: {
                GITHUB_TOKEN: 't',
                DEPENDFIX_REPOSITORIES: 'foo/bar',
                DEPENDFIX_ON_BASELINE_RED: ' ISSUE ',
            },
        }).onBaselineRed).toBe('issue')
        expect(resolveRuntimeConfig({
            env: {
                GITHUB_TOKEN: 't',
                DEPENDFIX_REPOSITORIES: 'foo/bar',
                DEPENDFIX_ON_BASELINE_RED: 'draft',
            },
        }).onBaselineRed).toBe('draft')
    })

    it('rejects invalid onBaselineRed', () => {
        expect(() => resolveRuntimeConfig({
            env: {
                GITHUB_TOKEN: 't',
                DEPENDFIX_REPOSITORIES: 'foo/bar',
                DEPENDFIX_ON_BASELINE_RED: 'close',
            },
        })).toThrow('ON_BASELINE_RED must be one of: skip, issue, draft')
    })
})
