import { describe, expect, it } from 'vitest'
import { DEFAULT_NOTIFICATION_SETTINGS } from './settings'
import {
    isDeploymentNotificationEnabled,
    normalizeNotificationRole,
    resolveAllNotificationPreferences,
    resolveEffectiveNotificationPreference,
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

    it('部署开关仅 false 熔断；角色归一化 fail-closed 为 viewer', () => {
        expect(isDeploymentNotificationEnabled({})).toBe(true)
        expect(isDeploymentNotificationEnabled({ DEPENDFIX_NOTIFICATION_ENABLED: 'false' } as NodeJS.ProcessEnv)).toBe(false)
        expect(normalizeNotificationRole('admin')).toBe('admin')
        expect(normalizeNotificationRole('user')).toBe('viewer')
        expect(normalizeNotificationRole(null)).toBe('viewer')
    })
})
