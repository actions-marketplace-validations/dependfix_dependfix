import type { Octokit } from '@octokit/rest'
import { describe, expect, it, vi } from 'vitest'
import {
    JOB_BUDGET_MAX_SHARE,
    evaluateCheckTerminal,
    PR_CHECK_GRACE_MS,
    buildCheckFailureComment,
    normalizeCheckRunConclusion,
    normalizeCommitStatusConclusion,
    sanitizeCheckName,
    sanitizeCheckUrl,
    resolveEffectiveTimeout,
    watchPullRequestChecks,
    type WatchPrChecksParams,
} from './pr-check-watch'

/** check run 夹具（默认 completed）。 */
function checkRun(name: string, conclusion: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: Math.floor(Math.random() * 1e9),
        name,
        status: 'completed',
        conclusion,
        details_url: `https://ci.example/${encodeURIComponent(name)}`,
        output: { title: null, summary: null },
        ...extra,
    }
}

interface FakeOctokitOptions {
    /** 按 ref 返回 check runs；返回数组或抛出错误 */
    checks?: (ref: string) => Record<string, unknown>[]
    /** 按 ref 返回 commit statuses */
    statuses?: (ref: string) => Record<string, unknown>[]
    /** 父提交解析（缺省 null = 解析失败） */
    parentSha?: string | null
    commentError?: Error
    closeError?: Error
    deleteError?: Error & { status?: number }
}

function makeOctokit(options: FakeOctokitOptions = {}) {
    const checksList = vi.fn()
    const statusesList = vi.fn()
    const getCommit = vi.fn()
    const getPull = vi.fn()
    const updatePull = vi.fn()
    const deleteRef = vi.fn()
    const createComment = vi.fn()

    const octokit = {
        paginate: vi.fn(async (endpoint: unknown, params: { ref: string }) => {
            if (endpoint === checksList) {
                return options.checks ? options.checks(params.ref) : []
            }
            if (endpoint === statusesList) {
                return options.statuses ? options.statuses(params.ref) : []
            }
            throw new Error('unexpected paginate endpoint')
        }),
        rest: {
            checks: { listForRef: checksList },
            repos: {
                listCommitStatusesForRef: statusesList,
                getCommit,
            },
            pulls: {
                get: getPull,
                update: updatePull,
            },
            issues: { createComment },
            git: { deleteRef },
        },
    }

    if (options.parentSha === null) {
        getCommit.mockRejectedValue(new Error('commit not found'))
        getPull.mockRejectedValue(new Error('pull not found'))
    } else {
        getCommit.mockResolvedValue({ data: { parents: [{ sha: options.parentSha ?? 'parent-sha' }] } })
        getPull.mockResolvedValue({ data: { base: { sha: 'base-sha' } } })
    }
    if (options.commentError) {
        createComment.mockRejectedValue(options.commentError)
    }
    if (options.closeError) {
        updatePull.mockRejectedValue(options.closeError)
    }
    if (options.deleteError) {
        deleteRef.mockRejectedValue(options.deleteError)
    }

    return {
        octokit: octokit as unknown as Octokit,
        spies: { checksList, statusesList, getCommit, getPull, updatePull, deleteRef, createComment },
    }
}

/** 假时钟：sleep 推进时间，不真实等待。 */
function makeClock() {
    let current = 0
    return {
        now: () => current,
        sleep: async (ms: number) => {
            current += ms
        },
    }
}

function baseParams(overrides: Partial<WatchPrChecksParams> = {}): WatchPrChecksParams {
    const clock = makeClock()
    return {
        octokit: makeOctokit().octokit,
        owner: 'foo',
        repo: 'bar',
        pr: { number: 7, htmlUrl: 'https://github.com/foo/bar/pull/7' },
        headBranch: 'dependfix/auto-fix-abcdef12',
        headSha: 'head-sha',
        attempts: [{ key: '0123456789abcdef', n: 1 }],
        timeoutMs: 900_000,
        runBudgetMs: 1_200_000,
        dryRun: false,
        closeFailedPr: false,
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        now: clock.now,
        sleep: clock.sleep,
        ...overrides,
    }
}

