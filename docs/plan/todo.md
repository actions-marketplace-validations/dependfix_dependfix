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

### M43.2 [P2 🚀] PR 构建 / 部署错误多源采集（PR Check 扩展为信号聚合层）（**D 阶段定稿**：Option A 数据模型 + 全量只报警；拆 a/b/c 三子任务）

- **目标**：把 PR Check 从单一 `Test` check 扩展为「GitHub 三源（Checks + Commit Statuses + Deployments）」聚合，使目标仓库修复 PR 的完整 CI / 预览部署失败第一时间可见。
- **优先级**：P2
- **范围**：设计依据 [pr-build-deploy-signals.md](../design/governance/pr-build-deploy-signals.md)（已就绪）；`apps/platform/server/services/monitor/polling-source.ts`（「单 check 名过滤」→ 三源聚合 + 归一化 `UnifiedBuildSignal`）+ `monitor/types.ts`（`PRCheckSyncSource` 抽象沿用）+ `monitor/action-status-monitor.ts`（聚合态 → `alertFiring`）+ `apps/platform/server/entities/pr-check.ts`（Option A：增 `signalsJson` / `overallStatus` / `failureSourcesJson` + migration）+ API 视图层 + `apps/platform/app/pages/pr-checks.vue`（多源详情展示）+ nock 夹具单测 + e2e。
- **验收标准**：
  - [x] ① **归一化**：给定 PR head 可列出全部 check runs + commit statuses + deployments 的归一化条目并标注 provider（`check_run.app.slug` / `status.context` 前缀 / `deployment.creator.login`）；nock 夹具覆盖 Actions / Vercel（commit status + deployment）/ Cloudflare（check run）三类。
  - [x] ② **聚合与告警**（落库与状态机已闭环；UI 可见 / ack 收敛待 M43.2c）：任一时间源失败 → 聚合 `failed` → `alertFiring=true` → UI 可见 + ack 可收敛；回归 success 自动清 ack。
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
  - **M43.2c UI 多源展示**（预估 4-6 文件 / 200-350 行）：`pr-checks.vue` 多源详情（失败源清单 + 各信号状态 / 链接）+ i18n ×2 + e2e + 视觉基线重建。**承接项（由 M43.2b 审计登记）**：① 「最近轮询」列语义已随 M43.2b 收窄（仅实际采集落库时推进），列头文案 / tooltip 需同步为「最近采集」以免被误读为轮询故障；② 多源展示需消费 `signals` / `failureSources` / `overallStatus`（列表与详情视图契约已对称）。
- **风险与缓解**：**R1 限流**（每 PR 3+ API × N 轮）——增量轮询 + 终态跳过 + 沿用既有 429 / 限流退避；**R2 单行 JSON 膨胀**（Option A）——`signalsJson` 条目截断 + `summary` 限长；**R3 多源噪音**（非关注 check 也告警）——默认全量只报警不阻断（D3），后续按需引入关注集；**R4 变更面大触发未预期回归**——按 M43.2a / M43.2b / M43.2c 分批审计 / 分批提交。

### M43.3 [P2 🛡️] 容器内 `pnpm install` 环境性失败的可观测性与归因口径

