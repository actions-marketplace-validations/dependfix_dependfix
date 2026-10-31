import { describe, expect, it } from 'vitest'
import { renderRunCompletedNotification, renderRunFailureNotification, renderSecurityNotification, renderWeeklyDigestNotification } from './business-templates'

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

    it('security_high：标题含 [告警] 与 High 专有名词，正文含计数 / 截断 / 仓库分组', () => {
        const out = renderSecurityNotification(security)
        expect(out.subject).toContain('[dependfix][告警]')
        expect(out.subject).toContain('5 个 High 告警未修复')
        expect(out.subject).not.toContain('Critical 告警未修复')
        expect(out.html).toContain('acme/app')
        expect(out.html).toContain('另有 5 条截断未纳入明细')
        expect(out.text).toContain('Critical: 2')
        expect(out.text).toContain('High: 3')
    })

    it('security_critical：标题用 Critical 专有名词，与 high 类别不混用', () => {
        const out = renderSecurityNotification(security, 'zh-CN', 'security_critical')
        expect(out.subject).toContain('[dependfix][告警]')
        expect(out.subject).toContain('5 个 Critical 告警未修复')
        expect(out.subject).not.toContain('High 告警未修复')
    })

    it('security_high en-US 标签与文案', () => {
        const out = renderSecurityNotification(security, 'en-US')
        expect(out.subject).toContain('[dependfix][告警]')
        expect(out.subject).toContain('5 High alerts unfixed')
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

describe('周报模板', () => {
    const digest = {
        weekKey: '2026-W44',
        counts: { critical: 2, high: 3, total: 5 },
        repositories: [
            { repository: 'acme/app', critical: 2, high: 1, total: 3 },
            { repository: 'acme/api', critical: 0, high: 2, total: 2 },
        ],
        truncated: { critical: 1, high: 4, total: 5 },
        exempted: 2,
        link: 'https://dependfix.example/alerts',
    }

    it('标题含 [周报] 与仓库数；正文披露截断 / 豁免与仓库分组', () => {
        const out = renderWeeklyDigestNotification(digest)
        expect(out.subject).toContain('[dependfix][周报]')
        expect(out.subject).toContain('2 个仓库存在未修复告警')
        expect(out.subject).toContain('Critical 2 / High 3')
        expect(out.html).toContain('2026-W44')
        expect(out.html).toContain('acme/app')
        expect(out.html).toContain('另有 5 条截断未纳入明细')
        expect(out.html).toContain('引擎汇总另有 2 条告警本地已满足（converged）')
        expect(out.text).toContain('acme/api: 0/2/2')
    })

    it('无截断 / 无豁免时不渲染空披露行', () => {
        const out = renderWeeklyDigestNotification({
            ...digest,
            truncated: { critical: 0, high: 0, total: 0 },
            exempted: 0,
        })
        expect(out.html).not.toContain('截断未纳入明细')
        expect(out.html).not.toContain('已满足（converged）')
        expect(out.text).not.toContain('converged')
    })

    it('空快照：标题为「本周无未修复告警」', () => {
        const out = renderWeeklyDigestNotification({
            ...digest,
            counts: { critical: 0, high: 0, total: 0 },
            repositories: [],
            truncated: { critical: 0, high: 0, total: 0 },
            exempted: 0,
        })
        expect(out.subject).toBe('[dependfix][周报] 本周无未修复告警')
        expect(out.text).toContain('2026-W44')
    })

    it('en-US 文案', () => {
        const out = renderWeeklyDigestNotification(digest, 'en-US')
        expect(out.subject).toContain('[dependfix][周报]')
        expect(out.subject).toContain('2 repositories have unfixed alerts')
        expect(out.text).toContain('5 truncated alerts are not included')
        expect(out.text).toContain('already satisfied locally')
    })

    it('动态字段转义', () => {
        const out = renderWeeklyDigestNotification({
            ...digest,
            repositories: [{ repository: '<script>alert(1)</script>', critical: 1, high: 0, total: 1 }],
        })
        expect(out.html).toContain('&lt;script&gt;')
        expect(out.html).not.toContain('<script>alert(1)</script>')
    })
})
