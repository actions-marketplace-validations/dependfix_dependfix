import { join } from 'node:path'
import type { Octokit } from '@octokit/rest'
import {
    filterAlerts,
    limitAlerts,
    prioritizeAlerts,
    toErrorMessage,
    type AiUsageAggregate,
    type FixAction,
    type NormalizedSecurityAlert,
} from '@dependfix/core'
import {
    applyVersionedOverrides,
    compareSemver,
    isCrossMajorFixRequired,
    readExistingOverrides,
    readLockfileVersions,
    upgradeDependency,
} from '../fixers/dependency'
import { runAiIntegration } from '../ai/app-integration'
import {
    dedupeFixableAlerts,
    isRootDirectDependency,
    partitionSubmanifestAlerts,
    quickVerifyProject,
    restoreTrackedFiles,
    snapshotTrackedFiles,
    type MemberManifestAlert,
} from '../helpers'
import { buildUpgradeGroups } from '../grouping'
import type { CommandResult } from '../runners/verification-runner'
import { isAbortRequested } from '../runners/process-control'
import { handleOverrideProtection } from './override-protect'
import {
    buildVersionedOverrides,
    mergeAiUsage,
    runCodeScanningFixes,
    upgradeAlert,
    type AppContext,
} from './helpers'
import { verifyProject } from './verify-project'
import { applyMemberUpgrades } from './repo-fix-member'
import { tryBatchVersionedOverrides, type VersionedOverrideBatchItem } from './repo-fix-batch'
import { fetchDefaultBranch, fetchRepoAlerts, truncatedWarning } from './repo-alerts'
import { alertsFetchTokenHint } from './token-hints'
import { recordUpgradeFailure } from './upgrade-failure'
import { ensureVerificationBaseline, finalizeRepoFix, recordInstallBaselineFailure } from './repo-fix-finalize'

// ---------------------------------------------------------------------------
// 单仓库修复管线（fix / fix-and-pr 模式共用）
//
// 自 app/index.ts 拆出（文件行数 + max-lines-per-function 治理）：
// 原 DependfixApp.processRepoForFix（681 行）按阶段拆为独立步骤函数，
// 上下文用 AppContext 切片，过程状态经 RepoFixProgress 显式传递。
// ---------------------------------------------------------------------------

/** 单仓库修复过程状态（跨步骤显式传递，避免隐式共享）。 */
export interface RepoFixProgress {
    alertsCount: number
    fixable: number
    fixed: number
    failed: number
    lockfileRepaired: boolean
    verificationPassed: boolean | undefined
    /** 是否存在本次改动引入的验证失败（决定交付回滚；见 RepositoryResult.verificationBlocking） */
    verificationBlocking: boolean | undefined
    defaultBranch: string
}

/** run 级 AI 用量聚合的可变引用（步骤内 merge 后回写，报告 aiUsage 段数据源）。 */
export interface AiUsageRef {
    aggregate: AiUsageAggregate | undefined
}

/** 修复管线上下文 = AppContext + AI 用量引用（避免步骤函数参数超限）。 */
export interface RepoFixCtx extends AppContext {
    aiUsageRef: AiUsageRef
    /**
     * 运行级「修复前验证基线」持有器（由 index.ts 在运行开始时创建，跨仓库复用同一对象）。
     *
     * - 首个**有工作的仓库**处惰性采样一次（修复前 pristine 工作区）；零告警仓库不采样——
     *   其验证失败按「无改动即豁免」处理（口径见 docs/design/modules/dependency-fixer-records.md §12.9）
     * - 多仓库共享同一 workDir（就地修复）时沿用首采结果——与既有 `preExistingDirty`
     *   的运行级语义一致；多仓库场景的粒度局限同 `verification-gate.ts` 所述（按 run 级归因，无法逐仓库区分）
     * - 未提供（如测试直接构造 ctx）⇒ 不采样，退回原始「全量归因」口径
     */
    /** `repo` = 采样时的仓库（运行级首采只对采样仓库自身可信，多仓复用不用于快速失败判定） */
    verificationBaseline?: { repo?: string, value?: CommandResult[] }
}

