import { describe, expect, it } from 'vitest'
import type { FixAction } from '@dependfix/core'
import {
    findInstallBlockedReposWithFixes,
    hasDeliverableFixes,
    hasPreExistingInstallFailure,
    isInstallCommand,
} from './delivery'

function action(overrides: Partial<FixAction>): FixAction {
    return {
        type: 'dependency-upgrade',
        repository: 'foo/bar',
        target: 'lodash',
        success: true,
        durationMs: 1,
        ...overrides,
    }
}

describe('isInstallCommand', () => {
    it('matches default and toolchain install commands', () => {
        expect(isInstallCommand('pnpm install --frozen-lockfile')).toBe(true)
        expect(isInstallCommand('corepack pnpm@10.5.2 install --frozen-lockfile')).toBe(true)
    })

    it('does not match other commands', () => {
        expect(isInstallCommand('pnpm lint')).toBe(false)
        expect(isInstallCommand('npm install')).toBe(false)
        expect(isInstallCommand('pnpm install-something')).toBe(false)
    })
})

describe('hasDeliverableFixes', () => {
    it('counts successful dependency / code-scanning / lockfile actions', () => {
        expect(hasDeliverableFixes([action({})])).toBe(true)
        expect(hasDeliverableFixes([action({ type: 'code-scanning-fix', target: 'js/x' })])).toBe(true)
        expect(hasDeliverableFixes([action({ type: 'lockfile-repair', target: 'pnpm-lock.yaml' })])).toBe(true)
    })

    it('ignores noOp, PR records, AI process actions and failed actions', () => {
        expect(hasDeliverableFixes([action({ noOp: true })])).toBe(false)
        expect(hasDeliverableFixes([action({ target: 'PR #12' })])).toBe(false)
        expect(hasDeliverableFixes([action({ strategy: 'ai-patch' })])).toBe(false)
        expect(hasDeliverableFixes([action({ strategy: 'ai-suggestion' })])).toBe(false)
        expect(hasDeliverableFixes([action({ success: false })])).toBe(false)
        expect(hasDeliverableFixes([action({ type: 'verification', target: 'pnpm test' })])).toBe(false)
    })
})

describe('hasPreExistingInstallFailure', () => {
    it('detects a pre-existing install verification failure', () => {
        expect(hasPreExistingInstallFailure([
            action({
                type: 'verification',
                target: 'pnpm install --frozen-lockfile',
                success: false,
                preExisting: true,
            }),
        ])).toBe(true)
    })

    it('ignores new install failures and other pre-existing commands', () => {
        expect(hasPreExistingInstallFailure([
            action({ type: 'verification', target: 'pnpm install --frozen-lockfile', success: false }),
        ])).toBe(false)
        expect(hasPreExistingInstallFailure([
            action({ type: 'verification', target: 'pnpm lint', success: false, preExisting: true }),
        ])).toBe(false)
        expect(hasPreExistingInstallFailure([
            action({ type: 'verification', target: 'pnpm install --frozen-lockfile', success: true, preExisting: true }),
        ])).toBe(false)
    })
})

describe('findInstallBlockedReposWithFixes', () => {
    const installFailure = (repository: string) => action({
        repository,
        type: 'verification',
        target: 'pnpm install --frozen-lockfile',
        success: false,
        preExisting: true,
    })

    it('blocks only repos that both have a fix and a pre-existing install failure', () => {
        expect(findInstallBlockedReposWithFixes([
            action({ repository: 'a/b' }),
            installFailure('a/b'),
        ])).toEqual(['a/b'])
    })

    it('does not block a repo with fixes because another repo has an install failure', () => {
        expect(findInstallBlockedReposWithFixes([
            action({ repository: 'a/b' }),
            installFailure('c/d'),
        ])).toEqual([])
    })

    it('does not block repos whose install failure has no deliverable fix', () => {
        expect(findInstallBlockedReposWithFixes([
            installFailure('a/b'),
        ])).toEqual([])
    })
})
