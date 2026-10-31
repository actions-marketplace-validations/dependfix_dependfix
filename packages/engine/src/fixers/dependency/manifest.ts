// manifest.ts — package.json 的结构视图与声明改写原语。
//
// 从 index.ts 拆出的原因：家族锁步写入（manifest-upgrades.ts）与既有单包升级共用
// 同一套「在三个安装组中定位 / 提取前缀 / 创建 overrides 容器」逻辑，集中在此避免
// index.ts 与写入模块形成循环依赖，同时收敛 index.ts 行数。

/** `package.json` 的最小结构视图（只声明本模块读写的字段）。 */
export interface PackageJson {
    name?: string
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    optionalDependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
    pnpm?: {
        overrides?: Record<string, string>
        [key: string]: unknown
    }
    [key: string]: unknown
}

/** 依赖所在的安装组与原始声明。 */
export interface DependencyInfo {
    group: 'dependencies' | 'devDependencies' | 'optionalDependencies'
    version: string
}

/**
 * 在 `package.json` 的 `dependencies` / `devDependencies` / `optionalDependencies` 中按顺序查找包。
 */
export function findDependencyVersion(
    pkg: PackageJson,
    packageName: string,
): DependencyInfo | null {
    const groups = ['dependencies', 'devDependencies', 'optionalDependencies'] as const
    for (const group of groups) {
        const deps = pkg[group]
        if (deps && typeof deps === 'object' && packageName in deps) {
            return { group, version: deps[packageName] }
        }
    }
    return null
}

/**
 * 从版本声明中提取前缀（^ / ~ / 空）。
 *
 * @example
 * extractPrefix('^4.17.20')  // '^'
 * extractPrefix('~4.17.0')   // '~'
 * extractPrefix('4.17.20')   // ''
 * extractPrefix('*')         // '^'  (默认)
 */
export function extractPrefix(version: string): string {
    const trimmed = version.trim()
    if (/^\d/.test(trimmed)) {
        return ''
    }
    if (trimmed.startsWith('^')) {
        return '^'
    }
    if (trimmed.startsWith('~')) {
        return '~'
    }
    // 复杂 range / * / latest → 默认 ^
    return '^'
}

/**
 * 确保 `package.json` 中存在 `pnpm.overrides` 对象，若不存在则创建。
 * 返回 `overrides` 对象的引用，调用方可直接写入。
 */
export function ensurePnpmOverrides(pkg: PackageJson): Record<string, string> {
    if (!pkg.pnpm) {
        pkg.pnpm = {}
    }
    if (!pkg.pnpm.overrides) {
        pkg.pnpm.overrides = {}
    }
    return pkg.pnpm.overrides
}
