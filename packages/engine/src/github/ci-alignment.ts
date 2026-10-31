// ci-alignment.ts — 验证链与目标仓库 CI 口径的解析、比对与默认分支健康预检。
//
// 背景（2026-10-18 生产复盘）：PR 正文的 Verification 红字来自 engine 本地验证链，
// 与目标仓库 CI 的绿 / 红不是同一口径，用户无法判断「PR 是否真的过 CI」。
//
// 设计边界（详见 docs/design/governance/verification-ci-alignment.md）：
// - 只解析默认分支 `.github/workflows/*.yml|yaml` 的 `jobs.*.steps[].run`，**不执行**、不改命令链；
// - 只识别 lint / build / typecheck / test 四类语义项（与默认链口径一致），其余显式标注「未识别」；
// - 解析失败 / 非法 YAML / 非 GitHub Actions → 「未能读取 CI 配置」，不阻断运行；
// - 默认分支健康预检只读，API 失败 / 限流 / 超时降级为「未获取」，不标注失败结论；
// - 只描述命令口径，不承诺、不预测目标仓库 CI 结果。
import { lstatSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Octokit } from '@octokit/rest'
import { parse as parseYaml } from 'yaml'
import {
    toErrorMessage,
    type CiAlignmentRecord,
    type CiAlignmentStatus,
    type CiDefaultBranchHealth,
    type CiMirrorSkipped,
    type CiWorkflowEvidence,
    type VerifyCommandCategory,
} from '@dependfix/core'
import { readPackageScripts } from '../verification/validate-commands'

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** workflow 目录（相对仓库根）。 */
const WORKFLOW_DIR = '.github/workflows'
/** 单次解析的文件数上限（防超大仓库 / 恶意仓库拖慢运行）。 */
export const MAX_WORKFLOW_FILES = 20
/** 单文件字节上限（超出按「未能读取」降级，不解析半截 YAML）。 */
export const MAX_WORKFLOW_BYTES = 512 * 1024
/** 默认分支健康预检的 workflow 数上限（每个一次 API 调用，控制配额）。 */
export const CI_HEALTH_MAX_WORKFLOWS = 3
/** 单次健康预检的请求超时（限流重试也被 signal 约束，避免拖住交付）。 */
export const CI_HEALTH_TIMEOUT_MS = 5_000
/** 单个 workflow 保留的结构化命令片段上限（仅镜像计划需要；超出即整体降级，不截断执行源）。 */
export const MAX_RUN_FRAGMENTS = 2000
/** 单个 workflow 保留的未识别命令条数（PR 正文预算）。 */
const MAX_UNRECOGNIZED_PER_WORKFLOW = 5

/** 与默认验证链一致的四个语义项（install 等准备类命令不参与比对）。 */
const SCRIPT_CATEGORY: Record<string, VerifyCommandCategory> = {
    lint: 'lint',
    eslint: 'lint',
    build: 'build',
    typecheck: 'typecheck',
    'type-check': 'typecheck',
    test: 'test',
}

/** 直接调用二进制（不经包管理器脚本）时的语义项。 */
const BINARY_CATEGORY: Record<string, VerifyCommandCategory> = {
    eslint: 'lint',
    tsc: 'typecheck',
    vitest: 'test',
    jest: 'test',
}

const PACKAGE_MANAGERS = new Set(['pnpm', 'npm', 'yarn'])

/**
 * 包管理器的非脚本子命令：命中即忽略（不是验证语义项），避免 `pnpm install` /
 * `pnpm audit` 等被误标为「未识别命令」。
 */
const PM_NON_SCRIPT_SUBCOMMANDS = new Set([
    'install', 'i', 'ci', 'add', 'remove', 'rm', 'uninstall', 'update', 'up', 'upgrade',
    'outdated', 'why', 'list', 'ls', 'exec', 'dlx', 'create', 'init', 'link', 'unlink',
    'prune', 'dedupe', 'store', 'config', 'setup', 'patch', 'patch-commit', 'publish',
    'pack', 'deploy', 'licenses', 'audit', 'bin', 'root', 'help', 'import', 'rebuild',
    'recursive', 'run-script', '-v', '--version', '-h', '--help',
])

