// family-upgrade.ts — 家族锁步的编排层：计划 → registry 解析 → 一次写盘。
//
// 职责边界：
// - 纯规则与两阶段计划在 fixers/dependency/families.ts；
// - registry 解析在 fixers/dependency/family-versions.ts；
// - 本文件只做「读 manifest → 补齐解析 → 调写入 → 产出动作 / 审计」，
//   不改变调用方（常规分组 / 成员 / 跨线）各自的验证与回滚语义。
//
// 失败口径（docs/design/governance/pr-delivery-closure.md §4.2 / §11）：
// - registry 不可达 / 无法确定目标版本 / peer range 不满足 → 整族放弃，
//   `FixAction.error = FAMILY_LOCKSTEP_FAILED: …` + 审计条目，不写盘、不产生半族 PR；
// - override-protect 命中任一成员 → 整族放弃，按既有 `OVERRIDE_PROTECTED` 记审计并计入跳过
//   （noOp 动作，不归因失败）；
// - 写入 / 安装失败 → 由 `upgradeFamilyDependencies` 整体回滚；环境性安装失败沿用既有
//   `environmental` 口径（不在本模块记归因错误，由调用方标记）。

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
    addSkipped,
    type AlertFixOutcome,
    type FixAction,
    type FixActionFamily,
    type FixError,
    type Logger,
    type NormalizedSecurityAlert,
    type RunSummary,
} from '@dependfix/core'
import type { RuntimeConfig } from '../config'
import {
    readLockfileVersion,
    upgradeFamilyDependencies,
    type ManifestUpgradeApplied,
} from '../fixers/dependency'
import {
    collectManifestDependencies,
    extractDeclaredVersion,
    planFamilyUpgrade,
    resolveFamily,
    type FamilyManifestLike,
    type FamilyMemberResolution,
    type FamilyPlan,
} from '../fixers/dependency/families'
import { getFamilyVersionResolver, resolveRegistryBaseUrl } from '../fixers/dependency/family-versions'
import { matchesOverrideProtect } from '../github/repo-policy'
import { recordSkippedAlerts } from './alert-outcomes'
import { markEnvironmentalInstallFailure } from './environmental-failure'

/** 家族锁步编排所需的最小上下文（与 AppContext 的结构兼容）。 */
export interface FamilyUpgradeContext {
    config: Pick<RuntimeConfig, 'dryRun' | 'overrideProtect'>
    logger: Logger
    /** 告警级结果收集器（缺省 ⇒ 不写显式记录，仅靠动作推导） */
    alertOutcomes?: Map<string, AlertFixOutcome>
    workDir: string
    allErrors: FixError[]
    summary: Pick<RunSummary, 'alertsSkipped' | 'alertsSkippedByReason'>
}

export interface FamilyUpgradeParams {
    alert: NormalizedSecurityAlert
    /** 成员 manifest 目录（相对 workDir）；缺省 = 根 manifest */
    manifestDir?: string
    /** 同批告警给出的目标版本（显式 upgradeGroups / 组内告警优先于家族规则） */
    alertTargets?: Readonly<Record<string, string>>
}

export interface FamilyUpgradeAttempt {
    /**
     * - `not-applicable`：不属家族 / 间接依赖 / dry-run / 只有触发包可写 → 走既有单包路径；
     * - `applied`：已按家族规则写盘（一次安装）；
     * - `blocked`：策略保护名单命中成员，整族放弃（noOp 动作）；
     * - `failed`：解析 / peer / 安装失败，整族放弃（动作携带 FAMILY_LOCKSTEP_FAILED）。
     */
    status: 'not-applicable' | 'applied' | 'blocked' | 'failed'
    action?: FixAction
    family?: FixActionFamily
    updates?: ManifestUpgradeApplied[]
    plan?: FamilyPlan
    /** 安装失败是否由环境问题导致（调用方按既有环境性口径处理） */
    environmental?: boolean
}

/**
 * 尝试按家族锁步升级告警对应的直接依赖。
 *
 * 只在「触发包在该 manifest 的直接依赖中」且「至少还有一个同族成员需要写盘」时执行；
 * 其余情况返回 `not-applicable`，调用方无需感知家族逻辑。
 */
