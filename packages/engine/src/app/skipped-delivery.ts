// skipped-delivery.ts — 交付被跳过时的回滚（从 app/index.ts 拆出以控制文件行数）。
//
// 零修复 / 修复后安装仍既有失败时，工作区可能残留 side-effect 改动（`.gitignore` /
// allowBuilds）。交付既然不发生，就不应把脏工作区留给调用方；运行前已有用户改动时
// 保持原保护面（不自动回滚）。
import {
    toErrorMessage,
    type BaselineRedDelivery,
    type DeliverySkipRecord,
    type FixAction,
    type FixError,
    type Logger,
} from '@dependfix/core'
import type { Octokit } from '@octokit/rest'
import {
    DELIVERY_SKIP_LABEL,
    buildDeliverySkipIssueBody,
    buildDeliverySkipIssueTitle,
    computeDeliverySkipFingerprint,
    createDeliverySkipIssue,
    findDeliverySkipIssue,
} from '../github/delivery-issue'
import { GitCommandError } from '../github/git-run'
import { rollbackChanges } from '../runners/verification-gate'
import { collectFailingInstallCommands, recordDeliverySkip } from './delivery'
import { hasGitChanges } from './helpers'

export interface SkippedDeliveryRollbackArgs {
    logger: Logger
    workDir: string
    /** 运行前工作区是否已有用户未提交改动（有则禁止自动回滚）。 */
    preExistingDirty: boolean
    reason: string
}

/** 交付因「修复后安装仍既有失败」被跳过时的统一处置（日志 + 审计 + 回滚）。 */
export async function skipDeliveryForInstallFailure(args: {
    logger: Logger
    workDir: string
    preExistingDirty: boolean
    allErrors: FixError[]
    repos: string[]
}): Promise<void> {
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
    await rollbackForSkippedDelivery({ logger, workDir, preExistingDirty, reason: 'install verification still failing' })
}

/** 交付被跳过时回滚本次运行产生的改动（非 git / 无改动 / 运行前脏工作区时跳过）。 */
export async function rollbackForSkippedDelivery(args: SkippedDeliveryRollbackArgs): Promise<void> {
    const { logger, workDir, preExistingDirty, reason } = args
    if (preExistingDirty || !hasGitChanges(workDir)) {
        return
    }
    try {
        await rollbackChanges(workDir)
        logger.info(`Changes rolled back (delivery skipped: ${reason})`)
    } catch (error: unknown) {
        // 取消态下不启动回滚子进程：工作区交由调用方清理（与验证门禁同口径）
        if (error instanceof GitCommandError && error.aborted) {
            logger.warn(`Rollback skipped (run aborted before it started): ${reason}`)
            return
        }
        logger.warn(`Rollback after skipped delivery failed: ${toErrorMessage(error)}`)
    }
}

/** 交付降级载体所需的 run 级状态切片（避免依赖完整 `AppContext` 造成循环依赖）。 */
export interface DeliverySkipCarrierTarget {
    logger: Pick<Logger, 'info' | 'warn'>
    runId: string
    deliverySkips?: DeliverySkipRecord[]
}

/**
 * `issue` 档：按失败指纹在落点仓库开 issue（同一指纹只开一次，关闭后不重开）。
 *
 * 载体创建失败只 warn：交付跳过与 exit code 语义不受影响（`PRE_EXISTING_FAILURE` 仍在
 * 跳过类白名单内）。调用方负责此前的回滚；本函数只登记记录 + 产出载体。
 */
