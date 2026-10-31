import { describe, expect, it, vi } from 'vitest'
import type { Octokit } from '@octokit/rest'
import type { Logger, NormalizedSecurityAlert } from '@dependfix/core'
import type { ClosedAttemptIndex } from '../github/attempt-history'
import { computeAttemptKey } from '../github/fix-fingerprint'
import {
    REPEATED_FAILURE_ATTEMPT_LIMIT,
    applyRepeatedFailureSkips,
    isRepeatedFailureTrackingEnabled,
    resolvePlanStrategy,
    type RepeatedFailureContext,
} from './repeated-failure'

const REPO = 'owner/repo'

function makeAlert(overrides: Partial<NormalizedSecurityAlert> = {}): NormalizedSecurityAlert {
    return {
        id: 1,
        source: 'dependabot',
        repository: REPO,
        defaultBranch: 'main',
        severity: 'high',
        packageEcosystem: 'npm',
        packageName: 'lodash',
        manifestPath: 'package.json',
        ruleId: 'CVE-2021-23337',
        summary: 'Command injection in lodash',
        htmlUrl: 'https://github.com/owner/repo/security/dependabot/1',
        fixable: true,
        fixStrategy: 'upgrade',
        recommendedVersion: '4.17.21',
        upstreamId: 'dependabot:1',
        ...overrides,
    }
}

interface Harness {
    ctx: RepeatedFailureContext
    index: ClosedAttemptIndex
    countCalls: ReturnType<typeof vi.fn>
}

function makeHarness(options: { closedCount?: number, retryFailed?: boolean, mode?: string } = {}): Harness {
    const ctx: RepeatedFailureContext = {
        config: { mode: options.mode ?? 'fix-and-pr', retryFailed: options.retryFailed ?? false },
        logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() } as unknown as Logger,
        summary: { alertsSkipped: 0, alertsSkippedByReason: {} },
        allActions: [],
        attemptTracking: [],
        alertOutcomes: new Map(),
    }
    const countCalls = vi.fn(async () => options.closedCount ?? 0)
    const index = { closedAttemptCount: countCalls } as unknown as ClosedAttemptIndex
    return { ctx, index, countCalls }
}

function run(h: Harness, overrides: Partial<Parameters<typeof applyRepeatedFailureSkips>[0]> = {}) {
    return applyRepeatedFailureSkips({
        ctx: h.ctx,
        index: h.index,
        client: {} as Octokit,
        repo: REPO,
        attemptRepo: REPO,
        rootAlerts: [makeAlert()],
        memberAlerts: [],
        ...overrides,
    })
}

describe('resolvePlanStrategy', () => {
    it('成员 manifest 优先（与成员链一致）', () => {
        expect(resolvePlanStrategy(makeAlert({ dependencyType: 'transitive' }), { memberManifest: true }))
            .toBe('member-upgrade')
    })

    it('间接依赖走 overrides', () => {
        expect(resolvePlanStrategy(makeAlert({ dependencyType: 'transitive' }))).toBe('override')
    })

    it('家族成员走家族锁步', () => {
        expect(resolvePlanStrategy(makeAlert({ packageName: 'vitest' }))).toBe('family-lockstep')
    })

    it('其余为直接升级', () => {
        expect(resolvePlanStrategy(makeAlert({ dependencyType: 'direct' }))).toBe('direct-upgrade')
        expect(resolvePlanStrategy(makeAlert({ dependencyType: undefined }))).toBe('direct-upgrade')
    })
})

describe('isRepeatedFailureTrackingEnabled', () => {
    const makeCtx = (mode = 'fix-and-pr'): RepeatedFailureContext => ({
        config: { mode },
        logger: { warn: vi.fn() } as unknown as Logger,
        summary: { alertsSkipped: 0, alertsSkippedByReason: {} },
        allActions: [],
    })
    const base = () => ({
        ctx: makeCtx(),
        repo: REPO,
        attemptRepo: REPO,
        rootAlerts: [],
        memberAlerts: [],
        index: {} as ClosedAttemptIndex,
        client: {} as Octokit,
    })

    it('fix-and-pr + 索引 + 客户端 + 落点仓库 → 启用', () => {
        expect(isRepeatedFailureTrackingEnabled(base())).toBe(true)
    })

    it('非 fix-and-pr / 缺索引 / 缺客户端 / 非落点仓库 → 不启用', () => {
        expect(isRepeatedFailureTrackingEnabled({ ...base(), ctx: makeCtx('fix') })).toBe(false)
        expect(isRepeatedFailureTrackingEnabled({ ...base(), index: undefined })).toBe(false)
        expect(isRepeatedFailureTrackingEnabled({ ...base(), client: null })).toBe(false)
        expect(isRepeatedFailureTrackingEnabled({ ...base(), repo: 'owner/other' })).toBe(false)
        expect(isRepeatedFailureTrackingEnabled({ ...base(), attemptRepo: undefined })).toBe(false)
    })
})

