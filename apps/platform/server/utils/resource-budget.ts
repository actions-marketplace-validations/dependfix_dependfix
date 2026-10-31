import { totalmem } from 'node:os'
import { readCgroupMemoryState, type CgroupMemoryState } from './resource-usage'
import { parseProcessRole, type ProcessRole } from './process-role'

/**
 * 启动期资源预算探测（只读，不阻断启动）。
 *
 * 背景（2026-10-17 生产实证）：控制面按 1GB 部署时，同容器内执行安装 / 验证会被内核 OOM
 * 反复 `SIGKILL`。本模块把「控制面最低」与「执行面建议」拆开，并在启动日志打印检测到的
 * cgroup / 宿主内存上限与队列并发，低于执行面建议值时 warn。
 *
 * 口径见 [executor-process-isolation.md §8.4](../../../../docs/design/governance/executor-process-isolation.md)。
 */

/** 执行面（安装 / 验证同容器）建议内存：单次安装常驻约 1GB，4GB 已验证会 OOM。 */
export const RECOMMENDED_EXECUTION_MEMORY_BYTES = 8 * 1024 ** 3

/** 控制面（仅 UI / API，不执行安装）最低内存。 */
export const MIN_CONTROL_PLANE_MEMORY_BYTES = 1 * 1024 ** 3

/** 当前队列 worker 固定并发（与 scan-worker 共享同一默认值，避免日志与实际漂移）。 */
export const DEFAULT_SCAN_CONCURRENCY = 1

export type MemoryLimitSource = 'cgroup-v2' | 'cgroup-v1' | 'host' | 'none'

export interface StartupResourceInfo {
    role: ProcessRole
    memoryLimitBytes: number | null
    memoryLimitSource: MemoryLimitSource
    hostTotalBytes: number
    concurrency: number
    /** 本进程是否承担执行面（决定推荐阈值：执行面 8 GiB / 纯控制面 1 GiB） */
    executionPlane: boolean
    recommendedBytes: number
    status: 'ok' | 'low' | 'unknown'
    /** cgroup 上限不可用 / 无限制时的原因 */
    limitReason?: string
    /** cgroup 指标部分不可采集时的原因 */
    degradedReason?: string
}

export interface StartupResourceOptions {
    env?: NodeJS.ProcessEnv
    hostTotalBytes?: number
    cgroupRoot?: string
    /** 测试注入 cgroup 内存状态（跳过文件读取） */
    cgroupState?: CgroupMemoryState
    concurrency?: number
}

/** 人类可读字节数（启动日志用；UI 侧有独立实现，避免客户端引入 server 模块）。 */
export const formatBytes = (bytes: number | null | undefined): string => {
    if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) {
        return 'unknown'
    }
    if (bytes < 1024) {
        return `${bytes} B`
    }
    const units = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB']
    let value = bytes / 1024
    let unitIndex = 0
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024
        unitIndex++
    }
    return `${value.toFixed(1)} ${units[unitIndex]}`
}

/**
 * 解析启动期资源：优先 cgroup 上限；cgroup 无限制 / 不可读时回退宿主总内存（仅用于告警口径）。
 * 返回的 `memoryLimitBytes` 为 null 表示连宿主内存也无法判定（正常情况下不会发生）。
 */
export const resolveStartupResource = (options: StartupResourceOptions = {}): StartupResourceInfo => {
    const env = options.env ?? process.env
    const hostTotalBytes = options.hostTotalBytes ?? totalmem()
    const cgroupState = options.cgroupState ?? readCgroupMemoryState(options.cgroupRoot)
    const concurrency = options.concurrency ?? DEFAULT_SCAN_CONCURRENCY
    const role = parseProcessRole(env.DEPENDFIX_ROLE)

    const inProcessWorker = /^(1|true)$/iu.test(env.NUXT_IN_PROCESS_WORKER ?? env.IN_PROCESS_WORKER ?? '')
    // 独立的纯 HTTP 进程（entrypoint 显式注入 DEPENDFIX_ROLE=server 且不消费队列）只需控制面规格；
    // 其余形态（worker / 单进程 / 本地直连）都可能执行安装与验证 → 执行面阈值（保守）。
    const isolatedControlPlane = role === 'server'
        && (env.DEPENDFIX_ROLE ?? '').toLowerCase() === 'server'
        && !inProcessWorker
    const executionPlane = !isolatedControlPlane
    const recommendedBytes = executionPlane
        ? RECOMMENDED_EXECUTION_MEMORY_BYTES
        : MIN_CONTROL_PLANE_MEMORY_BYTES

    const cgroupLimit = cgroupState.memoryMaxBytes
    const memoryLimitBytes = cgroupLimit ?? (hostTotalBytes > 0 ? hostTotalBytes : null)
    let memoryLimitSource: MemoryLimitSource
    if (cgroupLimit !== null) {
        memoryLimitSource = cgroupState.source
    } else if (hostTotalBytes > 0) {
        memoryLimitSource = 'host'
    } else {
        memoryLimitSource = 'none'
    }

    let status: StartupResourceInfo['status']
    if (memoryLimitBytes === null || memoryLimitBytes <= 0) {
        status = 'unknown'
    } else if (memoryLimitBytes < recommendedBytes) {
        status = 'low'
    } else {
        status = 'ok'
    }

    const limitReason = cgroupLimit === null
        ? cgroupState.limitReason ?? (cgroupState.source === 'none' ? cgroupState.degradedReason : 'cgroup limit unavailable; fallback to host total')
        : undefined

    return {
        role,
        memoryLimitBytes,
        memoryLimitSource,
        hostTotalBytes,
        concurrency,
        executionPlane,
        recommendedBytes,
        status,
        ...(limitReason ? { limitReason } : {}),
        ...(cgroupState.degradedReason ? { degradedReason: cgroupState.degradedReason } : {}),
    }
}

/** 启动日志单行（stdout）：包含角色 / 内存上限 / 来源 / 宿主总量 / 并发 / 建议值 / 判定。 */
export const formatStartupResourceLine = (info: StartupResourceInfo): string => {
    const base = `[resource] role=${info.role} plane=${info.executionPlane ? 'execution' : 'control'} `
        + `memoryLimit=${formatBytes(info.memoryLimitBytes)} source=${info.memoryLimitSource} `
        + `hostTotal=${formatBytes(info.hostTotalBytes)} concurrency=${info.concurrency} `
        + `recommended=${formatBytes(info.recommendedBytes)} status=${info.status}`
    const reasons = [
        info.limitReason ? `limitReason=${JSON.stringify(info.limitReason)}` : null,
        info.degradedReason ? `degradedReason=${JSON.stringify(info.degradedReason)}` : null,
    ].filter(Boolean)
    return reasons.length > 0 ? `${base} ${reasons.join(' ')}` : base
}

/** 低于执行面建议时的 warn 文案（不阻断启动）。 */
export const formatStartupResourceWarning = (info: StartupResourceInfo): string | null => {
    if (info.status !== 'low' || info.memoryLimitBytes === null) {
        return null
    }
    return `[resource] 检测到内存上限 ${formatBytes(info.memoryLimitBytes)} 低于`
        + `${info.executionPlane ? '执行面' : '控制面'}建议 ${formatBytes(info.recommendedBytes)}；`
        + `如需执行安装 / 验证请提高容器 / 宿主机内存，或把 worker 拆到独立主机。启动继续（不阻断）。`
}
