import { describe, expect, it, vi } from 'vitest'
import { useFixNow, type FixNowScanResponse } from '../../app/composables/use-fix-now'

/**
 * use-fix-now 单测：覆盖「命中去重合并 / 正常触发 / 触发失败」三条分支的消息与跳转行为。
 *
 * 依赖通过 `useFixNow(deps)` 注入（不加载 Nuxt 运行时）；i18n 用直通桩（返回 key + 参数）以便断言分支。
 */

const run = {
    id: '12345678-aaaa-bbbb-cccc-dddddddddddd',
    repositoryId: 'repo-1',
    severityThreshold: 'high',
}

/** i18n 桩：返回 key（含参数）便于断言走了哪条分支 */
const tStub = (key: string, params?: Record<string, string | number>) =>
    params ? `${key}|${JSON.stringify(params)}` : key

const setup = (response: FixNowScanResponse | Error) => {
    const request = vi.fn(async () => {
        if (response instanceof Error) {
            throw response
        }
        return response
    })
    const navigate = vi.fn(() => Promise.resolve())
    const fix = useFixNow({ t: tStub, request, navigate })
    return { fix, request, navigate }
}

describe('useFixNow.triggerFix', () => {
    it('命中合并（响应含 merged）→ 走 warning 提示且不跳转、不弹成功', async () => {
        const { fix, request, navigate } = setup({
            id: run.id,
            merged: { code: 'SCAN_PENDING_MERGED', message: '该仓库已有进行中的扫描任务，本次触发已合并' },
        })

        await fix.triggerFix(run)

        // 请求体携带 mode=fix + reuseScanRunId（既有契约不变）
        expect(request).toHaveBeenCalledWith('repo-1', {
            mode: 'fix',
            severityThreshold: 'high',
            reuseScanRunId: run.id,
        })
        // 合并提示（共享 i18n 键）
        expect(fix.fixMerged.value).toBe('common.scanTriggerMerged')
        // 不弹成功、不报错、不跳转（本次触发未真正执行）
        expect(fix.fixSuccess.value).toBe('')
        expect(fix.fixError.value).toBe('')
        expect(navigate).not.toHaveBeenCalled()
        // loading 已释放
        expect(fix.fixingRunId.value).toBeNull()
    })

    it('无 merged → 弹成功（含 runId 前缀）并跳转扫描历史', async () => {
        const { fix, navigate } = setup({ id: run.id })

        await fix.triggerFix(run)

        expect(fix.fixMerged.value).toBe('')
        expect(fix.fixSuccess.value).toBe(`alerts.fixNow.success|${JSON.stringify({ runId: '12345678' })}`)
        expect(navigate).toHaveBeenCalledWith(`/scans?repository=repo-1&run=${run.id}`)
        expect(fix.fixingRunId.value).toBeNull()
    })

    it('触发失败 → 弹错误且不跳转、不弹合并/成功', async () => {
        const { fix, navigate } = setup(Object.assign(new Error('boom'), { data: { message: '该扫描正在执行中' } }))

        await fix.triggerFix(run)

        expect(fix.fixError.value).toContain('该扫描正在执行中')
        expect(fix.fixMerged.value).toBe('')
        expect(fix.fixSuccess.value).toBe('')
        expect(navigate).not.toHaveBeenCalled()
        expect(fix.fixingRunId.value).toBeNull()
    })

    it('resetMessages 同时清空三条消息', async () => {
        const { fix } = setup({ id: run.id, merged: { code: 'SCAN_PENDING_MERGED', message: 'x' } })
        await fix.triggerFix(run)
        expect(fix.fixMerged.value).not.toBe('')

        fix.resetMessages()
        expect(fix.fixMerged.value).toBe('')
        expect(fix.fixError.value).toBe('')
        expect(fix.fixSuccess.value).toBe('')
    })
})
