/**
 * 环境性安装失败的归因落点（升级链各接线点的统一入口）。
 *
 * 语义：安装被信号杀死 / 超时 / 无 stderr 诊断时，失败无法归因目标仓库——调用方必须把
 * `FixAction.environmentalFailure` 置真，并**不得**计入失败计数（`computeSummary` 跳过该标记、
 * `computeExitCode` 的 `hasFailures` 排除该标记、`ENVIRONMENT_ERROR` 属于跳过类审计类别）。
 *
 * 为什么集中在这里：常规分组 / 拆组逐包 / 跨线 / 成员四个接线点各写一份审计条目会出现 message
 * 形态与 `stage` 漂移，进而让平台侧按类别过滤的统计与告警账目对不上。多版本逐包与合批仍是
 * 既有内联写法（一次安装覆盖多包，message 带 `batch` 前缀），口径见 §12.11。
 *
 * 口径见 docs/design/modules/dependency-fixer-records.md §12.16。
 */
import type { AppContext } from './helpers'

/** 环境性安装失败的标记片段（供调用方并入 `FixAction`）。 */
export interface EnvironmentalFailureMark {
    environmentalFailure: true
}

/**
 * 记一条 `ENVIRONMENT_ERROR` 审计条目并返回动作标记。
 *
 * @param ctx - 需 `logger` 与 `allErrors`（审计条目是 `environmentalFailures` 计数的唯一来源）
 * @param params.scope - 日志前缀（`upgrade` / `major-upgrade` / `member-upgrade` 等）
 * @param params.repository - 仓库（`owner/name`）
 * @param params.target - 失败对象（包名，必要时带 manifest 路径）
 * @param params.error - 失败文本；空值时以 `no error detail` 占位
 */
export function markEnvironmentalInstallFailure(
    ctx: Pick<AppContext, 'logger' | 'allErrors'>,
    params: { scope: string, repository: string, target: string, error?: string },
): EnvironmentalFailureMark {
    const detail = params.error || 'no error detail'
    ctx.allErrors.push({
        repository: params.repository,
        target: params.target,
        stage: 'fix',
        category: 'ENVIRONMENT_ERROR',
        message: `install failed (environmental): ${detail}`,
    })
    ctx.logger.warn(
        `[${params.scope}] ${params.target}: environmental install failure (${detail}) — not attributed to the repository`,
    )
    return { environmentalFailure: true }
}
