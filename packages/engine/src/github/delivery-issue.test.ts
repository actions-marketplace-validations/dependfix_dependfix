import type { Octokit } from '@octokit/rest'
import { describe, expect, it, vi } from 'vitest'
import {
    DELIVERY_SKIP_LABEL,
    buildDeliverySkipIssueBody,
    buildDeliverySkipIssueTitle,
    computeDeliverySkipFingerprint,
    createDeliverySkipIssue,
    findDeliverySkipIssue,
    formatDeliverySkipMarker,
    hasDeliverySkipMarker,
} from './delivery-issue'

const stubOctokit = (options: {
    issues?: Array<Record<string, unknown>>
    created?: { number: number, html_url: string }
}) => {
    const listForRepo = vi.fn(async () => ({ data: options.issues ?? [] }))
    const create = vi.fn(async () => ({ data: options.created ?? { number: 11, html_url: 'https://github.com/acme/app/issues/11' } }))
    const octokit = { rest: { issues: { listForRepo, create } } } as unknown as Octokit
    return { octokit, listForRepo, create }
}

describe('delivery-issue fingerprint', () => {
    it('与输入顺序无关，且不含错误文本 / 时间（幂等去重的前提）', () => {
        const first = computeDeliverySkipFingerprint({
            repositories: ['b/two', 'a/one'],
            failingCommands: ['pnpm test', 'pnpm install --frozen-lockfile'],
        })
        const second = computeDeliverySkipFingerprint({
            repositories: ['a/one', 'b/two', 'a/one'],
            failingCommands: ['pnpm install --frozen-lockfile', 'pnpm test'],
        })
        expect(first).toBe(second)
        expect(first).toMatch(/^[\da-f]{16}$/)
    })

    it('仓库集或失败命令不同 → 指纹不同', () => {
        const base = { repositories: ['a/one'], failingCommands: ['pnpm install --frozen-lockfile'] }
        expect(computeDeliverySkipFingerprint(base)).not.toBe(computeDeliverySkipFingerprint({
            repositories: ['a/one', 'b/two'],
            failingCommands: ['pnpm install --frozen-lockfile'],
        }))
        expect(computeDeliverySkipFingerprint(base)).not.toBe(computeDeliverySkipFingerprint({
            repositories: ['a/one'],
            failingCommands: ['pnpm install'],
        }))
    })

    it('marker 与正文往返', () => {
        const fingerprint = 'abcdef0123456789'
        const marker = formatDeliverySkipMarker(fingerprint)
        expect(marker).toBe('<!-- dependfix:delivery-skip fp=abcdef0123456789 -->')
        expect(hasDeliverySkipMarker(`${marker}\n正文`, fingerprint)).toBe(true)
        expect(hasDeliverySkipMarker('正文', fingerprint)).toBe(false)
        expect(hasDeliverySkipMarker(null, fingerprint)).toBe(false)
        expect(hasDeliverySkipMarker(marker, '0000000000000000')).toBe(false)
    })
})

describe('delivery-issue body', () => {
    it('marker 置首，引用仓库与失败命令，并说明关闭后不重开', () => {
        const fingerprint = computeDeliverySkipFingerprint({
            repositories: ['acme/app'],
            failingCommands: ['pnpm install --frozen-lockfile'],
        })
        const body = buildDeliverySkipIssueBody({
            fingerprint,
            runId: 'dependfix-run-1',
            repositories: ['acme/app'],
            failingCommands: ['pnpm install --frozen-lockfile'],
        })
        expect(body.split('\n')[0]).toBe(formatDeliverySkipMarker(fingerprint))
        expect(body).toContain('`acme/app`')
        expect(body).toContain('`pnpm install --frozen-lockfile`')
        expect(body).toContain('`dependfix-run-1`')
        expect(body).toContain('关闭后不会自动重开')
    })

    it('标题带仓库集（空集合回退通用文案）', () => {
        expect(buildDeliverySkipIssueTitle(['acme/app'])).toContain('acme/app')
        expect(buildDeliverySkipIssueTitle([])).toContain('target repository')
    })
})

describe('delivery-issue GitHub API', () => {
    it('命中已关闭的同指纹 issue → 复用（关闭后不重开）', async () => {
        const fingerprint = 'ffffffffffffffff'
        const { octokit, listForRepo } = stubOctokit({
            issues: [
                { number: 9, html_url: 'https://github.com/acme/app/issues/9', state: 'closed', body: `${formatDeliverySkipMarker(fingerprint)}\n正文` },
            ],
        })
        const existing = await findDeliverySkipIssue(octokit, 'acme', 'app', fingerprint)
        expect(existing).toEqual({ number: 9, htmlUrl: 'https://github.com/acme/app/issues/9' })
        expect(listForRepo).toHaveBeenCalledWith(expect.objectContaining({ state: 'all', per_page: 100 }))
    })

    it('忽略 PR 与不同指纹的 issue', async () => {
        const fingerprint = 'ffffffffffffffff'
        const { octokit } = stubOctokit({
            issues: [
                { number: 1, html_url: 'x', body: formatDeliverySkipMarker(fingerprint), pull_request: { url: 'https://api.github.com/pulls/1' } },
                { number: 2, html_url: 'y', body: formatDeliverySkipMarker('0000000000000000') },
            ],
        })
        await expect(findDeliverySkipIssue(octokit, 'acme', 'app', fingerprint)).resolves.toBeNull()
    })

    it('创建 issue 带标签与正文', async () => {
        const { octokit, create } = stubOctokit({ created: { number: 12, html_url: 'https://github.com/acme/app/issues/12' } })
        const created = await createDeliverySkipIssue(octokit, 'acme', 'app', {
            title: 'title',
            body: 'body',
            labels: [DELIVERY_SKIP_LABEL],
        })
        expect(created).toEqual({ number: 12, htmlUrl: 'https://github.com/acme/app/issues/12' })
        expect(create).toHaveBeenCalledWith({
            owner: 'acme',
            repo: 'app',
            title: 'title',
            body: 'body',
            labels: ['dependfix'],
        })
    })
})
