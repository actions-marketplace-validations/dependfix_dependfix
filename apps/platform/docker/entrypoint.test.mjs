import { spawn } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

/**
 * entrypoint.sh 队列 worker 看护行为测试（任务登记见 docs/plan/todo-archive.md §M40.4）。
 *
 * 以真实 shell 执行 entrypoint.sh，通过 PATH 注入 id / sleep / date 桩：
 * - id 桩固定返回非 root（100/101），绕过降权链路，聚焦进程编排；
 * - sleep 桩置零，使崩溃重启在测试内即时发生；
 * - date 桩（仅稳定性场景）让运行时长快进到稳定窗口之上。
 * 命令桩（stub）以 NUXT_IN_PROCESS_WORKER 区分 worker / HTTP 两种身份。
 *
 * 仅 POSIX shell 环境运行（Windows 跳过；CI 为 ubuntu）。
 */

const skipOnWindows = process.platform === 'win32'
const entrypointPath = join(dirname(fileURLToPath(import.meta.url)), 'entrypoint.sh')

const active = []

const writeExecutable = (path, content) => {
    writeFileSync(path, content)
    chmodSync(path, 0o755)
}

const makeStub = (root, body) => {
    const path = join(root, 'stub.sh')
    writeExecutable(path, `#!/bin/sh\n${body}\n`)
    return path
}

const makeShims = (root, { dateShim = false } = {}) => {
    const bin = join(root, 'bin')
    mkdirSync(bin)
    writeExecutable(join(bin, 'id'), `#!/bin/sh
case "$*" in
    *-u*) echo 100 ;;
    *-g*) echo 101 ;;
    *) echo "uid=100(test) gid=101(test)" ;;
esac
`)
    // 退避 sleep 置零：崩溃重启即时发生，避免测试等待
    writeExecutable(join(bin, 'sleep'), `#!/bin/sh
exit 0
`)
    if (dateShim) {
        const counter = join(root, 'date-counter')
        writeFileSync(counter, '0')
        writeExecutable(join(bin, 'date'), `#!/bin/sh
case "$*" in
    *%s*)
        n="$(cat '${counter}')"
        n=$(( n + 120 ))
        printf '%s\\n' "$n" > '${counter}'
        printf '%s\\n' "$n"
        ;;
    *)
        printf '%s\\n' "2026-01-01T00:00:00Z"
        ;;
esac
`)
    }
    return bin
}

const start = ({ stub, env = {}, dateShim = false }) => {
    const root = mkdtempSync(join(tmpdir(), 'entrypoint-test-'))
    const bin = makeShims(root, { dateShim })
    const dataDir = join(root, 'data')
    const homeDir = join(root, 'home')
    mkdirSync(dataDir)
    mkdirSync(homeDir)
    const stubPath = makeStub(root, stub)

    const baseEnv = { ...process.env }
    delete baseEnv.DEPENDFIX_QUEUE_WORKER
    delete baseEnv.NUXT_QUEUE_ENABLED
    // 角色由入口注入（单进程形态不注入）：清理宿主环境残留，保证三态断言确定性
    delete baseEnv.DEPENDFIX_ROLE

    const child = spawn('sh', [entrypointPath, stubPath], {
        env: {
            ...baseEnv,
            PATH: `${bin}:${process.env.PATH}`,
            DATA_DIR: dataDir,
            HOME: homeDir,
            DEPENDFIX_ALLOW_ANY_DIR: '1',
            DEPENDFIX_QUEUE_WORKER_SOCKET: join(root, 'worker.sock'),
            ...env,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    })

    let output = ''
    child.stdout.on('data', (chunk) => {
        output += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
        output += chunk.toString()
    })

    const handle = { child, root, output: () => output, exited: undefined }
    child.on('exit', (code, signal) => {
        handle.exited = { code, signal }
    })
    active.push(handle)
    return handle
}

const waitFor = async (predicate, { timeout = 5000, interval = 10 } = {}) => {
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
        if (predicate()) {
            return
        }
        await new Promise((resolve) => setTimeout(resolve, interval))
    }
    throw new Error('waitFor 超时')
}

const waitExit = (handle) => {
    if (handle.exited) {
        return Promise.resolve(handle.exited)
    }
    return new Promise((resolve) => {
        handle.child.on('exit', (code, signal) => resolve({ code, signal }))
    })
}

const terminate = async (handle) => {
    handle.child.kill('SIGTERM')
    return waitExit(handle)
}

const alive = (pid) => {
    try {
        process.kill(pid, 0)
        return true
    } catch {
        return false
    }
}

afterEach(() => {
    for (const handle of active.splice(0)) {
        try {
            handle.child.kill('SIGKILL')
        } catch {
            /* 进程可能已退出 */
        }
        rmSync(handle.root, { recursive: true, force: true })
    }
})

