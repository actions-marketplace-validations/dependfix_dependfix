#!/usr/bin/env node

/**
 * check-verify-chain：校验「本仓库自用验证链 ⊇ 引擎默认验证链」的语义一致性。
 *
 * 背景与口径：本仓库通过 `.github/workflows/security-auto-fix.yml` 的 `commands` 输入自用
 * dependfix（dogfooding）。CLI `--commands` 是**整链替换**语义（引擎侧
 * `customCommands ?? DEFAULT_VERIFY_COMMANDS`，见 `packages/engine/src/app/verify-project.ts`），
 * 因此引擎默认链每次扩展都**不会自动跟随**自用链——该面差曾长期静默存在。
 * 本脚本把「自用链必须覆盖默认链的语义项、差异项必须显式声明」变为可机检断言。
 *
 * 语义口径（按语义项比对，不做字面串相等）：
 * - `pnpm install …` → `install`
 * - `pnpm <script>` → `<script>`（脚本名，如 `lint` / `typecheck` / `test`）
 * - 其余（如 `pnpm --filter <pkg> exec <cmd>`）→ 归一化后的命令全文，须登记 `DECLARED_EXTRAS`
 *
 * 判定项：
 * ① 默认链语义项必须全部出现在自用链中，缺失项须登记 `DECLARED_GAPS`（含理由与复核触发条件）
 * ② 自用链的额外项须登记 `DECLARED_EXTRAS`（含理由）；可选的 `before` 约束其相对位置
 * ③ 两条链**共有语义项的相对顺序**必须一致（顺序本身承载正确性：如 build 先于 typecheck）
 * ④ 声明陈旧同样报错（已在链中存在却仍登记为缺失 / 已不存在却仍登记为额外项）
 *
 * 契约与文档：`docs/design/governance/github-action-workflow.md`（`commands` 输入表，含
 * 「整链替换、默认链内的条目需显式保留」声明）、`docs/standards/platform.md` §3.8
 * （平台 `verifyCommands` 与 CLI `--commands` 同语义）。
 *
 * 已知边界（语义分类未覆盖形态，后果为保守误报而非漏判）：仅识别 `pnpm install …` 与单脚本
 * `pnpm <script>`；`pnpm run <script>` / `corepack pnpm@<version>` / 内联 `&&` 等形态按归一化全文计入，
 * 须登记在 `DECLARED_EXTRAS` 中。数组体内出现非单引号字面量（双引号 / 展开 / 模板串）时按解析失败
 * 上报，不静默跳过。
 *
 * 用法：
 *   node scripts/check-verify-chain.mjs
 *   node scripts/check-verify-chain.mjs --json
 *   node scripts/check-verify-chain.mjs --root=<path>   # 指定事实源根目录（端到端负例标定用）
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getArgValue, isDirectExecution } from './shared/cli.mjs'

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..')

/** 自用链所在文件（workflow `commands` 回退值）。 */
export const WORKFLOW_REL = '.github/workflows/security-auto-fix.yml'
/** 引擎默认链唯一事实源。 */
export const ENGINE_CHAIN_REL = 'packages/engine/src/runners/verification-runner.ts'

/**
 * 已声明差异项：自用链**缺失**的默认链语义项。
 * 键 = 语义项；值 = `{ reason, trigger }`（理由 + 复核触发条件）。空对象 = 自用链已完全覆盖默认链。
 */
export const DECLARED_GAPS = {}

/**
 * 已声明额外项：自用链**有而默认链无**的条目。键 = 归一化命令全文。
 * - `reason`：为何必须存在（理由须可追溯到文档或实证）
 * - `before`（可选）：该额外项必须排在该语义项**之前**
 */
export const DECLARED_EXTRAS = {
    'pnpm --filter @dependfix/platform exec nuxt prepare': {
        reason: '本仓库 eslint 依赖 `.nuxt/tsconfig.json`（nuxt prepare 生成物）；引擎默认链无 prepare 步骤会导致解析失败。依据：`docs/design/governance/github-action-workflow.md` 的 `commands` 输入说明、`docs/design/governance/experience-archive-§36-§40-toolchain.md`',
        before: 'lint',
    },
}

/** 命令归一化：折叠空白 + 去首尾。 */
export function normalizeCommand(command) {
    return command.trim().replace(/\s+/g, ' ')
}

/** 逗号分隔的链字符串 → 命令数组。 */
export function parseChainString(value) {
    return value.split(',').map(normalizeCommand).filter(Boolean)
}

