# Dependabot 采集器 设计分片：运行时行为与落地明细（dependabot-fetcher.md §5-§10）

> 本分片自 [dependabot-fetcher.md](./dependabot-fetcher.md) 按连续尾部章节迁出（章节编号全局唯一、跨文件稳定）；文中 `§N` 除显式标注文件路径者外，均指本分片或主文档的同名章节。

## 5. 数据流

```
createGitHubClient({ token })
        │
        ▼
  Octokit 实例
        │
        ▼
fetchDependabotAlerts(client, { owner, repo })
        │
        ├─► octokit.paginate(listAlertsForRepo, { owner, repo, state: 'open', per_page: 100 })
        │       │
        │       ├─► 成功 → DependabotAlert[]
        │       │       │
        │       │       └─► map(normalizeAlert) → NormalizedSecurityAlert[]
        │       │
        │       └─► 失败 → mapGitHubError(error, context)
        │                        │
        │                        └─► throw AppError(code, message, details)
        │
        └─► 返回 NormalizedSecurityAlert[]
```

### 5.1 调用链（M1 完整上下文）

```typescript
// 伪代码：未来 T109 CLI 入口
const octokit = createGitHubClient({ token })
const { data: repo } = await octokit.rest.repos.get({ owner, repo })
const defaultBranch = repo.default_branch

const alerts = await fetchDependabotAlerts(octokit, { owner, repo })

// 填补 defaultBranch
const enriched = alerts.map(a => ({ ...a, defaultBranch }))
```

### 5.2 `defaultBranch` 获取策略

| 阶段 | 方案 | 理由 |
|------|------|------|
| M1 | 调用方（T109 CLI 入口）调用 `octokit.rest.repos.get` 获取，再注入到告警列表 | `dependabot-fetcher` 保持单一职责（只拉告警），不额外请求仓库 API |
| M2+ | 若后续需要在大批量场景减少 API 调用，可在此函数内部用 `repos.get` 获取并在内部注入 | 性能优化，不影响接口契约 |

---

## 6. 拉取策略（M1：全量拉取）

### 6.1 策略说明

- 每次调用拉取 **所有** `state=open` 的告警
- 不做增量标记（不记录"上次已处理到第几条"）
- 不存储处理状态（每个 run 独立、无状态）

### 6.2 为什么 M1 不需要增量

| 理由 | 说明 |
|------|------|
| 调用频率低 | M1 为手动触发（`dependfix report/fix --repo`），不是定时任务 |
| 告警数量小 | 单仓库 Dependabot open 告警通常 < 100 条 |
| 状态由 GitHub 维护 | 修复后的告警 GitHub 侧自动变为 `fixed`，下次 run 不会拉取 |
| 避免状态管理复杂度 | 无状态设计简化实现和测试 |

### 6.3 增量扩展点（M3+）

M3 若需要定时运行并区分"新增告警"和"已有告警"：

- 利用 `sort: 'created'` + `direction: 'asc'` 按创建时间排序
- 利用 `created` 参数过滤 `created>=上次运行时间`（GitHub API 支持 `since` 语义但 Dependabot alerts 端点目前不直接支持 `since` 参数，可用 `sort` + `direction` + 客户端截断替代）
- 实现时机：M4 多仓库或 M6 平台定时扫描

---

## 7. 异常处理

### 7.1 错误来源与映射

所有异常统一通过 T102 `mapGitHubError(error, context)` 转为 `AppError`。`context` 参数包含仓库标识。

| 场景 | HTTP 状态码 | `AppError.code` | 触发条件 |
|------|:---:|------|------|
| Token 无效或过期 | 401 | `AUTHENTICATION_FAILED` | `RequestError` + status 401 |
| alerts 未启用 | 403 | `ALERTS_DISABLED` | `RequestError` + status 403 + message 含 `Dependabot alerts are disabled for this repository`（非限流、非权限） |
| 限流 | 403 | `RATE_LIMITED` | `RequestError` + status 403 + `X-RateLimit-Remaining: 0` |
| Token 无 `dependabot_alerts:read` 权限 | 403 | `PERMISSION_DENIED` | `RequestError` + status 403（非限流、非 disabled message） |
| 仓库不存在 | 404 | `REPO_NOT_FOUND` | `RequestError` + status 404 |
| GitHub API 内部错误 | 4xx/5xx | `GITHUB_API_ERROR` | `RequestError` + 其他状态码 |
| 网络不可达 | — | `NETWORK_ERROR` | 非 `RequestError`（DNS 失败、超时等） |

### 7.2 调用方错误处理示例

```typescript
try {
    const alerts = await fetchDependabotAlerts(octokit, { owner: 'foo', repo: 'bar' })
    // 处理告警...
} catch (error) {
    if (error instanceof AppError) {
        // 根据 error.code 决定：跳过仓库、终止运行、记录日志
        logger.error({ code: error.code, repository: 'foo/bar' }, error.message)
    }
    // 继续处理下一个仓库或向上抛
}
```

### 7.3 `context` 格式约定

```
`fetch dependabot alerts for ${owner}/${repo}`
```

示例：`'fetch dependabot alerts for facebook/react'`

---

## 8. 测试策略

