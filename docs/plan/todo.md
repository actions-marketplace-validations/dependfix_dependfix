# 当前阶段待办

> 本文件**仅**登记当前阶段活跃待办；已闭环阶段归档于 [todo-archive.md](todo-archive.md)；未排期 / 延期 / 远期 / 长期主线 / 已知边界登记于 [backlog.md](backlog.md)。

---

## 文档位置速查

| 内容类型 | 位置 |
|:--|:--|
| 当前阶段任务 | **M51 语义与数据收口（1.0-F1 批次）** — 6 原子（2026-10-30 规划） |
| 下一阶段（已授权，待规划） | **F2 文档与验证 → G 发布工程**（M52-M53；台账见 [release-1.0-readiness.md](../design/governance/release-1.0-readiness.md)） |
| 已完成阶段归档 | [todo-archive.md](todo-archive.md)（阶段索引 + [archive/](archive/) 分片；M0-M50 全部已归档） |
| 里程碑与阶段交付 | [roadmap.md](roadmap.md)（M0-M50 已归档；M51 进行中） |
| 未排期 / 延期 / 远期 / 长期主线 / 已知边界 | [backlog.md](backlog.md) |
| 历史归档索引 | [archive/index.md](archive/index.md) |

---

## M51: 语义与数据收口（1.0-F1 批次，2026-10-30 规划）

> **阶段目标**：补齐「扫描结果 → 告警明细 → 通知 / 交付」链路上的语义断点——修复结果按告警回写、PR Check 结论两侧一致且取最新一轮、平台建 PR 后具备失败回环、基线红不再静默、长命令纳入取消面与剩余预算、配置写入与列表排序可判定。
> **来源**：[release-1.0-readiness.md](../design/governance/release-1.0-readiness.md) §3.1 F1 九项（台账批次语义固定，不跨批搬入；同 M50 先例）。
> **用户决策（2026-10-30 确认）**：① `completed + conclusion=null` 统一方向 = **fail-closed**（与 CLI 一致，见 M51.2）；② 交付降级默认保持 `skip`，issue / draft 需显式开启（见 M51.4）；③ PR 回环范围限「评论 + 按配置关闭 + 有界重试」，不做自动二次修复（见 M51.3）。
> **阶段启动交叉核验（§3.4，2026-10-30 执行角色实测）**：① 归档表扫描（`rg` `todo-archive.md` + `archive/*.md`）对九项主题 0 命中；② `git log --since 2026-10-20` 无对应实现提交（近期提交均为 M49/M50 与本批规划）；③ 代码锚点逐项确认缺口仍在——`build-signals.ts:233` null→`skipped`、`scan-reconcile.ts:125` 固定 `not-tried`、平台无 issue / PR 评论创建、`pr-creator.ts` 同步 `execFileSync`、引擎无 `deadlineAt`、`schemas/repository.ts` 的 `sandboxLimits` 无 `.strict()`、`api/alerts` 仅 `createdAt` 排序、聚合「任一失败即 failed」。
> **容量评估（§1.1）**：台账九项按语义聚类为 **6 原子**（③ | ②+⑨ | ① | ④ | ⑤+⑥ | ⑦+⑧），在 5-6 项上限内。本批为交付正确性批次，类型以 🛠️ 为主，类型平衡建议让位于台账批次语义（与 M50 容量评估同口径：批次语义优先于补足容量）。M51.3 / M51.5 预估超单提交粒度，按 a / b 子任务拆分独立提交。**阶段总量预估**：49-62 文件 / 1800-2600 行 / 14-16 commits（执行角色测量，逐原子明细见各条交付物）。
> **原子间依赖**：M51.3 ← M51.2（回环建立在统一结论之上）；M51.4 ← M51.1（issue / draft 正文需 per-alert 结果）；M51.5 / M51.6 独立。
> **交付顺序**：M51.1 → M51.2 → M51.3 → M51.4 → M51.5 → M51.6。

### M51.1 [P0 🛠️] ScanResult 修复结果回写（success / converged / failed / skipped）

