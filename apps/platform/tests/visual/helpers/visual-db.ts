import type { APIRequestContext, APIResponse } from '@playwright/test'
import {
    assertRepositorySet,
    cleanRepositoryExtras,
    type RepositoryKey,
    type VisualRepositoryClient,
} from '../../../server/utils/visual-repository-set'
import { VISUAL_FIXTURES } from './fixtures'

/**
 * 视觉回归库的仓库集合适配器（Playwright 侧）。
 *
 * 纯集合逻辑在 `server/utils/visual-repository-set.ts`（vitest 覆盖），本文件只负责：
 * - 通过 `GET /api/repos` 读取当前视觉库仓库（admin storageState，视觉库独立于 e2e / 主库）；
 * - 通过 `DELETE /api/e2e/fixtures` 按 owner/name 删除多余仓库（服务端显式级联
 *   PRCheck → ScanResult → ScanRun → Repository，幂等）；
 * - 把 HTTP 失败转换为带状态码 / 响应体的错误，避免静默跳过校验。
 */

/** fixtures 允许集合（视觉库的单一白名单；不得在库内手工新增仓库）。 */
export const VISUAL_REPOSITORY_ALLOWLIST: readonly RepositoryKey[] = VISUAL_FIXTURES.repos.map(
    ({ owner, name }) => ({ owner, name }),
)

const readErrorBody = (response: APIResponse): Promise<string> => response.text().catch(() => '')

export const createVisualRepositoryClient = (request: APIRequestContext): VisualRepositoryClient => ({
    async list() {
        const response = await request.get('/api/repos', { maxRetries: 2 })
        if (!response.ok()) {
            const body = await readErrorBody(response)
            throw new Error(
                `[visual fixtures] GET /api/repos failed: ${response.status()} ${response.statusText()}${body ? ` body=${body}` : ''}`,
            )
        }
        let payload: unknown
        try {
            payload = await response.json()
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error)
            throw new Error(`[visual fixtures] GET /api/repos returned invalid JSON: ${reason}`)
        }
        if (!Array.isArray(payload)) {
            throw new Error('[visual fixtures] GET /api/repos returned a non-array payload')
        }
        // fail-fast：GET /api/repos 视图契约漂移（字段改名 / 部分行缺字段）时不能静默丢弃，
        // 否则「多余仓库」可能从视图中消失，集合门禁会假绿。
        return payload.map((item, index) => {
            if (!item || typeof item !== 'object') {
                throw new Error(`[visual fixtures] GET /api/repos item[${index}] is not an object`)
            }
            const { owner, name } = item as { owner?: unknown, name?: unknown }
            if (typeof owner !== 'string' || typeof name !== 'string' || owner.length === 0 || name.length === 0) {
                throw new Error(`[visual fixtures] GET /api/repos item[${index}] is missing owner/name`)
            }
            return { owner, name }
        })
    },
    async remove(repos) {
        const response = await request.delete('/api/e2e/fixtures', {
            data: { repos },
            maxRetries: 2,
        })
        if (!response.ok()) {
            const body = await readErrorBody(response)
            throw new Error(
                `[visual fixtures] DELETE /api/e2e/fixtures failed: ${response.status()} ${response.statusText()}${body ? ` body=${body}` : ''}`,
            )
        }
    },
})

/** 删除视觉库内非 fixtures 仓库（幂等）；返回被清理的仓库清单。 */
export async function cleanVisualRepositoryExtras(
    request: APIRequestContext,
    expected: readonly RepositoryKey[] = VISUAL_REPOSITORY_ALLOWLIST,
): Promise<RepositoryKey[]> {
    return cleanRepositoryExtras(createVisualRepositoryClient(request), expected)
}

/** 断言视觉库仓库集合与 fixtures 完全一致；不一致时在截图前失败。 */
export async function assertVisualRepositorySet(
    request: APIRequestContext,
    expected: readonly RepositoryKey[] = VISUAL_REPOSITORY_ALLOWLIST,
): Promise<void> {
    await assertRepositorySet(createVisualRepositoryClient(request), expected)
}
