# 待办积压 (Backlog)

> 统一候选池，按 **长期主线任务** / **周期性回归验证层** / **短期与一次性候选任务** / **已知边界与 known-issue** 四象限区分。当前阶段见 [todo.md](todo.md)；已闭环阶段见 [todo-archive.md](todo-archive.md) 索引。
>
> **维护规则**（唯一权威声明见 [规划规范 §2.3](../standards/planning.md#23-待办积压) + [§3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement)）：本文件只保留候选正文、状态与触发条件，不复制批次叙事；上收后从本文件移除，闭环记录由 `archive/` 分片与 `archive-log.md` 维护；长期主线卡在目标达成或被阶段闭环时整卡删除或改写状态。

## 长期主线任务（可跨阶段保留）

> **状态口径**：进行中 / 观察中 / 暂停 / 已关闭。

### 主线 #1：network-audit 默认白名单持续扩展问题（G1）

- **目标**：把 network-audit 默认白名单从"按次新增"演进为"按域名 / SRI 哈希 / 输出区分"的可持续治理方案，避免每次构建工具跨 major 升级都需补白名单。
- **状态**：观察中（**「注册表域预置 + 动态发现生效 registry」方向已随 2026-10-11 M42 阶段闭环（M42.1）**；其余方向保留待评估）。
- **下一次可切片方向**（任一触发时重新评估）：
  1. 构建工具生态文档站类目预置白名单（rolldown.rs / swc.rs / rust-lang.org 等）—— 新增白名单诉求应转为"真实注册表域"申请而非"构建工具文档站"
  2. 按 SRI 哈希钉资源（推荐域动态发现）
  3. ~~**注册表域预置 + 动态发现生效 registry**（镜像站 / 企业私服被 deny-by-default 拦死 → install 失败 + 全量回滚）~~ —— **已随 2026-10-11 M42 阶段闭环（M42.1：`380e8f4` + `47f7c42` + `39df76d`，预置常见镜像源 + 从配置面动态发现生效 registry + 治理决议登记）**；剩余方向（构建工具生态文档站类目 / SRI 哈希钉定）保留待评估。
- **验收**：默认白名单不再按次新增；verification 阶段合法外联不被误判；剩余候选方向（SRI 哈希钉定等）任一实施或主线整体评估为长期保留后关闭本主线条目

## 周期性回归验证层

> **定位**：本层不是"一个任务"，而是所有长期主线的健康检查层。它不产生直接改进，只验证"没有回退"。按固定节奏执行，不参与阶段切片容量竞争。

### 固定执行入口（当前）

| 节奏 | 入口 | 最小固定组合 | 触发条件 |
|:---|:---|:---|:---|
| 阶段收口前 | `pnpm check:docs` + `pnpm run test:coverage` + `pnpm lint` + `pnpm typecheck` + `pnpm --filter @dependfix/platform exec playwright test` | 检查归档批次合入未引入回归 | 每次阶段归档前 |
| CI 端到端 | 上述 5 项 + `pnpm build` | 裁决合并 | PR 合并前 / commit 推送后 |

> **回归入口状态（2026-10-26 核对）**：三个 profile（`regression:weekly` / `regression:pre-release` / `regression:phase-close`）+ [`.github/workflows/regression-weekly.yml`](../../.github/workflows/regression-weekly.yml) 已接线；证据落点 `artifacts/regression/current.md`（gitignored，CI 上传）。**剩余待评估**：① 发版前入口与 [`.github/workflows/release.yml`](../../.github/workflows/release.yml) 的接线口径；② 阶段收口入口是否替换「阶段收口前」手写五项组合。

### 覆盖矩阵（每条长期主线的回归覆盖状态）

| 长期主线 | 阶段收口覆盖 | CI 端到端覆盖 |
|:---|:---|:---|
| #1 network-audit 默认白名单 | ✅ `packages/engine/src/runners/verification-runner.test.ts` + `network-audit.test.ts` | ✅ `pnpm run` verification job |

> 标注 `—` 的条目表示当前缺少自动化回归覆盖，是后续回归层扩面的候选方向。

### 漂移路由规则

回归验证发现的问题不自行修复，而是按以下规则路由到对应长期主线或短期候选：

| 回归发现问题 | 路由目标 |
|:---|:---|
| network-audit 真实注册表域新增诉求 / 命令输出 URL 阻断 regression | → 长期主线 #1（network-audit 默认白名单） |
| CI 失败 | → 当前阶段批次（无活跃阶段时登记 backlog 远期） |

## 短期 / 一次性候选任务（上收后去重）

> 共享说明：本区块条目当前均处于"候选评估中"或"延期暂缓"状态；正式上收阶段后从 backlog 移除并归档至 [todo-archive.md](todo-archive.md)。评估为"暂不实现"的候选直接关闭。

### 候选评估中（待评估 / 本阶段延后项）

> **候选池概览（2026-10-27 实测）**：本区 52 项；P0 0 / P1 4 / P2 15 / P3 2 / 未标注 31；另有延期 P3 1 项（Umami，不计入本区）。分档见 [release-1.0-readiness.md](../design/governance/release-1.0-readiness.md)；未标注候选评估时补 P 标签，不默认升级。
> **1.0 门槛与分档**：P0 23 / P1 8 / 1.0 后 15 的分档、门槛判定与批次计划见 [release-1.0-readiness.md](../design/governance/release-1.0-readiness.md)；本区候选在未上收前保持候选状态，上收后按批次从本表移除。
> **E 阶段候选（2026-10-24 用户决策 D+E）**：`critical` 必选不可关闭 / 通知严重级别术语与阈值命名 / 周报投递重试与窗口锁 / `/settings` 与通知页 dark 视觉 4 项已获授权作为 M48 归档后的下一阶段，当前保持候选状态（不含阶段编号）；M48 已归档，待启动 P 阶段。

- **平台 PR Check 创建后回环**（M48.5 边界）—— 平台建 PR 后仍只有轮询 + 告警，不复用 CLI 的等待状态机 / 评论 / 关闭能力；触发：再次出现「PR 红了无人收」的用户反馈，或平台已具备 check 采集面时评估复用。
- **pr-checks 页归因标签的渲染验证**（M48.6 W-A1）—— 归因标签的 `v-if` / 色调 / 文案由纯函数单测与 e2e fixture 字段覆盖，但无视觉基线用例；触发：下次修改 pr-checks 页或重建视觉基线时顺带补一条带 `attribution` 的失败信号。
- **平台与 CLI 的 `completed + conclusion=null` 口径统一**（M48.6 已裁定差异）—— 平台记 `skipped`、CLI 按 fail-closed 记失败；触发：该形态在真实仓库出现或用户报告口径困惑。
- **head 侧同 ref 多轮 check run 按作业名收敛**（M48.5 边界）—— 现为「存在失败即 `failed`」，re-run 覆盖的旧条目可能造成误报（只评论、不关闭）；触发：re-run 噪声导致评论误报时评估取最新一轮。
- **`en-US` 配置指南存量漂移**（M48.3 / M48.5 / M48.6 共同边界）—— 英文版缺 `retryFailed` / `waitPrChecks` / `closeFailedPr` / 预算键等行（16 行存量漂移）；触发：下次配置键变更批次或 i18n 同步批次。
- **镜像脚本只覆盖根 scripts 单一形态**（M48.2 边界）—— `pnpm --filter` / 递归 / env 前缀 / corepack 钉定只披露不执行；触发：目标仓库 CI 大量使用这些形态导致「本地假绿」再现。
- **白名单内运行前未提交改动的归属**（M48.4 边界）—— 白名单内文件（典型 `package.json`）若在运行前已有用户改动，会与本次修复一并提交；触发：出现「PR 混入无关改动」的用户反馈时评估。
- **`dependfix-remediator` REFERENCES 的 MCP 状态与入参映射过期**（M49.4 边界）—— `skills/` 与 `packages/skills/` 两份同文 `REFERENCES.md` 仍写「当前 MCP Server 未发布」，能力映射表入参名（`owner` / `severityThreshold` / `includeCodeScanning`）与当前 MCP schema（`repo` / `severity` / `code_scanning`）不一致；4 tool 检测子集为刻意最小集，保留。触发：F2 技能文档批次，或下次修改 MCP schema 时。
- **`SandboxExecutor` 真实引擎执行仍为占位（P1 🛡️，恢复 sandbox 入口前必须闭环）**—— `apps/platform/server/services/executor/sandbox-executor.ts` 的 `buildCmd` 仅回显最小 `RunResult`（exitCode 0 / 0 告警），不启动 dependfix 引擎；M10 T1001 已落隔离基础设施、M38 已落执行进程隔离。影响：选择 `executorKind=sandbox` 的扫描曾为假成功。**平台入口已于 2026-10-27 临时关闭**（UI 禁用 / API 拒绝新写入 / 存量仓库强制降级 `container` + degraded `sandbox_entry_disabled`）；真实执行闭环后恢复入口。待办：实现 sandbox 内自包含 CLI 入口 + git clone / pnpm install / 引擎执行 / 结果回传，补真实容器 e2e。触发：恢复 sandbox 入口前必须完成。**复用 / 弃用判据**：恢复入口前决定「复用（补自包含入口 + 真实 e2e）」或「弃用（删除 executor / 沙箱 env / UI 残留）」；未决定前保持入口关闭。
- **`pnpm_audit` 的 token-free 回退意图与实现不一致（P2 🛡️）**—— `pnpm-audit.tool.ts` 注释与产品意图是「无 GitHub token 或 403 场景」的本地回退，但实现保留 `requireToken()`，缺失 `GITHUB_TOKEN` 时直接返回 `ok:false`；当前 README / tool description 已按实际行为修正。待评估：移除 `requireToken()`（或改为可选 token），补无 token 用例，恢复真正回退。触发：无 token 环境需要 pnpm-audit 回退时。
- **周回归审计在 registry 故障时假绿（M49.3 边界，P2 🛡️）**—— 阻断命令按 AC1 在 registry 故障时 exit 0；`security:audit-deps` 在周回归仅按 exit code 判过，若 registry 故障且日志无审计结果行，run 会 success 但未实际审计。当前 §5.6 / 检查点已要求「证据 run 须含审计结果行」；待评估：为 `security:audit-deps` 增加输出断言（无结果行则非零）或落盘校验。触发：出现 registry 故障窗口或周回归连续 success 但日志无审计结果时。
- **`repositoryUpdateSchema.partial()` 注入默认值导致 PUT 静默重置字段（P1 🛡️，2026-10-27 审计发现）**—— Zod 4.6.7 实测 `repositoryUpdateSchema.parse({ note: 'x' })` 会注入 `platform: 'github'` / `defaultBranch: 'main'` / `packageManager: 'pnpm'` / `executorKind: 'container'`；任何只改 note / tags 的 PUT 会把 `github-action` 仓库静默重置为 container（defaultBranch / packageManager 同理）。影响：数据完整性与执行器误重置。待修复：update 专用无默认字段 schema，或 API 层按原始 body 键应用；补「PUT 省略 executorKind 不改动存量 github-action」用例。当前 UI 提交全量字段，暂不触发；API 直连调用方需注意。触发：API 直连部分更新导致字段被重置，或 update 语义修复批次。
- **回归窗口 new-entry 插入点嵌套进上一条受管块（P2 🛡️，2026-10-27 审计发现）**—— `upsertRegressionWindowContent` 以第一条 `## YYYY-MM-DD` 标题为插入点，但该标题被上一条 `<!-- regression-window:start:id -->` 包裹；本地累积 / 重跑最旧 id 时新块嵌套进旧块标记区间（a→b→a 三次 upsert 后仅剩 1 块）。CI 每次全新 checkout 仅写 1 条不受影响；历史 `docs/reports/regression/current.md` 已呈嵌套（`0b0ff93b` 前）。待修复：锚点改为第一条记录 start 标记之前（无标记回退 `##`），补「不同 id 顺序 upsert 生成同级块 + 最旧 id 重跑不丢后续块」单测。触发：本地连续回归或修复窗口结构时。

- **运行面漏洞检测：镜像基底 / 运行时二进制 / OS 包（待研究）** —— 背景（2026-10-22）：Node 24.18.1 基础镜像在 2026 年 10 月 21 日安全公告（CVE-2026-111497 Brotli 越界写、105483 / 106069 TLS 主机名校验绕过等）后仍只能靠**外部人工巡检**发现——Dependabot 未配置 docker 生态、基底此前为 digest 裸写（本轮已改为 tag + digest，但仍为手工钉定、无漂移与漏洞追踪）、`pnpm audit` 只覆盖 npm 依赖、GitHub 侧告警源为 Dependabot / Code Scanning / Code Quality findings（最后一类为代码静态分析），本地回退仅 `pnpm-audit`（同属 npm 依赖）；运行面与 OS 包无任何告警源。本批新增的 `check-node-version.mjs` 是**静态下限闸门**：只有人工抬升基线后才会拦截，**不能发现基线之后新披露的 CVE**。
  - **待研究问题**：① dependfix 自身的运行面（Docker 基底 / Node 二进制 / apk 包 / CI 运行时）能否自动检测并按严重级别分级？② 同一能力能否产品化，成为 dependfix 对**被管理仓库**的新告警源——扫描目标仓 Dockerfile / `.nvmrc` / `engines.node` 与已知运行时漏洞比对，复用现有验证链与 PR 创建提修复 PR？
  - **候选机制**（需比较权威数据源与误报成本）：
    1. **CI 周期任务**：解析 `FROM` 的 tag + digest → 采集镜像内 `process.versions` / `apk info -v` → 与 Node CHANGELOG、Alpine secdb 比对；漂移时开 issue 或失败
    2. **SBOM + 容器扫描**：`syft` 生成镜像 SBOM，`trivy` / `grype` 按 CVE 分级；产物可归档、可审计（对 OS 包与语言依赖有覆盖；对 tarball Node 与内嵌依赖不可见，不能替代机制 1）
    3. **Dependabot docker 生态**：`FROM image:tag@digest` 形态下自动提 digest PR（只覆盖基底发布，不覆盖运行时 CVE）
    4. **产品化 runtime alerts**：目标仓 Dockerfile / engines / `.nvmrc` 解析 + 漏洞库比对，作为 Dependabot / Code Scanning 之外的第三类告警源
  - **数据源实测（2026-10-22，时点快照）**：
    - **Node 运行时（官方 tarball / 镜像）**：主线映射用 `nodejs/node` 的 `CHANGELOG_Vxx.md`（`24.22.1` 段含 `CVE-2026-111497`）与 nodejs.org 安全公告；`dist/index.json` 无 CVE 编号，但有 `security` 布尔与内嵌版本字段（openssl / uv / zlib / v8），可用于判「是否安全补丁版」。**反例（不能只按发行版生态映射判官方 tarball 版本）**：OSV 的发行版生态（如 Debian）在公告当日即可有 CVE → `nodejs` 映射，但对应的是发行版打包的 node，不等于官方 tarball 版本。
    - **apk 包**：Alpine secdb（`secdb.alpinelinux.org/v3.24/{main,community}.json`）的 `pkg.secfixes`（修复版本 → CVE 列表）；OSV 的 `Alpine:v3.24` 生态提供等价查询（条目形如 `ALPINE-CVE-*`）。两者都不覆盖官方 tarball 的 Node（镜像内 `apk info -e nodejs` 不存在）。
    - **滞后 / 不可用源（时点事实）**：NVD 在 111497 发布当日 `vulnStatus=Received` 且 `configurations` 为空；MITRE 记录把受影响产品标为 Google Brotli（分支区间 1.0.3–<1.0.10 / 1.1.0–<1.1.1 / 1.2.0–<1.2.1），不是 Node.js；GitHub Advisory 无 node 运行时条目（该 CVE 的 `GHSA-9v8h-qqgm-4m35` 当日已收录且为 critical，但 `vulnerabilities` 为空、无包映射，故不产生 Dependabot 告警）；endoflife.date 只有版本 / EOL。
    - **内嵌依赖**（OpenSSL / undici / SQLite / c-ares）：编进 Node 二进制，OS 包扫描不可见。`process.versions` 只用于采集清单，**不能单独作为判定依据**——内嵌库可能因 cherry-pick 修复而版本号不变（实测 brotli 1.2.0 仍在受影响区间，但 `24.22.1` 已修）；判定以 Node 发布版本 + CHANGELOG 已修 CVE 为准。
    - **分层覆盖（按层，不是优先级）**：① 运行时层（`process.versions` 采集 + Node CHANGELOG 判定）→ ② apk 层（`apk info -v` + secdb / OSV）→ ③ SBOM + trivy / grype（OS 包批量；对 tarball Node 与内嵌依赖不可见，不能替代 ①）。
  - **其余前置评估点**：扫描工具的引入成本（镜像体积 / CI 时长 / 许可证）与结果噪声；误报与豁免口径（与 `pnpm-workspace.yaml` 的 `audit.ignore` 如何统一）；与 `check-node-version.mjs` 静态基线的关系（动态发现 → 提 PR 抬升基线，而非替代基线）。
  - **触发条件**：下一次 Node / Alpine 安全公告；或需要为被管理仓库新增运行时告警源时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **PR Check 三源信号的 provider 原生日志富化（待评估）** —— 现象：M43.2 已完成三源（Checks + Commit Statuses + Deployments）归一化、聚合状态与失败源清单，但失败详情只到 provider / 信号层，**无 provider 原生 API 日志**（D2 裁定首批不做，留后续增量）。待评估点：是否接入 Vercel / Cloudflare / GitHub Actions 的原生失败日志拉取（需 provider 凭据承载面 + 配额控制 + 输出脱敏 + 单行 JSON 膨胀控制）。触发条件：用户报告「信号已失败但无日志可看」时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`quick-start` 指南的 en-US 镜像为裁剪子集（行级漂移）（待评估）** —— 现象：`docs/guide/quick-start.md`（408 行 / 命令行参数表 25 行）与其镜像 `docs/i18n/en-US/guide/quick-start.md`（133 行 / 11 行）结构不同源——镜像缺 `--commands` / `--history` / `--verbose` / `--commit` 等多行（2026-10-15 核对 `rg -c '^\| \`--'` 实测 25 vs 11）。该漂移属既有状态（本轮改动 `--commands`行时发现镜像无对端），`docs:check:i18n`仅查重复页、`check:readme-i18n` 仅覆盖 README，故无机检。
  - **待评估点**：① 是否补全镜像参数表（逐行对齐 zh，成本为一次性翻译同步）；② 或明确「en 侧为对外精简版」定位并在 i18n 新鲜度台账登记该差异（避免后续批次反复判定为遗漏）。
  - **触发条件**：下次 i18n 新鲜度同步批次；或再次改动 `quick-start` 参数表时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`alerts.vue` 存在一处闲置的 `useFixNow()` 解构（待评估）** —— 现象：`apps/platform/app/pages/alerts.vue` 顶部解构 `{ fixingRunId, fixError, fixSuccess, triggerFix }` 但全文件未使用（真正的「立即修复此仓库」入口在子组件 `alert-run-sidebar.vue`），伴随的注释也仍在描述已抽走的流程；该孤立实例同样不消费后加的 `fixMerged`。
  - **待评估点**：① 直接删除该解构 + 收敛注释（零行为风险）；② 或反向确认是否存在未接线的预期入口（若存在则补齐而非删除）。
  - **触发条件**：下次改动 `alerts.vue` 时（该文件已处 max-lines warning 带，顺带减法更划算）。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **扫描偏好服务端跨设备默认（延后，保留待评估）** —— **来源**：[issue #136](https://github.com/dependfix/dependfix/issues/136)（该 issue 的设备级需求已随 M37.2 交付，2026-10-15 关闭；本条保留其范围外的服务端默认部分）。设备级方案 C 混合（localStorage：上次选择 + 可选配置化默认 + 重置）已落地；服务端用户 / 组织级默认偏好（跨设备、可管理，需实体 / API / 设置页，预计触发 governance 文档）按用户 2026-10-06 决策延后。**现状锚点**：`apps/platform/app/composables/use-scan-preferences.ts`。触发条件：① 用户实测多设备切换痛点；② 组织级统一默认诉求。

- **`repo-history-dialog` history 模式与 legacy `/repos/[id]/runs` 页疑似无入口死代码（待评估）** —— 现象：全仓仅 `scans.vue` 以 `:query-key="'run'"` 挂载 `repo-history-dialog`；`repos.vue` 的历史入口已改为跳 `/scans?repository=`，故组件的 history 模式（list 视图 / 「返回列表」分支 / `queryKey='history'` 默认值）当前**不可达**；legacy 页 `app/pages/repos/[id]/runs.vue` 亦无站内链接（其注释引用的 backlog 删除候选已不存在）。
  - **待评估点**：① 删除 history 模式分支 + 收敛组件为单一 run 模式（减法）；② 或恢复 history 挂载点（若确有按仓库浏览历史的需求，可复用扫描页 `/scans?repository=` 路径）；③ legacy `/repos/[id]/runs` 页是否随 history 模式一并删除。
  - **触发条件**：组件 / 页面维护（如再次改动 `repo-history-dialog`）；或用户要求清理死代码。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`platform-scheduled-batch.md` 设计快照端点表 / 实体清单陈旧（待评估）** —— 现象：设计稿 `docs/design/governance/platform-scheduled-batch.md §6.1` 的定时计划 CRUD 端点表未登记新增的 `GET /api/schedules/monitor-status`（只读总开关状态端点），§3.1 实体清单仍无 `Schedule.kind` 列。该稿状态为「🔶 设计先行」快照，若后续被当作 API 契约参考会漏看新端点。
  - **待评估点**：① 是否将 design 快照视为需持续同步的契约（补 §6.1 端点表 + §3.1 实体字段）；② 或明确定位为「时点快照」并在阶段归档时统一回填。
  - **触发条件**：后续以该文档为 API 契约参考产生歧义；或用户要求同步设计稿。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`scans.vue` / `alerts.vue` / `repos.vue` 体量超 `max-lines` 上限（待评估）** —— 现象（2026-10-24 `wc -l` 实测）：`apps/platform/app/pages/scans.vue` 1001 行、`alerts.vue` 900 行、`repos.vue` 840 行，均 >800 触发 `max-lines` warning。当前 lint 以 `--max-warnings 10` 通过，未阻断。
  - **待评估点**：① 抽取运行列表筛选工具栏（模板约 60 行）为独立组件，或抽 `exportLogs` 到 composable；② 是否一并治理 `alerts.vue` / `repos.vue`；③ 是否收紧 `max-lines` 阈值或引入 per-file 例外。
  - **触发条件**：三页继续增长致 warning 逼近上限；或用户要求清理。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **列表页筛选 / 分页能力的共享抽取（待评估）** —— 现象：`repos.vue` 与 `batch-runs.vue` 各自实现客户端筛选 + 重置 + 内建分页（形态相近但字段与语义不同），`scans.vue` 另有按仓库客户端分页实现；三处筛选 / 分页样板重复。展示口径统一批次（M42.5）判定两页形态尚未完全一致，故先页面内实现。
  - **待评估点**：① 抽取 `useClientTableFilter`（搜索关键字 + 筛选态 + 重置 + 过滤结果）的收益与形态约束；② 或仅抽「搜索 + 重置」最小面；③ 与组件内建分页的边界（分页本身不抽）。
  - **触发条件**：第四处列表页需要同类能力时；或筛选逻辑变更需多处同步时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **设置页严重级别查找与展示标签 helper 收敛（待评估）** —— 现象：`settings.vue` 内联实现 `find((option) => option.value === x)?.label ?? x`，与展示口径单一事实源的 helper 等价；该批次判定其已满足「同源查找」故未动。
  - **待评估点**：① 收敛到同一 helper（需处理设置页使用本地 computed 选项数组的差异）；② 或保持等价实现并注明。
  - **触发条件**：选项数组结构变更时；或设置页重构时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **镜像白名单：企业私服自带独立 CDN 域的补录（待评估）** —— 现象：镜像源动态发现只覆盖「配置面 registry 键的 host」；企业私服 tarball 若 302 到**独立 CDN 域**（与 registry 不同域），该域不在预置清单内 → 仍被 deny-by-default 拦截（交付时已登记为已知限制，需显式 `DEPENDFIX_ALLOWED_DOMAINS`）。
  - **待评估点**：① 是否按 302 `Location` 自动补录 CDN 域（可从审计记录观测补录）；② 或维持显式配置；③ 自动补录的安全边界（是否需用户确认）。
  - **触发条件**：出现企业私服 CDN 域被拦的实例；或用户要求自动化。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`dialog-select-open-dark` 视觉基线的运行间非确定性（待评估）** —— 现象：`--update-snapshots=all` 重建时该基线多次产出与上一次不同但极接近的字节（实测差异约 28px / ratio 0.002% / maxΔ 35，集中在弹窗内 Select 面板的一小块区域），不带 update 复跑则稳定通过（差异远低于 `maxDiffPixels: 100` 预算）。2026-10-12~13 三次重建各复现一次（M43.1 / M43.2b / M43.2c 批次），均已还原为已提交版本。
  - **2026-10-16 补充证据（本候选不闭环）**：① **归属订正**——M44.1（2026-10-14）起连续 5 次 push 的 `Visual Regression` 红**不是**本现象：其差异为 2080 / 2403 px 且跨运行**逐字相同**，根因是 i18n 提示语补入 `typecheck` 造成的基线连带失配（已重建，见 [todo.md](todo.md)）；② **新增实证（指向 update 落盘路径）**——构建后**首次** `--update-snapshots=all` 落盘的帧与随后连续三次 no-update 帧在弹窗遮罩下的表格区（y 298-419）差约 4k 像素，**二次** update 与 no-update 帧逐字节一致 ⇒ 观察对象从「基线本身漂移」移到「update 路径落盘帧非稳定」，故「重建后不带 update 连跑复核」已升为规范条款（[testing.md §6.7](../standards/testing.md)）。
  - **待评估点**：① 是否为暗色浮层阴影 / 抗锯齿在门户面板上的舍入抖动（需定位具体像素来源）；② 是否需扩大该基线的 `data-visual-mask` 覆盖区或改元素级截图；③ 是否接受为已知边界（当前不影响门禁判定）；④ 是否在基线维护协议层面消除 update 落盘路径差异（统一「重建 + 连跑复核」两步产出基线，或对 update 产物加稳定帧二次取帧）。
  - **触发条件**：该基线在**不带 update** 的复跑中失败（即超出容差）；或用户要求清理视觉基线噪声。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **归档索引表格行的成对错位强调（`**；**` 形态，待评估）** —— 现象：`docs/plan/archive/index.md` 的 M16 / M17 等历史归档行内含 `` `**；**` ``（成对但无强调语义，渲染为加粗分号），系早期批次书写惯例遗留；此类 `**` 计数为**偶数**，`check-docs` 的 `emphasis` 规则按定义只覆盖**未配对**（奇数计数）形态（[文档规范 §2](../standards/documentation.md) 已把「成对但语义错位」声明为显式盲区）。
  - **待评估点**：① 是否统一清理（涉及多行同形，宜独立批次以保持归档排版一致）；② 或维持现状并在规范注释中作为盲区实例保留。
  - **触发条件**：归档索引再次批量编辑时；或用户要求清理归档排版。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **归档目录内 file-dead 相对链接前缀治本（待评估）** —— 现象：`docs/plan/archive/**` 的历史相对链接存在**目录前缀错误**（如从 `docs/plan/archive/` 引出 `../standards/…` 或 `../../design/governance/…`，实际应为 `../../standards/…` / `../../docs/design/governance/…`）；`check:docs` 的 links 面（file-dead）对该目录整体豁免（见 [md-walk 决策注释](../../scripts/shared/md-walk.mjs)），故长期不可见。
  - **待评估点**：① 是否对归档目录做一次路径前缀重指（使 `archive-anchors` 的跨文档锚点子集真正生效，消除该永久盲区）；② 或维持豁免并保留注释登记为既定边界。
  - **触发条件**：归档链接前缀批次立项；或用户要求清理归档死链。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **经验归档分片范围声明口径与段序（待评估）** —— 现象：分片命名存在两套口径——`experience-archive-§70-§99-delivery-platform.md` 按「建立时规划上界」命名（实际内容仅至 `## 七十二、`），而 `§1-§21` / `§49-§69` 等按**实测内容范围**命名；另 `experience-archive-§29-§35-integration.md` 内 `## 三十二、` 段排在 `## 二十九、` 之前（段序异常，范围本身齐备）。M44.3 已把 `§49` 分片的「文件名 / H1 / 内容范围」三方对齐，本条为同源剩余口径。
  - **待评估点**：① 统一「分片范围 = 实测内容范围」还是「= 建立时规划上界」并写入分片维护约定；② 段序是否按编号归位。
  - **触发条件**：新增 / 扩容经验分片时；或用户要求清理归档排序。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **zh 设计文档拆分后的 en-US 镜像结构漂移（待评估）** —— 现象：M44.4 分片化改造仅作用于 zh 事实源（`docs/design/**`），`docs/i18n/en-US/design/governance/{architecture,platform-ai-integration}.md` 等镜像仍为未拆分全量译文；镜像不在 `check-doc-size` 计量面（阈值表 glob 为 `docs/design/governance/*.md`）、`docs:check:i18n` 仅查 legacy/i18n 重复页，故该漂移无机检（2026-10-24 M48 新增 `pr-delivery-closure.md` 索引行同样未同步 en 镜像）。**待评估点**：① 镜像是否随 zh 结构同步拆分（成本较高）；② 或在 i18n 新鲜度台账登记「zh 结构 → 镜像结构」映射并在后续同步批次对齐。
  - **触发条件**：下次 i18n 新鲜度同步批次；或 zh 侧继续分片化时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`caomei-ui-migration.md` 存量超标的保序拆分（待评估）** —— 现象：`docs/design/governance/caomei-ui-migration.md` 940 行（治理设计阈值 ≤400 / 强制分片 >700），由 [check-doc-size 豁免表](../../scripts/check-doc-size.mjs) 逐条登记（理由：阈值入表时即超标、入链面广、§15 迁移实证需保序）。本批已产出拆分方案：**主文档保留 §1-§11**（实测 387 行 + 分片索引，仍 ≤400）、**分片 A = §12-§14**（上收触发条件 / 关联文档 / 文档元数据）、**分片 B = §15.1-§15.10**（169 行）、**分片 C = §15.11-§15.15**（339 行）（§15 内部按子节保序切分，三处分片均 ≤400）；落点命名 `<slug>-<主题>.md` 同级；拆分后须移除豁免表条目并重指入链（§15 被 experience-archive / caomei-ui-migration 迁移评估 §15.x 等引用）。
  - **待评估点**：① 是否按上述方案执行（独立内容治理批次）；② 或维持豁免（当前状态）并在豁免理由中保留「待该批次落地后移除此条」。
  - **触发条件**：启动独立内容治理批次时；或该文档再次增量更新时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`architecture.md` 技术选型表含未采用的 momei 复用项（待评估）** —— 现象：`docs/design/governance/architecture.md` §技术选型表列出「监控 | Sentry（`@sentry/nuxt`）| momei」「PWA | `@vite-pwa/nuxt` | momei」等条目，而在全仓无依赖声明与源码引用（M44.6 已核对 `apps/platform/{package.json,nuxt.config.ts,app,server}`；`docs/design/governance/architecture.md` 等文档级提及属复用参考表，非声明）。该表有「来源」列显式标注 momei（属复用参考而非「当前已采用」断言），但读者可能误读为现状。
  - **待评估点**：① 加一句口径说明（表为 momei 复用参考，未采用项不在此表承诺）；② 或对未采用项加「未采用 / 暂缓」标注（Sentry 见 [第三方可观测性评估](../research/2026-10-27-third-party-observability-evaluation.md)，winston 行对应同文档 §现状：平台 logger 已实现但未接线）。
  - **触发条件**：下次改动 `architecture.md` 或技术选型复核批次。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`docs/standards/ai-collaboration.md` 已处 200 行健康上界（待评估）** —— 现象：该文档当前 200 行（`docs/standards/*.md` 阈值：≤200 健康 / 201-400 warning），M44 归档批次新增审计条款时因越界被迫改落 `testing.md §6.12`。**待评估点**：① 下次需扩条时先做结构压缩（合并同源小节）；② 或按 [文档规范 §3](../standards/documentation.md#3-文档行数阈值) 拆分子文档（如「审计协议」独立篇）。**触发条件**：下次需向该文档新增条款时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **归档链接使用 `--`（双连字符）锚点形态在浏览器侧为死锚（待评估）** —— 现象：`docs/plan/**` 中 M4x 归档链接普遍写作 `#m43-pr-check-…--2026-10-14-归档`（双连字符），而 VitePress 构建产物 id 收敛为**单连字符**（实测 `id="m43-pr-check-能力补强-运行时可靠性与工程治理-2026-10-12-用户决策方案-a-2026-10-14-归档"`）；客户端路由 `getElementById(decodeURIComponent(hash).slice(1))` 不做归一化 → 点击锚点无法滚动到目标段（页面可正常加载）。`check:docs` 的 `normAnchor` 剥离全部标点（含 `-`）→ 门禁不报。**该形态在 HEAD 已普遍存在（M41/M42/M43 等），非 M44 归档批次引入**。
  - **待评估点**：① 批量把归档链接的 `--` 收敛为单连字符（并核对构建 id）；② 或在 `check-docs.mjs` 增加「锚点归一化后仍需与产物 id 一致」的规则（可机检子集 + 白名单）。
  - **2026-10-15 M45 规划批次实测补充**：以 `docs:build` 产物 id 为权威复扫后，文档侧锚点与产物 id 存在**两类**系统性差异——(a) 非词字符（`:` / `/` / `（` / `.` / `~`）在产物侧转为单连字符（`M45: 收口（2026…A / 进行中）` → `m45-收口-2026…-a-进行中`），文档侧「去标点 + 空格转连字符」写法（含 `--`）与之不符；(b) **数字开头的章节号在产物侧带 `_` 前缀**（`### 1.1 硬性约束` → `_1-1-硬性约束`，文档侧普遍写 `#11-硬性约束`）。同批复扫另发现**存量缺段锚点 2 处**（`roadmap.md:41` 与 `archive/index.md` 指向 M31 归档段，缺段产物 id 为 `m31-apps-platform-ui-组件库迁移-primevue-→-caomei-ui-m31-1-m31-6-全部已闭环-2026-09-29-归档`）。**本批处置**：新增的 **M45 目标锚点**按产物 id 实证形态书写（如 `#m45-…-2026-10-15-用户决策方案-a`），不新增同类死锚；本批新增行中**沿用存量家族形态**的链接（指向 `planning.md` / `platform.md` / `caomei-ui-migration.md` / `todo-archive.md` 的 11 处，均为既有写法的复用）**不随本批改写法**——统一迁移归本候选（含上述 2 处缺段），以免在单批内制造同文件双形态。复现命令：`pnpm run docs:build` 后 `rg -o 'id="[^"]*"' docs/.vitepress/dist/plan/todo.html`。
  - **触发条件**：下次归档批次或文档门禁扩面时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **M44 蒸馏新增条款的检查点挂接与配套收敛（待评估）** —— 现象：M44 阶段归档批次蒸馏新增 12 条严格约束（`planning.md §4.4` 第 16-20 条 / `testing.md §6.12` / `documentation.md §6` 五条），但 `code-quality-checklist.md` 的「规范条款 review 检查点矩阵」与 `code-auditor.agent.md` 必查项**均无对应行**（R1 分区 B 审计标记为「待补挂」）；另有 2 条 pattern 未落任何权威文档（「门禁规则扩面前先跑一次性探针量化分布」「E2E 取证临时仓库不要软链 node_modules」），及 3 处新条与既有条款主题重叠（`documentation.md §6` 量化断言 ↔ `planning.md §2.5`；`documentation.md §6` 引用范围措辞 ↔ 同节覆盖面声明；`planning.md §4.4` 第 18 条 ↔ 第 3 条）。
  - **待评估点**：① 矩阵 / agent 必查项补挂（建议至少覆盖 §4.4 第 16/18 条、`testing.md §6.12`、`documentation.md §6`「断言复现运行期真实条件」「非门禁面缺陷」）；② 2 条未落点 pattern 补写落点（或改判废弃）；③ 3 处重叠改为交叉引用收窄。
  - **触发条件**：下次改动上述规范文件 / 文档门禁扩面 / 阶段归档批次。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **基线红 / 安装失败的交付降级策略（draft PR / issue / 人工确认）（待评估，P2 🎨）** —— 现象（2026-10-18 生产复盘）：P0 交付正确性批次已实现「修复后安装仍既有失败 → 不建普通 PR」，但被跳过的告警仍只剩报告与日志，用户没有「可跟踪的待办载体」。`nest-template#2421` 的基线 lockfile 本身损坏，正确处置可能是开 issue / draft PR 说明「先修 lockfile」，而不是静默跳过。
  - **待评估点**：① 是否支持 `DEPENDFIX_ON_BASELINE_RED=skip|issue|draft`（默认 skip，保持当前行为）；② issue / draft PR 的标题、正文、标签与去重键（复用 `findDependfixOpenPR` 还是新 issue 查询）；③ 与 `PRE_EXISTING_FAILURE` / `alertsSkipped` 记账的衔接，避免同一原因反复开单；④ 交付被跳过仍为 exit-code 中性（`PRE_EXISTING_FAILURE` 在跳过类白名单），CI 无法从退出码感知「要求交付但未交付」——是否补一个**非归因但可见**的交付跳过信号（summary 字段 / 平台 run 状态 / UI 标记）。
  - **触发条件**：用户要求「0 修复也要有可跟踪记录」；或 baseline 红仓库占比持续升高时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **交付类同步调用未纳入运行级取消面（待评估，P2 🛠️）** —— 现象（2026-10-17 审计派生）：本轮把安装 / 锁文件修复 / 验证三类长命令迁到受管异步执行并纳入取消面，但 `github/pr-creator.ts` 的 `git push` / `git commit` 与 `app/helpers.ts` 的仓库状态查询仍是同步子进程调用 —— 弱网下 `git push` 会持续阻塞事件循环（平台执行超时定时器、队列锁续期与 HTTP 同族阻塞面的残留），且不受取消守卫覆盖（[executor-process-isolation.md §8.5](../design/governance/executor-process-isolation.md#_8-执行超时与运行级取消-2026-10-17) 已声明覆盖边界）。
  - **待评估点**：① 交付类调用是否迁移到受管异步执行（含 push 的进度输出与错误证据面）；② 短命令（版本探测 / 仓库状态查询）是否顺带收敛或维持豁免并写明理由；③ 与「推送失败留痕 / 恢复」既有链路的交互。
  - **触发条件**：弱网 / 大仓场景下再次出现「超时定时器延迟触发」或推送期间平台无响应。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **独立 installer 容器 / runtime 工具链移出（待评估，P2 🛡️ 安全 / 🚀 体积）** —— 背景（2026-10-18）：runtime 阶段补 `python3 make g++` 以支持目标仓库原生模块的 `node-gyp` 回退；审计实测同 digest 基础镜像下 content size +约 110MB、`docker images` disk +约 421MB（`/usr` +约 303MB），同时扩大了不可信仓库可用的编译面。工具链本身也不是充分条件：node headers / prebuild 源需可达，部分模块另需 `linux-headers`（当前未装）。
  - **待评估点**：① 是否把安装依赖拆到独立 installer 容器 / 阶段（只在该阶段保留工具链，主 runtime 仍只含 `.output`）；② 若保留在 runtime，是否补 `linux-headers` / 预置 node-gyp headers 缓存，并加镜像体积门禁；③ 与 pnpm store 持久化事项（本阶段已上收）的卷 / 缓存策略联动。
  - **触发条件**：镜像体积 / 安全评审要求收敛编译面；或再次出现「预编译包下载失败 + 缺 headers / 工具链」的原生构建失败。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **单仓通用执行预算 / deadline 检查（待评估，P2 🛠️ 可靠性）** —— 现象：2026-10-18 已用「修复前基线安装失败即跳过依赖链 + 合批环境性失败跳过逐包 + 逐包环境性中断」覆盖已观测的超时形态；但当基线安装成功、多个单包安装各自以**非环境性**失败结束时，仍可能把单仓 30 分钟预算耗在多次安装上。引擎目前只感知运行级 abort，不感知「剩余预算」。
  - **待评估点**：① 平台是否把 `deadlineAt`（或剩余毫秒）透传给引擎，在每次安装 / 验证前检查；② 或在编排层以「连续 N 次安装失败即停止本仓」的保守阈值兜底；③ 与「部分成功交付」的交互（停止前已完成的修复是否允许提交 / 验证）。
  - **触发条件**：再次出现「基线成功但逐包安装耗尽 30 分钟」的运行；或平台执行预算调整时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`sandboxLimits` / `tags` 等存量 JSON 配置列的写入闸门对齐（待评估）** —— 现象：`development.md §5.1.45` 已把「宽容输入 + `.strict()` 拒绝未知键 + 校验常量单一事实源」定为新增 / 修改配置列的 hard requirement，但 `Repository.sandboxLimits` 仍无 `.strict()`（未知键被 Zod 静默 strip）、`tags` 上限是 schema 内裸数字且 `parseTags` 不做 trim / 去重。**待评估点**：① 是否给 `sandboxLimits` 补 `.strict()` 并加未知键 400 用例；② 是否抽 `tags` / `sandboxLimits` 上限常量供 schema 与解析共用；③ 是否需要在 UI 侧提示未知键被拒绝。**触发条件**：下次改动仓库级配置列 / 仓库表单时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`ai-collaboration.md` / `platform.md` / `git.md` 均处 200 行上限的瘦身（待评估）** —— 现象：三文件行数均恰为 200（规范健康窗口上限），本批增补未越线但已零余量，任何后续增补都会进入 warning 带。**待评估点**：① 逐文件找可合并 / 可下沉段（重复表述、历史注记、可由设计稿承载的实现细节）；② 是否把长期稳定段迁入 design 后留一行指针；③ 瘦身不得删除 hard requirement 的唯一权威声明。**触发条件**：任一文件需再次增补时（先瘦身再增补）。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **仓库级 `allowMajorUpgrade` 开关（待评估，P2 🚀）** —— 现象：平台侧硬编码 `false`，跨 major 告警一律跳过；M46.2 已做披露但未放开升级（源候选在 M46 上收时保留的残余点）。
  - **待评估点**：① 仓库级开关（默认关）+ 完整验证 + AI 研判兜底；② 与交付守卫 / 基线的交互；③ 风险阈值与回滚边界。
  - **触发条件**：用户要求自动处理跨 major；或跨 major 告警占比持续升高。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **升级探针合批与门禁回滚粒度联动（待评估，P2 🛠️）** —— 现象：M46.3 已做基线完整链与按变更单元回滚，但未做探针合批；合批会改变回滚单元、验证次数与失败回退语义。
  - **待评估点**：① 合批后的回滚单元（batch vs probe）；② 与 `verificationBlocking` 归因的衔接；③ 失败回退逐包的语义保持。
  - **触发条件**：单仓安装次数成为主要耗时；或回滚粒度仍不足。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **执行资源采集覆盖面扩展（待评估，P2 🛠️）** —— 现象：M46.4 已采集 Linux cgroup v2/v1 内存上限 / 峰值 / `oom_kill`，但宿主级 OOM（未设容器 limit）不保证被 cgroup 捕获；sandbox / github-action 执行器未接入采集；容器 `executeRun` 抛错时监控快照丢弃；Redis 同步降级时 HTTP 进程也会执行安装，启动探测无法预知。
  - **待评估点**：① 宿主 OOM 与 `journalctl -k` / `dmesg` 的关联口径；② sandbox / action 执行器的资源面；③ 异常路径快照保留；④ 同步降级信号接入启动 / 运行提示。
  - **触发条件**：OOM 再次发生且 cgroup 标记无法解释；或 sandbox / action 成为主执行路径。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`ScanResult` 修复结果不回写（converged / success 状态缺失）（待评估，P2 🛠️）** —— 现象：per-alert 模型写入路径固定 `not-tried`，修复结果不回写，导致按明细聚合的通知（`security_high` / `weekly_digest`）无法剔除本地已满足告警，周报只能按 `RunSummary.alertsConverged` 单列披露（M47.5 审计 R1 实证）。**待评估点**：① 是否在 reconcile / 收尾链路回写 `fixStatus`（success / converged / failed）；② 回写后的历史数据兼容与迁移；③ 对告警列表「未修复」口径的影响。
- **周报投递的重试与窗口锁语义（待评估，P3 🚀）** —— 现象：M47.5 同进程同周只尝试一次，部分收件人 `failed` 时本周内不重试；`skipped_no_recipient` 保留本周锁（避免 15 分钟级日志噪声），窗口内才开启个人开关需等下周。**待评估点**：① 按用户失败重试（不改逐用户键）；② 无收件人时是否降低检查频率或只在配置变更时重试；③ 崩溃遗留 `sending` 的回收前置。
- **`/settings` 与通知页 dark 视觉覆盖（待评估，P3 🧪）** —— 现象：M47.5 只覆盖 `/notifications` light 基线，`/settings` 无视觉基线（改由 e2e 覆盖组织开启后个人开关可配置）；周汇总开关与提示文案的 dark 形态无像素守卫。
- **alerts 原始列表的排序并列兜底（待评估，P2 🛠️）** —— 背景（2026-10-24）：CI `Visual Regression` 出现 flaky（`alerts 运行抽屉浮层（light）` 3284 px 差异，同 commit 重跑即绿）。根因：`GET /api/alerts` 的「原始列表」视图只按 `result.createdAt DESC` 排序、**无并列兜底**，而 `ScanResult.createdAt` 缺省为插入时刻 → 同批次插入落在同一毫秒形成并列 → 行序随数据库返回顺序漂移。视觉侧已用「fixtures 逐条钉死 `createdAt`」消除（见 `apps/platform/tests/visual/helpers/fixtures.ts` 与 [视觉 README](../../apps/platform/tests/visual/README.md)）；e2e 的原始列表用例经 `page.route` mock 单条告警，不依赖真实 tie 序，故无同类风险。
  - **待评估点**：默认排序是否补确定性兜底（`addOrderBy('result.id','DESC')` 或 `(createdAt, id)` 组合）；对现有视觉基线行序与未来分页 / 导出结果集边界的影响。
  - **触发条件**：真实告警同毫秒插入被报告顺序抖动；或列表分页 / 导出功能引入（届时并列顺序影响结果集边界）。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **通知严重级别术语与阈值命名收敛（待评估，P2 🎨）** —— 现象（2026-10-24 用户反馈 + 截图）：通知页把 `critical` / `high` 译为「严重」/「高危」且同页并列，用户无法从字面判断哪个更危险；类别名「高危告警」看起来只覆盖 `high`，实际开关同时管 `critical`（关掉后 `apps/platform/server/services/notification/recipients.ts` 直接返回空收件人）；阈值标签「高危阈值」把 `critical` 也包含在内（选项「严重 + 高危」/「仅严重」，见 [zh-CN.json](../../apps/platform/i18n/locales/zh-CN.json) 与 [en-US.json](../../apps/platform/i18n/locales/en-US.json) 的 `High-risk threshold`），与同仓扫描侧口径冲突——`apps/platform/app/utils/scan-options.ts` 已明确把 Critical / High / Medium 定为**专有名词不走 i18n**，扫描配置页又写作「严重级别阈值」。邮件侧同样不统一：周报标题只写「N 个高危告警未修复」，正文才分列「严重 x / 高危 y」（`apps/platform/server/services/notification/business-templates.ts`）。
  - **待评估点**：① 术语形态（直接保留 `Critical` / `High` 原文，还是「严重（critical）」括号注释，还是纯中文 + 图标 / 色阶辅助）；② 阈值字段改名（「风险等级阈值」/ 对齐扫描页「严重级别阈值」，同时调整 `severityThreshold` 的 UI 文案而非枚举值）；③ 选项文案（「严重及以上（critical + high）」/「仅严重（critical）」）；④ 统一范围（通知页 / 邮件标题与正文 / 周报 / 投递记录类别列 / 扫描页）；⑤ en-US 的 `High-risk alerts` / `High-risk threshold` 同步，避免中英各一套语义。
  - **触发条件**：已由用户反馈触发；或下一次文案 / 国际化批次。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **critical 告警必选不可关闭（待评估，P1 🛠️）** —— 现象（2026-10-24 用户反馈）：当前 `severityThreshold` 只决定 `high` 是否纳入（`critical` 恒在集合内，见 `apps/platform/server/services/notification/high-risk.ts`），但类别开关 `categories.securityHigh` 是 `critical` + `high` 共用的单一开关，关闭后组织与个人的安全类邮件全部停发（`resolveNotificationRecipients` 在类别关闭时返回空数组）；即「`critical` 必定发送」目前不成立，只有「平台自身问题」是真正的必选类别。用户预期 `critical` 与「平台自身问题」同级、不可关闭。
  - **已决策（2026-10-24，用户）**：`critical` 豁免类别开关（`securityHigh` 关闭时 `critical` 仍发送），**保留每小时上限**。
  - **待评估点**：① 拆分语义（新增必选的 `securityCritical` + 可选的 `securityHigh`）还是保留单开关但让 `critical` 走独立通道；② 阈值枚举如何演进（`critical | high` 改为「是否附加 high」的布尔或新增枚举）；③ 个人偏好是否允许关闭 `critical`（建议不允许，并与组织开关一致）；④ 存量迁移（现网 `securityHigh=false` 的组织是否自动改用新的 critical 通道 → 会新增邮件，需在发布说明中披露）；⑤ 每小时上限的计数口径——现为 channel 级共享桶（`delivery.ts` 统计近一小时全部非周报 `sent` 行），`critical` 若与其他类别共用同一额度会被 run 突发挤掉、与「必发」冲突，需在「单独计数但沿用同一数值上限」与「沿用共享桶」之间定口径；⑥ 冷却与指纹去重保持现状（不随类别开关豁免一起放开，除非另有决策）；⑦ UI 禁用态与「必选，不可关闭」说明是否对齐平台自身问题那一行。
  - **触发条件**：用户确认按「`critical` 必选」实现；或出现 `critical` 告警因类别关闭而漏发的实例。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

**2026-10-27 决策**：本地日志已上收 M49 追加临时待办（不占编号）；Sentry 官方 SaaS；Axiom 后续；其余 1.0 后。P 标签仅表优先级，新增 P1 未纳入 1.0 分档。

- **平台 Sentry 错误 / 性能 / 日志接入（P1 🛠️，官方 SaaS，1.0 后）** —— 详见 [评估](../research/2026-10-27-third-party-observability-evaluation.md)。**目标**：官方 Sentry SaaS 补齐错误、性能（transaction + LCP / CLS / INP）与 warn/error 日志，无 DSN 零出网。**范围**：`@sentry/nuxt`、client/server config、`sourcemaps.disable`、`shared/utils/sanitize.ts` 抽取、≤10 处生命周期日志、脱敏。**验收**：① 无 DSN 零出网；② 浏览器 / API 500 / worker 异常带 release / commit / route；③ token / Cookie / URL / OAuth `code`·`state` 不进入事件与日志；④ `dataCollection` 关闭 URL query / GraphQL；⑤ Web Vitals 与采样率 env 可调；⑥ sourcemaps 默认关闭；⑦ 全量门禁通过。**不做**：Replay、source map 上传、CLI / Action 遥测、Umami / Clarity / GA / 百度、consoleLoggingIntegration。**依赖**：SaaS 项目与 DSN；Nuxt 4.6 兼容性 D 阶段验证。**交付物**：4-6 commits / 10-15 files / 500-800 行。**风险**：采集面宽 → 显式关闭 + 脱敏。

- **Axiom 远程日志聚合（P2 🛠️，1.0 后）** —— 详见 [评估](../research/2026-10-27-third-party-observability-evaluation.md)。**目标**：本地日志统一后按需把 warn/error 与关键事件推到 Axiom。**范围**：`@axiomhq/winston`、动态 import、Axiom env、异常转发、runId / jobId、脱敏单测。**验收**：① 未配置零出网；② 配置后可按 runId / jobId 检索；③ 不重复推送 `MemoryLogger`；④ 脱敏通过。**不做**：不重做本地日志；不迁移全部 console。**依赖**：本地日志统一完成；Axiom 账号。**交付物**：3-5 commits / 8-12 files / 300-500 行。**风险**：成本 → 只推 warn/error；ESM → 动态 import。

- **平台健康检查与外部 uptime 接入（P2 🛠️，1.0 后）** —— 详见 [评估](../research/2026-10-27-third-party-observability-evaluation.md)。**目标**：进程死亡 / 容器未启动 / DB 不可用可发现。**范围**：`Dockerfile` HEALTHCHECK、`deployment.md` 探针口径、鉴权 `/api/health/details`。**验收**：① `docker inspect` healthy；② liveness 200 / readiness 异常非 200；③ 文档可复现；④ 公开端点无新增敏感字段。**不做**：不暴露 DB / Redis 细节；不绑定商业服务；不改运行模型。**交付物**：2-3 commits / 5-8 files / 150-250 行。**风险**：误判 → start-period + 重试；信息面 → 详情鉴权。

### 待上收候选（评估完成，等待用户决策）

> 本节为「评估完成、等待用户决策」候选的暂存区；候选**不含 `M\d+` 阶段编号**（[规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement)）。

- **`git-signing.ts` 更名为 `git-isolation.ts`（待评估）**（P3，🛡️ 治理）—— 背景：该模块已承载「签名 + hooks」双语义（4 个隔离常量），但文件名仍只表达「签名」。
  - **本批已闭环的部分**：决策点「是否在 `docs/standards/git.md §3.8` 扩展 hooks 隔离子节」已于 2026-10-13 M43.5 落地——§3.8 改为「签名 + hooks，commit / push 双向隔离」单表 + 4 常量清单 + push 侧 `--no-verify` 口径；`code-quality-checklist` 对应矩阵行同步扩展。
  - **待评估点**：是否将 `packages/engine/src/github/git-signing.ts` 更名为 `git-isolation.ts` 并同步 `github/index.ts` re-export（公开 API）、平台侧 import、测试与 `git.md §3.8` 的路径引用。**未纳入 M43.5** 的理由：触及公开 API re-export 与平台侧多处 import，宜单独批次以保持改动面可控。
  - **触发条件**：下次改动该模块 / 公开 API 面时；或治理批次收敛模块命名时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **孤儿清理终态被迟到 worker 覆盖（待评估）**（P2 🛡️ 技术债）—— 现象：清理侧以「条件更新（WHERE status IN pending/running）」把 run 置 `failed` 后，仍在执行的 worker 若随后完成，`runScanInternal` 的最终 `save` 会整行写回，可能把终态覆盖为 `completed` / `failed`；当前以 active 锁过期 + job remove 降低概率，未根治。**关联**：[队列僵尸任务终结与去重键释放设计 §9](../design/governance/queue-stale-recovery.md#9-边界与残余风险)。
  - **待评估点**：① 编排层最终写库改为条件更新（仅当库中仍为 `pending` / `running`）；② 或在 `save` 前重读状态并短路；③ 与 `reuse` / `force-fail` 路径的兼容（复用路径需要重置终态字段，不能简单短路）。
  - **触发条件**：再次出现清理后终态被覆盖的实例；或下一次队列可靠性批次。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **批次级「继续执行未完成项」入口（待评估）**（P2 🎨 用户体验）—— 背景：2026-10-18 用户报告宿主机重启导致批量任务中断，明确希望「至少给用户一个选项：直接结束还是继续执行」；同批已落地 P0（僵尸任务终结 + 去重键释放 + 触发自愈 + worker 慢重试），用户裁定本入口作为后续批次，形态选**批次级继续执行**（否决「新状态 + 启动弹窗」与「仅保留单条重试」）。
  - **待评估点**：① 入口落点（失败批次行内按钮 vs 展开详情）与二次确认文案；② 重启范围（仅 `orphan_run` / transient 且未完成子项 vs 全部失败子项）；③ 承载形态（复用 `executeBatchRun` 创建新 BatchRun 保留审计链 vs 复用原批次）；④ 与现有单条 `POST /api/runs/[id]/retry` 的关系（是否抽取共享「未完成项」判定）。
  - **触发条件**：用户要求该交互；或再次出现宿主机重启后的批量恢复诉求。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

### 延期 / 暂缓项

- **T705 生产级部署**（PostgreSQL + Helm；Sentry 已拆出为独立候选，见上文）—— 2026-08-12 用户指示暂缓排期
- **自托管 Umami 流量统计**（P3 🎨，1.0 后暂缓）—— 管理台用户量小，Sentry 路由 transaction 已覆盖页面访问与性能；流量来源 / 留存价值不足以抵消额外服务与脚本成本。触发：需要产品级使用分析且 Sentry 数据不足，或平台转为多租户 SaaS。详见 [评估](../research/2026-10-27-third-party-observability-evaluation.md)。
- **T703 跨平台 Git**（GitLab + Bitbucket）—— 2026-08-12 用户指示暂缓排期
- **C30 Publish Docker build job 失败排查** —— 2026-08-18 用户决策暂缓（双平台构建 23m 2s 成功证明当前 docker.yml 可稳定工作）；恢复条件：① master 分支 push 频率显著提升；② 镜像实际发布成为强需求（v1.0.0 正式发布前）；③ 用户明确恢复
- **caomei-ui 0.x → 1.0 升级回归** —— 库处于 0.x（平台当前 `0.6.0`，2026-10-11 由 dependabot 升级、2026-10-12 完成升级回归，见 [caomei-ui-migration.md §15.15](../design/governance/caomei-ui-migration.md#1515-caomei-ui-060-升级回归实证插队热修2026-10-12)）。**剩余观察**：`1.0.0` 发布后的正式升级回归与「平台需跟进新组件能力」「用户明确恢复」两条触发条件。届时按 M31 迁移期实证索引（[caomei-ui-migration.md §15](../design/governance/caomei-ui-migration.md)）做回归；**升级回归的像素兜底已就位**（视觉回归基线 `apps/platform/tests/visual/`，覆盖 alerts / repos / pr-checks / dialog-import-repos / login，口径见 [测试规范 §6.7](../standards/testing.md)）
- **ScanResult 数据层去重（upsert 唯一索引）** —— 决策暂缓：应用层去重（fingerprint + occurrenceCount / firstSeenAt / lastSeenAt / affectedRunIds）已实施且满足当前业务需求；恢复条件：出现"fix 复用同一 `scan_run_id` 跨次刷新"或"历史 fixStatus 跨次保留"需求时迁移到数据层 upsert

### 远期登记 / 未排期增强候选

按主题分组：

#### MCP 能力

- **C37** 语言偏好多设备同步（当前仅单一设备语言偏好；多设备切换需重新设置；触发：用户实测反馈多设备用户；前置：服务端 API i18n 基础已就绪）

#### 多组织 / 多租户

- **D1** repo_admin + RepositoryAccess（实现仓库级 admin 角色区别于全局 admin；当前 owner 角色对仓库控制粒度不足；关联：C22 GitHub App 验证身份）
- **D3** 多租户组织体系（支持多个组织/org 共存；当前 single-org 模型限制 org 切换；前置：D1 仓库级权限；触发：org 场景用户痛点）
- **SAML 2.0 SSO**（D2 username 等待 SAML SSO 上后再决定 username 模型；当前 better-auth OIDC 优先）

#### 用户管理

- **D8** remove-user 关联资源检查（无 user→resource 关联时暂不需要；前置：先有 D1 资源关联表）

#### PR 管理

- **B2** 固定分支单线设计（独立平台部署后修复频率上升，需要固定修复分支如 `dependfix/auto-fix` 避免频繁向 master 提交 PR；触发：v1.0.0 后 M12 平台 UX 修复链路上线；关联：T210 指纹方案整合复用/重建策略 + force push 语义）
- **平台侧同告警尝试计数**（平台交付链固定 `fix` 模式 + `platform-delivery` 建 PR，不产出也不读取 PR 正文尝试标记 → 平台建的 dependfix PR 关闭后不消耗尝试额度；CLI / Action 侧已闭环，平台侧需先允许平台执行 fix-and-pr 或改用独立计数载体。当前计数偏小属 fail-open，不会误跳过）

#### Code Scanning 规则体系

- **C15 Code Scanning B 类规则真实仓库样本核对（第二阶段）** —— 第一阶段（`sample-collector.mjs` 采集脚本 + 32 种子仓库跨 5 语言 fixture 占位 + 报告框架 `docs/research/code-scanning-b-class-samples.md`）；**剩余未闭环**：实际 GitHub API 样本采集 + 按需规则分级修正（`go/*` / `ruby/*` 补 `SUGGESTED_RULES`）。
  - **恢复条件**：CI / staging 环境具备 `GITHUB_TOKEN` 时执行 `node packages/engine/src/code-scanning/scripts/sample-collector.mjs --output=real-samples.json`，再据采集结果修正规则分级。
  - **不做**：不改 A/B/C 分层结构；不在无真实样本时臆测规则 id 变体。
  - **关联**：[docs/research/code-scanning-b-class-samples.md](../research/code-scanning-b-class-samples.md)（报告框架）
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 M\d+ 阶段编号**：等待用户明确决策启动

#### 网络优化

- **C68 Git 代理 / 镜像方案** —— 2026-09-04 实测发现：部分仓库（momei 25MB / caomei-auth 9MB）clone 持续超时（120s+），而大仓库（rss-impact-web 215MB）反而 12s 完成。根因：服务器到 GitHub CDN 网络质量差（实测 GitHub 下载速度 14KB/s vs 通用网络 629KB/s）。当前临时方案（超时 300s + 重试 3 次 + partial clone `--filter=blob:none`）可缓解但不治本。**只有代理才能根本解决网络问题**（tarball API 仍走 GitHub 域名，同样受限）。候选方案：
  - **方案 A：HTTP 代理** —— 配置 `http.proxy` / `https.proxy` 指向代理服务器；需运维提供代理基础设施
  - **方案 B：GitHub 镜像** —— 使用 GitHub Enterprise 镜像或自建 Git 镜像（如 Gitea/GitLab mirror）
  - **方案 C：Git 缓存代理** —— 部署 git-proxy 或 gitcache 缓存已 clone 的仓库，后续请求走缓存
  - **触发条件**：① 用户部署环境有可用代理；② clone 超时成为频繁阻塞问题；③ 运维提供镜像基础设施
  - **验收**：momei / caomei-auth clone 耗时 < 30s；无 TLS 错误；超时率 < 5%

#### 工作流

- **T905** git worktree 并行开发预案（触发条件：多 agent 并行开发成为常态；当前单 agent 工作流无需启用）

## 待人工验收（真实环境，随可用性推进）

> 以下条目为需真实环境（外部凭据 / 真实 Redis / staging 等）的验证任务，保留随可用性推进。

### T701 真实凭据 3 项

平台 OAuth / OIDC / 凭据配置相关真实环境验证：

- 真实 GitHub / Google OAuth 登录闭环（需 OAuth App 凭据）
- 真实 IdP OIDC 登录闭环（需 RFC 9207 iss 回显支持）
- 构建期配置凭据后按钮显示路径实测

### T702 HTTP 层状态流转

扫描 run 状态对外接口（pending → running → completed）真实环境验证：

- 状态流转时间序列正确性（pending → running → completed 端到端）
- 前端轮询体验与 stale state 处理（需后台服务 / staging 或 CI redis service）

### PR Check 真实 polling（总开关启用后）

- `ACTION_STATUS_MONITOR_ENABLED=true` 下的真实 polling 链路（手动触发端点 + 定时计划触发）需真实 GitHub 凭据与网络：
  验证「按 credential 聚合 → Octokit → 轮询写入 PRCheck」端到端；单次仓库上限与截断披露行为一并观察。

### T704 async 定时触发

定时任务真实环境验证：

- 真实 Redis >= 5 环境下 `TEMP_REDIS_INTEGRATION=true` 跑 BullMQ 集成测试
- staging / 后台服务下的调度轮询体验与 stale state 处理验证

### 发布管线收尾（P3）

- `release:auto-version` 完整流程待 schedule 启用后首个 cron 裁决
- main 副作用路径测试观察项

## 已知边界与 known-issue

### SQLite 单文件脆弱性 + TypeORM synchronize 风险（持续观察）

- **背景**：2026-09-01 `apps/platform/data/dependfix.sqlite` 业务数据被清空事故（详见 [经验归档 §五十](../design/governance/experience-archive-§49-§69-recent-investigation.md#五十sqlite-数据库业务数据被清空开发环境不可恢复事故2026-09-01)）。代码内无清空路径，最可能清空来源在代码外部（shell / CI / 运维）。
- **防御现状**：事故防御加固已完成（启动期备份 / db-restore / db-doctor / synchronize + migrationsRun 双 opt-in / e2e fixtures 双门控），规范见下方"规范挂接"。
- **持续观察项**：
  - TypeORM 1.x 升级 / 替换为 0.3.x（1.x 已停止维护）—— 当前无明确上收时机，待后续评估
  - PostgreSQL 多写者迁移 —— 当前 single-org 模型限制（依赖 D3 多租户组织体系上线），D3 未上收
  - better-sqlite3 WAL 模式启用 + auto-checkpoint 调整（减少断电时数据丢失风险）—— 已落地 `journal_mode=WAL`，但 better-sqlite3 库升级路径未评估
  - SQLite 文件 inode 监控（`fs.watch` 检测 .sqlite 文件被外部 rm / rename 触发紧急备份）—— 与启动期备份互补，可作后续加固
- **规范挂接**：[工程实践判例 EP-16](../design/governance/engineering-practice-notes.md) + [EP-17](../design/governance/engineering-practice-notes.md) + [platform.md §3.6](../standards/platform.md) + [§3.7](../standards/platform.md) + [security.md §2.1](../standards/security.md)

### E2E global-setup 串行场景 ECONNRESET 根因（持续观察）

- **已落地（部分闭环）**：~~候选 ②（Nitro h3 async generator）~~ 已 M24.2 commit `bbb8f30` 判定非根因；~~候选 ③（SQLite WAL + `busy_timeout`）~~ 已 M23.1 commit `2ffaa45` 治本落地；候选 ④（fixtures API 节流）为 M24.2 commit `bbb8f30` 登记的经验性 follow-up；helper 层兜底 `maxRetries: 2` 已 M22.7 commit `f617b56` 落地。
- **剩余未闭环**：候选 ① better-auth 1.7 transaction 关闭时序 —— 诊断基础设施已 M27.5 commit `b252f93` 落地（`AUTH_TRACE=1` / `E2E_TEST=true` 双开关），待 CI 复现一次确认是否仍存在 ECONNRESET。
- **触发条件**：CI E2E job 再次出现 global-setup 末尾 `DELETE /api/e2e/fixtures` → `ECONNRESET` 时，开启 `AUTH_TRACE=1` 跑一次定位；如复现 fixture 并发问题按经验性模板 `apps/platform/server/utils/fixtures-throttle.ts` 加 100ms 节流（见 [platform.md §3.7.1](../standards/platform.md#371-fixtures-api-无节流默认--节流触发条件)）。

### tsdown hash:false 下 entry 与共享 chunk 文件名冲突（持续观察）

- **背景**：2026-09-28 修复 engine 多 entry（`index` + `auth`）构建产物的 dts 入口错位——`hash: false` 时 entry 与共享 dts chunk 争用 `index.d.mts`，入口声明被挤出 `index2.d.mts`，而 `packages/engine/package.json#types` 指向 `index.d.mts`，导致 `apps/platform` 解析不到 engine 导出（TS2305）。
- **已落地**：engine `tsdown.config.ts` 用 `outputOptions.chunkFileNames` 把 chunk 统一隔离到 `chunks/` 子目录，entry 名保持稳定（chunk 名解析用 `chunk.name.slice(0, -2)` 而非占位符，规避 tsdown 升级回归）。
- **持续观察项**：`packages/core` / `packages/cli` / `packages/mcp` 当前无名为 `index` 的共享 chunk（dist 无 `index2` 冲突），故未做预防性改动；若未来某包出现「多 entry 共享 dts 声明」形成名为 `index` 的共享 chunk，需同样加入 `outputOptions` chunk 隔离。
- **触发条件**：任一 `packages/*` 构建后 `dist/` 出现 `index2.d.mts` / `index2.mjs`，或下游对该包类型解析报 TS2305。

### apps/platform `.output` 不随根构建脚本重建（操作提醒）

- **背景**：根构建脚本 `pnpm -r --filter "./packages/*" build` 不含 `apps/platform`，`.output` 需单独构建。
- **影响**：类型侧由 `nuxt typecheck` 覆盖；但涉及 `packages/*/dist`（如 engine chunk 结构）变更后，容器 / 运行时冒烟前需重建 `apps/platform/.output`，否则可能引用旧产物。
- **触发条件**：① 需要容器 / 运行时冒烟验证依赖 `packages/*/dist` 的变更时；② 跑 `apps/platform` e2e 或**视觉回归**（`pnpm --filter @dependfix/platform test:visual`，M32.5）前——两者都跑 `.output` 产物，源码改动不重建则验证的是旧产物（假绿；M32.1 / M32.5 均实证）。

### 全量 vitest 偶发失败（单次未复现，持续观察）

- **背景**：2026-10-14 M44.4 批次② 的一次全量 `pnpm test` 出现失败，但输出被调用方截断、失败明细未捕获；随后同一工作区（仅文档与注释变更）连续多次复跑均全绿，未能复现（按 [AI 协作规范 §4.7](../standards/ai-collaboration.md) 阶段 3 登记根因观察项）。
- **持续观察项**：① 再次出现时须捕获完整失败明细后定位（首要假设：vitest worker 并发 / 资源竞争；其次：既有时序敏感用例）；② 长期不复现则维持观察。
- **触发条件**：再次出现同形失败（本地或 CI）。

### 平台 e2e 偶发等待超时（scan-config / repos-crud，持续观察）

- **背景**：2026-10-26 M49.2a 依赖升级后连续两次运行 `pnpm --filter @dependfix/platform test:e2e`，`scan-config.e2e.test.ts` 的「扫描偏好：记住上次选择（重开 + 刷新生效）」均为 1 flaky（等待仓库行可见超时，重试通过）。M49.2b 升级 nuxt 4.6.2 后：第一轮除 scan-config 外新增 1 例 `repos-crud.e2e.test.ts`「删除仓库：列表移除」flaky（重试通过）；第二轮仅 scan-config flaky，其余 204 例全绿。
- **持续观察项**：① scan-config 超时点在 `openScanConfig` 的 `.caomei-data-table__row` 可见性（15s）；② repos-crud 为删除后列表刷新时序。首要假设均为 SSR hydration / 行渲染时序，其次为上一轮 e2e 数据库残留导致列表排序漂移；再次出现时保留 `test-results/` 的 error-context 与截图后定位。
- **触发条件**：运行 `apps/platform` e2e（`test:e2e`）时再次命中上述用例。

### 依赖审计豁免复核（node-forge，持续观察）

- **背景**：2026-10-05 weekly regression 因 `security:audit-deps` 阻断失败——node-forge ≤ 1.4.0（GHSA-86w9-cpqp-85rv）与 braces ≤ 3.0.3（GHSA-vfj7-8cjw-p6xm）为 high，但 advisory 声明的 patched 版本（1.4.1 / 3.0.4）**尚未发布**，overrides / `pnpm update` 无法解析。经用户决策（方案 A，调整为配置文件实现）在 [pnpm-workspace.yaml](../../pnpm-workspace.yaml) `audit.ignore` 显式豁免。
- **机制与复核**：以 `pnpm-workspace.yaml` `audit.ignore` 显式豁免（只过滤列表内编号，未列入的新漏洞仍使 `pnpm audit` exit 1）；机制、禁止项与复核条件以 [security.md §5.7](../standards/security.md#57-无可用修复版本漏洞的审计豁免auditignore2026-10-05) 为唯一权威，本条不重复。
- **复核条件**：node-forge 发布 > 1.4.0 后，移除 `pnpm-workspace.yaml` 对应条目并复跑 `pnpm audit --prod --audit-level=moderate --registry=https://registry.npmjs.org`。
- **复核记录（2026-10-17）**：周回归 `38929908272` 新增 3 critical / 5 high（`simple-git` ×2 / `@simple-git/argv-parser` / `shell-quote` / `seroval`，均经 `apps/platform > nuxt > @nuxt/devtools|@nuxt/vite-builder`）——patched 版本均已发布，按「升级优先」用锁文件提升闭合（`@nuxt/devtools` 3.4.3 / `seroval` 1.6.9 / `shell-quote` 1.12.0），**未新增豁免条目**；本清单两条仍按上述复核条件保持活跃。
- **复核记录（2026-10-26，M49.2a）**：braces 条目对应 advisory `GHSA-vfj7-8cjw-p6xm` 已于 2026-10-23 **撤回**（`withdrawn_at`），advisory 撤回后该路径不再有有效漏洞 → 移除 `audit.ignore` 条目与 §5.7 行；node-forge 最新版仍为 1.4.0（`npm view node-forge version`），继续豁免。
- **转正记录（2026-10-27，M49.3）**：prod 审计已转阻断（`--ignore-registry-errors --registry=https://registry.npmjs.org`）；`audit.ignore` 保留 node-forge（latest 1.4.0，仍无修复版本），§5.6 clean 判据改为阻断步骤 exit 0 且日志含审计结果行（ignored 不参与阻断）。
- **触发条件**：每周回归 / 依赖升级 / 上游发布修复版本时复查。
- **可选增强**：以调度任务自动比对 `npm view node-forge version` 探测上游修复发布，避免豁免长期挂账（暂未实现）。

---

## 文档位置速查

| 内容类型 | 位置 |
|:--|:--|
| 当前阶段活跃任务 | **M49：0.6.0 发版清障**（2026-10-25 用户决策；见 [todo.md §M49](todo.md#m49-0-6-0-发版清障-2026-10-25-用户决策)）；插队容量治理见 [planning.md §3.1.1](../standards/planning.md#_3-1-1-插队后的阶段容量再平衡-hard-requirement-2026-10-19) |
| 下一阶段（已授权，待规划） | **1.0 发布门槛收口**（E → F1 → F2 → G；台账见 [release-1.0-readiness.md](../design/governance/release-1.0-readiness.md)） |
| 已完成阶段归档 | [todo-archive.md](todo-archive.md)（阶段索引 + [archive/](archive/) 分片） |
| 里程碑与阶段交付 | [roadmap.md](roadmap.md)（M0-M48 已归档；M49 进行中） |
| 长期主线 / 候选 / 待人工验收 / 已知边界 | 本文档（按四象限结构） |
| 历史归档索引 | [archive/index.md](archive/index.md) |
