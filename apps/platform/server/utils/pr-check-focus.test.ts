import { describe, expect, it } from 'vitest'
import {
    filterSignalsByFocus,
    matchesPRCheckFocus,
    normalizePRCheckFocus,
    parsePRCheckFocus,
    type PRCheckFocus,
} from './pr-check-focus'

const makeFocus = (overrides: Partial<PRCheckFocus> = {}): PRCheckFocus => ({
    providers: [],
    names: [],
    kinds: [],
    ...overrides,
})

const makeSignal = (overrides: Partial<{ kind: 'check' | 'status' | 'deployment', provider: string, name: string }> = {}) => ({
    kind: 'check' as const,
    provider: 'github-actions',
    name: 'Test',
    ...overrides,
})

describe('normalizePRCheckFocus', () => {
    it('非对象输入（null / 数组 / 字符串 / 数字）→ null', () => {
        for (const input of [null, undefined, [], 'focus', 42, true]) {
            expect(normalizePRCheckFocus(input)).toBeNull()
        }
    })

    it('三维全空 / 全为空白 → null（等价于未配置）', () => {
        expect(normalizePRCheckFocus({ providers: [], names: [], kinds: [] })).toBeNull()
        expect(normalizePRCheckFocus({ providers: ['  '], names: [''], kinds: [] })).toBeNull()
    })

    it('trim + provider / kind 转小写 + name 保留原始写法', () => {
        expect(normalizePRCheckFocus({
            providers: [' GitHub-Actions ', 'vercel'],
            names: [' Test ', 'Preview'],
            kinds: [' Check ', 'DEPLOYMENT'],
        })).toEqual({
            providers: ['github-actions', 'vercel'],
            names: ['Test', 'Preview'],
            kinds: ['check', 'deployment'],
        })
    })

    it('大小写不敏感去重且保留首次出现写法', () => {
        expect(normalizePRCheckFocus({
            providers: ['Vercel', 'vercel', 'VERCEL'],
            names: ['Test', 'test', 'Test'],
            kinds: ['check', 'check'],
        })).toEqual({
            providers: ['vercel'],
            names: ['Test'],
            kinds: ['check'],
        })
    })

    it('丢弃非法 kind / 非字符串项 / 空串，保留其它合法维度', () => {
        expect(normalizePRCheckFocus({
            providers: ['vercel', 42, ''],
            names: [null, 'Preview'],
            kinds: ['check', 'bogus'],
        })).toEqual({
            providers: ['vercel'],
            names: ['Preview'],
            kinds: ['check'],
        })
    })

    it('缺失维度按空数组处理', () => {
        expect(normalizePRCheckFocus({ providers: ['vercel'] })).toEqual(makeFocus({ providers: ['vercel'] }))
    })
})

describe('parsePRCheckFocus', () => {
    it('合理 JSON → 规范化对象', () => {
        expect(parsePRCheckFocus('{"providers":[" Vercel "],"names":["Preview"],"kinds":[]}')).toEqual(
            makeFocus({ providers: ['vercel'], names: ['Preview'] }),
        )
    })

    it('缺失 / 空串 / 非法 JSON / 非对象 JSON → null（容错不抛错）', () => {
        for (const raw of [null, undefined, '', '   ', '{not-json', '[]', '"focus"', '42']) {
            expect(parsePRCheckFocus(raw)).toBeNull()
        }
    })

    it('合法 JSON 但三维全空 → null', () => {
        expect(parsePRCheckFocus('{"providers":[],"names":[],"kinds":[]}')).toBeNull()
    })

    it('空对象 / 字段类型异常 / 未知键 → null 或按已知三维解析（容错不抛错）', () => {
        expect(parsePRCheckFocus('{}')).toBeNull()
        expect(parsePRCheckFocus('{"providers":"vercel"}')).toBeNull()
        expect(parsePRCheckFocus('{"kinds":"check"}')).toBeNull()
        // 未知键（如 state）不参与解析，但同一对象里的已知维度照常生效
        expect(parsePRCheckFocus('{"names":["Test"],"state":["failure"]}')).toEqual(
            makeFocus({ names: ['Test'] }),
        )
    })
})

