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
> **类型平衡**：🎨 2（M43.1 / M43.4）+ 🚀 1（M43.2）+ 🛡️ 2（M43.3 / M43.5）+ 🛠️ 1（M43.6）= 6 原子；**🧪 独立条目缺口显式标注**（测试随各条目内嵌，符合 [规划规范 §1.1](../standards/planning.md#11-硬性约束) 类型平衡建议的显式标注惯例）。
>
> **§3.4 三重交叉核验**：0 项重复评估——① `todo-archive.md` + `archive/todo-archive-phases-*.md` 全量扫描（关键词 `pr-checks` / `仓库标识` / `构建信号` / `deployment` / `classifyLockfileFailure` / `hasGitChanges` / `pre-push` / `playwright-report` / `distill-wisdom`）零命中已闭环修复（唯一命中为 M24 PR Check MVP 段，属「单 `Test` check」MVP，非本批多源扩展）；② `git log` 核验无对应修复 commit（`pr-checks.vue` 最近为 `4aa1f7b` 手动触发入口，无仓库列；`services/monitor/**` 无 Deployments / Commit Statuses 采集；`fixers/pnpm/index.ts` 无 signal 上报；`pr-creator.ts` push 侧仅签名隔离）；③ 代码 anchor 逐项实测未闭环（`pr-checks.vue:115-120` 6 列无仓库列 + `pr-checks/index.get.ts:33` 仅 `repositoryId`；`polling-source.ts` 仅 `checks.listForRef` 单 check 名；`fixers/pnpm/index.ts:143-145` `execRepair` 丢弃 exit code / signal；`use-fix-now.ts:65-84` 不消费 `merged`；`helpers.ts:669` `hasGitChanges` 非仓库恒 `true`、`pr-creator.ts:244` `pushBranch` 无 hooks 隔离；`check-orphan-ids.mjs:50` + `md-walk.mjs:42` 排除面缺 `playwright-report` / `test-results`、`distill-wisdom.mjs:145` 正则不容忍「日期+类型」形态）。
>
> **审计 depth 预告**：M43.2 涉及数据模型变更 / migration / 公开 API / 外部调用（GitHub 三源）→ `standard`（建议 2 分区并发，代码 + 文档分区）；M43.3 涉及失败归因口径与展示映射 → `standard`；M43.5 涉及 engine git 行为与平台 push 路径 → `standard`；M43.1 / M43.4 前端为主 → `quick`；M43.6 脚本加固（含单测）→ `quick`。
>
> **建议顺序**：M43.1（前端先行，避免 M43.2 改表两次）→ M43.2（大项，须先定稿子任务拆分）→ M43.3（engine 归因）→ M43.4（前端感知）→ M43.5（git 边界）→ M43.6（脚本加固）。
>
> **条目容量**：6 原子符合 [规划规范 §1.1](../standards/planning.md#11-硬性约束) 的 5-6 项上限；**M43.2 预估 > 10 文件 / > 800 行，须按 M43.2a / M43.2b 拆分子任务**（拆分依据登记 M43.2 §交付物），其余条目均未超单条阈值。

### M43.1 [P2 🎨] PR Check 监测列表补齐所属仓库标识

- **目标**：让 PR Check 监测列表在「全部仓库」视图下行内可辨识 PR 归属，消除跨仓库 PR 编号重号时「只能靠逐个切换筛选器辨认」的不可辨识问题。
- **优先级**：P2
- **范围**：`apps/platform/app/pages/pr-checks.vue:114-121`（列定义）+ `:311-322`（首列插槽）+ 数据来源（形态 D 阶段裁定：客户端用页面已拉取的 `/api/repos`（`pr-checks.vue:74-83`）做 `repositoryId → owner/name` 映射 vs 服务端视图层 join——后者改 `apps/platform/server/api/pr-checks/index.get.ts:31-47`）+ i18n ×2（启用或清理闲置 `prChecks.colRepository` / `prChecks.repositoryUnknown`）+ 单测 / e2e / 视觉基线。
- **验收标准**：
  - [ ] ① **可辨识**：「全部仓库」视图下每行可见所属仓库标识（形态 D 阶段定稿：独立「仓库」列 `owner/name` 置于 PR 列之前，或与 PR 编号同格 `owner/name #390`）。
  - [ ] ② **回退**：映射缺失（仓库已删除 / 不在 `/api/repos` 返回集）时回退 `prChecks.repositoryUnknown`，不渲染 `undefined` / 空串。
  - [ ] ③ **职责边界**：单仓库筛选态下行内标识与既有「仓库」筛选器语义一致、不产生同屏两处仓库信息冲突。
  - [ ] ④ **e2e + 视觉**：跨仓库不同号 PR 并存时行内可区分（断言仓库标识文本）+ 长仓库名 / 窄屏截断策略（CSS 截断或 tooltip）生效 + 视觉基线重建后幂等。
  - [ ] ⑤ **门禁**：`pnpm i18n:audit` 0（闲置键启用或被清理，双语同步）+ `pnpm run check:i18n` parity 0 + `pnpm typecheck` 0 error。
- **不做什么**：不改 PRCheck 数据模型 / 状态机与 ack 语义；不改 `GET /api/pr-checks` 的筛选 / 分页参数语义（若选服务端 join 仅新增视图字段）；不引入新的仓库查询端点；不统一 `PR check` / `PR Check` 大小写口径（既有混用，另登记）。
- **依赖**：用户 2026-10-12 反馈（截图实证同屏并存 `#390` / `#2367` / `#2408` / `#2411` / `#2412`，行内无区分依据）；`prChecks.colRepository` / `repositoryUnknown` 为闲置键（`pnpm i18n:audit:unused` 实证，同族键在 `alerts.vue:416` / `env-events.vue:191` 仍在用）；**与 M43.2 同表，宜一并设计以避免两次改表**（本条目先落地仓库标识，M43.2 扩展列时沿用同列口径）。
- **交付物**：预计 2 commits——① 前端列 / 插槽 + 数据映射 + i18n ×2；② e2e + 视觉基线重建。预计 4-6 文件 / 80-150 行。
- **风险与缓解**：**R1 客户端映射依赖 `/api/repos` 全量完整性**——映射缺失回退文案 + AC ② 断言；**R2 与筛选器职责重叠**——AC ③ 显式约束；**R3 列宽挤压（PR 列 + 仓库列）**——窄屏截断 / tooltip 策略纳入 AC ④。

### M43.2 [P2 🚀] PR 构建 / 部署错误多源采集（PR Check 扩展为信号聚合层）

- **目标**：把 PR Check 从单一 `Test` check 扩展为「GitHub 三源（Checks + Commit Statuses + Deployments）」聚合，使目标仓库修复 PR 的完整 CI / 预览部署失败第一时间可见。
- **优先级**：P2
- **范围**：设计依据 [pr-build-deploy-signals.md](../design/governance/pr-build-deploy-signals.md)（已就绪）；`apps/platform/server/services/monitor/polling-source.ts`（「单 check 名过滤」→ 三源聚合 + 归一化 `UnifiedBuildSignal`）+ `monitor/types.ts`（`PRCheckSyncSource` 抽象沿用）+ `monitor/action-status-monitor.ts`（聚合态 → `alertFiring`）+ `apps/platform/server/entities/pr-check.ts`（Option A：增 `signalsJson` / `overallStatus` / `failureSourcesJson` + migration）+ API 视图层 + `apps/platform/app/pages/pr-checks.vue`（多源详情展示）+ nock 夹具单测 + e2e。
- **验收标准**：
  - [ ] ① **归一化**：给定 PR head 可列出全部 check runs + commit statuses + deployments 的归一化条目并标注 provider（`check_run.app.slug` / `status.context` 前缀 / `deployment.creator.login`）；nock 夹具覆盖 Actions / Vercel（commit status + deployment）/ Cloudflare（check run）三类。
  - [ ] ② **聚合与告警**：任一时间源失败 → 聚合 `failed` → `alertFiring=true` → UI 可见 + ack 可收敛；回归 success 自动清 ack。
  - [ ] ③ **幂等**：同 `headSha` 重跑不重复入库（`(repositoryId, prNumber, headSha)` 唯一约束保持）。
  - [ ] ④ **fail-open**：无 Deployments / 无 commit status 的仓库不报错；单源 API 失败不阻断其它源。
  - [ ] ⑤ **轮询节流**：只取 `updated_at` 在窗口内的 open PR + `headSha` 未变且已终态 → 跳过（限流回归用例）。
  - [ ] ⑥ **门禁**：`pnpm typecheck` 0 error + 定向 vitest 通过 + `pnpm run check:i18n` parity 0。
- **不做什么**：不改 engine 本地构建 / 验证逻辑；不新建 GitHub App（沿用现有凭据模型）；不做 webhook（`PRCheckSyncSource` 已注释预留，后续增量）；不做部署失败自动重跑 / 自动修复；**首批不含 provider 原生 API 日志富化**（设计稿 Layer 5，按 D2 裁定为后续增量 / 留 backlog）；不追求「未装 GitHub 集成」的 provider 可见性（显式声明边界，不臆造信号）。
- **依赖**：设计先行稿 [pr-build-deploy-signals.md](../design/governance/pr-build-deploy-signals.md) 已定稿（2026-10-10，含三源官方文档引文核对）；D 阶段须先裁定设计稿 §5 决策点 **D1**（数据模型 Option A 扩展 `PRCheck`（推荐起步）vs Option B 规范化新表）/ **D3**（「阻断关注集」配置形态，推荐起步 = 全量只报警不阻断）/ **D4**（provider 凭据承载，若不做日志富化则本批不涉及）；M39.5（`kind` 落库）+ M42.4（手动触发共享 polling 函数）为邻近链路，须保持同源。
- **交付物**：预计 3-4 commits，**预估超 §1.1 任务粒度阈值，须拆子任务**——**M43.2a** 采集层（三源 SyncSource + 归一化 + nock 单测，预估 4-6 文件 / 250-400 行）；**M43.2b** 聚合与告警 + 实体扩展 + migration + API 视图 + UI 多源展示（预估 6-9 文件 / 250-400 行）；若 M43.2b 仍超阈值则 UI 展示再拆一子任务。**D 阶段启动前先定稿拆分**（拆分依据登记本节）。
- **风险与缓解**：**R1 限流**（每 PR 3+ API × N 轮）——增量轮询 + 终态跳过 + 沿用既有 429 / 限流退避；**R2 单行 JSON 膨胀**（Option A）——`signalsJson` 条目截断 + `summary` 限长；**R3 多源噪音**（非关注 check 也告警）——默认全量只报警不阻断（D3），后续按需引入关注集；**R4 变更面大触发未预期回归**——按 M43.2a / M43.2b 分批审计 / 分批提交。

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
