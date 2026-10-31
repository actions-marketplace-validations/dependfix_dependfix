import { describe, expect, it } from 'vitest'
import { SANDBOX_EXECUTOR_DISABLED_MESSAGE } from './repository'
import { scanRequestSchema } from './scan'

/**
 * 扫描请求 schema 定向测试。
 *
 * 2026-10-27 起 sandbox 执行入口临时关闭：扫描请求显式指定 sandbox 必须在 schema 层拒绝，
 * 不能依赖编排层兜底（否则 API 会接受一个必然降级的请求，语义不清）。
 */
describe('scan request schema', () => {
    it('sandbox 执行器已临时关闭 → fail', () => {
        const bad = scanRequestSchema.safeParse({ executorKind: 'sandbox' })
        expect(bad.success).toBe(false)
        if (!bad.success) {
            const issue = bad.error.issues.find((item) => item.path[0] === 'executorKind')
            expect(issue?.message).toBe(SANDBOX_EXECUTOR_DISABLED_MESSAGE)
        }
    })

    it('container / github-action / 缺省仍通过', () => {
        expect(scanRequestSchema.safeParse({ executorKind: 'container' }).success).toBe(true)
        expect(scanRequestSchema.safeParse({ executorKind: 'github-action' }).success).toBe(true)
        expect(scanRequestSchema.safeParse({}).success).toBe(true)
    })
})