export async function deliverSkipIssue(params: {
    target: DeliverySkipCarrierTarget
    octokit: Octokit
    owner: string
    repo: string
    repositories: string[]
    failingCommands: string[]
}): Promise<DeliverySkipRecord> {
    const { target, octokit, owner, repo, repositories, failingCommands } = params
    const fingerprint = computeDeliverySkipFingerprint({ repositories, failingCommands })
    const record = recordDeliverySkip(target, {
        repositories: [...repositories],
        failingCommands: [...failingCommands],
        carrier: { mode: 'issue' },
    })

    try {
        const existing = await findDeliverySkipIssue(octokit, owner, repo, fingerprint)
        if (existing) {
            record.carrier.issue = { ...existing, created: false, fingerprint }
            target.logger.info(
                `Delivery-skip issue already exists for the same failure fingerprint: ${existing.htmlUrl}`,
            )
            return record
        }
        const issue = await createDeliverySkipIssue(octokit, owner, repo, {
            title: buildDeliverySkipIssueTitle(repositories),
            body: buildDeliverySkipIssueBody({
                fingerprint,
                runId: target.runId,
                repositories,
                failingCommands,
            }),
            labels: [DELIVERY_SKIP_LABEL],
        })
        record.carrier.issue = { ...issue, created: true, fingerprint }
        target.logger.info(`Delivery-skip issue created: ${issue.htmlUrl}`)
    } catch (error: unknown) {
        target.logger.warn(
            `Delivery-skip issue creation failed (delivery stays skipped, exit code unchanged): ${toErrorMessage(error)}`,
        )
    }
    return record
}

/** 基线红交付降级的入参（编排层传入 run 状态切片；dry-run 一律按 `skip` 处理）。 */
export interface BaselineRedDeliveryArgs {
    ctx: {
        logger: Logger
        runId: string
        deliverySkips?: DeliverySkipRecord[]
        allActions?: FixAction[]
        allErrors: FixError[]
    }
    config: { onBaselineRed?: BaselineRedDelivery, dryRun: boolean }
    client: Octokit | null
    repositories: string[]
    installBlockedRepos: string[]
    workDir: string
    preExistingDirty: boolean
}

/**
 * 修复后安装仍为既有失败时的交付降级（`DEPENDFIX_ON_BASELINE_RED`）。
 *
 * - `skip`（默认）：审计记录 + 回滚，返回 `continueAsDraft: false`（行为与引入前逐字一致）
 * - `issue`：先按「仓库集 + 失败命令集」指纹开 issue（去重、关闭后不重开），随后仍回滚
 * - `draft`：不回滚，返回 `continueAsDraft: true`——调用方继续 commit / push，PR 以**草稿**创建
 *
 * dry-run / 无落点仓库时一律按 `skip` 处理：dry-run 无交付面可降级，且必须回滚。
 */
export async function handleBaselineRedDelivery(args: BaselineRedDeliveryArgs): Promise<{
    continueAsDraft: boolean
    record?: DeliverySkipRecord
}> {
    const { ctx, config, client, repositories, installBlockedRepos, workDir, preExistingDirty } = args
    const mode = config.onBaselineRed ?? 'skip'
    const failingCommands = collectFailingInstallCommands(ctx.allActions ?? [], installBlockedRepos)
    // 草稿 PR 的落点沿用运行级约定（第一个仓库）；issue 落点取**首先命中的受影响仓库**，
    // 与失败同源——否则仓库顺序变化会让同一指纹的去重扫描落到另一个仓库而重复开 issue
    const firstRepo = repositories[0]
    const issueRepo = installBlockedRepos[0]

    if (mode === 'draft' && !config.dryRun && firstRepo) {
        const record = recordDeliverySkip(ctx, {
            repositories: installBlockedRepos,
            failingCommands,
            carrier: { mode: 'draft' },
        })
        ctx.logger.warn(
            `Install verification is still failing (pre-existing) after the fix for ${installBlockedRepos.join(', ')} `
            + '— continuing with a draft PR (DEPENDFIX_ON_BASELINE_RED=draft); CI will fail with the same pre-existing error',
        )
        return { continueAsDraft: true, record }
    }

    if (mode === 'issue' && !config.dryRun && client && issueRepo) {
        const [owner, repo] = issueRepo.split('/')
        await deliverSkipIssue({
            target: ctx,
            octokit: client,
            owner,
            repo,
            repositories: installBlockedRepos,
            failingCommands,
        })
    } else {
        // `skip`（默认）/ dry-run / 无落点仓库：只记录（载体缺席即「仅报告」档）
        recordDeliverySkip(ctx, { repositories: installBlockedRepos, failingCommands, carrier: { mode: 'skip' } })
    }

    await skipDeliveryForInstallFailure({
        logger: ctx.logger,
        workDir,
        preExistingDirty,
        allErrors: ctx.allErrors,
        repos: installBlockedRepos,
    })
    return { continueAsDraft: false }
}
