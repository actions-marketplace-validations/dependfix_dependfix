import { describe, expect, it } from 'vitest'
import { EMPTY_RUN_RESULT } from './report.test-helpers'
import { generateMarkdownReport } from './index'

describe('generateMarkdownReport — Delivery Skipped', () => {
    const base = {
        ...EMPTY_RUN_RESULT,
        deliverySkips: [{
            repositories: ['foo/bar'],
            failingCommands: ['pnpm install --frozen-lockfile'],
            carrier: {
                mode: 'issue' as const,
                issue: { number: 12, htmlUrl: 'https://github.com/foo/bar/issues/12', created: true, fingerprint: 'abcdef0123456789' },
            },
        }],
    }

    it('渲染仓库 / 失败命令 / 载体', () => {
        const md = generateMarkdownReport(base)
        expect(md).toContain('## Delivery Skipped')
        expect(md).toContain('`foo/bar`')
        expect(md).toContain('`pnpm install --frozen-lockfile`')
        expect(md).toContain('issue #12 (created)')
        expect(md).toContain('PRE_EXISTING_FAILURE')
    })

    it('draft 档区分「本 PR」与已建 PR；无记录时不渲染', () => {
        const draftMd = generateMarkdownReport({
            ...EMPTY_RUN_RESULT,
            deliverySkips: [{
                repositories: ['foo/bar'],
                failingCommands: [],
                carrier: { mode: 'draft' as const },
            }],
        })
        expect(draftMd).toContain('draft (no new PR)')
        const skipMd = generateMarkdownReport({
            ...EMPTY_RUN_RESULT,
            deliverySkips: [{
                repositories: ['foo/bar'],
                failingCommands: [],
                carrier: { mode: 'skip' as const },
            }],
        })
        expect(skipMd).toContain('report only (skip)')
        expect(generateMarkdownReport(EMPTY_RUN_RESULT)).not.toContain('## Delivery Skipped')
    })
})
