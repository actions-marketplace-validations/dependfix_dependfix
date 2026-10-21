import { describe, expect, it } from 'vitest'
import { renderRunCompletedNotification, renderRunFailureNotification, renderSecurityNotification } from './business-templates'

describe('业务通知模板', () => {
    const security = {
        scopeLabel: 'batch' as const,
        scopeId: 'batch-1',
        counts: { critical: 2, high: 3, total: 5 },
        repositories: [
            { repository: 'acme/app', critical: 2, high: 1, total: 3 },
            { repository: 'acme/api', critical: 0, high: 2, total: 2 },
        ],
        truncated: { critical: 1, high: 4, total: 5 },
        link: 'https://dependfix.example/batch-runs/batch-1',
    }

    it('security_high：标题含 [告警]，正文含计数 / 截断 / 仓库分组', () => {
        const out = renderSecurityNotification(security)
        expect(out.subject).toContain('[dependfix][告警]')
        expect(out.subject).toContain('5 个高危告警未修复')
        expect(out.html).toContain('acme/app')
        expect(out.html).toContain('另有 5 条截断未纳入明细')
        expect(out.text).toContain('严重: 2')
        expect(out.text).toContain('高危: 3')
    })

    it('security_high en-US 标签与文案', () => {
        const out = renderSecurityNotification(security, 'en-US')
        expect(out.subject).toContain('[dependfix][告警]')
        expect(out.subject).toContain('5 high-risk alerts unfixed')
        expect(out.text).toContain('5 truncated alerts are not included')
    })

    it('run_failure：标题含 [运行]，字段含失败码 / 阶段', () => {
        const out = renderRunFailureNotification({
            scopeLabel: 'run', scopeId: 'run-1', failedCount: 1, totalCount: 1,
            failureCode: 'execution_timeout', failureStage: 'runtime', link: 'https://x/run-1',
        })
        expect(out.subject).toContain('[dependfix][运行]')
        expect(out.html).toContain('execution_timeout')
        expect(out.html).toContain('runtime')
    })

    it('run_completed：标题含 [摘要]，正文含修复 / 告警数', () => {
        const out = renderRunCompletedNotification({
            scopeLabel: 'batch', scopeId: 'batch-1', repositoryCount: 3, alertsFound: 12, alertsFixed: 8, durationMs: 65_000,
        })
        expect(out.subject).toContain('[dependfix][摘要]')
        expect(out.subject).toContain('修复 8 / 告警 12')
        expect(out.html).toContain('65s')
    })

    it('HTML 转义动态字段', () => {
        const out = renderRunFailureNotification({
            scopeLabel: 'run', scopeId: '<script>', failedCount: 1, failureCode: '<img src=x>',
        })
        expect(out.html).toContain('&lt;script&gt;')
        expect(out.html).not.toContain('<script>')
        expect(out.html).toContain('&lt;img src=x&gt;')
    })
})
