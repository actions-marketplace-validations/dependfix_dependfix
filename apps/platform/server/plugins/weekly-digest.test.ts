import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 周汇总插件单测：注册守卫（worker 跳过）+ 触发窗口 + 本进程同周只尝试一次 +
 * 失败允许下一轮重试 + 非法小时 env 回退。周报服务整体 mock，不触达 DB / 渠道。
 */
const { sendWeeklyDigestMock } = vi.hoisted(() => ({
    sendWeeklyDigestMock: vi.fn(),
}))

vi.mock('nitropack/runtime', () => ({
    defineNitroPlugin: (fn: unknown) => fn,
}))
vi.mock('#server/services/notification/weekly-digest.service', () => ({
    sendWeeklyDigest: sendWeeklyDigestMock,
}))

import weeklyDigestPlugin, {
    WEEKLY_DIGEST_CHECK_INTERVAL_MS,
    WEEKLY_DIGEST_FIRST_RUN_DELAY_MS,
} from './weekly-digest'

const makeNitroApp = () => ({ hooks: { hook: vi.fn() } })

const runPlugin = (): ReturnType<typeof makeNitroApp> => {
    const nitroApp = makeNitroApp()
    ;(weeklyDigestPlugin as unknown as (app: unknown) => void)(nitroApp)
    return nitroApp
}

const result = () => ({
    weekKey: '2026-W44',
    status: 'sent',
    recipients: 1,
    sent: 1,
    failed: 0,
    noop: 0,
    skipped: 0,
})

describe('weekly-digest 插件注册守卫', () => {
    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
        delete process.env.DEPENDFIX_ROLE
    })

    it('worker 角色：不注册定时器与 close 钩子，并输出跳过日志', () => {
        vi.useFakeTimers()
        process.env.DEPENDFIX_ROLE = 'worker'
        const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined)
        const nitroApp = runPlugin()

        expect(nitroApp.hooks.hook).not.toHaveBeenCalled()
        expect(vi.getTimerCount()).toBe(0)
        expect(infoSpy).toHaveBeenCalled()
    })

    it('未设置角色：照常注册，close 钩子清理定时器', () => {
        vi.useFakeTimers()
        const nitroApp = runPlugin()
        expect(nitroApp.hooks.hook).toHaveBeenCalledWith('close', expect.any(Function))
        expect(vi.getTimerCount()).toBeGreaterThan(0)
        const closeHandler = nitroApp.hooks.hook.mock.calls[0]![1] as () => void
        closeHandler()
        expect(vi.getTimerCount()).toBe(0)
    })
})

describe('weekly-digest 插件触发', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        sendWeeklyDigestMock.mockReset()
        sendWeeklyDigestMock.mockResolvedValue(result())
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
        delete process.env.DEPENDFIX_ROLE
        delete process.env.DEPENDFIX_WEEKLY_DIGEST_HOUR
    })

    it('周一触发时刻前不发送', async () => {
        vi.setSystemTime(new Date(2026, 9, 26, 8, 0))
        runPlugin()
        await vi.advanceTimersByTimeAsync(WEEKLY_DIGEST_FIRST_RUN_DELAY_MS + WEEKLY_DIGEST_CHECK_INTERVAL_MS)
        expect(sendWeeklyDigestMock).not.toHaveBeenCalled()
    })

    it('进入窗口后发送一次，同周后续节拍不重复尝试', async () => {
        vi.setSystemTime(new Date(2026, 9, 26, 9, 1))
        runPlugin()
        await vi.advanceTimersByTimeAsync(WEEKLY_DIGEST_FIRST_RUN_DELAY_MS)
        expect(sendWeeklyDigestMock).toHaveBeenCalledTimes(1)
        const passNow = sendWeeklyDigestMock.mock.calls[0]![0] as Date
        expect(passNow.getTime()).toBe(new Date(2026, 9, 26, 9, 1, 30).getTime())

        await vi.advanceTimersByTimeAsync(WEEKLY_DIGEST_CHECK_INTERVAL_MS * 4)
        expect(sendWeeklyDigestMock).toHaveBeenCalledTimes(1)
    })

    it('下一周同一窗口再次发送', async () => {
        vi.setSystemTime(new Date(2026, 9, 26, 9, 1))
        runPlugin()
        await vi.advanceTimersByTimeAsync(WEEKLY_DIGEST_FIRST_RUN_DELAY_MS)
        expect(sendWeeklyDigestMock).toHaveBeenCalledTimes(1)

        await vi.advanceTimersByTimeAsync(7 * 24 * 60 * 60 * 1000)
        expect(sendWeeklyDigestMock).toHaveBeenCalledTimes(2)
    })

    it('失败后允许下一轮重试（异常不静默停用）', async () => {
        vi.setSystemTime(new Date(2026, 9, 26, 9, 1))
        sendWeeklyDigestMock.mockRejectedValueOnce(new Error('db down'))
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        runPlugin()
        await vi.advanceTimersByTimeAsync(WEEKLY_DIGEST_FIRST_RUN_DELAY_MS)
        expect(sendWeeklyDigestMock).toHaveBeenCalledTimes(1)
        expect(errorSpy).toHaveBeenCalled()

        await vi.advanceTimersByTimeAsync(WEEKLY_DIGEST_CHECK_INTERVAL_MS)
        expect(sendWeeklyDigestMock).toHaveBeenCalledTimes(2)
    })

    it('组织开关关闭不锁定本周：窗口内开启后下一轮补发', async () => {
        vi.setSystemTime(new Date(2026, 9, 26, 9, 1))
        sendWeeklyDigestMock.mockResolvedValueOnce({ ...result(), status: 'skipped_org_disabled', sent: 0 })
        runPlugin()
        await vi.advanceTimersByTimeAsync(WEEKLY_DIGEST_FIRST_RUN_DELAY_MS)
        expect(sendWeeklyDigestMock).toHaveBeenCalledTimes(1)

        await vi.advanceTimersByTimeAsync(WEEKLY_DIGEST_CHECK_INTERVAL_MS)
        expect(sendWeeklyDigestMock).toHaveBeenCalledTimes(2)
    })

    it('非法小时 env → warn 并按默认 9 时触发', async () => {
        process.env.DEPENDFIX_WEEKLY_DIGEST_HOUR = '26'
        vi.setSystemTime(new Date(2026, 9, 26, 9, 1))
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        runPlugin()
        await vi.advanceTimersByTimeAsync(WEEKLY_DIGEST_FIRST_RUN_DELAY_MS)
        expect(warnSpy).toHaveBeenCalled()
        expect(sendWeeklyDigestMock).toHaveBeenCalledTimes(1)
    })
})
