/**
 * check-mergify-conditions 测试：mergify 合并门禁与全部 workflow 的 PR job 集合一致性判定
 * （含真实仓库事实源断言、声明表、CLI 子进程与负例标定）。
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    compareMergifyConditions,
    MERGIFY_REL,
    parseMergifyRules,
    parsePullRequestJobNames,
    runCheck,
    runCheckOnTexts,
    WORKFLOWS_REL,
} from './check-mergify-conditions.mjs'

const REPO_ROOT = join(import.meta.dirname, '..')

const mergifyText = readFileSync(join(REPO_ROOT, MERGIFY_REL), 'utf8')
const workflowText = readFileSync(join(REPO_ROOT, WORKFLOWS_REL, 'test.yml'), 'utf8')
const workflows = [{ path: `${WORKFLOWS_REL}/test.yml`, text: workflowText }]

const ruleText = (conditions) => `
pull_request_rules:
  - name: merge dependabot
    conditions:
${conditions.map((condition) => `      - ${condition}`).join('\n')}
    actions:
      merge:
        method: rebase
`

describe('parsePullRequestJobNames', () => {
    it('取 workflow 的 PR job 名（name 优先于 job key）', () => {
        const { jobNames, error } = parsePullRequestJobNames(workflowText)
        expect(error).toBeNull()
        expect(jobNames).toEqual(['Coverage', 'E2E', 'Test', 'Visual Regression'])
    })

    it('on 为数组形态同样识别 pull_request', () => {
        const text = `on: [push, pull_request]
jobs:
  test:
    name: Test
    runs-on: ubuntu-latest
`
        const { jobNames } = parsePullRequestJobNames(text)
        expect(jobNames).toEqual(['Test'])
    })

    it('未在 pull_request 触发 → 空集合（不是解析失败）', () => {
        const text = workflowText.replace('  pull_request:', '  schedule:')
        const { jobNames, error } = parsePullRequestJobNames(text)
        expect(error).toBeNull()
        expect(jobNames).toEqual([])
    })

    it('job 名含 matrix 表达式 → 单独返回（不静默当字面名）', () => {
        const text = `on: pull_request
jobs:
  test:
    name: Test (\${{ matrix.os }})
    runs-on: ubuntu-latest
`
        const { jobNames, expressions } = parsePullRequestJobNames(text)
        expect(jobNames).toEqual([])
        expect(expressions).toEqual(['Test (${{ matrix.os }})'])
    })

    it('缺少 jobs 映射 → 报错（不静默通过）', () => {
        expect(parsePullRequestJobNames('on: pull_request\n').error).toBe('缺少 jobs 映射')
    })
})

describe('compareMergifyConditions', () => {
    const jobNames = ['Coverage', 'E2E', 'Test', 'Visual Regression']

    it('真实仓库配置一致', () => {
        const result = runCheckOnTexts({ mergifyText, workflows })
        expect(result.findings).toEqual([])
        expect(result.ok).toBe(true)
        expect(result.rules).toHaveLength(2)
    })

    it('规则漏掉某个 PR job → 命中缺失项（skipped ≠ success）', () => {
        const drifted = mergifyText.replace(
            '      - check-success=Test\n      - check-success=Coverage\n      - check-success=E2E\n      - check-success=Visual Regression\n      - author~=^(.+?\\+)?dependfix',
            '      - check-success=Test\n      - check-success=E2E\n      - check-success=Visual Regression\n      - author~=^(.+?\\+)?dependfix',
        )
        expect(drifted).not.toBe(mergifyText)

        const result = runCheckOnTexts({ mergifyText: drifted, workflows })
        expect(result.ok).toBe(false)
        expect(result.findings.some((f) => f.message.includes('缺少 check-success=Coverage'))).toBe(true)
    })

    it('规则引用不存在的 job → 命中多余项（job 名拼错 / 已删除）', () => {
        const drifted = mergifyText.replace(
            '      - check-success=Visual Regression\n      - author~=^(.+?\\+)?dependfix',
            '      - check-success=Visual Regression\n      - check-success=Build\n      - author~=^(.+?\\+)?dependfix',
        )
        const result = runCheckOnTexts({ mergifyText: drifted, workflows })
        expect(result.ok).toBe(false)
        expect(result.findings.some((f) => f.message.includes('不存在的 check-success=Build'))).toBe(true)
    })

    it('缺少 dependfix / dependabot author 规则 → 各自命中', () => {
        const rules = [
            { name: 'only-dependabot', line: 1, checkSuccess: jobNames, authors: ['^dependabot(|-preview)\\[bot\\]$'], merges: true },
        ]
        const findings = compareMergifyConditions({ rules, jobNames })
        expect(findings.some((f) => f.message.includes('dependfix author'))).toBe(true)
        expect(findings.some((f) => f.message.includes('Dependabot author'))).toBe(false)
    })

    it('无 merge 动作的规则不承担门禁义务（auto-close 类 / conditions: true）', () => {
        const rules = parseMergifyRules(`
pull_request_rules:
  - name: auto close duplicate
    conditions: true
    actions:
      close: {}
  - name: merge dependabot
    conditions:
      - check-success=Test
      - check-success=Coverage
      - author~=^dependabot\\[bot\\]$
    actions:
      merge:
        method: rebase
  - name: merge dependfix
    conditions:
      - check-success=Test
      - check-success=Coverage
      - author~=^dependfix\\[bot\\]$
    actions:
      merge:
        method: rebase
`).rules
        expect(compareMergifyConditions({ rules, jobNames: ['Test', 'Coverage'] })).toEqual([])
    })

    it('check-success 两侧空格形态同样识别（mergify 官方写法）', () => {
        const rules = parseMergifyRules(ruleText([
            'check-success = Test',
            'check-success = Coverage',
            'author~=^dependabot\\[bot\\]$',
        ])).rules
        expect(rules[0]?.checkSuccess).toEqual(['Test', 'Coverage'])
    })

    it('check-success 正则 / 其它运算符 → 显式报错（不静默忽略）', () => {
        for (const condition of ['check-success~=Test.*', 'check-success^=Test']) {
            const parsed = parseMergifyRules(ruleText([condition, 'author~=^dependabot\\[bot\\]$']))
            expect(parsed.error, condition).toContain('不支持的 check 条件变体')
        }
    })

    it('conditions 字符串简写 → 归一为单条件', () => {
        const rules = parseMergifyRules(`
pull_request_rules:
  - name: merge dependabot
    conditions: check-success=Test
    actions:
      merge:
        method: rebase
`).rules
        expect(rules[0]?.checkSuccess).toEqual(['Test'])
    })

    it('conditions: false → 取值非法（文案不冒充映射形态）', () => {
        const parsed = parseMergifyRules('pull_request_rules:\n  - name: x\n    conditions: false\n    actions:\n      merge:\n        method: rebase\n')
        expect(parsed.error).toContain('conditions 取值非法')
        expect(parsed.error).not.toContain('映射形态')
    })

    it('声明表：外部 check 经登记后放行；豁免 job 不入必需集；陈旧声明报错', () => {
        const checks = ['check-success=Test', 'check-success=Coverage', 'check-success=codecov/patch']
        const rules = parseMergifyRules(`pull_request_rules:
  - name: merge dependabot
    conditions:
      - ${checks.join('\n      - ')}
      - author~=^dependabot\\[bot\\]$
    actions:
      merge:
        method: rebase
  - name: merge dependfix
    conditions:
      - ${checks.join('\n      - ')}
      - author~=^dependfix\\[bot\\]$
    actions:
      merge:
        method: rebase
`).rules
        const extraChecks = {
            'codecov/patch': { reason: 'Codecov 外部 status', trigger: 'Codecov 下线或改名时复核' },
        }
        const findings = compareMergifyConditions({
            rules,
            jobNames: ['Test', 'Coverage', 'Docs'],
            extraChecks,
            exemptJobs: { Docs: { reason: '仅报告', trigger: 'Docs 改为阻断时移除' } },
        })
        expect(findings).toEqual([])

        // 豁免 job 仍被规则要求（更严格）不误报
        const stricterRules = rules.map((rule) => ({ ...rule, checkSuccess: [...rule.checkSuccess, 'Docs'] }))
        expect(compareMergifyConditions({
            rules: stricterRules,
            jobNames: ['Test', 'Coverage', 'Docs'],
            extraChecks,
            exemptJobs: { Docs: { reason: '仅报告', trigger: 'Docs 改为阻断时移除' } },
        })).toEqual([])

        // 豁免声明陈旧：Docs 已不是 PR job
        const staleExempt = compareMergifyConditions({
            rules,
            jobNames: ['Test', 'Coverage'],
            extraChecks,
            exemptJobs: { Docs: { reason: 'x', trigger: 'y' } },
        })
        expect(staleExempt.some((f) => f.message.includes('DECLARED_EXEMPT_JOBS 声明陈旧') && f.file.includes('check-mergify-conditions'))).toBe(true)

        // 额外 check 声明陈旧：规则里已不再出现
        const staleExtra = compareMergifyConditions({
            rules: rules.map((rule) => ({ ...rule, checkSuccess: ['Test', 'Coverage'] })),
            jobNames: ['Test', 'Coverage'],
            extraChecks,
            exemptJobs: {},
        })
        expect(staleExtra.some((f) => f.message.includes('DECLARED_EXTRA_CHECKS 声明陈旧'))).toBe(true)
    })
})

describe('runCheckOnTexts 错误面与多 workflow', () => {
    it('任何 workflow 新增 PR job 都进入门禁（跨文件扫描）', () => {
        const extraWorkflow = {
            path: `${WORKFLOWS_REL}/lint.yml`,
            text: 'on:\n  pull_request:\njobs:\n  lint:\n    name: Lint\n    runs-on: ubuntu-latest\n',
        }
        const result = runCheckOnTexts({ mergifyText, workflows: [...workflows, extraWorkflow] })
        expect(result.ok).toBe(false)
        expect(result.findings.some((f) => f.message.includes('缺少 check-success=Lint'))).toBe(true)
    })

    it('matrix 表达式 job 名 → finding（不静默当字面名）', () => {
        const result = runCheckOnTexts({
            mergifyText,
            workflows: [{
                path: `${WORKFLOWS_REL}/matrix.yml`,
                text: `on:
  pull_request:
jobs:
  test:
    name: Test (\${{ matrix.os }})
    runs-on: ubuntu-latest
`,
            }],
        })
        expect(result.ok).toBe(false)
        expect(result.findings.some((f) => f.message.includes('job 名含表达式'))).toBe(true)
    })

    it('pull_request_target 不计入 PR job（基上下文运行，check 不落 PR head）', () => {
        const { jobNames } = parsePullRequestJobNames('on:\n  pull_request_target:\njobs:\n  scan:\n    name: Scan\n')
        expect(jobNames).toEqual([])
    })

    it('规则 YAML 非法 → finding（不抛错、不当空规则集）', () => {
        const result = runCheckOnTexts({ mergifyText: 'pull_request_rules: [', workflows })
        expect(result.ok).toBe(false)
        expect(result.findings[0]?.message).toContain('YAML 解析失败')
    })

    it('缺少 pull_request_rules → finding', () => {
        const result = runCheckOnTexts({ mergifyText: 'other: 1\n', workflows })
        expect(result.ok).toBe(false)
        expect(result.findings[0]?.message).toContain('缺少 pull_request_rules')
    })

    it('条件为映射形态 → 可操作的 finding', () => {
        const result = runCheckOnTexts({
            mergifyText: 'pull_request_rules:\n  - name: x\n    conditions:\n      - check-success: Test\n    actions:\n      merge:\n        method: rebase\n',
            workflows,
        })
        expect(result.ok).toBe(false)
        expect(result.findings[0]?.message).toContain('映射形态')
    })
})

describe('runCheck 读取失败面', () => {
    it('空目录 → finding（不抛堆栈）', () => {
        const root = mkdtempSync(join(tmpdir(), 'dependfix-mergify-empty-'))
        try {
            const result = runCheck(root)
            expect(result.ok).toBe(false)
            expect(result.findings.some((f) => f.message.includes('读取失败'))).toBe(true)
            expect(result.findings.some((f) => f.message.includes('读取目录失败'))).toBe(true)
        } finally {
            rmSync(root, { recursive: true, force: true })
        }
    })
})

describe('runCheck（真实仓库事实源）', () => {
    it('当前仓库配置通过门禁', () => {
        const result = runCheck(REPO_ROOT)
        expect(result.ok).toBe(true)
        expect(result.jobNames).toEqual(['Coverage', 'E2E', 'Test', 'Visual Regression'])
    })
})

describe('CLI', () => {
    const script = join(REPO_ROOT, 'scripts/check-mergify-conditions.mjs')

    it('通过时 exit 0，--json 输出可解析', () => {
        const proc = spawnSync(process.execPath, [script, '--json'], { encoding: 'utf8' })
        expect(proc.status).toBe(0)
        const parsed = JSON.parse(proc.stdout)
        expect(parsed.ok).toBe(true)
        expect(parsed.jobNames).toEqual(['Coverage', 'E2E', 'Test', 'Visual Regression'])
    })

    it('配置漂移时 exit 1 且输出 file:line', () => {
        const root = mkdtempSync(join(tmpdir(), 'dependfix-mergify-'))
        try {
            mkdirSync(join(root, WORKFLOWS_REL), { recursive: true })
            copyFileSync(join(REPO_ROOT, MERGIFY_REL), join(root, MERGIFY_REL))
            copyFileSync(join(REPO_ROOT, WORKFLOWS_REL, 'test.yml'), join(root, WORKFLOWS_REL, 'test.yml'))
            // 在真实配置上删掉一条 check-success，模拟漂移
            const drifted = mergifyText.replace('      - check-success=E2E\n', '')
            writeFileSync(join(root, MERGIFY_REL), drifted)

            const proc = spawnSync(process.execPath, [script, `--root=${root}`], { encoding: 'utf8' })
            expect(proc.status).toBe(1)
            expect(proc.stderr).toMatch(/^\.github\/mergify\.yml:\d+: .*缺少 check-success=E2E/m)
        } finally {
            rmSync(root, { recursive: true, force: true })
        }
    })
})
