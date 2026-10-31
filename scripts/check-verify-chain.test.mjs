/**
 * check-verify-chain 测试：自用验证链与引擎默认链的语义一致性判定（含真实仓库文本上的 mutation 标定）。
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import {
    classifyCommand,
    compareChains,
    ENGINE_CHAIN_REL,
    normalizeCommand,
    parseChainString,
    parseEngineDefaultChain,
    parseWorkflowSelfChain,
    runCheck,
    runCheckOnTexts,
    WORKFLOW_REL,
} from './check-verify-chain.mjs'

const REPO_ROOT = join(import.meta.dirname, '..')

const workflowText = readFileSync(join(REPO_ROOT, WORKFLOW_REL), 'utf8')
const engineText = readFileSync(join(REPO_ROOT, ENGINE_CHAIN_REL), 'utf8')

const WORKFLOW_FIXTURE = [
    'on:',
    '  workflow_dispatch:',
    '    inputs:',
    '      commands:',
    '        description: "自定义验证命令"',
    '        default: ""',
    'jobs:',
    '  dependfix:',
    '    steps:',
    '      - uses: ./',
    '        with:',
    '          commands: ${{ inputs.commands || \'pnpm install --frozen-lockfile, pnpm lint, pnpm test\' }}',
].join('\n')

const ENGINE_FIXTURE = [
    'export const DEFAULT_VERIFY_COMMANDS = [',
    '    \'pnpm install --frozen-lockfile\',',
    '    \'pnpm lint\',',
    '    \'pnpm test\',',
    ']',
].join('\n')

describe('normalizeCommand / parseChainString', () => {
    it('折叠空白并去首尾', () => {
        expect(normalizeCommand('  pnpm   lint  ')).toBe('pnpm lint')
    })

    it('按逗号切分、去空白、过滤空项', () => {
        expect(parseChainString('pnpm lint, pnpm build ,, pnpm test,')).toEqual(['pnpm lint', 'pnpm build', 'pnpm test'])
    })
})

describe('classifyCommand', () => {
    it('install 形态（含参数）归一到 install', () => {
        expect(classifyCommand('pnpm install --frozen-lockfile')).toBe('install')
    })

    it('单脚本形态取脚本名', () => {
        expect(classifyCommand('pnpm typecheck')).toBe('typecheck')
        expect(classifyCommand('pnpm build:tsc')).toBe('build:tsc')
    })

    it('复合命令（filter + exec）按归一化全文计入', () => {
        expect(classifyCommand('pnpm --filter  @dependfix/platform   exec nuxt prepare')).toBe('pnpm --filter @dependfix/platform exec nuxt prepare')
    })
})

describe('parseWorkflowSelfChain', () => {
    it('命中 step 的 commands 回退值并给出行号', () => {
        const parsed = parseWorkflowSelfChain(WORKFLOW_FIXTURE)
        expect(parsed?.commands).toEqual(['pnpm install --frozen-lockfile', 'pnpm lint', 'pnpm test'])
        expect(parsed?.line).toBe(12)
    })

    it('未命中回退值 → null（不静默通过）', () => {
        expect(parseWorkflowSelfChain('commands: ${{ inputs.commands }}')).toBeNull()
    })
})

describe('parseEngineDefaultChain', () => {
    it('提取数组常量', () => {
        const parsed = parseEngineDefaultChain(ENGINE_FIXTURE)
        expect(parsed?.commands).toEqual(['pnpm install --frozen-lockfile', 'pnpm lint', 'pnpm test'])
        expect(parsed?.line).toBe(1)
    })

    it('未找到常量 → null', () => {
        expect(parseEngineDefaultChain('const X = []')).toBeNull()
    })
})

describe('compareChains 判定项', () => {
    const base = {
        selfCommands: ['pnpm install --frozen-lockfile', 'pnpm lint'],
        selfLine: 3,
        defaultCommands: ['pnpm install --frozen-lockfile', 'pnpm lint'],
    }

    it('完全覆盖且无额外项 → 无 finding', () => {
        expect(compareChains({ ...base, gaps: {}, extras: {} })).toEqual([])
    })

    it('缺失默认链语义项且未声明 → 报缺项', () => {
        const findings = compareChains({
            ...base,
            defaultCommands: [...base.defaultCommands, 'pnpm test'],
            gaps: {},
            extras: {},
        })
        expect(findings).toHaveLength(1)
        expect(findings[0].file).toBe(WORKFLOW_REL)
        expect(findings[0].message).toContain('`test`')
    })

    it('缺失项已显式声明 → 通过', () => {
        expect(compareChains({
            ...base,
            defaultCommands: [...base.defaultCommands, 'pnpm test'],
            gaps: { test: { reason: 'r', trigger: 't' } },
            extras: {},
        })).toEqual([])
    })

    it('额外项未声明 → 报未声明', () => {
        const findings = compareChains({
            ...base,
            selfCommands: [...base.selfCommands, 'pnpm --filter @dependfix/platform exec nuxt prepare'],
            gaps: {},
            extras: {},
        })
        expect(findings).toHaveLength(1)
        expect(findings[0].message).toContain('额外项')
    })

    it('额外项已声明且 before 满足 → 通过', () => {
        expect(compareChains({
            ...base,
            selfCommands: [
                'pnpm install --frozen-lockfile',
                'pnpm --filter @dependfix/platform exec nuxt prepare',
                'pnpm lint',
            ],
            gaps: {},
            extras: { 'pnpm --filter @dependfix/platform exec nuxt prepare': { reason: 'r', before: 'lint' } },
        })).toEqual([])
    })

    it('额外项 before 约束违约（排在 lint 之后）→ 报位置违约', () => {
        const findings = compareChains({
            ...base,
            selfCommands: [
                'pnpm install --frozen-lockfile',
                'pnpm lint',
                'pnpm --filter @dependfix/platform exec nuxt prepare',
            ],
            gaps: {},
            extras: { 'pnpm --filter @dependfix/platform exec nuxt prepare': { reason: 'r', before: 'lint' } },
        })
        expect(findings).toHaveLength(1)
        expect(findings[0].message).toContain('必须排在')
    })

    it('声明陈旧：已覆盖却仍登记在 gaps → 报陈旧', () => {
        const findings = compareChains({
            selfCommands: ['pnpm install --frozen-lockfile', 'pnpm lint', 'pnpm test'],
            selfLine: 3,
            defaultCommands: ['pnpm install --frozen-lockfile', 'pnpm lint', 'pnpm test'],
            gaps: { test: { reason: 'r', trigger: 't' } },
            extras: {},
        })
        expect(findings).toHaveLength(1)
        expect(findings[0].message).toContain('声明陈旧')
    })

    it('声明陈旧：extras 登记的项已不存在 → 报陈旧', () => {
        const findings = compareChains({
            ...base,
            gaps: {},
            extras: { 'pnpm --filter x exec y': { reason: 'r' } },
        })
        expect(findings).toHaveLength(1)
        expect(findings[0].message).toContain('声明陈旧')
    })

    it('共有语义项相对顺序不一致 → 报顺序', () => {
        const findings = compareChains({
            selfCommands: ['pnpm install --frozen-lockfile', 'pnpm build', 'pnpm lint'],
            selfLine: 3,
            defaultCommands: ['pnpm install --frozen-lockfile', 'pnpm lint', 'pnpm build'],
            gaps: {},
            extras: {},
        })
        expect(findings).toHaveLength(1)
        expect(findings[0].message).toContain('相对顺序')
    })
})

describe('真实仓库事实源', () => {
    it('runCheck 通过，且自用链覆盖默认链全部语义项（含 test）', () => {
        const result = runCheck(REPO_ROOT)
        expect(result.findings).toEqual([])
        expect(result.defaultCommands.map(classifyCommand)).toEqual(['install', 'lint', 'build', 'typecheck', 'test'])
        expect(result.selfCommands.map(classifyCommand)).toContain('test')
    })

    it('解析失败不静默通过：默认链数组项写成双引号 → 报解析失败', () => {
        const mutated = engineText.replace('\'pnpm test\',', '"pnpm test",')
        expect(mutated).not.toBe(engineText)
        const result = runCheckOnTexts({ workflowText, engineText: mutated })
        expect(result.findings).toHaveLength(1)
        expect(result.findings[0].message).toContain('无法解析')
    })

    it('解析失败不静默通过：默认链数组未闭合 → 报解析失败', () => {
        const mutated = engineText.replace('\n]\n', '\n')
        expect(mutated).not.toBe(engineText)
        const result = runCheckOnTexts({ workflowText, engineText: mutated })
        expect(result.findings[0].message).toContain('未闭合')
    })

    it('before 目标不存在 → 报声明失效（不静默通过）', () => {
        const result = runCheckOnTexts({
            workflowText,
            engineText,
            extras: { 'pnpm --filter @dependfix/platform exec nuxt prepare': { reason: 'r', before: 'nonexistent-step' } },
        })
        expect(result.findings.map((f) => f.message).join('\n')).toContain('位置约束失效')
    })

    it('mutation：自用链删去 test → 报缺项（击杀）', () => {
        const mutated = workflowText.replace(', pnpm test', '')
        expect(mutated).not.toBe(workflowText)
        const result = runCheckOnTexts({ workflowText: mutated, engineText })
        expect(result.findings.map((f) => f.message).join('\n')).toContain('`test`')
    })

    it('mutation：默认链新增语义项 → 报缺项（默认链扩展可被检出）', () => {
        const mutated = engineText.replace('    \'pnpm test\',', '    \'pnpm test\',\n    \'pnpm format\',')
        expect(mutated).not.toBe(engineText)
        const result = runCheckOnTexts({ workflowText, engineText: mutated })
        expect(result.findings.map((f) => f.message).join('\n')).toContain('`format`')
    })

    it('mutation：自用链去掉 prepare → 报声明陈旧（击杀）', () => {
        const mutated = workflowText.replace('pnpm --filter @dependfix/platform exec nuxt prepare, ', '')
        expect(mutated).not.toBe(workflowText)
        const result = runCheckOnTexts({ workflowText: mutated, engineText })
        expect(result.findings.map((f) => f.message).join('\n')).toContain('声明陈旧')
    })

    it('mutation：自用链 test 前移到 typecheck 之前 → 报顺序（击杀）', () => {
        const mutated = workflowText
            .replace('pnpm build, pnpm typecheck, pnpm test', 'pnpm build, pnpm test, pnpm typecheck')
        expect(mutated).not.toBe(workflowText)
        const result = runCheckOnTexts({ workflowText: mutated, engineText })
        expect(result.findings.map((f) => f.message).join('\n')).toContain('相对顺序')
    })
})

describe('CLI 端到端（exit code）', () => {
    const scriptPath = join(REPO_ROOT, 'scripts', 'check-verify-chain.mjs')
    let tmpRoot

    beforeEach(() => {
        tmpRoot = mkdtempSync(join(tmpdir(), 'dependfix-verify-chain-'))
        mkdirSync(join(tmpRoot, '.github', 'workflows'), { recursive: true })
        mkdirSync(join(tmpRoot, 'packages', 'engine', 'src', 'runners'), { recursive: true })
        writeFileSync(join(tmpRoot, WORKFLOW_REL), workflowText, 'utf8')
        writeFileSync(join(tmpRoot, ENGINE_CHAIN_REL), engineText, 'utf8')
    })

    afterEach(() => {
        rmSync(tmpRoot, { recursive: true, force: true })
    })

    it('两处事实源一致 → exit 0', () => {
        const result = spawnSync('node', [scriptPath, `--root=${tmpRoot}`], { encoding: 'utf8' })
        expect(result.status).toBe(0)
        expect(result.stdout).toContain('[check-verify-chain] OK')
    })

    it('机读模式（--json）输出可解析的判定结果', () => {
        const result = spawnSync('node', [scriptPath, '--json', `--root=${tmpRoot}`], { encoding: 'utf8' })
        expect(result.status).toBe(0)
        const parsed = JSON.parse(result.stdout)
        expect(parsed.findings).toEqual([])
        expect(parsed.selfCommands.map(classifyCommand)).toContain('test')
    })

    it('自用链缺默认链语义项 → exit 1 且 stderr 含明细（锁住退出码分支）', () => {
        writeFileSync(join(tmpRoot, WORKFLOW_REL), workflowText.replace(', pnpm test', ''), 'utf8')
        const result = spawnSync('node', [scriptPath, `--root=${tmpRoot}`], { encoding: 'utf8' })
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('自用链缺少引擎默认链语义项')
        expect(result.stdout).toContain('1 处不一致')
    })
})
