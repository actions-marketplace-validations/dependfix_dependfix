// process-control.ts — 运行级取消（abort）与受管子进程的单一事实源。
//
// 背景（2026-10-16 生产复盘）：引擎与平台**同进程**运行，且安装 / lockfile 修复链走同步
// `execSync` / `execFileSync`。平台执行超时（`withTimeout` 只 `Promise.race`、不中断底层工作）
// 之后引擎继续跑，僵尸 install 与后续仓库争抢内存 → 内核 OOM 级联
// （实测 4 核 4 GB 主机 4.5 小时内 41 次 `Out of memory: Killed process`，时间戳与引擎日志行同秒对齐）。
//
// 本模块提供「超时后真正终止」所需的两件事：
// 1. **运行级 abort 状态**：`requestAbort()` 幂等置位，并**立即终止已登记的子进程树**；
//    `isAbortRequested()` 供调用方在启动新工作之前短路（abort 后不再产生新子进程）。
// 2. **受管子进程**：`runTrackedCommand()` 以异步 `spawn` 执行并登记 PID，退出 / 出错时注销；
//    超时或 abort 时按**进程树**终止（POSIX 杀进程组，Windows `taskkill /T /F`），避免
//    "杀掉 shell 而 pnpm 子进程存活并继续占用内存 / 持有管道"。
//
// 平台差异：Windows 上 npm 系 CLI（`pnpm` / `npx`）是 `.cmd` 包裹，**不能**直接
// `spawn`（Node 官方口径：`.cmd` / `.bat` 须经 shell 或 cmd.exe 执行）；POSIX 上直接 `spawn`
// 与旧 `execSync` 一样经 PATH 解析，行为等价。故 `shell` 缺省由 `resolveShellOption()` 按平台决定。
//
// 生命周期：模块级单例，由 `DependfixApp` 构造期 `resetProcessControlState()` 复位
// （与 `resetActiveRulesConfig()` 同族的进程级状态口径——同一进程多次运行不得互相污染）。
//
// 边界：本模块只做状态与进程控制，不感知业务语义；**不在 engine 公共出口 re-export**
// （内部实现，不扩大公开 API，口径同 `runners/verification-gate.ts`）。
import { spawn, spawnSync } from 'node:child_process'

/** 单流捕获上限（与 `execSync` 默认 `maxBuffer` 同量级）：超限后继续 drain 但不再累积。 */
const MAX_STREAM_CAPTURE_BYTES = 1024 * 1024

/** 运行级 abort 原因（`undefined` = 未请求取消）。 */
let abortReason: string | undefined

/** 已登记的活跃子进程 PID（超时 / abort 时按进程树终止）。 */
const trackedPids = new Set<number>()

/**
 * 复位运行级进程控制状态（每次构造 `DependfixApp` 时调用）。
 *
 * 只清状态、**不杀进程**：复位发生在两次运行之间，此时上一次运行的子进程应由其调用方
 * 正常收尾（`runTrackedCommand` 在 close / error 时已注销）。
 */
export function resetProcessControlState(): void {
    abortReason = undefined
    trackedPids.clear()
}

/**
 * 请求运行级取消（幂等）。
 *
 * 首次调用记录原因；**每次调用都终止当前已登记的子进程树**——这样在"平台放弃等待"之后，
 * 正在跑的 install / 验证命令会被立即杀掉，而不是继续与新仓库争抢资源。
 */
export function requestAbort(reason?: string): void {
    if (abortReason === undefined) {
        abortReason = reason ?? 'abort requested'
    }
    killAllTrackedChildProcesses()
}

/** 是否已请求取消（调用方在启动新命令 / 新仓库之前短路）。 */
export function isAbortRequested(): boolean {
    return abortReason !== undefined
}

/** 取消原因（未取消时为 `undefined`）。 */
export function getAbortReason(): string | undefined {
    return abortReason
}

/** 登记活跃子进程 PID（无 PID / 非法 PID 静默忽略——如 spawn 立即失败）。 */
export function trackChildProcess(pid?: number): void {
    if (typeof pid === 'number' && pid > 0) {
        trackedPids.add(pid)
    }
}

/** 注销活跃子进程 PID（进程已退出）。 */
export function untrackChildProcess(pid?: number): void {
    if (typeof pid === 'number' && pid > 0) {
        trackedPids.delete(pid)
    }
}

/**
 * 终止所有已登记的子进程树，返回终止数量。
 *
 * 终止后立即清空登记表：再次调用不会重复 kill（PID 可能已被系统复用）。
 */
export function killAllTrackedChildProcesses(): number {
    let killed = 0
    for (const pid of [...trackedPids]) {
        killProcessTree(pid)
        trackedPids.delete(pid)
        killed++
    }
    return killed
}

/** 当前登记的活跃子进程数量（测试 / 诊断用）。 */
export function trackedChildProcessCount(): number {
    return trackedPids.size
}

/**
 * 终止进程树：POSIX 杀进程组（spawn 时 `detached` 使子进程成为进程组组长），
 * Windows 用 `taskkill /T /F`。失败时静默退化（调用方另有直接 `kill` 兜底）。
 *
 * 单一事实源：verification-runner 的超时终止与本模块的 abort 终止共用此实现。
 */
export function killProcessTree(pid?: number): void {
    if (pid === undefined || pid <= 0) {
        return
    }
    if (process.platform === 'win32') {
        try {
            spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' })
        } catch {
            // taskkill 不可用时由调用方 cp.kill 兜底
        }
    } else {
        try {
            process.kill(-pid, 'SIGKILL')
        } catch {
            // 进程组不存在时由调用方 cp.kill 兜底
        }
    }
}