export async function attemptFamilyUpgrade(
    ctx: FamilyUpgradeContext,
    params: FamilyUpgradeParams,
): Promise<FamilyUpgradeAttempt> {
    const { alert, manifestDir } = params
    const startedAt = Date.now()
    const targetVersion = alert.recommendedVersion
    const family = resolveFamily(alert.packageName)
    if (!family || !targetVersion || ctx.config.dryRun) {
        return { status: 'not-applicable' }
    }

    const manifestPath = join(ctx.workDir, manifestDir ?? '.', 'package.json')
    const manifest = readManifest(manifestPath)
    if (!manifest) {
        // 让既有单包路径给出可读的 file not found / invalid JSON 错误
        return { status: 'not-applicable' }
    }
    const manifestDependencies = collectManifestDependencies(manifest)
    if (!(alert.packageName in manifestDependencies)) {
        return { status: 'not-applicable' }
    }

    const protectedMembers = family.members.filter((member) => member in manifestDependencies
        && matchesOverrideProtect({ overrideProtect: ctx.config.overrideProtect }, alert.repository, member).protected)

    const relatedVersions: Record<string, string> = {}
    for (const check of family.peerChecks) {
        if (!(check.peer in manifestDependencies)) {
            continue
        }
        const installed = readLockfileVersion(join(ctx.workDir, 'pnpm-lock.yaml'), check.peer)
            ?? extractDeclaredVersion(manifestDependencies[check.peer])
        if (installed) {
            relatedVersions[check.peer] = installed
        }
    }

    const resolvedMembers: Record<string, FamilyMemberResolution> = {}
    const relatedPeers: Record<string, Record<string, string>> = {}
    const buildPlan = (): FamilyPlan | null => planFamilyUpgrade({
        packageName: alert.packageName,
        targetVersion,
        manifestDependencies,
        resolvedMembers,
        relatedVersions,
        relatedPeers,
        alertTargets: params.alertTargets,
        protectedMembers,
    })

    let plan = buildPlan()
    if (!plan) {
        return { status: 'not-applicable' }
    }
    if (plan.blocked) {
        return blockedAttempt(ctx, alert, plan, startedAt, manifestDependencies[alert.packageName])
    }

    const resolver = getFamilyVersionResolver(resolveRegistryBaseUrl(ctx.workDir))
    for (let round = 0; round < 3; round++) {
        if (plan.pendingMembers.length === 0 && plan.pendingPeers.length === 0) {
            break
        }

        for (const pending of plan.pendingMembers) {
            const resolution = await resolver.resolve({
                packageName: pending.packageName,
                lockstep: pending.lockstep,
                value: pending.value,
            })
            if (!resolution.ok) {
                return failedAttempt(ctx, alert, plan, {
                    startedAt,
                    triggerFromVersion: manifestDependencies[alert.packageName],
                    error: `FAMILY_LOCKSTEP_FAILED: family "${family.id}" member "${pending.packageName}" version resolution failed: ${resolution.error}`,
                })
            }
            resolvedMembers[pending.packageName] = {
                version: resolution.info.version,
                peerDependencies: resolution.info.peerDependencies,
            }
        }

        for (const pending of plan.pendingPeers) {
            const resolution = await resolver.describe(pending.packageName, pending.version)
            if (!resolution.ok) {
                return failedAttempt(ctx, alert, plan, {
                    startedAt,
                    triggerFromVersion: manifestDependencies[alert.packageName],
                    error: `FAMILY_LOCKSTEP_FAILED: family "${family.id}" peer metadata resolution failed for "${pending.packageName}@${pending.version}": ${resolution.error}`,
                })
            }
            if (pending.target === 'member') {
                resolvedMembers[pending.packageName] = {
                    ...(resolvedMembers[pending.packageName] ?? { version: pending.version }),
                    peerDependencies: resolution.info.peerDependencies,
                }
            } else {
                relatedPeers[pending.packageName] = resolution.info.peerDependencies
            }
        }

        plan = buildPlan()
        if (!plan) {
            return { status: 'not-applicable' }
        }
        if (plan.blocked) {
            return blockedAttempt(ctx, alert, plan, startedAt, manifestDependencies[alert.packageName])
        }
        if (plan.peerViolation) {
            return failedAttempt(ctx, alert, plan, {
                startedAt,
                triggerFromVersion: manifestDependencies[alert.packageName],
                error: `FAMILY_LOCKSTEP_FAILED: family "${family.id}" peer compatibility check failed: ${plan.peerViolation}`,
            })
        }
        if (plan.versionConflict) {
            return failedAttempt(ctx, alert, plan, {
                startedAt,
                triggerFromVersion: manifestDependencies[alert.packageName],
                error: `FAMILY_LOCKSTEP_FAILED: family "${family.id}" version conflict: ${plan.versionConflict}`,
            })
        }
    }

    if (plan.pendingMembers.length > 0 || plan.pendingPeers.length > 0) {
        return failedAttempt(ctx, alert, plan, {
            startedAt,
            triggerFromVersion: manifestDependencies[alert.packageName],
            error: `FAMILY_LOCKSTEP_FAILED: family "${family.id}" member versions could not be resolved`,
        })
    }
    if (plan.peerViolation) {
        return failedAttempt(ctx, alert, plan, {
            startedAt,
            triggerFromVersion: manifestDependencies[alert.packageName],
            error: `FAMILY_LOCKSTEP_FAILED: family "${family.id}" peer compatibility check failed: ${plan.peerViolation}`,
        })
    }
    if (plan.versionConflict) {
        return failedAttempt(ctx, alert, plan, {
            startedAt,
            triggerFromVersion: manifestDependencies[alert.packageName],
            error: `FAMILY_LOCKSTEP_FAILED: family "${family.id}" version conflict: ${plan.versionConflict}`,
        })
    }

    const triggerUpdate = plan.updates.find((update) => update.packageName === alert.packageName)
    if (!triggerUpdate || plan.updates.length <= 1) {
        // 只有触发包可写（其余成员缺失 / 已在线）→ 既有多成员写入无收益，走单包路径
        return { status: 'not-applicable', plan }
    }

    // familyMemberSkipped 留痕：不在 manifest / 协议声明（包管理器托管）的成员继续，不阻断
    const manifestLabel = manifestDir ? `${manifestDir}/package.json` : 'package.json'
    for (const member of plan.skipped) {
        ctx.logger.info(`[family] ${family.id}: familyMemberSkipped ${member} (not in ${manifestLabel})`)
    }
    for (const member of plan.protocolMembers) {
        ctx.logger.info(`[family] ${family.id}: familyMemberSkipped ${member} in ${manifestLabel} (non-semver declaration; managed by package manager)`)
    }
    for (const skipped of plan.peerCheckSkipped ?? []) {
        ctx.logger.warn(`[family] ${family.id}: peer check skipped (unparseable range): ${skipped}`)
    }

    const result = await upgradeFamilyDependencies({
        workDir: ctx.workDir,
        manifestDir,
        updates: plan.updates.map((update) => ({
            packageName: update.packageName,
            targetVersion: update.targetVersion,
        })),
    })

    if (!result.success) {
        const error = `FAMILY_LOCKSTEP_FAILED: ${result.error ?? 'unknown error'}`
        if (result.environmental === true) {
            // 环境性安装失败不归因目标仓库：记 `ENVIRONMENT_ERROR`（跳过类审计类别）并保留动作标记
            markEnvironmentalInstallFailure(ctx, {
                scope: 'family-lockstep',
                repository: alert.repository,
                target: `${family.id} (${plan.updates.map((update) => update.packageName).join(', ')})`,
                error: result.error,
            })
        } else {
            ctx.allErrors.push({
                repository: alert.repository,
                target: alert.packageName,
                stage: 'fix',
                category: 'FAMILY_LOCKSTEP_FAILED',
                message: `${error} (family: ${family.id})`,
            })
        }
        return {
            status: 'failed',
            updates: result.updates,
            plan,
            environmental: result.environmental,
            action: buildAction(alert, attemptedVersions(result.updates, triggerUpdate), startedAt, {
                success: false,
                error,
                ...(result.environmental === true ? { environmentalFailure: true } : {}),
            }),
        }
    }

    const familyRecord: FixActionFamily = {
        id: family.id,
        members: result.updates.map((update) => update.packageName),
        skipped: [...plan.skipped, ...plan.protocolMembers],
    }
    return {
        status: 'applied',
        updates: result.updates,
        plan,
        family: familyRecord,
        action: buildAction(alert, attemptedVersions(result.updates, triggerUpdate), startedAt, { success: true }, familyRecord),
    }
}

