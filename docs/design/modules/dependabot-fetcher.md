# T103 设计稿：Dependabot 告警采集

> 对应任务: [T103 接入 Dependabot Alerts 拉取](../../plan/todo-archive.md)
>
> **依赖**: T102（GitHub 客户端）已完成，T004（告警模型）已完成
>
> **选型结论**: 通过 T102 封装的 `Octokit` 实例调用 `octokit.paginate()` 分页拉取 `GET /repos/{owner}/{repo}/dependabot/alerts`，将原始 Dependabot API 响应映射为 `NormalizedSecurityAlert`。M1 采用全量拉取策略（每次运行拉取所有 `state=open` 的告警），不做增量标记。

---

## 1. 设计目标

- 为单仓库拉取所有 `state=open` 的 Dependabot 告警，输出标准化告警列表
- 完成 Dependabot API 字段到 `NormalizedSecurityAlert` 的语义映射
- 自动处理分页：`per_page=100`，通过 `octokit.paginate()` 自动合并多页
- 异常场景统一通过 T102 的 `mapGitHubError()` 转为 `AppError`
- 纯函数设计，无副作用（不写文件、不修改全局状态）

---

## 2. 调用 API

### 2.1 端点

| 项目 | 值 |
|------|-----|
| Octokit 方法 | `octokit.rest.dependabot.listAlertsForRepo` |
| HTTP | `GET /repos/{owner}/{repo}/dependabot/alerts` |
| 分页 | `octokit.paginate()` 自动翻页 |
| 每页条数 | `per_page: 100` |
| 状态过滤 | `state: 'open'` |

### 2.2 参数

```typescript
const rawAlerts = await octokit.paginate(
    octokit.rest.dependabot.listAlertsForRepo,
    {
        owner: 'foo',
        repo: 'bar',
        state: 'open',
        per_page: 100,
    },
)
```

### 2.3 Dependabot Alert 原始响应类型

> 完整类型定义见 `@octokit/openapi-types` 中的 `components["schemas"]["dependabot-alert"]`

关键字段（下方为映射所需字段，完整类型省略无关字段）：

```typescript
type DependabotAlert = {
    number: number                              // 告警编号（alert-number）
    state: 'auto_dismissed' | 'dismissed' | 'fixed' | 'open'
    dependency: {
        package?: {
            ecosystem: string                   // 如 'npm', 'pip', 'maven'
            name: string                        // 如 'lodash', 'express'
        }
        manifest_path?: string                  // 如 'package.json', 'requirements.txt'
        scope?: 'development' | 'runtime' | null
        relationship?: 'unknown' | 'direct' | 'transitive' | null
    }
    security_advisory: {
        ghsa_id: string                         // 如 'GHSA-xxxx-xxxx-xxxx'
        cve_id: string | null                   // 如 'CVE-2024-1234'
        summary: string
        description: string
        severity: 'low' | 'medium' | 'high' | 'critical'
        vulnerabilities: Array<{
            package: { ecosystem: string; name: string }
            severity: 'low' | 'medium' | 'high' | 'critical'
            vulnerable_version_range: string    // 如 '>= 1.0.0, < 1.2.3'
            first_patched_version: { identifier: string } | null
        }>
        // ... 省略 cvss, cwes, identifiers, references, published_at 等
    }
    security_vulnerability: {
        package: { ecosystem: string; name: string }
        severity: 'low' | 'medium' | 'high' | 'critical'
        vulnerable_version_range: string
        first_patched_version: { identifier: string } | null
    }
    html_url: string
    // ... 省略 created_at, updated_at, dismissed_*, fixed_at 等
}
```

#### 字段说明

