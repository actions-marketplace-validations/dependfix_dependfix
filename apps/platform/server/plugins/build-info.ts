import { defineNitroPlugin } from 'nitropack/runtime'
import { formatBuildInfoLine, resolveBuildInfo, resolveStartedAt } from '#server/utils/build-info'
import { logger } from '#server/utils/logger'
import { shouldSkipHttpOnlyPlugin } from '#server/utils/process-role'

/**
 * 启动期打印部署产物版本戳（stdout）：`docker logs` 可直接核对运行态 version / commit，
 * 无需请求健康端点。口径见 docs/standards/platform.md §10.7。
 *
 * 版本戳是「部署产物」级信号（同一镜像的两个进程必为同一 version / commit），容器级一条即可：
 * 队列 worker 进程跳过本插件，避免每次自动重启多打印一行（角色判定见 docs/standards/platform.md §10.6）。
 */
export default defineNitroPlugin(() => {
    if (shouldSkipHttpOnlyPlugin('build-info', process.env, logger)) {
        return
    }
    const config = useRuntimeConfig()
    logger.info(formatBuildInfoLine(resolveBuildInfo(config), resolveStartedAt()))
})