describe('normalizeCheckRunConclusion / normalizeCommitStatusConclusion', () => {
    it('未完成的 check run 一律 pending', () => {
        expect(normalizeCheckRunConclusion('in_progress', null)).toBe('pending')
        expect(normalizeCheckRunConclusion('queued', null)).toBe('pending')
    })

    it('已完成 check run 保留失败粒度，未知结论 → unknown', () => {
        expect(normalizeCheckRunConclusion('completed', 'failure')).toBe('failure')
        expect(normalizeCheckRunConclusion('completed', 'timed_out')).toBe('timed_out')
        expect(normalizeCheckRunConclusion('completed', 'action_required')).toBe('action_required')
        expect(normalizeCheckRunConclusion('completed', 'success')).toBe('success')
        expect(normalizeCheckRunConclusion('completed', 'startup_failure')).toBe('startup_failure')
        expect(normalizeCheckRunConclusion('completed', 'weird')).toBe('unknown')
    })

    it('commit status：error 归一为 failure，未知 → unknown', () => {
        expect(normalizeCommitStatusConclusion('error')).toBe('failure')
        expect(normalizeCommitStatusConclusion('pending')).toBe('pending')
        expect(normalizeCommitStatusConclusion('SUCCESS')).toBe('success')
        expect(normalizeCommitStatusConclusion('nope')).toBe('unknown')
    })
})

describe('sanitizeCheckName', () => {
    it('剥离控制字符 / 换行并截断（作业名来自目标仓库，不可信）', () => {
        expect(sanitizeCheckName('Test\n## injected')).toBe('Test ## injected')
        expect(sanitizeCheckName('  spaced   name  ')).toBe('spaced name')
        expect(sanitizeCheckName('')).toBe('check')
        expect(sanitizeCheckName(undefined)).toBe('check')
        expect(sanitizeCheckName('x'.repeat(200)).length).toBe(101)
    })
})

describe('resolveEffectiveTimeout', () => {
    it('取 per-PR / per-run / 剩余 job 预算 70% 的最小值，并回传绑定来源', () => {
        expect(resolveEffectiveTimeout({ timeoutMs: 900_000, runBudgetMs: 1_200_000 }))
            .toEqual({ timeoutMs: 900_000, limit: 'pr' })
        expect(resolveEffectiveTimeout({ timeoutMs: 900_000, runBudgetMs: 600_000 }))
            .toEqual({ timeoutMs: 600_000, limit: 'run' })
        expect(resolveEffectiveTimeout({
            timeoutMs: 900_000,
            runBudgetMs: 1_200_000,
            jobBudgetRemainingMs: 300_000,
        })).toEqual({ timeoutMs: Math.floor(300_000 * JOB_BUDGET_MAX_SHARE), limit: 'job' })
    })

    it('剩余 job 预算为 0 / 负数 → 0（不发起轮询），来源仍是 job', () => {
        expect(resolveEffectiveTimeout({ timeoutMs: 900_000, runBudgetMs: 1_200_000, jobBudgetRemainingMs: 0 }))
            .toEqual({ timeoutMs: 0, limit: 'job' })
        expect(resolveEffectiveTimeout({ timeoutMs: 900_000, runBudgetMs: 1_200_000, jobBudgetRemainingMs: -5 }))
            .toEqual({ timeoutMs: 0, limit: 'job' })
    })

    it('非有限值（NaN）按耗尽处理（防 hot loop）', () => {
        expect(resolveEffectiveTimeout({ timeoutMs: Number.NaN, runBudgetMs: 1_200_000 }))
            .toEqual({ timeoutMs: 0, limit: 'pr' })
    })
})

describe('sanitizeCheckUrl', () => {
    it('只接受 http(s)，剥离控制字符 / 空白并编码括号', () => {
        expect(sanitizeCheckUrl('https://ci.example/a')).toBe('https://ci.example/a')
        expect(sanitizeCheckUrl('https://ci.example/a(b)c')).toBe('https://ci.example/a%28b%29c')
        expect(sanitizeCheckUrl('https://ci.example/a\nb')).toBe('https://ci.example/ab')
        expect(sanitizeCheckUrl('javascript:alert(1)')).toBeUndefined()
        expect(sanitizeCheckUrl(`https://ci.example/${'a'.repeat(600)}`)).toBeUndefined()
        expect(sanitizeCheckUrl('')).toBeUndefined()
    })
})

