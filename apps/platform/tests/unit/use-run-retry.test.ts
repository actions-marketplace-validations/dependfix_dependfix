import { describe, expect, it, vi } from 'vitest'
import { useRunRetry, type RetryRunResponse } from '../../app/composables/use-run-retry'

/**
 * use-run-retry 单测：覆盖「命中去重合并 / 正常触发（含来源回调）/ 触发失败」三条分支的消息与回调行为。
 *
 * 依赖通过 `useRunRetry(deps)` 注入（不加载 Nuxt 运行时）；i18n 用直通桩（返回 key + 参数）便于断言分支。
 * 口径见 docs/design/governance/run-failure-taxonomy.md §5.5。
 */

const RUN_ID = '12345678-aaaa-bbbb-cccc-dddddddddddd'

/** i18n 桩：返回 key（含参数）便于断言走了哪条分支 */
const tStub = (key: string, params?: Record<string, string | number>) =>
    params ? `${key}|${JSON.stringify(params)}` : key

const setup = (response: RetryRunResponse | Error) => {
    const request = vi.fn(async () => {
        if (response instanceof Error) {
            throw response
        }
        return response
    })
    const onRetried = vi.fn()
    const retry = useRunRetry({ t: tStub, request, onRetried })
    return { retry, request, onRetried }
}

describe('useRunRetry.retryRun', () => {
    it('命中合并（响应含 merged）→ 走合并提示且不弹成功、不回调', async () => {
        const { retry, request, onRetried } = setup({
            id: 'new-run-1',
            merged: { code: 'SCAN_PENDING_MERGED', message: '该仓库已有进行中的扫描任务，本次触发已合并' },
        })

        await retry.retryRun(RUN_ID)

        // 只传 runId：参数与来源由服务端按来源运行派生
        expect(request).toHaveBeenCalledWith(RUN_ID)
        expect(retry.retryMerged.value).toBe('common.scanTriggerMerged')
        expect(retry.retrySuccess.value).toBe('')
        expect(retry.retryError.value).toBe('')
        expect(onRetried).not.toHaveBeenCalled()
        expect(retry.retryingRunId.value).toBeNull()
    })

    it('正常触发 → 弹成功（含新 run id 前缀）并回调刷新', async () => {
        const { retry, onRetried } = setup({ id: 'new-run-2', retriedFromRunId: RUN_ID })

        await retry.retryRun(RUN_ID)

        expect(retry.retryMerged.value).toBe('')
        expect(retry.retrySuccess.value).toBe(`runs.retry.success|${JSON.stringify({ runId: 'new-run-' })}`)
        expect(onRetried).toHaveBeenCalledWith({ id: 'new-run-2', retriedFromRunId: RUN_ID })
        expect(retry.retryingRunId.value).toBeNull()
    })

    it('触发失败 → 弹错误且不弹合并/成功、不回调', async () => {
        const { retry, onRetried } = setup(
            Object.assign(new Error('boom'), { data: { message: '该运行不属于可重试的暂时性失败' } }),
        )

        await retry.retryRun(RUN_ID)

        expect(retry.retryError.value).toBe(
            `runs.retry.failed|${JSON.stringify({ message: '该运行不属于可重试的暂时性失败' })}`,
        )
        expect(retry.retryMerged.value).toBe('')
        expect(retry.retrySuccess.value).toBe('')
        expect(onRetried).not.toHaveBeenCalled()
        expect(retry.retryingRunId.value).toBeNull()
    })

    it('resetMessages 清空三态（重复触发前复位）', async () => {
        const { retry } = setup(new Error('boom'))
        await retry.retryRun(RUN_ID)
        expect(retry.retryError.value).not.toBe('')

        retry.resetMessages()
        expect(retry.retryError.value).toBe('')
        expect(retry.retryMerged.value).toBe('')
        expect(retry.retrySuccess.value).toBe('')
    })
})
