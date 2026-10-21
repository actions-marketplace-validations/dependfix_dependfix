// verification-checkpoint.ts — 验证失败时的单元级回滚 checkpoint。
//
// 背景：修复前基线完整链只解决「既有失败被误归因」；修复后完整验证失败时，旧门禁仍
// `git reset --hard HEAD` 整仓回滚，连带丢弃已经通过 probe 的依赖升级单元（picgo 形态）。
//
// 方案（用户 2026-10-21 确认）：每个依赖修复单元开始前，用 `git stash create`
// 生成一个游离 commit 对象作为工作树 checkpoint（不移动 HEAD / 不新增 ref）；单元成功时保留，
// 最终验证失败时恢复当前仓库最近 checkpoint，截断该单元的动作 / 进度 / summary，并重跑一次完整验证。
// 重验通过 → 保留更早单元继续交付；仍失败 → 记录 ROLLBACK_GRANULARITY_DEGRADED 后退回整仓回滚。
import { execFileSync } from 'node:child_process'
import type { FixAction, RunSummary } from '@dependfix/core'
import type { RepoFixCtx, RepoFixProgress } from './repo-fix'
import { isGitRepository } from './helpers'

/** checkpoint 保存的可恢复状态（只含依赖修复单元会改动的字段）。 */
export interface VerificationCheckpoint {
    /** `git stash create` 返回的 commit hash（游离对象，不挂 ref） */
    id: string
    repository: string
    label: string
    actionsLength: number
    errorsLength: number
    progress: Pick<RepoFixProgress, 'fixed' | 'failed' | 'lockfileRepaired'>
    summary: RunSummary
}

export interface SelectiveRollbackOutcome {
    /** 是否成功恢复 checkpoint（false = 无 checkpoint / 恢复失败 / 已禁用） */
    applied: boolean
    /** 重验后是否仍存在本次引入失败（applied=false 时保持调用方原值） */
    blocking: boolean
    /** 重验产生的验证 actions（由调用方推入 allActions） */
    verifyActions: FixAction[]
    /** 降级 / 未应用原因 */
    reason?: string
}

/** 当前仓库最近一个 checkpoint（按记录顺序）。 */
export const findLatestVerificationCheckpoint = (
    ctx: Pick<RepoFixCtx, 'verificationCheckpoints'>,
    repository: string,
): VerificationCheckpoint | undefined => {
    const checkpoints = ctx.verificationCheckpoints ?? []
    for (let i = checkpoints.length - 1; i >= 0; i--) {
        if (checkpoints[i]!.repository === repository) {
            return checkpoints[i]
        }
    }
    return undefined
}

/**
 * 记录单元开始前 checkpoint（成功时保留为可回退基线）。仅在 `rollbackGranularity=unit` 且非 dry-run 时生效。
 * `git stash create` 只捕获已跟踪文件；未跟踪文件（如 AI 新建源码）不在本批范围。
 * 工作区干净时回退到 HEAD，保证首个单元也有可回退基线。
 */
export const recordVerificationCheckpoint = (
    ctx: RepoFixCtx,
    repo: string,
    progress: RepoFixProgress,
    label: string,
): VerificationCheckpoint | undefined => {
    if (ctx.config.dryRun || (ctx.config.rollbackGranularity ?? 'unit') !== 'unit' || !ctx.verificationCheckpoints) {
        return undefined
    }
    // 非 git 工作区没有 HEAD / 索引语义，checkpoint 不可用；不刷 warning（测试 / 非 git 目录常见）
    if (!isGitRepository(ctx.workDir)) {
        return undefined
    }
    try {
        let id = execFileSync(
            'git',
            ['stash', 'create', `dependfix:${repo}:${label}`],
            { cwd: ctx.workDir, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] },
        ).trim()
        if (!id) {
            // 工作区干净时 stash create 返回空串：用 HEAD 作为 checkpoint（回退首个单元时即回到基线）
            id = execFileSync('git', ['rev-parse', 'HEAD'], {
                cwd: ctx.workDir,
                encoding: 'utf-8',
                stdio: ['ignore', 'pipe', 'pipe'],
            }).trim()
        }
        if (!id) {
            return undefined
        }
        const checkpoint: VerificationCheckpoint = {
            id,
            repository: repo,
            label,
            actionsLength: ctx.allActions.length,
            errorsLength: ctx.allErrors.length,
            progress: {
                fixed: progress.fixed,
                failed: progress.failed,
                lockfileRepaired: progress.lockfileRepaired,
            },
            summary: structuredClone(ctx.summary),
        }
        ctx.verificationCheckpoints.push(checkpoint)
        return checkpoint
    } catch (error) {
        ctx.logger.warn(`[rollback] failed to create verification checkpoint for ${repo} (${label}): ${error instanceof Error ? error.message : String(error)}`)
        return undefined
    }
}

