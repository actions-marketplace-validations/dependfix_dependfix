// decision.ts — PR 回环反馈的纯决策（评论幂等键 / 失败判定 / 评论正文）。
//
// 与引擎 CLI 回环（`github/pr-check-watch.ts`）共用「失败结论集合」语义，
// 但平台侧不在 PR 上做交互式等待，只按监测器节拍产出副作用。口径见
// docs/design/governance/pr-feedback-loop.md §4 / §5。

/** 触发反馈的失败结论（与 CLI `isFailedConclusion` 的硬失败一致；cancelled / skipped 不触发）。 */
export const FEEDBACK_FAILURE_CONCLUSIONS: readonly string[] = ['failure', 'timed_out', 'action_required']

/** 是否触发反馈（`neutral` / `skipped` / `cancelled` / `pending` 一律不触发）。 */
export const isFeedbackFailureConclusion = (conclusion: string | null | undefined): boolean =>
    typeof conclusion === 'string' && FEEDBACK_FAILURE_CONCLUSIONS.includes(conclusion)

/** 评论幂等标记：按 headSha 唯一（多副本 / 重启后仍幂等）。 */
export function buildFeedbackMarker(headSha: string): string {
    return `<!-- dependfix:pr-feedback headSha=${headSha} -->`
}

/** 评论区是否已有该 headSha 的反馈标记。 */
export function hasFeedbackMarker(commentBodies: readonly string[], headSha: string): boolean {
    const marker = buildFeedbackMarker(headSha)
    return commentBodies.some((body) => typeof body === 'string' && body.includes(marker))
}

/** 评论正文（失败 job 最多 5 条 + 归因；marker 在首位，便于幂等判定）。 */
export function buildFeedbackCommentBody(input: {
    headSha: string
    conclusion: string
    failureSources?: readonly { provider: string, name: string, kind?: string }[]
    closeFailed: boolean
}): string {
    const lines: string[] = [
        buildFeedbackMarker(input.headSha),
        '## dependfix 检测到 PR Check 失败',
        '',
        `- 结论：\`${input.conclusion}\``,
    ]
    const sources = (input.failureSources ?? []).slice(0, 5)
    if (sources.length > 0) {
        lines.push(`- 失败来源：${sources.map((source) => `\`${source.provider}/${source.name}\``).join('、')}`)
    }
    lines.push('', '修复上游问题后重新推送即可；本评论由平台 PR 回环自动生成（同一 HEAD 只评论一次）。')
    if (input.closeFailed) {
        lines.push('', '> 该 PR 已按仓库配置被自动关闭（`closeFailed` 开启）。')
    }
    return lines.join('\n')
}