function readManifest(manifestPath: string): FamilyManifestLike | null {
    try {
        return JSON.parse(readFileSync(manifestPath, 'utf-8')) as FamilyManifestLike
    } catch {
        return null
    }
}

/**
 * 把已应用的家族锁步结果映射为触发包的升级结果（供跨线 / 成员路径复用既有验证流程）。
 */
export function familyVersionsOf(
    attempt: FamilyUpgradeAttempt,
    alert: NormalizedSecurityAlert,
): { fromVersion: string, toVersion: string, isMajor: boolean, success: boolean, error?: string, environmental?: boolean } {
    const applied = attempt.updates?.find((update) => update.packageName === alert.packageName)
    return {
        fromVersion: applied?.fromVersion ?? '',
        toVersion: applied?.toVersion ?? alert.recommendedVersion ?? '',
        isMajor: applied?.isMajor ?? false,
        success: attempt.status === 'applied',
    }
}

/** 保护名单命中成员：整族放弃（按既有 `OVERRIDE_PROTECTED` 口径计跳过，不归因失败）。 */
function blockedAttempt(
    ctx: FamilyUpgradeContext,
    alert: NormalizedSecurityAlert,
    plan: FamilyPlan,
    startedAt: number,
    triggerFromVersion: string | undefined,
): FamilyUpgradeAttempt {
    const members = plan.blocked?.members ?? []
    const trigger = plan.updates.find((update) => update.packageName === alert.packageName)
    const reason = `family "${plan.family.id}" lockstep skipped: ${members.map((member) => `"${member}"`).join(', ')} protected by repo policy`
    ctx.logger.warn(`[family] ${alert.repository}: ${reason}`)
    ctx.allErrors.push({
        repository: alert.repository,
        target: alert.packageName,
        stage: 'fix',
        category: 'OVERRIDE_PROTECTED',
        message: reason,
    })
    addSkipped(ctx.summary, 'override-protected')
    recordSkippedAlerts(ctx, [alert], 'override-protected')
    return {
        status: 'blocked',
        plan,
        action: {
            type: 'dependency-upgrade',
            repository: alert.repository,
            target: alert.packageName,
            fromVersion: triggerFromVersion,
            toVersion: trigger?.targetVersion ?? alert.recommendedVersion,
            isMajor: trigger?.isMajor ?? false,
            strategy: 'family-lockstep',
            success: true,
            noOp: true,
            error: reason,
            durationMs: Date.now() - startedAt,
        },
    }
}

