// repo-fix-batch.ts — 版本化 overrides 的合批快路径（一次安装）与失败回退。
//
// 动机（2026-10-16 生产复盘）：逐包应用使单仓安装次数 = 可修包数（大仓实测 7–8 次），
// 每次都是完整依赖解析；在资源受限主机上这是内核 OOM 级联的放大器之一。
//
// 语义承诺（合批**只做加速**，不改变可观测语义）：
// - 成功：为每个包各产出一条版本化 override 动作（报告表 / PR 正文 / 内容指纹 / 提交信息
//   的口径与逐包路径完全一致），并计入 fixed
// - 失败（安装失败或组级验证失败）：回滚到合批前快照后返回 `false`，**不**产出动作、
//   不计数、不写审计条目——真实归因交由调用方的逐包路径给出（保持既有失败粒度）
//
// 拆出理由：`repo-fix.ts` 已处 `max-lines` 上限（该文件的既定处置是先拆分再改）。
import type { NormalizedSecurityAlert } from '@dependfix/core'
import { applyVersionedOverridesBatch, type VersionedOverridesPlan } from '../fixers/dependency'
import { quickVerifyProject, restoreTrackedFiles, snapshotTrackedFiles } from '../helpers'
import type { RepoFixCtx, RepoFixProgress } from './repo-fix'

/** 合批条目（一个包一条；`targets` 用于动作的 `toVersion` 展示，与逐包路径同口径）。 */
export interface VersionedOverrideBatchItem {
    alert: NormalizedSecurityAlert
    versionedOverrides: Record<string, string>
    targets: string[]
}

/**
 * 尝试合批应用版本化 overrides（调用方仅在条目数 ≥ 2 时调用）。
 *
 * @returns `true` = 已应用（动作与计数已写入，调用方不得再逐包重试）；
 *          `false` = 未应用（工作区已回滚到合批前，调用方应逐包重试）
 */
export async function tryBatchVersionedOverrides(
    ctx: RepoFixCtx,
    repo: string,
    progress: RepoFixProgress,
    items: VersionedOverrideBatchItem[],
): Promise<boolean> {
    const snapshot = snapshotTrackedFiles(ctx.workDir)
    const packages = items.map((item) => item.alert.packageName)
    ctx.logger.info(
        `[multi-version] 合批 ${items.length} 个包：${packages.join(', ')}（一次安装 + 组级验证）`,
    )

    const result = await applyVersionedOverridesBatch({
        workDir: ctx.workDir,
        plans: items.map((item): VersionedOverridesPlan => ({
            packageName: item.alert.packageName,
            overrides: item.versionedOverrides,
        })),
    })

    if (!result.success) {
        restoreTrackedFiles(ctx.workDir, snapshot)
        ctx.logger.warn(
            `[multi-version] 合批安装失败（${result.error ?? 'no error detail'}）— 已回滚，改为逐包重试`,
        )
        return false
    }

    const groupOk = await quickVerifyProject(ctx, repo)
    if (!groupOk) {
        restoreTrackedFiles(ctx.workDir, snapshot)
        ctx.logger.warn('[multi-version] 合批后组级验证失败 — 已回滚，改为逐包重试（失败点见上方留痕）')
        return false
    }

    for (const item of items) {
        ctx.allActions.push({
            type: 'dependency-upgrade',
            repository: item.alert.repository,
            target: item.alert.packageName,
            fromVersion: '',
            toVersion: item.targets.join(', '),
            isMajor: false,
            strategy: 'versioned-override',
            success: true,
            durationMs: 0,
        })
        progress.fixed++
    }
    ctx.logger.info(`[multi-version] 合批 ${items.length} 个包：versioned overrides passed verification`)
    return true
}