- **目标**：让「容器内 `pnpm install` 无 stderr 死亡」这类环境性失败可被定位（保留 stderr / exit code / signal），并把归因口径与 UI 文案对齐，消除「环境问题被呈现为 `engine_exit_2`『所有仓库失败或全量回滚』」的误归因。
- **优先级**：P2
- **范围**：`packages/engine/src/fixers/pnpm/index.ts:79-96`（`classifyLockfileFailure` 保留更多信号）+ `:143-145`（`execRepair` 当前用 `execFileSync` 丢弃 signal / 退出码）+ `:515`（`failureDetail` 取 `getStderrText(err) || err.message`）+ `packages/engine/src/app/repo-fix.ts:817`（`finalizeRepoFix` 对零告警仓库仍无条件跑 lockfile repair 与验证链）+ `packages/engine/src/app/result-assembly.ts`（`computeExitCode` 归因口径）+ `apps/platform/server/services/scan-run-state.ts:141-142`（`engine_exit_2` 定义）+ `apps/platform/app/utils/run-view.ts`（失败 stage / kind → i18n 标签映射；`engine_exit_2` message 由 `apps/platform/app/components/repo-history-dialog.vue` 直接渲染）+ 相关单测。
- **验收标准**：
  - [ ] ① **可观测性**：`execRepair` / 分类结果保留并上报 `stderr` / exit code / signal（外部不再只看到 `Command failed: pnpm install --no-frozen-lockfile`）；单测覆盖「非零退出无 stderr」「信号杀死（含 signal 名）」两类。
  - [ ] ② **归因口径**：唯一失败为「环境性安装失败 + 既有基线失败」且零告警时整次运行的归因定稿（D 阶段裁定：仍判 `failed` vs 归环境事件 / `failure_kind=transient`）且与 `computeExitCode` 一致；单测锁定。
  - [ ] ③ **UI 文案**：失败 stage / kind → i18n 映射不再把环境性失败笼统呈现为 `engine_exit_2` 通用文案（新增 / 细化映射键，双语同步）。
  - [ ] ④ **成本口径**：零告警仓库是否仍需跑 lockfile repair + 完整验证链定稿并落地（D 阶段裁定；若保留则显式注记理由）。
  - [ ] ⑤ **门禁**：`pnpm lint` 0 error + `pnpm typecheck` 0 error + 定向 vitest 通过。
- **不做什么**：不改 `pnpm install` 执行方式（`--no-frozen-lockfile` 保持）；不引入容器内安装失败自动重试 / 换源；不改锁文件修复策略链（`REGENERATE` / `REINSTALL`）语义；不改 `PRE_EXISTING_FAILURE` 基线判定的判定逻辑（仅可能调整归因汇总层）。
- **依赖**：2026-10-11 生产实证（fix 扫描下容器内 `pnpm install` 反复非零退出且无 stderr → `classifyLockfileFailure` 归 `UNKNOWN` → 修复链全失败 + 基线验证同失败被判 `PRE_EXISTING_FAILURE` → `computeExitCode` 返回 2 → 平台呈现 `engine_exit_2`）；hotfix `1c7d8ff` / `53b6ffb`（report-only commit + 非 git 仓库守卫）为邻近链路但非本缺陷。
- **交付物**：预计 2-3 commits——① engine 可观测性 + 归因（`fixers/pnpm/index.ts` + `result-assembly.ts` + `repo-fix.ts` + 单测）；② 平台映射 / i18n（`run-view.ts` + `scan-run-state.ts` + i18n ×2）；③（可选）规范 / 经验登记。预计 5-8 文件 / 150-300 行。
- **风险与缓解**：**R1 归因口径变更影响既有失败分类展示**——AC ③ 以 i18n 映射分层收敛 + 定向回归；**R2 扩展信号可能外泄敏感 stderr**——沿用既有日志脱敏口径（`getStderrText` 现路径）；**R3 零告警仓库跳过验证链可能漏掉真实基线问题**——D 阶段裁定并在 AC ④ 显式记录取舍理由。

### M43.4 [P2 🎨] 扫描触发被去重合并时的前端感知

- **目标**：让「立即修复 / 扫描」入口在服务端返回去重合并（`merged`）时明确告知用户本次触发未真正执行，消除「点了修复但没跑」的困惑。
- **优先级**：P2
- **范围**：`apps/platform/app/composables/use-fix-now.ts:65-84`（当前不消费 `merged`，恒弹成功 toast 并跳转）+ 服务端响应 `apps/platform/server/api/repos/[id]/scan.post.ts:89-116`（顶层 `merged: { code: 'SCAN_PENDING_MERGED', message }`）+ `apps/platform/app/pages/repos.vue` 单仓库扫描入口（对齐语义）+ i18n ×2 + 单测 / e2e。
- **验收标准**：
  - [ ] ① **use-fix-now 命中合并**：响应含 `merged` 时不弹「成功」toast（改为「已合并 / 未真正执行」提示），跳转行为定稿（D 阶段裁定：不跳转 vs 跳转后 banner）。
  - [ ] ② **repos.vue 入口对齐**：单仓库扫描入口对 `merged` 的提示口径与 use-fix-now 一致（新建路径的既有合并提示不回归）。
  - [ ] ③ **单测**：`merged` 存在 / 不存在两分支断言（toast 内容 + 跳转行为）。
  - [ ] ④ **门禁**：`pnpm run check:i18n` parity 0 + `pnpm typecheck` 0 error + 定向 vitest / e2e 通过。
