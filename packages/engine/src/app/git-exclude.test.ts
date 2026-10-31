import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Logger } from '@dependfix/core'
import { resolveRuntimeConfig } from '../config'
import { GIT_EXCLUDE_ENTRIES, GIT_EXCLUDE_MARKER, ensureGitExclude, prepareDeliveryHygiene, resolveGitDir } from './git-exclude'
import { DependfixApp } from './index'

/**
 * 交付提交卫生：`git/info/exclude` 预置安装产物排除条目。
 *
 * 覆盖：幂等追加 / 语义等价写法 / 取反行撤销 / 不改 `.gitignore` / 非 git 目录静默跳过 /
 * 子目录与工作树解析 / 写入失败上报 / 真实 `git add .` 后暂存区不含安装产物。
 */

const git = (cwd: string, args: string[]) => execFileSync('git', args, { cwd, stdio: 'pipe' })

/** commit 显式关签名：宿主 `commit.gpgsign=true` 会让用例失败（与 stageAndCommit 同口径）。 */
const commitAll = (cwd: string, message: string) => git(cwd, ['-c', 'commit.gpgsign=false', 'commit', '-q', '-m', message])

const readExclude = (workDir: string) => readFileSync(join(workDir, '.git', 'info', 'exclude'), 'utf-8')

