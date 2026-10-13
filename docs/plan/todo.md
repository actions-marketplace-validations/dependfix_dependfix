# 当前阶段待办

> 本文件**仅**登记当前阶段活跃待办；已闭环阶段归档于 [todo-archive.md](todo-archive.md)；未排期 / 延期 / 远期 / 长期主线 / 已知边界登记于 [backlog.md](backlog.md)。

---

## 文档位置速查

| 内容类型 | 位置 |
|:--|:--|
| 当前阶段任务 | **M43 进行中**——PR Check 能力补强 + 运行时可靠性与工程治理（6 原子条目，见下方 §M43） |
| 下一阶段（未授权） | 无——本阶段闭环后按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 评估 [backlog.md](backlog.md) 候选池后由用户决策 |
| 已完成阶段归档 | [todo-archive.md](todo-archive.md)（主窗口 + [archive/](archive/) 分片；M0-M42 全部已归档） |
| 未排期 / 延期 / 远期 / 长期主线 / 已知边界 | [backlog.md](backlog.md) |
| 里程碑与阶段交付 | [roadmap.md](roadmap.md)（M0-M42 已归档 + M43 进行中） |
| 历史归档索引 | [archive/index.md](archive/index.md) |

---

## M43: PR Check 能力补强 + 运行时可靠性与工程治理（2026-10-12 用户决策方案 A）

