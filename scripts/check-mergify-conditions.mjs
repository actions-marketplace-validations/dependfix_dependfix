#!/usr/bin/env node

/**
 * check-mergify-conditions：校验 `.github/mergify.yml` 的合并门禁覆盖**本仓库全部 PR job**。
 *
 * 背景与口径：mergify 的 `check-success=<name>` 匹配的是 **job 名**（workflow 中每个 job 是独立
 * check run），`check-success=Test` 不覆盖 `Coverage` / `E2E` / `Visual Regression`。历史上 Dependabot
 * 规则只写了 `Test` + `Coverage`，其余 job 失败仍会被自动合并。本脚本把「规则条件 = PR job 集合」
 * 变为可机检断言：任一 workflow 新增 PR job、或 mergify 条件漂移（漏 job / 名字拼错），CI 即失败。
 *
 * 判定项：
 * ① 每条**含 `merge` 动作**的规则，其 `check-success` 集合必须等于「PR job 集合 ∪ 已声明额外 check」
 *    （缺失 = 门禁漏 job；多出 = job 名拼错 / 已删除）
 * ② 至少各有一条 `author~=` 命中 `dependabot` / `dependfix` 的合并规则（两类 bot PR 都必须有门禁）
 * ③ 未在 `pull_request` 触发的 workflow 不计入（`pull_request_target` 在 base 上下文运行、check run
 *    不落在 PR head，故不计入；本仓当前无此类触发）；job 名含 `${{ … }}` 表达式时直接报错
 *    （matrix / 变量展开后的 check 名无法静态比对，须改用固定 name）
 * ④ 声明陈旧同样报错：`DECLARED_EXTRA_CHECKS` 的键须真的出现在某条规则里、`DECLARED_EXEMPT_JOBS`
 *    的键须真的是当前 PR job——避免「声明过期后门禁悄悄放宽」
 *
 * 边界：只校验 `pull_request_rules[].conditions` 中的 `check-success = <name>` 形态；`check-success~=`
 * 等正则 / 其它运算符变体显式报「不支持」而非静默忽略，`check-neutral` / `check-failure` 不在语义内
 * （需要时须同时扩展规则表与文档）。
 *
 * 契约与文档：`docs/guide/auto-merge.md`（启用指南与模板）、
 * `docs/design/governance/pr-delivery-closure.md` §9.3（归因不参与合并放行）。
 *
 * 用法：
 *   node scripts/check-mergify-conditions.mjs
 *   node scripts/check-mergify-conditions.mjs --json
 *   node scripts/check-mergify-conditions.mjs --root=<path>   # 指定事实源根目录（负例标定用）
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { getArgValue, isDirectExecution } from './shared/cli.mjs'

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..')

/** mergify 规则事实源。 */
export const MERGIFY_REL = '.github/mergify.yml'
/** PR job 事实源目录（扫描全部 workflow，`on.pull_request` 触发者才计入）。 */
export const WORKFLOWS_REL = '.github/workflows'
/** 声明表所在文件（声明陈旧类 finding 的定位落点）。 */
export const SCRIPT_REL = 'scripts/check-mergify-conditions.mjs'

/**
 * 已声明额外 check：允许出现在合并规则里、但不由本仓 workflow job 产出（外部 status / matrix 展开等）。
 * 键 = check 名；值 = `{ reason, trigger }`（理由 + 复核触发条件）。空对象 = 只接受本仓 job 名。
 */
export const DECLARED_EXTRA_CHECKS = {}

/**
 * 已声明豁免 job：本仓 PR job，但明确不纳入合并门禁（如仅报告、不阻断的 job）。
 * 键 = job 名；值 = `{ reason, trigger }`。空对象 = 全部 PR job 必须入门禁。
 */
export const DECLARED_EXEMPT_JOBS = {}

const CHECK_SUCCESS_PATTERN = /^check-success\s*=\s*(.*)$/
/** mergify 支持的其它 check 条件运算符（正则等）：本脚本不解析，显式报错。 */
const UNSUPPORTED_CHECK_OPERATOR = /^check-success[~^]/
const AUTHOR_REGEX_PREFIX = 'author~='