describe('ensureGitExclude', () => {
    let workDir: string

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), 'dependfix-git-exclude-'))
        git(workDir, ['init', '-q'])
        // git init 自带一段注释模板；清空以锁定追加形态断言
        writeFileSync(join(workDir, '.git', 'info', 'exclude'), '', 'utf-8')
    })

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true })
    })

    it('appends both install artifacts with a marker on first call', () => {
        expect(ensureGitExclude(workDir)).toEqual({ added: [...GIT_EXCLUDE_ENTRIES] })
        expect(readExclude(workDir)).toBe(`${GIT_EXCLUDE_MARKER}\n.pnpm-store/\nnode_modules/\n`)
    })

    it('is idempotent across repeated calls (byte-identical file)', () => {
        ensureGitExclude(workDir)
        const once = readExclude(workDir)

        expect(ensureGitExclude(workDir)).toEqual({ added: [] })
        expect(readExclude(workDir)).toBe(once)
        expect(once.match(new RegExp(GIT_EXCLUDE_MARKER, 'g'))).toHaveLength(1)
    })

    it.each([
        [['/node_modules', '.pnpm-store/']],
        [['node_modules/', '.pnpm-store']],
        [['**/node_modules/', '/.pnpm-store/']],
        [['node_modules/**', '.pnpm-store/**']],
    ])('treats equivalent exclude forms as present and appends nothing', (lines) => {
        const original = `${lines.join('\n')}\n`
        writeFileSync(join(workDir, '.git', 'info', 'exclude'), original, 'utf-8')

        expect(ensureGitExclude(workDir)).toEqual({ added: [] })
        expect(readExclude(workDir)).toBe(original)
    })

    it('appends only the missing entry when one is already ignored', () => {
        writeFileSync(join(workDir, '.git', 'info', 'exclude'), 'node_modules\n', 'utf-8')

        expect(ensureGitExclude(workDir)).toEqual({ added: ['.pnpm-store/'] })
        expect(readExclude(workDir)).toBe(`node_modules\n${GIT_EXCLUDE_MARKER}\n.pnpm-store/\n`)
    })

    it('re-adds an entry that a later negation rule cancels (git last-match-wins)', () => {
        // `!node_modules` 在 `node_modules/` 之后出现 → git 判定未忽略；只判断「存在匹配行」会漏排除
        writeFileSync(join(workDir, '.git', 'info', 'exclude'), 'node_modules/\n!node_modules\n', 'utf-8')

        expect(ensureGitExclude(workDir)).toEqual({ added: [...GIT_EXCLUDE_ENTRIES] })
        expect(ensureGitExclude(workDir)).toEqual({ added: [] })
        expect(readExclude(workDir).endsWith('.pnpm-store/\nnode_modules/\n')).toBe(true)
    })

    it('preserves existing user content and never creates the tracked .gitignore', () => {
        writeFileSync(join(workDir, '.git', 'info', 'exclude'), '# user rule\n*.log\n', 'utf-8')

        ensureGitExclude(workDir)

        expect(readExclude(workDir)).toBe(`# user rule\n*.log\n${GIT_EXCLUDE_MARKER}\n.pnpm-store/\nnode_modules/\n`)
        expect(existsSync(join(workDir, '.gitignore'))).toBe(false)
    })

    it('appends safely when the file has no trailing newline or uses CRLF', () => {
        const excludePath = join(workDir, '.git', 'info', 'exclude')
        writeFileSync(excludePath, '*.log', 'utf-8')
        ensureGitExclude(workDir)
        expect(readExclude(workDir)).toBe(`*.log\n${GIT_EXCLUDE_MARKER}\n.pnpm-store/\nnode_modules/\n`)

        writeFileSync(excludePath, '*.log\r\n', 'utf-8')
        // CRLF 内容同样按行解析：两个条目都缺失 → 补齐后即稳定
        expect(ensureGitExclude(workDir)).toEqual({ added: [...GIT_EXCLUDE_ENTRIES] })
        expect(ensureGitExclude(workDir)).toEqual({ added: [] })
    })

    it.each([
        ['注释行', '# node_modules/'],
        ['前导空白（属于模式本身）', ' node_modules/'],
        ['行中注释（不生效）', 'node_modules/ # keep'],
    ])('does not treat %s as an existing exclusion', (_label, line) => {
        writeFileSync(join(workDir, '.git', 'info', 'exclude'), `${line}\n`, 'utf-8')

        expect(ensureGitExclude(workDir)).toEqual({ added: [...GIT_EXCLUDE_ENTRIES] })
    })

    it('supports a custom entry list', () => {
        expect(ensureGitExclude(workDir, ['coverage/'])).toEqual({ added: ['coverage/'] })
        expect(readExclude(workDir)).toBe(`${GIT_EXCLUDE_MARKER}\ncoverage/\n`)
    })

    it('skips silently outside a git repository', () => {
        const plain = mkdtempSync(join(tmpdir(), 'dependfix-no-git-'))
        try {
            expect(ensureGitExclude(plain)).toEqual({ added: [] })
            expect(existsSync(join(plain, '.git'))).toBe(false)
        } finally {
            rmSync(plain, { recursive: true, force: true })
        }
    })

    it('reports a write failure instead of swallowing it', () => {
        // `info/exclude` 是目录 → 写入失败：返回 error（调用方 warn），不抛异常
        const excludePath = join(workDir, '.git', 'info', 'exclude')
        rmSync(excludePath, { force: true })
        mkdirSync(excludePath)

        const result = ensureGitExclude(workDir)

        expect(result.added).toEqual([])
        expect(result.error).toBeTruthy()
    })

    it('resolves the repository root from a subdirectory (CLI runs in nested packages)', () => {
        const nested = join(workDir, 'packages', 'app')
        mkdirSync(nested, { recursive: true })

        expect(resolveGitDir(nested)).toBe(join(workDir, '.git'))
        expect(ensureGitExclude(nested)).toEqual({ added: [...GIT_EXCLUDE_ENTRIES] })
        expect(readExclude(workDir)).toContain('node_modules/')
    })

    it('stages only real changes after `git add .` (install artifacts stay untracked)', () => {
        mkdirSync(join(workDir, 'node_modules', 'pkg'), { recursive: true })
        mkdirSync(join(workDir, '.pnpm-store', 'v11'), { recursive: true })
        mkdirSync(join(workDir, 'src'), { recursive: true })
        writeFileSync(join(workDir, 'node_modules', 'pkg', 'index.js'), 'module.exports = 1\n', 'utf-8')
        writeFileSync(join(workDir, '.pnpm-store', 'v11', 'blob'), 'blob\n', 'utf-8')
        writeFileSync(join(workDir, 'src', 'app.ts'), 'export const a = 1\n', 'utf-8')

        ensureGitExclude(workDir)
        git(workDir, ['add', '.'])

        expect(String(git(workDir, ['diff', '--cached', '--name-only']))).toBe('src/app.ts\n')
        expect(String(git(workDir, ['status', '--porcelain']))).toBe('A  src/app.ts\n')
    })
})

