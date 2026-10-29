import { describe, expect, it, vi } from 'vitest'

/** 只验证 fail-open 取舍：DB 不可用时按「未记录」处理（宁可多写一行也不静默丢状态）。 */
vi.mock('#server/database', () => ({
    ensureDatabaseInitialized: vi.fn(async () => {
        throw new Error('db down')
    }),
}))

const { hasNotificationLog } = await import('./delivery')

describe('hasNotificationLog', () => {
    it('查询失败 → 返回 false（fail-open，由调用方决定是否落库）', async () => {
        await expect(hasNotificationLog({
            category: 'weekly_digest',
            scopeType: 'digest',
            scopeId: '2026-W44',
            status: 'skipped_no_recipient',
        })).resolves.toBe(false)
    })
})