/** 语义项分类。 */
export function classifyCommand(command) {
    const normalized = normalizeCommand(command)
    if (/^pnpm install(\s|$)/.test(normalized)) {
        return 'install'
    }
    const scriptMatch = /^pnpm ([A-Za-z][\w:-]*)$/.exec(normalized)
    if (scriptMatch) {
        return scriptMatch[1]
    }
    return normalized
}

/**
 * 从 workflow 文本提取自用链回退值：`commands: ${{ inputs.commands || '…' }}`。
 * 未命中返回 `null`（视为解析失败，由调用方报错而非静默通过）。
 */
export function parseWorkflowSelfChain(text) {
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
        const match = /commands:\s*\$\{\{\s*inputs\.commands\s*\|\|\s*'([^']*)'\s*\}\}/.exec(lines[i])
        if (match) {
            return { commands: parseChainString(match[1]), line: i + 1 }
        }
    }
    return null
}

/** 从引擎源码提取默认链常量数组。未命中返回 `null`；数组体内出现**无法解析的行**时返回 `malformed`。 */
export function parseEngineDefaultChain(text) {
    const lines = text.split(/\r?\n/)
    const startIndex = lines.findIndex((line) => /export const DEFAULT_VERIFY_COMMANDS\s*=\s*\[/.test(line))
    if (startIndex === -1) {
        return null
    }
    const commands = []
    for (let i = startIndex + 1; i < lines.length; i++) {
        if (/^\s*\]/.test(lines[i])) {
            return { commands, line: startIndex + 1, malformed: null }
        }
        const trimmed = lines[i].trim()
        // 空行与注释行不参与判定（数组体内允许格式化与说明注释）
        if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
            continue
        }
        const itemMatch = /^\s*'([^']*)'\s*,?\s*$/.exec(lines[i])
        if (!itemMatch) {
            // 顶层声明起始行 = 数组未闭合（例如 `]` 被删除）→ 与「字面量形态不识别」区分上报
            if (/^(export\s+)?(const|let|var|function|class|interface|type)\b/.test(lines[i])) {
                return { commands, line: startIndex + 1, malformed: { line: i + 1, text: '数组未闭合（未找到 `]`）' } }
            }
            // 非单引号字面量（如双引号 / 展开 / 模板串）→ 单列字面量正则匹配不上，
            // 若静默跳过即会「漏判默认为通过」，故显式上报解析失败。
            return { commands, line: startIndex + 1, malformed: { line: i + 1, text: trimmed } }
        }
        commands.push(normalizeCommand(itemMatch[1]))
    }
    return { commands, line: startIndex + 1, malformed: { line: lines.length, text: '数组未闭合（未找到 `]`）' } }
}

/**
 * 比对本仓库自用链与引擎默认链，返回不一致清单。
 * @returns {Array<{file: string, line: number, message: string}>}
 */
export function compareChains({
    selfCommands,
    selfLine,
    defaultCommands,
    gaps = DECLARED_GAPS,
    extras = DECLARED_EXTRAS,
}) {
    const findings = []
    const selfKeys = selfCommands.map(classifyCommand)
    const defaultKeys = defaultCommands.map(classifyCommand)
    const selfSet = new Set(selfKeys)
    const defaultSet = new Set(defaultKeys)

    // ① 默认链语义项必须被自用链覆盖（缺失须显式声明）
    for (const key of defaultKeys) {
        if (!selfSet.has(key) && !(key in gaps)) {
            findings.push({
                file: WORKFLOW_REL,
                line: selfLine,
                message: `自用链缺少引擎默认链语义项 \`${key}\`——请在自用链补齐，或登记到 scripts/check-verify-chain.mjs 的 DECLARED_GAPS 并写明理由与复核触发条件`,
            })
        }
    }

    // ② 声明陈旧：已覆盖却仍登记为缺失
    for (const key of Object.keys(gaps)) {
        if (selfSet.has(key)) {
            findings.push({
                file: 'scripts/check-verify-chain.mjs',
                line: 0,
                message: `DECLARED_GAPS 中的 \`${key}\` 已存在于自用链，声明陈旧须移除`,
            })
        }
    }

    // ③ 额外项须声明
    for (const key of selfKeys) {
        if (!defaultSet.has(key) && !(key in extras)) {
            findings.push({
                file: WORKFLOW_REL,
                line: selfLine,
                message: `自用链额外项 \`${key}\` 未声明——请登记到 scripts/check-verify-chain.mjs 的 DECLARED_EXTRAS 并写明理由`,
            })
        }
    }

    // ④ 声明陈旧：extras 中登记的项已不存在于自用链
    for (const declared of Object.keys(extras)) {
        if (!selfSet.has(declared)) {
            findings.push({
                file: 'scripts/check-verify-chain.mjs',
                line: 0,
                message: `DECLARED_EXTRAS 中的 \`${declared}\` 已不在自用链中，声明陈旧须移除`,
            })
        }
    }

    // ⑤ 额外项的 `before` 位置约束（目标缺失 = 声明失效，须报错而非静默通过）
    for (const [declared, meta] of Object.entries(extras)) {
        const before = meta?.before
        if (!before) {
            continue
        }
        const declaredIndex = selfKeys.indexOf(declared)
        const beforeIndex = selfKeys.indexOf(before)
        if (declaredIndex === -1) {
            // 该额外项本身不存在 → 由 ④ 的「声明陈旧」上报，此处不重复报
            continue
        }
        if (beforeIndex === -1) {
            findings.push({
                file: 'scripts/check-verify-chain.mjs',
                line: 0,
                message: `DECLARED_EXTRAS 中 \`${declared}\` 声明的 before=\`${before}\` 在自用链中不存在，位置约束失效须修正`,
            })
            continue
        }
        if (declaredIndex > beforeIndex) {
            findings.push({
                file: WORKFLOW_REL,
                line: selfLine,
                message: `额外项 \`${declared}\` 必须排在 \`${before}\` 之前（当前顺序相反）`,
            })
        }
    }

    // ⑥ 共有语义项的相对顺序必须一致
    const selfCommon = selfKeys.filter((key) => defaultSet.has(key))
    const defaultCommon = defaultKeys.filter((key) => selfSet.has(key))
    if (selfCommon.join(' → ') !== defaultCommon.join(' → ')) {
        findings.push({
            file: WORKFLOW_REL,
            line: selfLine,
            message: `共有语义项相对顺序与引擎默认链不一致——自用链 [${selfCommon.join(' → ')}] / 默认链 [${defaultCommon.join(' → ')}]`,
        })
    }

    return findings
}

