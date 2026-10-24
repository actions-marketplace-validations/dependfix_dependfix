import { defineNitroPlugin } from 'nitropack/runtime'
import {
    isWeeklyDigestDue,
    parseWeeklyDigestHour,
    resolveWeeklyDigestSlot,
    WEEKLY_DIGEST_HOUR_ENV,
} from '#server/services/notification/weekly-digest-schedule'
import { sendWeeklyDigest } from '#server/services/notification/weekly-digest.service'
import { shouldSkipHttpOnlyPlugin } from '#server/utils/process-role'

/**
 * 周汇总周期插件（设计稿 §6.5）：
 * - 启动延迟 30 秒（等 DB 就绪）后每 15 分钟检查一次「是否处于本周触发窗口」；
 * - 窗口 = 服务器本地周一 `DEPENDFIX_WEEKLY_DIGEST_HOUR` 时（默认 9）起 24 小时，
 *   进程在窗口内重启仍会补发；窗口外等待下一周；
 * - 本进程同周只尝试一次（`lastAttemptedWeekKey`），真正的「每周一封」由逐用户投递键兜底
 *   （投递键冲突 → `skipped_duplicate`，允许多进程 / 重启场景）；
 * - 按角色只在一个进程运行：与 `stale-cleanup` 同属 HTTP-only（容器双进程形态下 HTTP 主进程
 *   恒存在），避免 HTTP / worker 双发。判定见 docs/standards/platform.md §10.6。
 *
 * 失败不抛出：服务内部 best-effort 落 notification_log；意外异常仅日志，并在下一轮重试。
 */
export const WEEKLY_DIGEST_FIRST_RUN_DELAY_MS = 30 * 1000
export const WEEKLY_DIGEST_CHECK_INTERVAL_MS = 15 * 60 * 1000

export default defineNitroPlugin((nitroApp) => {
    if (shouldSkipHttpOnlyPlugin('weekly-digest')) {
        return
    }

    const parsedHour = parseWeeklyDigestHour(process.env[WEEKLY_DIGEST_HOUR_ENV])
    if (parsedHour.invalid) {
        console.warn(
            `[weekly-digest] invalid ${WEEKLY_DIGEST_HOUR_ENV}=${JSON.stringify(process.env[WEEKLY_DIGEST_HOUR_ENV])}（仅支持 0-23 整数）——回退 ${parsedHour.hour} 时`,
        )
    }
    const hour = parsedHour.hour
    let lastAttemptedWeekKey: string | null = null

    const tick = async (): Promise<void> => {
        const now = new Date()
        if (!isWeeklyDigestDue(now, hour)) {
            return
        }
        const { weekKey } = resolveWeeklyDigestSlot(now, hour)
        if (weekKey === lastAttemptedWeekKey) {
            return
        }
        lastAttemptedWeekKey = weekKey
        try {
            const result = await sendWeeklyDigest(now)
            // 组织 / 部署开关关闭不产生任何副作用：清掉本次标记，让窗口内开启后下一轮仍能发送
            if (result.status === 'skipped_org_disabled' || result.status === 'skipped_disabled') {
                lastAttemptedWeekKey = null
            }
        } catch (error) {
            // 允许下一轮重试（DB / 渠道临时故障）；成功路径不重置，避免同周重复尝试。
            lastAttemptedWeekKey = null
            console.error('[weekly-digest] 周报发送失败:', error)
        }
    }

    let timer: ReturnType<typeof setInterval> | null = null
    const initialHandle = setTimeout(() => {
        void tick()
        timer = setInterval(() => {
            void tick()
        }, WEEKLY_DIGEST_CHECK_INTERVAL_MS)
    }, WEEKLY_DIGEST_FIRST_RUN_DELAY_MS)

    nitroApp.hooks.hook('close', () => {
        clearTimeout(initialHandle)
        if (timer) {
            clearInterval(timer)
            timer = null
        }
    })
})