- **目标**：一次运行结束后，`ScanResult.fixStatus` 反映该告警的真实结果，而不是固定 `not-tried`；通知明细可据此剔除本地已满足告警。
- **范围**：`packages/core/src/report/types.ts`（新增 per-alert 结果契约，字段名与匹配键先在 `docs/design/modules/data-model.md` 补一段）；`packages/engine/src/`（升级 / 锁文件修复 / 家族锁步 / 收敛判定填充结果）；`apps/platform/server/services/scan-reconcile.ts`（写入与 `supersededAt` 交互）；`services/scan-orchestrator.service.ts`（调用点）；`services/notification/`（明细剔除口径）与告警列表「未修复」筛选。
- **验收标准**：① 引擎报告标记 `converged` 的告警，平台落 `fixStatus=converged` 且不再出现在 `security_critical` / `security_high` / 周报「未修复」明细；② `success` / `failed` / `skipped` 三态同样可回写；③ 存量行保持 `not-tried`，`supersededAt` 语义不变（无破坏性迁移）；④ 定向测试覆盖四态映射、reconcile 幂等、supersede 不被误改；⑤ 报告 `alertsConverged` 计数与明细一致（同一次运行内可对账）。
- **不做什么**：不改引擎修复判定与收敛计数口径；不改通知开关、阈值与投递通道。
- **依赖**：无前置阶段；与 M51.4 共享「skipped」语义（交付跳过）。契约变更须先补 `data-model.md` 字段段，并在 [release-1.0-readiness.md](../design/governance/release-1.0-readiness.md) §7 的 G2 冻结清单中登记（`RunResult` 报告 schema 变更）。
- **交付物**：2 commits（契约 / 平台落库）/ 8-10 files / 250-350 行（预估，执行角色测量）；文档：`data-model.md` 字段段 + `platform-notification.md`「平台明细边界」段更新（当前明确写「不携带 converged 标记」，落地后必须改写）+ 必要时 `run-failure-taxonomy.md` 口径一行。
- **风险与缓解**：多版本包「同包多告警」匹配歧义 → 以 `(source, upstreamId, manifestPath)` 为键回写，缺键记 `not-tried` 并 warn；历史 `supersededAt` 行不回写（单测锁定）。

### M51.2 [P1 🛠️] PR Check 结论口径统一 + 同 ref 多轮收敛（台账 ②+⑨）

- **目标**：`completed + conclusion=null` 在平台与 CLI 得到同一结论；同一 ref 上的同名 check 只取最新一轮，re-run 不再造成误报。
- **范围**：`apps/platform/server/services/monitor/build-signals.ts`（当前 null → `skipped`，约 233 行）、`action-status-monitor.ts`（聚合前按 `(app, name)` 取最新 `completed_at` 一轮）、`packages/engine/src/github/pr-check-watch.ts`（结论口径对齐）、`docs/design/governance/pr-build-deploy-signals.md`（口径补充）、单测 fixture。
- **验收标准**：① 同一 fixture 下平台与 CLI 对 `completed + null` 产出相同结论（方向 = fail-closed）；② 同名 check「旧 failure + 新 success」→ 聚合 `success`；③ 关注集外的信号仍不参与 `overallStatus`（既有语义不变）；④ 单测覆盖 null / 多轮 / cancelled / 关注集四类；⑤ `neutral` / `skipped` 仍不计失败（不得因 ① 放宽）。
- **不做什么**：不改关注集 provider / name / kind 语义；不改终态静默窗口（`TERMINAL_REPOLL_QUIET_MS`）。
- **依赖**：M51.3 依赖本条（先统一结论，再建回环）。
- **交付物**：2 commits / 6-8 files / 200-300 行（预估）；文档：`pr-build-deploy-signals.md` 增量段。
- **风险与缓解**：fail-closed 会把「无 conclusion 的历史怪态」变告警 → 只对 `completed` 且非 `in_progress` 形态生效，上线前用生产 PR 样本回放（记录样本数）。

