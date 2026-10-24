// upgrade-alert.ts — 单个告警的升级执行（常规分组 / 拆组逐包共用）。
//
// 自 helpers.ts 拆出：文件行数治理（max-lines 800）。行为与拆分前一致：
// 家族锁步优先 → 直接升级 → 间接依赖回退 pnpm overrides（含保护名单与审计口径）。
import { toErrorMessage, type FixAction, type NormalizedSecurityAlert } from '@dependfix/core'
import {
    overrideTransitiveDependency,
    upgradeDependency,
    type DependencyFixResult,
} from '../fixers/dependency'
import { markEnvironmentalInstallFailure } from './environmental-failure'
import type { AppContext } from './helpers'
import { handleOverrideProtection } from './override-protect'

/**
 * 升级单个告警对应的依赖（dry-run 仅记录）。
 * 优先家族锁步（同生态成员同版本线），其次直接升级，失败且为间接依赖时回退到 pnpm overrides。
 */
export async function upgradeAlert(
    ctx: Pick<AppContext, 'config' | 'logger' | 'workDir' | 'allErrors' | 'summary'>,
    alert: NormalizedSecurityAlert,
): Promise<FixAction> {
    const { config, logger, workDir } = ctx
    const startMs = Date.now()

    if (config.dryRun) {
        logger.info(`[dry-run] Would upgrade ${alert.packageName} to ${alert.recommendedVersion}`)
        return {
            type: 'dependency-upgrade',
            repository: alert.repository,
            target: alert.packageName,
            fromVersion: alert.recommendedVersion ? `< ${alert.recommendedVersion}` : undefined,
            toVersion: alert.recommendedVersion,
            isMajor: false,
            success: true,
            durationMs: 0,
        }
    }

    try {

        // 优先尝试直接升级，失败自动回退到 overrides（处理间接依赖）
        let result: DependencyFixResult = await upgradeDependency({
            packageName: alert.packageName,
            targetVersion: alert.recommendedVersion,
            workDir,
        })
        let strategy: 'override' | undefined

        if (!result.success && result.error?.includes('not found in dependencies')) {
            // 间接依赖 — 通过 pnpm overrides 升级
            // 先查 overrides 保护名单（repo policy）：命中则不写盘并记审计
            // （防历史上被人工移除的破坏性 override 复发，实证 PR #1095）
            const protectedAction = handleOverrideProtection(ctx, {
                overrideProtect: config.overrideProtect,
                repository: alert.repository,
                packageName: alert.packageName,
                toVersion: alert.recommendedVersion,
                scope: 'override',
            })
            if (protectedAction) {
                return protectedAction
            }
            strategy = 'override'
            result = await overrideTransitiveDependency({
                packageName: alert.packageName,
                targetVersion: alert.recommendedVersion,
                workDir,
            })
            logger.info(
                result.success
                    ? `Upgraded ${result.packageName}: ${result.fromVersion} → ${result.toVersion} (pnpm overrides)`
                    : `Failed to upgrade ${result.packageName}: ${result.error}`,
            )
        } else {
            logger.info(
                result.success
                    ? `Upgraded ${result.packageName}: ${result.fromVersion} → ${result.toVersion}`
                    : `Failed to upgrade ${result.packageName}: ${result.error}`,
            )
        }

        if (result.success && result.warning) {
            logger.warn(`[upgrade] ${result.packageName}: ${result.warning}`)
        }

        // 环境性安装失败不归因目标仓库：记审计条目 + 动作标记，调用方不得计入失败（见记录 §12.16）
        const environmentalMark = !result.success && result.environmental === true
            ? markEnvironmentalInstallFailure(ctx, { scope: 'upgrade', repository: alert.repository, target: alert.packageName, error: result.error })
            : {}

        return {
            type: 'dependency-upgrade',
            repository: alert.repository,
            target: alert.packageName,
            fromVersion: result.fromVersion,
            toVersion: result.toVersion,
            isMajor: result.isMajor,
            strategy,
            success: result.success,
            error: result.error,
            durationMs: Date.now() - startMs,
            ...environmentalMark,
        }
    } catch (error: unknown) {
        const message = toErrorMessage(error)
        logger.error(`Upgrade error for ${alert.packageName}: ${message}`)
        return {
            type: 'dependency-upgrade',
            repository: alert.repository,
            target: alert.packageName,
            toVersion: alert.recommendedVersion,
            success: false,
            error: message,
            durationMs: Date.now() - startMs,
        }
    }
}
