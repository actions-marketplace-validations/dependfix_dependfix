import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

/**
 * 运行构建版本回执：回答「本次运行由哪个构建版本 / commit 执行」。
 *
 * 取值优先级（`resolveRunBuildInfo`）：
 * 1. `RuntimeConfig.buildVersion` / `buildCommit`——平台容器在构造 `RuntimeConfig` 时注入，
 *    与平台 `/api/health`、启动 `[build]` 行同源（`runtimeConfig.buildVersion/buildCommit`）；
 * 2. 引擎自身 `package.json` 的 `version`——CLI / MCP 本地执行场景（来源标记 `engine-package`）；
 * 3. `unknown`——读不到版本时降级，不阻断运行。
 *
 * `source` 字段用于消除歧义：宿主注入的是「部署产物版本」（平台 / 镜像），本地回退的是
 * 「引擎包版本」（npm 上与 CLI 产品版本可能不同号），两者不可混读。
 *
 * 只用于日志与平台落库回执，不参与任何交付判定（exit code / 验证门禁均不读取）。
 */

/** 未注入 / 不可读时的缺省标记（与平台 `server/utils/build-info.ts` 同值，便于跨端对账） */
export const UNKNOWN_BUILD_VALUE = 'unknown'

/** 版本值来源：宿主构建注入 / 引擎包回退 */
export type BuildInfoSource = 'host' | 'engine-package'

export interface RunBuildInfo {
    version: string
    commit: string
    /** 值来源，见 {@link BuildInfoSource} */
    source: BuildInfoSource
}

/** 版本读取的注入点（仅测试用于复现解析失败 / 非法内容，生产使用默认实现） */
export interface PackageVersionDeps {
    resolvePath?: () => string
    readFile?: (path: string) => string
}

/** 归一化：非字符串 / 空串 / 仅空白 → undefined（由调用方决定回退值） */
const normalize = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
        return undefined
    }
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
}

/**
 * 从引擎包 `package.json` 读取版本（CLI / MCP 场景的回退来源）。
 *
 * 以 `createRequire(import.meta.url)` 做包自引用（`package.json#exports` 已暴露 `./package.json`）：
 * 源码运行（vitest）与 `dist/index.mjs` 发布形态走同一解析路径，不依赖工作目录 / cwd。
 * 解析失败（例如被外部打包器内联进其它包的单一产物）或内容非法时回退 `unknown`，
 * 由消费方按未知降级。
 */
export const resolvePackageVersion = (deps: PackageVersionDeps = {}): string => {
    try {
        const pkgPath = deps.resolvePath
            ? deps.resolvePath()
            : createRequire(import.meta.url).resolve('@dependfix/engine/package.json')
        const raw = deps.readFile ? deps.readFile(pkgPath) : readFileSync(pkgPath, 'utf-8')
        const pkg = JSON.parse(raw) as { version?: unknown }
        return normalize(pkg.version) ?? UNKNOWN_BUILD_VALUE
    } catch {
        return UNKNOWN_BUILD_VALUE
    }
}

/**
 * 解析本次运行的构建版本回执。
 *
 * @param config 运行时配置中的宿主注入值（`buildVersion` / `buildCommit`；可缺省）
 * @param deps 版本读取注入点（仅测试使用）
 */
export const resolveRunBuildInfo = (
    config: { buildVersion?: unknown, buildCommit?: unknown } = {},
    deps: PackageVersionDeps = {},
): RunBuildInfo => {
    const hostVersion = normalize(config.buildVersion)
    const hostCommit = normalize(config.buildCommit)
    if (hostVersion) {
        return { version: hostVersion, commit: hostCommit ?? UNKNOWN_BUILD_VALUE, source: 'host' }
    }
    return { version: resolvePackageVersion(deps), commit: hostCommit ?? UNKNOWN_BUILD_VALUE, source: 'engine-package' }
}

/**
 * 启动日志行文案（`docker logs` / 平台运行日志里可直接 grep `[build]`）。
 * commit 缺失时保留 `unknown`，不省略字段——省略会让「旧构建无此字段」与「本地无 commit」不可区分。
 */
export const formatEngineBuildLine = (info: RunBuildInfo): string =>
    `[build] dependfix version=${info.version} commit=${info.commit} source=${info.source}`
