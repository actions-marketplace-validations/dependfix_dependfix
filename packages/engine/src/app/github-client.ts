// github-client.ts — 按运行配置构造已认证 Octokit（PAT + 限流退避）。
//
// 从 app/index.ts 抽出：构造细节与编排无关，且 app/index.ts 已处于 max-lines 上限边缘。
import type { Octokit } from '@octokit/rest'
import { fromPat } from '../auth'
import { createGitHubClient } from '../github'
import type { RuntimeConfig } from '../config'

/** 构造主 token client（429 / 限流按配置指数退避）。 */
export function createConfiguredGitHubClient(config: RuntimeConfig): Octokit {
    return createGitHubClient({
        auth: fromPat(config.githubToken, {
            // 429 / rate limit 指数退避重试（0 可关闭；退避上限可配）
            retry: {
                maxRetries: config.maxRetries,
                maxBackoffMs: config.maxBackoffMs,
            },
        }),
    })
}

/** pnpm-audit 模式不创建 GitHub client（无 token）；github-dependabot 模式返回主 token client。 */
export function createConfiguredGitHubClientOrNull(config: RuntimeConfig): Octokit | null {
    return config.alertSource === 'pnpm-audit' ? null : createConfiguredGitHubClient(config)
}
