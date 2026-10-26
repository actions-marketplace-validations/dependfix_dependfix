// fix-fingerprint.ts — 同告警尝试指纹与 PR 正文标记的纯函数（无 I/O）。
//
// 目的：同一告警、同一目标版本、同一修复策略在连续两次关闭后不再原样重开。
// 载体为 PR 正文 HTML 注释（CLI / Action 通用，无需持久表与迁移；平台交付链不写标记，
// 其关闭 PR 不消耗尝试额度——见设计稿 §6.4）：
//
//   <!-- dependfix:attempt key=<key> n=<n> fp=<optional> failed=<0|1|?> -->
//
// - `key`：尝试键，`sha256([source, packageName, targetVersion, planStrategy])` 前 16 位；
//   命名空间隐含于仓库作用域（键本身不含 repo，读取按单仓索引）。
// - `n`：本次尝试序号（同键最近关闭 PR 数 + 1），**创建 PR 前**即可算出。
// - `fp` / `failed`：CI 失败签名与结果，仅在观察到 check 结果后回写（本阶段只读不写）。
//
// 解析失败（人工改写 / 截断 / 旧格式）一律按未命中处理（fail-open）：计数只会偏小，
// 最坏结果是多尝试一次，不会误跳过真实修复。
//
// 计数口径见 [pr-delivery-closure.md §6](../../../../docs/design/governance/pr-delivery-closure.md)。
import { createHash } from 'node:crypto'
import type { FixAction, RepeatedAttemptRecord } from '@dependfix/core'

/** 修复策略（尝试键的策略维度；策略变化即视为不同尝试）。 */
export type PlanStrategy = 'direct-upgrade' | 'override' | 'member-upgrade' | 'family-lockstep'

/** 尝试键输入。 */
export interface AttemptKeyInput {
    /** 告警源（dependabot / pnpm-audit；Code Scanning / Code Quality 不参与尝试计数） */
    source: string
    /** 包名（同一告警族的稳定标识） */
    packageName: string
    /** 目标版本（本次修复计划的推荐版本） */
    targetVersion: string
    /** 修复策略（见 PlanStrategy） */
    planStrategy: PlanStrategy
}

/** 尝试键长度（hex 字符数）。 */
export const ATTEMPT_KEY_LENGTH = 16

/** 失败签名归一化输入上限（字符数；失败命令 + 错误文本各截断到该长度）。 */
export const FAILURE_SIGNATURE_INPUT_LIMIT = 2048

const ATTEMPT_KEY_PATTERN = /^[0-9a-f]{16}$/
const FAILURE_SIGNATURE_PATTERN = /^[0-9a-f]{8,32}$/
const MARKER_COMMENT_START = '<!--'
const MARKER_KIND = 'dependfix:attempt'
const MARKER_COMMENT_END = '-->'
const MARKER_WHITESPACE = /\s/

/**
 * 计算同告警尝试键。
 *
 * 同一输入恒等；目标版本或修复策略变化 → 键变化（自然失效，不继承尝试计数）。
 */
export function computeAttemptKey(input: AttemptKeyInput): string {
    const payload = [input.source, input.packageName, input.targetVersion, input.planStrategy].join('\u0000')
    return createHash('sha256').update(payload).digest('hex').slice(0, ATTEMPT_KEY_LENGTH)
}

/**
 * 计算 CI 失败签名（8 位 hex）。
 *
 * 归一化：命令与错误文本各自折叠空白 + 截断到 2KB，再取 sha256 前 8 位。
 * 签名只增强证据（失败是否同因），**不改变尝试计数口径**。
 */
export function computeFailureSignature(command: string, error: string): string {
    const parts = [command, error].map((part) =>
        part.replace(/\s+/g, ' ').trim().slice(0, FAILURE_SIGNATURE_INPUT_LIMIT),
    )
    return createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 8)
}

/** PR 正文里的尝试标记（一个 PR 可携带多条：一次修复通常覆盖多条告警）。 */
export interface AttemptMarker {
    /** 尝试键（16 位 hex） */
    key: string
    /** 尝试序号（1 起） */
    n: number
    /** CI 失败签名（可选；仅回写阶段存在） */
    failureSignature?: string
    /** CI 结果（`0` 成功 / `1` 失败；缺省 = 未知） */
    failed?: 0 | 1
}

/**
 * 生成尝试标记（HTML 注释，渲染后不可见；置于正文头部以避免尾部截断丢失）。
 *
 * `n` 由调用方按「同键已关闭 PR 数 + 1」给出；解析侧只接受 1-9999（查询窗口 50 条 ⇒ 实际上界 51），
 * 超出会被丢弃（fail-open）。
 */
export function formatAttemptMarker(marker: AttemptMarker): string {
    const parts = [`key=${marker.key}`, `n=${marker.n}`]
    if (marker.failureSignature) {
        parts.push(`fp=${marker.failureSignature}`)
    }
    parts.push(`failed=${marker.failed === undefined ? '?' : marker.failed}`)
    return `<!-- dependfix:attempt ${parts.join(' ')} -->`
}

/**
 * 解析 PR 正文中的尝试标记（支持多条）。
 *
 * 容错口径：键格式非法 / 序数非正整数（仅接受 1-9999 的十进制）/ 签名或结果格式非法 →
 * 丢弃该条（fail-open）。同一标记内重复属性按 **last-wins**（后写覆盖）。
 */
