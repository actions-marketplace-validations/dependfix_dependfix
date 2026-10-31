// families.ts — 依赖家族锁步规则与升级计划（纯函数，不做 IO / 不联网）。
//
// 动机：同一次修复内同一生态的成员必须保持同一版本线。历史 PR 出现过
// `vitest@4` + `@vitest/coverage-v8@3`、`@typescript-eslint/parser` 与
// `eslint-plugin` 跨版本混装——单包升级各自为政时必然产生半族状态。
//
// 规则边界（与 docs/design/governance/pr-delivery-closure.md §4 同源）：
// - 精选四家族为权威清单，`peerDependencies` 只做兼容性校验，不自动扩展成员；
// - `eslint` 不参与 typescript-eslint 家族的锁步：官方支持 eslint 9 +
//   typescript-eslint 8，把 eslint 塞进同 major 家族会把合法组合判红；
// - 只覆盖直接依赖（根 / 成员 manifest 的三个安装组），间接依赖走既有 overrides 链；
// - 不在 manifest 中的族成员记 `familyMemberSkipped` 并继续（不写盘、不阻断）。

import { compare, satisfies, valid, validRange } from 'semver'
import { compareSemver, isNonSemverDeclaration, parseMajorVersion } from './semver'

/** 锁步维度：`major` = 同大版本线；`version` = 同精确版本。 */
export type FamilyLockstep = 'major' | 'version'

/**
 * 关联包（非族成员）的兼容性校验。
 *
 * - `rangeFrom: 'member'`：range 取自**族成员目标版本**的 `peerDependencies[peer]`，
 *   校验已安装的关联包版本（如 `@typescript-eslint/parser@9.x` 要求 eslint 满足 `^9`）。
 * - `rangeFrom: 'peer'`：range 取自**已安装关联包**的 `peerDependencies[member]`，
 *   校验族成员的目标版本（如已安装 `ts-jest@29` 要求 jest 满足 `^29`）。
 */
export interface FamilyPeerCheck {
    member: string
    peer: string
    rangeFrom: 'member' | 'peer'
}

export interface FamilyDefinition {
    /** 家族标识（报告与 PR 正文展示） */
    id: string
    /** 锁步成员清单（权威清单，不自动扩展） */
    members: readonly string[]
    lockstep: FamilyLockstep
    peerChecks: readonly FamilyPeerCheck[]
}

/**
 * 首批家族清单（2026-10-24 巡检驱动）。
 *
 * 新增家族必须同时补规则与夹具（正例 / `eslint@9 + typescript-eslint@8` 类反例）。
 */
export const DEPENDENCY_FAMILIES: readonly FamilyDefinition[] = [
    {
        id: 'vitest',
        members: ['vitest', '@vitest/coverage-v8', '@vitest/ui', '@vitest/browser'],
        lockstep: 'major',
        peerChecks: [],
    },
    {
        id: 'typescript-eslint',
        members: ['@typescript-eslint/parser', '@typescript-eslint/eslint-plugin', 'typescript-eslint'],
        lockstep: 'version',
        // eslint 只做 peer range 校验：目标版本的 peerDependencies.eslint 是权威约束
        peerChecks: [{ member: '@typescript-eslint/parser', peer: 'eslint', rangeFrom: 'member' }],
    },
    {
        id: 'jest',
        members: ['jest', '@types/jest'],
        lockstep: 'major',
        // ts-jest 不参与锁步：已安装 ts-jest 的 peerDependencies.jest 是权威约束
        peerChecks: [{ member: 'jest', peer: 'ts-jest', rangeFrom: 'peer' }],
    },
    {
        id: 'react',
        members: ['react', 'react-dom', '@types/react', '@types/react-dom'],
        lockstep: 'major',
        peerChecks: [],
    },
]

const FAMILY_BY_MEMBER = new Map<string, FamilyDefinition>(
    DEPENDENCY_FAMILIES.flatMap((family) => family.members.map((member) => [member, family] as const)),
)

/**
 * 解析包所属家族；未知包（含只做 peer 校验的 `eslint` / `ts-jest`）返回 `null`。
 */
export function resolveFamily(packageName: string): FamilyDefinition | null {
    return FAMILY_BY_MEMBER.get(packageName) ?? null
}

