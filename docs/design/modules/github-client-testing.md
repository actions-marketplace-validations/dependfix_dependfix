# GitHub client 封装 设计分片：测试策略与落地清单（github-client.md §8-§10）

> 本分片自 [github-client.md](./github-client.md) 按连续尾部章节迁出（章节编号全局唯一、跨文件稳定）；文中 `§N` 除显式标注文件路径者外，均指本分片或主文档的同名章节。

## 8. Mock 与测试策略

### 8.1 方案：`nock` 拦截 HTTP

```typescript
// packages/cli/src/github/client.test.ts

import nock from 'nock'
import { createGitHubClient } from './client'

const API_BASE = 'https://api.github.com'

describe('createGitHubClient', () => {
    afterEach(() => nock.cleanAll())

    it('returns repo info on success', async () => {
        nock(API_BASE)
            .get('/repos/foo/bar')
            .reply(200, { id: 1, full_name: 'foo/bar' })

        const octokit = createGitHubClient({ token: 'test-token' })
        const { data } = await octokit.rest.repos.get({ owner: 'foo', repo: 'bar' })
        expect(data.full_name).toBe('foo/bar')
    })

    it('throws AUTHENTICATION_FAILED on 401', async () => {
        nock(API_BASE)
            .get('/repos/foo/bar')
            .reply(401, { message: 'Bad credentials' })

        // ...
    })
})
```

### 8.2 测试场景

| 场景 | nock 配置 | 验证 |
|------|----------|------|
| 正常响应 | `.reply(200, fixture)` | 数据完整性 |
| 认证失败 | `.reply(401)` | 抛 `AUTHENTICATION_FAILED` |
| 限流 | `.reply(403, {}, { 'x-ratelimit-remaining': '0' })` | 抛 `RATE_LIMITED` |
| 权限不足 | `.reply(403)` | 抛 `PERMISSION_DENIED` |
| alerts 未启用（Dependabot） | `.reply(403, { message: 'Dependabot alerts are disabled for this repository.' })` | 抛 `ALERTS_DISABLED` |
| alerts 未启用（GHAS） | `.reply(403, { message: 'Advanced Security must be enabled for this repository to use code scanning.' })` | 抛 `ALERTS_DISABLED` |
| 未启用文案未命中 | `.reply(403, { message: 'Resource not accessible by integration' })` | 抛 `PERMISSION_DENIED`（不误判） |
| 仓库不存在 | `.reply(404)` | 抛 `REPO_NOT_FOUND` |
| 网络错误 | `nock.disableNetConnect()` + 断网 | 抛 `NETWORK_ERROR` |

### 8.3 依赖

```json
{
    "devDependencies": {
        "nock": "^14.0.0"
    }
}
```

### 8.4 静态 Fixture（保留用于 T103 集成测试）

```
packages/cli/src/github/__fixtures__/
├── dependabot-alerts.json    # 5 条样例（覆盖 critical/high/medium、fixable/non-fixable）
├── repo-info.json            # 单仓库基本信息
└── empty-alerts.json         # 无告警
```

Fixture 给 T103 `dependabot-fetcher.test.ts` 使用，验证 Dependabot 原始类型 → `NormalizedSecurityAlert` 映射。

---

## 9. 实现文件清单

| 文件 | 说明 |
|------|------|
| `packages/cli/src/github/client.ts` | `createGitHubClient()` 工厂函数 |
| `packages/cli/src/github/errors.ts` | `mapGitHubError()` 错误映射 |
| `packages/cli/src/github/client.test.ts` | 6 场景单元测试（nock 拦截） |
| `packages/core/src/errors/error-codes.ts` | `GITHUB_ERROR_CODES` 枚举 |
| `packages/cli/package.json` | 新增 `@octokit/rest`（dep）+ `nock`（devDep） |

---

## 10. 非目标（M1 不做）

- 不实现 GitHub App / Installation Token 认证
- 不实现 `@octokit/plugin-throttling`（M2 引入）
- 不调用 Code Scanning 端点 —— 已由 `code-scanning-fetcher.ts`（M3 T301）承接，见 [code-scanning-fetcher](../../../packages/engine/src/github/code-scanning-fetcher.ts)
- 不实现 `octokit.rest.repos.listForOrg()` 自动发现（M4）
- 不封装自定义类，直接暴露 `Octokit` 实例
