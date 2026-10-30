import { describe, expect, it } from 'vitest'
import type { FixAction } from '@dependfix/core'
import {
    collectFailingInstallCommands,
    findInstallBlockedReposWithFixes,
    hasDeliverableFixes,
    hasPreExistingInstallFailure,
    isInstallCommand,
    recordDeliverySkip,
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

describe('collectFailingInstallCommands', () => {
    const installFailure = (repository: string, target = 'pnpm install --frozen-lockfile') => action({
        repository,
        type: 'verification',
        target,
        success: false,
        preExisting: true,
    })

    it('只收集目标仓库的既有失败安装命令，并去重保序', () => {
        expect(collectFailingInstallCommands([
            installFailure('a/b', 'pnpm install --frozen-lockfile'),
            installFailure('a/b', 'pnpm install --frozen-lockfile'),
            installFailure('a/b', 'corepack pnpm@10.5.2 install --frozen-lockfile'),
            installFailure('c/d'),
            action({ repository: 'a/b', type: 'verification', target: 'pnpm lint', success: false, preExisting: true }),
            action({ repository: 'a/b', type: 'verification', target: 'pnpm install', success: false }),
        ], ['a/b'])).toEqual(['pnpm install --frozen-lockfile', 'corepack pnpm@10.5.2 install --frozen-lockfile'])
    })

    it('无命中 → 空数组', () => {
        expect(collectFailingInstallCommands([action({ repository: 'a/b' })], ['a/b'])).toEqual([])
    })
})

describe('recordDeliverySkip', () => {
    it('惰性创建记录数组并返回同一条记录引用（载体可回填）', () => {
        const target: { deliverySkips?: ReturnType<typeof recordDeliverySkip>[] } = {}
        const record = recordDeliverySkip(target, {
            repositories: ['a/b'],
            failingCommands: ['pnpm install --frozen-lockfile'],
            carrier: { mode: 'draft' },
        })
        expect(target.deliverySkips).toHaveLength(1)
        record.carrier.draftPr = { number: 3, htmlUrl: 'https://github.com/a/b/pull/3' }
        expect(target.deliverySkips?.[0]?.carrier.draftPr).toEqual({ number: 3, htmlUrl: 'https://github.com/a/b/pull/3' })
    })
})
