// markdown-table.ts — Markdown 表格单元格转义（PR 正文与失败评论共用）。
//
// 转义顺序固定：反斜杠先于竖线。只转义竖线会让输入内的 `\|` 折叠成裸竖线，
// 表格结构被劫持（CodeQL js/incomplete-sanitization）。

/**
 * 转义 Markdown 表格单元格：`\` 先转义再转义 `|`（避免已有转义双重处理），换行折叠为空格。
 */
export function escapeTableCell(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}
