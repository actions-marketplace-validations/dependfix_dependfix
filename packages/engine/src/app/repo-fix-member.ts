// repo-fix-member.ts — workspace 成员级依赖升级。
//
// 从 repo-fix.ts 拆出：该文件触及 eslint `max-lines` 上限，成员升级是自包含的安装动作组，
// 与 lockfile / 分组升级无共享状态（只消费 LockfileAlertSets.memberManifestAlerts）。
import { compareSemver, readLockfileVersions, upgradeDependency } from '../fixers/dependency'
import { quickVerifyProject, restoreTrackedFiles, snapshotTrackedFiles, type MemberManifestAlert } from '../helpers'
import { isAbortRequested } from '../runners/process-control'
import type { LockfileAlertSets, RepoFixCtx, RepoFixProgress } from './repo-fix'
import { attemptFamilyUpgrade, familyVersionsOf } from './family-upgrade'
import { markEnvironmentalInstallFailure } from './environmental-failure'
import { recordVerificationCheckpoint } from './verification-checkpoint'
import { recordUpgradeFailure } from './upgrade-failure'

/**
 * 步骤 3：成员级升级（workspace 成员 manifest 直接依赖；member 桶准入已保证：
 * 成员白名单 + 直接声明 + fixable + 单版本 + 非跨线）。按「包名 + manifestDir」
 * 聚合取最高推荐为代表；逐项快照 → upgradeDependency({ manifestDir }) → 实例
 * 复核（残留脆弱实例回滚）→ quickVerify（根 lint）→ 失败回滚。不误标 fixed/converged。
 *
 * @returns `true` = 环境性安装失败已终止本仓库后续安装（调用方应跳过分组升级链）；
 *          `false` = 正常走完（或运行级取消，取消由调用方自己的守卫处理）
 */
