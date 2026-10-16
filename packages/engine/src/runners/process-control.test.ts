// process-control.test.ts — 运行级取消（abort）与受管子进程。
//
// 覆盖 2026-10-16 生产复盘暴露的缺口：平台执行超时后引擎继续跑（同步 execSync 阻塞事件循环 +
// `withTimeout` 只 race 不中断），僵尸 install 与后续仓库争抢内存 → 内核 OOM 级联。
// 本文件锁定两条行为：① abort 后立即终止已登记子进程树且不再启动新命令；
// ② 受管命令的结果形态（退出码 / 信号 / 超时 / errno / 输出限长）。
import { describe, expect, it, beforeEach } from 'vitest'
import {
    getAbortReason,
    isAbortRequested,
    killAllTrackedChildProcesses,
    requestAbort,
    resetProcessControlState,
    runTrackedCommand,
    trackChildProcess,
    trackedChildProcessCount,
    untrackChildProcess,
} from './process-control'

/** 睡眠命令（真实子进程；用于超时与取消的可观测行为）。 */
function sleepCommand(ms: number): { binary: string, args: string[] } {
    return { binary: process.execPath, args: ['-e', `setTimeout(() => {}, ${ms})`] }
}

beforeEach(() => {
    resetProcessControlState()
})

describe('运行级取消状态', () => {
    it('初始未取消，requestAbort 置位并记录原因', () => {
        expect(isAbortRequested()).toBe(false)
        expect(getAbortReason()).toBeUndefined()

        requestAbort('execution timeout')

        expect(isAbortRequested()).toBe(true)
        expect(getAbortReason()).toBe('execution timeout')
    })

    it('幂等：重复调用保留首次原因', () => {
        requestAbort('first')

        requestAbort('second')

        expect(getAbortReason()).toBe('first')
    })

    it('未提供原因时使用占位文案', () => {
        requestAbort()

        expect(getAbortReason()).toBe('abort requested')
    })

    it('resetProcessControlState 清除取消状态与登记表', () => {
        requestAbort('x')
        trackChildProcess(12345)

        resetProcessControlState()

        expect(isAbortRequested()).toBe(false)
        expect(trackedChildProcessCount()).toBe(0)
    })

    it('trackChildProcess 忽略非法 PID，untrackChildProcess 幂等', () => {
        trackChildProcess(undefined)
        trackChildProcess(0)
        trackChildProcess(-1)
        expect(trackedChildProcessCount()).toBe(0)

        trackChildProcess(4242)
        expect(trackedChildProcessCount()).toBe(1)
        untrackChildProcess(4242)
        untrackChildProcess(4242)
        expect(trackedChildProcessCount()).toBe(0)
    })

    it('无登记子进程时 killAllTrackedChildProcesses 返回 0', () => {
        expect(killAllTrackedChildProcesses()).toBe(0)
    })
})

describe('runTrackedCommand', () => {
    it('成功命令：退出码 0 + 捕获 stdout/stderr + 退出后注销登记', async () => {
        const result = await runTrackedCommand({
            binary: process.execPath,
            args: ['-e', 'console.log("out"); console.error("err")'],
            cwd: process.cwd(),
            timeoutMs: 30_000,
        })

        expect(result.exitCode).toBe(0)
        expect(result.timedOut).toBe(false)
        expect(result.signal).toBeNull()
        expect(result.aborted).toBe(false)
        expect(result.stdout).toContain('out')
        expect(result.stderr).toContain('err')
        expect(trackedChildProcessCount()).toBe(0)
    })

    it('非零退出不抛错（结果形态暴露退出码与 stderr）', async () => {
        const result = await runTrackedCommand({
            binary: process.execPath,
            args: ['-e', 'console.error("boom"); process.exit(3)'],
            cwd: process.cwd(),
            timeoutMs: 30_000,
        })

        expect(result.exitCode).toBe(3)
        expect(result.stderr).toContain('boom')
        expect(result.timedOut).toBe(false)
    })

    it('超过 timeoutMs 时终止（timedOut 标记 + 子进程被杀）', async () => {
        const sleep = sleepCommand(30_000)

        const result = await runTrackedCommand({
            binary: sleep.binary,
            args: sleep.args,
            cwd: process.cwd(),
            timeoutMs: 200,
        })

        expect(result.timedOut).toBe(true)
        expect(result.exitCode).not.toBe(0)
        expect(result.durationMs).toBeLessThan(30_000)
        expect(trackedChildProcessCount()).toBe(0)
        if (process.platform !== 'win32') {
            expect(result.signal).toBe('SIGKILL')
        }
    })

    it('运行中 requestAbort：命令被终止且结果标记 aborted', async () => {
        const sleep = sleepCommand(30_000)
        const pending = runTrackedCommand({
            binary: sleep.binary,
            args: sleep.args,
            cwd: process.cwd(),
            timeoutMs: 30_000,
        })

        // 等子进程真正登记在案再取消（否则取消发生在 spawn 之前，测不到"终止运行中子进程"）
        await waitFor(() => trackedChildProcessCount() > 0)
        requestAbort('execution timeout')

        const result = await pending

        expect(result.aborted).toBe(true)
        expect(result.exitCode).not.toBe(0)
        expect(result.durationMs).toBeLessThan(30_000)
        expect(trackedChildProcessCount()).toBe(0)
    })

    it('工具链缺失：errno 暴露 ENOENT，退出码为 null', async () => {
        const result = await runTrackedCommand({
            binary: 'dependfix-definitely-missing-binary',
            args: [],
            cwd: process.cwd(),
            timeoutMs: 5_000,
        })

        expect(result.exitCode).toBeNull()
        expect(result.signal).toBeNull()
        expect(result.errno).toBe('ENOENT')
    })

    it('大输出限长累积（继续 drain 但不再累积，防大输出吃内存）', async () => {
        const chunk = 'x'.repeat(64 * 1024)
        const result = await runTrackedCommand({
            binary: process.execPath,
            // 输出约 1.5 MiB（> 1 MiB 捕获上限）
            args: ['-e', `for (let i = 0; i < 24; i++) process.stdout.write('${chunk}')`],
            cwd: process.cwd(),
            timeoutMs: 30_000,
        })

        expect(result.exitCode).toBe(0)
        expect(result.stdout.length).toBeGreaterThan(0)
        expect(result.stdout.length).toBeLessThanOrEqual(1024 * 1024 + chunk.length)
    })
})

/** 轮询等待条件成立（避免依赖固定 sleep 的脆弱测试）。 */
async function waitFor(predicate: () => boolean, timeoutMs = 5_000): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (!predicate()) {
        if (Date.now() > deadline) {
            throw new Error('waitFor timeout')
        }
        await new Promise((resolve) => setTimeout(resolve, 10))
    }
}
