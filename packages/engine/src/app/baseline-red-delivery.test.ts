// baseline-red-delivery.test.ts — 基线红交付降级的纯单元用例（载体落点 / 失败降级 / 档位降级）。
//
// 端到端编排分支由 delivery-skip.test.ts 覆盖；这里用假 octokit 锁定三件易回归的事：
// 1. `issue` 落点取「首先命中的受影响仓库」（与失败同源，保证指纹去重跨运行稳定）
// 2. 载体创建失败只 warn，不改变「交付跳过」结论与记录
// 3. dry-run / 无落点仓库一律降级为 `skip`（必须回滚）
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Octokit } from '@octokit/rest'
import type { FixAction, FixError } from '@dependfix/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleBaselineRedDelivery } from './skipped-delivery'

const INSTALL = 'pnpm install --frozen-lockfile'

function verificationFailure(repository: string): FixAction {
    return {
        type: 'verification',
        repository,
        target: INSTALL,
        success: false,
        preExisting: true,
        durationMs: 0,
    }
}

describe('handleBaselineRedDelivery', () => {
    let workDir: string

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), 'dependfix-skip-unit-'))
    })

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true })
    })

    const makeArgs = (overrides: {
        mode?: 'skip' | 'issue' | 'draft'
        dryRun?: boolean
        repositories?: string[]
        installBlockedRepos?: string[]
        octokit?: Octokit | null
        failIssueApi?: boolean
    } = {}) => {
        const allErrors: FixError[] = []
        const deliverySkips: Parameters<typeof handleBaselineRedDelivery>[0]['ctx']['deliverySkips'] = []
        const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
        const listForRepo = vi.fn(async () => {
            if (overrides.failIssueApi) {
                throw new Error('403 Resource not accessible by integration')
            }
            return { data: [] }
        })
        const create = vi.fn(async () => {
            if (overrides.failIssueApi) {
                throw new Error('403 Resource not accessible by integration')
            }
            return { data: { number: 21, html_url: 'https://github.com/acme/app/issues/21' } }
        })
        const octokit = overrides.octokit === undefined
            ? ({ rest: { issues: { listForRepo, create } } } as unknown as Octokit)
            : overrides.octokit

        return {
            args: {
                ctx: {
                    logger,
                    runId: 'run-unit',
                    deliverySkips,
                    allActions: [verificationFailure('b/two'), verificationFailure('c/three')],
                    allErrors,
                },
                config: { onBaselineRed: overrides.mode ?? 'skip', dryRun: overrides.dryRun ?? false },
                client: octokit,
                repositories: overrides.repositories ?? ['a/one'],
                installBlockedRepos: overrides.installBlockedRepos ?? ['b/two', 'c/three'],
                workDir,
                preExistingDirty: false,
            },
            listForRepo,
            create,
            allErrors,
            deliverySkips,
            logger,
        }
    }

    it('issue 档落点取「首先命中的受影响仓库」（不是运行级第一个仓库）', async () => {
        const h = makeArgs({ mode: 'issue' })
        const outcome = await handleBaselineRedDelivery(h.args)

        expect(outcome.continueAsDraft).toBe(false)
        expect(h.listForRepo).toHaveBeenCalledWith(expect.objectContaining({ owner: 'b', repo: 'two', state: 'all' }))
        expect(h.create).toHaveBeenCalledWith(expect.objectContaining({ owner: 'b', repo: 'two' }))
        expect(h.deliverySkips?.[0]?.carrier.issue).toMatchObject({ number: 21, created: true })
        expect(h.allErrors.map((error) => error.category)).toEqual(['PRE_EXISTING_FAILURE'])
    })

    it('载体创建失败：只 warn，记录保留、审计条目与跳过结论不变', async () => {
        const h = makeArgs({ mode: 'issue', failIssueApi: true })
        const outcome = await handleBaselineRedDelivery(h.args)

        expect(outcome.continueAsDraft).toBe(false)
        expect(h.logger.warn).toHaveBeenCalledWith(expect.stringContaining('issue creation failed'))
        expect(h.deliverySkips?.[0]?.carrier).toEqual({ mode: 'issue' })
        expect(h.allErrors.map((error) => error.category)).toEqual(['PRE_EXISTING_FAILURE'])
    })

    it('draft 档 + dry-run → 降级为 skip（必须回滚，不登记草稿载体）', async () => {
        const h = makeArgs({ mode: 'draft', dryRun: true })
        const outcome = await handleBaselineRedDelivery(h.args)

        expect(outcome.continueAsDraft).toBe(false)
        expect(h.deliverySkips?.[0]?.carrier).toEqual({ mode: 'skip' })
        expect(h.logger.warn).toHaveBeenCalledWith(expect.stringContaining('skipping delivery'))
    })

    it('draft 档 + 无落点仓库 → 降级为 skip', async () => {
        const h = makeArgs({ mode: 'draft', repositories: [] })
        const outcome = await handleBaselineRedDelivery(h.args)

        expect(outcome.continueAsDraft).toBe(false)
        expect(h.deliverySkips?.[0]?.carrier).toEqual({ mode: 'skip' })
    })

    it('draft 档（非 dry-run）→ 继续交付并登记草稿载体', async () => {
        const h = makeArgs({ mode: 'draft' })
        const outcome = await handleBaselineRedDelivery(h.args)

        expect(outcome.continueAsDraft).toBe(true)
        expect(outcome.record?.carrier).toEqual({ mode: 'draft' })
        // 草稿档不回滚、也不写 PRE_EXISTING_FAILURE 交付条目（验证链自身已记录归因）
        expect(h.allErrors).toEqual([])
        expect(h.create).not.toHaveBeenCalled()
    })

    it('skip 档（默认）：不发任何 issue 请求', async () => {
        const h = makeArgs()
        const outcome = await handleBaselineRedDelivery(h.args)

        expect(outcome.continueAsDraft).toBe(false)
        expect(h.listForRepo).not.toHaveBeenCalled()
        expect(h.create).not.toHaveBeenCalled()
        expect(h.deliverySkips?.[0]).toEqual({
            repositories: ['b/two', 'c/three'],
            failingCommands: [INSTALL],
            carrier: { mode: 'skip' },
        })
    })
})