| 字段 | 说明 | 必填 |
|------|------|:---:|
| `number` | GitHub 告警 ID（数字，非全局唯一） | 是 |
| `state` | 告警状态（open / fixed / dismissed / auto_dismissed） | 是 |
| `dependency.package.ecosystem` | 包系统生态（npm / pip / maven 等） | 否 |
| `dependency.package.name` | 包名 | 否 |
| `dependency.manifest_path` | 依赖清单文件路径 | 否 |
| `security_advisory.ghsa_id` | GitHub Security Advisory ID | 是 |
| `security_advisory.summary` | 咨询摘要 | 是 |
| `security_advisory.severity` | 严重级别（low / medium / high / critical） | 是 |
| `security_vulnerability.first_patched_version` | 首个修复版本（含 `identifier` 字段），无修复则为 `null` | 是 |
| `security_vulnerability.vulnerable_version_range` | 受影响版本范围 | 是 |

---

## 3. 核心接口设计

### 3.1 函数签名

```typescript
// packages/cli/src/github/dependabot-fetcher.ts

import type { Octokit } from '@octokit/rest'
import type { NormalizedSecurityAlert } from '@dependfix/core'

export interface FetchDependabotAlertsParams {
    /** 仓库所属组织或用户 */
    owner: string
    /** 仓库名称 */
    repo: string
    /** 告警状态过滤，M1 只拉 `open` */
    state?: 'open' | 'fixed' | 'dismissed' | 'auto_dismissed'
    /** 每页数量，默认 100（最大值） */
    perPage?: number
}

/**
 * 拉取指定仓库的 Dependabot 告警并映射为标准化模型。
 *
 * - 自动分页，返回所有匹配的告警
 * - 仅处理 `state=open` 的告警（可通过参数覆盖）
 * - 异常通过 `mapGitHubError` 转为 `AppError`
 *
 * @param client  - 已认证的 Octokit 实例（来自 T102 `createGitHubClient`）
 * @param params  - 仓库标识与过滤参数
 * @returns 标准化告警列表（空仓库返回 `[]`，不抛异常）
 */
export async function fetchDependabotAlerts(
    client: Octokit,
    params: FetchDependabotAlertsParams,
): Promise<NormalizedSecurityAlert[]>
```

### 3.2 与 T102 的接口约定

```
T102 (client.ts)                T103 (dependabot-fetcher.ts)
┌──────────────────┐           ┌──────────────────────────┐
│ createGitHubClient│───► Octokit ───► fetchDependabotAlerts │
│   (factory)      │   (实例)  │   (纯函数)                 │
└──────────────────┘           │                          │
                               │  调用 octokit.paginate() │
T102 (errors.ts)               │  调用 mapGitHubError()   │
┌──────────────────┐           │  调用 normalizeAlert()  │
│ mapGitHubError   │◄──────────┤                          │
│   (错误映射)     │  复用     └──────────────────────────┘
└──────────────────┘
```

- T103 不创建 Octokit 实例 —— 由调用方注入
- T103 不重新实现错误映射 —— 复用 `mapGitHubError`
- Octokit 类型完全来自 `@octokit/rest`，dependabot-fetcher.ts 不手写 Dependabot API 类型

### 3.3 设计决策

| 决策 | 理由 |
|------|------|
| 不手写 `DependabotAlert` 接口 | 类型完全来自 `@octokit/openapi-types`（通过 `@octokit/rest` 推导），避免同步滞后 |
| 不判断仓库是否存在 | 由 T102 `createGitHubClient` 调用方负责；`dependabot-fetcher` 只管拉取告警 |
| 空告警不抛异常 | 返回 `[]`，由上层过滤/报告层判断是否为"无告警" |
| 不做增量标记 | M1 单仓库每次全量拉取 `open` 告警，GitHub 侧 `state` 即为真实状态 |

---

## 4. 字段映射

### 4.1 映射表

