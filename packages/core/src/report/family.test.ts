// family.test.ts — 家族锁步摘要（报告与 PR 正文共用的单一事实源）。
import { describe, expect, it } from 'vitest'
import { collectFamilySummaries } from './family'
import type { FixAction } from './types'

function action(overrides: Partial<FixAction>): FixAction {
    return {
        type: 'dependency-upgrade',
        repository: 'owner/repo',
        target: 'vitest',
        success: true,
        ...overrides,
    }
}

describe('collectFamilySummaries', () => {
    it('returns an empty list for empty input and for actions without family information', () => {
        expect(collectFamilySummaries([])).toEqual([])
        expect(collectFamilySummaries([action({ target: 'lodash' })])).toEqual([])
    })

    it('collects a family record per repository and family id, sorted by repository', () => {
        const summaries = collectFamilySummaries([
            action({
                family: { id: 'vitest', members: ['vitest', '@vitest/coverage-v8'], skipped: ['@vitest/ui'] },
            }),
            action({
                repository: 'owner/other',
                family: { id: 'vitest', members: ['vitest'], skipped: [] },
            }),
        ])

        expect(summaries).toEqual([
            {
                repository: 'owner/other',
                family: 'vitest',
                members: ['vitest'],
                skipped: [],
            },
            {
                repository: 'owner/repo',
                family: 'vitest',
                members: ['vitest', '@vitest/coverage-v8'],
                skipped: ['@vitest/ui'],
            },
        ])
    })

    it('merges repeated actions of the same family (union, no duplicates)', () => {
        const summaries = collectFamilySummaries([
            action({ family: { id: 'vitest', members: ['vitest', '@vitest/ui'], skipped: ['@vitest/browser'] } }),
            action({
                target: '@vitest/ui',
                family: { id: 'vitest', members: ['@vitest/ui', '@vitest/coverage-v8'], skipped: ['@vitest/browser'] },
            }),
        ])

        expect(summaries).toHaveLength(1)
        expect(summaries[0]?.members).toEqual(['vitest', '@vitest/ui', '@vitest/coverage-v8'])
        expect(summaries[0]?.skipped).toEqual(['@vitest/browser'])
    })

    it('keeps members and skipped disjoint across manifests of the same repository', () => {
        // 根 manifest 写盘 @vitest/ui；成员 manifest 因未声明而跳过 @vitest/ui（反之亦然）
        const summaries = collectFamilySummaries([
            action({ family: { id: 'vitest', members: ['vitest', '@vitest/ui'], skipped: ['@vitest/coverage-v8'] } }),
            action({
                target: 'vitest',
                filePath: 'packages/web/package.json',
                family: { id: 'vitest', members: ['vitest', '@vitest/coverage-v8'], skipped: ['@vitest/ui'] },
            }),
        ])

        expect(summaries).toHaveLength(1)
        expect(summaries[0]?.members).toEqual(['vitest', '@vitest/ui', '@vitest/coverage-v8'])
        expect(summaries[0]?.skipped).toEqual([])
    })

    it('ignores failed and noOp actions (rolled back families are not rendered as applied)', () => {
        const summaries = collectFamilySummaries([
            action({ success: false, family: { id: 'vitest', members: ['@vitest/coverage-v8'], skipped: [] } }),
            action({ noOp: true, family: { id: 'vitest', members: ['@vitest/browser'], skipped: [] } }),
            action({ family: { id: 'vitest', members: ['vitest', '@vitest/ui'], skipped: [] } }),
        ])

        expect(summaries).toHaveLength(1)
        expect(summaries[0]?.members).toEqual(['vitest', '@vitest/ui'])
    })
})
