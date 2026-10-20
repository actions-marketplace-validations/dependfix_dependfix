/**
 * 视觉库 HTTP 适配器测试。
 *
 * 放在 `server/utils` 而非被测文件同目录，是因为 `vitest.config.ts` 的 exclude 排除了
 * `tests/visual` 目录（该目录由 Playwright 驱动，不由 vitest 收集）。若按「测试与源码同目录」
 * 移动到 `tests/visual/helpers/`，本文件会被静默跳过。
 */
import type { APIRequestContext } from '@playwright/test'
import { describe, expect, it, vi } from 'vitest'
import { createVisualRepositoryClient, VISUAL_REPOSITORY_ALLOWLIST } from '../../tests/visual/helpers/visual-db'

interface FakeResponse {
    ok?: boolean
    status?: number
    statusText?: string
    body?: unknown
    text?: string
    jsonError?: string
}

const createResponse = ({ ok = true, status = 200, statusText = 'OK', body, text = '', jsonError }: FakeResponse) => ({
    ok: () => ok,
    status: () => status,
    statusText: () => statusText,
    text: async () => text,
    json: async () => {
        if (jsonError) {
            throw new SyntaxError(jsonError)
        }
        return body
    },
})

const createRequest = (getResponse: ReturnType<typeof createResponse>, deleteResponse = createResponse({})) => {
    const get = vi.fn(async () => getResponse)
    const remove = vi.fn(async () => deleteResponse)
    return {
        request: { get, delete: remove } as unknown as APIRequestContext,
        get,
        remove,
    }
}

describe('createVisualRepositoryClient', () => {
    it('exposes the three visual fixtures as the allowlist', () => {
        expect(VISUAL_REPOSITORY_ALLOWLIST).toEqual([
            { owner: 'acme', name: 'web-app' },
            { owner: 'acme', name: 'api-gateway' },
            { owner: 'acme', name: 'unlabeled-tool' },
        ])
    })

    it('maps GET /api/repos rows to owner/name pairs', async () => {
        const fake = createRequest(createResponse({
            body: [
                { id: '1', owner: 'acme', name: 'web-app', platform: 'github' },
                { id: '2', owner: 'acme', name: 'api-gateway' },
            ],
        }))

        await expect(createVisualRepositoryClient(fake.request).list()).resolves.toEqual([
            { owner: 'acme', name: 'web-app' },
            { owner: 'acme', name: 'api-gateway' },
        ])
        expect(fake.get).toHaveBeenCalledWith('/api/repos', { maxRetries: 2 })
    })

    it('rejects a non-2xx GET response with status and body', async () => {
        const fake = createRequest(createResponse({ ok: false, status: 500, statusText: 'Internal Server Error', text: 'boom' }))
        await expect(createVisualRepositoryClient(fake.request).list()).rejects.toThrow(
            'GET /api/repos failed: 500 Internal Server Error body=boom',
        )
    })

    it('rejects a non-array GET payload', async () => {
        const fake = createRequest(createResponse({ body: { data: [] } }))
        await expect(createVisualRepositoryClient(fake.request).list()).rejects.toThrow('returned a non-array payload')
    })

    it('wraps invalid JSON with the adapter error prefix', async () => {
        const fake = createRequest(createResponse({ jsonError: 'Unexpected token <' }))
        await expect(createVisualRepositoryClient(fake.request).list()).rejects.toThrow(
            'GET /api/repos returned invalid JSON: Unexpected token <',
        )
    })

    it('rejects an item without owner/name instead of silently dropping it', async () => {
        const fake = createRequest(createResponse({ body: [{ owner: 'acme' }] }))
        await expect(createVisualRepositoryClient(fake.request).list()).rejects.toThrow('item[0] is missing owner/name')
    })

    it('sends extras to DELETE /api/e2e/fixtures', async () => {
        const fake = createRequest(createResponse({ body: [] }))
        await createVisualRepositoryClient(fake.request).remove([{ owner: 'parp3', name: 'probe' }])
        expect(fake.remove).toHaveBeenCalledWith('/api/e2e/fixtures', {
            data: { repos: [{ owner: 'parp3', name: 'probe' }] },
            maxRetries: 2,
        })
    })

    it('rejects a non-2xx DELETE response with status and body', async () => {
        const fake = createRequest(
            createResponse({ body: [] }),
            createResponse({ ok: false, status: 404, statusText: 'Not Found', text: 'disabled' }),
        )
        await expect(createVisualRepositoryClient(fake.request).remove([{ owner: 'parp3', name: 'probe' }])).rejects.toThrow(
            'DELETE /api/e2e/fixtures failed: 404 Not Found body=disabled',
        )
    })
})