/** 1-based 行号定位（找不到返回 1，不阻断判定）。 */
const findLine = (text, needle) => {
    const index = text.split(/\r?\n/).findIndex((line) => line.includes(needle))
    return index >= 0 ? index + 1 : 1
}

const finding = (file, line, message) => ({ file, line, message })

/**
 * 解析 mergify 规则。
 *
 * 返回 `{ rules, error }`：形状非法时 `error` 非空（调用方转 finding），**不静默当空规则集**。
 */
export function parseMergifyRules(text) {
    let document
    try {
        document = parse(text)
    } catch (error) {
        return { rules: [], error: `YAML 解析失败：${error instanceof Error ? error.message : String(error)}` }
    }
    if (!document || typeof document !== 'object') {
        return { rules: [], error: '顶层不是映射' }
    }
    const rawRules = document.pull_request_rules
    if (!Array.isArray(rawRules)) {
        return { rules: [], error: '缺少 pull_request_rules 数组' }
    }

    const rules = []
    for (const [index, rawRule] of rawRules.entries()) {
        if (!rawRule || typeof rawRule !== 'object') {
            return { rules: [], error: `pull_request_rules[${index}] 不是映射` }
        }
        const name = typeof rawRule.name === 'string' ? rawRule.name : `rule-${index}`
        const rawConditions = rawRule.conditions
        // mergify 允许 `conditions: true`（等价空列表）与字符串简写
        let conditions
        if (rawConditions === true || rawConditions === undefined) {
            conditions = []
        } else if (typeof rawConditions === 'string') {
            conditions = [rawConditions]
        } else {
            conditions = rawConditions
        }
        if (!Array.isArray(conditions)) {
            const mappingHint = conditions !== null && typeof conditions === 'object'
                ? '（YAML 把 `key: value` 解析成映射形态）'
                : ''
            return {
                rules: [],
                error: `规则「${name}」的 conditions 取值非法${mappingHint}；仅支持数组 / true / 字符串（条件需整体写成字符串，含冒号时加引号）`,
            }
        }
        const nonString = conditions.find((condition) => typeof condition !== 'string')
        if (nonString !== undefined) {
            const mappingHint = typeof nonString === 'object' ? 'YAML 把 `key: value` 解析成映射形态，' : ''
            return {
                rules: [],
                error: `规则「${name}」存在非字符串条件（${JSON.stringify(nonString)}）；${mappingHint}条件需整体写成字符串（含冒号时加引号）`,
            }
        }

        const checkSuccess = []
        for (const condition of conditions) {
            if (UNSUPPORTED_CHECK_OPERATOR.test(condition)) {
                return { rules: [], error: `规则「${name}」使用了不支持的 check 条件变体：${condition}（本脚本只识别 check-success = <name>）` }
            }
            const match = CHECK_SUCCESS_PATTERN.exec(condition)
            if (!match) {
                continue
            }
            const checkName = match[1].trim()
            if (!checkName) {
                return { rules: [], error: `规则「${name}」存在空 check-success 条件` }
            }
            checkSuccess.push(checkName)
        }

        const actions = rawRule.actions && typeof rawRule.actions === 'object' ? rawRule.actions : {}
        rules.push({
            name,
            line: findLine(text, `name: ${name}`),
            checkSuccess,
            authors: conditions
                .filter((condition) => condition.startsWith(AUTHOR_REGEX_PREFIX))
                .map((condition) => condition.slice(AUTHOR_REGEX_PREFIX.length)),
            // 只有「会合并」的规则才承担门禁义务；auto-close / label 类规则不参与
            merges: Object.hasOwn(actions, 'merge'),
        })
    }
    return { rules, error: null }
}

/**
 * 解析单个 workflow 中会在 PR 上运行的 job 名。
 *
 * `on` 未包含 `pull_request` → 返回空集合（不是解析失败：该 workflow 不产生 PR check）。
 * job 名含 `${{ … }}` 表达式的单独返回（无法静态比对，由调用方报错）。
 */
