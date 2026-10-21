import { defineNitroPlugin } from 'nitropack/runtime'
import {
    formatStartupResourceLine,
    formatStartupResourceWarning,
    resolveStartupResource,
} from '#server/utils/resource-budget'

/**
 * 启动期资源探测（只读、不阻断）：打印 cgroup / 宿主内存上限与队列并发。
 *
 * 两个进程都执行（HTTP + worker）：worker 是实际执行安装 / 验证的进程，
 * 低于执行面建议值时必须在 worker 日志中可见。不登记为 HTTP-only 插件
 * （分类见 `process-role.ts` 的 NON_HTTP_ONLY_PLUGINS）。
 */
export default defineNitroPlugin(() => {
    const info = resolveStartupResource()
    console.info(formatStartupResourceLine(info))
    const warning = formatStartupResourceWarning(info)
    if (warning) {
        console.warn(warning)
    }
})