/** 受管命令执行结果（不抛错——调用方按 `exitCode` / `signal` / `timedOut` 自行判定）。 */
export interface TrackedCommandResult {
    /**
     * 是否真正启动过子进程。
     * `false` = 调用时已处于取消状态 → 命令被跳过（未产生任何子进程），其余字段为占位值。
     */
    started: boolean
    /** 进程退出码（被信号终止 / spawn 失败时为 null） */
    exitCode: number | null
    /** 终止进程的信号（如 `SIGKILL`）；非信号终止时为 null */
    signal: NodeJS.Signals | null
    /** 是否因超过 `timeoutMs` 被本模块终止 */
    timedOut: boolean
    /** 执行期间是否处于"已请求取消"状态（含被 abort 终止） */
    aborted: boolean
    /** spawn 级 errno（如 `ENOENT`——工具链缺失）；无时为 null */
    errno: string | null
    stdout: string
    stderr: string
    durationMs: number
}

/**
 * 是否经 shell 执行（Windows 需要；见模块头「平台差异」）。
 *
 * 抽成纯函数以便用例锁定平台分支：仅 `win32` 返回 true，其余平台 false
 * （POSIX 保持直接 `spawn`，与改造前行为一致）。
 */
export function resolveShellOption(platform: NodeJS.Platform = process.platform): boolean {
    return platform === 'win32'
}

/** `runTrackedCommand` 入参。 */
export interface TrackedCommandParams {
    binary: string
    args: string[]
    cwd: string
    timeoutMs: number
    /** 显式 env（缺省继承父进程环境——与既有 `execFileSync` 语义一致） */
    env?: NodeJS.ProcessEnv
    /** 显式覆盖 shell 行为（缺省按平台：Windows 经 shell，其余平台直接 spawn） */
    shell?: boolean
}

/**
 * 异步执行命令并登记子进程（超时 / abort 时按进程树终止）。
 *
 * **取消前置守卫**：调用时若已请求取消，直接返回 `started: false`（不 spawn）——这是
 * "abort 后不再启动新工作"在安装 / 验证类命令上的**单一入口**（各调用方无需各写一遍）。
 *
 * 与旧 `execFileSync` 的差异（有意为之）：
 * - **不阻塞事件循环**——引擎与平台同进程运行，同步调用会让平台 HTTP、定时器（含执行超时）
 *   与队列全部停摆（实测：超时定时器比设定值晚约 9.5 分钟才触发）
 * - **输出限长累积**：超过 `MAX_STREAM_CAPTURE_BYTES` 后继续 drain（避免子进程写满管道阻塞）
 *   但不再累积，防大输出把内存吃掉
 * - 不抛错：退出码 / 信号 / 超时 / errno 全部经返回值暴露，由调用方决定语义
 */
export function runTrackedCommand(params: TrackedCommandParams): Promise<TrackedCommandResult> {
    if (isAbortRequested()) {
        return Promise.resolve({
            started: false,
            exitCode: null,
            signal: null,
            timedOut: false,
            aborted: true,
            errno: null,
            stdout: '',
            stderr: '',
            durationMs: 0,
        })
    }

    return new Promise((resolve) => {
        const startedAt = Date.now()
        let timedOut = false
        const stdoutChunks: string[] = []
        const stderrChunks: string[] = []
        let stdoutBytes = 0
        let stderrBytes = 0

        const cp = spawn(params.binary, params.args, {
            cwd: params.cwd,
            stdio: 'pipe',
            // Windows 经 shell（`.cmd` 包裹不可直接 spawn）；其余平台保持直接 spawn
            shell: params.shell ?? resolveShellOption(),
            // POSIX 下创建独立进程组，超时 / abort 时可终止整个进程树
            detached: process.platform !== 'win32',
            ...(params.env ? { env: params.env } : {}),
        })

        trackChildProcess(cp.pid)

        const timer = setTimeout(() => {
            timedOut = true
            killProcessTree(cp.pid)
            cp.kill('SIGKILL')
        }, params.timeoutMs)

        const capture = (chunks: string[], bytes: number, data: Buffer): number => {
            const next = bytes + data.byteLength
            if (bytes < MAX_STREAM_CAPTURE_BYTES) {
                chunks.push(data.toString('utf-8'))
            }
            return next
        }

        cp.stdout?.on('data', (data: Buffer) => {
            stdoutBytes = capture(stdoutChunks, stdoutBytes, data)
        })
        cp.stderr?.on('data', (data: Buffer) => {
            stderrBytes = capture(stderrChunks, stderrBytes, data)
        })

        const finish = (result: {
            exitCode: number | null
            signal: NodeJS.Signals | null
            errno?: string | null
        }): void => {
            clearTimeout(timer)
            untrackChildProcess(cp.pid)
            resolve({
                started: true,
                exitCode: result.exitCode,
                signal: result.signal,
                timedOut,
                aborted: isAbortRequested(),
                errno: result.errno ?? null,
                stdout: stdoutChunks.join(''),
                stderr: stderrChunks.join(''),
                durationMs: Date.now() - startedAt,
            })
        }

        cp.on('error', (err: NodeJS.ErrnoException) => {
            finish({ exitCode: null, signal: null, errno: err.code ?? 'UNKNOWN' })
        })
        cp.on('close', (code, signal) => {
            finish({ exitCode: code, signal })
        })
    })
}