export function parseAttemptMarkers(body: string | null | undefined): AttemptMarker[] {
    if (!body) {
        return []
    }
    const markers: AttemptMarker[] = []
    for (const attributes of iterateMarkerAttributes(body)) {
        const key = attributes.get('key') ?? ''
        const rawN = attributes.get('n') ?? ''
        // 只接受十进制整数：`1e3` / `0x10` / 负数 / 超上界一律丢弃（避免后续 CI 回环展示面被伪造值穿透）
        const n = /^\d{1,4}$/.test(rawN) ? Number(rawN) : Number.NaN
        if (!ATTEMPT_KEY_PATTERN.test(key) || !Number.isInteger(n) || n < 1) {
            continue
        }
        const marker: AttemptMarker = { key, n }
        const signature = attributes.get('fp')
        if (signature && FAILURE_SIGNATURE_PATTERN.test(signature)) {
            marker.failureSignature = signature
        }
        const failed = attributes.get('failed')
        if (failed === '0' || failed === '1') {
            marker.failed = failed === '1' ? 1 : 0
        }
        markers.push(marker)
    }
    return markers
}

/**
 * 把本次运行的尝试记录折算为 PR 标记。
 *
 * - 跳过（`skipped`）不写标记：该告警本次未进入修复，写入会虚增后续计数
 * - 传入 `executed`（本次实际产出的动作）时，只写「确实执行过」的键：pristine 安装基线失败 /
 *   验证门禁回滚 / 无交付物等分支下，计划阶段已记录的键不会被执行，写标记会白白消耗一次额度
 * - 同键去重取最大序号（多仓 / 同包多 GHSA 会产出重复键）
 */
export function collectAttemptMarkers(
    records: readonly RepeatedAttemptRecord[],
    executed?: ReadonlyArray<Pick<FixAction, 'type' | 'repository' | 'target' | 'noOp'>>,
): AttemptMarker[] {
    const executedKeys = executed
        ? new Set(executed
            .filter((action) => action.type === 'dependency-upgrade' && !action.noOp)
            .map((action) => `${action.repository}\u0000${action.target}`))
        : undefined
    const byKey = new Map<string, number>()
    for (const record of records) {
        if (record.status === 'skipped') {
            continue
        }
        if (executedKeys && !executedKeys.has(`${record.repository}\u0000${record.packageName}`)) {
            continue
        }
        const current = byKey.get(record.key) ?? 0
        if (record.attempt > current) {
            byKey.set(record.key, record.attempt)
        }
    }
    return [...byKey.entries()].map(([key, n]) => ({ key, n }))
}

/**
 * 逐个产出尝试标记的属性区（`dependfix:attempt` 之后、`-->` 之前的文本）。
 *
 * 用单遍扫描替代正则 `<!--\s*dependfix:attempt\s+([^>]*?)-->`：该正则在属性区
 * 不含 `-->` 时，`\s+` 与 `[^>]*?` 的切分组合会随输入长度平方级回退
 * （CodeQL js/polynomial-redos：`<!--dependfix:attempt` + 大量制表符）。
 * 扫描与原正则语义逐字等价：kind 前允许空白、kind 后至少一个空白、
 * 属性区不跨 `>`（`-->` 的 `>` 必须是属性区之后的第一个 `>`）。
 */
function* iterateMarkerAttributes(body: string): Generator<Map<string, string>, void, void> {
    let cursor = 0
    // 已定位的 `>` 位置：随 cursor 单调推进，避免每个候选起点重复扫到串尾
    let nextGt = -1
    while (cursor < body.length) {
        const start = body.indexOf(MARKER_COMMENT_START, cursor)
        if (start === -1) {
            return
        }
        const kindStart = skipMarkerWhitespace(body, start + MARKER_COMMENT_START.length)
        if (!body.startsWith(MARKER_KIND, kindStart)) {
            cursor = start + MARKER_COMMENT_START.length
            continue
        }
        const attributesStart = skipMarkerWhitespace(body, kindStart + MARKER_KIND.length)
        if (attributesStart === kindStart + MARKER_KIND.length) {
            // kind 后没有空白：原正则的 `\s+` 不匹配，继续找下一个 `<!--`
            cursor = attributesStart
            continue
        }
        if (nextGt < attributesStart) {
            nextGt = body.indexOf('>', attributesStart)
            if (nextGt === -1) {
                return
            }
        }
        const attributesEnd = nextGt - (MARKER_COMMENT_END.length - 1)
        if (attributesEnd >= attributesStart && body.startsWith(MARKER_COMMENT_END, attributesEnd)) {
            yield parseMarkerAttributes(body.slice(attributesStart, attributesEnd))
            cursor = nextGt + 1
            nextGt = -1
            continue
        }
        cursor = start + MARKER_COMMENT_START.length
    }
}

function skipMarkerWhitespace(body: string, from: number): number {
    let index = from
    while (index < body.length && MARKER_WHITESPACE.test(body.charAt(index))) {
        index += 1
    }
    return index
}

function parseMarkerAttributes(input: string): Map<string, string> {
    const attributes = new Map<string, string>()
    for (const token of input.trim().split(/\s+/)) {
        const separator = token.indexOf('=')
        if (separator <= 0) {
            continue
        }
        attributes.set(token.slice(0, separator), token.slice(separator + 1))
    }
    return attributes
}
