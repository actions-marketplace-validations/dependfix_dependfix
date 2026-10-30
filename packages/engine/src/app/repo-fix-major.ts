// repo-fix-major.ts — 跨线（major）升级步骤（自 repo-fix.ts 拆出：文件行数治理 + 自包含动作组）。
//
// 仅消费 LockfileAlertSets.rootManifestAlerts 中已判定为「可自动跨线」的告警：
// 按包取最高推荐版本 → 家族锁步 / 单包升级 → 脆弱实例复核 → 强制完整验证
// （AI 修复失败时可转绿）→ 失败整体回滚。`--allow-major-upgrade` 的准入判定仍在
// repo-fix.ts（本模块只处理已准入集合）。
import type { Octokit } from '@octokit/rest'
import type { FixActionFamily, NormalizedSecurityAlert } from '@dependfix/core'
import {
    compareSemver,
    readLockfileVersions,
    upgradeDependency,
} from '../fixers/dependency'
import { runAiIntegration } from '../ai/app-integration'
import { restoreTrackedFiles, snapshotTrackedFiles } from '../helpers'
import { attemptFamilyUpgrade, familyVersionsOf } from './family-upgrade'
import { markEnvironmentalInstallFailure } from './environmental-failure'
import { mergeAiUsage } from './helpers'
import { recordUpgradeFailure } from './upgrade-failure'
import { recordVerificationCheckpoint } from './verification-checkpoint'
import { verifyProject } from './verify-project'
import type { RepoFixCtx, RepoFixProgress } from './repo-fix'

/**
 * 执行跨线升级（已准入集合）。返回停机原因（环境性 / 取消）或 `undefined`。
 */
export interface AutoMajorUpgradeParams {
    client: Octokit | null
    repo: string
    lockfilePath: string
    alerts: NormalizedSecurityAlert[]
    progress: RepoFixProgress
}

