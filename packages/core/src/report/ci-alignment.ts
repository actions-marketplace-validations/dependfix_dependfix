// ci-alignment.ts — 验证链与目标仓库 CI 口径对齐的领域模型与渲染口径。
//
// 分工：
// - 本文件只承载**类型**与**文案渲染**（core 无文件系统 / 网络能力）；
// - 解析 workflow 与默认分支健康预检在 `packages/engine/src/github/ci-alignment.ts`。
//
// 口径约定（见 docs/design/governance/verification-ci-alignment.md）：
// - 只比对**可识别命令类别**（lint / build / typecheck / test），install 不参与比对；
// - 「本次执行但 CI 未跑」= 本次更严格，披露不判不一致；
// - 「CI 运行但本次未执行」= 口径缺口，判不一致；
// - 无法解析 / 非法 YAML / 无 workflow → 未能读取 CI 配置（不阻断运行）；
// - 只描述命令口径，不承诺 CI 结果。

/** 参与口径比对的验证命令类别（install 等准备类命令不参与）。 */
export type VerifyCommandCategory = 'lint' | 'build' | 'typecheck' | 'test'

/**
 * 口径对齐结论。
 *
 * - `aligned`：CI 的可识别验证命令均被本次验证链覆盖（本次可能更严格）
 * - `differs`：CI 运行了本次未执行的验证类别（口径缺口）
 * - `inconclusive`：配置可读，但无可比对的命令类别 / 本次为自定义验证链
 * - `unreadable`：无法读取目标仓库 CI 配置（无 workflow / 非法 YAML / 非 GitHub Actions）
 */
export type CiAlignmentStatus = 'aligned' | 'differs' | 'inconclusive' | 'unreadable'

/** 单个 workflow 文件的解析结果（只保留类别与未识别命令摘要，不保留 YAML 原文）。 */
export interface CiWorkflowEvidence {
    /** 相对仓库根的路径（如 `.github/workflows/ci.yml`） */
    path: string
    /** 该文件识别到的验证命令类别 */
    categories: VerifyCommandCategory[]
    /** 带包管理器但脚本名无法归类的命令（如 `pnpm test:e2e`；最多保留 5 条） */
    unrecognized: string[]
}

/** 默认分支上口径依据 workflow 的最近一次运行结论。 */
export interface CiDefaultBranchHealth {
    /** workflow 文件相对路径 */
    path: string
    /** GitHub run conclusion 原值（success / failure / timed_out / cancelled / ...） */
    conclusion: string
    /** 运行页链接（API 返回时存在） */
    runUrl?: string
    /** 运行序号（API 返回时存在） */
    runNumber?: number
}

/**
 * 单仓库的验证链口径记录（`RunResult.ciAlignment` 的元素）。
 *
 * 由引擎在修复后验证链路完成后写入；默认分支健康预检在 PR 正文组装前补齐。
 */
export interface CiAlignmentRecord {
    repository: string
    /** 本次实际执行的验证命令（`package.json` 中不存在的脚本已跳过；首失败短路时只含已执行前缀） */
    commands: string[]
    status: CiAlignmentStatus
    /** CI 端可识别的命令类别（全部 workflow 的并集） */
    ciCategories: VerifyCommandCategory[]
    /** 本次执行但 CI 未跑的类别（本次更严格，披露不判不一致） */
    extraInExecution: VerifyCommandCategory[]
    /** CI 运行但本次未执行的类别（口径缺口） */
    missingInExecution: VerifyCommandCategory[]
    /** 口径比对所依据的 workflow（每文件一项） */
    workflows: CiWorkflowEvidence[]
    /** `inconclusive` 的原因（无认可比对类别 / 自定义验证链） */
    comparisonNote?: string
    /** `unreadable` 的原因（无 workflow / 非法 YAML / 非 GitHub Actions） */
    unreadableReason?: string
    /** 默认分支健康（仅口径依据 workflow；未发起 / 未获取时为空） */
    defaultBranchHealth?: CiDefaultBranchHealth[]
    /** 健康预检未获取的原因（API 失败 / 限流 / 超时 / 无凭据）——只记日志，不渲染为失败结论 */
    healthUnavailableReason?: string
    /** 比对依据的默认分支名（API 返回默认分支或配置取值；未知时缺省） */
    defaultBranch?: string
}

