// family.ts — 家族锁步摘要（运行报告与 PR 正文共用同一事实源）。
//
// 输入是修复动作上的 `FixAction.family`（由引擎按家族规则写盘时记录）；
// 输出按「仓库 + 家族」收敛（**仓库级口径**：同一仓库的根 / 成员 manifest 归并成一行）。
// 只消费**成功且非 noOp** 的动作——验证失败 / 环境性停机后回滚的动作仍保留
// `family` 记录，但不代表本次写盘已落地，不能出现在摘要里。
//
// 合并规则：`members` 取并集；`skipped` 取并集后**剔除已写入的成员**，保证
// `members ∩ skipped = ∅`（同一包在不同 manifest 中可能一侧写入、另一侧跳过）。

import type { FixAction, FixActionFamily } from './types'

export interface FamilyLockstepSummary extends Pick<FixActionFamily, 'members' | 'skipped'> {
    repository: string
    family: string
}

/**
 * 收集运行中命中家族的锁步记录（按仓库 + 家族收敛，结果按仓库 / 家族排序）。
 */
export function collectFamilySummaries(actions: FixAction[]): FamilyLockstepSummary[] {
    const byKey = new Map<string, { repository: string, family: string, members: Set<string>, skipped: Set<string> }>()
    for (const action of actions) {
        const family = action.family
        if (!family || !action.success || action.noOp === true) {
            continue
        }
        const key = `${action.repository}\u0000${family.id}`
        const existing = byKey.get(key)
        if (!existing) {
            byKey.set(key, {
                repository: action.repository,
                family: family.id,
                members: new Set(family.members),
                skipped: new Set(family.skipped),
            })
            continue
        }
        for (const member of family.members) {
            existing.members.add(member)
        }
        for (const member of family.skipped) {
            existing.skipped.add(member)
        }
    }

    return [...byKey.values()]
        .map(({ repository, family, members, skipped }) => ({
            repository,
            family,
            members: [...members],
            skipped: [...skipped].filter((member) => !members.has(member)),
        }))
        .sort((a, b) => a.repository.localeCompare(b.repository) || a.family.localeCompare(b.family))
}