describe('evaluateCheckTerminal（终态判定纯逻辑）', () => {
    it('空观测 / 存在未完成 → 未到终态（绝不判 passed）', async () => {
        const params = baseParams()
        expect(await evaluateCheckTerminal(params, [])).toBeUndefined()
        expect(await evaluateCheckTerminal(params, [
            { name: 'Test', conclusion: 'pending' },
            { name: 'Coverage', conclusion: 'success' },
        ])).toBeUndefined()
    })

    it('全部完成且有成功 → passed；全部 cancelled / skipped → cancelled', async () => {
        const params = baseParams()
        expect(await evaluateCheckTerminal(params, [{ name: 'Test', conclusion: 'success' }]))
            .toEqual({ state: 'passed' })
        expect(await evaluateCheckTerminal(params, [
            { name: 'Test', conclusion: 'cancelled' },
            { name: 'Coverage', conclusion: 'skipped' },
        ])).toEqual({ state: 'cancelled' })
    })
})

describe('watchPullRequestChecks', () => {
    it('全部成功 → passed，不评论、不关闭', async () => {
        const { octokit, spies } = makeOctokit({
            checks: () => [checkRun('Test', 'success'), checkRun('Coverage', 'success')],
        })

        const result = await watchPullRequestChecks(baseParams({ octokit }))

        expect(result).toMatchObject({ state: 'passed', closed: false, commented: false, polls: 1 })
        expect(spies.createComment).not.toHaveBeenCalled()
        expect(spies.updatePull).not.toHaveBeenCalled()
    })

    it('commit status 计入终态（Vercel 风格 context）', async () => {
        const { octokit } = makeOctokit({
            checks: () => [],
            statuses: () => [{ id: 1, context: 'Vercel – web', state: 'success', target_url: 'https://vercel.example' }],
        })

        const result = await watchPullRequestChecks(baseParams({ octokit }))
        expect(result.state).toBe('passed')
    })

    it('self_caused + --close-failed-pr → 关闭 PR、删除分支并评论', async () => {
        const { octokit, spies } = makeOctokit({
            checks: (ref) => (ref === 'parent-sha'
                ? [checkRun('Test', 'success')]
                : [checkRun('Test', 'failure')]),
            commentError: undefined,
        })

        const result = await watchPullRequestChecks(baseParams({ octokit, closeFailedPr: true }))

        expect(result).toMatchObject({
            state: 'failed',
            attribution: 'self_caused',
            closed: true,
            commented: true,
        })
        expect(result.failedChecks?.[0]).toMatchObject({ name: 'Test', attribution: 'self_caused' })
        expect(spies.updatePull).toHaveBeenCalledWith(expect.objectContaining({ pull_number: 7, state: 'closed' }))
        expect(spies.deleteRef).toHaveBeenCalledWith(expect.objectContaining({ ref: 'heads/dependfix/auto-fix-abcdef12' }))
        expect(spies.createComment).toHaveBeenCalledWith(expect.objectContaining({
            issue_number: 7,
            body: expect.stringContaining('self_caused'),
        }))
        // 评论带尝试标记（可追溯）
        expect(String(spies.createComment.mock.calls[0]?.[0]?.body)).toContain('dependfix:attempt')
    })

    it('unknown / external_noise / pre_existing 一律只评论不关闭', async () => {
        const scenarios: Array<{ name: string, opts: FakeOctokitOptions, attribution: string }> = [
            {
                name: 'unknown（父提交未采集）',
                opts: { checks: () => [checkRun('Test', 'failure')], parentSha: null },
                attribution: 'unknown',
            },
            {
                name: 'external_noise（Dependabot updater）',
                opts: {
                    checks: () => [checkRun('dependabot[bot] updater', 'failure', {
                        output: { title: 'security_update_not_possible', summary: 'no patched version' },
                    })],
                    parentSha: 'parent-sha',
                },
                attribution: 'external_noise',
            },
            {
                name: 'pre_existing（父提交同 job 已红）',
                opts: {
                    checks: (ref) => (ref === 'parent-sha' ? [checkRun('Test', 'failure')] : [checkRun('Test', 'failure')]),
                    parentSha: 'parent-sha',
                },
                attribution: 'pre_existing',
            },
        ]

        for (const scenario of scenarios) {
            const { octokit, spies } = makeOctokit(scenario.opts)
            const result = await watchPullRequestChecks(baseParams({ octokit, closeFailedPr: true }))
            expect(result.attribution, scenario.name).toBe(scenario.attribution)
            expect(result.closed, scenario.name).toBe(false)
            expect(result.commented, scenario.name).toBe(true)
            expect(spies.updatePull, scenario.name).not.toHaveBeenCalled()
        }
    })

    it('混合归因 → unknown（不关闭）', async () => {
        const { octokit, spies } = makeOctokit({
            checks: (ref) => (ref === 'parent-sha'
                ? [checkRun('Test', 'success'), checkRun('Release', 'failure')]
                : [checkRun('Test', 'failure'), checkRun('Release', 'failure')]),
        })

        const result = await watchPullRequestChecks(baseParams({ octokit, closeFailedPr: true }))
        expect(result.attribution).toBe('unknown')
        expect(result.closed).toBe(false)
        expect(spies.updatePull).not.toHaveBeenCalled()
    })

    it('self_caused 但未开 --close-failed-pr → 只评论不关闭', async () => {
        const { octokit, spies } = makeOctokit({
            checks: (ref) => (ref === 'parent-sha' ? [checkRun('Test', 'success')] : [checkRun('Test', 'failure')]),
        })

        const result = await watchPullRequestChecks(baseParams({ octokit, closeFailedPr: false }))
        expect(result).toMatchObject({ state: 'failed', attribution: 'self_caused', closed: false, commented: true })
        expect(spies.updatePull).not.toHaveBeenCalled()
        expect(spies.deleteRef).not.toHaveBeenCalled()
    })

    it('删分支 404 → 幂等成功（无 closeError）', async () => {
        const { octokit } = makeOctokit({
            checks: (ref) => (ref === 'parent-sha' ? [checkRun('Test', 'success')] : [checkRun('Test', 'failure')]),
            deleteError: Object.assign(new Error('Not Found'), { status: 404 }),
        })

        const result = await watchPullRequestChecks(baseParams({ octokit, closeFailedPr: true }))
        expect(result.closed).toBe(true)
        expect(result.closeError).toBeUndefined()
    })

    it('删分支 422「Reference does not exist」→ 幂等成功（无 closeError）', async () => {
        const { octokit } = makeOctokit({
            checks: (ref) => (ref === 'parent-sha' ? [checkRun('Test', 'success')] : [checkRun('Test', 'failure')]),
            deleteError: Object.assign(new Error('Reference does not exist'), { status: 422 }),
        })

        const result = await watchPullRequestChecks(baseParams({ octokit, closeFailedPr: true }))
        expect(result.closed).toBe(true)
        expect(result.closeError).toBeUndefined()
    })

    it('删分支 422「protected branch」→ closed 但记 closeError（残留留痕）', async () => {
        const { octokit } = makeOctokit({
            checks: (ref) => (ref === 'parent-sha' ? [checkRun('Test', 'success')] : [checkRun('Test', 'failure')]),
            deleteError: Object.assign(new Error('protected branch hook declined'), { status: 422 }),
        })

        const result = await watchPullRequestChecks(baseParams({ octokit, closeFailedPr: true }))
        expect(result.closed).toBe(true)
        expect(result.closeError).toContain('delete-branch:')
    })

    it('删分支 500 → closed 但记 closeError', async () => {
        const { octokit } = makeOctokit({
            checks: (ref) => (ref === 'parent-sha' ? [checkRun('Test', 'success')] : [checkRun('Test', 'failure')]),
            deleteError: Object.assign(new Error('server error'), { status: 500 }),
        })

        const result = await watchPullRequestChecks(baseParams({ octokit, closeFailedPr: true }))
        expect(result.closed).toBe(true)
        expect(result.closeError).toContain('delete-branch:')
    })

    it('startup_failure / 未识别结论 → failed + unknown（只评论不关闭）', async () => {
        for (const conclusion of ['startup_failure', 'some_future_conclusion']) {
            const { octokit, spies } = makeOctokit({
                // 父提交同 job 绿 → 仍不得判 self_caused（只评论）
                checks: (ref) => (ref === 'parent-sha'
                    ? [checkRun('Test', 'success')]
                    : [checkRun('Test', conclusion)]),
            })
            const result = await watchPullRequestChecks(baseParams({ octokit, closeFailedPr: true }))
            expect(result.state, conclusion).toBe('failed')
            expect(result.attribution, conclusion).toBe('unknown')
            expect(result.closed, conclusion).toBe(false)
            expect(result.commented, conclusion).toBe(true)
            expect(spies.updatePull, conclusion).not.toHaveBeenCalled()
        }
    })

    it('startup_failure + success → 仍是 failed（不得判 passed）', async () => {
        const { octokit } = makeOctokit({
            checks: (ref) => (ref === 'parent-sha'
                ? [checkRun('Broken workflow', 'success'), checkRun('Test', 'success')]
                : [checkRun('Broken workflow', 'startup_failure'), checkRun('Test', 'success')]),
        })
        const result = await watchPullRequestChecks(baseParams({ octokit }))
        expect(result.state).toBe('failed')
        expect(result.attribution).toBe('unknown')
    })

    it('headSha 缺省 → 用 head 分支名作为查询 ref', async () => {
        const refs: string[] = []
        const { octokit } = makeOctokit({
            checks: (ref) => {
                refs.push(ref)
                return [checkRun('Test', 'success')]
            },
        })

        await watchPullRequestChecks(baseParams({ octokit, headSha: undefined }))
        expect(refs.every((ref) => ref === 'dependfix/auto-fix-abcdef12')).toBe(true)
    })

    it('宽限期后仍无 check → no_ci_detected（绝不判 passed）', async () => {
        const { octokit, spies } = makeOctokit({ checks: () => [] })
        const clock = makeClock()

        const result = await watchPullRequestChecks(baseParams({
            octokit,
            now: clock.now,
            sleep: clock.sleep,
        }))

        expect(result.state).toBe('no_ci_detected')
        expect(result.commented).toBe(false)
        expect(spies.createComment).not.toHaveBeenCalled()
        expect(result.durationMs).toBeGreaterThanOrEqual(PR_CHECK_GRACE_MS)
    })

    it('check 长时间未完成 → timeout 并评论（结果未判定）', async () => {
        const { octokit, spies } = makeOctokit({
            checks: () => [checkRun('Test', 'queued', { status: 'in_progress', conclusion: null })],
        })
        const clock = makeClock()

        const result = await watchPullRequestChecks(baseParams({
            octokit,
            timeoutMs: 90_000,
            now: clock.now,
            sleep: clock.sleep,
        }))

        expect(result.state).toBe('timeout')
        expect(result.commented).toBe(true)
        expect(String(spies.createComment.mock.calls[0]?.[0]?.body)).toContain('等待超时')
    })

    it('全部 cancelled / skipped → cancelled（不评论）', async () => {
        const { octokit, spies } = makeOctokit({
            checks: () => [checkRun('Test', 'cancelled'), checkRun('Coverage', 'skipped')],
        })

        const result = await watchPullRequestChecks(baseParams({ octokit }))
        expect(result.state).toBe('cancelled')
        expect(result.commented).toBe(false)
        expect(spies.createComment).not.toHaveBeenCalled()
    })

    it('dry-run：失败也只记录，不评论 / 不关闭 / 不删分支', async () => {
        const { octokit, spies } = makeOctokit({
            checks: (ref) => (ref === 'parent-sha' ? [checkRun('Test', 'success')] : [checkRun('Test', 'failure')]),
        })

        const result = await watchPullRequestChecks(baseParams({ octokit, dryRun: true, closeFailedPr: true }))

        expect(result).toMatchObject({ state: 'failed', attribution: 'self_caused', closed: false, commented: false })
        expect(spies.createComment).not.toHaveBeenCalled()
        expect(spies.updatePull).not.toHaveBeenCalled()
        expect(spies.deleteRef).not.toHaveBeenCalled()
    })

    it('评论 403 → 记录 commentError，不抛断运行、不改变终态', async () => {
        const { octokit } = makeOctokit({
            checks: () => [checkRun('Test', 'failure')],
            parentSha: null,
            commentError: new Error('403 Forbidden'),
        })

        const result = await watchPullRequestChecks(baseParams({ octokit }))
        expect(result.state).toBe('failed')
        expect(result.commented).toBe(false)
        expect(result.commentError).toContain('403')
    })

    it('关闭失败 → closeError 记录且仍评论（PR 可能仍开启）', async () => {
        const { octokit } = makeOctokit({
            checks: (ref) => (ref === 'parent-sha' ? [checkRun('Test', 'success')] : [checkRun('Test', 'failure')]),
            closeError: new Error('Resource not accessible by integration'),
        })

        const result = await watchPullRequestChecks(baseParams({ octokit, closeFailedPr: true }))
        expect(result.closed).toBe(false)
        expect(result.closeError).toContain('close:')
        expect(result.commented).toBe(true)
    })

    it('单轮 API 失败 → 退避重试并在下一轮恢复', async () => {
        let attempts = 0
        const { octokit } = makeOctokit({
            checks: () => {
                attempts++
                if (attempts === 1) {
                    throw new Error('429 rate limited')
                }
                return [checkRun('Test', 'success')]
            },
        })
        const clock = makeClock()

        const result = await watchPullRequestChecks(baseParams({ octokit, now: clock.now, sleep: clock.sleep }))

        expect(result.state).toBe('passed')
        expect(result.polls).toBe(2)
        expect(attempts).toBe(2)
    })

    it('轮询次数上限 → timeout，且不冒充预算来源（budgetLimit=undefined）', async () => {
        const { octokit } = makeOctokit({
            checks: () => [checkRun('Test', 'queued', { status: 'in_progress', conclusion: null })],
        })

        const result = await watchPullRequestChecks(baseParams({
            octokit,
            // 时钟不前进：只能由轮询次数上限收敛（防 hot loop）
            now: () => 0,
            sleep: async () => { /* 不推进时间 */ },
        }))

        expect(result.state).toBe('timeout')
        expect(result.reason).toContain('轮询次数上限')
        expect(result.budgetLimit).toBeUndefined()
        expect(result.polls).toBeGreaterThan(0)
    })

    it('预算为 0 → 直接 timeout，不发 API，budgetLimit=job', async () => {
        const { octokit, spies } = makeOctokit({ checks: () => [checkRun('Test', 'success')] })

        const result = await watchPullRequestChecks(baseParams({
            octokit,
            jobBudgetRemainingMs: 0,
        }))

        expect(result.state).toBe('timeout')
        expect(result.polls).toBe(0)
        expect(result.budgetLimit).toBe('job')
        expect(result.reason).toContain('等待前预算已耗尽')
        expect(spies.checksList).not.toHaveBeenCalled()
    })

    it('API 全程失败 → timeout 且 reason 记录最后错误（不当成零观测）', async () => {
        const { octokit } = makeOctokit({
            checks: () => {
                throw new Error('502 bad gateway')
            },
            statuses: () => {
                throw new Error('502 bad gateway')
            },
        })
        const clock = makeClock()

        const result = await watchPullRequestChecks(baseParams({
            octokit,
            timeoutMs: 60_000,
            now: clock.now,
            sleep: clock.sleep,
        }))

        expect(result.state).toBe('timeout')
        expect(result.reason).toContain('最后错误')
        expect(result.reason).toContain('502')
        expect(result.budgetLimit).toBe('pr')
    })
})