### 8.1 单元测试（`packages/cli/src/github/dependabot-fetcher.test.ts`）

使用 `nock` 拦截 HTTP 层，复用 T102 已引入的 `nock` 依赖（不新增 devDep）。

#### 测试场景

| # | 场景 | nock 配置 | 验证 |
|---|------|----------|------|
| 1 | 正常拉取 2 条告警 | `.reply(200, fixture: 2 alerts)` | 返回 `NormalizedSecurityAlert[]`，长度 2 |
| 2 | 字段映射正确性 | `.reply(200, fixture: 1 alert)` | 逐一验证 `id`/`severity`/`packageName`/`fixable`/`fixStrategy`/`recommendedVersion` 等 12 个字段 |
| 3 | `first_patched_version` 不为 null → fixable=true | `.reply(200, fixture: fixable alert)` | `fixable: true`, `fixStrategy: 'upgrade'` |
| 4 | `first_patched_version` 为 null → fixable=false | `.reply(200, fixture: non-fixable alert)` | `fixable: false`, `fixStrategy: null` |
| 5 | 空仓库无告警 | `.reply(200, [])` | 返回 `[]`，不抛异常 |
| 6 | 分页多页 | `.reply(200, page1, { Link: next })` + `.reply(200, page2)` | 返回合并后的完整列表 |
| 7 | 401 认证失败 | `.reply(401)` | 抛 `AppError('AUTHENTICATION_FAILED')` |
| 8 | 403 限流 | `.reply(403, {}, { 'x-ratelimit-remaining': '0' })` | 抛 `AppError('RATE_LIMITED')` |
| 9 | 403 权限不足 | `.reply(403)` | 抛 `AppError('PERMISSION_DENIED')` |
| 9b | 403 alerts 未启用 | `.reply(403, { message: 'Dependabot alerts are disabled for this repository.' })` | 抛 `AppError('ALERTS_DISABLED')` |
| 10 | 404 仓库不存在 | `.reply(404)` | 抛 `AppError('REPO_NOT_FOUND')` |
| 11 | `dependency.package` 缺失 | `.reply(200, fixture: missing package)` | `packageName: 'unknown'`, `packageEcosystem: 'unknown'` |
| 12 | `manifest_path` 缺失 | `.reply(200, fixture: missing manifest)` | `manifestPath: ''` |

### 8.2 静态 Fixture（`packages/cli/src/github/__fixtures__/dependabot-alerts.json`）

提供至少 5 条真实 Dependabot API 响应样例（与 T901 共享同一 fixture 文件）：

| # | 覆盖场景 |
|---|---------|
| 1 | critical + fixable（`lodash` 从 `4.17.20` 升到 `4.17.21`） |
| 2 | high + fixable（`express` 从 `4.18.1` 升到 `4.18.2`） |
| 3 | medium + non-fixable（`minimist`，无 patched version） |
| 4 | high + fixable（`axios`，major 升级 `0.x` → `1.x`） |
| 5 | critical + fixable（`@babel/traverse`，scoped package） |

Fixture 路径（相对 `packages/cli/`）：
```
src/github/__fixtures__/dependabot-alerts.json
```

> 注：此 fixture 同时服务于 T103（fetcher 测试）和 T901（样例数据任务），避免重复创建。

### 8.3 集成测试

- 可选：在 fetcher 测试中复用 T102 `client.test.ts` 的 nock 模式，模拟"客户端 → fetcher → normalize"完整链路
- M1 不额外写集成测试文件，现有 fetcher 单元测试 + fixture 已覆盖核心路径

### 8.4 测试依赖

```json
// packages/cli/package.json — 已有，无需新增
{
    "devDependencies": {
        "nock": "^14.0.16"  // T102 已引入
    }
}
```

---

## 9. 实现文件清单

| 文件 | 说明 |
|------|------|
| `packages/cli/src/github/dependabot-fetcher.ts` | `fetchDependabotAlerts()` + `normalizeAlert()` 私有函数 |
| `packages/cli/src/github/dependabot-fetcher.test.ts` | 12 个单元测试（nock HTTP 拦截） |
| `packages/cli/src/github/__fixtures__/dependabot-alerts.json` | 5 条 Dependabot API 响应样例 |
| `packages/cli/src/github/index.ts` | 新增 `dependabot-fetcher` 的 re-export |

> 不新增 npm 依赖。所有依赖（`@octokit/rest`, `@dependfix/core`, `nock`）已在 T102 中引入。

---

## 10. 非目标（M1 不做）

- 不拉取 Code Scanning alerts（职责边界：Code Scanning 由 `code-scanning-fetcher.ts` 并行承接，M3 T301）
- 不拉取已 `dismissed` / `fixed` / `auto_dismissed` 的告警
- 不实现增量拉取（全量拉取，不做 `since` / `cursor` 类标记）
- 不在此层获取 `defaultBranch`（由上层调用 `octokit.rest.repos.get` 后填入）
- 不在 `NormalizedSecurityAlert` 中持久化 Dependabot 原始响应
- 不引入 `@octokit/plugin-throttling`（M2 在 T102 处统一引入）
- 不实现多仓库并发拉取（M4 T401）
- 不判断 `relationship: 'transitive'` 并区别处理（属于修复策略域，T105 负责）
