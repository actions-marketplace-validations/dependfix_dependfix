import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest'
import nock from 'nock'
import { Octokit } from '@octokit/rest'
import { PollingSource, isTargetAuthor } from './polling-source'
import { isFailureConclusion, TARGET_PR_AUTHOR_LOGINS } from './types'

const API = 'https://api.github.com'

/** 构造测试用 Octokit（不真实发请求，由 nock 拦截） */
const makeOctokit = (): Octokit => new Octokit({ auth: 'test-token' })

const HEAD_SHA = 'a'.repeat(40)

/** PR 夹具（author 可配置；updated_at 默认在窗口内） */
const makePr = (overrides: Record<string, unknown> = {}) => ({
    number: 101,
    html_url: 'https://github.com/acme/web-app/pull/101',
    updated_at: new Date().toISOString(),
    user: { login: 'dependfix[bot]' },
    head: { sha: HEAD_SHA },
    ...overrides,
})

/** 注册三源的常规响应（各源可覆盖 / 传 null 表示不注册，用于 fail-open 用例） */
const mockSources = (options: {
    pulls?: unknown[]
    checkRuns?: unknown[]
    statuses?: unknown[]
    deployments?: unknown[]
    deploymentStatuses?: Record<number, unknown[]>
} = {}) => {
    const {
        pulls = [makePr()],
        checkRuns = [],
        statuses = [],
        deployments = [],
        deploymentStatuses = {},
    } = options

    nock(API).get('/repos/acme/web-app/pulls').query(true).reply(200, pulls)
    nock(API).get(`/repos/acme/web-app/commits/${HEAD_SHA}/check-runs`).query(true).reply(200, { total_count: checkRuns.length, check_runs: checkRuns })
    nock(API).get(`/repos/acme/web-app/commits/${HEAD_SHA}/statuses`).query(true).reply(200, statuses)
    nock(API).get('/repos/acme/web-app/deployments').query(true).reply(200, deployments)
    for (const [id, list] of Object.entries(deploymentStatuses)) {
        nock(API).get(`/repos/acme/web-app/deployments/${id}/statuses`).query(true).reply(200, list)
    }
}

const source = () => new PollingSource(makeOctokit())

describe('monitor/types', () => {
    describe('isFailureConclusion', () => {
        it('failure / timed_out / action_required 触发 firing', () => {
            expect(isFailureConclusion('failure')).toBe(true)
            expect(isFailureConclusion('timed_out')).toBe(true)
            expect(isFailureConclusion('action_required')).toBe(true)
        })

        it('success / pending / skipped 等不触发 firing', () => {
            expect(isFailureConclusion('success')).toBe(false)
            expect(isFailureConclusion('pending')).toBe(false)
            expect(isFailureConclusion('skipped')).toBe(false)
            expect(isFailureConclusion('cancelled')).toBe(false)
            expect(isFailureConclusion('neutral')).toBe(false)
            expect(isFailureConclusion('stale')).toBe(false)
        })
    })

    describe('TARGET_PR_AUTHOR_LOGINS', () => {
        it('默认含 dependfix[bot] + dependabot[bot]', () => {
            expect(TARGET_PR_AUTHOR_LOGINS).toContain('dependfix[bot]')
            expect(TARGET_PR_AUTHOR_LOGINS).toContain('dependabot[bot]')
        })
    })
})

describe('monitor/polling-source 工具函数', () => {
    describe('isTargetAuthor', () => {
        it('匹配 dependabot[bot]', () => {
            expect(isTargetAuthor('dependabot[bot]')).toBe(true)
        })

        it('匹配 dependfix[bot] 大小写不敏感', () => {
            expect(isTargetAuthor('DependFix[bot]')).toBe(true)
            expect(isTargetAuthor('dependfix[bot]')).toBe(true)
        })

        it('匹配 GitHub App 动态生成的 bot 名（依赖 [bot] + dependfix 子串）', () => {
            expect(isTargetAuthor('12345+dependfix[bot]')).toBe(true)
            expect(isTargetAuthor('9876+DependFix[bot]')).toBe(true)
        })

        it('不匹配普通用户或无关 bot', () => {
            expect(isTargetAuthor('alice')).toBe(false)
            expect(isTargetAuthor('renovate[bot]')).toBe(false)
            expect(isTargetAuthor('')).toBe(false)
        })
    })
})

