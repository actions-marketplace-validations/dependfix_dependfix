// skipped-delivery.ts — 交付被跳过时的回滚（从 app/index.ts 拆出以控制文件行数）。
//
// 零修复 / 修复后安装仍既有失败时，工作区可能残留 side-effect 改动（`.gitignore` /
// allowBuilds）。交付既然不发生，就不应把脏工作区留给调用方；运行前已有用户改动时
// 保持原保护面（不自动回滚）。
import { toErrorMessage, type FixError, type Logger } from '@dependfix/core'
import { rollbackChanges } from '../runners/verification-gate'
import { hasGitChanges } from './helpers'

export interface SkippedDeliveryRollbackArgs {
    logger: Logger
    workDir: string
    /** 运行前工作区是否已有用户未提交改动（有则禁止自动回滚）。 */
    preExistingDirty: boolean
    reason: string
}

/** 交付因「修复后安装仍既有失败」被跳过时的统一处置（日志 + 审计 + 回滚）。 */
export function skipDeliveryForInstallFailure(args: {
    logger: Logger
    workDir: string
    preExistingDirty: boolean
    allErrors: FixError[]
    repos: string[]
}): void {
    const { logger, workDir, preExistingDirty, allErrors, repos } = args
    const repoList = repos.join(', ')
    logger.warn(
        `Install verification is still failing (pre-existing) after the fix for ${repoList} `
        + '— skipping delivery; fix the execution environment or target repository lockfile first',
    )
    allErrors.push({
        repository: repoList,
        stage: 'report',
        category: 'PRE_EXISTING_FAILURE',
        message: `Delivery skipped: install verification still failing (pre-existing) for ${repoList}`,
    })
    rollbackForSkippedDelivery({ logger, workDir, preExistingDirty, reason: 'install verification still failing' })
}

/** 交付被跳过时回滚本次运行产生的改动（非 git / 无改动 / 运行前脏工作区时跳过）。 */
export function rollbackForSkippedDelivery(args: SkippedDeliveryRollbackArgs): void {
    const { logger, workDir, preExistingDirty, reason } = args
    if (preExistingDirty || !hasGitChanges(workDir)) {
        return
    }
    try {
        rollbackChanges(workDir)
        logger.info(`Changes rolled back (delivery skipped: ${reason})`)
    } catch (error: unknown) {
        logger.warn(`Rollback after skipped delivery failed: ${toErrorMessage(error)}`)
    }
}