export function parsePullRequestJobNames(text) {
    let document
    try {
        document = parse(text)
    } catch (error) {
        return { jobNames: [], expressions: [], error: `YAML 解析失败：${error instanceof Error ? error.message : String(error)}` }
    }
    if (!document || typeof document !== 'object') {
        return { jobNames: [], expressions: [], error: '顶层不是映射' }
    }
    const triggers = document.on
    const onPullRequest = triggers === 'pull_request'
        || (typeof triggers === 'string' && triggers.split(/\s+/).includes('pull_request'))
        || (Array.isArray(triggers) && triggers.includes('pull_request'))
        || (triggers && typeof triggers === 'object' && 'pull_request' in triggers)
    if (!onPullRequest) {
        return { jobNames: [], expressions: [], error: null }
    }
    const jobs = document.jobs
    if (!jobs || typeof jobs !== 'object') {
        return { jobNames: [], expressions: [], error: '缺少 jobs 映射' }
    }
    const jobNames = []
    const expressions = []
    for (const [key, job] of Object.entries(jobs)) {
        const rawName = job && typeof job === 'object' && typeof job.name === 'string' ? job.name : key
        const name = rawName.trim()
        if (!name) {
            continue
        }
        if (name.includes('${{')) {
            expressions.push(name)
        } else {
            jobNames.push(name)
        }
    }
    return { jobNames: [...new Set(jobNames)].sort(), expressions, error: null }
}

/**
 * 比对规则条件与 PR job 集合。
 *
 * @returns findings（空数组 = 一致）
 */
export function compareMergifyConditions({
    rules,
    jobNames,
    extraChecks = DECLARED_EXTRA_CHECKS,
    exemptJobs = DECLARED_EXEMPT_JOBS,
}) {
    const findings = []
    const exempt = new Set(Object.keys(exemptJobs))
    const required = jobNames.filter((job) => !exempt.has(job))
    // 豁免 job 仍允许出现在规则里（更严格、无害）；额外 check 须显式登记
    const allowed = new Set([...required, ...Object.keys(extraChecks), ...exempt])
    const mergeRules = rules.filter((rule) => rule.merges)

    if (mergeRules.length === 0) {
        findings.push(finding(MERGIFY_REL, 1, '缺少含 merge 动作的 pull_request_rules 规则（自动合并门禁未配置）'))
    }
    if (!mergeRules.some((rule) => rule.authors.some((author) => /dependabot/i.test(author)))) {
        findings.push(finding(MERGIFY_REL, 1, '缺少匹配 Dependabot author 的合并规则（author~=…dependabot…）'))
    }
    if (!mergeRules.some((rule) => rule.authors.some((author) => /dependfix/i.test(author)))) {
        findings.push(finding(MERGIFY_REL, 1, '缺少匹配 dependfix author 的合并规则（author~=…dependfix…）'))
    }

    for (const rule of mergeRules) {
        const declared = new Set(rule.checkSuccess)
        for (const job of required) {
            if (!declared.has(job)) {
                findings.push(finding(
                    MERGIFY_REL,
                    rule.line,
                    `规则「${rule.name}」缺少 check-success=${job}（该 job 在 pull_request 触发，必须作为合并门禁；skipped ≠ success）`,
                ))
            }
        }
        for (const check of declared) {
            if (!allowed.has(check)) {
                findings.push(finding(
                    MERGIFY_REL,
                    rule.line,
                    `规则「${rule.name}」引用了不存在的 check-success=${check}（job 名拼错 / 已删除 / 未在 pull_request 触发；确属外部 check 请登记 DECLARED_EXTRA_CHECKS）`,
                ))
            }
        }
    }

    // 声明陈旧：登记了却不再适用 → 报错（避免门禁悄悄放宽）
    const allDeclaredChecks = new Set(mergeRules.flatMap((rule) => rule.checkSuccess))
    for (const check of Object.keys(extraChecks)) {
        if (!allDeclaredChecks.has(check)) {
            findings.push(finding(SCRIPT_REL, 1, `DECLARED_EXTRA_CHECKS 声明陈旧：${check} 未出现在任何合并规则中`))
        }
    }
    for (const job of Object.keys(exemptJobs)) {
        if (!jobNames.includes(job)) {
            findings.push(finding(SCRIPT_REL, 1, `DECLARED_EXEMPT_JOBS 声明陈旧：${job} 已不是当前 PR job`))
        }
    }
    return findings
}

