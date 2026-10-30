import { describe, expect, it, vi } from 'vitest'
import type { DataSource } from 'typeorm'
import type { Octokit } from '@octokit/rest'
import { buildFeedbackMarker } from './decision'
import { runPrFeedbackForRepository } from './service'

const SHA = 'a'.repeat(40)
const now = new Date('2026-10-30T12:00:00Z')
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000)

interface Harness {
    ds: DataSource
    octokit: Octokit
    commentBodies: string[]
    createComment: ReturnType<typeof vi.fn>
    closePull: ReturnType<typeof vi.fn>
    getPull: ReturnType<typeof vi.fn>
    savedAudits: Record<string, unknown>[]
}

function makeHarness(options: {
    prFeedback?: string | null
    run?: { prNumber: number, finishedAt: Date | null } | null
    prCheck?: { headSha: string, conclusion: string, failureSourcesJson: string | null, createdAt: Date } | null
    comments?: string[]
    commentError?: Error
    prState?: 'open' | 'closed' | (() => 'open' | 'closed')
} = {}): Harness {
    const savedAudits: Record<string, unknown>[] = []
    const createComment = vi.fn(async () => {
        if (options.commentError) {
            throw options.commentError
        }
        return {}
    })
    const closePull = vi.fn(async () => ({}))
    const getPull = vi.fn(async () => ({
        data: { state: typeof options.prState === 'function' ? options.prState() : (options.prState ?? 'open') },
    }))
    const commentBodies = options.comments ?? []

    const repos: Record<string, unknown> = {
        Repository: {
            findOne: vi.fn(async () => ({
                id: 'repo-1',
                owner: 'acme',
                name: 'app',
                prFeedback: options.prFeedback === undefined ? null : options.prFeedback,
            })),
        },
        ScanRun: {
            find: vi.fn(async () => (options.run ? [{ id: 'run-1', prNumber: options.run.prNumber, finishedAt: options.run.finishedAt }] : [])),
        },
        PRCheck: {
            findOne: vi.fn(async () => (options.prCheck
                ? { ...options.prCheck, createdAt: options.prCheck.createdAt }
                : null)),
        },
        AuditEvent: {
            create: vi.fn((input: Record<string, unknown>) => input),
            save: vi.fn(async (input: Record<string, unknown>) => {
                savedAudits.push(input)
                return input
            }),
        },
    }

    const ds = {
        getRepository: (entity: { name?: string }) => repos[(entity as { name?: string }).name ?? ''],
    } as unknown as DataSource

    const octokit = {
        paginate: async () => commentBodies.map((body) => ({ body })),
        rest: {
            issues: {
                listComments: vi.fn(),
                createComment,
            },
            pulls: { update: closePull, get: getPull },
        },
    } as unknown as Octokit

    return { ds, octokit, commentBodies, createComment, closePull, getPull, savedAudits }
}

const defaultRun = { prNumber: 7, finishedAt: hoursAgo(1) }
const failedCheck = {
    headSha: SHA,
    conclusion: 'failure',
    failureSourcesJson: JSON.stringify([{ provider: 'github-actions', name: 'Test', kind: 'check' }]),
    createdAt: hoursAgo(1),
}

