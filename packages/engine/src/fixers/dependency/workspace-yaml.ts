// workspace-yaml.ts — pnpm-workspace.yaml 的定点编辑（保留注释 / 引号风格 / 键序）。
//
// 背景：既有 overrides 写入用 `YAML.parse` + `YAML.stringify` 整文件重写——引号风格与键序被
// 规范化；更糟的是解析失败时降级为「只写 overrides」，把用户原有配置整段覆盖掉。
//
// 口径（设计 §7.3）：`YAML.parseDocument` + `setIn` 只改目标键，写回时保证单个尾随换行
// （沿用原文件的 CRLF / LF 风格）；解析失败（重复键 / 非法语法 / 别名 / 顶层非映射）、
// `overrides` 不是映射形态、或含非标量键值 → **不写盘**，返回原因由调用方留痕
// （不降级为整文件重写）。任何 AST 变更异常同样转为 `ok:false`——写盘语义不允许把异常
// 抛给上层编排（会让整仓剩余告警被中止，且 `.bak` 无人清理）。
import { readFileSync, writeFileSync } from 'node:fs'
import YAML, { isMap, isScalar } from 'yaml'
import { upsertOverride } from './override-key'

export type WorkspaceDocument = YAML.Document.Parsed

/** 文档解析结果（失败即不可安全定点编辑）。 */
export type WorkspaceDocumentResult =
    | { ok: true, doc: WorkspaceDocument }
    | { ok: false, reason: string }

/** 读取结果额外带回原文，用于写回时沿用行尾风格。 */
export type WorkspaceDocumentReadResult =
    | { ok: true, doc: WorkspaceDocument, raw: string }
    | { ok: false, reason: string }

/** 一条 overrides 写入（key 为 pnpm overrides 写法，可含 `pkg@selector` / `parent>child`）。 */
export interface WorkspaceOverrideUpdate {
    key: string
    value: string
}

/** 写入结果：`applied` 为「实际写入的 key → 写入前旧值」，供回滚复用。 */
export interface WorkspaceOverrideApplyResult {
    ok: boolean
    applied: Map<string, string | undefined>
    /** 未写盘的原因（`ok=false` 时） */
    error?: string
}

/**
 * 解析 `pnpm-workspace.yaml` 文本。
 *
 * 拒绝三类文档：解析错误（重复键 / 非法语法）、顶层非映射（列表 / 标量）、含别名（`*anchor`
 * 共享节点——定点编辑会连带改到别处的值）。
 */
export function parseWorkspaceDocument(raw: string): WorkspaceDocumentResult {
    const doc = YAML.parseDocument(raw, { uniqueKeys: true })
    if (doc.errors.length > 0) {
        const first = doc.errors[0]?.message.split('\n')[0] ?? 'unknown error'
        return { ok: false, reason: `YAML 解析失败：${first}` }
    }
    if (doc.contents !== null && !isMap(doc.contents)) {
        return { ok: false, reason: '顶层不是映射（mapping），无法定点编辑' }
    }
    if (containsAlias(doc)) {
        return { ok: false, reason: '文档含别名（*anchor），定点编辑可能与其它节点共享值，已跳过' }
    }
    return { ok: true, doc }
}

/** 读取并解析 `pnpm-workspace.yaml`（带回原文以便沿用行尾）。 */
export function readWorkspaceDocument(path: string): WorkspaceDocumentReadResult {
    let raw: string
    try {
        raw = readFileSync(path, 'utf-8')
    } catch (error: unknown) {
        return { ok: false, reason: `无法读取 pnpm-workspace.yaml：${error instanceof Error ? error.message : String(error)}` }
    }
    const parsed = parseWorkspaceDocument(raw)
    return parsed.ok ? { ok: true, doc: parsed.doc, raw } : parsed
}

/**
 * 读出 `overrides` 段的键值（字符串化）。
 *
 * - 键不存在 / 值为空（`overrides:` 后无内容）→ `{}`（写入前会物化为映射，不视为非法）
 * - 该段不是映射（如 `overrides: "oops"`）、键或值非标量（含 null 值）→ `null`：
 *   调用方必须放弃写入，而不是覆盖它（非标量旧值无法安全回写）
 */
export function readOverridesSection(doc: WorkspaceDocument): Record<string, string> | null {
    const node = doc.get('overrides')
    if (node === undefined || node === null) {
        return {}
    }
    if (!isMap(node)) {
        return null
    }
    const entries: Record<string, string> = {}
    for (const item of node.items) {
        if (!isScalar(item.key) || !isScalar(item.value)) {
            return null
        }
        const value = item.value.value
        if (value === null || value === undefined) {
            return null
        }
        entries[String(item.key.value)] = String(value)
    }
    return entries
}

