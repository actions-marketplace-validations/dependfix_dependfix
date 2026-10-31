// duplicate-prs.ts — 重复 PR 家务（自 app/index.ts 拆出，控制单文件行数）。
//
// 语义与拆分前一致：在新 PR 上评论指向被取代的旧 PR，并添加 `duplicate` label；
// 两步都是 best-effort —— 新 PR 已创建成功，用户已可访问，家务失败不应阻断主流程。
// 两者需要 `issues: write` token scope（比 `pull-requests: write` 宽），权限不足时记录 warning。
import type { Octokit } from '@octokit/rest'
import { toErrorMessage, type Logger } from '@dependfix/core'
import { addLabelToPullRequest, commentOnPullRequest, type DependfixOpenPR } from '../github/pr-creator'

/**
 * 重复 PR 处理：在新 PR 上添加评论指向被取代的旧 PR + 添加 `duplicate` label。
 *
 * @param logger 调用方 logger（warning 输出；不抛错）
 */
export async function handleDuplicatePRs(params: {
    client: Octokit
    owner: string
    repo: string
    newPRNumber: number
    supersededPRs: DependfixOpenPR[]
    logger: Pick<Logger, 'info' | 'warn'>
}): Promise<void> {
    const { client, owner, repo, newPRNumber, supersededPRs, logger } = params
    if (supersededPRs.length === 0) {
        return
    }

    const supersededLinks = supersededPRs
        .map((pr) => `- [#${pr.number}](${pr.htmlUrl})`)
        .join('\n')

    const commentBody = [
        '## ⚠️ Duplicate PR Notice',
        '',
        'This PR supersedes the following dependfix PR(s) with different content:',
        '',
        supersededLinks,
        '',
        'The superseded PR(s) have been closed. Please review this PR as the new canonical fix.',
    ].join('\n')

    try {
        await commentOnPullRequest(client, owner, repo, newPRNumber, commentBody)
        logger.info(`Added duplicate notice comment to PR #${newPRNumber}`)
    } catch (error: unknown) {
        const message = toErrorMessage(error)
        logger.warn(
            `Failed to add duplicate notice comment to PR #${newPRNumber}: ${message}`
            + '（token may lack `issues: write` scope）',
        )
    }

    try {
        await addLabelToPullRequest(client, owner, repo, newPRNumber, ['duplicate'])
        logger.info(`Added 'duplicate' label to PR #${newPRNumber}`)
    } catch (error: unknown) {
        const message = toErrorMessage(error)
        logger.warn(
            `Failed to add 'duplicate' label to PR #${newPRNumber}: ${message}`
            + '（token may lack `issues: write` scope）',
        )
    }
}