/** 取值为独立 token 的参数（解析脚本名时连同其值一起跳过）。 */
const FLAGS_WITH_VALUE = new Set([
    '--filter', '-F', '--filter-prod', '--dir', '-C', '--prefix', '--workspace', '-w', '--reporter',
])

// ---------------------------------------------------------------------------
// 命令识别
// ---------------------------------------------------------------------------

type FragmentClassification =
    | { kind: 'category', category: VerifyCommandCategory }
    | { kind: 'install' }
    | { kind: 'ignore' }
    | { kind: 'unrecognized', command: string }

/** 折叠空白并去掉包裹引号（workflow 里 `run: "pnpm lint"` 等形态）。 */
function normalizeFragment(fragment: string): string {
    return fragment.trim().replace(/\s+/g, ' ').replace(/^['"]|['"]$/g, '').trim()
}

/** 把 `run` 脚本拆成可独立识别的命令片段（换行 / `&&` / `||` / `;`）。 */
function splitScriptFragments(script: string): string[] {
    return script
        .split(/\r?\n/)
        .flatMap((line) => line.split(/&&|\|\||;/))
        .map(normalizeFragment)
        .filter((fragment) => fragment.length > 0)
}

/** 从包管理器参数中取脚本名（兼容 `pnpm run x` / `pnpm -r x` / `pnpm --filter p x run x`）。 */
function extractScriptName(args: string[]): string | undefined {
    const runIndex = args.findIndex((token) => token === 'run' || token === 'run-script')
    if (runIndex >= 0) {
        return args[runIndex + 1]
    }
    let index = 0
    while (index < args.length) {
        const token = args[index]
        if (FLAGS_WITH_VALUE.has(token)) {
            index += 2
            continue
        }
        if (token.startsWith('-')) {
            index += 1
            continue
        }
        return token
    }
    return undefined
}

/** 识别单个命令片段（导出以便单测锁定口径）。 */
export function classifyCommandFragment(fragment: string): FragmentClassification {
    const normalized = normalizeFragment(fragment)
    if (normalized.length === 0) {
        return { kind: 'ignore' }
    }
    // 去掉前置环境变量赋值（`CI=1 pnpm test`）
    const tokens = normalized
        .split(' ')
        .filter((token) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(token))
    if (tokens.length === 0) {
        return { kind: 'ignore' }
    }
    let head = tokens[0].replace(/^\.\/node_modules\/\.bin\//, '')
    let args = tokens.slice(1)
    // `corepack pnpm@<version> …` 与 pnpm 同语义
    if (head === 'corepack' && args[0]?.startsWith('pnpm')) {
        head = 'pnpm'
        args = args.slice(1)
    }
    if (PACKAGE_MANAGERS.has(head)) {
        const script = extractScriptName(args)
        if (!script) {
            return { kind: 'ignore' }
        }
        if (script === 'install' || script === 'ci' || script === 'i') {
            return { kind: 'install' }
        }
        if (PM_NON_SCRIPT_SUBCOMMANDS.has(script)) {
            return { kind: 'ignore' }
        }
        const category = SCRIPT_CATEGORY[script]
        return category
            ? { kind: 'category', category }
            : { kind: 'unrecognized', command: normalized }
    }
    if (head === 'npx') {
        const binary = args.find((token) => !token.startsWith('-'))
        const category = binary ? BINARY_CATEGORY[binary] : undefined
        return category ? { kind: 'category', category } : { kind: 'ignore' }
    }
    const category = BINARY_CATEGORY[head]
    return category ? { kind: 'category', category } : { kind: 'ignore' }
}

// ---------------------------------------------------------------------------
// workflow 解析
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** workflow 解析结果（失败时给出可渲染的原因，不抛错）。 */
export type WorkflowParseResult =
    | {
        ok: true
        evidence: CiWorkflowEvidence
        runFragments: CiRunFragment[]
        /** 片段数超上限（仅在收集时可能出现）：调用方须整体降级，不得用截断后的片段做执行计划 */
        runFragmentsTruncated?: boolean
    }
    | { ok: false, reason: string }

/** 结构化命令片段的收集选项（默认不收集：口径比对不需要执行源，避免大幅工作流占用内存）。 */
export interface RunFragmentOptions {
    collectRunFragments?: boolean
    maxRunFragments?: number
}

/**
 * 结构化命令片段（执行源，**原始命令未截断**）。
 *
 * 与 `CiWorkflowEvidence.unrecognized` 的分工：后者是 PR 正文展示用途（截断 120 字符、
 * 反引号替换、每文件上限 5 条），不能作为执行源；本结构保留全部片段与所属 workflow。
 *
 * - `recognized`：默认链已覆盖的语义项（lint / build / typecheck / test）与 install
 * - `unrecognized`：其余可执行片段（未知脚本、`docker` / `gh` / 任意 shell、包管理器非脚本子命令）
 */
export interface CiRunFragment {
    command: string
    kind: 'recognized' | 'unrecognized'
    workflow: string
}

/**
 * 解析单个 workflow 文件：只读 `jobs.*.steps[].run`，产出语义项与未识别命令。
 *
 * 非 GitHub Actions（缺少 `jobs` 映射）与非法 YAML 均返回失败结果，
 * 由调用方降级为「未能读取 CI 配置」。
 */
export function parseWorkflowCommands(
    path: string,
    content: string,
    options: RunFragmentOptions = {},
): WorkflowParseResult {
    const collectRunFragments = options.collectRunFragments === true
    const maxRunFragments = options.maxRunFragments ?? MAX_RUN_FRAGMENTS
    let document: unknown
    try {
        document = parseYaml(content)
    } catch (error: unknown) {
        return { ok: false, reason: `YAML 解析失败（${path}）：${toErrorMessage(error)}` }
    }
    if (!isRecord(document) || !isRecord(document.jobs)) {
        return { ok: false, reason: `非 GitHub Actions workflow（缺少 jobs）：${path}` }
    }

    const categories = new Set<VerifyCommandCategory>()
    const unrecognized: string[] = []
    const runFragments: CiRunFragment[] = []
    let runFragmentsTruncated = false
    const collect = (fragment: CiRunFragment): void => {
        if (!collectRunFragments) {
            return
        }
        if (runFragments.length < maxRunFragments) {
            runFragments.push(fragment)
        } else {
            runFragmentsTruncated = true
        }
    }
    for (const job of Object.values(document.jobs)) {
        if (!isRecord(job) || !Array.isArray(job.steps)) {
            continue
        }
        for (const step of job.steps) {
            if (!isRecord(step) || typeof step.run !== 'string') {
                continue
            }
            for (const fragment of splitScriptFragments(step.run)) {
                const classification = classifyCommandFragment(fragment)
                if (classification.kind === 'category') {
                    categories.add(classification.category)
                    // 带 flag / env 前缀 / corepack 钉定的语义项与默认链命令不等价：
                    // 记 recognized 会让 mirror 既不执行也不披露（口径假覆盖）
                    collect({
                        command: fragment,
                        kind: isPlainPackageManagerScript(fragment) ? 'recognized' : 'unrecognized',
                        workflow: path,
                    })
                } else if (classification.kind === 'unrecognized') {
                    collect({ command: fragment, kind: 'unrecognized', workflow: path })
                    if (unrecognized.length < MAX_UNRECOGNIZED_PER_WORKFLOW) {
                        // 只做展示用途：折叠空白已在识别阶段完成，反引号替换防止破坏 PR 正文行内代码
                        unrecognized.push(classification.command.slice(0, 120).replace(/`/g, '\u0027'))
                    }
                } else {
                    // install 视为已覆盖；其余（docker / gh / 任意 shell / 非脚本子命令）不在默认链内，
                    // 但必须进入结构化片段，供 mirror 计划逐条披露「为什么不执行」
                    collect({
                        command: fragment,
                        kind: classification.kind === 'install' ? 'recognized' : 'unrecognized',
                        workflow: path,
                    })
                }
            }
        }
    }

    return {
        ok: true,
        evidence: {
            path,
            categories: [...categories],
            unrecognized: [...new Set(unrecognized)],
        },
        runFragments,
        ...(runFragmentsTruncated ? { runFragmentsTruncated: true } : {}),
    }
}

/** workflow 文件源（相对路径 + 文本）。 */
export interface WorkflowSource {
    path: string
    content: string
}

/** 读取结果：失败时给出可渲染原因（无目录 / 无文件 / 读取失败 / 超限）。 */
export type WorkflowSourceResult =
    | { ok: true, sources: WorkflowSource[] }
    | { ok: false, reason: string }

/**
 * 读取工作目录下 `.github/workflows/*.yml|yaml`（只读、有界）。
 *
 * 读取的是**工作区检出**的内容（引擎在默认分支检出上修复，修复链不改 workflow），
 * 因此等价于「默认分支的 CI 配置」；多仓共享同一工作目录时的粒度局限见设计文档。
 */
export function readWorkflowSources(workDir: string): WorkflowSourceResult {
    const dir = join(workDir, ...WORKFLOW_DIR.split('/'))
    let entries: string[]
    try {
        entries = readdirSync(dir)
    } catch {
        return { ok: false, reason: `未找到 ${WORKFLOW_DIR}` }
    }
    const files = entries
        .filter((name) => /\.ya?ml$/i.test(name))
        .sort()
    if (files.length === 0) {
        return { ok: false, reason: `未找到 ${WORKFLOW_DIR} 下的 workflow 文件` }
    }
    // 数量上限不做静默截断：被丢弃的 workflow 可能承载唯一的 test 语义项，
    // 截断后仍判「一致」即违反「不拿半个配置宣称一致」的不变量
    if (files.length > MAX_WORKFLOW_FILES) {
        return { ok: false, reason: `workflow 文件数量超出解析上限（${files.length} > ${MAX_WORKFLOW_FILES}）` }
    }

    const sources: WorkflowSource[] = []
    for (const name of files) {
        const path = `${WORKFLOW_DIR}/${name}`
        const absolutePath = join(dir, name)
        try {
            // lstat（不跟随软链）：仓库内容不可信，软链指向 /dev/zero 等设备会让 size 为 0
            // 从而绕过字节上限并同步阻塞事件循环（clone 会原样检出软链）
            const stats = lstatSync(absolutePath)
            if (!stats.isFile()) {
                return { ok: false, reason: `workflow 不是普通文件（${path}）` }
            }
            if (stats.size > MAX_WORKFLOW_BYTES) {
                return { ok: false, reason: `workflow 文件超出解析上限（${path}）` }
            }
            sources.push({ path, content: readFileSync(absolutePath, 'utf-8') })
        } catch (error: unknown) {
            return { ok: false, reason: `读取 workflow 失败（${path}）：${toErrorMessage(error)}` }
        }
    }
    return { ok: true, sources }
}

// ---------------------------------------------------------------------------
// CI 脚本镜像（--mirror-ci-scripts）
// ---------------------------------------------------------------------------

/** 单次运行最多镜像执行的脚本条数（执行成本受控；超限部分记 `over-limit` 披露）。 */
export const MAX_MIRROR_COMMANDS = 3
/** 跳过量表里单条命令的最大保留长度（执行源仍用 `CiRunFragment.command` 原值）。 */
const MAX_MIRROR_SKIP_COMMAND_LENGTH = 200

/** CI 脚本镜像计划（纯计算，不执行）。 */
export interface CiMirrorPlan {
    /** 可执行命令（规范化为 `<包管理器> run <script>`，按 workflow 顺序去重，≤ maxCommands） */
    runnable: string[]
    /** 被跳过的片段与原因（已按命令 + 原因去重） */
    skipped: CiMirrorSkipped[]
    /** workflow 无法读取 / 解析失败的原因（此时不做任何镜像） */
    unreadableReason?: string
}

/**
 * 把片段归一化为「包管理器 + 脚本名 + 是否单一形态」。
 *
 * 单一形态 = `pnpm|npm|yarn [run|run-script] <script>`，且**无**环境变量赋值 /
 * corepack 版本钉定 / 任何 flag / 脚本名后的额外参数。非单一形态仍返回可解析的脚本名
 * （供语义项归类判定「默认链是否等价覆盖」），由调用方决定披露口径。
 */
interface PackageManagerInvocation {
    packageManager: string
    script: string
    plain: boolean
}

function parsePackageManagerInvocation(fragment: string): PackageManagerInvocation | undefined {
    const normalized = normalizeFragment(fragment)
    const rawTokens = normalized.split(' ')
    const hasEnvAssignment = rawTokens.some((token) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(token))
    const tokens = rawTokens.filter((token) => token.length > 0 && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(token))
    if (tokens.length < 2) {
        return undefined
    }
    let head = tokens[0].replace(/^\.\/node_modules\/\.bin\//, '')
    let args = tokens.slice(1)
    let corepackPinned = false
    if (head === 'corepack' && args[0]?.startsWith('pnpm')) {
        // `corepack pnpm@<version>` 与裸 pnpm 不同（版本钉定改变解析 / 安装行为）→ 不归一化
        corepackPinned = args[0] !== 'pnpm'
        head = 'pnpm'
        args = args.slice(1)
    }
    if (!PACKAGE_MANAGERS.has(head)) {
        return undefined
    }
    const scriptArgs = args[0] === 'run' || args[0] === 'run-script' ? args.slice(1) : args
    const script = scriptArgs[0]
    if (!script) {
        return undefined
    }
    const plain = !hasEnvAssignment && !corepackPinned
        && scriptArgs.length === 1
        && !args.some((token) => token.startsWith('-'))
    return { packageManager: head, script, plain }
}

/** 判断片段是否为「单一形态」的包管理器脚本调用（供语义项归类判定默认链等价覆盖）。 */
function isPlainPackageManagerScript(fragment: string): boolean {
    return parsePackageManagerInvocation(fragment)?.plain === true
}

/**
 * 把片段归一化为可镜像的「包管理器 + 脚本名」。
 *
 * 只接受单一形态（见 `parsePackageManagerInvocation`）：任何 flag
 * （`--filter` / `-r` / `--if-present` 等）、脚本名后的额外参数、前置 env 赋值、
 * corepack 版本钉定都**不执行**（会改变执行面或语义，不猜测用户意图），
 * 由调用方记为 `unsupported-command` 披露。
 */
function parseMirrorScript(fragment: string): { packageManager: string, script: string } | undefined {
    const invocation = parsePackageManagerInvocation(fragment)
    if (!invocation || !invocation.plain) {
        return undefined
    }
    const { packageManager, script } = invocation
    if (!/^[A-Za-z][A-Za-z0-9:_-]*$/.test(script)) {
        return undefined
    }
    if (script === 'install' || script === 'ci' || script === 'i' || PM_NON_SCRIPT_SUBCOMMANDS.has(script)) {
        return undefined
    }
    return { packageManager, script }
}

/** 跳过量表命令截断（只影响披露文本，不影响执行源）。 */
function clipSkipCommand(command: string): string {
    return command.length <= MAX_MIRROR_SKIP_COMMAND_LENGTH
        ? command
        : `${command.slice(0, MAX_MIRROR_SKIP_COMMAND_LENGTH - 1)}…`
}

/**
 * 计算 CI 脚本镜像计划：读取 workflow → 结构化片段 → 归一化 → 脚本存在性校验 → 去重 / 上限。
 *
 * 只消费 `kind === 'unrecognized'` 的片段（默认链已覆盖的语义项与 install 不重复执行）；
 * 不能归一化为受支持脚本形态的片段、脚本不存在的片段分别记 `unsupported-command` /
 * `script-not-found`，超出上限的可执行候选记 `over-limit`——全部披露，不静默丢弃。
 *
 * 本函数不执行任何命令；执行、超时、取消与基线归因由验证链统一承担。
 */
export function planCiMirrorCommands(
    workDir: string,
    options: { maxCommands?: number } = {},
): CiMirrorPlan {
    const maxCommands = options.maxCommands ?? MAX_MIRROR_COMMANDS
    const sourceResult = readWorkflowSources(workDir)
    if (!sourceResult.ok) {
        return { runnable: [], skipped: [], unreadableReason: sourceResult.reason }
    }

    const fragments: CiRunFragment[] = []
    for (const source of sourceResult.sources) {
        const parsed = parseWorkflowCommands(source.path, source.content, { collectRunFragments: true })
        if (!parsed.ok) {
            // 与口径比对同口径：任一文件不可解析 ⇒ 整体降级，不拿半个 CI 配置执行脚本
            return { runnable: [], skipped: [], unreadableReason: parsed.reason }
        }
        if (parsed.runFragmentsTruncated) {
            // 不静默截断：片段超上限时整体放弃镜像（宁可少跑，不可漏判「哪些脚本已被考虑」）
            return {
                runnable: [],
                skipped: [],
                unreadableReason: `workflow 命令片段数量超出镜像解析上限（${MAX_RUN_FRAGMENTS}，${source.path}）`,
            }
        }
        fragments.push(...parsed.runFragments)
    }

    const scripts = readPackageScripts(workDir) ?? {}
    const runnable: string[] = []
    const skipped: CiMirrorSkipped[] = []
    const seenCommands = new Set<string>()
    const seenSkips = new Set<string>()
    const addSkip = (command: string, reason: CiMirrorSkipped['reason']): void => {
        const clipped = clipSkipCommand(command)
        const key = `${reason}\u0000${clipped}`
        if (seenSkips.has(key)) {
            return
        }
        seenSkips.add(key)
        skipped.push({ command: clipped, reason })
    }

    for (const fragment of fragments) {
        if (fragment.kind !== 'unrecognized') {
            continue
        }
        const target = parseMirrorScript(fragment.command)
        if (!target) {
            addSkip(fragment.command, 'unsupported-command')
            continue
        }
        if (!Object.hasOwn(scripts, target.script) || !scripts[target.script]) {
            addSkip(fragment.command, 'script-not-found')
            continue
        }
        const command = `${target.packageManager} run ${target.script}`
        if (seenCommands.has(command)) {
            continue
        }
        seenCommands.add(command)
        if (runnable.length >= maxCommands) {
            addSkip(command, 'over-limit')
            continue
        }
        runnable.push(command)
    }

    return { runnable, skipped }
}

// ---------------------------------------------------------------------------
// 比对
// ---------------------------------------------------------------------------

/** 比对结果（`CiAlignmentRecord` 的可计算子集）。 */
export interface CiChainComparison {
    status: CiAlignmentStatus
    ciCategories: VerifyCommandCategory[]
    extraInExecution: VerifyCommandCategory[]
    missingInExecution: VerifyCommandCategory[]
    comparisonNote?: string
}

/**
 * 比对「本次实际执行的命令集」与「CI 可识别命令类别」。
 *
 * 判定口径：
 * - CI 无可识别类别 → `inconclusive`（不能凭「没识别到」宣称一致）；
 * - 本次无可识别类别（自定义命令链）→ `inconclusive`（不按类别硬判不一致）；
 * - CI 有而本次无 → `differs`（口径缺口）；
 * - 本次有而 CI 无 → `aligned` + `extraInExecution`（本次更严格，披露不判不一致）。
 */
export function compareVerificationChains(
    executedCommands: readonly string[],
    workflows: readonly CiWorkflowEvidence[],
): CiChainComparison {
    const executed = new Set<VerifyCommandCategory>()
    for (const command of executedCommands) {
        for (const fragment of splitScriptFragments(command)) {
            const classification = classifyCommandFragment(fragment)
            if (classification.kind === 'category') {
                executed.add(classification.category)
            }
        }
    }

    const ci = new Set<VerifyCommandCategory>()
    for (const workflow of workflows) {
        for (const category of workflow.categories) {
            ci.add(category)
        }
    }
    const ciCategories = [...ci]
    const executedCategories = [...executed]

    if (ciCategories.length === 0) {
        const unrecognizedCount = workflows.reduce((sum, w) => sum + w.unrecognized.length, 0)
        return {
            status: 'inconclusive',
            ciCategories,
            extraInExecution: [],
            missingInExecution: [],
            comparisonNote: unrecognizedCount > 0
                ? `CI 未运行可识别的验证命令（另有 ${unrecognizedCount} 条未识别命令）`
                : 'CI 未运行可识别的验证命令',
        }
    }
    if (executedCategories.length === 0) {
        return {
            status: 'inconclusive',
            ciCategories,
            extraInExecution: [],
            missingInExecution: [],
            comparisonNote: '本次验证链未包含可识别的验证命令（自定义命令），无法按类别比对',
        }
    }

    const missingInExecution = ciCategories.filter((category) => !executed.has(category))
    const extraInExecution = executedCategories.filter((category) => !ci.has(category))
    return {
        status: missingInExecution.length > 0 ? 'differs' : 'aligned',
        ciCategories,
        extraInExecution,
        missingInExecution,
    }
}

// ---------------------------------------------------------------------------
// 默认分支健康预检
// ---------------------------------------------------------------------------

/** 最小 logger 接口（引擎 Logger 与测试桩均满足）。 */
export interface CiAlignmentLogger {
    warn(message: string): void
}

export interface WorkflowHealthParams {
    client: Pick<Octokit, 'rest'>
    owner: string
    repo: string
    defaultBranch: string
    timeoutMs?: number
    maxWorkflows?: number
    logger?: CiAlignmentLogger
}

/**
 * 只读「口径比对所依据的 workflow」在默认分支的最近一次运行结论。
 *
 * 单次调用 + 请求级超时（限流重试同受 signal 约束）；任一调用失败只记日志并返回
 * `unavailableReason`，调用方不得据此标注「默认分支失败」。
 */
export async function fetchDefaultBranchWorkflowHealth(
    workflowPaths: readonly string[],
    params: WorkflowHealthParams,
): Promise<{ health: CiDefaultBranchHealth[], unavailableReason?: string }> {
    const paths = [...new Set(workflowPaths)].slice(0, params.maxWorkflows ?? CI_HEALTH_MAX_WORKFLOWS)
    const timeoutMs = params.timeoutMs ?? CI_HEALTH_TIMEOUT_MS
    const health: CiDefaultBranchHealth[] = []
    let unavailableReason: string | undefined

    for (const path of paths) {
        try {
            const response = await params.client.rest.actions.listWorkflowRuns({
                owner: params.owner,
                repo: params.repo,
                workflow_id: path,
                branch: params.defaultBranch,
                per_page: 1,
                request: { signal: AbortSignal.timeout(timeoutMs) },
            })
            const run = response.data.workflow_runs?.[0]
            if (run) {
                health.push({
                    path,
                    conclusion: run.conclusion ?? 'unknown',
                    ...(run.html_url ? { runUrl: run.html_url } : {}),
                    ...(typeof run.run_number === 'number' ? { runNumber: run.run_number } : {}),
                })
            }
        } catch (error: unknown) {
            unavailableReason ??= toErrorMessage(error)
            params.logger?.warn(
                `[ci-alignment] ${params.owner}/${params.repo}: 默认分支 workflow 健康预检失败（不阻断交付、不标注失败结论）：${toErrorMessage(error)}`,
            )
        }
    }
    return { health, ...(unavailableReason ? { unavailableReason } : {}) }
}

// ---------------------------------------------------------------------------
// 记录构建
// ---------------------------------------------------------------------------

export interface CiAlignmentInput {
    repository: string
    workDir: string
    /** 本次实际执行的验证命令（跳过 `package.json` 中不存在的脚本；首失败短路时只含已执行前缀） */
    commands: string[]
    /** GitHub 客户端（pnpm-audit / 无 token 时为 null ⇒ 只做本地解析，不做健康预检） */
    client: Pick<Octokit, 'rest'> | null
    /** 默认分支（未知时不发起健康预检） */
    defaultBranch?: string
    logger?: CiAlignmentLogger
    healthTimeoutMs?: number
    /** 跳过默认分支健康预检（复用上一轮结果时使用） */
    skipHealth?: boolean
    /**
     * CI 脚本镜像记录（`--mirror-ci-scripts` 开启时提供）。
     * `mirrored` 只含实际执行的命令；`skipped` 为计划期跳过项。两者均为「披露」，不参与比对判定。
     */
    mirror?: { mirrored: string[], skipped: CiMirrorSkipped[] }
}

function emptyRecord(
    repository: string,
    commands: string[],
    defaultBranch?: string,
    mirror?: { mirrored: string[], skipped: CiMirrorSkipped[] },
): CiAlignmentRecord {
    return {
        repository,
        commands: [...commands],
        status: 'unreadable',
        ciCategories: [],
        extraInExecution: [],
        missingInExecution: [],
        workflows: [],
        ...(defaultBranch && defaultBranch !== 'unknown' ? { defaultBranch } : {}),
        ...(mirror ? { mirrored: [...mirror.mirrored], mirrorSkipped: [...mirror.skipped] } : {}),
    }
}

/**
 * 构建单仓库口径记录：本地解析 → 类别比对 → （可选）默认分支健康预检。
 *
 * 本函数不抛错：任何解析 / 网络问题都降级为 `unreadable` / `inconclusive` /
 * `healthUnavailableReason`，调用方据此记录但不得阻断修复与交付。
 */
export async function buildCiAlignmentRecord(input: CiAlignmentInput): Promise<CiAlignmentRecord> {
    const base = emptyRecord(input.repository, input.commands, input.defaultBranch, input.mirror)

    const sourceResult = readWorkflowSources(input.workDir)
    if (!sourceResult.ok) {
        return { ...base, unreadableReason: sourceResult.reason }
    }

    const workflows: CiWorkflowEvidence[] = []
    for (const source of sourceResult.sources) {
        const parsed = parseWorkflowCommands(source.path, source.content)
        if (!parsed.ok) {
            // 任一文件不可解析 ⇒ 整体降级（避免拿半个 CI 配置宣称「一致」）
            return { ...base, unreadableReason: parsed.reason }
        }
        workflows.push(parsed.evidence)
    }

    const comparison = compareVerificationChains(input.commands, workflows)
    const record: CiAlignmentRecord = { ...base, ...comparison, workflows }

    if (input.skipHealth) {
        return record
    }

    const basisPaths = workflows.filter((w) => w.categories.length > 0).map((w) => w.path)
    if (basisPaths.length === 0) {
        return record
    }
    const [owner, repo] = input.repository.split('/')
    // `unknown` 是引擎既有默认分支哨兵值（未取到分支时），不能当作真实 ref 发起 API 调用
    const defaultBranch = input.defaultBranch && input.defaultBranch !== 'unknown' ? input.defaultBranch : undefined
    if (!input.client || !defaultBranch || !owner || !repo) {
        let reason = '仓库标识不可解析'
        if (!input.client) {
            reason = '无 GitHub 客户端（本地 / pnpm-audit 运行）'
        } else if (!defaultBranch) {
            reason = '未取得默认分支'
        }
        return { ...record, healthUnavailableReason: reason }
    }

    const health = await fetchDefaultBranchWorkflowHealth(basisPaths, {
        client: input.client,
        owner,
        repo,
        defaultBranch,
        ...(input.logger ? { logger: input.logger } : {}),
        ...(input.healthTimeoutMs !== undefined ? { timeoutMs: input.healthTimeoutMs } : {}),
    })
    return {
        ...record,
        ...(health.health.length > 0 ? { defaultBranchHealth: health.health } : {}),
        ...(health.unavailableReason ? { healthUnavailableReason: health.unavailableReason } : {}),
    }
}
