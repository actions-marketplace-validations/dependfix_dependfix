# PR 构建与部署信号采集设计（设计先行稿）

> **状态**：✅ 已上收 **M43.2**（2026-10-12 用户决策方案 A）——契约与数据模型作为实现依据；**§5 决策点已于 2026-10-12 裁定**（D1 = Option A 扩展 `PRCheck` / D2 = 不做日志富化 / D3 = 全量只报警不阻断 / D4 = 本批不涉及）；按 §7 拆分子任务推进：**M43.2a 采集层已闭环（2026-10-12，实现期细化见 [§3.7](#37-实现期细化m432a2026-10-12)）**，M43.2b / M43.2c 待推进。
> **范围**：`apps/platform`（PR Check 采集 / 聚合 / 展示）+ 可选 provider 日志富化；不改引擎修复与验证逻辑。
> **目标**：把「修复 PR 的构建 / 部署错误」从单一 `Test` check 扩展为多源聚合，第一时间发现 CI 与预览部署失败。
> **关联**：[定时扫描与批量处理设计](./platform-scheduled-batch.md)、[运行失败分类与筛选设计](./run-failure-taxonomy.md)、[平台规范](../../standards/platform.md)、`apps/platform/server/services/monitor/`

## 1. 背景与问题

### 1.1 构建 / 部署错误的三层信息面

| 层 | 发生在哪 | 当前 dependfix 覆盖 |
|:---|:---|:---|
| **本地构建** | engine 沙箱内 `verification-runner` 跑 install / lint / build / test | ✅ 已落 `ScanRun.logsJson` + `RunResult.errors[]`（见 [运行失败分类与筛选设计](./run-failure-taxonomy.md)） |
| **CI 构建** | 目标仓库 GitHub Actions | ⚠️ 仅 PR Check 抓**单个** `Test` check |
| **预览 / 生产部署** | Cloudflare Workers Builds / Vercel / 其它 | ❌ **完全未覆盖** |

「修复 PR 的代码检查过了，但预览部署 / 其它 workflow 挂了」当前不可见 —— 这正是本设计要补的盲区。

### 1.2 现有 PR Check 能力与缺口

现有链路：`schedule.kind='pr-check'` → `triggerPrCheckSchedule` → `PollingSource`（`checks.listForRef`，**只取 `name==='Test' | 'test'`**）→ `ActionStatusMonitor.pollOnce` → `PRCheck` 实体（`(repositoryId, prNumber, headSha)` 唯一，单 `conclusion`）→ `alertFiring` 状态机 + ack UI。

| 缺口 | 说明 |
|:---|:---|
| G1 单 check | 只认 `Test` / `test` 一个名字 → 漏其它 workflow、漏 Vercel / Cloudflare |
| G2 缺两源 | 未采集 Commit Statuses 与 Deployments |
| G3 无 provider 归因 | 失败不知道来自哪家（Actions？Vercel？Cloudflare？） |
| G4 限 PAT | `github-app` 凭据在 pr-check 路径被 skip（既有边界，非本批必须） |

### 1.3 关键洞察：GitHub 是天然聚合枢纽（已多源核对）

各家 provider 只要装了对应 GitHub App / 集成，其构建与部署状态**最终都会落到 GitHub 的三个原生 API**：

| 信息源 | GitHub 落点 | REST API（Octokit） | 读取权限 |
|:---|:---|:---|:---|
| GitHub Actions | check runs（`app.slug='github-actions'`） | `checks.listForRef` | `repo` scope |
| **Cloudflare Workers Builds** | **check runs** + PR 评论 | `checks.listForRef` | `repo` scope |
| **Vercel** | **commit status**（每 project 一个 context，可 consolidated）+ **Deployments API**（`deployment_status` 事件） | `repos.getCombinedStatusForRef` + `repos.listDeployments` | `repo` scope |
| GitLab CI / 其它 CI / 自建 CI | commit status | `repos.getCombinedStatusForRef` | `repo` scope |

**官方文档原文证据**：

- Cloudflare：*"GitHub and Cursor Origin use pull request comments and **check runs**, while GitLab uses commit statuses"*（[Workers Builds Git integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/)）。
- Vercel：*"By default, git commits will receive a **GitHub Commit Status** for each project deployed"* + *"Vercel for GitHub **uses the deployment API**"*，集成权限表含 Checks / Deployments / Commit Statuses（[Vercel for GitHub](https://vercel.com/docs/git/vercel-for-github)）。
- GitHub：check run 结论枚举 `success | failure | neutral | cancelled | skipped | timed_out | action_required | stale`；deployment state `error | failure | pending | in_progress | queued | success | inactive`，deployment status 含 `log_url` / `environment_url`；combined status `state = success | pending | failure`（[Checks](https://docs.github.com/en/rest/checks/runs)、[Deployments](https://docs.github.com/en/rest/deployments/deployments)、[Commit statuses](https://docs.github.com/en/rest/commits/statuses)）。

**归因钥匙**：`check_run.app.slug` / `status.context` / `deployment.creator` 可直接区分 provider，无需 provider 凭据。

**结论**：不要为每个 provider 各写一套集成；**以 GitHub 三源为统一采集面**，provider 原生 API 仅作「日志富化」可选层。

## 2. 目标与非目标

**目标**

- 把 PR 的构建 / 部署信号从单 check 扩展为多源聚合，统一归一化 + 告警。
- provider 无关：新增 provider 无需新代码（走 GitHub 聚合）。
- 复用现有 `alertFiring` / ack 状态机与 `pr-checks` UI。
- 可选日志富化：为配置了 token 的 provider 拉取原始构建日志。

**非目标**

- 不改 engine 本地构建 / 验证逻辑（本地面已由 `ScanRun.logsJson` 承接）。
- 不新建 GitHub App（沿用现有凭据模型）。
- 不做 webhook（本批）；`PRCheckSyncSource` 抽象已预留，后续无痛接入。
- 不做部署失败的自动重跑 / 自动修复。
- 不追求「未装 GitHub 集成」的 provider 可见性（无集成即无信号，显式声明边界）。

## 3. 方案架构

### 3.1 分层

```text
         ┌─ Layer 4 展示：pr-checks.vue 多源详情（沿用 + 扩展）
         ├─ Layer 3 告警：PRCheck alertFiring / ack 状态机（沿用）
[轮询]   ├─ Layer 2 聚合：每 PR-head → PRBuildStatus（overall + failedSources）
         │         ▲ 归一化
         ├─ Layer 1 采集：GitHub 三源 SyncSource
         │        ├ checks.listForRef(sha)          → check runs
         │        ├ repos.getCombinedStatusForRef   → commit statuses
         │        └ repos.listDeployments({ sha }) + listDeploymentStatuses → deployments
[可选]   └─ Layer 5 日志富化：provider adapter（Vercel REST / Cloudflare Builds API）
```

- Layer 1 / 2 **零新增凭据**，覆盖点名三源 + 未来任意 provider。
- Layer 5 可选，只解决「GitHub 侧只有摘要（`output.text` / `log_url`），拿不到逐行原始日志」这一缺口。

### 3.2 归一化模型

```typescript
interface UnifiedBuildSignal {
    kind: 'check' | 'status' | 'deployment'   // 来自哪个 GitHub API
    provider: string        // check_run.app.slug | status.context 前缀 | deployment.creator.login
    name: string            // check 名 / status context / environment
    state: 'pending' | 'success' | 'failure' | 'error' | 'neutral' | 'skipped'
    targetUrl: string | null   // details_url / target_url / environment_url
    logUrl: string | null      // deployment status.log_url（如有）
    summary: string | null     // check_run.output.text（截断，避免单条过大）
    observedAt: Date
}
```

### 3.3 GitHub 三源采集

- 复用现有 `PollingSource` 的 `pulls.list` + 目标作者过滤（`TARGET_PR_AUTHOR_LOGINS`），仅替换「单 check 名过滤」为三源聚合。
- 每个目标 PR head SHA 调 3 组 API：check runs、combined status、deployments（+ 每个 deployment 的 statuses）。
- 映射到 `PRBuildStatus`：`overall = failed` 当存在任一 `failure | error | timed_out | action_required`；`pending` 当存在非终态；否则 `success`。

### 3.4 聚合与告警

- 聚合态（`PRBuildStatus`）作为 `PRCheck.conclusion` 的派生来源；现有 `FAILURE_CONCLUSIONS` 语义扩展到 deployment state / status state。
- 告警状态机不变：失败 → `alertFiring=true`；回归 success 自动清 ack；用户可手动 ack。

### 3.5 检测机制（先轮询，预留 webhook）

- 复用 `schedule.kind='pr-check'` 与 `PRCheckSyncSource` 抽象（`monitor/types.ts` **已注释预留 `WebhookSource`**）。
- **轮询节流**（避免 3+ API / PR / 轮打爆限额）：① 只取 `updated_at` 在窗口内的 open PR；② `headSha` 未变**且已终态** → 跳过；③ 沿用 `createGitHubClient` 的 429 / 限流退避。
- **webhook 预留**：`check_run` / `check_suite` / `status` / `deployment_status` 四事件 → 秒级发现；需公开端点 + `x-hub-signature-256` 校验 + 幂等。**登记后续，不在本批**。

### 3.6 凭据模型

- **状态采集**：仅需 `repo` scope PAT —— 现有 pr-check 路径已具备，**零新增凭据**。
- **日志富化（可选）**：需为 provider 配 token（Vercel token ↔ project / Cloudflare account token）。涉及 `credential` 类型扩展或仓库级 extra config，属 §5 决策点。

### 3.7 实现期细化（M43.2a，2026-10-12）

实现采集层时相对 §3.2 / §3.3 的**两处偏离与两处扩展**（均已在代码注释与本处登记）：

| 项 | 设计稿 | 实现 | 理由 |
| :--- | :--- | :--- | :--- |
| commit statuses 取数 | `repos.getCombinedStatusForRef` | **`repos.listCommitStatusesForRef`（分页）** | combined status 的 `statuses` 数组有上限；分页版才能满足「列出全部 commit statuses」的验收语义 |
| 归一化模型字段 | §3.2 的 9 字段（`kind` / `provider` / `name` / `state` / `targetUrl` / `logUrl` / `summary` / `observedAt`） | 增 **`rawState`**（原始 GitHub 取值）与 **`sourceId`**（check run id / status id / deployment id） | `rawState` 用于**保留既有 `conclusion` 粒度**（`timed_out` / `action_required` 不被粗化为 `failure`，保持 PRCheck 既有枚举与 UI 标签向后兼容）；`sourceId` 供落库（`checkRunId` 列）与前端链接使用 |
| 状态映射 | §3.3 聚合规则 | 明确定义三张映射表（check conclusion / commit status state / deployment status state → 归一化状态）：`timed_out`、`action_required` → `failure`；`cancelled`、`stale` → `skipped`；deployment `queued` / `in_progress` → `pending`、`inactive` → `skipped` | 使「聚合 failed 判据」与「非终态判据」有唯一落点 |
| 形态守卫 | 未涉及 | check runs / commit statuses / deployments 三源均**过滤掉无 `id` 的条目** | Octokit `paginate` 在响应缺少 `total_count`（非标准形态）时会把**整个 body 当作单个元素**返回——实测可产出无 id 的伪信号（会误报 `pending`），故按「宁缺勿伪」守卫 |

**节流落地分工**：`updated_at` 窗口过滤在采集层（`isWithinUpdatedWindow`，纯函数）；「`headSha` 未变且已终态 → 跳过」需读既有 `PRCheck` 行，判定函数 `isTerminalOverallStatus` 在采集层导出、接线落在 M43.2b 的监控器侧。

**信号上限**：单 PR 信号按严重度（失败 → pending → neutral → skipped → success）排序后截断到 `MAX_SIGNALS_PER_PR`，摘要按 `SIGNAL_SUMMARY_MAX_LENGTH` 截断（§6 风险 R2 的缓解落点）。

**轮询窗口取值**：`PR_UPDATED_WINDOW_MS = 7 天`（实现期新决策，设计稿 §3.5 仅描述「窗口内」未给取值）。取值理由：覆盖「PR 最近一次更新后 7 天内仍可能新增 check / 部署」的常见节奏，同时把陈旧 PR 的三源请求降为零；窗口外 PR 的既有 `PRCheck` 行保持原状态（`lastPolledAt` 不再推进）——**该语义由 M43.2b 显式承接**（需明确窗口外行的诊断口径与失败告警收敛路径）。

**`checkRunId` / `errorMessage` 派生语义变更**：两列原为「`Test` check 专属」，现改为**最坏信号派生**——`checkRunId` 取失败 check 的 run id（无失败 check 时取任一 check），`errorMessage` 取失败信号摘要（无失败时取首条带摘要者）。列名与既有 UI 消费方不变，但语义已从「单一 check」扩展为「聚合信号代表」。

**provider 归因归一化**：deployment 侧 `creator.login` 归一化**机器人形态**——去 `<安装号>+` 前缀与 `[bot]` 后缀（`vercel[bot]` / `12345+vercel[bot]` → `vercel`），使同一 provider 在 status（`context` 前缀）与 deployment 两侧归因一致，避免按 provider 归组（`failureSources` / 展示）时分裂成多项。

**空集真空真**：`aggregateOverallStatus([])` / `deriveWorstConclusion([])` 返回 `success` 属真空真——采集层对无信号 PR 不产出快照（`signals.length === 0 → continue`），落库侧消费前同样须判空。

**M43.2a 的运行时影响（非纯中间态）**：a 虽未落库 `signals`，但**已通过派生 `conclusion` 改变既有运行时行为**——`ActionStatusMonitor` 消费 `conclusion` 推断 `alertFiring` 与自动 ack，故「多源失败 → firing」在 a 阶段即生效。随之出现一处语义收紧需 b 承接：`deriveWorstConclusion` 在存在 `neutral` 信号时返回 `neutral`，而监控器仅在 `conclusion === 'success'` 时清 `acknowledgedAt` → 含 `neutral` 信号的 PR 不再自动清零 ack。**b 侧处置**：自动 ack 清空判定改为按 `overallStatus === 'success'`（聚合语义更准确）。



## 4. 数据模型（两个选项）

现有 `PRCheck` 是 `(repositoryId, prNumber, headSha)` 一行、单 `conclusion`。扩展有两种路径：

| | Option A（推荐起步） | Option B（演化） |
|:---|:---|:---|
| 形态 | `PRCheck` 增列 `signalsJson`（快照）+ `overallStatus` + `failureSourcesJson`；`conclusion` 保留为**最坏派生态** | 新增 `pr_build_signal` 表（每 signal 一行）+ `pr_check` 作聚合头 |
| 迁移量 | 小（1 迁移加列） | 大（新表 + 关联 + 回填） |
| 查询 / 展示 | JSON 快照够展示；按 provider 聚合需应用层解析 | 灵活可筛 |
| 风险 | 单行 JSON 膨胀 | 行数膨胀、N+1 |

**建议 A 起步**（与现有 `summaryJson` / `logsJson` 的仓库惯例一致），B 留作需要「按 provider 维度统计」时再演化。

**裁定（2026-10-12）**：取 **Option A**（`PRCheck` 增 `signalsJson` / `overallStatus` / `failureSourcesJson` 三列，`conclusion` 保留为最坏派生态），迁移按幂等 + 前缀感知 helper 落地（见 §3.7 与 M43.2b）。

## 5. 决策点（已裁定，2026-10-12）

| 编号 | 决策点 | 裁定 |
|:---|:---|:---|
| D1 | 数据模型 | **Option A**（扩展 `PRCheck` 三列；`conclusion` 保留为最坏派生态） |
| D2 | 日志富化是否首批 | **不做**（留后续增量 / backlog；Layer 5 不在本批） |
| D3 | 「阻断关注集」配置形态 | **全量只报警不阻断**（任一归一化信号失败即 firing，不引入配置面） |
| D4 | provider 凭据承载 | **本批不涉及**（与 D2 联动） |

## 6. 风险与缓解

| 风险 | 缓解 |
|:---|:---|
| 限流（每 PR 3+ API × N 轮） | 增量轮询 + 终态跳过 + 现成退避 |
| provider 未装 GitHub 集成 → 无信号 | 显式声明边界（不臆造）；provider adapter 兜底 |
| check run 无原始日志 | Layer 5 provider adapter |
| 多源 check 噪音 | 「关注集」配置（D3），默认全量只报警不阻断 |
| `stale` / fork / 权限 | 归一化显式映射，fail-open（单源失败不阻断其它源） |
| 非标准响应形态产出伪信号 | 三源均过滤无 `id` 条目（§3.7 实测失效模式） |

## 7. 落地拆分（已上收 M43.2：M43.2a 采集层 / M43.2b 持久化与 API / M43.2c UI 展示）

1. **M43.2a 采集层**：GitHub 三源聚合 SyncSource + 归一化 + `nock` 单测（✅ 2026-10-12）。
2. **M43.2b 持久化与 API**：`PRCheck` 扩展三列 + migration + 监控器落库（含 `headSha` 未变且已终态跳过）+ `GET /api/pr-checks` 视图字段 + 单测。
3. **M43.2c UI 展示**：`pr-checks` 多源详情（失败源清单 + 各信号状态 / 链接）+ i18n + e2e + 视觉基线。
4. **日志富化（可选）**：provider adapter（Vercel 先行）—— 后续增量（D2 裁定本批不做）。

## 8. 验收标准

- [x] 给定一个 PR head，能列出其全部 check runs + statuses + deployments 的归一化条目，且能标注 provider（M43.2a）。
- [ ] 任一时间源失败 → 聚合状态 `failed` → `alertFiring=true` → UI 可见 + ack 可收敛（M43.2b / M43.2c）。
- [x] Vercel / Cloudflare / 其它 provider 无需额外代码即可识别（`nock` 夹具覆盖三类 `app.slug` / `context`）（M43.2a）。
- [ ] 轮询幂等：同 `headSha` 重跑不重复入库（M43.2b）。
- [x] 无 Deployments / 无 status 的仓库不报错（fail-open）（M43.2a）。

## 9. 关联文档

- [定时扫描与批量处理设计](./platform-scheduled-batch.md)（`schedule.kind` 与调度的载体）
- [运行失败分类与筛选设计](./run-failure-taxonomy.md)（本地构建失败面）
- [平台规范](../../standards/platform.md)（API / 错误码 / 运行时口径）
- [规范与文档治理设计](./spec-and-doc-governance.md)（设计文档硬阈值与分流依据）
