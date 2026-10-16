// abort.test.ts — 运行级取消（`DependfixApp.abort`）的端到端行为。
//
// 覆盖 2026-10-16 生产复盘暴露的缺口：平台执行超时后引擎继续跑（僵尸 install 与后续仓库争抢内存
// → 内核 OOM 级联）。锁定三条可观测行为：
// ① 中止留痕（ABORTED 审计条目，幂等）；
// ② 中止后不再启动新仓库（含"中途取消 → 后续仓库不抓告警"）；
// ③ 中止后不交付（半成品不 commit）。
import { execSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveRuntimeConfig } from '../config'
import { DependfixApp } from './index'

beforeEach(() => {
    nock.disableNetConnect()
})

/** 建一个已提交的空仓库（含 package.json，用于 git 变更判定）。 */
function createGitRepo(): string {
    const workDir = mkdtempSync(join(tmpdir(), 'dependfix-abort-'))
    execSync('git init -q', { cwd: workDir })
    execSync('git config user.name test', { cwd: workDir })
    execSync('git config user.email test@test', { cwd: workDir })
    writeFileSync(join(workDir, 'package.json'), `${JSON.stringify({ name: 't', version: '1.0.0' }, null, 2)}\n`)
    execSync('git add . && git commit -qm init', { cwd: workDir })
    return workDir
}

function fixConfig(repositories: string, overrides: Record<string, unknown> = {}) {
    return resolveRuntimeConfig({
        env: {
            GITHUB_TOKEN: 'token',
            DEPENDFIX_MODE: 'fix',
            DEPENDFIX_REPOSITORIES: repositories,
        },
        cliOverrides: overrides,
    })
}

describe('DependfixApp.abort', () => {
    let workDir: string

    beforeEach(() => {
        workDir = createGitRepo()
    })

    afterEach(() => {
        nock.cleanAll()
        rmSync(workDir, { recursive: true, force: true })
    })

    it('records a single ABORTED audit entry (idempotent) and exits non-zero', async () => {
        const app = new DependfixApp({ config: fixConfig('foo/bar'), workDir, reportOutputDir: join(workDir, 'reports') })

        app.abort('execution timeout')
        app.abort('execution timeout again')

        const { exitCode, result } = await app.run()

        const aborted = result.errors.filter((e) => e.category === 'ABORTED')
        expect(aborted).toHaveLength(1)
        expect(aborted[0].message).toContain('execution timeout')
        // 中止不得被当成成功：无仓库成功 + 存在非跳过类错误 → 2
        expect(exitCode).toBe(2)
    })

    it('starts no repository work when cancelled before the run (no network, no writes)', async () => {
        const app = new DependfixApp({ config: fixConfig('foo/bar'), workDir, reportOutputDir: join(workDir, 'reports') })
        app.abort('execution timeout')

        const { result } = await app.run()

        // 未抓取任何告警（nock.disableNetConnect 下若发生请求会抛错并记 FETCH_FAILED）
        expect(result.repositories).toHaveLength(0)
        expect(result.errors.some((e) => e.category === 'FETCH_FAILED')).toBe(false)
    })

    it('stops starting further repositories when cancelled mid-run', async () => {
        const app = new DependfixApp({ config: fixConfig('foo/bar,foo/baz'), workDir, reportOutputDir: join(workDir, 'reports') })

        nock('https://api.github.com')
            .get('/repos/foo/bar/dependabot/alerts')
            .query({ state: 'open', per_page: '100' })
            .reply(200, () => {
                // 第一个仓库抓告警期间发生取消（模拟平台执行超时）
                app.abort('execution timeout')
                return []
            })
        nock('https://api.github.com')
            .get('/repos/foo/bar')
            .reply(200, { default_branch: 'master' })
        // foo/baz 不 mock：若仍被处理，nock 会拒绝 → 记 FETCH_FAILED，断言可检出

        const { result } = await app.run()

        expect(result.repositories.map((r) => r.repository)).toEqual(['foo/bar'])
        expect(result.errors.some((e) => e.category === 'ABORTED')).toBe(true)
        expect(result.errors.some((e) => e.category === 'FETCH_FAILED')).toBe(false)
    })

    it('skips local commit when cancelled (half-verified workspace must not be delivered)', async () => {
        // 工作区有未提交改动：中止闸门若不生效，commitLocalChanges 会把这些改动提交出去
        const pkgPath = join(workDir, 'package.json')
        writeFileSync(pkgPath, `${readFileSync(pkgPath, 'utf-8').replace('"1.0.0"', '"1.0.1"')}`)
        expect(execSync('git status --porcelain', { cwd: workDir, encoding: 'utf-8' }).trim()).not.toBe('')

        const app = new DependfixApp({
            config: fixConfig('foo/bar', { commit: true }),
            workDir,
            reportOutputDir: join(workDir, 'reports'),
        })
        app.abort('execution timeout')

        const { result } = await app.run()

        // 未产生新提交（仓库仍是初始 1 个 commit），改动保留在工作区
        expect(execSync('git rev-list --count HEAD', { cwd: workDir, encoding: 'utf-8' }).trim()).toBe('1')
        expect(execSync('git status --porcelain', { cwd: workDir, encoding: 'utf-8' })).toContain('package.json')
        expect(result.errors.some((e) => e.category === 'ABORTED')).toBe(true)
        expect(result.errors.some((e) => e.category === 'COMMIT_FAILED')).toBe(false)
    })
})