export async function applyMemberUpgrades(
    ctx: RepoFixCtx,
    repo: string,
    sets: LockfileAlertSets,
    progress: RepoFixProgress,
): Promise<boolean> {
    if (isAbortRequested()) {
        return false
    }
    const { memberManifestAlerts, lockfilePath } = sets
    const memberByPackageAndDir = new Map<string, MemberManifestAlert>()
    for (const item of memberManifestAlerts) {
        const key = `${item.alert.packageName}@${item.manifestDir}`
        const existing = memberByPackageAndDir.get(key)
        const existingTarget = existing?.alert.recommendedVersion
        const alertTarget = item.alert.recommendedVersion
        if (!existing || (existingTarget && alertTarget && compareSemver(alertTarget, existingTarget) > 0)) {
            memberByPackageAndDir.set(key, item)
        }
    }
    if (memberManifestAlerts.length > memberByPackageAndDir.size) {
        ctx.logger.info(
            `[member-upgrade] ${memberManifestAlerts.length - memberByPackageAndDir.size} member alert(s) merged into package+dir representatives (highest target per package per member)`,
        )
    }
    // 同批告警目标（按成员 manifest 分组）优先于家族规则解析结果
    const familyTargetsByDir = new Map<string, Record<string, string>>()
    for (const item of memberManifestAlerts) {
        const target = item.alert.recommendedVersion
        if (!target) {
            continue
        }
        const targets = familyTargetsByDir.get(item.manifestDir) ?? {}
        const existing = targets[item.alert.packageName]
        if (!existing || compareSemver(target, existing) > 0) {
            targets[item.alert.packageName] = target
        }
        familyTargetsByDir.set(item.manifestDir, targets)
    }
    for (const item of [...memberByPackageAndDir.values()]) {
        const { alert, manifestDir } = item
        const memberManifestPath = `${manifestDir}/package.json`
        if (ctx.config.dryRun) {
            ctx.logger.info(`[dry-run] Would upgrade ${alert.packageName} in ${memberManifestPath} → ${alert.recommendedVersion}`)
            ctx.allActions.push({
                type: 'dependency-upgrade',
                repository: alert.repository,
                target: alert.packageName,
                fromVersion: '',
                toVersion: alert.recommendedVersion,
                isMajor: false,
                strategy: 'member-upgrade',
                success: true,
                durationMs: 0,
                filePath: memberManifestPath,
            })
            progress.fixed++
            continue
        }
        const memberSnapshot = snapshotTrackedFiles(ctx.workDir, [memberManifestPath])
        recordVerificationCheckpoint(ctx, repo, progress, `member-upgrade:${alert.packageName}`)
        ctx.logger.warn(
            `[member-upgrade] ${alert.packageName}: upgrading member declaration in ${memberManifestPath} → ${alert.recommendedVersion}`,
        )
        // 家族锁步优先：同一成员 manifest 内的同族成员整体升到同一版本线
        const familyAttempt = await attemptFamilyUpgrade(ctx, {
            alert,
            manifestDir,
            alertTargets: familyTargetsByDir.get(manifestDir),
        })
        const memberFamily = familyAttempt.family
        if (familyAttempt.action && familyAttempt.status !== 'applied') {
            ctx.allActions.push(familyAttempt.action)
            if (familyAttempt.status === 'failed') {
                if (familyAttempt.environmental === true) {
                    return true
                }
                if (isAbortRequested()) {
                    return false
                }
                recordUpgradeFailure(ctx, progress, 'member-upgrade', `${alert.packageName} (${memberManifestPath})`, familyAttempt.action.error)
            }
            continue
        }

        const memberResult = familyAttempt.status === 'applied'
            ? familyVersionsOf(familyAttempt, alert)
            : await upgradeDependency({
                packageName: alert.packageName,
                targetVersion: alert.recommendedVersion!,
                workDir: ctx.workDir,
                manifestDir,
            })
        if (!memberResult.success) {
            // 环境性安装失败：不归因仓库，并停止剩余成员尝试（多版本 / 合批 / 分组同口径）
            const environmentalMark = memberResult.environmental === true
                ? markEnvironmentalInstallFailure(ctx, {
                    scope: 'member-upgrade',
                    repository: alert.repository,
                    target: `${alert.packageName} (${memberManifestPath})`,
                    error: memberResult.error,
                })
                : {}
            ctx.allActions.push({
                type: 'dependency-upgrade',
                repository: alert.repository,
                target: alert.packageName,
                fromVersion: memberResult.fromVersion,
                toVersion: alert.recommendedVersion,
                isMajor: memberResult.isMajor,
                strategy: 'member-upgrade',
                success: false,
                error: memberResult.error,
                durationMs: 0,
                filePath: memberManifestPath,
                ...environmentalMark,
            })
            if (memberResult.environmental === true) {
                // 环境已不可用：剩余成员与后续分组链都不再试装（同一次故障重复尝试只会重复失败）
                return true
            }
            // 运行级取消：剩余成员不必逐条试装（每条都会以同一原因失败）
            if (isAbortRequested()) {
                return false
            }
            recordUpgradeFailure(ctx, progress, 'member-upgrade', `${alert.packageName} (${memberManifestPath})`, memberResult.error)
            continue
        }
        const remainingMemberVersions = readLockfileVersions(lockfilePath, alert.packageName)
        const stillVulnerable = remainingMemberVersions.some(
            (v) => compareSemver(v, alert.recommendedVersion!) < 0,
        )
        if (stillVulnerable) {
            restoreTrackedFiles(ctx.workDir, memberSnapshot)
            ctx.allActions.push({
                type: 'dependency-upgrade',
                repository: alert.repository,
                target: alert.packageName,
                fromVersion: memberResult.fromVersion,
                toVersion: alert.recommendedVersion,
                isMajor: false,
                strategy: 'member-upgrade',
                success: false,
                error: 'vulnerable instance(s) remain after member upgrade (root override / other pin); changes rolled back',
                durationMs: 0,
                filePath: memberManifestPath,
            })
            progress.failed++
            ctx.logger.warn(
                `[member-upgrade] ${alert.packageName}: vulnerable instance(s) remain (${remainingMemberVersions.join(', ')}) — rolled back member upgrade in ${memberManifestPath}; residual instance likely pinned by another workspace member / root override, manual review required`,
            )
            continue
        }
        const memberOk = await quickVerifyProject(ctx, repo)
        if (!memberOk) {
            restoreTrackedFiles(ctx.workDir, memberSnapshot)
            ctx.allActions.push({
                type: 'dependency-upgrade',
                repository: alert.repository,
                target: alert.packageName,
                fromVersion: memberResult.fromVersion,
                toVersion: memberResult.toVersion,
                isMajor: memberResult.isMajor,
                strategy: 'member-upgrade',
                success: false,
                error: 'member upgrade failed verification; changes rolled back',
                durationMs: 0,
                filePath: memberManifestPath,
            })
            progress.failed++
            ctx.logger.warn(
                `[member-upgrade] ${alert.packageName}: verification failed — rolled back member upgrade in ${memberManifestPath}`,
            )
            continue
        }
        ctx.allActions.push({
            type: 'dependency-upgrade',
            repository: alert.repository,
            target: alert.packageName,
            fromVersion: memberResult.fromVersion,
            toVersion: memberResult.toVersion,
            isMajor: memberResult.isMajor,
            strategy: 'member-upgrade',
            success: true,
            durationMs: 0,
            filePath: memberManifestPath,
            ...(memberFamily ? { family: memberFamily } : {}),
        })
        progress.fixed++
        ctx.logger.info(`[member-upgrade] ${alert.packageName}: member upgrade passed verification (${memberManifestPath})`)
    }
    return false
}
