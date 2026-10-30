// budget.test.ts — 运行级剩余预算（deadline）与「预算不足 → 跳过启动新工作」契约。
import { describe, expect, it, vi } from 'vitest'
import { createEmptyRunSummary, type FixError } from '@dependfix/core'
import {
    MIN_STEP_BUDGET_MS,
    budgetAllows,
    hasBudgetForNextStep,
    recordBudgetExhausted,
    remainingBudgetMs,
} from './budget'
import type { RepoFixCtx, RepoFixProgress } from './repo-fix'
import { applyMemberUpgrades } from './repo-fix-member'

const makeTarget = () => ({
    deadlineAt: Date.now() + 60_000,
    logger: { info: vi.fn(), warn: vi.fn() },
    allErrors: [] as FixError[],
    budgetSkips: new Set<string>(),
})

describe('remainingBudgetMs / hasBudgetForNextStep', () => {
    it('未设置截止时间 → undefined / 永远允许', () => {
        expect(remainingBudgetMs(undefined)).toBeUndefined()
        expect(hasBudgetForNextStep(undefined)).toBe(true)
    })

    it('边界：剩余等于最小值允许，少 1ms 不允许（负数同样不允许）', () => {
        const now = 1_000_000
        expect(remainingBudgetMs(now + MIN_STEP_BUDGET_MS, now)).toBe(MIN_STEP_BUDGET_MS)
        expect(hasBudgetForNextStep(now + MIN_STEP_BUDGET_MS, now)).toBe(true)
        expect(hasBudgetForNextStep(now + MIN_STEP_BUDGET_MS - 1, now)).toBe(false)
        expect(hasBudgetForNextStep(now - 5_000, now)).toBe(false)
    })
})

describe('recordBudgetExhausted', () => {
    it('写一条 BUDGET_EXHAUSTED 审计并 warn（含剩余预算与动作）', () => {
        const target = makeTarget()
        target.deadlineAt = Date.now() - 1_000
        recordBudgetExhausted(target, { repository: 'foo/bar', stage: 'fix', work: 'package upgrade lodash' })

        expect(target.allErrors).toHaveLength(1)
        expect(target.allErrors[0]).toMatchObject({
            repository: 'foo/bar',
            stage: 'fix',
            category: 'BUDGET_EXHAUSTED',
        })
        expect(target.allErrors[0]!.message).toContain('package upgrade lodash')
        expect(target.logger.warn).toHaveBeenCalledWith(expect.stringContaining('[budget] foo/bar'))
    })

    it('同一 stage:work 只记一次（循环逐包命中不刷审计）', () => {
        const target = makeTarget()
        target.deadlineAt = Date.now() - 1_000
        recordBudgetExhausted(target, { repository: 'foo/bar', stage: 'fix', work: 'package upgrade lodash' })
        recordBudgetExhausted(target, { repository: 'foo/bar', stage: 'fix', work: 'package upgrade lodash' })
        expect(target.allErrors).toHaveLength(1)

        recordBudgetExhausted(target, { repository: 'foo/bar', stage: 'verify', work: 'post-fix verification' })
        expect(target.allErrors).toHaveLength(2)

        // 多仓运行：不同仓库各自留痕（去重键含 repository）
        recordBudgetExhausted(target, { repository: 'foo/baz', stage: 'fix', work: 'package upgrade lodash' })
        expect(target.allErrors).toHaveLength(3)
    })
})

describe('budgetAllows', () => {
    it('预算充足 → true 且不写审计', () => {
        const target = makeTarget()
        expect(budgetAllows(target, { repository: 'foo/bar', stage: 'fix', work: 'step' })).toBe(true)
        expect(target.allErrors).toEqual([])
    })

    it('预算不足 → false 且写一条审计', () => {
        const target = makeTarget()
        target.deadlineAt = Date.now() - 1
        expect(budgetAllows(target, { repository: 'foo/bar', stage: 'fix', work: 'step' })).toBe(false)
        expect(target.allErrors.map((error) => error.category)).toEqual(['BUDGET_EXHAUSTED'])
    })
})

// ---------------------------------------------------------------------------
// 逐包循环接线：预算不足时不再启动安装 / 升级，并留痕（不产出失败动作）
// ---------------------------------------------------------------------------

const makeProgress = (): RepoFixProgress => ({
    alertsCount: 1,
    fixable: 1,
    fixed: 0,
    failed: 0,
    lockfileRepaired: false,
    verificationPassed: undefined,
    verificationBlocking: undefined,
    defaultBranch: 'main',
})

const makeCtx = (overrides: Partial<RepoFixCtx> = {}): RepoFixCtx => ({
    config: { dryRun: false, rollbackGranularity: 'unit' } as never,
    workDir: '/tmp/does-not-matter',
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
    runId: 'run-budget',
    allAlerts: [],
    allActions: [],
    allErrors: [],
    alertsDisabled: [],
    repoResults: [],
    summary: createEmptyRunSummary(),
    startedAt: new Date().toISOString(),
    finishedAt: '',
    aiUsageRef: { aggregate: undefined },
    verificationCheckpoints: [],
    verificationBaseline: {},
    ...overrides,
})

describe('applyMemberUpgrades — 预算不足', () => {
    it('跳过成员升级：返回 false、不产出动作、写一条 BUDGET_EXHAUSTED', async () => {
        const ctx = makeCtx({ deadlineAt: Date.now() - 1, budgetSkips: new Set<string>() })
        const sets = {
            rootManifestAlerts: [],
            memberManifestAlerts: [{
                alert: {
                    packageName: 'vite',
                    repository: 'foo/bar',
                    recommendedVersion: '6.0.0',
                    currentVersion: '5.0.0',
                    severity: 'high',
                    source: 'dependabot',
                    fixable: true,
                },
                manifestDir: 'packages/web',
            }],
            lockfilePath: 'pnpm-lock.yaml',
        } as never

        const environmentalStop = await applyMemberUpgrades(ctx, 'foo/bar', sets, makeProgress())

        expect(environmentalStop).toBe(false)
        expect(ctx.allActions).toEqual([])
        expect(ctx.allErrors.map((error) => error.category)).toEqual(['BUDGET_EXHAUSTED'])
        expect(ctx.allErrors[0]!.message).toContain('member upgrade vite')
    })
})