export async function applyAutoMajorUpgrades(
    ctx: RepoFixCtx,
    params: AutoMajorUpgradeParams,
): Promise<'environmental' | 'aborted' | undefined> {
    const { client, repo, lockfilePath, alerts: autoMajorAlerts, progress } = params
    let stopReason: 'environmental' | 'aborted' | undefined
    const autoMajorByPackage = new Map<string, NormalizedSecurityAlert>()
    for (const alert of autoMajorAlerts) {
        const existing = autoMajorByPackage.get(alert.packageName)
        const existingTarget = existing?.recommendedVersion
        const alertTarget = alert.recommendedVersion
        if (!existing || (existingTarget && alertTarget && compareSemver(alertTarget, existingTarget) > 0)) {
            autoMajorByPackage.set(alert.packageName, alert)
        }
    }
    const autoMajorRepresentatives = [...autoMajorByPackage.values()]
    if (autoMajorAlerts.length > autoMajorRepresentatives.length) {
        ctx.logger.info(
            `[major-upgrade] ${autoMajorAlerts.length - autoMajorRepresentatives.length} cross-major alert(s) merged into package representatives (highest target per package)`,
        )
    }
    // 同批告警目标（显式 upgradeGroups / 组内告警）优先于家族规则解析结果
    const majorFamilyTargets: Record<string, string> = {}
    for (const alert of autoMajorRepresentatives) {
        if (alert.recommendedVersion) {
            majorFamilyTargets[alert.packageName] = alert.recommendedVersion
        }
    }
    for (const alert of autoMajorRepresentatives) {
        if (ctx.config.dryRun) {
            // dry-run 不写盘：仅记录计划动作（与 2.0.1 dry-run 语义一致）
            ctx.logger.info(`[dry-run] Would apply major upgrade for ${alert.packageName} → ${alert.recommendedVersion}`)
            ctx.allActions.push({
                type: 'dependency-upgrade',
                repository: alert.repository,
                target: alert.packageName,
                fromVersion: '',
                toVersion: alert.recommendedVersion,
                isMajor: true,
                strategy: 'major-upgrade',
                success: true,
                durationMs: 0,
            })
            progress.fixed++
            continue
        }
        const majorSnapshot = snapshotTrackedFiles(ctx.workDir)
        await recordVerificationCheckpoint(ctx, repo, progress, `major-upgrade:${alert.packageName}`)
        ctx.logger.warn(
            `[major-upgrade] ${alert.packageName}: applying cross-major upgrade → ${alert.recommendedVersion} (explicit --allow-major-upgrade; full verification required)`,
        )
        // 家族锁步优先：同 Eco 成员先整体升到同一版本线，再由下方完整验证兜底
        const familyAttempt = await attemptFamilyUpgrade(ctx, {
            alert,
            alertTargets: majorFamilyTargets,
        })
        let majorFamily: FixActionFamily | undefined
        if (familyAttempt.action && familyAttempt.status !== 'applied') {
            ctx.allActions.push(familyAttempt.action)
            if (familyAttempt.status === 'failed') {
                if (familyAttempt.environmental === true) {
                    stopReason = 'environmental'
                    break
                }
                recordUpgradeFailure(ctx, progress, 'major-upgrade', alert.packageName, familyAttempt.action.error)
            }
            continue
        }

        const majorResult = familyAttempt.status === 'applied'
            ? familyVersionsOf(familyAttempt, alert)
            : await upgradeDependency({
                packageName: alert.packageName,
                targetVersion: alert.recommendedVersion!,
                workDir: ctx.workDir,
            })
        if (familyAttempt.status === 'applied') {
            majorFamily = familyAttempt.family
        }
        if (!majorResult.success) {
            // 环境性安装失败（信号 / 超时 / 无 stderr 诊断）：不归因目标仓库，也不值得继续
            // 尝试其余跨线 / 成员 / 分组安装（同一次环境故障会重复出现）
            const environmentalMark = majorResult.environmental === true
                ? markEnvironmentalInstallFailure(ctx, {
                    scope: 'major-upgrade',
                    repository: alert.repository,
                    target: alert.packageName,
                    error: majorResult.error,
                })
                : {}
            ctx.allActions.push({
                type: 'dependency-upgrade',
                repository: alert.repository,
                target: alert.packageName,
                fromVersion: majorResult.fromVersion,
                toVersion: alert.recommendedVersion,
                isMajor: true,
                strategy: 'major-upgrade',
                success: false,
                error: majorResult.error,
                durationMs: 0,
                ...environmentalMark,
            })
            if (majorResult.environmental === true) {
                stopReason = 'environmental'
                break
            }
            recordUpgradeFailure(ctx, progress, 'major-upgrade', alert.packageName, majorResult.error)
            continue
        }
        const remainingVersions = readLockfileVersions(lockfilePath, alert.packageName)
        const stillVulnerable = remainingVersions.some(
            (v) => compareSemver(v, alert.recommendedVersion!) < 0,
        )
        if (stillVulnerable) {
            restoreTrackedFiles(ctx.workDir, majorSnapshot)
            ctx.allActions.push({
                type: 'dependency-upgrade',
                repository: alert.repository,
                target: alert.packageName,
                fromVersion: majorResult.fromVersion,
                toVersion: alert.recommendedVersion,
                isMajor: true,
                strategy: 'major-upgrade',
                success: false,
                error: 'vulnerable instance(s) remain after cross-major upgrade (workspace member / transitive pin); changes rolled back',
                durationMs: 0,
            })
            progress.failed++
            ctx.logger.warn(
                `[major-upgrade] ${alert.packageName}: vulnerable instance(s) remain (${remainingVersions.join(', ')}) — rolled back cross-major upgrade, manual review required`,
            )
            continue
        }
        // 跨线升级保留**严格**口径（不套用基线归因）：命令级基线只能区分「同一命令红 / 绿」，
        // 无法区分失败身份（红的还是原来那条失败），不足以支撑「跨 major 升级可保留」的判断。
        // 基线归因仅用于最终交付门禁（finalizeRepoFix）。
        const majorVerifyActions = await verifyProject(ctx, repo, {
            ciAlignment: { client, defaultBranch: progress.defaultBranch },
        })
        ctx.allActions.push(...majorVerifyActions)
        let majorOk = majorVerifyActions.every((a) => a.success)

        const ai = ctx.config.ai
        const aiTriggered = ai?.enabled === true
            && !ctx.config.dryRun
            && (ai.trigger === 'both' || ai.trigger === 'major' || (ai.trigger === 'failure' && !majorOk))
        if (aiTriggered) {
            const failureLog = majorOk
                ? undefined
                : majorVerifyActions.filter((a) => !a.success)
                    .map((a) => a.error ?? `exit code for ${a.target}`)
                    .join('\n')
            const aiResult = await runAiIntegration({
                ai,
                // 2.0.2 段仅对 lockfile 告警可达（GitHub 源），client 恒非空；
                // pnpm-audit 源告警 manifestPath='' 不满足 lockfileManifestAlerts 过滤
                client: client!,
                ctx,
                repo,
                dryRun: ctx.config.dryRun,
            }, {
                packageName: alert.packageName,
                fromVersion: majorResult.fromVersion,
                toVersion: alert.recommendedVersion!,
                failureLog,
            })
            ctx.allActions.push(...aiResult.actions)
            // run 级用量聚合（进报告 aiUsage 段）
            ctx.aiUsageRef.aggregate = mergeAiUsage(ctx.aiUsageRef.aggregate, aiResult.usage)
            // AI patch 成功 = AI 内部已通过完整验证（apply + verify）
            const aiPatchSuccess = aiResult.actions.some(
                (a) => a.strategy === 'ai-patch' && a.success && !a.noOp,
            )
            if (aiPatchSuccess) {
                majorOk = true
            }
        }

        if (majorOk) {
            ctx.allActions.push({
                type: 'dependency-upgrade',
                repository: alert.repository,
                target: alert.packageName,
                fromVersion: majorResult.fromVersion,
                toVersion: majorResult.toVersion,
                isMajor: true,
                strategy: 'major-upgrade',
                success: true,
                durationMs: 0,
                ...(majorFamily ? { family: majorFamily } : {}),
            })
            progress.fixed++
            ctx.logger.info(`[major-upgrade] ${alert.packageName}: cross-major upgrade passed full verification`)
        } else {
            // 回滚声明 + lockfile（AI patch 已由 applier 内部回滚或未应用）
            restoreTrackedFiles(ctx.workDir, majorSnapshot)
            ctx.allActions.push({
                type: 'dependency-upgrade',
                repository: alert.repository,
                target: alert.packageName,
                fromVersion: majorResult.fromVersion,
                toVersion: alert.recommendedVersion,
                isMajor: true,
                strategy: 'major-upgrade',
                success: false,
                error: 'major upgrade failed full verification; changes rolled back',
                durationMs: 0,
            })
            progress.failed++
            ctx.logger.warn(
                `[major-upgrade] ${alert.packageName}: full verification failed — rolled back cross-major upgrade`,
            )
        }
    }

    return stopReason
}
