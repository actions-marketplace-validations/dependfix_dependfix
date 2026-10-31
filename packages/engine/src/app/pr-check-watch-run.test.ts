import { createEmptyRunSummary } from '@dependfix/core'
import { describe, expect, it, vi } from 'vitest'
import { resolveRuntimeConfig } from '../config'
import { runPrCheckWatch, type RunPrCheckWatchParams } from './pr-check-watch-run'
import { computeSummary } from './result-assembly'

type Ctx = RunPrCheckWatchParams['ctx']

function makeCtx(): Ctx {
    return {
        config: resolveRuntimeConfig({
            env: { GITHUB_TOKEN: 't', DEPENDFIX_REPOSITORIES: 'foo/bar', DEPENDFIX_MODE: 'fix-and-pr' },
            cliOverrides: { waitPrChecks: true },
        }),
        logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        allActions: [],
        attemptTracking: [],
        summary: createEmptyRunSummary(),
        startedAt: new Date().toISOString(),
        prCheckWatch: { attempts: [], runBudgetExhausted: false },
    }
}

function watchResult(overrides: Record<string, unknown> = {}): Awaited<ReturnType<NonNullable<RunPrCheckWatchParams['watch']>>> {
    return {
        state: 'passed',
        closed: false,
        commented: false,
        polls: 1,
        durationMs: 10,
        ...overrides,
    } as Awaited<ReturnType<NonNullable<RunPrCheckWatchParams['watch']>>>
}

