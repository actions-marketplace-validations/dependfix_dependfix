// semver.ts — dependency fixer 的版本比较原语（从 index.ts 拆出以控制文件行数）。
// 保持既有导出名与语义不变：index.ts 继续 re-export，外部消费者无需调整 import。

/**
 * 从版本声明中提取主版本号（major）。
 * 去除前缀后匹配第一个 semver 段。
 *
 * @example
 * parseMajorVersion('^4.17.20')   // 4
 * parseMajorVersion('~2.0.0')     // 2
 * parseMajorVersion('1.2.3')      // 1
 * parseMajorVersion('*')          // -1
 */
export function parseMajorVersion(version: string): number {
    const cleaned = version.replace(/^\s*[\^~>=<]*\s*/, '')
    const match = /^(\d+)\.\d+\.\d+/.exec(cleaned)
    return match ? Number.parseInt(match[1], 10) : -1
}

/**
 * 比较两个语义化版本（`x.y.z`，可选 pre-release 后缀）。
 *
 * `a > b` 返回正数，`a < b` 返回负数，相等返回 0；非 semver 字符串按 0 处理
 * （保守：不参与大小比较）。pre-release 后缀忽略（如 `1.0.0-beta` 视为 `1.0.0`）。
 *
 * @example
 * compareSemver('4.18.0', '4.17.21')  // 1
 * compareSemver('5.4.20', '6.4.3')    // -1
 * compareSemver('1.2.3', '1.2.3')     // 0
 */
export function compareSemver(a: string, b: string): number {
    const parse = (v: string): number[] => {
        const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim())
        return match ? [Number.parseInt(match[1], 10), Number.parseInt(match[2], 10), Number.parseInt(match[3], 10)] : [0, 0, 0]
    }

    const [aMajor, aMinor, aPatch] = parse(a)
    const [bMajor, bMinor, bPatch] = parse(b)

    if (aMajor !== bMajor) {
        return aMajor - bMajor
    }
    if (aMinor !== bMinor) {
        return aMinor - bMinor
    }
    return aPatch - bPatch
}
