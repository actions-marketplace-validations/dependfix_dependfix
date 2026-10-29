import { describe, expect, it } from 'vitest'
import { DEFAULT_NOTIFICATION_SETTINGS } from './settings'
import {
    isDeploymentNotificationEnabled,
    normalizeNotificationRole,
    resolveAllNotificationPreferences,
    resolveEffectiveNotificationPreference,
    resolveNotificationPreferenceRows,
} from './preferences'

const settings = DEFAULT_NOTIFICATION_SETTINGS

describe('通知生效优先级', () => {
    it('组织关闭后个人无法开启且不可编辑', () => {
        const closed = {
            ...settings,
            categories: { ...settings.categories, securityHigh: false },
        }
        const effective = resolveEffectiveNotificationPreference({
            category: 'security_high',
            role: 'admin',
            settings: closed,
            userEnabled: true,
        })
        expect(effective.enabled).toBe(false)
        expect(effective.editable).toBe(false)
        expect(effective.reason).toBe('org_disabled')
    })

    it('无偏好行取角色默认；显式关闭覆盖角色默认', () => {
        expect(resolveEffectiveNotificationPreference({
            category: 'security_high', role: 'admin', settings,
        }).enabled).toBe(true)
        expect(resolveEffectiveNotificationPreference({
            category: 'run_completed', role: 'admin', settings,
        }).enabled).toBe(false)
        expect(resolveEffectiveNotificationPreference({
            category: 'security_high', role: 'admin', settings, userEnabled: false,
        }).enabled).toBe(false)
    })

    it('viewer 永不接收业务通知且不可编辑', () => {
        const effective = resolveEffectiveNotificationPreference({
            category: 'run_failure', role: 'viewer', settings, userEnabled: true,
        })
        expect(effective.enabled).toBe(false)
        expect(effective.editable).toBe(false)
        expect(effective.reason).toBe('viewer')
    })

    it('部署总开关关闭 → 生效值全部 false，但可编辑性保留', () => {
        const effective = resolveEffectiveNotificationPreference({
            category: 'run_failure', role: 'admin', settings, deploymentEnabled: false,
        })
        expect(effective.enabled).toBe(false)
        expect(effective.editable).toBe(true)
    })

    it('批量解析返回全部业务类别', () => {
        const rows = resolveAllNotificationPreferences({ role: 'admin', settings })
        expect(rows.map((row) => row.category)).toEqual(['security_high', 'run_failure', 'run_completed', 'weekly_digest'])
    })

    it('必选 critical 行置首且不可编辑（管理员 / viewer 两态）', () => {
        const adminRows = resolveNotificationPreferenceRows({ role: 'admin', settings })
        expect(adminRows.map((row) => row.category)).toEqual([
            'security_critical',
            'security_high',
            'run_failure',
            'run_completed',
            'weekly_digest',
        ])
        const critical = adminRows[0]!
        expect(critical.editable).toBe(false)
        expect(critical.reason).toBe('mandatory')
        expect(critical.enabled).toBe(true)

        const viewerCritical = resolveNotificationPreferenceRows({ role: 'viewer', settings })[0]!
        expect(viewerCritical.enabled).toBe(false)
        expect(viewerCritical.reason).toBe('viewer')
    })

    it('必选 critical 行只受部署总开关影响', () => {
        const rows = resolveNotificationPreferenceRows({
            role: 'admin',
            settings: { ...settings, categories: { ...settings.categories, securityHigh: false } },
            deploymentEnabled: false,
        })
        expect(rows[0]?.category).toBe('security_critical')
        expect(rows[0]?.enabled).toBe(false)
        expect(rows[0]?.editable).toBe(false)
    })

    it('组织关闭 securityHigh 不影响必选 critical 行的启用值', () => {
        const rows = resolveNotificationPreferenceRows({
            role: 'admin',
            settings: { ...settings, categories: { ...settings.categories, securityHigh: false } },
            deploymentEnabled: true,
        })
        expect(rows[0]?.category).toBe('security_critical')
        expect(rows[0]?.enabled).toBe(true)
        // 同场景下 security_high 行被组织关闭
        const high = rows.find((row) => row.category === 'security_high')
        expect(high?.enabled).toBe(false)
        expect(high?.reason).toBe('org_disabled')
    })

    it('部署开关仅 false 熔断；角色归一化 fail-closed 为 viewer', () => {
        expect(isDeploymentNotificationEnabled({})).toBe(true)
        expect(isDeploymentNotificationEnabled({ DEPENDFIX_NOTIFICATION_ENABLED: 'false' } as NodeJS.ProcessEnv)).toBe(false)
        expect(normalizeNotificationRole('admin')).toBe('admin')
        expect(normalizeNotificationRole('user')).toBe('viewer')
        expect(normalizeNotificationRole(null)).toBe('viewer')
    })
})
