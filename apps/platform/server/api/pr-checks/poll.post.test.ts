import 'reflect-metadata'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeEvent } from '../../../tests/api-helper'
import pollHandler from './poll.post'
import { requireOrgResource, requireRole } from '#server/utils/guard'
import { resolveOrganizationId } from '#server/utils/organization'
import { resolveRepositoryIds } from '#server/services/scheduler/selector'
import { runPrCheckPoll } from '#server/services/scheduler/scheduler.service'

vi.mock('#server/utils/guard', () => ({
    requireRole: vi.fn(async () => ({ user: { id: 'u1', email: 'admin@test.dev' } })),
    requireOrgResource: vi.fn(async () => undefined),
}))
vi.mock('#server/database', () => ({
    ensureDatabaseInitialized: vi.fn(async () => ({})),
}))
vi.mock('#server/utils/organization', () => ({
    resolveOrganizationId: vi.fn(async () => 'org-1'),
}))
vi.mock('#server/services/scheduler/selector', () => ({
    resolveRepositoryIds: vi.fn(async () => ['repo-1', 'repo-2']),
}))
vi.mock('#server/services/scheduler/scheduler.service', () => ({
    runPrCheckPoll: vi.fn(),
}))

const call = () => pollHandler(makeEvent('POST', '/api/pr-checks/poll'))

describe('POST /api/pr-checks/poll', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(resolveOrganizationId).mockResolvedValue('org-1')
        vi.mocked(resolveRepositoryIds).mockResolvedValue(['repo-1', 'repo-2'])
        vi.mocked(runPrCheckPoll).mockResolvedValue({ processed: 3, errors: 1 })
    })

    it('以 admin/org_admin 门控并校验组织归属', async () => {
        await call()
        expect(requireRole).toHaveBeenCalledWith(expect.anything(), ['admin', 'org_admin'])
        expect(requireOrgResource).toHaveBeenCalledWith(expect.anything(), 'org-1')
    })

    it('仅对当前组织仓库 polling（组织隔离）', async () => {
        await call()
        expect(resolveRepositoryIds).toHaveBeenCalledWith(expect.anything(), {
            kind: 'all',
            data: {},
            organizationId: 'org-1',
        })
        expect(runPrCheckPoll).toHaveBeenCalledWith(expect.anything(), ['repo-1', 'repo-2'], {
            organizationId: 'org-1',
            logLabel: 'manual trigger',
        })
    })

    it('总开关未启用 → 返回 skipped 提示（不报错）', async () => {
        vi.mocked(runPrCheckPoll).mockResolvedValue({ processed: 0, errors: 0, skipped: true })
        expect(await call()).toEqual({ skipped: true, processed: 0, errors: 0, candidateCount: 2, truncated: false })
    })

    it('启用 → 返回 processed / errors 统计（skipped 归一为 false）', async () => {
        expect(await call()).toEqual({ skipped: false, processed: 3, errors: 1, candidateCount: 2, truncated: false })
    })

    it('无仓库时仍调用共享函数（返回零统计，不报错）', async () => {
        vi.mocked(resolveRepositoryIds).mockResolvedValue([])
        vi.mocked(runPrCheckPoll).mockResolvedValue({ processed: 0, errors: 0 })

        expect(await call()).toEqual({ skipped: false, processed: 0, errors: 0, candidateCount: 0, truncated: false })
        expect(runPrCheckPoll).toHaveBeenCalledWith(expect.anything(), [], expect.objectContaining({ logLabel: 'manual trigger' }))
    })

    it('候选仓库数超单次上限 → 截断后 polling 并在响应披露', async () => {
        const sixty = Array.from({ length: 60 }, (_, i) => `repo-${i}`)
        vi.mocked(resolveRepositoryIds).mockResolvedValue(sixty)

        const result = await call()

        // 仅前 50 个进入 polling；候选总数与截断标记如实披露（前端据此提示本次仅检查了部分仓库）
        expect(vi.mocked(runPrCheckPoll).mock.calls[0]?.[1]).toHaveLength(50)
        expect(result).toMatchObject({ candidateCount: 60, truncated: true })
    })
})