describe('runPrCheckWatch', () => {
    it('成功 → 写报告；不触碰 prsOpened（computeSummary 也不清零计数器）', async () => {
        const ctx = makeCtx()
        ctx.summary.prsOpened = 2
        const watch = vi.fn().mockResolvedValue(watchResult())

        await runPrCheckWatch({
            ctx,
            octokit: {} as never,
            owner: 'foo',
            repo: 'bar',
            pr: { number: 7, htmlUrl: 'https://github.com/foo/bar/pull/7', headSha: 'sha' },
            branchName: 'dependfix/auto-fix-abcdef12',
            watch,
        })

        expect(ctx.prCheckWatch?.attempts).toHaveLength(1)
        expect(ctx.prCheckWatch?.attempts[0]).toMatchObject({ state: 'passed', closed: false, commented: false })
        expect(ctx.summary.checksTimedOut).toBe(0)

        // 回归：computeSummary 不得把事件点累加的 PR 计数器清零
        computeSummary({
            ...ctx,
            allAlerts: [],
            allErrors: [],
            alertsDisabled: [],
            repoResults: [],
        } as never)
        expect(ctx.summary.prsOpened).toBe(2)
    })

    it('run 预算耗尽 → checksTimedOut + runBudgetExhausted', async () => {
        const ctx = makeCtx()
        const watch = vi.fn().mockResolvedValue(watchResult({ state: 'timeout', polls: 0, budgetLimit: 'run' }))

        await runPrCheckWatch({
            ctx,
            octokit: {} as never,
            owner: 'foo',
            repo: 'bar',
            pr: { number: 7, htmlUrl: 'https://github.com/foo/bar/pull/7' },
            branchName: 'dependfix/auto-fix-abcdef12',
            watch,
        })

        expect(ctx.summary.checksTimedOut).toBe(1)
        expect(ctx.prCheckWatch?.runBudgetExhausted).toBe(true)
    })

    it('job / per-PR 预算耗尽 → 只计 checksTimedOut，不置 runBudgetExhausted', async () => {
        const ctx = makeCtx()
        const watch = vi.fn().mockResolvedValue(watchResult({ state: 'timeout', budgetLimit: 'job' }))

        await runPrCheckWatch({
            ctx,
            octokit: {} as never,
            owner: 'foo',
            repo: 'bar',
            pr: { number: 7, htmlUrl: 'https://github.com/foo/bar/pull/7' },
            branchName: 'dependfix/auto-fix-abcdef12',
            watch,
        })

        expect(ctx.summary.checksTimedOut).toBe(1)
        expect(ctx.prCheckWatch?.runBudgetExhausted).toBe(false)
    })

    it('关闭成功 → prsClosedAfterFailure +1', async () => {
        const ctx = makeCtx()
        const watch = vi.fn().mockResolvedValue(watchResult({
            state: 'failed',
            attribution: 'self_caused',
            closed: true,
            commented: true,
        }))

        await runPrCheckWatch({
            ctx,
            octokit: {} as never,
            owner: 'foo',
            repo: 'bar',
            pr: { number: 7, htmlUrl: 'https://github.com/foo/bar/pull/7' },
            branchName: 'dependfix/auto-fix-abcdef12',
            watch,
        })

        expect(ctx.summary.prsClosedAfterFailure).toBe(1)
    })

    it('per-run 预算跨 PR 累计；耗尽后后续 PR 直接短路', async () => {
        const ctx = makeCtx()
        const watch = vi.fn()
            .mockResolvedValueOnce(watchResult({ durationMs: 1_190_000, state: 'passed' }))
            .mockResolvedValueOnce(watchResult({ state: 'timeout', budgetLimit: 'run', durationMs: 10_000 }))
            .mockResolvedValue(watchResult())

        const base = {
            ctx,
            octokit: {} as never,
            owner: 'foo',
            repo: 'bar',
            branchName: 'dependfix/auto-fix-abcdef12',
            watch,
        }
        await runPrCheckWatch({ ...base, pr: { number: 1, htmlUrl: 'https://github.com/foo/bar/pull/1' } })
        await runPrCheckWatch({ ...base, pr: { number: 2, htmlUrl: 'https://github.com/foo/bar/pull/2' } })

        // 第二次只拿到剩余 ~10s
        expect(watch.mock.calls[1]?.[0]).toMatchObject({ runBudgetMs: 10_000 })
        expect(ctx.prCheckWatch?.runBudgetExhausted).toBe(true)

        // 第三次：预算已耗尽 → 不再调用 watch，只留一条 timeout 记录并计数
        await runPrCheckWatch({ ...base, pr: { number: 3, htmlUrl: 'https://github.com/foo/bar/pull/3' } })
        expect(watch).toHaveBeenCalledTimes(2)
        expect(ctx.prCheckWatch?.attempts[2]).toMatchObject({ state: 'timeout', polls: 0 })
        expect(ctx.summary.checksTimedOut).toBe(2)
    })

    it('等待链抛错 → 不抛出，报告留一条未判定记录且计 checksTimedOut', async () => {
        const ctx = makeCtx()
        const watch = vi.fn().mockRejectedValue(new Error('boom'))

        await expect(runPrCheckWatch({
            ctx,
            octokit: {} as never,
            owner: 'foo',
            repo: 'bar',
            pr: { number: 7, htmlUrl: 'https://github.com/foo/bar/pull/7' },
            branchName: 'dependfix/auto-fix-abcdef12',
            watch,
        })).resolves.toBeUndefined()

        expect(ctx.logger.error).toHaveBeenCalled()
        expect(ctx.summary.checksTimedOut).toBe(1)
        expect(ctx.prCheckWatch?.attempts[0]).toMatchObject({ state: 'timeout', polls: 0 })
        expect(ctx.prCheckWatch?.attempts[0]?.reason).toContain('watch failed')
    })

    it('非 Actions 环境且未配置 jobBudgetMs → 不套用 job 预算', async () => {
        // 本仓库 CI 在 Actions runner 上跑（GITHUB_ACTIONS=true）→ 显式隔离环境变量
        vi.stubEnv('GITHUB_ACTIONS', '')
        try {
            const ctx = makeCtx()
            const watch = vi.fn().mockResolvedValue(watchResult())

            await runPrCheckWatch({
                ctx,
                octokit: {} as never,
                owner: 'foo',
                repo: 'bar',
                pr: { number: 7, htmlUrl: 'https://github.com/foo/bar/pull/7' },
                branchName: 'dependfix/auto-fix-abcdef12',
                watch,
            })

            expect(watch.mock.calls[0]?.[0]).toMatchObject({ jobBudgetRemainingMs: undefined })
        } finally {
            vi.unstubAllEnvs()
        }
    })

    it('GITHUB_ACTIONS=true → 按 25 分钟基线折算剩余 job 预算', async () => {
        vi.stubEnv('GITHUB_ACTIONS', 'true')
        try {
            const ctx = makeCtx()
            const watch = vi.fn().mockResolvedValue(watchResult())

            await runPrCheckWatch({
                ctx,
                octokit: {} as never,
                owner: 'foo',
                repo: 'bar',
                pr: { number: 7, htmlUrl: 'https://github.com/foo/bar/pull/7' },
                branchName: 'dependfix/auto-fix-abcdef12',
                watch,
            })

            const passed = watch.mock.calls[0]?.[0] as { jobBudgetRemainingMs?: number }
            expect(passed.jobBudgetRemainingMs).toBeGreaterThan(0)
            expect(passed.jobBudgetRemainingMs).toBeLessThanOrEqual(25 * 60_000)
        } finally {
            vi.unstubAllEnvs()
        }
    })
})
