import { describe, expect, it, vi } from 'vitest'
import type { Octokit } from '@octokit/rest'
import { computeAttemptKey, formatAttemptMarker } from './fix-fingerprint'
import { CLOSED_ATTEMPT_QUERY_LIMIT, ClosedAttemptIndex } from './attempt-history'

const KEY = computeAttemptKey({
    source: 'dependabot',
    packageName: 'lodash',
    targetVersion: '4.17.21',
    planStrategy: 'direct-upgrade',
})

interface FakePR {
    number: number
    html_url: string
    head: { ref: string }
    body: string | null
    merged_at: string | null
}

function makePR(overrides: Partial<FakePR> = {}): FakePR {
    return {
        number: 1,
        html_url: 'https://github.com/owner/repo/pull/1',
        head: { ref: 'dependfix/auto-fix-1234abcd' },
        body: formatAttemptMarker({ key: KEY, n: 1 }),
        merged_at: null,
        ...overrides,
    }
}

function makeOctokit(prs: FakePR[] | Error, list = vi.fn()): Octokit {
    list.mockImplementation(async () => {
        if (prs instanceof Error) {
            throw prs
        }
        return { data: prs }
    })
    return { rest: { pulls: { list } } } as unknown as Octokit
}

function makeListMock() {
    return vi.fn()
}

describe('ClosedAttemptIndex', () => {
    it('只索引 dependfix 前缀且未合并的已关闭 PR', async () => {
        const list = makeListMock()
        const octokit = makeOctokit([
            makePR({ number: 1 }),
            makePR({ number: 2, merged_at: '2026-10-01T00:00:00Z' }),
            makePR({ number: 3, head: { ref: 'feat/other' } }),
            makePR({ number: 4, body: null }),
        ], list)

        const prs = await new ClosedAttemptIndex().closedPRs(octokit, 'owner', 'repo')

        expect(prs.map((pr) => pr.number)).toEqual([1, 4])
        expect(prs[1]?.markers).toEqual([])
        expect(list).toHaveBeenCalledWith({
            owner: 'owner',
            repo: 'repo',
            state: 'closed',
            sort: 'updated',
            direction: 'desc',
            per_page: CLOSED_ATTEMPT_QUERY_LIMIT,
        })
    })

    it('按仓库缓存：多条告警共用一次 pulls.list', async () => {
        const list = makeListMock()
        const index = new ClosedAttemptIndex()
        const octokit = makeOctokit([makePR()], list)

        await index.closedAttemptCount(octokit, 'owner', 'repo', KEY)
        await index.closedAttemptCount(octokit, 'owner', 'repo', KEY)

        expect(list).toHaveBeenCalledTimes(1)
    })

    it('不同仓库分别查询', async () => {
        const list = makeListMock()
        const index = new ClosedAttemptIndex()
        const octokit = makeOctokit([makePR()], list)

        await index.closedPRs(octokit, 'owner', 'repo-a')
        await index.closedPRs(octokit, 'owner', 'repo-b')

        expect(list).toHaveBeenCalledTimes(2)
    })

    it('统计同键关闭次数（一个 PR 可携带多条标记，只算一次）', async () => {
        const otherKey = computeAttemptKey({
            source: 'dependabot',
            packageName: 'express',
            targetVersion: '4.18.2',
            planStrategy: 'direct-upgrade',
        })
        const list = makeListMock()
        const octokit = makeOctokit([
            makePR({ number: 1, body: `${formatAttemptMarker({ key: KEY, n: 1 })}\n${formatAttemptMarker({ key: otherKey, n: 1 })}` }),
            makePR({ number: 2, body: `${formatAttemptMarker({ key: KEY, n: 2 })}\n${formatAttemptMarker({ key: KEY, n: 2 })}` }),
            makePR({ number: 3, body: formatAttemptMarker({ key: otherKey, n: 2 }) }),
        ], list)

        expect(await new ClosedAttemptIndex().closedAttemptCount(octokit, 'owner', 'repo', KEY)).toBe(2)
        expect(await new ClosedAttemptIndex().closedAttemptCount(octokit, 'owner', 'repo', otherKey)).toBe(2)
    })

    it('查询失败 fail-open：返回空集并告警一次', async () => {
        const list = makeListMock()
        const warn = vi.fn()
        const index = new ClosedAttemptIndex({ logger: { warn } })
        const octokit = makeOctokit(new Error('rate limited'), list)

        expect(await index.closedAttemptCount(octokit, 'owner', 'repo', KEY)).toBe(0)
        // 失败结果同样缓存：后续告警不重复打 API
        expect(await index.closedAttemptCount(octokit, 'owner', 'repo', KEY)).toBe(0)
        expect(list).toHaveBeenCalledTimes(1)
        expect(warn).toHaveBeenCalledTimes(1)
        expect(warn.mock.calls[0]?.[0]).toContain('rate limited')
    })

    it('查询条数可覆盖（测试 / 调优）', async () => {
        const list = makeListMock()
        const octokit = makeOctokit([], list)
        await new ClosedAttemptIndex({ limit: 5 }).closedPRs(octokit, 'owner', 'repo')
        expect(list.mock.calls[0]?.[0]).toMatchObject({ per_page: 5 })
    })
})