/** 基于文本比对（供单测注入 fixture / mutation 使用）。 */
export function runCheckOnTexts({ workflowText, engineText, gaps, extras }) {
    const self = parseWorkflowSelfChain(workflowText)
    const engineDefault = parseEngineDefaultChain(engineText)
    if (!engineDefault) {
        return { findings: [{ file: ENGINE_CHAIN_REL, line: 0, message: '未找到 DEFAULT_VERIFY_COMMANDS 常量数组（解析口径见脚本头注释）' }] }
    }
    if (engineDefault.malformed) {
        return {
            findings: [{
                file: ENGINE_CHAIN_REL,
                line: engineDefault.malformed.line,
                message: `DEFAULT_VERIFY_COMMANDS 数组项无法解析为单引号字面量（${engineDefault.malformed.text}）——解析失败按不一致上报，避免静默通过`,
            }],
        }
    }
    if (!self) {
        return { findings: [{ file: WORKFLOW_REL, line: 0, message: '未找到自用链 `commands: ${{ inputs.commands || \'…\' }}`（解析口径见脚本头注释）' }] }
    }
    return {
        findings: compareChains({
            selfCommands: self.commands,
            selfLine: self.line,
            defaultCommands: engineDefault.commands,
            gaps,
            extras,
        }),
        selfCommands: self.commands,
        defaultCommands: engineDefault.commands,
        selfLine: self.line,
        defaultLine: engineDefault.line,
    }
}

/** 读取仓库内的两处事实源并比对。`root` 可由 `--root=<path>` 覆盖（供端到端负例标定使用）。 */
export function runCheck(root = REPO_ROOT) {
    return runCheckOnTexts({
        workflowText: readFileSync(join(root, WORKFLOW_REL), 'utf8'),
        engineText: readFileSync(join(root, ENGINE_CHAIN_REL), 'utf8'),
    })
}

if (isDirectExecution(import.meta.url)) {
    const json = process.argv.includes('--json')
    const root = getArgValue(process.argv, '--root') ?? REPO_ROOT
    const result = runCheck(root)
    if (json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    } else if (result.findings.length === 0) {
        const extras = Object.keys(DECLARED_EXTRAS)
        process.stdout.write(
            `[check-verify-chain] OK：自用链覆盖默认链全部语义项（${result.defaultCommands.map(classifyCommand).join(' → ')}）`
            + `；已声明差异项 ${Object.keys(DECLARED_GAPS).length} / 额外项 ${extras.length}\n`,
        )
    } else {
        for (const finding of result.findings) {
            process.stderr.write(`${finding.file}:${finding.line}: ${finding.message}\n`)
        }
        process.stdout.write(`[check-verify-chain] ${result.findings.length} 处不一致\n`)
    }
    process.exit(result.findings.length > 0 ? 1 : 0)
}