/** 恢复 checkpoint：工作树 / 暂存区回到 checkpoint，HEAD 不变。 */
const restoreCheckpoint = (ctx: RepoFixCtx, checkpoint: VerificationCheckpoint): void => {
    execFileSync('git', ['read-tree', '--reset', '-u', checkpoint.id], {
        cwd: ctx.workDir,
        stdio: 'pipe',
    })
}

const restoreProgressAndActions = (
    ctx: RepoFixCtx,
    progress: RepoFixProgress,
    checkpoint: VerificationCheckpoint,
): void => {
    ctx.allActions.length = checkpoint.actionsLength
    ctx.allErrors.length = checkpoint.errorsLength
    progress.fixed = checkpoint.progress.fixed
    progress.failed = checkpoint.progress.failed
    progress.lockfileRepaired = checkpoint.progress.lockfileRepaired
    Object.assign(ctx.summary, structuredClone(checkpoint.summary))
}

const recordDegraded = (ctx: RepoFixCtx, repo: string, reason: string): void => {
    ctx.logger.warn(
        `[rollback] ${repo}: unit-level rollback degraded to repo-level — ${reason}`,
    )
    ctx.allErrors.push({
        repository: repo,
        stage: 'verify',
        category: 'ROLLBACK_GRANULARITY_DEGRADED',
        message: `Unit-level rollback degraded to repository-level rollback: ${reason}`,
    })
}

/**
 * 尝试回退当前仓库最近一个成功单元并重跑一次完整验证。
 *
 * 调用方仅在首次完整验证存在 `verificationBlocking=true` 时调用。
 * 语义：
 * - 无 checkpoint / 禁用 / 恢复失败 → applied=false，调用方保持原状态，由门禁整仓回滚
 * - 恢复成功且重验通过 → applied=true, blocking=false，保留更早单元
 * - 恢复成功但重验仍失败 → applied=true, blocking=true，记降级审计，门禁整仓回滚
 */
export const attemptSelectiveUnitRollback = async (
    ctx: RepoFixCtx,
    repo: string,
    progress: RepoFixProgress,
    verify: () => Promise<FixAction[]>,
    options: { beforeVerify?: () => Promise<void> } = {},
): Promise<SelectiveRollbackOutcome> => {
    if ((ctx.config.rollbackGranularity ?? 'unit') !== 'unit') {
        return { applied: false, blocking: true, verifyActions: [], reason: 'rollback granularity is repo' }
    }
    const checkpoint = findLatestVerificationCheckpoint(ctx, repo)
    if (!checkpoint) {
        recordDegraded(ctx, repo, 'no unit checkpoint available')
        return { applied: false, blocking: true, verifyActions: [], reason: 'no unit checkpoint available' }
    }

    // checkpoint 记录在单元开始前；若之后有失败单元，progress.failed / errors 会增长。
    // 此时回退会抹掉失败单元的审计，改用整仓回滚（成功单元的 actions 会被截断，属预期）。
    if (ctx.allErrors.length !== checkpoint.errorsLength || progress.failed !== checkpoint.progress.failed) {
        recordDegraded(
            ctx,
            repo,
            'later audit entries / failed outcomes exist after the latest checkpoint; selective rollback would lose failure audit',
        )
        return {
            applied: false,
            blocking: true,
            verifyActions: [],
            reason: 'later failed unit outcomes after checkpoint',
        }
    }

    try {
        restoreCheckpoint(ctx, checkpoint)
        restoreProgressAndActions(ctx, progress, checkpoint)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        recordDegraded(ctx, repo, `checkpoint restore failed: ${message}`)
        return { applied: false, blocking: true, verifyActions: [], reason: `checkpoint restore failed: ${message}` }
    }

    ctx.logger.info(
        `[rollback] ${repo}: restored checkpoint before "${checkpoint.label}" — re-running full verification`,
    )
    let verifyActions: FixAction[]
    try {
        if (options.beforeVerify) {
            await options.beforeVerify()
        }
        verifyActions = await verify()
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        recordDegraded(ctx, repo, `verification callback failed after checkpoint restore: ${message}`)
        return { applied: false, blocking: true, verifyActions: [], reason: `verification callback failed: ${message}` }
    }
    const blocking = verifyActions.some((action) => !action.success && !action.preExisting)
    if (blocking) {
        recordDegraded(
            ctx,
            repo,
            `full verification still failing after reverting the latest unit "${checkpoint.label}"`,
        )
        return { applied: true, blocking: true, verifyActions, reason: 're-verification still blocking' }
    }

    ctx.logger.info(
        `[rollback] ${repo}: selective rollback applied — earlier verified units preserved (reverted "${checkpoint.label}")`,
    )
    return { applied: true, blocking: false, verifyActions }
}