/**
 * 纯文本入参入口（单测主入口）。
 *
 * `workflows` 为 `[{ path, text }]`：所有 workflow 的 PR job 取并集。
 */
export function runCheckOnTexts({ mergifyText, workflows }) {
    const mergify = parseMergifyRules(mergifyText)
    const findings = []
    if (mergify.error) {
        findings.push(finding(MERGIFY_REL, 1, mergify.error))
    }

    const jobNames = []
    for (const workflow of workflows) {
        const parsed = parsePullRequestJobNames(workflow.text)
        if (parsed.error) {
            findings.push(finding(workflow.path, 1, parsed.error))
            continue
        }
        jobNames.push(...parsed.jobNames)
        for (const expression of parsed.expressions) {
            findings.push(finding(
                workflow.path,
                1,
                `job 名含表达式「${expression}」：matrix / 变量展开后的 check 名无法静态比对，请改用固定 name`,
            ))
        }
    }

    if (findings.length === 0) {
        findings.push(...compareMergifyConditions({ rules: mergify.rules, jobNames: [...new Set(jobNames)].sort() }))
    }
    return {
        ok: findings.length === 0,
        jobNames: [...new Set(jobNames)].sort(),
        rules: mergify.rules.map((rule) => ({ name: rule.name, checkSuccess: rule.checkSuccess })),
        findings,
    }
}

/** 读取仓库内的 mergify 规则与全部 workflow 并比对。`root` 可由 `--root=<path>` 覆盖（负例标定用）。 */
export function runCheck(root = REPO_ROOT) {
    const findings = []
    let mergifyText = ''
    try {
        mergifyText = readFileSync(join(root, MERGIFY_REL), 'utf8')
    } catch (error) {
        findings.push(finding(MERGIFY_REL, 1, `读取失败：${error instanceof Error ? error.message : String(error)}`))
    }

    const workflows = []
    try {
        const dir = join(root, WORKFLOWS_REL)
        const files = readdirSync(dir)
            .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'))
            .sort()
        for (const file of files) {
            const path = relative(root, join(dir, file)).split('\\').join('/')
            try {
                workflows.push({ path, text: readFileSync(join(dir, file), 'utf8') })
            } catch (error) {
                findings.push(finding(path, 1, `读取失败：${error instanceof Error ? error.message : String(error)}`))
            }
        }
    } catch (error) {
        findings.push(finding(WORKFLOWS_REL, 1, `读取目录失败：${error instanceof Error ? error.message : String(error)}`))
    }

    if (findings.length > 0) {
        return { ok: false, jobNames: [], rules: [], findings }
    }
    return runCheckOnTexts({ mergifyText, workflows })
}

if (isDirectExecution(import.meta.url)) {
    const json = process.argv.includes('--json')
    const root = getArgValue(process.argv, '--root') ?? REPO_ROOT
    const result = runCheck(root)
    if (json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    } else if (result.ok) {
        process.stdout.write(
            `[check-mergify-conditions] OK：${result.rules.length} 条合并规则覆盖 PR job（${result.jobNames.join(' / ')}）\n`,
        )
    } else {
        for (const item of result.findings) {
            process.stderr.write(`${item.file}:${item.line}: ${item.message}\n`)
        }
        process.stdout.write(`[check-mergify-conditions] ${result.findings.length} 处不一致\n`)
    }
    process.exit(result.ok ? 0 : 1)
}
