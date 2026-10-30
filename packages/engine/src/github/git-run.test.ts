// git-run.test.ts — 交付类 git 命令的受管异步执行契约。
//
// 关注三件事：
// 1. 非 0 退出不抛错（`runGit`）/ 抛 `GitCommandError`（`runGitOrThrow`，含子命令与 stderr 尾部）
// 2. 取消前置守卫：已请求 abort 时不启动新子进程
// 3. 超时映射：超时被终止时 `timedOut=true`，并要求成功时抛错
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { requestAbort, resetProcessControlState, trackedChildProcessCount } from '../runners/process-control'
import { GitCommandError, runGit, runGitOrThrow } from './git-run'

describe('runGit', () => {
    let dir: string

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'dependfix-git-run-'))
    })

    afterEach(() => {
        resetProcessControlState()
        rmSync(dir, { recursive: true, force: true })
    })

    it('成功时返回 stdout 与退出码 0（不抛错）', async () => {
        const result = await runGit(['--version'], { cwd: dir })
        expect(result.started).toBe(true)
        expect(result.code).toBe(0)
        expect(result.stdout).toContain('git version')
        expect(result.aborted).toBe(false)
    })

    it('非 0 退出只经返回值暴露（runGit 不抛错）', async () => {
        const result = await runGit(['rev-parse', '--verify', 'no-such-ref'], { cwd: dir })
        expect(result.code).not.toBe(0)
        expect(result.stderr.length).toBeGreaterThan(0)
    })

    it('已请求取消 → 不启动子进程（started=false / aborted=true）', async () => {
        requestAbort('unit test abort')
        const result = await runGit(['--version'], { cwd: dir })
        expect(result.started).toBe(false)
        expect(result.aborted).toBe(true)
        expect(result.code).toBeNull()
    })

    it('执行中被取消 → 在宽限内落定且无残留子进程（事件循环不被阻塞）', async () => {
        // 模拟「人为阻塞的交付命令」：异步 spawn 的 node 进程空转 60s；
        // 旧实现（同步 exec）会让定时器完全无法触发，这里断言取消能在宽限内生效。
        const startedAt = Date.now()
        const promise = runGit(['-e', 'setTimeout(() => {}, 60_000)'], {
            cwd: dir,
            binary: process.execPath,
            timeoutMs: 120_000,
        })
        setTimeout(() => requestAbort('unit test abort'), 60)
        const result = await promise
        const elapsed = Date.now() - startedAt

        expect(result.started).toBe(true)
        expect(result.aborted).toBe(true)
        expect(elapsed).toBeLessThan(10_000)
        expect(trackedChildProcessCount()).toBe(0)
    }, 20_000)

    it('超时被终止 → timedOut=true', async () => {
        // 用 node 替身模拟「永不结束的交付命令」：git-run 只负责映射受管执行结果
        const result = await runGit(['-e', 'setTimeout(() => {}, 10_000)'], {
            cwd: dir,
            binary: process.execPath,
            timeoutMs: 60,
        })
        expect(result.started).toBe(true)
        expect(result.timedOut).toBe(true)
        expect(result.code).toBeNull()
    }, 10_000)
})

describe('runGitOrThrow', () => {
    let dir: string

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'dependfix-git-run-throw-'))
    })

    afterEach(() => {
        resetProcessControlState()
        rmSync(dir, { recursive: true, force: true })
    })

    it('成功时返回 stdout', async () => {
        await expect(runGitOrThrow(['--version'], { cwd: dir, what: 'probe git' })).resolves.toContain('git version')
    })

    it('失败时抛 GitCommandError（含动作名 / 子命令 / 退出码 / stderr 尾部）', async () => {
        const error = await runGitOrThrow(['rev-parse', '--verify', 'no-such-ref'], {
            cwd: dir,
            what: 'verify ref',
        }).catch((err: unknown) => err)
        expect(error).toBeInstanceOf(GitCommandError)
        const gitError = error as GitCommandError
        expect(gitError.message).toContain('verify ref failed')
        expect(gitError.message).toContain('git rev-parse')
        expect(gitError.message).toContain('exit code 128')
        expect(gitError.args[0]).toBe('rev-parse')
        expect(gitError.code).toBe(128)
        expect(gitError.timedOut).toBe(false)
    })

    it('取消前置守卫拦下时按 aborted 抛错', async () => {
        requestAbort('unit test abort')
        const error = await runGitOrThrow(['--version'], { cwd: dir, what: 'probe git' })
            .catch((err: unknown) => err) as GitCommandError
        expect(error).toBeInstanceOf(GitCommandError)
        expect(error.message).toContain('aborted before start')
        expect(error.aborted).toBe(true)
    })
})
