/**
 * lint-staged 提交卫生：业务 glob 不得配置裸 `git add`（含 `git add .` / `git add -A` 等全量暂存形态）。
 *
 * 背景：lint-staged 自身会重暂存其修改过的文件；额外配置无 pathspec 或全量形态的 `git add`
 * 会把工作区其它已改文件一并入索引，破坏原子提交边界。生成物同步任务
 * （`packages/skills/**` → `skills/**`）跨出 glob 范围，仍须带 pathspec 的 `git add`。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const config = pkg['lint-staged']

/**
 * 判定一条 lint-staged task 是否为危险 `git add`：
 * 无参数（裸 add）或全量形态（`.` / `-A` / `--all` / `-u` / `--update`）。
 * @param {string} task
 * @returns {boolean}
 */
export function isUnsafeAdd(task) {
    if (!/^git add\b/.test(task)) {
        return false
    }
    return !/^git add\s+(?!-A\b|--all\b|-u\b|--update\b|\.\s*$)\S+/.test(task)
}

describe('lint-staged 提交卫生', () => {
    it('业务 glob 不配置裸 / 全量 git add', () => {
        for (const glob of ['*.{js,ts}', '*.{css,scss,vue}', '*.md']) {
            expect(config[glob]).toBeDefined()
            expect(config[glob].filter(isUnsafeAdd)).toEqual([])
        }
    })

    it('生成物同步的 git add 必须带 pathspec', () => {
        const tasks = config['packages/skills/dependfix-remediator/**']
        expect(tasks).toBeDefined()
        const adds = tasks.filter((task) => /^git add\b/.test(task))
        expect(adds).toHaveLength(1)
        expect(adds.filter(isUnsafeAdd)).toEqual([])
    })

    it('守卫能识别裸 add 与全量暂存形态', () => {
        for (const bad of ['git add', 'git add .', 'git add -A', 'git add --all', 'git add -u', 'git add --update']) {
            expect(isUnsafeAdd(bad)).toBe(true)
        }
        expect(isUnsafeAdd('git add skills/dependfix-remediator')).toBe(false)
        // `git add -- <pathspec>` 仍是带路径的安全形态（当前配置未使用）
        expect(isUnsafeAdd('git add -- skills/dependfix-remediator')).toBe(false)
    })

    it('业务任务按文件级执行（不收全仓 glob）', () => {
        const js = config['*.{js,ts}'].join(' ')
        expect(js).not.toContain('npm run lint')
        expect(js).not.toMatch(/eslint\s+\.(?:\s|$)/)
        const md = config['*.md'].join(' ')
        expect(md).not.toContain('npm run lint:md')
        expect(md).not.toContain('"*.md"')
    })
})