describe('matchesPRCheckFocus', () => {
    it('仅 provider：大小写不敏感精确匹配', () => {
        const focus = makeFocus({ providers: ['vercel'] })
        expect(matchesPRCheckFocus(makeSignal({ provider: 'vercel' }), focus)).toBe(true)
        expect(matchesPRCheckFocus(makeSignal({ provider: 'VERCEL' }), focus)).toBe(true)
        expect(matchesPRCheckFocus(makeSignal({ provider: 'github-actions' }), focus)).toBe(false)
    })

    it('仅 name：大小写不敏感精确匹配（不做子串 / 通配）', () => {
        const focus = makeFocus({ names: ['Test'] })
        expect(matchesPRCheckFocus(makeSignal({ name: 'test' }), focus)).toBe(true)
        expect(matchesPRCheckFocus(makeSignal({ name: 'Test (shard 1)' }), focus)).toBe(false)
        expect(matchesPRCheckFocus(makeSignal({ name: 'Lint' }), focus)).toBe(false)
    })

    it('仅 kind：按来源类型匹配', () => {
        const focus = makeFocus({ kinds: ['deployment'] })
        expect(matchesPRCheckFocus(makeSignal({ kind: 'deployment' }), focus)).toBe(true)
        expect(matchesPRCheckFocus(makeSignal({ kind: 'check' }), focus)).toBe(false)
    })

    it('维度间为 AND：任一非空维度不命中即整体不命中', () => {
        const focus = makeFocus({ providers: ['github-actions'], names: ['Test'], kinds: ['check'] })
        expect(matchesPRCheckFocus(makeSignal(), focus)).toBe(true)
        expect(matchesPRCheckFocus(makeSignal({ provider: 'vercel' }), focus)).toBe(false)
        expect(matchesPRCheckFocus(makeSignal({ name: 'Lint' }), focus)).toBe(false)
        expect(matchesPRCheckFocus(makeSignal({ kind: 'status' }), focus)).toBe(false)
    })

    it('维度内为 OR：同一维度多个取值任一命中即通过', () => {
        const focus = makeFocus({ providers: ['github-actions', 'vercel'], names: ['Test', 'Preview'] })
        expect(matchesPRCheckFocus(makeSignal({ provider: 'vercel', name: 'Preview' }), focus)).toBe(true)
        expect(matchesPRCheckFocus(makeSignal({ provider: 'github-actions', name: 'Test' }), focus)).toBe(true)
        expect(matchesPRCheckFocus(makeSignal({ provider: 'vercel', name: 'Test' }), focus)).toBe(true)
    })

    it('空维度不限制（wildcard）', () => {
        const focus = makeFocus({ names: ['Preview'] })
        expect(matchesPRCheckFocus(makeSignal({ kind: 'deployment', provider: 'vercel', name: 'Preview' }), focus))
            .toBe(true)
    })

    it('脏信号（null / 缺字段 / 类型异常）按非命中处理，不抛错', () => {
        const focus = makeFocus({ names: ['Test'] })
        expect(matchesPRCheckFocus(null, focus)).toBe(false)
        expect(matchesPRCheckFocus(undefined, focus)).toBe(false)
        expect(matchesPRCheckFocus({}, focus)).toBe(false)
        expect(matchesPRCheckFocus({ name: 42 } as never, focus)).toBe(false)

        const providerFocus = makeFocus({ providers: ['vercel'] })
        expect(matchesPRCheckFocus({ provider: null as never, name: 'Preview' }, providerFocus)).toBe(false)

        const kindFocus = makeFocus({ kinds: ['check'] })
        expect(matchesPRCheckFocus({ kind: null as never, provider: 'github-actions', name: 'Test' }, kindFocus))
            .toBe(false)
    })
})

describe('filterSignalsByFocus', () => {
    const signals = [
        makeSignal({ kind: 'check', provider: 'github-actions', name: 'Test' }),
        makeSignal({ kind: 'check', provider: 'github-actions', name: 'Lint' }),
        makeSignal({ kind: 'deployment', provider: 'vercel', name: 'Preview' }),
    ]

    it('未配置 → 返回原信号副本（顺序不变且不是同一数组引用）', () => {
        const filtered = filterSignalsByFocus(signals, null)
        expect(filtered).toEqual(signals)
        expect(filtered).not.toBe(signals)
    })

    it('已配置 → 只保留命中信号', () => {
        expect(filterSignalsByFocus(signals, makeFocus({ names: ['Test'] }))).toEqual([signals[0]])
        expect(filterSignalsByFocus(signals, makeFocus({ kinds: ['deployment'] }))).toEqual([signals[2]])
        expect(filterSignalsByFocus(signals, makeFocus({ providers: ['vercel'] }))).toEqual([signals[2]])
    })

    it('无任何命中 → 空数组（调用方按空集聚合口径处理）', () => {
        expect(filterSignalsByFocus(signals, makeFocus({ names: ['DoesNotExist'] }))).toEqual([])
    })
})