describe('monitor/polling-source 三源采集', () => {
    beforeEach(() => {
        nock.cleanAll()
    })

    afterEach(() => {
        nock.cleanAll()
    })

    it('归一化三源信号并标注 provider（Actions check + Vercel status/deployment + Cloudflare check）', async () => {
        mockSources({
            checkRuns: [
                {
                    id: 9001,
                    name: 'Test',
                    status: 'completed',
                    conclusion: 'success',
                    app: { slug: 'github-actions' },
                    output: { text: 'all good' },
                },
                {
                    id: 9002,
                    name: 'Workers Builds',
                    status: 'completed',
                    conclusion: 'failure',
                    app: { slug: 'cloudflare-workers-and-pages' },
                    output: { text: 'build failed: script size exceeded' },
                    details_url: 'https://dash.cloudflare.com/build/9002',
                },
            ],
            statuses: [
                {
                    id: 7001,
                    context: 'Vercel – web-app',
                    state: 'success',
                    target_url: 'https://vercel.com/acme/web-app/abc',
                },
            ],
            deployments: [
                { id: 5001, environment: 'Preview', creator: { login: 'vercel[bot]' } },
            ],
            deploymentStatuses: {
                '5001': [
                    {
                        state: 'failure',
                        description: 'Deployment failed',
                        environment_url: 'https://web-app-git-preview.vercel.app',
                        log_url: 'https://vercel.com/acme/web-app/logs',
                    },
                ],
            },
        })

        const snapshots = await source().fetchSnapshots({
            owner: 'acme',
            repo: 'web-app',
            repositoryId: 'repo-1',
        })

        expect(snapshots).toHaveLength(1)
        const snapshot = snapshots[0]!
        expect(snapshot.signals).toHaveLength(4)

        const providers = snapshot.signals.map((s) => `${s.kind}:${s.provider}`)
        expect(providers).toContain('check:github-actions')
        expect(providers).toContain('check:cloudflare-workers-and-pages')
        expect(providers).toContain('status:vercel')
        expect(providers).toContain('deployment:vercel[bot]')

        const deployment = snapshot.signals.find((s) => s.kind === 'deployment')!
        expect(deployment.state).toBe('failure')
        expect(deployment.name).toBe('Preview')
        expect(deployment.targetUrl).toBe('https://web-app-git-preview.vercel.app')
        expect(deployment.logUrl).toBe('https://vercel.com/acme/web-app/logs')

        // 聚合：Cloudflare check + Vercel deployment 失败 → overall=failure，conclusion 保留失败 check 粒度
        expect(snapshot.overallStatus).toBe('failure')
        expect(snapshot.conclusion).toBe('failure')
        expect(snapshot.errorMessage).toBe('build failed: script size exceeded')
    })

    it('无任何信号（无 check / 无 status / 无 deployment）的 PR 不产出快照', async () => {
        mockSources({ checkRuns: [], statuses: [], deployments: [] })
        const snapshots = await source().fetchSnapshots({ owner: 'acme', repo: 'web-app', repositoryId: 'repo-1' })
        expect(snapshots).toHaveLength(0)
    })

    it('fail-open：check runs 源失败不阻断 commit statuses / deployments 源', async () => {
        nock(API).get('/repos/acme/web-app/pulls').query(true).reply(200, [makePr()])
        nock(API).get(`/repos/acme/web-app/commits/${HEAD_SHA}/check-runs`).query(true).reply(500, { message: 'boom' })
        nock(API).get(`/repos/acme/web-app/commits/${HEAD_SHA}/statuses`).query(true).reply(200, [
            { id: 7001, context: 'Vercel – web-app', state: 'failure', target_url: null },
        ])
        nock(API).get('/repos/acme/web-app/deployments').query(true).reply(200, [])

        const snapshots = await source().fetchSnapshots({ owner: 'acme', repo: 'web-app', repositoryId: 'repo-1' })
        expect(snapshots).toHaveLength(1)
        expect(snapshots[0]!.signals).toHaveLength(1)
        expect(snapshots[0]!.signals[0]!.kind).toBe('status')
        expect(snapshots[0]!.overallStatus).toBe('failure')
    })

    it('fail-open：deployments 源失败不阻断其余源', async () => {
        nock(API).get('/repos/acme/web-app/pulls').query(true).reply(200, [makePr()])
        nock(API).get(`/repos/acme/web-app/commits/${HEAD_SHA}/check-runs`).query(true).reply(200, {
            total_count: 1,
            check_runs: [{ id: 9001, name: 'Test', status: 'completed', conclusion: 'success', app: { slug: 'github-actions' } }],
        })
        nock(API).get(`/repos/acme/web-app/commits/${HEAD_SHA}/statuses`).query(true).reply(200, [])
        nock(API).get('/repos/acme/web-app/deployments').query(true).reply(500, { message: 'boom' })

        const snapshots = await source().fetchSnapshots({ owner: 'acme', repo: 'web-app', repositoryId: 'repo-1' })
        expect(snapshots).toHaveLength(1)
        expect(snapshots[0]!.signals).toHaveLength(1)
        expect(snapshots[0]!.overallStatus).toBe('success')
    })

    it('轮询节流：updated_at 早于窗口的 PR 不再打三源 API', async () => {
        const stale = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        mockSources({ pulls: [makePr({ updated_at: stale })] })

        const snapshots = await source().fetchSnapshots({ owner: 'acme', repo: 'web-app', repositoryId: 'repo-1' })
        expect(snapshots).toHaveLength(0)
        // 仅 pulls 被消费（三源 API 未注册也未调用）
        expect(nock.pendingMocks().length).toBeGreaterThan(0)
    })

    it('非目标作者 / 非 open PR 被忽略', async () => {
        mockSources({
            pulls: [
                makePr({ number: 1, user: { login: 'alice' } }),
                makePr({ number: 2, user: { login: 'renovate[bot]' } }),
            ],
        })
        const snapshots = await source().fetchSnapshots({ owner: 'acme', repo: 'web-app', repositoryId: 'repo-1' })
        expect(snapshots).toHaveLength(0)
    })

    it('形态守卫：check runs 响应缺少 total_count（非标准形态）不产出伪信号', async () => {
        // Octokit paginate 对「无 total_count」的响应会把整个 body 当作单个元素返回
        nock(API).get('/repos/acme/web-app/pulls').query(true).reply(200, [makePr()])
        nock(API).get(`/repos/acme/web-app/commits/${HEAD_SHA}/check-runs`).query(true).reply(200, { check_runs: [] })
        nock(API).get(`/repos/acme/web-app/commits/${HEAD_SHA}/statuses`).query(true).reply(200, [
            { id: 7001, context: 'Vercel – web-app', state: 'success', target_url: null },
        ])
        nock(API).get('/repos/acme/web-app/deployments').query(true).reply(200, [])

        const snapshots = await source().fetchSnapshots({ owner: 'acme', repo: 'web-app', repositoryId: 'repo-1' })
        expect(snapshots).toHaveLength(1)
        expect(snapshots[0]!.signals).toHaveLength(1)
        expect(snapshots[0]!.signals[0]!.kind).toBe('status')
    })

    it('未完成的 check run → 信号 pending → 聚合 pending（非失败不 firing）', async () => {
        mockSources({
            checkRuns: [
                { id: 9003, name: 'Test', status: 'in_progress', conclusion: null, app: { slug: 'github-actions' } },
            ],
        })
        const snapshots = await source().fetchSnapshots({ owner: 'acme', repo: 'web-app', repositoryId: 'repo-1' })
        expect(snapshots).toHaveLength(1)
        expect(snapshots[0]!.overallStatus).toBe('pending')
        expect(snapshots[0]!.conclusion).toBe('pending')
        expect(isFailureConclusion(snapshots[0]!.conclusion)).toBe(false)
    })
})