/** 单条记录的可渲染描述（PR 正文与报告共用，避免双份文案漂移）。 */
export interface CiAlignmentDescription {
    /** 结论短标签（报告表格的 Status 列） */
    statusLabel: string
    /** 结论整句（`CI 口径：…`） */
    headline: string
    /** 补充说明（多余覆盖 / 未识别命令 / 默认分支失败）；顺序固定 */
    notes: string[]
}

/** 判定默认分支健康条目是否属于「失败」（GitHub conclusion 口径）。 */
export function isFailedWorkflowConclusion(conclusion: string): boolean {
    return conclusion === 'failure' || conclusion === 'timed_out' || conclusion === 'startup_failure'
}

function categoryLabels(categories: readonly VerifyCommandCategory[]): string {
    return categories.join(' / ')
}

function uniqueStrings(items: readonly string[]): string[] {
    return [...new Set(items)]
}

/**
 * 生成单仓库口径描述。
 *
 * 文案约束：
 * - 结论句固定以 `CI 口径：` 开头；
 * - 「本次更严格」用「本仓库 CI 未跑 X，本次已验证」（缺 typecheck 的验收口径）；
 * - 未识别命令显式标注「未纳入比对」，不静默丢弃；
 * - 默认分支失败只在**确实为失败**时标注「非本 PR 引入」。
 */