describe('resolveGitDir', () => {
    let root: string

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'dependfix-gitdir-'))
    })

    afterEach(() => {
        rmSync(root, { recursive: true, force: true })
    })

    it('returns the .git directory for a regular repository', () => {
        const workDir = join(root, 'repo')
        mkdirSync(workDir)
        git(workDir, ['init', '-q'])

        expect(resolveGitDir(workDir)).toBe(join(workDir, '.git'))
    })

    it('resolves the common dir for a worktree (`.git` is a file)', () => {
        const main = join(root, 'main')
        mkdirSync(main)
        git(main, ['init', '-q'])
        git(main, ['config', 'user.name', 'test'])
        git(main, ['config', 'user.email', 'test@example.com'])
        writeFileSync(join(main, 'README.md'), 'x\n', 'utf-8')
        git(main, ['add', '.'])
        commitAll(main, 'init')

        const worktree = join(root, 'wt')
        git(main, ['worktree', 'add', '-q', worktree, '-b', 'wt-branch'])

        expect(resolveGitDir(worktree)).toBe(join(main, '.git'))
        expect(ensureGitExclude(worktree)).toEqual({ added: [...GIT_EXCLUDE_ENTRIES] })
        expect(readFileSync(join(main, '.git', 'info', 'exclude'), 'utf-8')).toContain('node_modules/')
    })

    it('returns undefined outside a repository', () => {
        const plain = join(root, 'plain')
        mkdirSync(plain)
        expect(resolveGitDir(plain)).toBeUndefined()
    })

    it('returns undefined when the `.git` pointer is unparsable', () => {
        const broken = join(root, 'broken')
        mkdirSync(broken)
        writeFileSync(join(broken, '.git'), 'not a gitdir pointer\n', 'utf-8')
        expect(resolveGitDir(broken)).toBeUndefined()
    })
})

describe('prepareDeliveryHygiene 模式闸门', () => {
    let workDir: string
    const logger = { info: vi.fn(), warn: vi.fn() }

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), 'dependfix-hygiene-'))
        git(workDir, ['init', '-q'])
        writeFileSync(join(workDir, '.git', 'info', 'exclude'), '', 'utf-8')
        logger.info.mockClear()
        logger.warn.mockClear()
    })

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true })
    })

    it.each(['fix', 'fix-and-pr'] as const)('prepares exclude for %s', (mode) => {
        prepareDeliveryHygiene(workDir, { mode, dryRun: false }, logger)

        expect(readExclude(workDir)).toContain('node_modules/')
        expect(logger.info).toHaveBeenCalledTimes(1)
    })

    it.each(['report-only', 'cleanup-branches'] as const)('skips exclude for %s', (mode) => {
        prepareDeliveryHygiene(workDir, { mode, dryRun: false }, logger)

        expect(readExclude(workDir)).toBe('')
        expect(logger.info).not.toHaveBeenCalled()
    })

    it('skips exclude for a dry run even in fix mode', () => {
        prepareDeliveryHygiene(workDir, { mode: 'fix', dryRun: true }, logger)

        expect(readExclude(workDir)).toBe('')
    })
})

