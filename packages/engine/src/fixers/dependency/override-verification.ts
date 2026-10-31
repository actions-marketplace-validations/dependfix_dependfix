// override-verification.ts — override 写入后的 lockfile 生效校验。
//
// 背景（2026-10-18 生产复盘）：`pnpm install` 成功 ≠ override 真正生效。通用 override 已存在、
// 但被更具体的路径级规则压过时，pnpm 可能认为 lockfile 已最新而不重解析，日志报「升级成功」
// 但实际无 diff（cmyr-skills-agents undici 7.28.0 实证）。校验必须回读**全部**锁定实例，
// 不能只看最高版本。
import type { VersionedOverridesPlan } from './overrides-io'
import { readLockfileVersions } from './lockfile-versions'
import { compareSemver, parseMajorVersion } from './semver'

/**
 * 返回仍低于目标的锁定实例（空数组 = 全部达到目标 / lockfile 中无该包）。
 *
 * lockfile 中完全没有该包时返回空数组：无法从版本回读判断，保持既有成功语义。
 */
export function remainingVersionsBelowTarget(
    lockfilePath: string,
    packageName: string,
    targetVersion: string,
): string[] {
    return readLockfileVersions(lockfilePath, packageName)
        .filter((version) => compareSemver(version, targetVersion) < 0)
}

/**
 * 回读 lockfile，确认每个版本化 override 覆盖的实例都达到目标。
 *
 * - 版本化 key `pkg@major`：只校验同一 major 的实例
 * - 通用 key `pkg`：校验全部实例
 * - 路径级 key（`parent>child`）：无法按包名映射，跳过（由上层完整验证兜底）
 *
 * @returns 首个未满足项的描述；全部满足返回 undefined
 */
export function verifyVersionedOverridesApplied(
    lockfilePath: string,
    plans: VersionedOverridesPlan[],
): string | undefined {
    for (const plan of plans) {
        const versions = readLockfileVersions(lockfilePath, plan.packageName)
        if (versions.length === 0) {
            continue
        }
        for (const [key, range] of Object.entries(plan.overrides)) {
            if (key.includes('>')) {
                continue
            }
            const target = extractTargetVersion(range)
            if (!target) {
                continue
            }
            const selector = key.startsWith(`${plan.packageName}@`)
                ? key.slice(plan.packageName.length + 1)
                : undefined
            const selectorMajor = selector === undefined
                ? undefined
                : Number(/^[^\d]*(\d+)/.exec(selector)?.[1])
            const covered = selectorMajor === undefined || Number.isNaN(selectorMajor)
                ? versions
                : versions.filter((version) => parseMajorVersion(version) === selectorMajor)
            const remaining = covered.filter((version) => compareSemver(version, target) < 0)
            if (remaining.length > 0) {
                return `${plan.packageName}: ${remaining.join(', ')} remain below ${target}`
            }
        }
    }
    return undefined
}

/**
 * 从 override 目标 range（如 `^5.4.21` / `~1.2.3` / `7.29.1`）提取可比较的版本号。
 * 无法提取时返回 undefined（该条不参与生效校验，保持既有成功语义）。
 */
function extractTargetVersion(range: string): string | undefined {
    return /(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)/.exec(range)?.[1]
}
