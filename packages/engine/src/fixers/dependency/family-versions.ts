// family-versions.ts — 家族成员目标版本的 registry 解析（唯一的网络面）。
//
// 族成员的目标版本无法从告警推导（Dependabot 只给触发包的 first_patched_version），
// 因此按目标版本线查询 registry packument：
// - `lockstep: 'major'` → 该 major 下最高的稳定版本（如 vitest 升 4.x 时 coverage-v8 取 4.6.0）
// - `lockstep: 'version'` → 该精确版本必须存在（typescript-eslint 三件套同版本发布）
//
// 失败（registry 不可达 / 包不存在 / 线内无稳定版本）一律返回 error，由调用方
// 「整族放弃并回滚」——不做「猜一个版本写入」的降级。
//
// 出站面：只请求包元数据（`application/vnd.npm.install-v1+json`），不携带凭据；
// registry 基地址优先取环境变量，其次目标仓库 `.npmrc` 的 `registry=`，最后官方 registry。
// `.npmrc` 中的 userinfo 段在拼接前剥离，避免凭据被带到未预期的主机。

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { compare, prerelease, valid } from 'semver'
import type { FamilyLockstep } from './families'

const DEFAULT_REGISTRY_BASE_URL = 'https://registry.npmjs.org'
const DEFAULT_TIMEOUT_MS = 10_000
/** 单个 resolver 缓存上限（包数量级，超限整体清空，防长驻进程无界增长） */
const MAX_CACHE_ENTRIES = 128
/** 默认 resolver 数量上限（按 registry 基地址） */
const MAX_DEFAULT_RESOLVERS = 32

export interface FamilyVersionQuery {
    packageName: string
    /** 目标线：major = 目标版本所属大版本；version = 精确版本 */
    lockstep: FamilyLockstep
    value: string
}

export interface FamilyPackageVersionInfo {
    /** 解析到的精确版本 */
    version: string
    /** 该版本的 peerDependencies（无 peer 时为空对象；`undefined` 表示未解析） */
    peerDependencies: Record<string, string>
}

export type FamilyVersionResolution =
    | { ok: true, info: FamilyPackageVersionInfo }
    | { ok: false, error: string }

export interface FamilyVersionResolver {
    /** 解析族成员目标版本；失败返回 error（调用方整族放弃） */
    resolve(query: FamilyVersionQuery): Promise<FamilyVersionResolution>
    /** 解析精确版本的 peerDependencies（用于关联包兼容性校验） */
    describe(packageName: string, version: string): Promise<FamilyVersionResolution>
}

export interface FamilyVersionResolverOptions {
    /** registry 基地址（缺省官方 registry） */
    registryBaseUrl?: string
    /** 注入 fetch（测试用；缺省全局 fetch） */
    fetchFn?: typeof fetch
    /** 单次请求超时毫秒（缺省 10s） */
    timeoutMs?: number
}

interface PackumentVersion {
    peerDependencies?: Record<string, string>
}

interface Packument {
    versions?: Record<string, PackumentVersion>
}

/**
 * 从环境变量 / 目标仓库 `.npmrc` 解析 registry 基地址。
 *
 * 读取顺序：`npm_config_registry` / `NPM_CONFIG_REGISTRY` → `.npmrc` 的裸 `registry=` 行
 * （就近最后一条生效）→ 官方 registry。带作用域的 `@scope:registry` 不在本函数覆盖范围
 * （家族清单目前只含公开包；私有镜像场景应通过环境变量指定）。
 */