| NormalizedSecurityAlert | 来源字段 | 映射逻辑 | 默认值/兜底 |
|--------------------------|---------|---------|-------------|
| `id` | `alert.number` | 直接取值 | — |
| `source` | — | 固定 `'dependabot'` | — |
| `repository` | 调用参数 | `\`${owner}/${repo}\`` | — |
| `defaultBranch` | — | M1 不在此层获取，传空字符串，由上层调用 `octokit.rest.repos.get` 后填入 | `''` |
| `severity` | `alert.security_advisory.severity` | 直接取值（`'critical' \| 'high' \| 'medium' \| 'low'`） | — |
| `packageEcosystem` | `alert.dependency.package?.ecosystem` | 直接取值 | `'unknown'` |
| `packageName` | `alert.dependency.package?.name` | 直接取值 | `'unknown'` |
| `manifestPath` | `alert.dependency.manifest_path` | 直接取值 | `''` |
| `ruleId` | `alert.security_advisory.ghsa_id` | 直接取值 | — |
| `summary` | `alert.security_advisory.summary` | 直接取值 | — |
| `htmlUrl` | `alert.html_url` | 直接取值 | — |
| `fixable` | `alert.security_vulnerability.first_patched_version` | `!== null` → `true`，否则 `false` | `false` |
| `fixStrategy` | `alert.security_vulnerability.first_patched_version` | 非 null → `'upgrade'`，否则 `null` | `null` |
| `recommendedVersion` | `alert.security_vulnerability.first_patched_version?.identifier` | 直接取值 | `''` |

### 4.2 映射代码示意

```typescript
function normalizeAlert(
    alert: DependabotAlert,
    owner: string,
    repo: string,
): NormalizedSecurityAlert {
    const firstPatched = alert.security_vulnerability.first_patched_version
    const fixable = firstPatched !== null

    return {
        id: alert.number,
        source: 'dependabot',
        repository: `${owner}/${repo}`,
        defaultBranch: '',                                      // M1 上层填入
        severity: alert.security_advisory.severity,
        packageEcosystem: alert.dependency.package?.ecosystem ?? 'unknown',
        packageName: alert.dependency.package?.name ?? 'unknown',
        manifestPath: alert.dependency.manifest_path ?? '',
        ruleId: alert.security_advisory.ghsa_id,
        summary: alert.security_advisory.summary,
        htmlUrl: alert.html_url,
        fixable,
        fixStrategy: fixable ? 'upgrade' : null,
        recommendedVersion: firstPatched?.identifier ?? '',
    }
}
```

### 4.3 Severity 映射

Dependabot severity 值 `'critical' | 'high' | 'medium' | 'low'` 与 `AlertSeverity` 类型完全对齐，直接透传，无需转换。

（Code Scanning 的 `error/warning/note/none` 四值映射在 `packages/core/src/alerts/index.ts` 的 `mapCodeScanningSeverity` 中处理，T301 时调用。）

### 4.4 `fixable` 与 `fixStrategy` 判定逻辑

```
first_patched_version !== null
    ├── true  → fixable: true,  fixStrategy: 'upgrade', recommendedVersion: identifier
    └── false → fixable: false, fixStrategy: null,       recommendedVersion: ''
```

**边界情况**：

| 场景 | 表现 | 处理 |
|------|------|------|
| `first_patched_version` 为 `null` | 无可升级版本 | `fixable: false`，交由报告层标注"需人工研判" |
| `first_patched_version.identifier` 为 major 版本跨越大 | `recommendedVersion: '3.0.0'`（例） | 不在此层判断 major 升级风险，由 T105 修复器负责安全校验 |
| `security_advisory.vulnerabilities` 包含多个版本范围 | `security_vulnerability` 为当前依赖的具体匹配项，优先使用它而非数组第一个元素 | 使用 `security_vulnerability`，不遍历 `vulnerabilities[]` |
| `dependency.package` 为 `undefined` | `packageName` / `packageEcosystem` 兜底为 `'unknown'` | 不抛异常，允许后续过滤/报告层处理 |

---

## 分片索引（迁出章节）

| 分片 | 章节范围 | 主题 |
|:--|:--|:--|
| [dependabot-fetcher-runtime.md](./dependabot-fetcher-runtime.md) | §5 - §10 | 数据流 / 拉取策略 / 异常处理 / 测试策略 / 实现文件清单 / 非目标 |