/** manifest 中可写的依赖组（与 `findDependencyVersion` 同口径）。 */
export interface FamilyManifestLike {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    optionalDependencies?: Record<string, string>
}

/**
 * 合并 manifest 三个安装组的声明（`optionalDependencies` 覆盖同名项，与 npm 语义一致）。
 * `peerDependencies` 不参与：peer 成员不在安装组中即视为「不在 manifest」。
 *
 * 防御外部 JSON 形态：用 null 原型容器（阻断 `__proto__` 原型污染）、只收集 own 字符串值，
 * 并跳过原型链风险键；非字符串声明按「不在 manifest」处理（由调用方记 familyMemberSkipped）。
 */
export function collectManifestDependencies(pkg: FamilyManifestLike): Record<string, string> {
    const merged: Record<string, string> = Object.create(null) as Record<string, string>
    for (const group of ['dependencies', 'devDependencies', 'optionalDependencies'] as const) {
        const deps = pkg[group]
        if (!deps || typeof deps !== 'object') {
            continue
        }
        for (const [name, version] of Object.entries(deps)) {
            if (name === '__proto__' || name === 'constructor' || name === 'prototype') {
                continue
            }
            if (typeof version === 'string') {
                merged[name] = version
            }
        }
    }
    return merged
}

/** registry 解析出的成员版本信息。`peerDependencies: undefined` = 尚未解析。 */
export interface FamilyMemberResolution {
    version: string
    peerDependencies?: Record<string, string>
}

export interface FamilyPendingMember {
    packageName: string
    lockstep: FamilyLockstep
    /** 目标版本 / 目标 major 的原始来源（触发告警或同批告警推荐版本） */
    value: string
}

export interface FamilyPendingPeer {
    packageName: string
    /** 需要读取 peerDependencies 的精确版本 */
    version: string
    /** 结果去向：member → 成员解析表；related → 关联包解析表 */
    target: 'member' | 'related'
}

export interface FamilyPlanUpdate {
    packageName: string
    fromVersion: string
    /** 目标版本：触发包 / 同批告警用推荐版本，其余成员用 registry 解析结果 */
    targetVersion: string
    isMajor: boolean
}

export interface FamilyPlanInput {
    /** 触发本次升级的告警包 */
    packageName: string
    /** 告警推荐版本 */
    targetVersion: string
    /** 目标 manifest 的声明（`collectManifestDependencies` 结果） */
    manifestDependencies: Readonly<Record<string, string>>
    /** 族成员目标版本解析结果（触发包也必须提供 peers，供 peer 校验） */
    resolvedMembers?: Readonly<Record<string, FamilyMemberResolution>>
    /** 关联包已安装版本（lockfile 优先；缺省表示不在仓库中，不校验） */
    relatedVersions?: Readonly<Record<string, string>>
    /** 关联包已安装版本的 peerDependencies（按包名索引） */
    relatedPeers?: Readonly<Record<string, Readonly<Record<string, string>>>>
    /**
     * 同批告警给出的目标版本（显式 `upgradeGroups` / 组内告警优先于家族规则）。
     * 命中时不再按 registry 解析该成员的目标版本。
     */
    alertTargets?: Readonly<Record<string, string>>
    /** override 保护名单命中的包名（任一成员命中 → 整族放弃） */
    protectedMembers?: readonly string[]
}

export interface FamilyPlan {
    family: FamilyDefinition
    /** 需要写盘的成员（含触发包）；空 = 家族无需动作 */
    updates: FamilyPlanUpdate[]
    /** 同版本家族出现「成员已高于目标」→ 无法在不降级的前提下锁步，整族放弃 */
    versionConflict?: string
    /** peer range 无法解析（fail-open，不阻断升级；由调用方留痕） */
    peerCheckSkipped?: string[]
    /** 家族中有、但 manifest 没有的成员（familyMemberSkipped，继续） */
    skipped: string[]
    /** manifest 中有、但为协议声明（workspace: / catalog: 等）无法改写，按跳过处理 */
    protocolMembers: string[]
    /** manifest 中有、但已在目标线，本次不写盘（不降级、不重复写盘） */
    untouched: string[]
    /** 仍需 registry 解析目标版本的成员 */
    pendingMembers: FamilyPendingMember[]
    /** 仍需 registry 解析 peerDependencies 的精确版本 */
    pendingPeers: FamilyPendingPeer[]
    /** 保护名单命中任一成员 → 整族放弃 */
    blocked?: { reason: 'override-protected', members: string[] }
    /** peer range 不满足 → 整族放弃（`undefined` = 未发现违规） */
    peerViolation?: string
}