describe('applyRepeatedFailureSkips', () => {
    it('第 1 / 2 次尝试放行并记录序号', async () => {
        for (const [closedCount, expectedAttempt] of [[0, 1], [1, 2]] as const) {
            const h = makeHarness({ closedCount })
            const result = await run(h)
            expect(result.rootAlerts).toHaveLength(1)
            expect(h.ctx.attemptTracking).toEqual([{
                repository: REPO,
                packageName: 'lodash',
                key: computeAttemptKey({
                    source: 'dependabot',
                    packageName: 'lodash',
                    targetVersion: '4.17.21',
                    planStrategy: 'direct-upgrade',
                }),
                attempt: expectedAttempt,
                status: 'attempt',
            }])
            expect(h.ctx.summary.alertsSkipped).toBe(0)
            expect(h.ctx.allActions).toHaveLength(0)
        }
    })

    it('第 3 次（已关闭 2 个）跳过：noOp 动作 + 跳过计数 + 从分区移除', async () => {
        const h = makeHarness({ closedCount: REPEATED_FAILURE_ATTEMPT_LIMIT })
        const result = await run(h)

        expect(result.rootAlerts).toEqual([])
        expect(h.ctx.allActions).toEqual([expect.objectContaining({
            type: 'dependency-upgrade',
            target: 'lodash',
            success: true,
            noOp: true,
            strategy: 'repeated-failure',
        })])
        expect(h.ctx.summary.alertsSkipped).toBe(1)
        expect(h.ctx.summary.alertsSkippedByReason).toEqual({ 'repeated-failure': 1 })
        // 不变式：分组之和 === 总数
        const grouped = Object.values(h.ctx.summary.alertsSkippedByReason ?? {}).reduce((sum, n) => sum + (n ?? 0), 0)
        expect(grouped).toBe(h.ctx.summary.alertsSkipped)
        expect(h.ctx.attemptTracking?.[0]?.status).toBe('skipped')
        expect(h.ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('--retry-failed'))
        // 显式结论：跳过不能被同包其他实例的包级成功覆盖
        expect([...h.ctx.alertOutcomes!.values()]).toEqual([{
            repository: REPO,
            source: 'dependabot',
            upstreamId: 'dependabot:1',
            manifestPath: 'package.json',
            status: 'skipped',
            reason: 'repeated-failure',
        }])
    })

    it('--retry-failed 忽略命中：仍执行并标注人工强制', async () => {
        const h = makeHarness({ closedCount: REPEATED_FAILURE_ATTEMPT_LIMIT, retryFailed: true })
        const result = await run(h)

        expect(result.rootAlerts).toHaveLength(1)
        expect(h.ctx.allActions).toHaveLength(0)
        expect(h.ctx.summary.alertsSkipped).toBe(0)
        expect(h.ctx.attemptTracking?.[0]).toMatchObject({ attempt: 3, status: 'forced' })
        expect(h.ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('forced retry'))
    })

    it('成员告警使用成员策略键', async () => {
        const h = makeHarness()
        await run(h, {
            rootAlerts: [],
            memberAlerts: [{ alert: makeAlert(), manifestDir: 'packages/web' }],
        })

        expect(h.countCalls).toHaveBeenCalledWith(
            expect.anything(),
            'owner',
            'repo',
            computeAttemptKey({
                source: 'dependabot',
                packageName: 'lodash',
                targetVersion: '4.17.21',
                planStrategy: 'member-upgrade',
            }),
        )
    })

    it('不可修复 / 无推荐版本 / Code Scanning 告警不参与尝试计数', async () => {
        const h = makeHarness()
        const result = await run(h, {
            rootAlerts: [
                makeAlert({ id: 1, fixable: false }),
                makeAlert({ id: 2, recommendedVersion: '' }),
                makeAlert({ id: 3, source: 'code-scanning', packageName: 'src/app.ts' }),
            ],
        })

        expect(h.countCalls).not.toHaveBeenCalled()
        expect(result.rootAlerts).toHaveLength(3)
        expect(h.ctx.attemptTracking).toEqual([])
    })

    it('未启用判定时原样返回且不读历史', async () => {
        const h = makeHarness({ closedCount: REPEATED_FAILURE_ATTEMPT_LIMIT, mode: 'fix' })
        const rootAlerts = [makeAlert()]
        const result = await run(h, { rootAlerts })

        expect(result.rootAlerts).toBe(rootAlerts)
        expect(h.countCalls).not.toHaveBeenCalled()
    })

    it('非落点仓库不做跳过判定（避免跨仓误计数）', async () => {
        const h = makeHarness({ closedCount: REPEATED_FAILURE_ATTEMPT_LIMIT })
        await run(h, { attemptRepo: 'owner/other' })
        expect(h.countCalls).not.toHaveBeenCalled()
    })

    it('同键多告警各自记录（每告警一条；索引缓存由 attempt-history 用例锁定）', async () => {
        const h = makeHarness({ closedCount: 1 })
        await run(h, {
            rootAlerts: [makeAlert({ id: 1 }), makeAlert({ id: 2, ruleId: 'CVE-2021-23338' })],
        })
        expect(h.ctx.attemptTracking).toHaveLength(2)
        expect(h.countCalls).toHaveBeenCalledTimes(2)
    })
})