describe('runPrFeedbackForRepository', () => {
    it('失败终态：评论一次并写审计（marker 幂等）', async () => {
        const h = makeHarness({ run: defaultRun, prCheck: failedCheck })
        const first = await runPrFeedbackForRepository({ ds: h.ds, octokit: h.octokit, repositoryId: 'repo-1', now })
        expect(first).toEqual({ commented: 1, closed: 0, errors: 0 })
        expect(h.createComment).toHaveBeenCalledTimes(1)
        const body = h.createComment.mock.calls[0]![0] as { body: string }
        expect(body.body).toContain(buildFeedbackMarker(SHA))
        expect(body.body).toContain('`github-actions/Test`')
        expect(h.savedAudits.map((audit) => audit.type)).toEqual(['pr_feedback_commented'])
    })

    it('已存在同 headSha 的 marker → 不重复评论', async () => {
        const h = makeHarness({ run: defaultRun, prCheck: failedCheck, comments: [`old\n${buildFeedbackMarker(SHA)}`] })
        const result = await runPrFeedbackForRepository({ ds: h.ds, octokit: h.octokit, repositoryId: 'repo-1', now })
        expect(result).toEqual({ commented: 0, closed: 0, errors: 0 })
        expect(h.createComment).not.toHaveBeenCalled()
    })

    it('closeFailed 开启：评论 + 关闭 + 两条审计', async () => {
        const h = makeHarness({
            prFeedback: '{"closeFailed":true}',
            run: defaultRun,
            prCheck: failedCheck,
        })
        const result = await runPrFeedbackForRepository({ ds: h.ds, octokit: h.octokit, repositoryId: 'repo-1', now })
        expect(result).toEqual({ commented: 1, closed: 1, errors: 0 })
        expect(h.closePull).toHaveBeenCalledWith(expect.objectContaining({ pull_number: 7, state: 'closed' }))
        expect(h.savedAudits.map((audit) => audit.type)).toEqual(['pr_feedback_commented', 'pr_feedback_closed'])
    })

    it('非失败结论 / 窗口外 / 无 PRCheck / 无 PR 交付 → 不动作', async () => {
        for (const scenario of [
            { run: defaultRun, prCheck: { ...failedCheck, conclusion: 'success' } },
            { run: { prNumber: 7, finishedAt: hoursAgo(30) }, prCheck: failedCheck },
            { run: defaultRun, prCheck: null },
            { run: null, prCheck: failedCheck },
        ]) {
            const h = makeHarness(scenario as Parameters<typeof makeHarness>[0])
            const result = await runPrFeedbackForRepository({ ds: h.ds, octokit: h.octokit, repositoryId: 'repo-1', now })
            expect(result).toEqual({ commented: 0, closed: 0, errors: 0 })
            expect(h.createComment).not.toHaveBeenCalled()
        }
    })

    it('PR 已关闭（终态）→ 不评论、不重复关闭', async () => {
        const h = makeHarness({
            prFeedback: '{"closeFailed":true}',
            run: defaultRun,
            prCheck: failedCheck,
            prState: 'closed',
        })
        const result = await runPrFeedbackForRepository({ ds: h.ds, octokit: h.octokit, repositoryId: 'repo-1', now })
        expect(result).toEqual({ commented: 0, closed: 0, errors: 0 })
        expect(h.createComment).not.toHaveBeenCalled()
        expect(h.closePull).not.toHaveBeenCalled()
    })

    it('连续两轮：关闭后 PR 变 closed → 只关闭一次、只写一条审计', async () => {
        let state: 'open' | 'closed' = 'open'
        const h = makeHarness({
            prFeedback: '{"closeFailed":true}',
            run: defaultRun,
            prCheck: failedCheck,
            prState: () => state,
        })
        const first = await runPrFeedbackForRepository({ ds: h.ds, octokit: h.octokit, repositoryId: 'repo-1', now })
        expect(first).toEqual({ commented: 1, closed: 1, errors: 0 })
        state = 'closed'
        const second = await runPrFeedbackForRepository({ ds: h.ds, octokit: h.octokit, repositoryId: 'repo-1', now })
        expect(second).toEqual({ commented: 0, closed: 0, errors: 0 })
        expect(h.closePull).toHaveBeenCalledTimes(1)
        expect(h.savedAudits.filter((audit) => audit.type === 'pr_feedback_closed')).toHaveLength(1)
    })

    it('comment=false 且 closeFailed=false → 直接返回（不发 API 调用）', async () => {
        const h = makeHarness({ prFeedback: '{"comment":false,"closeFailed":false}', run: defaultRun, prCheck: failedCheck })
        const result = await runPrFeedbackForRepository({ ds: h.ds, octokit: h.octokit, repositoryId: 'repo-1', now })
        expect(result).toEqual({ commented: 0, closed: 0, errors: 0 })
        expect(h.createComment).not.toHaveBeenCalled()
    })

    it('PR 状态查询失败 → 不动作但计入 errors（fail-safe，不影响轮询）', async () => {
        const h = makeHarness({ prFeedback: '{"closeFailed":true}', run: defaultRun, prCheck: failedCheck })
        h.getPull.mockRejectedValueOnce(new Error('404 Not Found'))
        const logger = { info: vi.fn(), warn: vi.fn() }
        const result = await runPrFeedbackForRepository({ ds: h.ds, octokit: h.octokit, repositoryId: 'repo-1', now, logger })
        expect(result).toEqual({ commented: 0, closed: 0, errors: 1 })
        expect(h.createComment).not.toHaveBeenCalled()
        expect(h.closePull).not.toHaveBeenCalled()
    })

    it('评论失败只记 errors 并 warn，不抛出', async () => {
        const h = makeHarness({ run: defaultRun, prCheck: failedCheck, commentError: new Error('boom') })
        const logger = { info: vi.fn(), warn: vi.fn() }
        const result = await runPrFeedbackForRepository({ ds: h.ds, octokit: h.octokit, repositoryId: 'repo-1', now, logger })
        expect(result).toEqual({ commented: 0, closed: 0, errors: 1 })
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('反馈失败'))
    })
})
