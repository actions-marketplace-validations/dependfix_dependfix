import { describe, expect, it } from 'vitest'
import {
    checkRoundKey,
    dedupeByLatestRound,
    extractActionsRunId,
    resolveCheckProvider,
    resolveStatusProvider,
} from './check-signals'

const signal = (name: string, overrides: { roundAt?: string | null, id?: string | number | null } = {}) =>
    ({ name, ...overrides })

const byName = (item: { name: string }) => item.name

describe('resolveCheckProvider / resolveStatusProvider（跨端同源）', () => {
    it('check provider 取 app.slug（小写化）；缺失回退 unknown', () => {
        expect(resolveCheckProvider('GitHub-Actions')).toBe('github-actions')
        expect(resolveCheckProvider(null)).toBe('unknown')
        expect(resolveCheckProvider('  ')).toBe('unknown')
    })

    it('status provider 取 context 前缀（支持 / – : 空格分隔，不含 -）', () => {
        expect(resolveStatusProvider('Vercel – web-app')).toBe('vercel')
        expect(resolveStatusProvider('ci/circleci: build')).toBe('ci')
        expect(resolveStatusProvider('continuous-integration/travis-ci/push')).toBe('continuous-integration')
        expect(resolveStatusProvider('')).toBe('unknown')
    })
})

describe('checkRoundKey', () => {
    it('check 以 workflow run id 为血缘边界（取不到时用 sourceId，各自成组）', () => {
        const base = { kind: 'check' as const, provider: 'github-actions', name: 'Test' }
        const url = (id: number) => `https://github.com/acme/app/actions/runs/${id}/job/1`
        expect(checkRoundKey({ ...base, url: url(100) })).toBe(checkRoundKey({ ...base, url: url(100) }))
        expect(checkRoundKey({ ...base, url: url(100) })).not.toBe(checkRoundKey({ ...base, url: url(200) }))
        // 无 run id：sourceId 兜底 → 不同 id 不合并
        expect(checkRoundKey({ ...base, sourceId: '1' })).not.toBe(checkRoundKey({ ...base, sourceId: '2' }))
    })

    it('kind 参与组键：同名 status 与 deployment 不合并', () => {
        const shared = { provider: 'vercel', name: 'Production' }
        expect(checkRoundKey({ ...shared, kind: 'status' })).not.toBe(checkRoundKey({ ...shared, kind: 'deployment' }))
    })

    it('status / deployment 只按 (kind, provider, name) 分组', () => {
        const status = { kind: 'status' as const, provider: 'vercel', name: 'Vercel – web' }
        expect(checkRoundKey({ ...status, sourceId: '1' })).toBe(checkRoundKey({ ...status, sourceId: '2' }))
        const deployment = { kind: 'deployment' as const, provider: 'vercel', name: 'Production' }
        expect(checkRoundKey(deployment)).toBe(checkRoundKey({ ...deployment, sourceId: '9' }))
    })
})

describe('extractActionsRunId', () => {
    it('从 Actions 详情链接提取 run id；非 Actions / 缺失回退 null', () => {
        expect(extractActionsRunId('https://github.com/acme/app/actions/runs/12345/job/67890')).toBe('12345')
        expect(extractActionsRunId('https://dash.cloudflare.com/build/9002')).toBeNull()
        expect(extractActionsRunId(null)).toBeNull()
    })
})

describe('dedupeByLatestRound', () => {
    it('保留最新一轮（roundAt 更大者）', () => {
        const result = dedupeByLatestRound([
            signal('Test', { roundAt: '2026-10-30T00:01:00Z', id: '1' }),
            signal('Test', { roundAt: '2026-10-30T00:09:00Z', id: '2' }),
        ], byName)
        expect(result).toHaveLength(1)
        expect(result[0]!.roundAt).toBe('2026-10-30T00:09:00Z')
    })

    it('任一侧 roundAt 不可比时回退数值 id（新一轮 queued 无 started_at 仍能胜出）', () => {
        expect(dedupeByLatestRound([
            signal('Test', { roundAt: null, id: '100' }),
            signal('Test', { roundAt: undefined, id: '300' }),
        ], byName)[0]!.id).toBe('300')

        // 旧一轮有 roundAt、新一轮 queued 无 roundAt（id 更大）→ 取新一轮
        expect(dedupeByLatestRound([
            signal('Test', { roundAt: '2026-10-30T00:09:00Z', id: '100' }),
            signal('Test', { roundAt: null, id: '200' }),
        ], byName)[0]!.id).toBe('200')

        expect(dedupeByLatestRound([
            signal('Test', { id: null }),
            signal('Test', { id: null }),
        ], byName)[0]!.id).toBeNull()
    })

    it('拿不到血缘标识（url 与 sourceId 双缺）时按索引兜底，不合并', () => {
        const items = [signal('Test'), signal('Test')]
        const deduped = dedupeByLatestRound(items, (item, index) => checkRoundKey(
            { kind: 'check', provider: 'github-actions', name: item.name },
            String(index),
        ))
        expect(deduped).toHaveLength(2)
    })

    it('不同键各自保留，返回顺序按首次出现', () => {
        const result = dedupeByLatestRound([
            signal('A', { roundAt: '2026-10-30T00:01:00Z' }),
            signal('B', { roundAt: '2026-10-30T00:02:00Z' }),
            signal('A', { roundAt: '2026-10-30T00:03:00Z' }),
        ], byName)
        expect(result.map((item) => item.name)).toEqual(['A', 'B'])
        expect(result[0]!.roundAt).toBe('2026-10-30T00:03:00Z')
    })
})