describe('DependfixApp run 起始预置 exclude', () => {
    let workDir: string
    const logs: string[] = []
    const warns: string[] = []
    const logger: Logger = {
        debug: vi.fn(),
        info: (message) => { logs.push(message) },
        warn: (message) => { warns.push(message) },
        error: vi.fn(),
    }

    const mockAlertsFetch = () => {
        nock('https://api.github.com')
            .get('/repos/foo/bar/dependabot/alerts')
            .query({ state: 'open', per_page: '100' })
            .reply(200, [])
        nock('https://api.github.com')
            .get('/repos/foo/bar')
            .reply(200, { default_branch: 'main' })
    }

    beforeEach(() => {
        nock.disableNetConnect()
        logs.length = 0
        warns.length = 0
        workDir = mkdtempSync(join(tmpdir(), 'dependfix-git-exclude-run-'))
        git(workDir, ['init', '-q'])
        writeFileSync(join(workDir, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0' }, null, 2), 'utf-8')
    })

    afterEach(() => {
        nock.cleanAll()
        nock.enableNetConnect()
        rmSync(workDir, { recursive: true, force: true })
    })

    it('writes install artifacts into .git/info/exclude during a fix run', async () => {
        mockAlertsFetch()
        const config = resolveRuntimeConfig({
            env: {
                GITHUB_TOKEN: 'main-token-value',
                DEPENDFIX_MODE: 'fix',
                DEPENDFIX_REPOSITORIES: 'foo/bar',
            },
        })
        const app = new DependfixApp({ config, workDir, reportOutputDir: join(workDir, 'reports'), logger })

        await app.run()

        expect(readExclude(workDir)).toContain(`${GIT_EXCLUDE_MARKER}\n.pnpm-store/\nnode_modules/\n`)
        expect(logs.some((line) => line.includes('[git] 已排除安装产物'))).toBe(true)
        // 本地模式安全提示与本次改动无关：只看 git 相关告警
        expect(warns.filter((line) => line.includes('[git]'))).toEqual([])
    })

    it.each([
        ['report-only（只读扫描）', { DEPENDFIX_MODE: 'report-only' }],
        ['fix + dry-run（不写盘）', { DEPENDFIX_MODE: 'fix', DEPENDFIX_DRY_RUN: 'true' }],
        ['cleanup-branches（不动工作树）', { DEPENDFIX_MODE: 'cleanup-branches' }],
    ])('leaves repository metadata untouched for %s', async (_label, env) => {
        mockAlertsFetch()
        const config = resolveRuntimeConfig({
            env: { GITHUB_TOKEN: 'main-token-value', DEPENDFIX_REPOSITORIES: 'foo/bar', ...env },
        })
        const app = new DependfixApp({ config, workDir, reportOutputDir: join(workDir, 'reports'), logger })

        await app.run()

        expect(readExclude(workDir)).not.toContain('.pnpm-store/')
        expect(logs.some((line) => line.includes('[git] 已排除安装产物'))).toBe(false)
    })

    it('logs a warning when the exclude file cannot be written (delivery still proceeds)', async () => {
        const excludePath = join(workDir, '.git', 'info', 'exclude')
        rmSync(excludePath, { force: true })
        mkdirSync(excludePath)
        mockAlertsFetch()
        const config = resolveRuntimeConfig({
            env: {
                GITHUB_TOKEN: 'main-token-value',
                DEPENDFIX_MODE: 'fix',
                DEPENDFIX_REPOSITORIES: 'foo/bar',
            },
        })
        const app = new DependfixApp({ config, workDir, reportOutputDir: join(workDir, 'reports'), logger })

        const { exitCode } = await app.run()

        expect(exitCode).toBe(0)
        expect(warns.some((line) => line.includes('[git] 安装产物排除写入失败'))).toBe(true)
    })

    it('presets the exclude before any mode execution (installation) runs', () => {
        // 源码顺序静态断言：排除条目必须在 `executeMode()`（安装 / 验证入口）之前落盘，
        // 否则安装产物已进入工作区，「无变更」判定与 `git add .` 都会被污染。
        const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index.ts'), 'utf-8')
        const excludeAt = source.indexOf('prepareDeliveryHygiene(this.workDir')
        const executeAt = source.indexOf('await this.executeMode()')

        expect(excludeAt).toBeGreaterThan(-1)
        expect(executeAt).toBeGreaterThan(-1)
        expect(excludeAt).toBeLessThan(executeAt)
    })
})