- **不做什么**：不改 `POST /api/repos/[id]/scan` 的去重合并语义与响应结构（仅前端消费）；不改服务端 `merged` 文案（如需服务端 i18n 化另登记）；不做「已有进行中任务 → 409 前置拒绝」新方案。
- **依赖**：服务端已返回顶层 `merged`（`scan.post.ts:116`）；`use-fix-now.ts` 为 alerts 视图「立即修复此仓库」入口；M42.3 已收敛服务端 reuse 分支的既有 run 状态处置（本条目仅补前端感知）。
- **交付物**：预计 1-2 commits——① composable + `repos.vue` + i18n ×2 + 单测；②（如需）e2e。预计 3-5 文件 / 60-120 行。
- **风险与缓解**：**R1 跳转语义变更影响既有 e2e / 用户预期**——D 阶段裁定跳转行为并与 M16.2 既有入口语义对齐；**R2 两入口提示文案分叉**——AC ② 强制口径一致 + i18n 键共用。

### M43.5 [P3 🛡️] git 边界收口：非仓库目录语义 + push 侧钩子隔离

- **目标**：消除 `hasGitChanges` 在非仓库目录 fail-open 误判（恒 `true`）的潜在 landmine，并补齐 push 侧 `pre-push` 钩子隔离（当前仅 commit 侧隔离）。
- **优先级**：P3
- **范围**：`packages/engine/src/app/helpers.ts:669`（`hasGitChanges` 语义）+ 调用点 `packages/engine/src/app/index.ts:273`（`preExistingDirty` 采样）/ `:547`（fix-and-pr PR 判定）+ `packages/engine/src/github/pr-creator.ts:244`（`pushBranch` 当前仅 `GIT_PUSH_SIGNING_ISOLATION_ARGS`，无 hooks 隔离）+ `apps/platform/server/services/executor/container-executor.ts`（`pushFixBranch` 同口径）+ `packages/engine/src/github/git-signing.ts`（如需新增 push hooks 隔离常量）+ 单测。
- **验收标准**：
  - [ ] ① **非仓库语义**：`hasGitChanges` 在非仓库目录返回 `false`，或统一前置 `isGitRepository` 判定（D 阶段裁定口径）；`preExistingDirty=true` 的保护语义（验证门禁回滚时不误伤用户改动）不回归。
  - [ ] ② **push 侧隔离**：`pushBranch` / `pushFixBranch` 显式跳过被修复仓库的 `pre-push` 钩子（与 commit 侧共用隔离常量口径，单一事实源），单测断言参数拼接。
  - [ ] ③ **JSDoc 同步**：`commitLocalChanges` / `hasGitChanges` JSDoc 所述 fail-open 语义与实现一致（语义变更则同步；若保留则注明结构化信号缺失）。
  - [ ] ④ **门禁**：`pnpm lint` 0 error + `pnpm typecheck` 0 error + 定向 vitest 通过。
