// verify-project-mirror.test.ts — `--mirror-ci-scripts` 的命令追加、来源标注、基线与首失败短路。
//
// 从 verify-project.test.ts 拆出：该 describe 已接近 eslint max-lines-per-function 上限，
// 镜像开关是独立行为面（默认关闭），独立文件便于定向回归。
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CiAlignmentRecord } from '@dependfix/core'
import type { CommandResult } from '../runners/verification-runner'
import { type AppContext } from './helpers'
import { sampleVerificationBaseline, verifyProject } from './verify-project'

const verificationRunnerMock = vi.hoisted(() => ({
    runVerification: vi.fn(),
}))

vi.mock('../runners/verification-runner', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../runners/verification-runner')>()
    return {
        ...actual,
        runVerification: verificationRunnerMock.runVerification,
    }
})

const DEFAULT_CHAIN = [
    'pnpm install --frozen-lockfile',
    'pnpm lint',
    'pnpm build',
    'pnpm typecheck',
    'pnpm test',
]

describe('verifyProject --mirror-ci-scripts', () => {
    let workDir: string

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), 'dependfix-verify-mirror-'))
        verificationRunnerMock.runVerification.mockReset()
        verificationRunnerMock.runVerification.mockResolvedValue({ success: true, commandResults: [] })
    })

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true })
    })

    function makeVerifyCtx(
        customCommands?: string[],
        mirrorCiScripts?: boolean,
    ): Pick<AppContext, 'config' | 'customCommands' | 'logger' | 'workDir' | 'allErrors'> {
        return {
            config: { mirrorCiScripts } as AppContext['config'],
            customCommands,
            logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as AppContext['logger'],
            workDir,
            allErrors: [],
        }
    }

    /** 写入带 CI 脚本的 fixture 仓库（默认链脚本齐全 + coverage / e2e） */
    function writeMirrorFixture(steps?: string[]): void {
        mkdirSync(join(workDir, '.github', 'workflows'), { recursive: true })
        writeFileSync(join(workDir, 'package.json'), JSON.stringify({
            name: 'fixture',
            version: '1.0.0',
            scripts: {
                lint: 'eslint .',
                build: 'tsc',
                typecheck: 'tsc --noEmit',
                test: 'vitest run',
                coverage: 'vitest run --coverage',
                e2e: 'playwright test',
            },
        }))
        writeFileSync(join(workDir, '.github', 'workflows', 'ci.yml'), [
            'jobs:',
            '  ci:',
            '    steps:',
            ...(steps ?? ['pnpm lint', 'pnpm build', 'pnpm test', 'pnpm run coverage', 'docker build -t app .'])
                .map((step) => `      - run: ${step}`),
        ].join('\n'))
    }

    /** 按传入命令逐条返回结果；`failed` 指定失败命令（模拟首失败短路） */
    function mockMirrorRun(failed?: string) {
        verificationRunnerMock.runVerification.mockImplementation(async ({ commands }: { commands: string[] }) => {
            const results = commands.map((command) => ({
                command,
                exitCode: command === failed ? 1 : 0,
                durationMs: 1,
                stdout: '',
                stderr: command === failed ? 'failed' : '',
            }))
            const failureIndex = results.findIndex((item) => item.exitCode !== 0)
            if (failureIndex >= 0) {
                return {
                    success: false,
                    commandResults: results.slice(0, failureIndex + 1),
                    failedCommand: results[failureIndex].command,
                    failure: 'failed',
                }
            }
            return { success: true, commandResults: results }
        })
    }

    it('开启 mirror 时在默认链后追加 CI 独有脚本，并逐条标注 source', async () => {
        writeMirrorFixture()
        mockMirrorRun()
        const ctx = makeVerifyCtx(undefined, true)

        const actions = await verifyProject(ctx, 'foo/bar')

        expect(verificationRunnerMock.runVerification.mock.calls[0][0].commands).toEqual([
            ...DEFAULT_CHAIN,
            'pnpm run coverage',
        ])
        expect(actions.map((action) => [action.target, action.commandSource])).toEqual([
            ['pnpm install --frozen-lockfile', 'default'],
            ['pnpm lint', 'default'],
            ['pnpm build', 'default'],
            ['pnpm typecheck', 'default'],
            ['pnpm test', 'default'],
            ['pnpm run coverage', 'ci-mirror'],
        ])
    })

    it('自定义链优先：开启 mirror 也不叠加（不猜测用户意图）', async () => {
        writeMirrorFixture()
        mockMirrorRun()
        const ctx = makeVerifyCtx(['pnpm test'], true)

        const actions = await verifyProject(ctx, 'foo/bar')

        expect(verificationRunnerMock.runVerification.mock.calls[0][0].commands).toEqual(['pnpm test'])
        expect(actions.map((action) => action.commandSource)).toEqual(['repo-config'])
    })

    it('mirror 命令纳入修复前基线采样（与修复后同一命令口径）', async () => {
        writeMirrorFixture()
        mockMirrorRun()
        const ctx = makeVerifyCtx(undefined, true)

        const baseline = await sampleVerificationBaseline(ctx, 'foo/bar')

        expect(verificationRunnerMock.runVerification.mock.calls[0][0]).toMatchObject({
            stopOnFailure: false,
            commands: [...DEFAULT_CHAIN, 'pnpm run coverage'],
        })
        expect(baseline?.map((item) => item.command)).toContain('pnpm run coverage')
    })

    it('mirror 命令基线已红 → preExisting（不归因本次改动）', async () => {
        writeMirrorFixture()
        mockMirrorRun('pnpm run coverage')
        const ctx = makeVerifyCtx(undefined, true)
        const baseline: CommandResult[] = [...DEFAULT_CHAIN, 'pnpm run coverage'].map((command) => ({
            command,
            exitCode: command === 'pnpm run coverage' ? 1 : 0,
            durationMs: 1,
            stdout: '',
            stderr: '',
        }))

        const actions = await verifyProject(ctx, 'foo/bar', { baseline })

        const coverage = actions.find((action) => action.target === 'pnpm run coverage')
        expect(coverage?.success).toBe(false)
        expect(coverage?.preExisting).toBe(true)
        expect(coverage?.commandSource).toBe('ci-mirror')
        expect(ctx.allErrors).toEqual([expect.objectContaining({
            repository: 'foo/bar', category: 'PRE_EXISTING_FAILURE', target: 'pnpm run coverage',
        })])
    })

    it('mirror 基线绿但本次失败 → 不标 preExisting，归因本次改动', async () => {
        writeMirrorFixture()
        mockMirrorRun('pnpm run coverage')
        const ctx = makeVerifyCtx(undefined, true)
        const baseline: CommandResult[] = [...DEFAULT_CHAIN, 'pnpm run coverage'].map((command) => ({
            command,
            exitCode: 0,
            durationMs: 1,
            stdout: '',
            stderr: '',
        }))

        const actions = await verifyProject(ctx, 'foo/bar', { baseline })

        const coverage = actions.find((action) => action.target === 'pnpm run coverage')
        expect(coverage?.success).toBe(false)
        expect(coverage?.preExisting).toBeUndefined()
        expect(coverage?.commandSource).toBe('ci-mirror')
        expect(ctx.allErrors.some((error) => error.category === 'PRE_EXISTING_FAILURE')).toBe(false)
    })

    it('默认链首失败短路 → mirror 未执行，记录只含实际执行集（不可断言已镜像）', async () => {
        writeMirrorFixture()
        mockMirrorRun('pnpm lint')
        const ctx = { ...makeVerifyCtx(undefined, true), ciAlignment: [] as CiAlignmentRecord[] }

        const actions = await verifyProject(ctx, 'foo/bar', { ciAlignment: { client: null } })

        expect(actions.map((action) => action.target)).toEqual(['pnpm install --frozen-lockfile', 'pnpm lint'])
        expect(ctx.ciAlignment[0].commands).toEqual(['pnpm install --frozen-lockfile', 'pnpm lint'])
        expect(ctx.ciAlignment[0].mirrored).toEqual([])
        expect(ctx.ciAlignment[0].mirrorSkipped).toEqual([
            { command: 'docker build -t app .', reason: 'unsupported-command' },
        ])
    })

    it('镜像执行后记录 mirrored；重新验证取并集（同一次运行多次验证）', async () => {
        writeMirrorFixture()
        mockMirrorRun()
        const ctx = { ...makeVerifyCtx(undefined, true), ciAlignment: [] as CiAlignmentRecord[] }

        await verifyProject(ctx, 'foo/bar', { ciAlignment: { client: null } })
        await verifyProject(ctx, 'foo/bar', { ciAlignment: { client: null } })

        expect(ctx.ciAlignment).toHaveLength(1)
        expect(ctx.ciAlignment[0].mirrored).toEqual(['pnpm run coverage'])
        expect(ctx.ciAlignment[0].commands).toContain('pnpm run coverage')
    })

    it('首次短路未执行 mirror、重验后执行 → 记录更新为实际执行集（不得保留 0 条）', async () => {
        writeMirrorFixture()
        const ctx = { ...makeVerifyCtx(undefined, true), ciAlignment: [] as CiAlignmentRecord[] }

        // 首轮：默认链在 lint 短路，mirror 未 spawn
        mockMirrorRun('pnpm lint')
        await verifyProject(ctx, 'foo/bar', { ciAlignment: { client: null } })
        expect(ctx.ciAlignment[0].commands).toEqual(['pnpm install --frozen-lockfile', 'pnpm lint'])
        expect(ctx.ciAlignment[0].mirrored).toEqual([])

        // 次轮（单元回滚后重验）：全链通过并跑到 mirror
        mockMirrorRun()
        await verifyProject(ctx, 'foo/bar', { ciAlignment: { client: null } })

        expect(ctx.ciAlignment).toHaveLength(1)
        expect(ctx.ciAlignment[0].mirrored).toEqual(['pnpm run coverage'])
        expect(ctx.ciAlignment[0].commands).toContain('pnpm run coverage')
    })

    it('关闭 mirror 时命令链与现状等价（不产生 mirrored / mirrorSkipped）', async () => {
        writeMirrorFixture()
        mockMirrorRun()
        const ctx = { ...makeVerifyCtx(undefined, false), ciAlignment: [] as CiAlignmentRecord[] }

        await verifyProject(ctx, 'foo/bar', { ciAlignment: { client: null } })

        expect(verificationRunnerMock.runVerification.mock.calls[0][0].commands).toEqual(DEFAULT_CHAIN)
        expect(ctx.ciAlignment[0].mirrored).toBeUndefined()
        expect(ctx.ciAlignment[0].mirrorSkipped).toBeUndefined()
    })

    it('CI 解析失败原因进日志前折叠为单行（多行 YAML 片段不得污染日志）', async () => {
        mkdirSync(join(workDir, '.github', 'workflows'), { recursive: true })
        writeFileSync(join(workDir, 'package.json'), JSON.stringify({ name: 'fixture', scripts: { lint: 'eslint .' } }))
        writeFileSync(join(workDir, '.github', 'workflows', 'ci.yml'), 'jobs:\n  ci:\n    steps:\n      - run: [oops\n        bad: :::\n')
        mockMirrorRun()
        const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
        const ctx = {
            ...makeVerifyCtx(undefined, true),
            logger: logger as unknown as AppContext['logger'],
            ciAlignment: [] as CiAlignmentRecord[],
        }

        await verifyProject(ctx, 'foo/bar', { ciAlignment: { client: null } })

        const line = logger.info.mock.calls.map((call) => String(call[0]))
            .find((message) => message.includes('[ci-alignment]'))
        expect(line).toBeDefined()
        expect(line).not.toContain('\n')
    })
})