> **阶段定位**：承接 M42 归档后的「平台能力补强 + 运行时可靠性」两条线——**PR Check 能力补强**（列表行内仓库可辨识度 + 从单一 `Test` check 扩展为 GitHub 三源构建 / 部署信号聚合）与**运行时可靠性与工程治理**（容器内 `pnpm install` 环境性失败的可观测性与归因口径 + 扫描触发去重合并的前端感知 + git 非仓库 / push 钩子边界收口 + 工程脚本加固）。
>
> **前置插队热修（不占阶段编号）**：caomei-ui `0.6.0` 升级回归 —— dependabot 仅改版本号与 lockfile → master `Test` job 的 `E2E` + `Visual Regression` 阻塞；2026-10-12 经用户授权按 [规划规范 §3.1 插队例外清单第 3 类](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement)（CI 主链路阻塞）处置。落点：[caomei-ui-migration.md §15.15](../design/governance/caomei-ui-migration.md#1515-caomei-ui-060-升级回归实证插队热修2026-10-12) + [archive/index.md §4 / §5](archive/index.md)（热修批次行）。
>
> **类型平衡**：🎨 2（M43.1 / M43.4）+ 🚀 1（M43.2）+ 🛡️ 2（M43.3 / M43.5）+ 🛠️ 1（M43.6）= 6 原子；**🧪 独立条目缺口显式标注**（测试随各条目内嵌，符合 [规划规范 §1.1](../standards/planning.md#11-硬性约束) 类型平衡建议的显式标注惯例）。
>
> **§3.4 三重交叉核验**：0 项重复评估——① `todo-archive.md` + `archive/todo-archive-phases-*.md` 全量扫描（关键词 `pr-checks` / `仓库标识` / `构建信号` / `deployment` / `classifyLockfileFailure` / `hasGitChanges` / `pre-push` / `playwright-report` / `distill-wisdom`）零命中已闭环修复（唯一命中为 M24 PR Check MVP 段，属「单 `Test` check」MVP，非本批多源扩展）；② `git log` 核验无对应修复 commit（`pr-checks.vue` 最近为 `4aa1f7b` 手动触发入口，无仓库列；`services/monitor/**` 无 Deployments / Commit Statuses 采集；`fixers/pnpm/index.ts` 无 signal 上报；`pr-creator.ts` push 侧仅签名隔离）；③ 代码 anchor 逐项实测未闭环（`pr-checks.vue:115-120` 6 列无仓库列 + `pr-checks/index.get.ts:33` 仅 `repositoryId`；`polling-source.ts` 仅 `checks.listForRef` 单 check 名；`fixers/pnpm/index.ts:143-145` `execRepair` 丢弃 exit code / signal；`use-fix-now.ts:65-84` 不消费 `merged`；`helpers.ts:669` `hasGitChanges` 非仓库恒 `true`、`pr-creator.ts:244` `pushBranch` 无 hooks 隔离；`check-orphan-ids.mjs:50` + `md-walk.mjs:42` 排除面缺 `playwright-report` / `test-results`、`distill-wisdom.mjs:145` 正则不容忍「日期+类型」形态）。
>
> **审计 depth 预告**：M43.2 涉及数据模型变更 / migration / 公开 API / 外部调用（GitHub 三源）→ `standard`（建议 2 分区并发，代码 + 文档分区）；M43.3 涉及失败归因口径与展示映射 → `standard`；M43.5 涉及 engine git 行为与平台 push 路径 → `standard`；M43.1 / M43.4 前端为主 → `quick`；M43.6 脚本加固（含单测）→ `quick`。
>
> **建议顺序**：M43.1（前端先行，避免 M43.2 改表两次）→ M43.2（大项，须先定稿子任务拆分）→ M43.3（engine 归因）→ M43.4（前端感知）→ M43.5（git 边界）→ M43.6（脚本加固）。
>
> **条目容量**：6 原子符合 [规划规范 §1.1](../standards/planning.md#11-硬性约束) 的 5-6 项上限；**M43.2 预估 > 10 文件 / > 800 行，须按 M43.2a / M43.2b 拆分子任务**（拆分依据登记 M43.2 §交付物），其余条目均未超单条阈值。

### M43.1 [P2 🎨] PR Check 监测列表补齐所属仓库标识（**已闭环** `23ad252` + `9f9b4b2`）

- **目标**：让 PR Check 监测列表在「全部仓库」视图下行内可辨识 PR 归属，消除跨仓库 PR 编号重号时「只能靠逐个切换筛选器辨认」的不可辨识问题。
- **优先级**：P2
- **范围**：`apps/platform/app/pages/pr-checks.vue`（列定义 + 单元插槽 + 截断样式）+ `apps/platform/server/api/pr-checks/index.get.ts`（视图层 join，**D 阶段定稿：服务端 join**）+ i18n ×2（启用闲置 `prChecks.colRepository` / `prChecks.repositoryUnknown`）+ 单测 / e2e / 视觉基线。
- **验收标准**：
  - [x] ① **可辨识**：「全部仓库」视图下每行可见所属仓库标识（**D 阶段定稿：独立「仓库」列 `owner/name` 置于 PR 编号列之前**）。
  - [x] ② **回退**：视图字段缺失时回退 `prChecks.repositoryUnknown`，不渲染 `undefined` / 空串（服务端 join 下 `PRCheck.repository` 为 FK 非空 + CASCADE → 该分支不可达，已按测试规范 §6.5 注释登记为防御分支）。
  - [x] ③ **职责边界**：单仓库筛选态下行内标识与既有「仓库」筛选器语义一致、不产生同屏两处仓库信息冲突（列恒显数据、筛选器为控件）。
  - [x] ④ **e2e + 视觉**：跨仓库**同号** PR 并存时行内可区分（逐行绑定仓库标签）+ 长仓库名截断策略生效（`title` 暴露完整值 + 超长值下 `scrollWidth > clientWidth`）+ 视觉基线重建后幂等（复跑零漂移）。
  - [x] ⑤ **门禁**：`pnpm i18n:audit:unused` 中两键已消失（闲置键启用）+ `pnpm run check:i18n` parity 0 + `pnpm typecheck` 0 error。
- **不做什么**：不改 PRCheck 数据模型 / 状态机与 ack 语义；不改 `GET /api/pr-checks` 的筛选 / 分页参数语义（仅新增视图字段）；不引入新的仓库查询端点；不统一 `PR check` / `PR Check` 大小写口径（既有混用，另登记）。
- **依赖**：用户 2026-10-12 反馈（截图实证同屏并存 `#390` / `#2367` / `#2408` / `#2411` / `#2412`，行内无区分依据）；`prChecks.colRepository` / `repositoryUnknown` 为闲置键（`pnpm i18n:audit:unused` 实证，同族键在 `alerts.vue:416` / `env-events.vue:191` 仍在用）；**与 M43.2 同表，宜一并设计以避免两次改表**（本条目先落地仓库标识，M43.2 扩展列时沿用同列口径）。
- **交付物**：预计 2 commits——① 前端列 / 插槽 + 数据映射 + i18n ×2；② e2e + 视觉基线重建。预计 4-6 文件 / 80-150 行。
- **风险与缓解**：**R1 映射缺失回退**——服务端 join 下不可达，登记为防御分支；**R2 与筛选器职责重叠**——AC ③ 显式约束；**R3 列宽挤压（PR 列 + 仓库列）**——截断策略纳入 AC ④（并实测发现列定义宽度不约束非冻结列，改由单元样式承担）。

- **实际交付**：`23ad252` feat(platform)（`pr-checks.vue` 仓库列 + 单元截断样式 + `index.get.ts` 视图 join）+ `9f9b4b2` test(platform)（`index.get.test.ts` 视图字段断言 + `pr-checks.e2e.test.ts` 跨仓库同号 PR 用例 + `pr-checks-light.png` 基线重建）+ 本条登记 commit。**质量门**：lint 0 error（2 条既有 max-lines warning）；typecheck 全包 Done；定向单测 24 passed；定向 e2e 2 passed；视觉套件重建后连跑两遍 11 passed（仅本页基线变更，其余零 churn）；`check:orphan-ids` 0；新增行编号标记扫描 0 命中。**审计**：standard R1 **Pass**（0 blocker / 1 warning：AC ④ 截断策略无验证）→ 修复时**发现并纠正真实实现缺陷**（caomei DataTable 为 `table-layout: auto` 且 `column.width` 不约束非冻结列 → 原 `max-width: 100%` 随内容增长、截断形同虚设；改为单元内固定上限 + 移除死 prop）→ R2 quick **Pass**（0 blocker / 0 warning；RG-S4 注释精度已随手应用）。**残余**：`dialog-select-open-dark.png` 存在约 28px（ratio 0.002%）运行间非确定性差异，远低于 `maxDiffPixels` 预算、套件稳定通过，已还原为已提交基线并留观察（未纳入本批范围）；`prChecks.ack.confirm` / `colLink` / `errors.loadFailed` 仍为闲置键（既有范围外）。

### M43.2 [P2 🚀] PR 构建 / 部署错误多源采集（PR Check 扩展为信号聚合层）（**已闭环** a/b/c 三子任务；D 阶段定稿 = Option A 数据模型 + 全量只报警）

- **目标**：把 PR Check 从单一 `Test` check 扩展为「GitHub 三源（Checks + Commit Statuses + Deployments）」聚合，使目标仓库修复 PR 的完整 CI / 预览部署失败第一时间可见。
- **优先级**：P2
- **范围**：设计依据 [pr-build-deploy-signals.md](../design/governance/pr-build-deploy-signals.md)（已就绪）；`apps/platform/server/services/monitor/polling-source.ts`（「单 check 名过滤」→ 三源聚合 + 归一化 `UnifiedBuildSignal`）+ `monitor/types.ts`（`PRCheckSyncSource` 抽象沿用）+ `monitor/action-status-monitor.ts`（聚合态 → `alertFiring`）+ `apps/platform/server/entities/pr-check.ts`（Option A：增 `signalsJson` / `overallStatus` / `failureSourcesJson` + migration）+ API 视图层 + `apps/platform/app/pages/pr-checks.vue`（多源详情展示）+ nock 夹具单测 + e2e。
- **验收标准**：
  - [x] ① **归一化**：给定 PR head 可列出全部 check runs + commit statuses + deployments 的归一化条目并标注 provider（`check_run.app.slug` / `status.context` 前缀 / `deployment.creator.login`）；nock 夹具覆盖 Actions / Vercel（commit status + deployment）/ Cloudflare（check run）三类。
  - [x] ② **聚合与告警**（落库与状态机 + UI 可见与 ack 收敛均已闭环）：任一时间源失败 → 聚合 `failed` → `alertFiring=true` → UI 可见 + ack 可收敛；回归 success 自动清 ack。
  - [x] ③ **幂等**：同 `headSha` 重跑不重复入库（`(repositoryId, prNumber, headSha)` 唯一约束保持）。
  - [x] ④ **fail-open**：无 Deployments / 无 commit status 的仓库不报错；单源 API 失败不阻断其它源。
  - [x] ⑤ **轮询节流**：只取 `updated_at` 在窗口内的 open PR（a 已落地）+ **终态静默窗口**跳过（M43.2b：`headSha` 未变 + 聚合终态 + `lastPolledAt` 距今 < 30min 才跳过；窗口外重采以捕获同 SHA 重跑 / 迟到部署失败——口径见 [pr-build-deploy-signals.md §3.8](../design/governance/pr-build-deploy-signals.md#38-m432b-落地持久化与-api2026-10-13)）。
  - [x] ⑥ **门禁**：`pnpm typecheck` 0 error + 定向 vitest 通过 + `pnpm run check:i18n` parity 0。
- **不做什么**：不改 engine 本地构建 / 验证逻辑；不新建 GitHub App（沿用现有凭据模型）；不做 webhook（`PRCheckSyncSource` 已注释预留，后续增量）；不做部署失败自动重跑 / 自动修复；**首批不含 provider 原生 API 日志富化**（设计稿 Layer 5，按 D2 裁定为后续增量 / 留 backlog）；不追求「未装 GitHub 集成」的 provider 可见性（显式声明边界，不臆造信号）。
- **依赖**：设计先行稿 [pr-build-deploy-signals.md](../design/governance/pr-build-deploy-signals.md) 已定稿（2026-10-10，含三源官方文档引文核对）；M39.5（`kind` 落库）+ M42.4（手动触发共享 polling 函数）为邻近链路，须保持同源。
- **D 阶段定稿（2026-10-12 用户裁定，设计稿 §5）**：
  - **D1 数据模型 = Option A**：`PRCheck` 增 3 列（`signalsJson` text null / `overallStatus` varchar(16) null / `failureSourcesJson` text null）；`conclusion` **保留为最坏派生态**（现有 API / UI / ack / `alertFiring` 语义不变）；理由：迁移量小（幂等 + 前缀感知 helper 直接复用）+ 与既有 `summaryJson` / `logsJson` 仓库惯例一致。
  - **D3 告警关注集 = 全量只报警不阻断**：任一归一化信号失败（`failure` / `error` / `timed_out` / `action_required`）→ `overallStatus=failed` → `alertFiring=true`，不引入配置面（后续按需引入关注集）。
  - **D4 provider 凭据承载 = 本批不涉及**（首批不含日志富化）。
  - **D2 日志富化 = 不做**（留后续增量 / backlog）。
  - **`overallStatus` 判定口径**（设计稿 §3.3）：存在任一 `failure` / `error` / `timed_out` / `action_required` → `failed`；否则存在非终态 → `pending`；否则 `success`。
- **交付物（拆 3 子任务，各自独立验收 / 审计 / 提交）**：
  - **M43.2a 采集层**（**已闭环** `665fb69` + `6aab820` + `8912cdf` + `f3d9381` + `9a5a489` + `cf96766` + `f95e357` + `1162690` + `a1feab3` + `2790700` + `70f4853`）（预估 4-6 文件 / 250-400 行；**实测 7 文件 / 986 新增行——超预估约 2.5×、超 §1.1 单批 800 行审计阈值**，拆分依据仍成立（a 为采集层最小闭环，无法再切而不产生「已声明未落地」的悬空契约），已按 f3d9381 修复自检项、2ac44bc 补强测试）：`types.ts` 增 `UnifiedBuildSignal` + `PRCheckSnapshot.signals`；新增归一化模块（三源映射 + provider 归因 + 状态映射 + 聚合判定 + 轮询节流纯函数）；`polling-source.ts` 三源采集（check runs + commit statuses + deployments/statuses）；nock 夹具单测覆盖 Actions / Vercel / Cloudflare 三类 + fail-open + 节流 + 形态守卫。
    - **中间态声明（含运行时影响）**：a 落地后 `signals` / `overallStatus` 尚未落库（由 b 消费），但**派生 `conclusion` 已在 a 阶段生效**（`ActionStatusMonitor` 据此推断 `alertFiring` 与自动 ack）→ 即 AC ② 的「任一时间源失败 → `alertFiring=true`」已提前生效，非纯中间态。
    - **实际交付（M43.2a）**：见上列 11 commits（采集层实现 / 单测 / 设计稿细化 / 自检项修复 / 审计收口）。**质量门**：lint 0 error（2 条存量 max-lines warning）；typecheck 全包 Done；monitor 单测 51 passed；platform 全量 1738 passed / 9 skipped；check:docs OK（151/87）；lint:md Done；doc-size 62/13/1/0；orphan-ids 0（669）。**审计**：standard R1 **Pass**（0B / 3W / 5S：JSDoc 旧 API 名 / 中间态声明不完整且 neutral 抑制自动 ack / 单批 986 行超阈值）→ 收口 → R2 quick **Pass**（2S）→ 收口（安装号前缀归一化 + 注释指针）→ R3 quick **Pass**（1 非阻塞 S 已应用）。**自检拦截 2 次**：① `check:orphan-ids` 拦截源码注释中的阶段编号（`f3d9381`）；② 测试 mock 意外复现真实失效模式——分页客户端在响应缺 `total_count` 时把整个响应体当单个元素 → 产出伪信号，已固化为形态守卫 + 用例。**残余**：b 承接项见下（已于 M43.2b 落地）。
    - **b 承接项（由 A 阶段审计登记）**：① 自动 ack 清空判定改按 `overallStatus === 'success'`（当前 `conclusion === 'success'` 在含 `neutral` 信号时不再清零 ack）；② `headSha` 未变且已终态 → 跳过（`isTerminalOverallStatus` 已导出）；③ 窗口外行的 `lastPolledAt` 语义与失败告警收敛路径；④ 落库前对空信号判空（`aggregateOverallStatus([])` 为真空真）。
  - **M43.2b 持久化与 API**（**已闭环** `dc79dbe` + `9d011a8` + `0ac4071` + `bd97b51` + `4a94c8f` + `7110f46` + `4841a3e` + `55d79bb`）（预估 5-8 文件 / 250-400 行；**实测实现批 12 文件 / +695、整批 13 文件 / +713——超预估约 1.8×**，拆分依据仍成立：三列 + 迁移 + 落库 + 视图 + 契约对称属同一「持久化与 API」闭环，再切会产生「已登记未落库」的悬空契约）：`pr-check.ts` 增 3 列 + migration（幂等 + 前缀感知）；`action-status-monitor.ts` 落库 signals / overallStatus / failureSources 并保持幂等与状态机（含上条 4 项承接）；`GET /api/pr-checks` 视图暴露新字段；单测（幂等 / fail-open / 聚合态 → alertFiring / coverage）。
    - **实际交付（M43.2b）**：见上列 8 commits（实体三列 + 迁移 + 监控器落库与终态静默窗口 + 视图单一事实源 + 审计收口）。**质量门**：lint 0 error（2 条存量 warning）；typecheck 全包 Done；定向 126 passed（14 文件）；platform 全量 **1766 passed / 9 skipped**；全仓 `test:coverage` **3947 passed / 10 skipped**，Statements 88.05% / Branches 83% / Functions 87.52% / Lines 88.17%（新增文件：`build-signals.ts` 98.3% / `action-status-monitor.ts` 97.1% / `pr-check-view.ts` 87.5% branches）；check:docs OK（151/87）；lint:md Done；doc-size 62/13/1/0；orphan-ids 0（673）。**审计**：standard R1 **Reject**（blocker RG-B1：新迁移未登记进数据源 `migrations` 数组 → 生产路径永不执行、存量库永久缺列，而全新库 / 单测 / 空库冒烟全绿构成假绿；另 4W / 6S）→ 修复（登记 + **新增登记一致性与存量库真实迁移链两层用例**，并做定向 mutation 标定：移除登记项 → 3 处用例失败）→ R2 quick **Pass**（1 新 W（视图分支未覆盖）+ 3S）→ 收口（URL 超限改置 null / 分支用例 / 命名约定提示 / 规范权威声明）→ R3 quick **Pass**（0B/0W，2 非阻塞 S 已应用）。**残余**：`pr-check-view.ts` 的仓库关系防御分支未覆盖（调用方漏加载关系时命中，已注释登记）；终态静默窗口 30min 为经验取值（单点常量可调）；M43.2c 承接项见下。
  - **M43.2c UI 多源展示**（**已闭环** `f417ab3` + `1d12803` + `fe6e529` + `9bd0667`）（预估 4-6 文件 / 200-350 行；**实测 9 文件 / +524**）：`pr-checks.vue` 多源详情（失败源清单 + 各信号状态 / 链接）+ i18n ×2 + e2e + 视觉基线重建。**承接项（由 M43.2b 审计登记）**：① 列头文案改「最近采集」+ 语义提示 ✅；② 消费 `signals` / `failureSources` / `overallStatus` ✅。
    - **实际交付（M43.2c）**：见上列 4 commits（行展开面板 + 双语文案 + fixtures 写入路径 + e2e / 视觉覆盖 + 审计收口）。**质量门**：lint 0 error（2 条存量 warning）；typecheck 全包 Done；platform 全量 1770 passed / 9 skipped；全量 e2e **191 passed**；视觉套件 `=all` 重建后 11 passed（仅本页基线变更）；`i18n:check:anchor` OK / `i18n:audit:missing` parity none；check:docs OK（151/87）；lint:md Done；doc-size 62/13/1/0；orphan-ids 0（674）。**审计**：standard R1 **Pass**（0B / 1W（`signals === null` 分支无覆盖，属真实存量行路径）+ 5S）→ 收口（补存量行展开用例 + 空数组分支登记为防御 + fixtures 上限对齐生产 + 注释口径）→ R2 quick **Pass**（1 新 W：新用例未自包含 → `-g` 定向运行失败）→ 收口（用例内幂等自播种）→ R3 quick **Pass**（0B/0W/0S）。**残余**：`signals === []` 分支为防御（生产不可达：监控器空信号不落库、fixtures 空数组写 null）；fixtures 的 `summary` 上限 300 略严于生产落库上限 303（信息性）；页面本地视图类型与服务端各一份（前后端边界惯例）。
- **风险与缓解**：**R1 限流**（每 PR 3+ API × N 轮）——增量轮询 + 终态跳过 + 沿用既有 429 / 限流退避；**R2 单行 JSON 膨胀**（Option A）——`signalsJson` 条目截断 + `summary` 限长；**R3 多源噪音**（非关注 check 也告警）——默认全量只报警不阻断（D3），后续按需引入关注集；**R4 变更面大触发未预期回归**——按 M43.2a / M43.2b / M43.2c 分批审计 / 分批提交。

### M43.3 [P2 🛡️] 容器内 `pnpm install` 环境性失败的可观测性与归因口径（**已闭环** `4fee403` + `66b7966` + `602f5bd` + `cbadeaa`）

- **目标**：让「容器内 `pnpm install` 无 stderr 死亡」这类环境性失败可被定位（保留 stderr / exit code / signal），并把归因口径与 UI 文案对齐，消除「环境问题被呈现为 `engine_exit_2`『所有仓库失败或全量回滚』」的误归因。
- **优先级**：P2
- **范围**：`packages/engine/src/fixers/pnpm/index.ts`（分类结果与策略尝试保留进程级信号 + `ENVIRONMENT_ERROR` 判定与失败详情）+ `packages/engine/src/app/helpers.ts`（`tryLockfileRepair` 非归因标记 + 审计条目）+ `packages/engine/src/app/result-assembly.ts`（`computeExitCode` 归因口径）+ `packages/engine/src/app/repo-fix.ts`（`finalizeRepoFix` 零告警守卫）+ `packages/core/src/report/types.ts`（`FixAction.environmentalFailure`）+ `apps/platform/server/services/run-failure-classify.ts`（防御性映射）+ 相关单测。
- **验收标准**：
  - [x] ① **可观测性**：分类结果与策略尝试保留 `exitCode` / `signal` / `timedOut` / `errno`，失败详情显式渲染（形如 `environmental install failure (exit code 1): no stderr diagnostics`；有 stderr 证据时为 `(signal SIGKILL): stderr: <文本>`；spawn 级失败为 `spawn error ENOENT`），外部不再只看到 `Command failed: pnpm install --no-frozen-lockfile`。
  - [x] ② **归因口径**（D 裁定 = **不归因本次运行**）：环境性失败归 `ENVIRONMENT_ERROR` → `tryLockfileRepair` 标记 `FixAction.environmentalFailure` + 记审计条目，`computeExitCode` 将其纳入 `SKIPPED_AUDIT_CATEGORIES` 且该 action 不计失败动作——与既有失败基线（`PRE_EXISTING_FAILURE`）同族口径；单测锁定（含反例：环境性失败与真实失败并存时仍非零）。
  - [x] ③ **UI 文案**（D 裁定 = **最小实现**）：环境性失败经 ② 后不再驱动 `status=failed` → 不再呈现为 `engine_exit_2`；平台侧补防御性映射 `install` + `transient`（不新增环境事件类型 / 不新增 i18n 键——`runs.failureStage.install` / `runs.failureKind.transient` 双语已存在并经 `i18n:audit:missing` 实证）。
  - [x] ④ **成本口径**（D 裁定 = **仅跳过 lockfile repair**）：零告警仓库无升级改动即无锁文件待修复 → 跳过 lockfile repair；**保留修复后验证链**（其 `verificationPassed` 是零告警仓库唯一的「处理成功」信号，审计拦截了「整段跳过」方案导致的多仓出口码退化）。
  - [x] ⑤ **门禁**：`pnpm lint` 0 error（2 条存量 warning）；`pnpm typecheck` 全包 Done；定向 vitest + 全仓 `test:coverage` 通过。
- **D 阶段定稿（2026-10-13 用户裁定）**：
  - **D1 归因口径 = A（不归因本次运行）**：环境性安装失败不计入失败动作 → 运行 exit 0/1（平台 `completed`）；备选（仍判 `failed` 但改可区分码 / 仅富化文案）未采纳。
  - **D2 成本口径 = A（零告警仓库跳过收尾）**；**审计 R1 blocker 回流后修正为「仅跳过 lockfile repair」**——「整段跳过（含验证链）」会使健康零告警仓库丧失成功信号 → 多仓库运行由 exit 1 退化为 exit 2（重新触发本任务要消除的误归因），故按审计建议收窄为最小跳过面。
  - **D3 可见性 = B（最小实现）**：仅执行日志 + 报告；不新增平台环境事件类型、不新增 i18n 键。
- **实际交付**：`4fee403` fix(engine)（引擎信号保留 + 非归因口径 + 零告警守卫 + core 字段）+ `66b7966` test(engine)（信号 / 非归因 / 多仓不变量 / 守卫用例）+ `602f5bd` fix(platform)（防御性映射 + 镜像用例）+ `cbadeaa` docs(design)（设计文档同步）+ 本条登记 commit。**质量门**：`pnpm lint` 0 error（2 条存量 warning，无新增）；`pnpm typecheck` 全包 Done；`pnpm exec vitest run packages/engine` 65 files / 1283 passed / 1 skipped；全仓 `pnpm run test:coverage` 253 files / 3977 passed / 10 skipped（Statements 88.08 / Branches 82.96 / Functions 87.5 / Lines 88.2，阈值 80）；`pnpm run build` 全包 exit 0；`check:docs` OK（151/87）；`lint:md` Done；`check:doc-size` 62/13/1/0（未新增超标）；`check:orphan-ids` 0（675）；`check:standards-redundant:strict` 0；`docs:check:i18n` passed；`i18n:audit:missing` parity none；mutation 标定 6 处全部击杀（含「复现被否决的整段跳过设计」）。**审计**：standard **2 分区并发** R1 = P1（engine）**Reject**（1 blocker：零告警整段跳过致多仓出口码回归，附独立 `tsx` 复现）+ P2（platform/docs）**Pass**（6 warning / 3 suggest）→ 修复（守卫下移为仅跳 lockfile repair + 不变量用例；信号证据保留 + spawn errno；文档措辞 / 表格 / 单点声明收敛）→ R2 **两分区均 Pass**（apps 侧各 0 blocker；平台分区 0 warning）→ 应用 R2 suggest（用例注明生产不可达防御性锁定 + 基线采样成本边界注记）→ R3 **Pass**（0 blocker / 0 warning / 0 suggest）。**残余**：修复前基线采样（`sampleVerificationBaseline`）仍对零告警仓库执行（其时机须早于修复动作写盘、无法后移）→ 属成本项非正确性项，已在 `dependency-fixer.md` 登记为已知边界；平台侧防御性映射在当前编排路径不可达（已在代码注释与 taxonomy 显式登记）；`engine_exit_2` 映射本身未改（仅不再由环境性失败触发）。
- **不做什么**：不改 `pnpm install` 执行方式（`--no-frozen-lockfile` 保持）；不引入容器内安装失败自动重试 / 换源；不改锁文件修复策略链（`REGENERATE` / `REINSTALL`）语义（新增分类沿用同链）；不改 `PRE_EXISTING_FAILURE` 基线判定的判定逻辑（仅调整归因汇总层）。
- **依赖**：2026-10-11 生产实证（fix 扫描下容器内 `pnpm install` 反复非零退出且无 stderr → `classifyLockfileFailure` 归 `UNKNOWN` → 修复链全失败 + 基线验证同失败被判 `PRE_EXISTING_FAILURE` → `computeExitCode` 返回 2 → 平台呈现 `engine_exit_2`）；hotfix `1c7d8ff` / `53b6ffb`（report-only commit + 非 git 仓库守卫）为邻近链路但非本缺陷。
- **交付物**：预计 2-3 commits——① engine 可观测性 + 归因（`fixers/pnpm/index.ts` + `result-assembly.ts` + `repo-fix.ts` + 单测）；② 平台映射 / i18n（`run-view.ts` + `scan-run-state.ts` + i18n ×2）；③（可选）规范 / 经验登记。预计 5-8 文件 / 150-300 行。
- **风险与缓解**：**R1 归因口径变更影响既有失败分类展示**——AC ③ 以映射分层收敛 + 定向回归（实测无 `run-view` / i18n 改动）；**R2 扩展信号可能外泄敏感 stderr**——沿用既有日志脱敏口径（`getStderrText` 现路径，`failureDetail` 截断 200）；**R3 零告警仓库跳过验证链可能漏掉真实基线问题**——审计拦截后修正为仅跳过 lockfile repair，验证链对所有仓库保留。

### M43.4 [P2 🎨] 扫描触发被去重合并时的前端感知（**已闭环** `11d7404` + `b7d2256`）

- **目标**：让「立即修复 / 扫描」入口在服务端返回去重合并（`merged`）时明确告知用户本次触发未真正执行，消除「点了修复但没跑」的困惑。
- **优先级**：P2
- **范围**：`apps/platform/app/composables/use-fix-now.ts`（新增 `fixMerged` 状态 + 可注入依赖 + 合并早返回）+ `apps/platform/app/components/alert-run-sidebar.vue`（warning 消息）+ `apps/platform/app/pages/repos.vue`（`scanMerged` 状态 + 立即响应 `merged` 分支 + `pollRun` 合并口径）+ i18n ×2（新增共享键、清理失去引用的旧键）+ 单测 / e2e。
- **验收标准**：
  - [x] ① **use-fix-now 命中合并**（D 裁定 = **不跳转**）：响应含顶层 `merged` → 走 `fixMerged`（warning）提示「已合并、本次未执行」，不弹成功 toast、**不跳转**（避免把用户带到未执行的既有 run）；请求体契约（`mode: fix` + `reuseScanRunId`）不变。
  - [x] ② **repos.vue 入口对齐**：`triggerScan` 的 `runData.merged` 分支**前置**于 `status` 判断（新建路径合并时响应 `status` 为 `failed`，不前置会落「扫描失败」danger 文案）→ 走同一 warning 提示；`pollRun` 的 `SCAN_PENDING_MERGED` 由 danger 改同口径 warning（**防御分支**：异步合并在立即响应已短路，生产不可达，已按测试规范 §6.5 注释登记）；合并时清掉异步预置的 success，避免同屏 `warning + success` 语义冲突。
  - [x] ③ **单测**：新增 `apps/platform/tests/unit/use-fix-now.test.ts` —— 合并（提示为 `fixMerged`、`navigate` 未被调用、无成功/错误）/ 无合并（成功提示含 runId 前缀 + 跳转目标 URL）/ 失败（错误提示 + 不跳转）/ `resetMessages` 三态清空；另补 2 条 e2e 合并用例（alerts 入口 + 单仓库扫描入口）。
  - [x] ④ **门禁**：i18n parity（实际入口 `pnpm run i18n:audit:missing`，原条目写的 `check:i18n` 脚本不存在——本条按实际脚本取证）+ `pnpm typecheck` 0 error + 定向 vitest / e2e 通过。
- **D 阶段定稿（2026-10-13 用户裁定）**：① **跳转行为 = 不跳转**（备选「跳转 + banner」未采纳——合并复用路径下既有 run 记录保持不变，跳转只会看到未执行的 run）；② **提示通道 = 新增 warning 状态**（新增 `fixMerged` / `scanMerged` + `CaomeiMessage tone="warning"`；备选「复用现有 error 通道」未采纳），两入口共用同一 i18n 键 `common.scanTriggerMerged`（满足「口径一致 + 键共用」）。
- **实际交付**：`11d7404` fix(platform)（两入口消费顶层 `merged`：`use-fix-now` 合并提示 + 不跳转 + 可注入依赖，`repos.vue` 前置合并分支 + 清预置 success，`alert-run-sidebar` warning 通道，i18n 共享键新增与旧键清理）；`b7d2256` test(platform)（新增合并分支单测 4 用例 + 两入口 e2e 合并用例，单仓库侧改用 `github-action` 执行器以真正断言预置 success 清除）；本条登记 commit。**质量门**：`pnpm lint` 0 error（2 条存量 warning，无新增）；`pnpm typecheck` 全包 Done；定向单测 17 files / 237 passed（含新增 4 用例）；全仓 `pnpm run test:coverage` 254 files / 3981 passed / 10 skipped（Statements 88.24 / Branches 82.98 / Functions 87.61 / Lines 88.39，阈值 80）；定向 e2e（真实构建产物 + workers=1 + 独立库）9 passed（含 2 条新增合并用例，既有 7 条未回归）；`pnpm run build` exit 0；`check:docs` OK（151/87）；`lint:md` Done；`check:doc-size` 62/13/1/0；`check:orphan-ids` 0（676）；`check:standards-redundant:strict` 0；`docs:check:i18n` passed；mutation 标定 3 处全部击杀（去合并早返回 / 合并写 error 通道 / 去 `repos.vue` 合并分支重建后跑 e2e）。**审计**：standard **单分区** R1 **Pass**（0 blocker / 2 warning / 5 suggest）→ 收口（`pollRun` 合并防御分支按测试规范 §6.5 登记；合并 e2e 改用 `github-action` 执行器以真正断言「清掉预置 success」；`alerts.vue` 闲置解构登记 backlog 候选）→ R2 **Pass**（0 blocker / 1 warning / 2 suggest；R2 的 warning 为「声称入 wisdom 但未写入」，已随本轮补写两条会话 wisdom 条目关闭）。**D 阶段过程缺陷（自检/复跑拦截）**：初版把缺省 i18n 实现写成延迟求值（`useI18n()` 在事件处理期调用）→ 三条分支静默失效；既有 e2e 复跑时暴露（单测 0 覆盖、typecheck / lint 0 报错），改为 setup 期解析后全绿。
- **残余**：① `alerts.vue` 存在一处**闲置**的 `useFixNow()` 解构（真正入口在子组件 `alert-run-sidebar.vue`，该孤立实例也与功能无关；批前存量，已登记 backlog 候选）；② server 端 `merged.message` 仍为硬编码中文（前端两个入口均已不消费其文案、改用共享 i18n 键，双语文案已正；影响面仅剩 API 直接消费方，暂不单列候选）；③ `repos.vue` `pollRun` 合并分支生产不可达（防御性保留，已按测试规范 §6.5 注释登记）；④ 单仓库扫描入口的 `github-action` 分支已由 e2e 覆盖，但 `sandbox` 执行器走同一前端分支、未单独覆盖（无独立可见差异）；⑤ D 阶段实测的「setup-only composable 不得在缺省实现里延迟求值」陷阱已入会话 wisdom 活跃条目，按 [AI 协作规范 §1.5 ② 阶段闭环后沉淀工作流](../standards/ai-collaboration.md#15-阶段归档检查--沉淀工作流pdtfc-闭环后必经) 留待 M43 阶段闭环蒸馏时提升到 `docs/standards/platform.md §7` + 检查点矩阵行（治理定义改动不在本批审计面内）。
- **不做什么**：不改 `POST /api/repos/[id]/scan` 的去重合并语义与响应结构（仅前端消费）；不改服务端 `merged` 文案（如需服务端 i18n 化另登记）；不做「已有进行中任务 → 409 前置拒绝」新方案。
- **依赖**：服务端已返回顶层 `merged`（`scan.post.ts:116`）；`use-fix-now.ts` 为 alerts 视图「立即修复此仓库」入口；M42.3 已收敛服务端 reuse 分支的既有 run 状态处置（本条目仅补前端感知）。
- **交付物**：预计 1-2 commits——① composable + `repos.vue` + i18n ×2 + 单测；②（如需）e2e。预计 3-5 文件 / 60-120 行。
- **风险与缓解**：**R1 跳转语义变更影响既有 e2e / 用户预期**——D 阶段裁定跳转行为并与 M16.2 既有入口语义对齐；**R2 两入口提示文案分叉**——AC ② 强制口径一致 + i18n 键共用。

### M43.5 [P3 🛡️] git 边界收口：非仓库目录语义 + push 侧钩子隔离（**已闭环** `8a6c84e` + `cae76b8` + `c436a77`）

- **目标**：消除 `hasGitChanges` 在非仓库目录 fail-open 误判（恒 `true`）的潜在 landmine，并补齐 push 侧 `pre-push` 钩子隔离（此前仅 commit 侧隔离）。
- **优先级**：P3
- **范围**：`packages/engine/src/app/helpers.ts`（`hasGitChanges` 语义 + `commitLocalChanges` / `isGitRepository` JSDoc）+ `packages/engine/src/app/index.ts`（`preExistingDirty` 采样显式前置）+ `packages/engine/src/runners/verification-gate.ts`（非仓库跳过回滚）+ `packages/engine/src/github/git-signing.ts`（新增 push hooks 隔离常量）+ 4 个 push 调用点（`pr-creator.pushBranch` / `container-executor.pushFixBranch` / `container-executor.cleanupRemoteBranch` / `platform-delivery.pushFixBranchWithCredential`）+ `docs/standards/git.md §3.8`（扩展为签名 + hooks 双语义）+ `code-quality-checklist` 矩阵行 + 单测。
- **验收标准**：
  - [x] ① **非仓库语义**（D 裁定 = **源头收口 + 门禁守卫**）：`hasGitChanges` 内前置 `isGitRepository`，非仓库返回 `false`（不再把「git 命令失败」当「有变更」）；`enforceVerificationGate` 在非仓库时跳过回滚（warn 说明「无可回滚工作树」），避免以 `ROLLBACK_FAILED` 掩盖真实失败原因；`preExistingDirty` 采样改为 `isGitRepository(...) && hasGitChanges(...)` 显式表达（纵深防御）——真实仓库中的「已有未提交改动则不自动回滚」保护语义不回归（既有 `preExistingDirty=true` 用例仍绿）。
  - [x] ② **push 侧隔离**（D 裁定 = **全量 4 处**）：新增 `GIT_PUSH_HOOKS_ISOLATION_ARGS = ['--no-verify']`（单一事实源），4 个 push 调用点全部携带且置于 `push` 子命令**之后**（含 `push --delete`）；commit 侧常量取值与 `--no-verify` 选型未变。
  - [x] ③ **JSDoc 同步**：`hasGitChanges` JSDoc 改为「非 git 仓库返回 `false`」并说明旧 fail-open 的 landmine；`commitLocalChanges` / `isGitRepository` 的交叉引用与 `enforceVerificationGate` 的 JSDoc 分支说明同步。
  - [x] ④ **门禁**：`pnpm lint` 0 error + `pnpm typecheck` 0 error + 定向 vitest 通过。
- **D 阶段定稿（2026-10-13 用户裁定）**：① **非仓库语义 = 源头收口 + 门禁守卫**（备选「仅调用点前置守卫」/「仅修 `:547`」未采纳）；② **push 隔离覆盖面 = 全量 4 处**；③ **backlog「hooks 隔离的规范锚点与单一事实源命名收敛」处置 = 扩展 `git.md §3.8`、不做改名**——决策点「扩展 §3.8」随本批闭环，改名 `git-signing.ts` → `git-isolation.ts` 单独登记为新候选（触及公开 API re-export 与平台侧 import 面，宜单独批次）。
- **实际交付**：`8a6c84e` fix(engine)（`hasGitChanges` 非仓库语义 + 门禁非仓库守卫 + `preExistingDirty` 显式前置 + `GIT_PUSH_HOOKS_ISOLATION_ARGS` + `pushBranch` 参数 + 单测）；`cae76b8` fix(platform)（`pushFixBranch` / `cleanupRemoteBranch` / `pushFixBranchWithCredential` 三处同口径 + argv 断言）；`c436a77` docs(standards)（`git.md §3.8` 扩为签名 + hooks 双口径 + 检查点矩阵行同步）；本条登记 commit。**拆分依据（聚合 diff 18 文件 > §1.1 的 10 文件阈值）**：本条目为**单一原子 AC**、天然跨 `packages/engine`（语义 + 隔离常量 + JSDoc）与 `apps/platform`（三处 push argv 同口径）两个模块，无法在不产生「已登记未落地」悬空契约的前提下进一步切分；按模块 + 文档面拆 4 个 commit（engine / platform / standards / plan），各 commit ≤ 8 文件。**质量门**：`pnpm lint` 0 error（2 条存量 warning，无新增）；`pnpm typecheck` 全包 Done（含 `nuxt typecheck`，engine dist 已随源码变更重建）；定向单测（4 + 3 文件）连续 5 轮 136 passed 稳定；全仓 `pnpm run test:coverage` 254 files / 3988 passed / 10 skipped（Statements 88.25 / Branches 82.99 / Functions 87.61 / Lines 88.39，阈值 80）；`check:docs` OK（151/87）；`lint:md` Done；`check:doc-size` 62/13/1/0（`git.md` 经压缩后仍在健康窗口内，未新增超标）；`check:orphan-ids` 0（676）；`check:standards-redundant:strict` 0；`docs:check:i18n` passed；mutation 标定 4 处全部击杀（去 `hasGitChanges` 非仓库守卫 / 去 `pushBranch` hooks 隔离 / 去门禁非仓库守卫 / 去 `pushFixBranch` hooks 隔离）。**审计**：standard **2 分区并发** R1 **两分区均 Pass**（P1 0 blocker / 1 warning / 3 suggest；P2 0 blocker / 2 warning / 3 suggest；两分区均独立复核并确认无需升 `deep`；实测用时 R1 发起 14:44:19Z → 返回 ≈14:51:47Z，≈7m28s）→ 收口（`verification-gate` JSDoc 中「回滚失败（如非 git 仓库）」自相矛盾表述订正；`git.md` 覆盖面加「作用对象 = 被修复仓库」限定并显式排除 dependfix 自有仓库的 CI 发布脚本；`container-executor` 与门禁测试的分支映射注释去行号改符号引用；todo 补拆分依据）→ R2 **Pass**（0 blocker / 0 warning / 3 suggest；上轮 6 个编号全部关闭；3 条 suggest 已应用：发布脚本排除理由改按作用对象表述、`git.md` 与矩阵行限定同步、测试分支注释去行号）。
- **残余**：① `git-signing.ts` 文件命名仍只表达「签名」（已单独登记 backlog 候选）；② push 侧 hooks 隔离属**预防性收口**（生产日志无 `pre-push` 实例），真实目标仓库带 `pre-push` 的场景未在真实环境验证（脚本级真实 git 回归已覆盖）；③ `hasGitChanges` 的 fail-open 语义变更后，`commitLocalChanges` 与 `preExistingDirty` 采样内的 `isGitRepository` 守卫成为**纵深防御**（保留并在注释说明，审计判定「可接受 + 保留」）；④ 存量 `verification-gate` 单测的 `ROLLBACK_FAILED` 覆盖改用「空仓库（HEAD 不可解析）」触发（原以非 git 目录触发，已被新守卫前置拦截）；⑤ `docs/standards/git.md` 压缩后为 199 行（健康窗口上沿 200），后续该节细节增长宜迁往 `docs/design/governance/` 并以一行引用收敛；⑥ 全量套件在本批曾出现 1 次未复现的偶发失败（本批新增测试连跑 5 轮稳定、其后再跑 4 次全量均绿），未定位到具体用例，留观察（若 CI 复发建议 `--workers=1` 定界）。
- **不做什么**：不改 `--no-verify` 选型与 commit 侧既有隔离参数取值；不改签名隔离常量取值；不做「workDir 非仓库统一 fail-fast 前置校验」的大重构；不改 push / PR 交付链整体流程。
- **依赖**：2026-10-11 hotfix（`commitLocalChanges` 前置 `isGitRepository` 守卫，`53b6ffb`）为同族；生产日志中当前已观测交付失败均为 `pre-commit` / `commit-msg`（`pre-push` 无实例，属预防性收口）；`docs/standards/git.md §3.8` 原仅声明签名常量，本批扩展为双语义并同步 `code-quality-checklist` 矩阵行。
- **交付物**：预计 2 commits——① engine `hasGitChanges` 语义 + `pr-creator` push 隔离 + 单测；② 平台 `pushFixBranch` 同口径 + 单测。预计 3-5 文件 / 60-120 行。
- **风险与缓解**：**R1 `preExistingDirty` 保护语义受影响**——AC ① 显式约束 + 定向用例覆盖（既有 `preExistingDirty=true` 用例与新增非仓库用例并存）；**R2 两处 push 实现分叉**——抽共用常量（`git-signing.ts` 单一事实源）并同步规范锚点；**R3 `git push --no-verify` 语义边界**（不作用于签名等其它参数）——表内注明 `-c` 与 `--no-verify` 位置不可互换 + 4 处 argv/行为断言锁定。

### M43.6 [P3 🛠️] 工程脚本加固：门禁产物排除 + 蒸馏计数假阴性（**已闭环** `448ce7b` + `1f234d0` + `8373eba`）

- **目标**：让本地跑过 e2e 后门禁脚本不被 Playwright 产物污染，并让 `distill-wisdom` 正确统计「日期+类型」格式的活跃条目（消除 `--check` 假阴性）。
- **优先级**：P3
- **范围**：`scripts/check-orphan-ids.mjs`（`EXCLUDED_DIRS` 补 Playwright 产物目录）+ `scripts/shared/md-walk.mjs`（`MD_EXCLUDED_DIRS` 同口径，`check-docs` 经此扫描）+ `scripts/distill-wisdom.mjs`（条目形态识别扩展 + 疑似条目告警 + 条目行正则收敛为单一事实源）+ 三个脚本单测 + `docs/design/governance/session-wisdom-distillation.md`（格式约定与告警口径）。
- **验收标准**：
  - [x] ① **产物排除**（D 裁定 = **目录名精确排除**）：`EXCLUDED_DIRS` 与 `MD_EXCLUDED_DIRS` 各补 `playwright-report` / `test-results`（与既有 `coverage` / `.output` / `artifacts` 同类的按名排除惯例）；单测锁定「产物目录不进扫描面」；实测有产物在场时 `check:orphan-ids` 与 `check:docs` 结果与清理后**完全一致**。
  - [x] ② **蒸馏计数**（D 裁定 = **两种形态都兼容**）：解析器同时容忍 `### [YYYY-MM-DD] [type] 标题`（本文件实际写法，后随 `-` 正文行）与 `- **[YYYY-MM-DD] [type] 标题**：正文`（AC 字面形态，兼容 `→ 详见/已迁移至`）；格式约定写入 [session-wisdom-distillation.md §6](../design/governance/session-wisdom-distillation.md)。实测 `pnpm distill:wisdom --check` 由 `0 active entries` → **`4 active entries`**（与文件实际条目数一致）。
  - [x] ③ **假阴性告警**：`--check` 在「活跃条目 0 条且活跃区存在含 `[YYYY-MM-DD]` 的未识别行」时经 **stderr** 显式告警（列出前若干行 + 行号），stdout 契约（`WISDOM_OK` / `WISDOM_NEEDS_DISTILL`）与退出码语义（恒 0，供 hook 无脑调用）均不变。
  - [x] ④ **门禁**：`pnpm lint` 0 error + 脚本单测（37 文件 / 640 用例）通过；全仓套件与文档门禁无回归。
- **D 阶段定稿（2026-10-13 用户裁定）**：① **产物排除 = 目录名精确排除**（备选「统一尊重 `.gitignore`」/「名称排除 + md 面 gitignore 兜底」未采纳——前者需为纯 fs 遍历引入 git 依赖并重定基线，后者收益不抵回归面）；② **计数格式面 = 两种形态都兼容**（备选「仅 AC 字面形态」与「不改 `wisdom.md` 既有格式约定」相抵，「仅既有标题形态」不满足 AC 字面要求）。
- **实际交付**：`448ce7b` fix(scripts)（两个门禁脚本的扫描面排除 Playwright 产物目录 + 单测）；`1f234d0` fix(scripts)（条目形态识别扩展 + 正文门槛 + 疑似条目告警 + 正则收敛 + 单测）；`8373eba` docs(governance)（蒸馏机制文档 §6 格式约定与告警口径）；本条登记 commit。**质量门**：`pnpm lint` 0 error（2 条存量 warning，无新增）；`pnpm typecheck` 全包 Done；脚本单测 37 文件 / 641 passed；全仓 `pnpm run test:coverage` 254 files / 3999 passed / 10 skipped（Statements 88.28 / Branches 82.99 / Functions 87.62 / Lines 88.43，阈值 80）；`check:docs` OK（151/87，**产物在场时同口径**）；`lint:md` Done；`check:doc-size` 62/13/1/0；`check:orphan-ids` 0（676，**产物在场时同口径**）；`check:standards-redundant:strict` 0；`docs:check:i18n` passed；`docs:build` OK；`distill:wisdom --check` 输出真实条目数（4）；mutation 标定 7 处全部击杀（去两个排除集合 / 去 `### [日期] [类型]` 与 `：正文` 两个识别分支 / 去 `--check` 告警 / 去裸 `→ target` 容忍 / 去产物排除）。**审计**：standard **2 分区并发** R1 **两分区均 Pass**（P1 scripts：0 blocker / 3 warning / 3 suggest；P2 docs：0 blocker / 4 warning / 5 suggest；两分区均独立复核并确认 depth 档位合适）→ 收口 13 项（含 `md-walk` 注释编号、JSDoc 与实现不一致、§6 形态表措辞与告警前置条件、`todo.md` §M43.2 标题口径、`archive/index.md` 段标题日期刷新；**并把 §6 与实现的裸 `→ target` 差异改在实现侧收敛**——正则容忍裸指针并补单测，顺带使历史区条目开始携带 target）→ R2 **Pass**（0 blocker / 0 warning / 1 非阻塞 suggest；13 个编号 12 关闭 + 3 按裁定接受）→ 应用 R2 suggest（§6 补「`→` 为保留分隔符」边界）。
- **残余**：① 排除面按目录名精确匹配（`playwright-report` / `test-results` 为 Playwright 专用目录名，任意层级生效）——若未来出现同名但需扫描的源码目录需重新处置（已由单测与注释锁定语义）；② `distill-wisdom` 的**历史区**条目形态在裸 `→ <target>` 扩展后已能被识别并携带 target（实测「已蒸馏」由 0 → 5，原登记项已闭环）；③ 疑似条目探测按「活跃区 + 含日期 token」宽口径，正文行若在方括号内出现日期会被列为疑似（仅在活跃条目为 0 时告警，属诊断信息）；④ 为 AC ① 独立复核而在仓库内合成的验证产物（`apps/platform/playwright-report` / `test-results`，gitignored）已在两轮审计核验后移出（不随提交入库）；⑤ `→` 为保留分隔符（在首个 `→` 处切分摘要 / 指针），已写入蒸馏机制文档 §6 格式约定。
- **不做什么**：不改既有 lint / typecheck / test 门禁语义；不改 `check-orphan-ids` 的编号正则与真常量白名单（仅改扫描面排除）；不引入新依赖解析 `.gitignore` 语法；不改 `wisdom.md` 既有条目格式约定（格式约定写入蒸馏机制文档）。
- **依赖**：本地 e2e 产物污染实测（`playwright-report/trace/assets/codeMirrorModule-*.js` 误报编号形态；`test-results/**/error-context.md` 计入 md 扫描面）；`distill-wisdom` 假阴性实测（`.session/wisdom.md` 按日期+类型书写 → `--check` 输出 `0 active entries`）。
- **交付物**：预计 2 commits——① 门禁脚本排除面（`check-orphan-ids.mjs` + `md-walk.mjs` + 单测）；② `distill-wisdom` 正则 + 告警 + 单测（如需同步蒸馏机制文档）。预计 3-5 文件 / 60-150 行。
- **风险与缓解**：**R1 排除面过宽掩盖真实问题**——按目录名精确排除（与既有 `.output` / `coverage` 同类）+ 单测锁定；**R2 `.gitignore` 策略改动波及既有扫描面**——D 裁定不采用统一策略，既有门禁计数基线（676 文件 / 151 md）实测不变；**R3 正则放宽致误计数**——限定形态 + 单测覆盖「活跃 / 已蒸馏」两态 + 疑似条目告警兜底。
