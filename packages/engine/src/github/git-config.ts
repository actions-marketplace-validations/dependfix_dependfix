// git-config.ts — 分支存在性 / 本地 git 身份保障（从 pr-creator.ts 拆出以控制文件行数）。
import { execFileSync } from 'node:child_process'

/**
 * PAT 路径默认 commit author（保持现有 PAT 路径用户行为零变化）。
 *
 * 注：此常量仅作为 PAT 路径的默认值；GitHub App 路径接入后走动态 commit author。
 * 现有 PAT 路径仍硬编码 `dependfix[bot]@users.noreply.github.com`，虽非真实 bot 身份（字符串约定），
 * 但保持行为不变以确保 PAT 用户无感升级。已知缺陷由后续阶段修复。
 *
 * @see [PAT 无感升级评估 §5.1 兼容性](../../../../docs/design/governance/c22-pat-backward-compat.md)
 */
export const PAT_DEFAULT_COMMIT_AUTHOR = {
    name: 'dependfix[bot]',
    email: 'dependfix[bot]@users.noreply.github.com',
} as const

/** 分支是否已存在（`git rev-parse --verify`）。 */
export function branchExists(branchName: string, workDir: string): boolean {
    try {
        execFileSync('git', ['rev-parse', '--verify', branchName], {
            cwd: workDir,
            stdio: 'pipe',
        })
        return true
    } catch {
        return false
    }
}

/** 本地 git 身份：仅在 local config 缺失时写入（不覆盖用户既有配置）。 */
export function ensureGitConfig(workDir: string, author?: { name: string, email: string }): void {
    const effectiveAuthor = author ?? PAT_DEFAULT_COMMIT_AUTHOR
    const hasName = gitConfigExists('user.name', workDir)
    const hasEmail = gitConfigExists('user.email', workDir)

    if (!hasName) {
        execFileSync('git', ['config', 'user.name', effectiveAuthor.name], { cwd: workDir, stdio: 'pipe' })
    }
    if (!hasEmail) {
        execFileSync('git', ['config', 'user.email', effectiveAuthor.email], { cwd: workDir, stdio: 'pipe' })
    }
}

function gitConfigExists(key: string, workDir: string): boolean {
    // 必须用 `--local` 限定 local config 查询——否则 `git config user.name`（无 flag）
    // 走 lookup order (local → global → system)，会返回 host 全局 user.name（如
    // CaoMeiYouRen）误判"已配置"，让 ensureGitConfig 跳过 set local config。
    try {
        execFileSync('git', ['config', '--local', '--get', key], { cwd: workDir, stdio: 'pipe' })
        return true
    } catch {
        return false
    }
}