/** 解析 / peer 校验失败：整族放弃并留审计（不写盘、不产生半族 PR）。 */
function failedAttempt(
    ctx: FamilyUpgradeContext,
    alert: NormalizedSecurityAlert,
    plan: FamilyPlan,
    params: { startedAt: number, triggerFromVersion: string | undefined, error: string },
): FamilyUpgradeAttempt {
    const { startedAt, triggerFromVersion, error } = params
    const trigger = plan.updates.find((update) => update.packageName === alert.packageName)
    ctx.logger.warn(`[family] ${alert.repository}: ${error}`)
    ctx.allErrors.push({
        repository: alert.repository,
        target: alert.packageName,
        stage: 'fix',
        category: 'FAMILY_LOCKSTEP_FAILED',
        message: error,
    })
    return {
        status: 'failed',
        plan,
        action: {
            type: 'dependency-upgrade',
            repository: alert.repository,
            target: alert.packageName,
            fromVersion: triggerFromVersion,
            toVersion: trigger?.targetVersion ?? alert.recommendedVersion,
            isMajor: trigger?.isMajor ?? false,
            strategy: 'family-lockstep',
            success: false,
            error,
            durationMs: Date.now() - startedAt,
        },
    }
}

interface ActionVersions {
    fromVersion?: string
    toVersion?: string
    isMajor: boolean
}

function appliedVersions(update: ManifestUpgradeApplied): ActionVersions {
    return { fromVersion: update.fromVersion, toVersion: update.toVersion, isMajor: update.isMajor }
}

/** 优先使用实际写盘结果（含原前缀），缺失时回退计划里的目标版本。 */
function attemptedVersions(
    applied: readonly ManifestUpgradeApplied[],
    trigger: { packageName: string, fromVersion: string, targetVersion: string, isMajor: boolean },
): ActionVersions {
    const match = applied.find((update) => update.packageName === trigger.packageName)
    return match
        ? appliedVersions(match)
        : { fromVersion: trigger.fromVersion, toVersion: trigger.targetVersion, isMajor: trigger.isMajor }
}

function buildAction(
    alert: NormalizedSecurityAlert,
    versions: ActionVersions,
    startedAt: number,
    outcome: { success: boolean, error?: string, environmentalFailure?: boolean },
    family?: FixActionFamily,
): FixAction {
    return {
        type: 'dependency-upgrade',
        repository: alert.repository,
        target: alert.packageName,
        fromVersion: versions.fromVersion,
        toVersion: versions.toVersion,
        isMajor: versions.isMajor,
        strategy: 'family-lockstep',
        success: outcome.success,
        ...(outcome.error !== undefined ? { error: outcome.error } : {}),
        ...(outcome.environmentalFailure === true ? { environmentalFailure: true } : {}),
        durationMs: Date.now() - startedAt,
        ...(family ? { family } : {}),
    }
}
