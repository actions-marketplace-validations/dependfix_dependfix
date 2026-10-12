import { describe, expect, it } from 'vitest'
import {
    aggregateOverallStatus,
    capSignals,
    deriveWorstConclusion,
    isTerminalOverallStatus,
    isWithinUpdatedWindow,
    MAX_FAILURE_SOURCES,
    MAX_SIGNALS_PER_PR,
    normalizeCheckRun,
    normalizeCommitStatus,
    normalizeDeployment,
    pickCheckRunId,
    pickErrorSummary,
    PR_UPDATED_WINDOW_MS,
    resolveCheckProvider,
    resolveDeploymentProvider,
    resolveStatusProvider,
    shouldSkipTerminalPr,
    SIGNAL_SUMMARY_MAX_LENGTH,
    SIGNAL_URL_MAX_LENGTH,
    summarizeFailureSources,
    TERMINAL_REPOLL_QUIET_MS,
} from './build-signals'
import type { UnifiedBuildSignal, UnifiedBuildSignalState } from './types'

const observedAt = new Date('2026-10-12T00:00:00Z')

const makeSignal = (overrides: Partial<UnifiedBuildSignal> = {}): UnifiedBuildSignal => ({
    kind: 'check',
    provider: 'github-actions',
    name: 'Test',
    state: 'success',
    rawState: 'success',
    sourceId: '1',
    targetUrl: null,
    logUrl: null,
    summary: null,
    observedAt,
    ...overrides,
})

describe('monitor/build-signals provider 归因', () => {
    it('check provider 取 app.slug（小写化）；缺失回退 unknown', () => {
        expect(resolveCheckProvider('GitHub-Actions')).toBe('github-actions')
        expect(resolveCheckProvider(null)).toBe('unknown')
        expect(resolveCheckProvider('  ')).toBe('unknown')
    })

    it('status provider 取 context 前缀（支持 / – - : 空格分隔）', () => {
        expect(resolveStatusProvider('Vercel – web-app')).toBe('vercel')
        expect(resolveStatusProvider('ci/circleci: build')).toBe('ci')
        expect(resolveStatusProvider('continuous-integration/travis-ci/push')).toBe('continuous-integration')
        expect(resolveStatusProvider('')).toBe('unknown')
        expect(resolveStatusProvider(null)).toBe('unknown')
    })

    it('deployment provider 取 creator.login 并归一化机器人形态（与 status 前缀口径一致）；缺失回退 unknown', () => {
        expect(resolveDeploymentProvider('vercel[bot]')).toBe('vercel')
        expect(resolveDeploymentProvider('Vercel[bot]')).toBe('vercel')
        expect(resolveDeploymentProvider('alice')).toBe('alice')
        expect(resolveDeploymentProvider('12345+vercel[bot]')).toBe('vercel')
        expect(resolveDeploymentProvider(null)).toBe('unknown')
        expect(resolveDeploymentProvider('  ')).toBe('unknown')
    })
})

describe('monitor/build-signals 归一化', () => {
    it('check run：completed 保留原始 conclusion 粒度', () => {
        const timedOut = normalizeCheckRun(
            { id: 1, name: 'Test', status: 'completed', conclusion: 'timed_out', app: { slug: 'github-actions' } },
            observedAt,
        )
        expect(timedOut.state).toBe('failure')
        expect(timedOut.rawState).toBe('timed_out')
        expect(timedOut.sourceId).toBe('1')
    })

    it('check run：未完成 → pending（rawState 为 null）', () => {
        const pending = normalizeCheckRun({ id: 2, name: 'Test', status: 'in_progress', conclusion: null }, observedAt)
        expect(pending.state).toBe('pending')
        expect(pending.rawState).toBe(null)
    })

    it('check run：completed 但 conclusion=null → skipped（与既有映射一致）', () => {
        const skipped = normalizeCheckRun({ id: 3, name: 'Test', status: 'completed', conclusion: null }, observedAt)
        expect(skipped.state).toBe('skipped')
        expect(skipped.rawState).toBe(null)
    })

    it('check run：URL 超限置 null（截断会产出无效链接）', () => {
        const longUrl = `https://example.com/${'x'.repeat(SIGNAL_URL_MAX_LENGTH)}`
        const signal = normalizeCheckRun(
            { id: 5, name: 'Test', status: 'completed', conclusion: 'failure', details_url: longUrl },
            observedAt,
        )
        expect(signal.targetUrl).toBeNull()

        const short = normalizeCheckRun(
            { id: 6, name: 'Test', status: 'completed', conclusion: 'failure', details_url: 'https://example.com/ok' },
            observedAt,
        )
        expect(short.targetUrl).toBe('https://example.com/ok')
    })

    it('check run：摘要按上限截断', () => {
        const long = 'x'.repeat(SIGNAL_SUMMARY_MAX_LENGTH + 50)
        const signal = normalizeCheckRun(
            { id: 4, name: 'Test', status: 'completed', conclusion: 'failure', output: { text: long } },
            observedAt,
        )
        expect(signal.summary?.length).toBe(SIGNAL_SUMMARY_MAX_LENGTH + 3)
        expect(signal.summary?.endsWith('...')).toBe(true)
    })

    it('commit status：state 映射（error → error / pending → pending）', () => {
        expect(normalizeCommitStatus({ id: 1, context: 'Vercel – web', state: 'error' }, observedAt).state).toBe('error')
        expect(normalizeCommitStatus({ id: 2, context: 'ci', state: 'pending' }, observedAt).state).toBe('pending')
    })

    it('deployment：无 status → pending；有 status 取 environment_url / log_url', () => {
        const noStatus = normalizeDeployment({ id: 10, environment: 'Preview', creator: { login: 'vercel[bot]' } }, null, observedAt)
        expect(noStatus.state).toBe('pending')
        expect(noStatus.targetUrl).toBe(null)

        const failed = normalizeDeployment(
            { id: 11, environment: 'Preview', creator: { login: 'vercel[bot]' } },
            { state: 'failure', environment_url: 'https://preview.example.com', log_url: 'https://logs.example.com' },
            observedAt,
        )
        expect(failed.state).toBe('failure')
        expect(failed.targetUrl).toBe('https://preview.example.com')
        expect(failed.logUrl).toBe('https://logs.example.com')
    })
})