/**
 * 在文档上应用一批 overrides（不写盘）。
 *
 * key 归一化复用 [upsertOverride]（`pkg@^1` 与 `pkg@1` 语义等价时复用已有写法），
 * 因此 `applied` 的键是**实际写入**的 key。`overrides:` 空值会先物化为空映射再写入。
 */
export function applyOverridesToDocument(
    doc: WorkspaceDocument,
    updates: readonly WorkspaceOverrideUpdate[],
): { ok: boolean, applied: Map<string, string | undefined>, error?: string } {
    const entries = readOverridesSection(doc)
    if (entries === null) {
        return { ok: false, applied: new Map(), error: 'overrides 不是映射形态或含非标量键值，已跳过写入（保持原文件）' }
    }
    const applied = new Map<string, string | undefined>()
    try {
        if (!isMap(doc.get('overrides'))) {
            // `overrides:`（空值）/ 段不存在：物化空映射，保留键位置与注释
            doc.set('overrides', doc.createNode({}))
        }
        for (const update of updates) {
            const { key, oldValue } = upsertOverride(entries, update.key, update.value)
            // 同一批内多条归一化到同一 key 时保留首次旧值（回滚依据）
            if (!applied.has(key)) {
                applied.set(key, oldValue)
            }
            doc.setIn(['overrides', key], update.value)
        }
    } catch (error: unknown) {
        return {
            ok: false,
            applied: new Map(),
            error: `定点编辑失败：${error instanceof Error ? error.message : String(error)}`,
        }
    }
    return { ok: true, applied }
}

/** 序列化文档：恰好一个尾随换行；`raw` 为 CRLF 时沿用 CRLF。 */
export function stringifyWorkspaceDocument(doc: WorkspaceDocument, raw?: string): string {
    const text = `${String(doc).replace(/\n+$/, '')}\n`
    return raw?.includes('\r\n') ? text.replace(/\n/g, '\r\n') : text
}

/**
 * 应用 overrides 并写盘。
 *
 * 任一步失败都不落盘：解析失败 / overrides 非映射 / AST 变更异常 → 原文件字节级不变，
 * `error` 说明原因。
 */
export function applyWorkspaceOverrides(
    path: string,
    updates: readonly WorkspaceOverrideUpdate[],
): WorkspaceOverrideApplyResult {
    if (updates.length === 0) {
        return { ok: true, applied: new Map() }
    }
    const parsed = readWorkspaceDocument(path)
    if (!parsed.ok) {
        return { ok: false, applied: new Map(), error: parsed.reason }
    }
    const applied = applyOverridesToDocument(parsed.doc, updates)
    if (!applied.ok) {
        return { ok: false, applied: new Map(), error: applied.error }
    }
    try {
        writeFileSync(path, stringifyWorkspaceDocument(parsed.doc, parsed.raw), 'utf-8')
    } catch (error: unknown) {
        return {
            ok: false,
            applied: new Map(),
            error: `写入 pnpm-workspace.yaml 失败：${error instanceof Error ? error.message : String(error)}`,
        }
    }
    return { ok: true, applied: applied.applied }
}

/**
 * 回滚一批 overrides（恢复旧值 / 删除本次新增的 key）。
 *
 * 与 `applyWorkspaceOverrides` 对称：解析失败或 AST 异常不写盘并返回原因（调用方以备份还原为
 * 权威，本函数仅作兜底）。`overrides` 段被删空时整段移除（与既有回滚语义一致）。
 */
export function rollbackWorkspaceOverrides(
    path: string,
    applied: ReadonlyMap<string, string | undefined>,
): { ok: boolean, error?: string } {
    if (applied.size === 0) {
        return { ok: true }
    }
    const parsed = readWorkspaceDocument(path)
    if (!parsed.ok) {
        return { ok: false, error: parsed.reason }
    }
    const { doc } = parsed
    if (readOverridesSection(doc) === null) {
        return { ok: false, error: 'overrides 不是映射形态或含非标量键值，已跳过回滚（交由备份还原）' }
    }
    try {
        for (const [key, oldValue] of applied) {
            if (oldValue === undefined) {
                doc.deleteIn(['overrides', key])
            } else {
                doc.setIn(['overrides', key], oldValue)
            }
        }
        const remaining = readOverridesSection(doc)
        if (remaining !== null && Object.keys(remaining).length === 0) {
            doc.delete('overrides')
        }
        writeFileSync(path, stringifyWorkspaceDocument(doc, parsed.raw), 'utf-8')
    } catch (error: unknown) {
        return { ok: false, error: `回滚 pnpm-workspace.yaml 失败：${error instanceof Error ? error.message : String(error)}` }
    }
    return { ok: true }
}

/** 文档是否含别名节点（`*anchor`）：共享值无法定点编辑。 */
function containsAlias(doc: WorkspaceDocument): boolean {
    let found = false
    YAML.visit(doc, {
        Alias() {
            found = true
        },
    })
    return found
}
