// git-config.ts — 分支存在性 / 本地 git 身份保障（从 pr-creator.ts 拆出以控制文件行数）。
//
// 交付链上的 git 调用统一走 [run-git](./git-run.ts) 的受管异步执行：同步子进程会阻塞
// 事件循环，让平台执行超时与运行级取消都无法按时生效（口径见 executor-process-isolation §8.5）。
import { runGit, runGitOrThrow } from './git-run'

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

/** 分支是否已存在（`git rev-parse --verify`；非 0 退出即视为不存在）。 */
export async function branchExists(branchName: string, workDir: string): Promise<boolean> {
    const result = await runGit(['rev-parse', '--verify', branchName], { cwd: workDir })
    return result.started && result.code === 0
}

/** 本地 git 身份：仅在 local config 缺失时写入（不覆盖用户既有配置）。 */
export async function ensureGitConfig(workDir: string, author?: { name: string, email: string }): Promise<void> {
    const effectiveAuthor = author ?? PAT_DEFAULT_COMMIT_AUTHOR
    const hasName = await gitConfigExists('user.name', workDir)
    const hasEmail = await gitConfigExists('user.email', workDir)

    if (!hasName) {
        await runGitOrThrow(['config', 'user.name', effectiveAuthor.name], { cwd: workDir, what: 'set git user.name' })
    }
    if (!hasEmail) {
        await runGitOrThrow(['config', 'user.email', effectiveAuthor.email], { cwd: workDir, what: 'set git user.email' })
    }
}

async function gitConfigExists(key: string, workDir: string): Promise<boolean> {
    // 必须用 `--local` 限定 local config 查询——否则 `git config user.name`（无 flag）
    // 走 lookup order (local → global → system)，会返回 host 全局 user.name（如
    // CaoMeiYouRen）误判"已配置"，让 ensureGitConfig 跳过 set local config。
    const result = await runGit(['config', '--local', '--get', key], { cwd: workDir })
    return result.started && result.code === 0
}
