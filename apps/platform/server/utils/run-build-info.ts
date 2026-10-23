import { resolveBuildInfo, type BuildInfo } from './build-info'

/**
 * 本次 run 的构建版本回执（`ScanRun.buildVersion` / `buildCommit` 的写入来源）。
 *
 * 与 `/api/health`、平台启动 `[build]` 行同源（`runtimeConfig.buildVersion/buildCommit`，
 * 由镜像构建期 `--build-arg BUILD_VERSION/BUILD_COMMIT` 注入）；未注入时回退 `unknown`，
 * 与「存量行 null」区分开——新 run 的两列不会是 null。
 *
 * 取不到 `useRuntimeConfig`（非 Nitro 运行时：直接调用 service 的脚本 / 部分单测）时同样
 * 回退 `unknown`：构建版本回执是诊断信息，不得因为它拿不到而阻断 run 创建。
 */
export interface RunBuildStamp {
    buildVersion: string
    buildCommit: string
}

export const resolveRunBuildStamp = (): RunBuildStamp => {
    let info: BuildInfo
    try {
        info = resolveBuildInfo(useRuntimeConfig())
    } catch {
        info = resolveBuildInfo({})
    }
    return { buildVersion: info.version, buildCommit: info.commit }
}