describe('monitor/build-signals 聚合与派生', () => {
    it('任一 failure / error → overall=failure（pending 让位于失败）', () => {
        expect(aggregateOverallStatus([makeSignal({ state: 'success' }), makeSignal({ state: 'error' })])).toBe('failure')
        expect(aggregateOverallStatus([makeSignal({ state: 'pending' }), makeSignal({ state: 'failure' })])).toBe('failure')
    })

    it('无失败但存在 pending → overall=pending', () => {
        expect(aggregateOverallStatus([makeSignal({ state: 'success' }), makeSignal({ state: 'pending' })])).toBe('pending')
    })

    it('全部 success / neutral / skipped → overall=success', () => {
        expect(aggregateOverallStatus([makeSignal({ state: 'success' })])).toBe('success')
        expect(aggregateOverallStatus([makeSignal({ state: 'neutral' }), makeSignal({ state: 'skipped' })])).toBe('success')
        expect(aggregateOverallStatus([])).toBe('success')
    })

    it('conclusion 派生保留失败 check 的原始粒度；非 check 失败源落 failure', () => {
        expect(
            deriveWorstConclusion([
                makeSignal({ kind: 'check', state: 'failure', rawState: 'timed_out' }),
                makeSignal({ kind: 'deployment', state: 'failure', rawState: 'failure' }),
            ]),
        ).toBe('timed_out')

        expect(
            deriveWorstConclusion([makeSignal({ kind: 'deployment', state: 'error', rawState: 'error' })]),
        ).toBe('failure')
    })

    it('conclusion 派生：pending / neutral / skipped / success 分支', () => {
        expect(deriveWorstConclusion([makeSignal({ state: 'pending', rawState: null })])).toBe('pending')
        expect(deriveWorstConclusion([makeSignal({ state: 'neutral', rawState: 'neutral' })])).toBe('neutral')
        expect(
            deriveWorstConclusion([
                makeSignal({ state: 'skipped', rawState: null }),
                makeSignal({ state: 'skipped', rawState: null }),
            ]),
        ).toBe('skipped')
        expect(deriveWorstConclusion([makeSignal({ state: 'success' })])).toBe('success')
        expect(deriveWorstConclusion([])).toBe('success')
    })

    it('capSignals：同严重度保持源侧顺序（稳定排序）', () => {
        const stable = [
            makeSignal({ name: 'a', state: 'success' }),
            makeSignal({ name: 'b', state: 'success' }),
            makeSignal({ name: 'c', state: 'pending', rawState: null }),
        ]
        expect(capSignals(stable).map((s) => s.name)).toEqual(['c', 'a', 'b'])
    })

    it('capSignals：按严重度保留失败信号并截断到上限', () => {
        const many: UnifiedBuildSignal[] = Array.from({ length: MAX_SIGNALS_PER_PR + 5 }, (_, i) =>
            makeSignal({ name: `ok-${i}`, state: 'success' }))
        many.push(makeSignal({ name: 'critical-failure', state: 'failure', rawState: 'failure' }))

        const capped = capSignals(many)
        expect(capped).toHaveLength(MAX_SIGNALS_PER_PR)
        expect(capped[0]!.name).toBe('critical-failure')
    })

    it('pickCheckRunId / pickErrorSummary 优先失败源', () => {
        const signals = [
            makeSignal({ kind: 'check', state: 'success', sourceId: 'ok-1', summary: 'ok' }),
            makeSignal({ kind: 'check', state: 'failure', rawState: 'failure', sourceId: 'fail-1', summary: 'boom' }),
        ]
        expect(pickCheckRunId(signals)).toBe('fail-1')
        expect(pickErrorSummary(signals)).toBe('boom')
        expect(pickCheckRunId([])).toBe(null)
        expect(pickErrorSummary([])).toBe(null)
    })
})