/**
 * 从版本声明提取裸版本号（`^4.17.20` → `4.17.20`）；无三段版本返回 `undefined`。
 */
export function extractDeclaredVersion(declaration: string): string | undefined {
    return /(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/.exec(declaration.trim())?.[1]
}

/**
 * 声明是否已处于目标线（含高于目标线：不降级）。
 *
 * `major` 维度只比较 major；`version` 维度比较裸版本号（`^8.46.0` 与目标 `8.46.0`
 * 视为同版本线）。无法解析的声明返回 `false`（由调用方决定是否解析目标版本）。
 */
export function isOnTargetLine(declaration: string, lockstep: FamilyLockstep, targetVersion: string): boolean {
    if (lockstep === 'major') {
        const fromMajor = parseMajorVersion(declaration)
        const targetMajor = parseMajorVersion(targetVersion)
        if (fromMajor === -1 || targetMajor === -1) {
            return false
        }
        return fromMajor >= targetMajor
    }
    const fromVersion = extractDeclaredVersion(declaration)
    const target = extractDeclaredVersion(targetVersion)
    if (!fromVersion || !target) {
        return false
    }
    // 精确版本维度保留预发布语义（8.46.0-beta.1 < 8.46.0），避免把预发布当稳定版
    if (valid(fromVersion) && valid(target)) {
        return compare(fromVersion, target) >= 0
    }
    return compareSemver(fromVersion, target) >= 0
}

/**
 * 生成家族锁步升级计划（纯函数）。
 *
 * 两阶段调用约定：第一次调用缺省 `resolvedMembers` / `relatedPeers` 时，函数把待解析项
 * 放进 `pendingMembers` / `pendingPeers`；调用方解析后原样回填再次调用即得到最终计划。
 * 返回 `null` 表示该包不属任何家族，或触发包不在 manifest（间接依赖走 overrides 链）。
 */
export function planFamilyUpgrade(input: FamilyPlanInput): FamilyPlan | null {
    const family = resolveFamily(input.packageName)
    if (!family) {
        return null
    }
    const manifest = input.manifestDependencies
    if (!Object.hasOwn(manifest, input.packageName)) {
        return null
    }

    const plan: FamilyPlan = {
        family,
        updates: [],
        skipped: [],
        protocolMembers: [],
        untouched: [],
        pendingMembers: [],
        pendingPeers: [],
    }

    const protectedHit = family.members.filter((member) => input.protectedMembers?.includes(member) === true)
    if (protectedHit.length > 0) {
        plan.blocked = { reason: 'override-protected', members: protectedHit }
        return plan
    }

    for (const member of family.members) {
        if (!Object.hasOwn(manifest, member)) {
            plan.skipped.push(member)
            continue
        }
        const fromVersion = manifest[member]
        if (isNonSemverDeclaration(fromVersion)) {
            // 协议声明（workspace: / catalog: 等）由包管理器托管，改写会破坏语义
            plan.protocolMembers.push(member)
            continue
        }

        // 显式目标（触发包 / 同批告警）按精确版本判定：同 major 内的补丁目标同样要写入
        let explicit = false
        let targetVersion: string
        if (member === input.packageName) {
            explicit = true
            targetVersion = input.targetVersion
            if (isOnTargetLine(fromVersion, 'version', targetVersion)) {
                plan.untouched.push(member)
                continue
            }
        } else if (input.alertTargets?.[member]) {
            explicit = true
            targetVersion = input.alertTargets[member]
            if (isOnTargetLine(fromVersion, 'version', targetVersion)) {
                plan.untouched.push(member)
                continue
            }
        } else {
            // 同版本家族：成员已高于目标时无法在不降级的前提下锁步 → 整族放弃
            if (family.lockstep === 'version') {
                const declared = extractDeclaredVersion(fromVersion)
                const target = extractDeclaredVersion(input.targetVersion)
                if (declared && target && valid(declared) && valid(target) && compare(declared, target) > 0) {
                    plan.versionConflict = `${member}@${declared} is above the target line ${target}; exact-version lockstep would require a downgrade`
                    plan.updates = []
                    return plan
                }
            }
            if (isOnTargetLine(fromVersion, family.lockstep, input.targetVersion)) {
                plan.untouched.push(member)
                continue
            }
            const resolved = input.resolvedMembers?.[member]
            if (!resolved) {
                plan.pendingMembers.push({
                    packageName: member,
                    lockstep: family.lockstep,
                    value: input.targetVersion,
                })
                continue
            }
            targetVersion = resolved.version
        }

        if (!explicit && isOnTargetLine(fromVersion, family.lockstep, targetVersion)) {
            plan.untouched.push(member)
            continue
        }

        const fromMajor = parseMajorVersion(fromVersion)
        const toMajor = parseMajorVersion(targetVersion)
        plan.updates.push({
            packageName: member,
            fromVersion,
            targetVersion,
            isMajor: fromMajor !== -1 && toMajor !== -1 && fromMajor !== toMajor,
        })
    }

    // ---- peer range 校验（只对本次要升级的成员；任一不满足 → 整族放弃）----
    for (const check of family.peerChecks) {
        const update = plan.updates.find((item) => item.packageName === check.member)
        if (!update) {
            continue
        }
        const installedRelated = input.relatedVersions?.[check.peer]
        if (!installedRelated) {
            continue
        }

        let range: string | undefined
        if (check.rangeFrom === 'member') {
            const resolution = input.resolvedMembers?.[check.member]
            if (!resolution) {
                plan.pendingPeers.push({ packageName: check.member, version: update.targetVersion, target: 'member' })
                continue
            }
            if (resolution.peerDependencies === undefined) {
                plan.pendingPeers.push({ packageName: check.member, version: resolution.version, target: 'member' })
                continue
            }
            range = resolution.peerDependencies[check.peer]
            if (!range) {
                continue
            }
            const allowed = rangeAllows(installedRelated, range)
            if (allowed === undefined) {
                plan.peerCheckSkipped = [...(plan.peerCheckSkipped ?? []), `${check.member}@${resolution.version} peer range "${check.peer}: ${range}" is not parseable`]
                continue
            }
            if (!allowed) {
                plan.peerViolation = `${check.member}@${resolution.version} peer range "${check.peer}: ${range}" does not accept installed ${check.peer}@${installedRelated}`
                plan.updates = []
                return plan
            }
        } else {
            const peerRanges = input.relatedPeers?.[check.peer]
            if (peerRanges === undefined) {
                plan.pendingPeers.push({ packageName: check.peer, version: installedRelated, target: 'related' })
                continue
            }
            range = peerRanges[check.member]
            if (!range) {
                continue
            }
            const allowed = rangeAllows(update.targetVersion, range)
            if (allowed === undefined) {
                plan.peerCheckSkipped = [...(plan.peerCheckSkipped ?? []), `${check.peer}@${installedRelated} peer range "${check.member}: ${range}" is not parseable`]
                continue
            }
            if (!allowed) {
                plan.peerViolation = `${check.peer}@${installedRelated} peer range "${check.member}: ${range}" does not accept target ${check.member}@${update.targetVersion}`
                plan.updates = []
                return plan
            }
        }
    }

    // 有未解析项时不产出可执行更新，避免「基于不完整校验」的半族写入
    if (plan.pendingMembers.length > 0 || plan.pendingPeers.length > 0) {
        plan.updates = []
    }
    return plan
}

/**
 * peer range 判定：采用 npm 默认语义（不主动包含预发布版本）；
 * 非法 / 无法解析的 range 返回 `undefined`（fail-open 但留痕，由调用方记 `peerCheckSkipped`）。
 */
function rangeAllows(version: string, range: string): boolean | undefined {
    if (validRange(range) === null) {
        return undefined
    }
    try {
        return satisfies(version, range)
    } catch {
        return undefined
    }
}
