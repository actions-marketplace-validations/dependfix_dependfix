import { describe, expect, it } from 'vitest'
import {
    aggregateCheckAttribution,
    classifyCheckFailure,
    isCancelledConclusion,
    isFailedConclusion,
} from './check-attribution'

describe('classifyCheckFailure', () => {
    it('取消 / 跳过 / 过期结论优先归 cancelled', () => {
        for (const conclusion of ['cancelled', 'skipped', 'stale'] as const) {
            // 即使父提交同 job 为绿、文本像 dependabot，也不得归 self_caused / external_noise
            expect(classifyCheckFailure({
                name: 'Dependabot updater',
                conclusion,
                detail: 'security_update_not_possible',
                parentConclusion: 'success',
            })).toBe('cancelled')
        }
    })

    it('Dependabot / updater 作业 + 无更新 / 公告撤回文本 → external_noise', () => {
        expect(classifyCheckFailure({
            name: 'dependabot[bot] updater',
            conclusion: 'failure',
            detail: 'security_update_not_possible: no patched version',
        })).toBe('external_noise')
        expect(classifyCheckFailure({
            name: 'Updater',
            conclusion: 'failure',
            detail: 'advisory was withdrawn by the maintainer',
        })).toBe('external_noise')
    })

    it('镜像 / registry 推送作业 + manifest 错误签名 → external_noise', () => {
        expect(classifyCheckFailure({
            name: 'Publish Docker Image',
            conclusion: 'failure',
            detail: 'unknown manifest class: application/vnd.oci.image.index.v1+json',
        })).toBe('external_noise')
        expect(classifyCheckFailure({
            name: 'ACR push',
            conclusion: 'failure',
            detail: 'manifest unknown: manifest tagged v1 not found',
        })).toBe('external_noise')
    })

    it('作业名命中但错误签名不命中 → 不判 external_noise（防误洗白）', () => {
        expect(classifyCheckFailure({
            name: 'Publish Docker Image',
            conclusion: 'failure',
            detail: 'npm run build exited with code 1',
        })).toBe('unknown')
        expect(classifyCheckFailure({
            name: 'dependabot[bot] updater',
            conclusion: 'failure',
            detail: 'Timeout of 10000ms exceeded',
        })).toBe('unknown')
    })

    it('父提交同 job 已红 → pre_existing（无论作业名）', () => {
        expect(classifyCheckFailure({
            name: 'Cloudflare Workers Builds',
            conclusion: 'failure',
            parentConclusion: 'failure',
        })).toBe('pre_existing')
        expect(classifyCheckFailure({
            name: 'Test',
            conclusion: 'timed_out',
            parentConclusion: 'timed_out',
        })).toBe('pre_existing')
    })

    it('父提交同 job 为绿且硬失败 → self_caused；超时 / 待授权仍按 unknown', () => {
        expect(classifyCheckFailure({
            name: 'Test',
            conclusion: 'failure',
            parentConclusion: 'success',
        })).toBe('self_caused')
        // timed_out / action_required 多为基础设施抖动：即使父提交绿也不作为自因（不关闭）
        expect(classifyCheckFailure({
            name: 'Test',
            conclusion: 'timed_out',
            parentConclusion: 'success',
        })).toBe('unknown')
        expect(classifyCheckFailure({
            name: 'Coverage',
            conclusion: 'action_required',
            parentConclusion: 'success',
        })).toBe('unknown')
    })

    it('startup_failure / 未识别结论 → 失败但归因 unknown（只评论不关闭）', () => {
        expect(isFailedConclusion('startup_failure')).toBe(true)
        expect(isFailedConclusion('unknown')).toBe(true)
        expect(classifyCheckFailure({
            name: 'Test',
            conclusion: 'startup_failure',
            parentConclusion: 'success',
        })).toBe('unknown')
        expect(classifyCheckFailure({ name: 'Test', conclusion: 'unknown', parentConclusion: 'success' }))
            .toBe('unknown')
    })

    it('父提交没有该作业 / 未完成 → unknown（不臆测归属）', () => {
        expect(classifyCheckFailure({ name: 'Test', conclusion: 'failure' })).toBe('unknown')
        expect(classifyCheckFailure({ name: 'Test', conclusion: 'failure', parentConclusion: 'absent' })).toBe('unknown')
        expect(classifyCheckFailure({ name: 'Test', conclusion: 'failure', parentConclusion: 'pending' })).toBe('unknown')
        // 父提交绿但本次并未失败（如 neutral）→ 不是 self_caused
        expect(classifyCheckFailure({ name: 'Test', conclusion: 'neutral', parentConclusion: 'success' })).toBe('unknown')
    })
})

describe('aggregateCheckAttribution', () => {
    it('无失败 → undefined', () => {
        expect(aggregateCheckAttribution([])).toBeUndefined()
    })

    it('全部同归因 → 该归因', () => {
        expect(aggregateCheckAttribution(['self_caused', 'self_caused'])).toBe('self_caused')
        expect(aggregateCheckAttribution(['external_noise'])).toBe('external_noise')
    })

    it('混合归因 → unknown（关闭要求一致归因）', () => {
        expect(aggregateCheckAttribution(['self_caused', 'unknown'])).toBe('unknown')
        expect(aggregateCheckAttribution(['self_caused', 'external_noise', 'unknown'])).toBe('unknown')
    })
})

describe('结论判定', () => {
    it('isFailedConclusion 覆盖 failure / timed_out / action_required', () => {
        expect(isFailedConclusion('failure')).toBe(true)
        expect(isFailedConclusion('timed_out')).toBe(true)
        expect(isFailedConclusion('action_required')).toBe(true)
        expect(isFailedConclusion('startup_failure')).toBe(true)
        expect(isFailedConclusion('unknown')).toBe(true)
        expect(isFailedConclusion('neutral')).toBe(false)
        expect(isFailedConclusion('success')).toBe(false)
        expect(isFailedConclusion('pending')).toBe(false)
    })

    it('isCancelledConclusion 覆盖 cancelled / skipped / stale', () => {
        expect(isCancelledConclusion('cancelled')).toBe(true)
        expect(isCancelledConclusion('skipped')).toBe(true)
        expect(isCancelledConclusion('stale')).toBe(true)
        expect(isCancelledConclusion('failure')).toBe(false)
    })
})
