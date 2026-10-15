import { scanModeOptions } from './scan-options'

type Translator = (key: string, params?: Record<string, string | number>) => string

export const shortRunId = (id: string) => id.slice(0, 8)

export const alertsFound = (summary: Record<string, unknown> | null) => {
    const value = summary?.alertsFound
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * 运行模式标签：复用 `scan-options` 的选项单一事实源（标签口径漂移防护）。
 * 未知模式（历史数据 / 未来枚举扩展）原样返回，故用 `find` + 兜底。
 */
export const runModeLabel = (mode: string, t: Translator) =>
    scanModeOptions(t).find((option) => option.value === mode)?.label ?? mode

export const runExecutorLabel = (executorKind: string, t: Translator) => {
    switch (executorKind) {
        case 'github-action':
            return t('repos.githubAction')
        case 'sandbox':
            return t('repos.sandboxContainer')
        default:
            return t('repos.platformContainer')
    }
}

/**
 * 失败阶段下拉选项顺序（与 `server/services/run-failure-classify.ts` 的 `RUN_FAILURE_STAGES` 同序；
 * 分类口径单一事实源在服务端，前端仅复制枚举词汇用于筛选控件）。
 */
export const RUN_FAILURE_STAGE_OPTIONS = [
    'source',
    'clone',
    'install',
    'fix',
    'verify',
    'deliver',
    'runtime',
    'cleanup',
    'unknown',
] as const

/** 处置建议下拉选项顺序（同上） */
export const RUN_FAILURE_KIND_OPTIONS = ['transient', 'deterministic', 'unknown'] as const

/**
 * 批量日志导出的**全量导出**运行数上限（前端镜像，仅用于预判「导出全部筛选结果」是否可用）。
 *
 * 权威值在服务端 `server/api/runs/logs-export.get.ts` 的 `MAX_EXPORT_RUNS`（超限 413 兜底）；
 * 前端镜像只决定菜单项的可点状态与文案，两类漂移后果均为「提示与 413 不一致」而不会放行越权导出。
 * 两侧等值由 `server/api/runs/runs-logs.test.ts` 的断言锁定。
 */
export const EXPORT_RUNS_LIMIT = 100

/** 导出范围菜单项（纯渲染数据；`command` 由页面注入，便于单测覆盖两档文案与禁用态） */
export interface ExportScopeItem {
    label: string
    disabled: boolean
}

/**
 * 「导出全部筛选结果」菜单项（SplitButton 二级入口）。
 *
 * 主按钮已覆盖「当前页」，菜单只承载全量一档：命中数 > `EXPORT_RUNS_LIMIT` 时禁用并标注原因
 * （超限点按只会拿到 413，禁用可免去一次必然失败的操作）。
 */
export const buildExportScopeItems = (total: number, t: Translator): ExportScopeItem[] => {
    const overLimit = total > EXPORT_RUNS_LIMIT
    return [
        {
            label: overLimit
                ? t('scans.runList.exportAllLogsOverLimit', { total, limit: EXPORT_RUNS_LIMIT })
                : t('scans.runList.exportAllLogs', { total }),
            disabled: overLimit,
        },
    ]
}

/** 失败阶段 i18n 标签（null → null；未知阶段原样返回） */
export const failureStageLabel = (stage: string | null | undefined, t: Translator): string | null => {
    if (!stage) {
        return null
    }
    return ({
        source: t('runs.failureStage.source'),
        clone: t('runs.failureStage.clone'),
        install: t('runs.failureStage.install'),
        fix: t('runs.failureStage.fix'),
        verify: t('runs.failureStage.verify'),
        deliver: t('runs.failureStage.deliver'),
        runtime: t('runs.failureStage.runtime'),
        cleanup: t('runs.failureStage.cleanup'),
        unknown: t('runs.failureStage.unknown'),
    } as Record<string, string>)[stage] ?? stage
}

/** 处置建议 i18n 标签（null → null；未知值原样返回） */
export const failureKindLabel = (kind: string | null | undefined, t: Translator): string | null => {
    if (!kind) {
        return null
    }
    return ({
        transient: t('runs.failureKind.transient'),
        deterministic: t('runs.failureKind.deterministic'),
        unknown: t('runs.failureKind.unknown'),
    } as Record<string, string>)[kind] ?? kind
}

export const formatRunDuration = (
    startedAt: string | null,
    finishedAt: string | null,
    t: Translator,
) => {
    if (!startedAt || !finishedAt) {
        return '—'
    }
    const started = new Date(startedAt).getTime()
    const finished = new Date(finishedAt).getTime()
    if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started) {
        return '—'
    }
    const seconds = (finished - started) / 1000
    const formattedSeconds = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(seconds)
    return t('alerts.runDurationSeconds', { seconds: formattedSeconds })
}