describe('monitor/build-signals 节流', () => {
    const now = new Date('2026-10-12T00:00:00Z')

    it('窗口内 / 窗口外判定', () => {
        expect(isWithinUpdatedWindow(new Date(now.getTime() - 1000).toISOString(), now)).toBe(true)
        expect(isWithinUpdatedWindow(new Date(now.getTime() - PR_UPDATED_WINDOW_MS - 1000).toISOString(), now)).toBe(false)
    })

    it('恰在窗口边界（差值 === windowMs）视为窗口内', () => {
        expect(isWithinUpdatedWindow(new Date(now.getTime() - PR_UPDATED_WINDOW_MS).toISOString(), now)).toBe(true)
    })

    it('缺失 / 非法时间戳 fail-open（视为需处理）', () => {
        expect(isWithinUpdatedWindow(null, now)).toBe(true)
        expect(isWithinUpdatedWindow(undefined, now)).toBe(true)
        expect(isWithinUpdatedWindow('not-a-date', now)).toBe(true)
    })

    it('终态判定：failure / success 为终态；pending / NULL / 未知值一律非终态（保守重采）', () => {
        expect(isTerminalOverallStatus('failure')).toBe(true)
        expect(isTerminalOverallStatus('success')).toBe(true)
        expect(isTerminalOverallStatus('pending')).toBe(false)
        expect(isTerminalOverallStatus(null)).toBe(false)
        expect(isTerminalOverallStatus(undefined)).toBe(false)
        expect(isTerminalOverallStatus('weird')).toBe(false)
    })

    it('终态跳过判定：终态 + 静默窗口内才跳过；窗口外 / 非终态 / 无既有行不跳过', () => {
        const recent = { overallStatus: 'success', lastPolledAt: new Date(now.getTime() - 60 * 1000) }
        const stale = {
            overallStatus: 'success',
            lastPolledAt: new Date(now.getTime() - TERMINAL_REPOLL_QUIET_MS - 1000),
        }
        expect(shouldSkipTerminalPr(recent, now)).toBe(true)
        expect(shouldSkipTerminalPr(stale, now)).toBe(false)
        expect(shouldSkipTerminalPr({ ...recent, overallStatus: 'pending' }, now)).toBe(false)
        expect(shouldSkipTerminalPr({ ...recent, overallStatus: null }, now)).toBe(false)
        expect(shouldSkipTerminalPr(null, now)).toBe(false)
        expect(shouldSkipTerminalPr(undefined, now)).toBe(false)
    })
})

describe('monitor/build-signals 失败源汇总', () => {
    it('仅取失败信号并按 provider + name + kind 去重', () => {
        const sources = summarizeFailureSources([
            makeSignal({ provider: 'github-actions', name: 'Test', state: 'success' }),
            makeSignal({ provider: 'vercel', name: 'Preview', kind: 'deployment', state: 'failure', rawState: 'failure' }),
            makeSignal({ provider: 'vercel', name: 'Preview', kind: 'deployment', state: 'error', rawState: 'error' }),
            makeSignal({ provider: 'vercel', name: 'Preview', kind: 'status', state: 'failure', rawState: 'failure' }),
            makeSignal({ provider: 'cloudflare-workers-and-pages', name: 'Workers Builds', state: 'failure', rawState: 'failure' }),
        ])
        expect(sources).toEqual([
            { provider: 'vercel', name: 'Preview', kind: 'deployment' },
            { provider: 'vercel', name: 'Preview', kind: 'status' },
            { provider: 'cloudflare-workers-and-pages', name: 'Workers Builds', kind: 'check' },
        ])
    })

    it('无失败信号 → 空数组；超过上限时截断', () => {
        expect(summarizeFailureSources([makeSignal({ state: 'success' })])).toEqual([])
        const many = Array.from({ length: MAX_FAILURE_SOURCES + 5 }, (_, i) =>
            makeSignal({ name: `fail-${i}`, state: 'failure', rawState: 'failure' }))
        expect(summarizeFailureSources(many)).toHaveLength(MAX_FAILURE_SOURCES)
    })
})

describe('monitor/build-signals 状态映射覆盖', () => {
    const cases: Array<[string, UnifiedBuildSignalState]> = [
        ['success', 'success'],
        ['failure', 'failure'],
        ['timed_out', 'failure'],
        ['action_required', 'failure'],
        ['neutral', 'neutral'],
        ['cancelled', 'skipped'],
        ['skipped', 'skipped'],
        ['stale', 'skipped'],
    ]

    it.each(cases)('check conclusion %s → state %s', (conclusion, expected) => {
        const signal = normalizeCheckRun(
            { id: 1, name: 'Test', status: 'completed', conclusion },
            observedAt,
        )
        expect(signal.state).toBe(expected)
    })
})