describe.skipIf(skipOnWindows)('entrypoint.sh 队列 worker 看护', () => {
    it('默认单进程形态：未设 DEPENDFIX_QUEUE_WORKER 时直接执行命令', async () => {
        const handle = start({
            stub: 'echo single-mode-marker\nexit 0',
            env: { DEPENDFIX_QUEUE_WORKER: '0' },
        })
        const { code } = await waitExit(handle)
        expect(code).toBe(0)
        expect(handle.output()).toContain('single-mode-marker')
        expect(handle.output()).not.toContain('看护进程')
    })

    it('worker 与强制同步冲突：warn 后降级单进程', async () => {
        const handle = start({
            stub: 'echo conflict-marker\nexit 0',
            env: { DEPENDFIX_QUEUE_WORKER: '1', NUXT_QUEUE_ENABLED: 'false' },
        })
        const { code } = await waitExit(handle)
        expect(code).toBe(0)
        expect(handle.output()).toContain('冲突，跳过独立 worker 进程')
        expect(handle.output()).toContain('conflict-marker')
        expect(handle.output()).not.toContain('看护进程')
    })

    it('双进程形态：启动看护循环，容器停止时清理 worker 与看护', async () => {
        const handle = start({
            stub: 'if [ "$NUXT_IN_PROCESS_WORKER" = "true" ]; then\n    exec tail -f /dev/null\nfi\nexec tail -f /dev/null',
            env: { DEPENDFIX_QUEUE_WORKER: '1', NUXT_QUEUE_ENABLED: 'true' },
        })
        await waitFor(() => /看护进程 pid=\d+/.test(handle.output()))
        await waitFor(() => /队列 worker 进程 pid=\d+/.test(handle.output()))
        const supervisorPid = Number(handle.output().match(/看护进程 pid=(\d+)/)[1])
        const workerPid = Number(handle.output().match(/队列 worker 进程 pid=(\d+)/)[1])
        expect(Number.isFinite(supervisorPid)).toBe(true)
        expect(Number.isFinite(workerPid)).toBe(true)

        const { code, signal } = await terminate(handle)
        // signal 非 null 说明 TERM 落在 trap 安装之前（默认处置下 PID 1 直接被终止）；安装顺序约束见 entrypoint.sh
        expect({ code, signal }, '容器停止须由 entrypoint 转发 TERM 并以 143 退出').toEqual({ code: 143, signal: null })
        // 容器停止后 worker 与看护循环均被终止（不再留驻），且不再触发重启
        await waitFor(() => !alive(supervisorPid))
        await waitFor(() => !alive(workerPid))
        expect(handle.output()).not.toContain('次重启')
    })

    it('角色注入：父进程未预置角色时，worker 子进程收到 worker、HTTP 主进程收到 server', async () => {
        const handle = start({
            stub: 'if [ "$NUXT_IN_PROCESS_WORKER" = "true" ]; then\n    echo "role-marker worker=[$DEPENDFIX_ROLE]"\n    exec tail -f /dev/null\nfi\necho "role-marker http=[$DEPENDFIX_ROLE]"\nexec tail -f /dev/null',
            // 不预置 DEPENDFIX_ROLE（start() 已清理宿主残留）：worker 侧取值只可能来自入口注入
            env: { DEPENDFIX_QUEUE_WORKER: '1', NUXT_QUEUE_ENABLED: 'true' },
        })
        await waitFor(() => handle.output().includes('role-marker worker=[worker]'))
        await waitFor(() => handle.output().includes('role-marker http=[server]'))
        const output = handle.output()
        expect(output).toContain('role-marker worker=[worker]')
        expect(output).toContain('role-marker http=[server]')
        await terminate(handle)
    })

    it('角色归一化：父进程预置未识别值时两进程均被入口归一化（注入点唯一）', async () => {
        const handle = start({
            stub: 'if [ "$NUXT_IN_PROCESS_WORKER" = "true" ]; then\n    echo "role-marker worker=[$DEPENDFIX_ROLE]"\n    exec tail -f /dev/null\nfi\necho "role-marker http=[$DEPENDFIX_ROLE]"\nexec tail -f /dev/null',
            env: { DEPENDFIX_QUEUE_WORKER: '1', NUXT_QUEUE_ENABLED: 'true', DEPENDFIX_ROLE: 'queue' },
        })
        // 两份标记的输出顺序不作保证（看护循环与 HTTP 主进程异步启动）：到齐后再取快照，避免只等到 http 就断言 worker
        await waitFor(() => handle.output().includes('role-marker http=[server]'))
        await waitFor(() => handle.output().includes('role-marker worker=[worker]'))
        const output = handle.output()
        expect(output).toContain('role-marker worker=[worker]')
        expect(output).toContain('role-marker http=[server]')
        expect(output).not.toContain('role-marker http=[queue]')
        await terminate(handle)
    })

    it('单进程形态：入口归一化为 server（外部误设 worker 不生效，不跳过任何插件）', async () => {
        const handle = start({
            stub: 'echo "single-role=[$DEPENDFIX_ROLE]"\nexit 0',
            env: { DEPENDFIX_QUEUE_WORKER: '0', DEPENDFIX_ROLE: 'worker' },
        })
        const { code } = await waitExit(handle)
        expect(code).toBe(0)
        expect(handle.output()).toContain('single-role=[server]')
    })

    it('单进程形态：未预置角色时同样归一化为 server', async () => {
        const handle = start({
            stub: 'echo "single-role=[$DEPENDFIX_ROLE]"\nexit 0',
            env: { DEPENDFIX_QUEUE_WORKER: '0' },
        })
        const { code } = await waitExit(handle)
        expect(code).toBe(0)
        expect(handle.output()).toContain('single-role=[server]')
    })

    it('worker 崩溃：自动重启并记录退出码 / 次数 / 时间', async () => {
        const handle = start({
            stub: 'if [ "$NUXT_IN_PROCESS_WORKER" = "true" ]; then\n    exit 3\nfi\nexec tail -f /dev/null',
            env: { DEPENDFIX_QUEUE_WORKER: '1', NUXT_QUEUE_ENABLED: 'true' },
        })
        await waitFor(() => handle.output().includes('第 1 次重启'))
        const output = handle.output()
        expect(output).toContain('exit=3')
        expect(output).toContain('退避 1s')
        expect(output).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/)
        await terminate(handle)
    })

    it('连续重启超过上限：停止自动重启且 HTTP 进程不受影响', async () => {
        const handle = start({
            stub: 'if [ "$NUXT_IN_PROCESS_WORKER" = "true" ]; then\n    exit 7\nfi\nexec tail -f /dev/null',
            env: { DEPENDFIX_QUEUE_WORKER: '1', NUXT_QUEUE_ENABLED: 'true' },
        })
        await waitFor(() => handle.output().includes('停止自动重启'))
        const output = handle.output()
        expect(output).toContain('连续重启 5 次')
        expect(output).toContain('exit=7')
        expect(output.match(/第 \d+ 次重启/g)).toHaveLength(5)
        await terminate(handle)
    })

    it('worker 稳定运行后崩溃：连续重启计数归零（不触发上限）', async () => {
        const handle = start({
            stub: 'if [ "$NUXT_IN_PROCESS_WORKER" = "true" ]; then\n    exit 1\nfi\nexec tail -f /dev/null',
            env: { DEPENDFIX_QUEUE_WORKER: '1', NUXT_QUEUE_ENABLED: 'true' },
            dateShim: true,
        })
        // 稳定窗口（60s）快进后每次崩溃都视为「首次连续重启」，计数归零 → 永远停留在第 1 次
        await waitFor(() => (handle.output().match(/第 \d+ 次重启/g) || []).length >= 6)
        const output = handle.output()
        expect(output).not.toContain('停止自动重启')
        expect(output).not.toContain('第 2 次重启')
        await terminate(handle)
    })

    // 竞态守卫（静态）：上面「双进程形态」用例以「看护进程 pid」公告行为同步点发信号，若 trap 晚于该公告行安装，
    // 信号即落在默认处置窗口内（PID 1 直接被终止 → 退出码为 null 而非 143）。该窗口只在特定调度下出现，
    // 运行期用例无法稳定复现（CI 曾偶发红），故把「安装先于启动子进程与就绪输出」固化为源码顺序断言。
    // entrypoint 内的 fail-safe 分支（MAIN_PID 未赋值即退出）同样不可确定性触发，登记为已知边界（见 platform.md §10.6）。
    it('信号处置顺序：TERM / INT trap 先于子进程启动与「看护进程 pid」公告行', () => {
        const source = readFileSync(entrypointPath, 'utf8')
        const trapIndex = source.search(/^[ \t]*trap '[^']*stop_queue_worker[^']*' TERM INT$/m)
        const spawnIndex = source.indexOf('supervise_queue_worker "$prefix" "$@" &')
        const announceIndex = source.indexOf('看护进程 pid=${SUPERVISOR_PID}')
        expect(trapIndex).toBeGreaterThan(-1)
        expect(spawnIndex).toBeGreaterThan(-1)
        expect(announceIndex).toBeGreaterThan(-1)
        expect(trapIndex).toBeLessThan(spawnIndex)
        expect(spawnIndex).toBeLessThan(announceIndex)
    })
})
