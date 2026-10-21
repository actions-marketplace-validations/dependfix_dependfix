import { describe, expect, it } from 'vitest'
import { createEmptyRunSummary } from '@dependfix/core'
import { computeSummary } from './result-assembly'
import type { AppContext } from './helpers'

function makeCtx(overrides: Partial<Pick<AppContext, 'allActions' | 'allAlerts' | 'allErrors' | 'alertsDisabled' | 'repoResults'>> = {}): Pick<AppContext, 'allActions' | 'allAlerts' | 'allErrors' | 'alertsDisabled' | 'repoResults' | 'summary'> {
    return {
        allActions: [],
        allAlerts: [],
        allErrors: [],
        alertsDisabled: [],
        repoResults: [],
        summary: createEmptyRunSummary(),
        ...overrides,
    }
}

describe('computeSummary', () => {
    it('counts reposWithAlertsDisabled by unique repository (not record count)', () => {
        const ctx = makeCtx({
            alertsDisabled: [
                { repository: 'foo/a', source: 'dependabot', message: 'disabled' },
                { repository: 'foo/a', source: 'code-scanning', message: 'disabled' },
                { repository: 'foo/b', source: 'dependabot', message: 'disabled' },
            ],
        })
        computeSummary(ctx)
        // 3 条记录但只有 2 个唯一仓库 → 计数 2（与表头「(repos)」口径一致）
        expect(ctx.summary.reposWithAlertsDisabled).toBe(2)
    })

    it('sets reposWithAlertsDisabled to 0 when no disabled records', () => {
        const ctx = makeCtx()
        computeSummary(ctx)
        expect(ctx.summary.reposWithAlertsDisabled).toBe(0)
    })

    it('counts environmental failures from ENVIRONMENT_ERROR audit entries only', () => {
        const ctx = makeCtx({
            allErrors: [
                { repository: 'foo/a', stage: 'repair', category: 'ENVIRONMENT_ERROR', message: 'killed by SIGKILL' },
                { repository: 'foo/b', stage: 'fix', category: 'ENVIRONMENT_ERROR', message: 'install timeout' },
                { repository: 'foo/a', stage: 'fix', category: 'PROCESS_FAILED', message: 'not environmental' },
            ],
            // 同一事件也可能带 action 标记；本字段只按审计条目计数，不得双计
            allActions: [{
                type: 'lockfile-repair',
                repository: 'foo/a',
                target: 'pnpm-lock.yaml',
                success: false,
                environmentalFailure: true,
            }],
        })
        computeSummary(ctx)
        expect(ctx.summary.environmentalFailures).toBe(2)
        // 环境性失败不进入归因失败计数
        expect(ctx.summary.alertsFailed).toBe(0)
    })

    it('sets environmentalFailures to 0 when no environmental errors', () => {
        const ctx = makeCtx()
        computeSummary(ctx)
        expect(ctx.summary.environmentalFailures).toBe(0)
    })
})