- **不做什么**：不改 `--no-verify` 选型与 commit 侧既有隔离参数取值；不改签名隔离常量取值；不做「workDir 非仓库统一 fail-fast 前置校验」的大重构（若 D 阶段判定收益不足，则仅改语义 + 留注记，并把统一校验登记候选）；不改 push / PR 交付链整体流程。
- **依赖**：2026-10-11 hotfix（`commitLocalChanges` 前置 `isGitRepository` 守卫，`53b6ffb`）为同族；生产日志中当前已观测交付失败均为 `pre-commit` / `commit-msg`（`pre-push` 无实例，属预防性收口）；可一并处置 backlog §待上收候选「hooks 隔离的规范锚点与单一事实源命名收敛」。
- **交付物**：预计 2 commits——① engine `hasGitChanges` 语义 + `pr-creator` push 隔离 + 单测；② 平台 `pushFixBranch` 同口径 + 单测。预计 3-5 文件 / 60-120 行。
- **风险与缓解**：**R1 `preExistingDirty` 保护语义受影响**——AC ① 显式约束 + 定向用例覆盖；**R2 两处 push 实现分叉**——抽共用常量（`git-signing.ts` 单一事实源）并同步规范锚点；**R3 `git push --no-verify` 语义边界**（不作用于签名等其它参数）——注记 + 单测锁定参数顺序。

### M43.6 [P3 🛠️] 工程脚本加固：门禁产物排除 + 蒸馏计数假阴性

- **目标**：让本地跑过 e2e 后门禁脚本不被 Playwright 产物污染，并让 `distill-wisdom` 正确统计「日期+类型」格式的活跃条目（消除 `--check` 假阴性）。
- **优先级**：P3
- **范围**：`scripts/check-orphan-ids.mjs:50`（`EXCLUDED_DIRS` 缺 `playwright-report` / `test-results`）+ `scripts/shared/md-walk.mjs:42`（`MD_EXCLUDED_DIRS` 缺同名目录，`check-docs` 经此扫描）+ `scripts/distill-wisdom.mjs:145`（`newFormatMatch` 不容忍 `**[日期] [类型] 标题**` 形态）+ 脚本单测。
- **验收标准**：
  - [ ] ① **产物排除**：`pnpm run check:orphan-ids` 与 `pnpm run check:docs` 在存在 `playwright-report/` / `test-results/` 产物时结果与清理后一致（或统一改为尊重 `.gitignore` 的排除策略，D 阶段裁定）；单测覆盖排除面。
  - [ ] ② **蒸馏计数**：`distill-wisdom` 容忍 `- **[YYYY-MM-DD] [type] 标题**：正文` 形态并正确计数；`pnpm distill:wisdom --check` 在存在该格式条目时输出真实条目数。
  - [ ] ③ **假阴性告警**：`--check` 在「解析到 0 条但文件存在疑似条目」时显式告警（防静默假阴性再次通过）。
  - [ ] ④ **门禁**：`pnpm lint` 0 error + 脚本单测通过。
- **不做什么**：不改既有 lint / typecheck / test 门禁语义；不改 `check-orphan-ids` 的编号正则与真常量白名单（仅改扫描面排除）；不引入新依赖解析 `.gitignore` 语法（若采统一策略则复用既有 `isGitIgnored` helper）；不改 `wisdom.md` 既有条目格式约定（若定稿格式约定则写入蒸馏机制文档）。
- **依赖**：本地 e2e 产物污染实测（`playwright-report/trace/assets/codeMirrorModule-*.js` 误报编号形态；`test-results/**/error-context.md` 计入 md 扫描面 148→152）；`distill-wisdom` 假阴性实测（`.session/wisdom.md` 按日期+类型书写 → `--check` 输出 `0 active entries`）。
- **交付物**：预计 2 commits——① 门禁脚本排除面（`check-orphan-ids.mjs` + `md-walk.mjs` + 单测）；② `distill-wisdom` 正则 + 告警 + 单测（如需同步蒸馏机制文档）。预计 3-5 文件 / 60-150 行。
- **风险与缓解**：**R1 排除面过宽掩盖真实问题**——按目录名精确排除（与既有 `.output` / `coverage` 同类）+ 单测锁定；**R2 `.gitignore` 策略改动波及既有扫描面**——D 阶段裁定，若改用统一策略须回归既有门禁计数基线；**R3 正则放宽致误计数**——限定形态 + 单测覆盖「已蒸馏」与「活跃」两态。