describe('buildCheckFailureComment', () => {
    it('失败评论含 job 名 / URL / 归因 / 尝试标记', () => {
        const body = buildCheckFailureComment({
            prNumber: 7,
            state: 'failed',
            attribution: 'self_caused',
            failedChecks: [{
                name: 'Test',
                url: 'https://ci.example/test',
                attribution: 'self_caused',
            }],
            attempts: [{ key: '0123456789abcdef', n: 2 }],
        })

        expect(body).toContain('PR check 未通过')
        expect(body).toContain('| Test |')
        expect(body).toContain('https://ci.example/test')
        expect(body).toContain('self_caused')
        expect(body).toContain('<!-- dependfix:attempt key=0123456789abcdef n=2 failed=? -->')
        expect(body).toContain('<!-- dependfix:pr-check -->')
    })

    it('unknown 评论标注未判定且声明不关闭', () => {
        const body = buildCheckFailureComment({
            prNumber: 7,
            state: 'failed',
            attribution: 'unknown',
            failedChecks: [{ name: 'Test', attribution: 'unknown' }],
        })
        expect(body).toContain('不会自动关闭')
    })

    it('超时评论含未判定提示与原因', () => {
        const body = buildCheckFailureComment({
            prNumber: 7,
            state: 'timeout',
            reason: '等待超时（90s 预算内未全部完成）',
        })
        expect(body).toContain('等待超时')
        expect(body).toContain('90s')
    })
})