/** lockfile 依赖告警分区产物（供 lockfile / 成员 / 常规升级步骤共用）。 */
export interface LockfileAlertSets {
    rootManifestAlerts: NormalizedSecurityAlert[]
    memberManifestAlerts: MemberManifestAlert[]
    lockfilePath: string
}

/**
 * 单仓库修复管线编排器（原 processRepoForFix）：
 * 抓取 → 模板修复 → lockfile 脆弱实例（版本化 overrides / 跨线 / 成员）→
 * 常规分组升级 → lockfile repair → 验证；失败不中断（逐仓库隔离），
 * 结果写入 repoResults（durationMs = 全程耗时）。
 */
export async function processRepoFix(
    ctx: RepoFixCtx,
    client: Octokit | null,
    repo: string,
): Promise<void> {
    const startTime = Date.now()
    const progress: RepoFixProgress = {
        alertsCount: 0,
        fixable: 0,
        fixed: 0,
        failed: 0,
        lockfileRepaired: false,
        verificationPassed: undefined,
        verificationBlocking: undefined,
        defaultBranch: '',
    }

    try {
        // 只读抓取前置（不写工作区）：本仓库是否有工作决定是否付一次修复前基线验证链——
        // 零告警仓库无任何写操作，其验证失败在 pristine 工作区下必然也是既有失败（判定见 ensureVerificationBaseline）
        const alertInputs = await fetchRepoFixInputs(ctx, client, repo, progress)
        // 修复前按需采样验证基线（首个有工作的仓库处采样，在任何改动之前；用于区分「本次引入」与「既有」失败）
        const { exemptAttribution, baseline } = await ensureVerificationBaseline(ctx, repo, { hasWork: alertInputs.length > 0 })
        // pristine 安装失败 ⇒ overrides 安装必然同因失败；逐包重试只会耗尽预算，写盘前快速失败
        const installBaselineFailure = recordInstallBaselineFailure(ctx, repo, baseline)
        const sets = await prepareRepoFixSets(ctx, repo, alertInputs, progress)
        if (installBaselineFailure) {
            ctx.logger.warn(`[multi-version] ${repo}: dependency upgrade chain skipped (pristine install baseline failed)`)
        } else {
            const { singleVersionAlerts, stopReason } = await applyLockfileFixes(ctx, client, repo, sets, progress)
            if (stopReason) {
                ctx.logger.warn(
                    `[multi-version] ${repo}: dependency install chain stopped (${stopReason}) `
                    + '— skipping member/group upgrades',
                )
            } else {
                await applyMemberUpgrades(ctx, repo, sets, progress)
                await applyGroupUpgrades(ctx, repo, sets, singleVersionAlerts, progress)
            }
        }
        await finalizeRepoFix(ctx, repo, progress, { exemptAttribution })
    } catch (error: unknown) {
        const message = toErrorMessage(error)
        const hint = alertsFetchTokenHint(error)
        ctx.logger.error(`Failed to process ${repo}: ${message}${hint ? ` — ${hint}` : ''}`)
        ctx.allErrors.push({
            repository: repo,
            stage: 'fix',
            category: 'PROCESS_FAILED',
            message: hint ? `${message}（${hint}）` : message,
        })
    }

    ctx.repoResults.push({
        repository: repo,
        defaultBranch: progress.defaultBranch,
        alertsCount: progress.alertsCount,
        fixable: progress.fixable,
        fixed: progress.fixed,
        failed: progress.failed,
        lockfileRepaired: progress.lockfileRepaired,
        verificationPassed: progress.verificationPassed,
        verificationBlocking: progress.verificationBlocking,
        durationMs: Date.now() - startTime,
    })
}

