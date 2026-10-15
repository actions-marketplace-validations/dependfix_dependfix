/**
 * 升级失败的「计数 + 取证」成对记录。
 *
 * 为什么必须成对：失败原因只落在 `FixAction.error` 里，而报告随工作目录清理一并消失，平台也只
 * 持久化引擎日志与 summary——一旦失败只计数不打日志，「抓到告警、已修复 0」的运行事后完全没有
 * 原因可查（2026-10-16 生产复盘：11 次版本化 overrides 安装失败只留下
 * `applying versioned overrides`，日志里没有任何失败文本）。
 *
 * 为什么就地记录而不是等收尾统一输出：平台按执行超时截断时只保留截断前已产生的日志
 * （`MemoryLogger` 快照早于引擎收尾），收尾输出可能整段丢失；失败就地留痕落在超时边界的安全侧。
 *
 * 本模块只做日志与计数，不写入 `allErrors`——归因与出口码口径保持不变。
 */
import type { AppContext } from './helpers'

/** 升级失败计数的可变载体（避免跨模块复刻修复过程的完整进度接口）。 */
export interface FailureCounter {
    failed: number
}

/**
 * 记一次升级失败：失败计数自增 + 日志留痕。
 *
 * @param ctx - 仅需 logger
 * @param counter - 失败计数载体（`RepoFixProgress` 等）
 * @param scope - 日志前缀（如 `multi-version` / `major-upgrade` / `member-upgrade`）
 * @param name - 失败对象名（包名，必要时带 manifest 路径）
 * @param error - 失败文本；空值（`undefined` 或空串）时以 `no error detail` 占位，避免日志出现空条目
 */
export function recordUpgradeFailure(
    ctx: Pick<AppContext, 'logger'>,
    counter: FailureCounter,
    scope: string,
    name: string,
    error: string | undefined,
): void {
    counter.failed++
    ctx.logger.warn(`[${scope}] ${name}: upgrade failed — ${error || 'no error detail'}`)
}