/** 行内代码片段的安全渲染：折叠空白、替换反引号并截断（workflow 路径 / 命令 / 原因均来自目标仓库内容）。 */
function inlineCode(text: string, maxLength = 120): string {
    const safe = text.replace(/`/g, '\u0027').replace(/\s+/g, ' ').trim()
    const clipped = safe.length <= maxLength ? safe : `${safe.slice(0, maxLength - 1)}…`
    return `\`${clipped}\``
}

/** 正文 / 报告里自由文本（解析原因 / 比对说明）的安全渲染：折叠空白、去反引号、截断。 */
function inlineText(text: string, maxLength = 160): string {
    const safe = text.replace(/`/g, '\u0027').replace(/\s+/g, ' ').trim()
    return safe.length <= maxLength ? safe : `${safe.slice(0, maxLength - 1)}…`
}

export function describeCiAlignment(record: CiAlignmentRecord): CiAlignmentDescription {
    // 「依据」只列真正贡献语义项的 workflow（release.yml 等零命中文件不进入结论）
    const basisPaths = record.workflows.filter((w) => w.categories.length > 0).map((w) => w.path)
    const basisText = basisPaths.length > 3
        ? `${basisPaths.slice(0, 3).map((p) => inlineCode(p)).join('、')} 等 ${basisPaths.length} 个`
        : basisPaths.map((p) => inlineCode(p)).join('、')
    const notes: string[] = []
    let statusLabel: string
    let headline: string

    switch (record.status) {
        case 'unreadable':
            statusLabel = '未能读取 CI 配置'
            headline = `CI 口径：未能读取 CI 配置（${inlineText(record.unreadableReason ?? '原因未知')}）`
            break
        case 'inconclusive':
            statusLabel = '无法比对'
            headline = `CI 口径：无法比对（${inlineText(record.comparisonNote ?? '缺少可比对的命令类别')}）`
            break
        case 'differs':
            statusLabel = '不一致'
            headline = record.missingInExecution.length > 0
                ? `CI 口径：不一致（CI 运行、本次未执行：${categoryLabels(record.missingInExecution)}）`
                : 'CI 口径：不一致'
            break
        default:
            statusLabel = '一致'
            headline = basisPaths.length > 0
                ? `CI 口径：一致（依据 ${basisText}）`
                : 'CI 口径：一致'
            break
    }

    if (record.status !== 'unreadable' && record.extraInExecution.length > 0) {
        notes.push(`本仓库 CI 未跑 ${categoryLabels(record.extraInExecution)}，本次已验证`)
    }

    const unrecognized = uniqueStrings(record.workflows.flatMap((w) => w.unrecognized))
    if (unrecognized.length > 0) {
        const preview = unrecognized.slice(0, 3).map((c) => inlineCode(c, 80)).join('、')
        notes.push(`CI 另有 ${unrecognized.length} 条未识别命令（未纳入比对）：${preview}`)
    }

    const failed = (record.defaultBranchHealth ?? []).filter((h) => isFailedWorkflowConclusion(h.conclusion))
    if (failed.length > 0) {
        notes.push(`默认分支同 workflow 最近一次失败（非本 PR 引入）：${failed.map((h) => inlineCode(h.path)).join('、')}`)
    }

    return { statusLabel, headline, notes }
}

function truncateCommandChain(commands: readonly string[], maxLength = 200): string {
    if (commands.length === 0) {
        return '（本次未执行验证命令）'
    }
    const text = commands.map((c) => inlineCode(c)).join(' → ')
    return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`
}

/**
 * 生成单仓库 PR 正文字行（≤5 行）：命令链 + 结论句 + 最多 3 条补充说明。
 *
 * PR 正文行预算固定（避免正文膨胀），所以补充说明按固定优先级截断
 * （多余覆盖 → 未识别命令 → 默认分支失败）。
 */
export function formatCiAlignmentLines(record: CiAlignmentRecord): string[] {
    const description = describeCiAlignment(record)
    return [
        `- 本次验证链：${truncateCommandChain(record.commands)}`,
        `- ${description.headline}`,
        ...description.notes.slice(0, 3).map((note) => `- ${note}`),
    ].slice(0, 5)
}

/**
 * 生成 PR 正文的「CI 口径」区块行（多仓库时共享总行预算）。
 *
 * 单仓库：`formatCiAlignmentLines` 的 ≤5 行；多仓库：先给首个仓库完整区块，
 * 剩余预算不足时以「其余 N 个仓库…见运行报告」收尾（不静默丢弃，也不撑爆正文）。
 */
export function formatCiAlignmentSection(
    records: readonly CiAlignmentRecord[],
    maxLines = 5,
): string[] {
    if (records.length === 0 || maxLines <= 0) {
        return []
    }
    const multiRepo = records.length > 1
    // 多仓库时预留 1 行给「其余 N 个仓库」指针，避免首个仓库占满预算后静默丢弃后续仓库
    const blockBudget = multiRepo ? Math.max(1, maxLines - 1) : maxLines
    const lines: string[] = []
    let rendered = 0
    let truncated = false
    for (const record of records) {
        const remaining = blockBudget - lines.length
        if (remaining <= 0) {
            break
        }
        let block = formatCiAlignmentLines(record)
        if (multiRepo) {
            block = block.map((line, lineIndex) => (
                lineIndex === 1 ? `- ${inlineCode(record.repository)} ${line.slice(2)}` : line
            ))
        }
        if (block.length > remaining) {
            // 只留 1 行会出现「无仓库标识的命令链」被误读为上一仓库的第二条链 —— 整块跳过只留指针
            if (remaining >= 2) {
                lines.push(...block.slice(0, remaining))
            }
            truncated = true
            break
        }
        lines.push(...block)
        rendered += 1
    }
    if (truncated || rendered < records.length) {
        lines.push(`- 其余 ${records.length - rendered} 个仓库的完整 CI 口径见运行报告`)
    }
    return lines.slice(0, maxLines)
}