/**
 * 步骤 1a（只读抓取，不写工作区）：双源告警抓取 → 过滤 → 优先级 → 截断提示 → 默认分支。
 *
 * 拆出理由：调用方需要在「本仓库是否值得付一次修复前基线验证链」的判定之前拿到告警面——
 * 零告警仓库无任何写操作，其验证失败在 pristine 工作区下必然也是既有失败，无需采样
 * （判定见 `ensureVerificationBaseline`；口径见 docs/design/modules/dependency-fixer-records.md 验证链章节）。
 *
 * @returns 限流后的告警（含 Code Scanning 源；后续步骤共用）
 */
async function fetchRepoFixInputs(
    ctx: RepoFixCtx,
    client: Octokit | null,
    repo: string,
    progress: RepoFixProgress,
): Promise<NormalizedSecurityAlert[]> {
    // 1. Fetch alerts（双源：github-dependabot 走 alertsToken / pnpm-audit 本地回退）
    const rawAlerts = await fetchRepoAlerts(ctx, repo)
    const { filtered } = filterAlerts(rawAlerts, { severityThreshold: ctx.config.severityThreshold })
    const prioritized = prioritizeAlerts(filtered)
    const { limited, truncated } = limitAlerts(prioritized, ctx.config.maxAlertsPerRepository)
    if (truncated.length > 0) {
        ctx.summary.alertsTruncated += truncated.length
        ctx.logger.warn(truncatedWarning(ctx.config, truncated.length))
    }
    progress.alertsCount = limited.length
    progress.fixable = limited.filter((a) => a.fixable).length

    const [owner, name] = repo.split('/')
    progress.defaultBranch = await fetchDefaultBranch(client, owner, name)

    ctx.allAlerts.push(...limited)

    return limited
}

/**
 * 步骤 1b（写盘段）：Code Scanning 模板修复 → 依赖告警分区。
 * @returns 依赖告警分区产物（root/member/lockfilePath）
 */
async function prepareRepoFixSets(
    ctx: RepoFixCtx,
    repo: string,
    limited: NormalizedSecurityAlert[],
    progress: RepoFixProgress,
): Promise<LockfileAlertSets> {
    // 2.0 Code Scanning 模板修复（A 类白名单；与依赖升级链路并行、互不干扰）
    // 逐告警：快照 → 应用模板 → quickVerify（lint）→ 失败回滚（不静默）
    const csCounts = await runCodeScanningFixes(ctx, repo, limited)
    progress.fixed += csCounts.fixed
    progress.failed += csCounts.failed

    // 2.1 子目录 / 根直接依赖 lockfile 告警（防护：docs vite 告警曾误降级根 vite@8→6）→ 剔除修复链路
    // 收尾审查遗留修复：code-scanning 告警（manifestPath 为源码路径）不参与依赖清单分区，
    // 避免全部落 sub 桶产生 skip 计数噪音（其可见性由 §Code Scanning Suggestions 承担）
    const dependencyAlerts = limited.filter((a) => a.source !== 'code-scanning')
    const { root: rootManifestAlerts, member: memberManifestAlerts, sub: submanifestAlerts } = partitionSubmanifestAlerts(dependencyAlerts, ctx.workDir)
    if (submanifestAlerts.length > 0) {
        ctx.logger.warn(
            `[alerts] ${submanifestAlerts.length} alert(s) from sub-directory / root-direct-dep manifest(s) skipped — manual review required: ${submanifestAlerts.map((a) => `${a.packageName} (${a.manifestPath})`).join(', ')}`,
        )
        ctx.summary.alertsSkipped += submanifestAlerts.length
    }

    return {
        rootManifestAlerts,
        memberManifestAlerts,
        lockfilePath: join(ctx.workDir, 'pnpm-lock.yaml'),
    }
}

