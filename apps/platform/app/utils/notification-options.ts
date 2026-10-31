import { scanSeverityLabel, type Translator } from './scan-options'

/**
 * 通知页「严重级别阈值」选项（`severityThreshold`）。
 *
 * 标签口径：`Critical` / `High` 取自扫描侧单一事实源 `scan-options.ts`，
 * 本文件只负责「是否附加 High」的拼接文案（`notifications.severityHigh` / `severityCritical`），
 * 避免与扫描页出现两套严重级别名称。
 */
export const notificationSeverityThresholdOptions = (
    t: Translator,
): { label: string, value: 'critical' | 'high' }[] => [
    {
        label: t('notifications.severityHigh', {
            critical: scanSeverityLabel('critical', t),
            high: scanSeverityLabel('high', t),
        }),
        value: 'high',
    },
    {
        label: t('notifications.severityCritical', { critical: scanSeverityLabel('critical', t) }),
        value: 'critical',
    },
]