export function resolveRegistryBaseUrl(workDir: string, env: NodeJS.ProcessEnv = process.env): string {
    const fromEnv = env.npm_config_registry ?? env.NPM_CONFIG_REGISTRY
    if (fromEnv) {
        const normalized = normalizeRegistryUrl(fromEnv)
        if (normalized) {
            return normalized
        }
    }

    try {
        const lines = readFileSync(join(workDir, '.npmrc'), 'utf-8').split(/\r?\n/)
        const registryLine = lines
            .filter((line) => !line.trim().startsWith('#'))
            .reverse()
            .find((line) => /^\s*registry\s*=/.test(line))
        if (registryLine) {
            const raw = registryLine.slice(registryLine.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
            const normalized = normalizeRegistryUrl(raw)
            if (normalized) {
                return normalized
            }
        }
    } catch {
        // 无 .npmrc / 不可读 → 官方 registry
    }

    return DEFAULT_REGISTRY_BASE_URL
}

/** 校验并规范化 registry URL：仅接受 http(s)，剥离 userinfo 与尾部斜杠。 */
function normalizeRegistryUrl(raw: string): string | undefined {
    const withoutUserinfo = raw.trim().replace(/\/\/[^/@]*@/, '//')
    if (!/^https?:\/\//i.test(withoutUserinfo)) {
        return undefined
    }
    try {
        const url = new URL(withoutUserinfo)
        return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
    } catch {
        return undefined
    }
}

/**
 * 创建 registry 解析器（packument 按 `包名` 缓存，同一次运行内同包只请求一次）。
 */
export function createFamilyVersionResolver(options: FamilyVersionResolverOptions = {}): FamilyVersionResolver {
    // 工厂自身也做归一化：调用方传入原始配置（可能含 userinfo / 非 http 协议）时，
    // 凭据不得进入请求 URL 或错误消息（模块头的安全承诺不能只依赖调用方）
    const baseUrl = normalizeRegistryUrl(options.registryBaseUrl ?? DEFAULT_REGISTRY_BASE_URL) ?? DEFAULT_REGISTRY_BASE_URL
    const fetchFn = options.fetchFn ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const registryHost = describeRegistryHost(baseUrl)
    /** packument 缓存：同包只请求一次（成功缓存；失败驱逐，避免长驻进程把瞬时故障永久化） */
    const cache = new Map<string, Promise<Packument>>()

    async function fetchPackument(packageName: string): Promise<Packument> {
        const url = `${baseUrl}/${encodeURIComponent(packageName)}`
        let response: Response
        try {
            response = await fetchFn(url, {
                headers: { accept: 'application/vnd.npm.install-v1+json' },
                signal: AbortSignal.timeout(timeoutMs),
                // 不跟随重定向：registry 元数据应直接返回，302 到任意主机属未预期的出站扩展
                redirect: 'error',
            })
        } catch (error: unknown) {
            const detail = error instanceof Error ? error.message : String(error)
            throw new Error(`failed to fetch npm registry for "${packageName}": ${redactBaseUrl(detail, baseUrl, registryHost)}`)
        }
        if (response.status === 404) {
            throw new Error(`package "${packageName}" not found in npm registry at ${registryHost}`)
        }
        if (!response.ok) {
            throw new Error(`npm registry returned HTTP ${response.status} for "${packageName}"`)
        }
        return await response.json() as Packument
    }

    function getPackument(packageName: string): Promise<Packument> {
        const existing = cache.get(packageName)
        if (existing) {
            return existing
        }
        if (cache.size >= MAX_CACHE_ENTRIES) {
            cache.clear()
        }
        const pending = fetchPackument(packageName)
        cache.set(packageName, pending)
        // 失败不长期缓存：平台进程长驻，一次瞬时网络错误不应让后续 run 永久失败
        pending.catch(() => {
            if (cache.get(packageName) === pending) {
                cache.delete(packageName)
            }
        })
        return pending
    }

    async function resolveWithPackument(
        packageName: string,
        select: (packument: Packument) => FamilyVersionResolution,
    ): Promise<FamilyVersionResolution> {
        try {
            return select(await getPackument(packageName))
        } catch (error: unknown) {
            const detail = error instanceof Error ? error.message : String(error)
            return { ok: false, error: redactBaseUrl(detail, baseUrl, registryHost) }
        }
    }

    return {
        resolve(query: FamilyVersionQuery): Promise<FamilyVersionResolution> {
            return resolveWithPackument(query.packageName, (packument) => {
                const version = selectVersion(packument, query)
                if (!version) {
                    return {
                        ok: false,
                        error: query.lockstep === 'major'
                            ? `no stable version of "${query.packageName}" matches major ${query.value}`
                            : `version ${query.value} of "${query.packageName}" is not published`,
                    }
                }
                return { ok: true, info: describeVersion(packument, version) }
            })
        },
        describe(packageName: string, version: string): Promise<FamilyVersionResolution> {
            return resolveWithPackument(packageName, (packument) => {
                if (!Object.hasOwn(packument.versions ?? {}, version)) {
                    return { ok: false, error: `version ${version} of "${packageName}" is not published` }
                }
                return { ok: true, info: describeVersion(packument, version) }
            })
        },
    }
}

/** 按目标线挑选版本：major → 该 major 下最高稳定版；version → 精确版本必须存在。 */
function selectVersion(packument: Packument, query: FamilyVersionQuery): string | undefined {
    const versions = Object.keys(packument.versions ?? {})
    if (query.lockstep === 'version') {
        return versions.includes(query.value) ? query.value : undefined
    }
    const targetMajor = Number.parseInt(query.value.replace(/^\D+/, ''), 10)
    if (!Number.isInteger(targetMajor)) {
        return undefined
    }
    const candidates = versions.filter((version) => {
        if (!valid(version) || prerelease(version)) {
            return false
        }
        return Number.parseInt(version.split('.')[0], 10) === targetMajor
    })
    candidates.sort(compare)
    return candidates.at(-1)
}

function describeVersion(packument: Packument, version: string): FamilyPackageVersionInfo {
    const peerDependencies = packument.versions?.[version]?.peerDependencies ?? {}
    return { version, peerDependencies: { ...peerDependencies } }
}

// ---------------------------------------------------------------------------
// 默认解析器（按 registry 基地址缓存；测试可 reset）
// ---------------------------------------------------------------------------

const defaultResolvers = new Map<string, FamilyVersionResolver>()

/** 取得指定 registry 基地址的共享解析器（缺省官方 registry）。 */
export function getFamilyVersionResolver(registryBaseUrl?: string): FamilyVersionResolver {
    const key = normalizeRegistryUrl(registryBaseUrl ?? DEFAULT_REGISTRY_BASE_URL) ?? DEFAULT_REGISTRY_BASE_URL
    const existing = defaultResolvers.get(key)
    if (existing) {
        return existing
    }
    if (defaultResolvers.size >= MAX_DEFAULT_RESOLVERS) {
        defaultResolvers.clear()
    }
    const resolver = createFamilyVersionResolver({ registryBaseUrl: key })
    defaultResolvers.set(key, resolver)
    return resolver
}

/** registry 主机名（错误消息只暴露 host，不暴露 path / query / 凭据） */
function describeRegistryHost(baseUrl: string): string {
    try {
        return new URL(baseUrl).host
    } catch {
        return 'registry'
    }
}

/** 把错误文本中的完整 registry URL 替换为 host，避免 path / query 中的 token 进入报告 */
function redactBaseUrl(message: string, baseUrl: string, host: string): string {
    return baseUrl ? message.split(baseUrl).join(host) : message
}

/** 清空默认解析器缓存（测试用；运行期无需调用）。 */
export function resetFamilyVersionResolvers(): void {
    defaultResolvers.clear()
}