/**
 * 步骤 2：lockfile 脆弱实例修复链（独立于分组升级，避免全局覆盖误伤根声明）。
 * - 2.0.1 版本化 overrides（多 major 共存 / 同 major 多小版本）
 * - 2.0.2 跨线升级（--allow-major-upgrade 显式授权；仅根直接依赖 + 单版本）
 *
 * @returns 常规链路单版本告警（供步骤 4 分组升级，排除多版本/跨线避免重复处理）
 */
async function applyLockfileFixes(
    ctx: RepoFixCtx,
    client: Octokit | null,
    repo: string,
    sets: LockfileAlertSets,
    progress: RepoFixProgress,
): Promise<{ singleVersionAlerts: NormalizedSecurityAlert[], stopReason?: 'environmental' | 'aborted' }> {
    const { rootManifestAlerts, lockfilePath } = sets
    let stopReason: 'environmental' | 'aborted' | undefined

    const lockfileManifestAlerts = rootManifestAlerts.filter(
        (a) => a.source !== 'code-scanning' && a.manifestPath.trim().replace(/\\/g, '/') === 'pnpm-lock.yaml'
            && a.fixable && a.recommendedVersion,
    )
    const allCrossMajorAlerts = lockfileManifestAlerts.filter((a) => isCrossMajorFixRequired(lockfilePath, a))
    const manualCrossMajorAlerts = allCrossMajorAlerts.filter(
        (a) => !(ctx.config.allowMajorUpgrade
            && isRootDirectDependency(ctx.workDir, a.packageName)
            && readLockfileVersions(lockfilePath, a.packageName).length === 1),
    )
    const autoMajorAlertIds = new Set(
        allCrossMajorAlerts.filter((a) => !manualCrossMajorAlerts.some((m) => m.id === a.id)).map((a) => a.id),
    )
    const crossMajorAlertIds = new Set(manualCrossMajorAlerts.map((a) => a.id))
    if (manualCrossMajorAlerts.length > 0) {
        ctx.logger.warn(
            `[alerts] ${manualCrossMajorAlerts.length} alert(s) require a cross-major upgrade (no fix within the installed major line) — manual review required: ${manualCrossMajorAlerts.map((a) => `${a.packageName} → ${a.recommendedVersion}`).join(', ')}`,
        )
        ctx.summary.alertsSkipped += manualCrossMajorAlerts.length
    }
    const autoMajorAlerts = lockfileManifestAlerts.filter((a) => autoMajorAlertIds.has(a.id))
    const fixableLockfileAlerts = lockfileManifestAlerts.filter(
        (a) => !crossMajorAlertIds.has(a.id) && !autoMajorAlertIds.has(a.id),
    )
    // 按包分组，构建 overrides（key 形式由大版本冲突判定决定：
    // 真实多 major 共存 → `pkg@major` 版本化；单 major → 无版本号 `pkg`，
    // 2026-08-09 复盘）；与已有 overrides 条目协同取 max，不丢不改写已有条目。
    // 非空即存在脆弱实例 → 进入 2.0.1
    const existingOverrides = readExistingOverrides(ctx.workDir)
    const versionedOverridesByPackage = new Map<string, Record<string, string>>()
    for (const alert of fixableLockfileAlerts) {
        if (!versionedOverridesByPackage.has(alert.packageName)) {
            const packageAlerts = fixableLockfileAlerts.filter((a) => a.packageName === alert.packageName)
            versionedOverridesByPackage.set(
                alert.packageName,
                buildVersionedOverrides(lockfilePath, packageAlerts, existingOverrides),
            )
        }
    }
    const multiVersionPackages = new Set(
        [...versionedOverridesByPackage.entries()]
            .filter(([, overrides]) => Object.keys(overrides).length > 0)
            .map(([packageName]) => packageName),
    )
    const multiVersionAlerts = fixableLockfileAlerts.filter((a) => multiVersionPackages.has(a.packageName))
    const multiVersionAlertIds = new Set(multiVersionAlerts.map((a) => a.id))
    const singleVersionAlerts = rootManifestAlerts.filter(
        (a) => !multiVersionAlertIds.has(a.id) && !crossMajorAlertIds.has(a.id) && !autoMajorAlertIds.has(a.id),
    )

    const upgradedMultiVersion = new Set<string>()
    const batchItems: VersionedOverrideBatchItem[] = []
    for (const alert of multiVersionAlerts) {
        if (upgradedMultiVersion.has(alert.packageName)) {
            continue
        }
        upgradedMultiVersion.add(alert.packageName)
        const protectedAction = handleOverrideProtection(ctx, {
            overrideProtect: ctx.config.overrideProtect,
            repository: alert.repository,
            packageName: alert.packageName,
            toVersion: alert.recommendedVersion,
            scope: 'versioned-override',
        })
        if (protectedAction) {
            ctx.allActions.push(protectedAction)
            continue
        }
        const versionedOverrides = versionedOverridesByPackage.get(alert.packageName) ?? {}
        const targets = Object.values(versionedOverrides)
        const targetSummary = targets.length > 0 ? targets.join(', ') : alert.recommendedVersion
        if (ctx.config.dryRun) {
            // dry-run 不写盘：仅记录计划动作（与 upgradeAlert 的 dry-run 语义一致）
            ctx.logger.info(`[dry-run] Would apply versioned overrides for ${alert.packageName}`, { overrides: versionedOverrides })
            ctx.allActions.push({
                type: 'dependency-upgrade',
                repository: alert.repository,
                target: alert.packageName,
                fromVersion: '',
                toVersion: targetSummary,
                isMajor: false,
                strategy: 'versioned-override',
                success: true,
                durationMs: 0,
            })
            progress.fixed++
            continue
        }
        if (Object.keys(versionedOverrides).length === 0) {
            ctx.logger.info(`Skipping ${alert.packageName}: no vulnerable instances below targets`)
            ctx.summary.alertsConverged++
            continue
        }
        batchItems.push({ alert, versionedOverrides, targets })
    }

    // 合批快路径（≥2 个包）：把 K 次完整安装压到 1 次；失败则回滚并由下方逐包路径重试。
    // 环境性失败（信号 / 超时）例外：逐包重试只会重复同一失败并耗尽单仓预算，直接跳过。
    const batchOutcome = batchItems.length > 1
        ? await tryBatchVersionedOverrides(ctx, repo, progress, batchItems)
        : { applied: false }
    const itemsToRetry = batchOutcome.applied || batchOutcome.skipSequential ? [] : batchItems

    if (batchOutcome.skipSequential) {
        stopReason = isAbortRequested() ? 'aborted' : 'environmental'
        return { singleVersionAlerts, stopReason }
    }

    for (const { alert, versionedOverrides } of itemsToRetry) {
        // 运行级取消（合批失败后的回退路径可能在中止后才走到）：不再逐个试装——
        // 取消态下每条都会以同一原因失败，产出 K 条「失败动作」只污染报告且无归因价值
        if (isAbortRequested()) {
            stopReason = 'aborted'
            break
        }
        const snapshot = snapshotTrackedFiles(ctx.workDir)
        ctx.logger.info(`[multi-version] ${alert.packageName}: applying versioned overrides`, { overrides: versionedOverrides })
        const result = await applyVersionedOverrides({
            packageName: alert.packageName,
            versionedOverrides,
            workDir: ctx.workDir,
        })
        if (result.success && result.warning) {
            ctx.logger.warn(`[multi-version] ${alert.packageName}: ${result.warning}`)
        }
        const action: FixAction = {
            type: 'dependency-upgrade',
            repository: alert.repository,
            target: alert.packageName,
            fromVersion: '',
            toVersion: result.toVersion,
            isMajor: false,
            strategy: 'versioned-override',
            success: result.success,
            error: result.error,
            durationMs: 0,
        }
        if (!result.success) {
            if (isAbortRequested()) {
                stopReason = 'aborted'
                break
            }
            if (result.environmental) {
                // 环境级失败（OOM / 超时）：不产出失败动作 / 不计入 alertsFailed（与合批路径同口径），
                // 记非归因审计条目后停止本仓库剩余安装尝试（含成员 / 分组升级）。
                ctx.allErrors.push({
                    repository: alert.repository,
                    target: alert.packageName,
                    stage: 'fix',
                    category: 'ENVIRONMENT_ERROR',
                    message: `install failed (environmental): ${result.error ?? 'no error detail'}`,
                })
                ctx.logger.warn(`[multi-version] ${alert.packageName}: environmental install failure — stopping further dependency install attempts`)
                stopReason = 'environmental'
                break
            }
            ctx.allActions.push(action)
            recordUpgradeFailure(ctx, progress, 'multi-version', alert.packageName, result.error)
            continue
        }
        // 组级快速验证：lint 通过 → 保留；失败 → 回滚
        const groupOk = await quickVerifyProject(ctx, repo)
        if (groupOk) {
            ctx.allActions.push(action)
            progress.fixed++
            ctx.logger.info(`[multi-version] ${alert.packageName}: versioned overrides passed verification`)
        } else {
            restoreTrackedFiles(ctx.workDir, snapshot)
            action.success = false
            action.error = 'lint failed after versioned overrides; changes rolled back'
            ctx.allActions.push(action)
            progress.failed++
            ctx.logger.warn(`[multi-version] ${alert.packageName}: verification failed — rolled back versioned overrides`)
        }
    }

    if (stopReason) {
        return { singleVersionAlerts, stopReason }
    }

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
        ctx.logger.warn(
            `[major-upgrade] ${alert.packageName}: applying cross-major upgrade → ${alert.recommendedVersion} (explicit --allow-major-upgrade; full verification required)`,
        )
        const majorResult = await upgradeDependency({
            packageName: alert.packageName,
            targetVersion: alert.recommendedVersion!,
            workDir: ctx.workDir,
        })
        if (!majorResult.success) {
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
            })
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
        const majorVerifyActions = await verifyProject(ctx, repo)
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

    return { singleVersionAlerts }
}