### M51.3 [P0 🛠️] 平台 PR Check 创建后回环（台账 ①，拆 a/b）

- **目标**：平台创建的修复 PR 在 checks 失败时自动评论说明，并按配置关闭或触发有界重试，消除「PR 红了无人收」。
- **范围**：`services/executor/platform-delivery.ts`（建 PR 后注册回环）；新增 `services/pr-feedback/`（有界观察 + 幂等评论 + 关闭 / 重试决策）；复用 `packages/engine/src/app/pr-check-watch-run.ts` 与 `github/pr-check-watch.ts`（抽公共实现，不复制逻辑）；仓库级配置透传（`waitPrChecks` / `closeFailedPr` / `retryFailed` 已有 CLI 键）；审计事件 `pr_feedback_*`。
- **设计先行**：新模块 + 跨包，先出 `docs/design/governance/pr-feedback-loop.md`（触发点 / 观察窗口 / 幂等键 / 关闭与重试边界 / 与 monitor 的分工）。
- **验收标准**：① 平台建 PR 后进入观察态，结果落 `PRCheck` 且 run 详情可见；② 失败时按 `headSha` 幂等评论一次；③ `closeFailedPr` 开启时关闭 PR 并写审计；④ 观察有上限（PR 终态或配置窗口），不阻塞 worker / 不长时间持锁；⑤ 关闭与重试默认关，开启后行为逐条可测。
- **不做什么**：不做自动二次修复（重试仅重新触发既有修复链，且需显式开启）；不改 CLI 交互式确认路径。
- **依赖**：M51.2；`pr-delivery-closure.md` 既有交付闭环语义。
- **交付物**：3 commits（设计 / a 观察态 / b 评论与关闭）/ 12-15 files / 500-700 行（预估）→ 按 §1.1 拆 a、b 两个子任务各自独立验收与提交。
- **风险与缓解**：长轮询占队列与锁 → 由 monitor 节拍驱动（不阻塞 await）；关闭 PR 不可逆 → 默认关 + 审计 + 二次确认文案。

### M51.4 [P1 🎨] 基线红 / 安装失败的交付降级（台账 ④）

- **目标**：交付被跳过时给出可跟踪载体（issue / draft PR / 仅报告三档），默认行为不变；用户不再只剩日志。
- **范围**：`packages/engine/src/app/skipped-delivery.ts`（跳过路径分支）、`github/pr-creator.ts`（issue 创建与去重查询）、配置键 `DEPENDFIX_ON_BASELINE_RED=skip|issue|draft`（默认 `skip`）、`apps/platform/server`（summary 字段 / run 标记 / 列表与详情展示）、报告条目。
- **设计先行**：`pr-delivery-closure.md` 增量段（去重键、标题与正文、标签、退出码中性说明）。
- **验收标准**：① 默认 `skip` 与现状逐字一致；② `issue` 模式同一失败指纹只开一次（关闭后不重开）；③ `draft` 模式创建 draft PR 并标记；④ 平台 run 列表 / 详情显示「交付跳过」而非「0 告警」；⑤ 退出码保持中性（`PRE_EXISTING_FAILURE` 仍在跳过类白名单）。
- **不做什么**：不改 `PRE_EXISTING_FAILURE` 归因语义；不动安装失败判据与回滚链。
- **依赖**：M51.1（正文需要 per-alert 结果与收敛明细）。
- **交付物**：2 commits / 8-10 files / 300-400 行（预估）；文档：`pr-delivery-closure.md` 增量段 + `configuration.md` 配置键行。
- **风险与缓解**：issue 噪声 → 失败指纹去重 + 关闭后冷却；权限面扩大（issues 写）→ 文档标注 token scope 并复用既有权限校验。

### M51.5 [P1 🛠️] 运行级取消面收口 + 单仓剩余预算（台账 ⑤+⑥，拆 a/b）

