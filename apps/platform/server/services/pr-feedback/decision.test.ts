import { describe, expect, it } from 'vitest'
import { buildFeedbackCommentBody, buildFeedbackMarker, hasFeedbackMarker, isFeedbackFailureConclusion } from './decision'

describe('pr-feedback decision', () => {
    it('只有硬失败结论触发；neutral / skipped / cancelled / pending 不触发', () => {
        for (const conclusion of ['failure', 'timed_out', 'action_required']) {
            expect(isFeedbackFailureConclusion(conclusion)).toBe(true)
        }
        for (const conclusion of ['success', 'neutral', 'skipped', 'cancelled', 'stale', 'pending', '', null]) {
            expect(isFeedbackFailureConclusion(conclusion)).toBe(false)
        }
    })

    it('幂等标记按 headSha 唯一，且能从评论正文中识别', () => {
        const sha = 'a'.repeat(40)
        const marker = buildFeedbackMarker(sha)
        expect(marker).toContain(sha)
        expect(hasFeedbackMarker([`前言\n${marker}\n正文`], sha)).toBe(true)
        expect(hasFeedbackMarker([buildFeedbackMarker('b'.repeat(40))], sha)).toBe(false)
        expect(hasFeedbackMarker([], sha)).toBe(false)
    })

    it('评论正文：marker 置首、失败来源最多 5 条、关闭提示按配置出现', () => {
        const body = buildFeedbackCommentBody({
            headSha: 'c'.repeat(40),
            conclusion: 'failure',
            failureSources: Array.from({ length: 7 }, (_, index) => ({
                provider: `app${index}`,
                name: `job${index}`,
            })),
            closeFailed: true,
        })
        const lines = body.split('\n')
        expect(lines[0]).toBe(buildFeedbackMarker('c'.repeat(40)))
        expect(body).toContain('`app0/job0`')
        expect(body).toContain('`app4/job4`')
        expect(body).not.toContain('`app5/job5`')
        expect(body).toContain('自动关闭')

        const noClose = buildFeedbackCommentBody({ headSha: 'd'.repeat(40), conclusion: 'timed_out', closeFailed: false })
        expect(noClose).not.toContain('自动关闭')
        expect(noClose).toContain('timed_out')
    })
})