/**
 * 步骤 4：常规分组升级（组级验证失败 → 整组回滚 → 拆组逐个重试；
 * 当前版本 >= 目标时跳过，不降级保护）。末尾统计 skipped 差额。
 */
async function applyGroupUpgrades(
    ctx: RepoFixCtx,
    repo: string,
    sets: LockfileAlertSets,
    singleVersionAlerts: NormalizedSecurityAlert[],
    progress: RepoFixProgress,
): Promise<void> {
    if (isAbortRequested()) {
        return
    }
    const { lockfilePath } = sets

    const fixableAlerts = dedupeFixableAlerts(
        singleVersionAlerts.filter((a) => a.fixable && a.recommendedVersion),
    )

    const { groups, cleanupCandidates } = buildUpgradeGroups(fixableAlerts, {
        workDir: ctx.workDir,
        explicitGroups: ctx.config.upgradeGroups,
    })
    for (const group of groups) {
        ctx.logger.info(`[group] ${group.name} (${group.source}): ${group.packages.join(', ')}`)
    }
    if (cleanupCandidates.length > 0) {
        ctx.logger.warn(
            `[group] orphan @types detected (main package removed) — not upgrading, consider removal: ${cleanupCandidates.join(', ')}`,
        )
    }

    const alertByPackage = new Map(fixableAlerts.map((a) => [a.packageName, a]))
    let snapshot: ReturnType<typeof snapshotTrackedFiles>

    for (const group of groups) {
        snapshot = snapshotTrackedFiles(ctx.workDir)

        const pendingActions: FixAction[] = []
        const upgradedInGroup: NormalizedSecurityAlert[] = []

        for (const packageName of group.packages) {
            const alert = alertByPackage.get(packageName)
            if (!alert) {
                continue
            }

            // 收敛判定分三种形态（2026-10-18 cookie-cloudflare undici 实证）：
            // - 最高实例 >= 目标且全部实例 >= 目标 → 已收敛
            // - 最高实例 >= 目标但仍有低实例 → 不能算已收敛（低 major / 其它 manifest），
            //   默认不跨 major 自动覆盖，按人工 review 计
            // - 最高实例 < 目标 → 走常规升级（no-downgrade 保护只在最高实例已达标时生效）
            const lockedVersions = readLockfileVersions(lockfilePath, alert.packageName)
            const highestVersion = lockedVersions.at(-1)
            if (highestVersion !== undefined && compareSemver(highestVersion, alert.recommendedVersion) >= 0) {
                const belowTarget = lockedVersions.filter(
                    (version) => compareSemver(version, alert.recommendedVersion) < 0,
                )
                if (belowTarget.length === 0) {
                    ctx.logger.info(
                        `Skipping ${alert.packageName}: all locked versions ${lockedVersions.join(', ')} >= target ${alert.recommendedVersion} (no upgrade needed)`,
                    )
                    ctx.summary.alertsConverged++
                    continue
                }
                ctx.logger.warn(
                    `Skipping ${alert.packageName}: locked instance(s) ${belowTarget.join(', ')} remain below target ${alert.recommendedVersion} `
                    + '(lower-major / different manifest instance; cross-major upgrade or manual review required)',
                )
                ctx.summary.alertsSkipped++
                continue
            }
            if (lockedVersions.length === 0) {
                ctx.logger.warn(
                    `Could not resolve current version of ${alert.packageName} from lockfile — no-downgrade protection inactive`,
                )
            }

            const action = await upgradeAlert(ctx, alert)
            pendingActions.push(action)
            if (!action.success) {
                progress.failed++
                continue
            }
            if (action.noOp) {
                continue
            }
            if (ctx.config.dryRun) {
                progress.fixed++
                continue
            }
            upgradedInGroup.push(alert)
        }

        if (ctx.config.dryRun || upgradedInGroup.length === 0) {
            ctx.allActions.push(...pendingActions)
            continue
        }

        const groupOk = await quickVerifyProject(ctx, repo)
        if (groupOk) {
            ctx.allActions.push(...pendingActions)
            progress.fixed += upgradedInGroup.length
            ctx.logger.info(
                `[group] ${group.name}: ${upgradedInGroup.length} upgrade(s) passed group verification`,
            )
            snapshot = snapshotTrackedFiles(ctx.workDir)
            continue
        }

        restoreTrackedFiles(ctx.workDir, snapshot)
        ctx.logger.warn(
            `[group] ${group.name}: group verification failed — rolling back group, retrying per-package`,
        )

        for (const action of pendingActions) {
            if (!action.success) {
                ctx.allActions.push(action)
            }
        }

        for (const alert of upgradedInGroup) {
            const action = await upgradeAlert(ctx, alert)
            ctx.allActions.push(action)
            if (!action.success) {
                progress.failed++
                continue
            }
            if (action.noOp) {
                continue
            }
            const quickOk = await quickVerifyProject(ctx, repo)
            if (!quickOk) {
                restoreTrackedFiles(ctx.workDir, snapshot)
                ctx.logger.warn(
                    `Rolled back ${alert.packageName} upgrade: per-package verification failed (see the [quick-verify] log for the failing command)`,
                )
                action.success = false
                action.error = 'lint failed after upgrade; per-package verification failed, changes rolled back'
                progress.failed++
                continue
            }
            progress.fixed++
            snapshot = snapshotTrackedFiles(ctx.workDir)
        }
    }

    const skippedCount = singleVersionAlerts.length - fixableAlerts.length
    ctx.summary.alertsSkipped += skippedCount
}