- **目标**：长命令与回滚不再阻塞超时定时器（实测 `6861fa22d4801ddf`：名义截止 14:15:29 → 实际 abort 14:21:01，延迟约 5.5 分钟，来源见该 run 日志时间戳）；引擎感知剩余预算，预算不足时停止启动新工作并留痕。
- **范围**：`packages/engine/src/github/pr-creator.ts` 的 `execFileSync`（push / commit / 分支操作）改受管异步；`app/helpers.ts` 状态查询；`app/verification-checkpoint.ts` 的 `git read-tree --reset -u`；`apps/platform/server/services/executor/container-executor.ts` 透传 `deadlineAt`；引擎 `AppContext.deadlineAt` + 检查点（基线前 / 每次安装前 / 验证前）；报告条目。
- **设计先行**：`executor-process-isolation.md` §8.5 覆盖边界更新（同步 → 异步 + budget 接口契约）。
- **验收标准**：① 人为阻塞场景下 abort 在超时点 + 宽限内触发（无分钟级延迟）；② 剩余预算不足时跳过后续包并写 `budget_exhausted` 报告条目；③ 取消后无残留子进程（进程树断言）；④ 单测覆盖 deadline 边界、异步 push 失败、回滚期取消。
- **不做什么**：不做仓库级超时配置（已单列 backlog 候选，避免耦合）；不改验证链条数与顺序。
- **依赖**：无前置；`deadlineAt` 接口需与 backlog「仓库级执行预算」候选的解析面兼容（由上层计算，引擎只消费）。
- **交付物**：3 commits（a 异步化与取消 / b deadline 检查 / 文档）/ 10-12 files / 400-600 行（预估）→ 拆 a、b 独立验收。
- **风险与缓解**：异步化调用面广 → 逐调用点替换 + 定向测试；deadline 与「部分成功交付」冲突 → 明确「已通过验证的单元允许提交、未开始的跳过」并写报告。

### M51.6 [P2 🛠️] 配置写入闸门 + alerts 原始列表排序兜底（台账 ⑦+⑧）

- **目标**：`sandboxLimits` / `tags` 的写入与读取口径单一可判；alerts 原始列表在 `createdAt` 并列时行序确定（消除视觉 flaky 根因）。
- **范围**：`apps/platform/server/schemas/repository.ts`（`sandboxLimits` 加 `.strict()`、`tags` 上限常量同源）、`entities/repository.ts`（`parseTags` trim / 去重与常量对齐）、`api/alerts/index.get.ts`（补 `addOrderBy('result.id','DESC')`）、`docs/standards/development.md §5.1.45` 对齐说明、单测与视觉基线核验。
- **验收标准**：① `sandboxLimits` 含未知键（如 `gpu`）→ 400；② `tags` 超限 / 重复的写入与读取结果一致；③ 同一 `createdAt` 的多行两次查询顺序一致；④ 视觉基线若因行序变化失配，逐张重标并在 README 记录。
- **不做什么**：不改 `sandboxLimits` 数值上下限；不改告警列表主排序字段（仍 `createdAt DESC`，仅补次键）。
- **依赖**：无。
- **交付物**：2 commits / 5-7 files / 150-250 行（预估）。
- **风险与缓解**：存量脏数据被 `.strict()` 拒绝 → 仅收紧写入侧、读取保持宽容；视觉行序变化 → 先跑视觉套件，必要时重建并登记。

---

## 阶段收口要求

- **质量门**：逐原子 `pnpm lint` + `pnpm typecheck` + 定向测试；跨包改动先 `pnpm -r build` 再 typecheck；阶段收口跑 platform 全量 + 相关 e2e + 视觉套件。
- **Review Gate**：每原子至少一轮 `Code Auditor`（`standard`，跨包 / 契约改动升 `deep`），Reject 须闭环后复审。
- **台账回填**：阶段完成后在 [release-1.0-readiness.md](../design/governance/release-1.0-readiness.md) §3.1 F1 标注闭环与证据，并同步 §5 批次表。
- **归档**：按 [规划规范 §4](../standards/planning.md) 迁出为 `archive/todo-archive-phases-m51.md` + 索引行 + roadmap 状态同步。
