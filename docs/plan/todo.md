# 当前阶段待办

> 本文件**仅**登记当前阶段活跃待办；已闭环阶段归档于 [todo-archive.md](todo-archive.md)；未排期 / 延期 / 远期 / 长期主线 / 已知边界登记于 [backlog.md](backlog.md)。

---

## 文档位置速查

| 内容类型 | 位置 |
|:--|:--|
| 当前阶段任务 | **M46「运行结果可信度与可观测性」**（2026-10-20 用户决策方案 A；6 原子条目） |
| 下一阶段（未授权） | 无——本阶段闭环后按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 评估 [backlog.md](backlog.md) 候选池后由用户决策 |
| 已完成阶段归档 | [todo-archive.md](todo-archive.md)（主窗口 + [archive/](archive/) 分片；M0-M45 全部已归档） |
| 里程碑与阶段交付 | [roadmap.md](roadmap.md)（M0-M45 已归档，M46 进行中） |
| 未排期 / 延期 / 远期 / 长期主线 / 已知边界 | [backlog.md](backlog.md) |
| 历史归档索引 | [archive/index.md](archive/index.md) |

---

## M46: 运行结果可信度与可观测性（2026-10-20 用户决策方案 A）

承接 M45 归档后的「**跑得对、看得见、不打扰**」阶段。2026-10-17 / 18 生产复盘暴露的核心问题不是「能不能修」，而是**结果是否可信、失败是否可见、通知是否可控**：13 个仓库「有可修告警 / 0 修复」在列表显示为已完成（2026-10-17 生产复盘，执行角色记录见 M45 归档追加批次；原始 run 日志由部署方保存，仓库内无副本）；环境性失败不归因也不可见；基线首失败即停导致 test 从未进基线、整仓回滚连带丢弃已通过探针；执行面内存口径与控制面相差约 4 倍（41 次 `SIGKILL` 由 `journalctl -k` 实测，M45 归档追加批次）；邮件通知只有环境事件、没有业务结果且不可配置。经 2026-10-20 用户决策（**方案 A**）从 [backlog.md](backlog.md) §候选评估中上收 5 项候选，并纳入 [issue #190](https://github.com/dependfix/dependfix/issues/190) 邮件通知需求（设计稿 [platform-notification.md](../design/governance/platform-notification.md)）。

**阶段基线工作量（2026-10-20，§3.1.1 再平衡分母）**：6 条目「交付物」下限和 ~ 上限和为 **81-116 文件 / 3020-4800 行**（取整 80-120 / 3000-4800；文件跨批复用，去重后偏低；M46.5 按 B1-B5 求和，见条目）。累计插队批次 ≥ 3 或插队工作量 ≥ 本基线 50% 时，必须按 [规划规范 §3.1.1](../standards/planning.md#_3-1-1-插队后的阶段容量再平衡-hard-requirement-2026-10-19) 评估移出低优先级条目，不得压缩验收或审计。

**6 原子条目**（覆盖 🎨 2 + 🛠️ 2 + 🚀 1 + 🧪 1，满足 [规划规范 §1.1](../standards/planning.md#11-硬性约束) 类型平衡建议）：

- **M46.1** [P1 🎨] 环境性失败与「有告警未修」的可见性 —— **已闭环**
- **M46.2** [P2 🎨] 跨 major / 截断 / 子目录跳过的披露 —— **已闭环**
- **M46.3** [P2 🛠️] 基线采样完整链与门禁回滚粒度
- **M46.4** [P1 🛠️] 执行容器内存下限与 OOM 归因
- **M46.5** [P2 🚀] 平台通知与邮件推送（issue #190）—— **B1-B4 已闭环；B5 延期**
- **M46.6** [P3 🧪] 视觉套件测试库 fixtures 前置断言 —— **已闭环**

**建议执行顺序**：M46.6（最小、先清本地噪声）→ M46.1（P1 可见性，先落数据层）→ M46.2（复用同一 summary 承载）→ M46.5（通知消费未修复高危口径）→ M46.3（引擎基线，独立）→ M46.4（部署口径，独立）。若阶段容量收紧，M46.6 与 M46.5 的 B5 周汇总可优先移出。

**范围边界（不做什么）**：不改 exit code 语义与 failure taxonomy（M46.1）；不改跨 major 跳过策略、不新增仓库级 `allowMajorUpgrade` 开关（M46.2）；不做探针合批、不改默认验证命令链（M46.3）；不自动调高容器限制、不做 K8s 资源模板（M46.4）；不实现 Slack / Webhook 真实投递、不做仓库订阅与一键退订令牌（M46.5）；不改视觉阈值、不做全站基线（M46.6）。

**审计 depth 预告**：M46.1 / M46.2 / M46.4 / M46.5 → `standard`（M46.5 建议 2 分区并发：数据与策略 / 投递与 UI）；M46.3 → `deep`（验证门禁回滚语义变更）；M46.6 → `quick`。**M46.5 depth 判定口径**：按 B1-B5 拆至单 commit ≤ 10 文件 / ≤ 800 行后按单 commit 判定；任一批超限升 `deep`。

**§3.4 阶段启动交叉核验（2026-10-20）**：6 项均完成三重核验，**0 项重复评估**。① 归档表格扫描（`环境性失败` / `alertsSkipped` / `首失败即停` / `内存下限` / `邮件通知` / `视觉库`）仅命中来源批次与残余观察项，无已闭环实现；② `git log --oneline -- <路径>` 确认相关文件最近改动均未覆盖本阶段范围（`scan-run.ts` 最近 `741b72c` 为重试来源列 / `verify-project.ts` 最近 `eb9f094` 为交付守卫 / `verification-gate.ts` 最近 `7f01d3b` 为留痕 / `notification/policy.ts` 仅 `e80b7b0` 环境事件扩展）；③ 代码 anchor 逐项实证仍开放（`scan-run.ts` 无 `exitCode` 列、`run-detail-dialog.vue` 无 `alertsSkipped` 展示、`verify-project.ts:100` 首失败即停、`deployment.md:10` 仍写 1GB、`policy.ts` 仅 3 类环境事件、`tests/visual/global-setup.ts` 无仓库集合断言）。

**决策记录（2026-10-20 用户裁定）**：① 方案 A 六条目；② 邮件通知分必选（平台自身问题）与可选（高危 / 失败 / 完成摘要），完成类默认不发；③ 收件人定向触发者（新增 `triggeredByUserId`），管理员区分平台问题与告警问题；④ 24 小时窗口 + 指纹变化才再次发送 + 内容不变不重复；⑤ 全局配置落 `/notifications` 管理员页；⑥ 周汇总为可选项（默认关闭）。

---

### M46.1 [P1 🎨] 环境性失败与「有告警未修」的可见性（**已闭环** `c3132555` + `900ab6f1` + `a70c5dc4` + `c040e05b` + `c7101de8` + `b36bcb36` + 本条登记）

- **目标**：让「运行完成但存在环境性失败 / 有可修告警却 0 修复」在运行列表与详情可见，而不是显示为纯成功；引擎 exit code 与环境性失败计数落库，形成可查询的事实。
- **优先级**：P1
- **范围**：
  - `packages/core/src/report/types.ts`（`RunSummary` 新增环境性失败计数）；`packages/engine/src/app/result-assembly.ts:146-181`（环境性动作统计）；`packages/engine/src/app/repo-fix.ts` / `repo-fix-finalize.ts`（累加点）。
  - `apps/platform/server/entities/scan-run.ts`（新增 `exit_code` / `environmental_failure_count`）；新增幂等迁移并登记 `server/database/index.ts` 与迁移注册表测试。
  - `apps/platform/server/services/scan-orchestrator.service.ts:397-467`（终态落库）；`scan-run-state.ts:96-142`（复用同一判定，避免双源）；`apps/platform/server/api/scan-history/**`（序列化）。
  - `apps/platform/app/pages/scans.vue` + `components/run-detail-dialog.vue` + `components/repo-history-dialog.vue`（行标记 / 两处详情区块）；`app/utils/run-view.ts`（派生函数）；i18n 双侧；e2e / 视觉 fixtures。
- **验收标准**：
  - [x] ① 新 run 落 `exit_code` 与 `environmental_failure_count`；旧数据为 `NULL` / `0` 时 API 与 UI 正常降级，不报错。
  - [x] ② 列表与详情在计数 > 0 时显示「环境性失败 N」与「未修复告警 N」，tooltip 说明「不归因本次运行但可见」；计数为 0 时不显示噪音标记。
  - [x] ③ 超时 / 无 `result` 的 run 显示「结果缺失」并保留 `execution_timeout` 分类，不误报成功；该 run 不参与告警明细 reconcile，UI 不显示误导性的「告警 0」。
  - [x] ④ 迁移二次执行幂等；单测覆盖 summary 累加、落库映射、派生函数；页面变化时更新视觉基线。
- **不做什么**：不改 exit code 0 / 1 / 2 语义；不做历史数据全量回填；不新增独立页面；不改 `run-failure-classify.ts` 的分类表（真实安装失败被并入环境性的分类语义收窄见 backlog「环境性失败分类语义收窄」）。
- **依赖**：2026-10-17 / 18 生产复盘（13 仓库「有告警 / 0 修复」）；`run-failure-classify.ts` 既有 `failure_kind`；M43.3 环境性归因与 M45 交付守卫（交接来源）。
- **交付物（实际）**：6 commits（不含本条登记）/ 39 文件 / 945 插入。拆分：`c3132555` core/engine 汇总契约（9 文件）；`900ab6f1` 实体列 + 迁移 + 终态落库（8）；`a70c5dc4` API 序列化 + fixtures（7）；`c040e05b` 列表 / 两处详情 / i18n（7）；`c7101de8` e2e + 视觉基线（5）；`b36bcb36` 标准与设计文档（3）。**超原估**（10-14 文件 / 300-450 行）的主因：`/scans?run=` 实际挂载 `repo-history-dialog`（与 alerts 侧栏 `run-detail-dialog` 为两套详情），两者都需展示结果可信度；另补列表 / 两详情 / 结果缺失的 e2e 与视觉前置断言。
- **风险与缓解**：**R1 双源判定漂移**（内存 exitCode 与落库计数不一致）→ `resolveScanRunOutcome` 纯函数单一映射 + 映射用例；**R2 UI 误读**（把「环境性失败」读成仓库代码问题）→ 文案与 tooltip 明确「不归因」；**R3 报告契约变更**（summary 新字段影响快照）→ core 类型契约测试 + 旧报告降级；**R4 无 result 的执行器合成 exitCode=2 污染** → 仅在 result.summary 存在时落两列；**R5 视觉基线阈值内假绿**（单字符差异低于 100px）→ 删除基线重建 + 截图前断言语义 + 两次 no-update。
- **闭环记录（2026-10-21）**：**审计** R1 `standard` 三分区并发（A core/engine/数据层 · B API/fixtures · C UI/视觉/文档）均 **Pass**（0 blocker；A 4 warning / B 3 warning / C 4 warning）→ 收口（无 result 两列 NULL、reuse 用例改为 catch-all 生效、主链路覆盖边界收窄 + backlog 候选、B 模式哨兵注释、0 值落库断言、repo-history 空态、已修复列归一、英文文案、结果缺失隐藏告警 0、converged 视觉覆盖等）→ R2 `quick` **Pass**（0 blocker / 1 warning：告警侧栏详情无断言）→ 补 `alerts-sidebar` e2e 的未修复 / 环境性失败 / 退出码 / 结果缺失断言 → 复跑通过。**门禁**：定向单测 141 passed（另 core/report 98 passed）；`test:visual` 16 passed（update 后连续两次 no-update；基线人工查看「未修复 1 / 环境性失败 1 / 退出码 1」，另以 `maxDiffPixels:0` 严格配置复验逐像素一致）；e2e 全量 198 passed + 2 flaky（repos-crud 删除 / scan-config 记住上次选择，单独重跑均通过），新增列表 / 两详情 / 结果缺失用例通过；`pnpm run lint` 0 error（3 warning：alerts.vue / scans.vue 存量 max-lines + scan-orchestrator.test max-lines-per-function）；`pnpm run typecheck` 7 包 Done；core / engine / platform build exit 0；`check:docs` / `check:doc-size`（warning 0）/ `lint:md:check` / `lint:i18n` / `check:orphan-ids`（0 命中）通过。**残余**：① 常规分组 / 逐包升级路径尚未消费 `environmental` 标记，计数可能低于真实环境性失败数（backlog「常规升级链路的环境性失败归因对齐」）；② `dispatched`（B 模式结果未就绪）仍显示「告警 0」，R1 接受为既有设计；③ `exit_code` 的 mysql / postgres 分支未实测（与既有同类迁移同风险）；④ 告警侧栏详情新增断言已覆盖，`run-detail-dialog` 的窄屏布局未单独验证。

### M46.2 [P2 🎨] 跨 major / 截断 / 子目录跳过的披露（**已闭环** `90034946` + `54942da9` + `37c93068` + `2673e044` + `73252ad7` + `05006854` + `966ea01e` + 本条登记）

- **目标**：运行详情与 PR 正文展示 `alertsTruncated`、按原因分组的 `alertsSkipped` 与未关闭告警数，避免「部分修复」被读成「全部修复」。
- **优先级**：P2
- **范围**：
  - `packages/core/src/report/types.ts:35-48`（新增 `alertsSkippedByReason`（不含截断）+ `alertsTruncatedBySeverity`，保持 `alertsSkipped` / `alertsTruncated` 总数兼容）；`packages/engine/src/app/repo-fix.ts:231,276,673,752` / `repo-report.ts:27`（按原因 / 严重级别累加）；`packages/core/src/report/markdown-generator.ts:59-61`（报告表）；`packages/engine/src/github/pr-creator.ts:540-724`（`generatePRBody` 的跳过区块）。
  - `apps/platform/app/components/run-detail-dialog.vue` + `components/run-outcome-breakdown.vue`（新增）+ `components/repo-history-dialog.vue` + `pages/scans.vue`（展示）；`apps/platform/i18n/locales/{zh-CN,en-US}.json`；e2e / 视觉 fixtures。**批次汇总未做**（条目内可选）。
- **验收标准**：
  - [x] ① 详情显示 `未修复 20 / 26 · 截断 6（未评估）· 跳过 4` 形式的分组；无跳过 / 截断时不显示空区块；列表增加紧凑 Tag。
  - [x] ② PR 正文含 Summary 的 Skipped / Truncated / Unfixed 与 `Not Fixed / Skipped` 分组表；Markdown 报告同口径；zh / en 文案成对。
  - [x] ③ 旧 `summaryJson` 缺分组字段时回退 `other` 总数，不抛错；`sum(alertsSkippedByReason) === alertsSkipped`、`sum(alertsTruncatedBySeverity) === alertsTruncated`，并有 helper / 引擎真实路径断言。
  - [x] ④ 单测覆盖分组累加、告警级未修复、旧数据回退与 PR / Markdown 文案；视觉基线按新增分组更新并连续两次无更新比对。
- **不做什么**：不改跳过策略与跨 major 判定；不放开 `allowMajorUpgrade`（仓库级开关见 backlog「仓库级 `allowMajorUpgrade` 开关」）；不改 PR 正文的既有指纹与去重逻辑。
- **依赖**：`report/types.ts` 既有 `alertsSkipped` / `alertsTruncated`；`repo-fix.ts` 累加点；M46.1 的未修复口径可复用；M46.5 消费 `alertsTruncatedBySeverity` 披露截断高危。
- **交付物（实际）**：7 commits（不含本条登记）/ 47 文件 / 1090 插入。拆分：`90034946` core 分组字段 + Markdown（9 文件）；`54942da9` engine 跳过归组 + 告警级未修复（10）；`37c93068` engine PR 正文 + summary 夹具（8）；`2673e044` platform 详情 / 列表 / i18n（8）；`73252ad7` 失败快照重算 + fixtures schema（5）；`05006854` e2e + 视觉基线（5）；`966ea01e` 设计与标准文档（2）。**超原估**（8-12 文件 / 250-400 行）的主因：R1 审计发现 `alertsFixed` 是 action 数，修复为告警级 `alertsUnfixed`（同包多 GHSA / 跨 major 部分满足）并补 converged 告警级计数；`/scans?run=` 实际挂载 `repo-history-dialog`（与 alerts 侧栏 `run-detail-dialog` 为两套详情），两者都需披露；另补列表 / 两详情 / 结果缺失的 e2e 与视觉前置断言。
- **风险与缓解**：**R1 分组口径漂移**（引擎累加点与展示口径不一致）→ 原因常量单一事实源 + 分组求和断言 + 与 core 枚举同序单测；**R2 PR 正文膨胀** → 分组表最多约 9 行，且紧跟 Summary、尾部截断不吞披露；**R3 旧数据降级遗漏** → 纯函数防御式解析 + `other` 回退用例；**R4 未修复用 action 数冒充告警数** → 新增告警级 `alertsUnfixed`，同包多告警 / 跨 major 部分满足用例；**R5 失败快照保留内存未修复数** → `alertsFixed=0` 时同步按 `found − converged` 重算。
- **闭环记录（2026-10-21）**：**审计** R1 `standard` 两分区（A core/engine · B UI/视觉/文档）：B **Pass**（4 warning），A **Reject**（1 blocker：unfixed 用 action 数冒充告警数；5 warning：not-fixable 吞 dedupe 已修复告警 / code-quality 落子目录桶 / 未修复分母含截断语义误导 / PR 分组区块过靠后 / 覆盖不足）→ 收口（新增 `alertsUnfixed` + 告警级 converged、not-fixable 逐条残差、code-quality 排除、文案改为「已评估 / 截断未评估」、PR 区块紧跟 Summary、补同包多告警 / 跨 major / not-fixable / 分组求和用例）→ R2 `quick` **Reject**（B1 残差：converged 仍包级；失败快照保留内存 `alertsUnfixed`；§5.7 / JSDoc 旧公式）→ 收口（converged 改告警级 + 同包两告警收敛用例、失败快照重算、文档/JSDoc 同步）→ R3 `quick` **Pass**（0 blocker；1 warning：versioned overrides 收敛分支当前不可达，已加防御性注释；2 suggest 已收口）。**门禁**：定向 vitest 257 passed（含 summary-counters / result-assembly / non-fixable / index-isolation / scan-orchestrator / pr-creator / run-view）；全量 e2e 干净库 200 passed + 1 flaky（scan-config 记住上次选择，单独重跑通过）；`test:visual` 16 passed ×2（update 后连续两次 no-update；基线人工查看 `未修复 20 / 26 · 截断 6（未评估）· 跳过 4`、`Critical 2` / `High 4` / `跨大版本 / 人工复核 4`）；`pnpm run lint` 0 error（3 warning：alerts.vue / scans.vue / scan-orchestrator.test 存量 max-lines）；`pnpm run typecheck` 7 包 Done；core / engine / platform build exit 0；`check:docs` / `check:doc-size`（warning 0）/ `lint:md:check` / `lint:i18n` / `check:orphan-ids`（0 命中）通过。**残余**：① 批次汇总 `batch-aggregate` 未扩展（条目内可选）；② `versioned overrides` 的 `alertsConverged` 告警级累加分支当前不可达（上游已按 overrides 非空过滤，保留防御性注释）；③ code-quality findings 现在计入未修复但不进入跳过原因（与 code-scanning 同源，由 Code Quality Findings 区展示）；④ B 模式 artifact 仍为 `as RunResult` 断言，缺 `summary` 的畸形 result 可能被外层 catch 归为 `orchestration_failed`（低概率既有风险）。

### M46.3 [P2 🛠️] 基线采样完整链与门禁回滚粒度（**已闭环** `d76dcea8` + `a0b5adf8` + `dd195219` + `e1fb087c` + `532552d7` + `87f0c0d6` + 本条登记）

- **目标**：修复前基线不再因首条命令失败而漏采后续（尤其 `test`）；门禁不再整仓回滚连带丢弃已验证通过的探针。目标可证伪：同一仓库的基线结果包含全部命令段；失败单元回滚后已通过探针仍可交付。
- **优先级**：P2
- **范围**：
  - `packages/engine/src/app/verify-project.ts:90-180`（基线改为完整链、各段独立记录；为 `SCRIPT_NOT_FOUND` / `No tests found` / 工具链缺失设与 `PRE_EXISTING_FAILURE` 同族豁免）；`packages/engine/src/runners/verification-runner.ts`（命令结果透传）。
  - `packages/engine/src/runners/verification-gate.ts:41-43`（回滚粒度）；`packages/engine/src/app/repo-fix*.ts`（探针边界与提交点）。
  - 设计口径同步：`docs/design/modules/dependency-fixer-records.md` + `docs/design/governance/run-failure-taxonomy.md`（基线 / 回滚语义）。
- **验收标准**：
  - [x] ① 基线即使首条命令失败，仍记录后续命令结果；`test` 进入基线，`No tests found` 不再被误判为本次引入。
  - [x] ② 修复后仅对「本次引入失败」的变更单元回滚；已通过探针不被整仓回滚，或在不支持细粒度时显式记录降级原因与影响范围。
  - [x] ③ 用例覆盖 nest-template 形态（install 失败 + jest `No tests found`）与 picgo 形态（真实 TS 回归 + 已通过探针）；负例证明修复前会被整仓回滚。
  - [x] ④ `preExistingDirty` 保护面不变；整仓回滚保留为逃生开关；回滚语义变更登记风险与审计。
- **不做什么**：不做探针合批（见 backlog「升级探针合批与门禁回滚粒度联动」）；不改默认验证命令链；不改既有失败基线归因；不动 `preExistingDirty` 的用户改动保护。
- **依赖**：M44.1 归档风险 R1（基线前缀覆盖）；2026-10-17 生产实证（nest-template / picgo）；本阶段从 backlog 上收「基线采样首失败即停」候选。
- **交付物（实际）**：6 commits / 29 文件 / 926 插入（+ 本条登记）。拆分：`d76dcea8` 基线完整链（4）；`a0b5adf8` 回滚粒度配置 / CLI（5）；`dd195219` 单元 checkpoint / 选择性回滚 / 降级审计（10）；`e1fb087c` 平台配置贯通 / 分类映射（3）；`532552d7` 设计 / 配置文档（6）；`87f0c0d6` 门禁边界说明（1）。**D 阶段确认**：用户 2026-10-21 选择「单元 checkpoint + 单次重验」（默认 `unit`；`repo` 为逃生）。**超原估**主因：checkpoint 恢复需同步 actions / errors / progress / summary，且需覆盖真实 TS 回归、dirty 跳过、降级审计与平台配置贯通。
- **闭环记录（2026-10-21）**：**审计** R1 `standard` 两分区（A 基线 / B 回滚）：A **Pass**（3 warning / 3 suggest）；B **Reject**（1 blocker：平台 `RuntimeConfig` 未贯通 `rollbackGranularity`，CI rebuild 后平台 tsc 必红且平台静默维持整仓回滚；8 warning / 6 suggest）→ 收口（平台生产 config + env 逃生、executor 夹具、optional 字段 + 引擎缺省 unit、no-checkpoint / later-failed 降级审计、平台分类映射、taxonomy 章节归位、en 配置行、真实 tsc 用例、`preExistingDirty` 禁用选择性、CLI 大小写、repair 重做仅变更时、回调异常兜底）→ R2 `quick` **Pass**（0 blocker；3 新 warning：平台 env 大小写 / allErrors 归因文案 / 陈旧注释；2 suggest：repair 失败 action / CLI 大写用例）→ 逐项收口（trim+lowercase + 非法告警、文案、陈旧注释、repair 失败跳过选择性、`REPO` 用例）。**门禁**：engine **1437 passed / 1 skipped**（81 文件）；platform **2039 passed / 9 skipped**（154 文件）；root `pnpm test` 复跑 exit 0（首轮并行临时失败未复现）；`pnpm run typecheck` 7 包 Done；`pnpm run lint` 0 error（3 条存量 max-lines warning）；engine build exit 0；`check:docs` / `check:doc-size`（warning 0）/ `lint:md` / `lint:i18n` / `check:orphan-ids`（0）/ `check:verify-chain` 通过。**残余**：① 基线完整链最坏 5×10min，仅对「有工作」仓库采样，长 install 失败 + 超时可能挤压单仓预算（未做真实 repo 计时）；② 选择性回滚只尝试最近单元一次，失败并非最近单元 / 后续失败单元 / 无 checkpoint → 显式降级整仓；③ checkpoint 仅已跟踪文件，AI 新建未跟踪文件 / 用户 staged vs unstaged 区分不在回退面；④ Windows / LFS / submodule / shallow clone 未实机；⑤ 平台 env 非法值回退 unit 并 console.warn（不 fail-fast）；⑥ 真实 nest-template / picgo 目标仓库端到端未跑（由 mock 分层 + 真实 tsc 覆盖）。
- **风险与缓解**：**R1 回滚粒度变更影响交付安全** → 设计先行 + 反例测试 + 逃生开关，默认行为变更须在 D 阶段向用户确认；**R2 共享 workDir 限制**（多仓共享目录无法天然按仓回滚）→ 先做「按已通过探针提交 / 失败单元回滚」的可行性探测，做不到则显式降级并保留 repo 级；**R3 基线耗时上升** → 仅对已确定有工作的仓库采样，沿用 M45.2 豁免。

### M46.4 [P1 🛠️] 执行容器内存下限与 OOM 归因

- **目标**：统一控制面与执行面的内存口径，并在启动期 / 运行期留下可观测信号，使 `SIGKILL` 可归因到 OOM 而非超时或代码缺陷。
- **优先级**：P1
- **范围**：
  - `docs/guide/deployment.md:10`（1 CPU / 1GB → 区分控制面最低与执行面 ≥ 8GB）+ `docs/i18n/en-US/guide/deployment.md` + `docs/guide/configuration.md` + 部署 compose（若存在默认资源）。
  - 启动期：`apps/platform/server/plugins/**`（记录 cgroup / 宿主机内存 + 并发，低于建议值 warn，不阻断）。
  - 运行期：`apps/platform/server/entities/scan-run.ts` 新增 `memory_max_bytes` / `peak_rss_bytes` / `oom_killed`（或 `resource_json`）；`services/executor/**` 采集（Linux cgroup，其他平台降级）。
  - 设计口径同步：`docs/design/governance/executor-process-isolation.md` §8.4。
- **验收标准**：
  - [ ] ① 部署文档与治理设计口径一致：控制面最低规格与执行面 ≥ 8GB 分列，不再出现「按 1GB 部署即执行安装」的误导。
  - [ ] ② 启动日志包含检测到的内存上限与并发；低于建议值时 warn，不阻断启动。
  - [ ] ③ 运行记录可查询峰值内存与 OOM 标记；不可采集时明确降级为 `NULL` 并记录原因，不伪造 0。
  - [ ] ④ 单测覆盖阈值判定与跨平台降级；文档链接 / i18n / 构建门禁通过。
- **不做什么**：不自动调高容器限制；不做 K8s 资源模板（T705 暂缓，见 [backlog.md](backlog.md)）；不改变 `Repository.sandboxLimits` 默认 2048MB（若 D 阶段裁定调整则单列）；不做实时监控面板。
- **依赖**：2026-10-17 内核 OOM 实证（41 次 `SIGKILL`，`journalctl -k` 实测）；`executor-process-isolation.md` §8.4 建议值；`Repository.sandboxLimits` 既有按仓限额。
- **交付物**：预计 3 commits / 10-14 文件 / 250-400 行——① `docs(guide)` 双语口径 + compose 默认（4-6 文件 / 80-120 行）；② `feat(platform)` 启动期探测 + 运行期采集 + 迁移（4-5 / 120-200）；③ `test` 阈值判定 / 跨平台降级（2-3 / 50-80）。
- **风险与缓解**：**R1 跨平台采集差异**（Windows dev 无 cgroup）→ 仅 Linux 采集，其他平台降级并记录；**R2 指标开销** → 采样阈值与只读 cgroup 文件；**R3 文档口径再次漂移** → 以治理设计为权威源，配置指南与 compose 单点引用。

### M46.5 [P2 🚀] 平台通知与邮件推送（issue #190）（**B1-B4 已闭环；B5 延期** `eea2c581` + `104952f6` + `3aa8955f` + `4a65d9e5` + `253ea52b` + `61354f99` + `23cf9f79` + `b3c6cf49` + `19d69f1a` + `fd731c28` + `e0ac9a15` + `13c69da2` + `8210ec60` + 本条登记）

- **目标**：落地 [platform-notification.md](../design/governance/platform-notification.md) 的四类事件（平台自身问题 / 高危告警 / 运行失败 / 完成摘要，外加可选周汇总）、三层配置（部署 / 组织 / 个人）、分流收件人与 24 小时去重；默认只在失败与未修复高危时打扰。
- **优先级**：P2
- **范围**：按设计稿 B1-B5 分批——① 迁移 + 实体字段（`notification_preference` / `notification_log` / `organization.notification_settings_json` / `scan_run` 与 `batch_run` 的 `triggered_by_user_id`）；② 策略层（事件分类、设置解析、个人偏好、收件人路由、高危查询、指纹 / 窗口纯函数）；③ 投递层（统一入口、幂等占位、模板、run / batch 触发点、平台事件接续）；④ 配置与展示（6 个 API + 个人卡片 + `/notifications` 管理员页 + i18n）；⑤ 可选周汇总（固定周期插件，默认关闭）——**本批未纳入，延期 backlog；UI 开关置灰并提示后续版本提供**。
- **验收标准**：
  - [x] ① 默认策略符合设计稿 §13：完成类默认不发、失败类发送、高危仅未修复、平台事件必选；组织关闭后个人无法开启。
  - [x] ② 收件人：平台事件仅管理员；业务事件定向 `triggeredByUserId` + 已开启该类别的管理员；标题含 `[平台]` / `[告警]` / `[运行]` / `[摘要]`（`[周报]` 随 B5）。
  - [x] ③ 降噪：一个批次只发一封高危；相同指纹不再重复发送；指纹变化且距上次超过 24 小时才再次发送；窗口内记 `skipped_cooldown`。
  - [x] ④ 失败语义：SMTP 未配置 noop；发送异常不阻断扫描；投递记录可查；迁移二次执行幂等。
  - [x] ⑤ 测试覆盖策略 / 路由 / 指纹 / 窗口 / 模板转义 / API 权限 / 迁移幂等；批次终态服务测试断言只发一封。
  - [x] ⑥ 截断高危以「另有 N 条截断未纳入明细」披露（读取 M46.2 的 `alertsTruncatedBySeverity`），不少报。
  - [x] ⑦ 部署总开关可熔断全部通知；SMTP 不可用时管理员页 / 个人页提示。
  - [x] ⑧ 组织设置写操作登记 `notification_settings_update` 审计事件；通知记录 / 测试发送仅 admin / org_admin。
  - [x] ⑨（不纳入）周汇总按设计稿 §12 移出至 backlog；本批不宣称 AC⑨ 完成。
- **不做什么**：不实现 Slack / Webhook 真实投递；不做仓库订阅关系；不做一键退订令牌；不做通用摘要调度器（周报为固定周期插件）；不在本期做通知历史独立页面（投递记录并入 `/notifications`）。
- **依赖**：设计稿 [platform-notification.md](../design/governance/platform-notification.md)（2026-10-20 决策已定稿）；现有 `notification/` 渠道注册表与 `mailer/`；M46.1 / M46.2 的未修复高危与截断高危口径；[issue #190](https://github.com/dependfix/dependfix/issues/190)（用户 2026-10-20 明确授权纳入方案 A）。
- **交付物（实际）**：13 commits / 83 文件 / 4119 插入（含导航新增导致的 12 张存量视觉基线同步；B5 未纳入）。拆分：`eea2c581` 承载实体 + 迁移（8）；`104952f6` 设置 / 偏好 / 降噪纯函数（7）；`3aa8955f` 收件人 + 高危查询（5）；`4a65d9e5` 投递幂等 + 业务模板（4）；`253ea52b` 渠道注册 + 平台事件（8）；`61354f99` 单仓 / 批次终态服务（3）；`23cf9f79` 触发者写入 + 单仓终态（8）；`b3c6cf49` 批次写回触发（4）；`19d69f1a` 6 API + 错误码 + 审计类型（10）；`fd731c28` 管理员页 / 个人卡片 / i18n（6）；`e0ac9a15` 通知页视觉基线（8）；`13c69da2` 权限 e2e + 存量基线（8）；`8210ec60` 设计 / env / backlog 文档（2）。**超原估**的主因：B4 同时落 6 API + 两处 UI + 视觉基线；导航新增一项使 12 张存量页面截图整体位移；审计后补部署熔断、唯一冲突重放、sending 回收、失败路径通知、Postgres DDL、审计事件与 API 权限测试。
- **闭环记录（2026-10-21）**：**审计** R1 `standard` 两分区（A 数据/策略/投递/触发 · B API/UI/视觉/文档）：B **Pass**（9 warning）；A **Reject**（1 blocker：`DEPENDFIX_NOTIFICATION_ENABLED` 未接入投递链；7 warning：平台唯一冲突被吞 / sending 无回收 / 失败路径漏通知 / weekly_digest 空开关 / extra 收件人绕过 / Postgres DDL / completed 默认关闭仍写日志）→ 收口（部署熔断入口、唯一冲突 rethrow + 平台键、10 分钟 sending 回收、catch-all / stale-cleanup 通知、周报 UI 置灰、recipients 部署防御、Postgres 类型、completed 开关；业务模板 locale；B 区 test.post 脱敏、组织设置审计、设计 §9、刷新 / 保存 / label / 权限测试）→ R2 `quick` **Pass**（0 blocker；W0 JSON 缩进 / W1 重复分支覆盖 notified / W2 多渠道键 / W4 extra 函数内防御 / W6 管理员页熔断状态 / W7 文档路径与 env 登记 / W8 刷新 loading / W9 实体默认值）→ 逐项收口（含 AuditEvent 事务 + 测试、平台重放 / 部署 / 回收测试）→ 终验。**门禁**：定向 vitest **280 passed**（25 文件：notification services/API/migration + scan/retry/batch/orchestrator/localized-error）；全量 e2e 干净库 **202 passed + 2 flaky**（alerts-rowgroup 排序 / scan-config 记忆，属既有 flake，exit 0）；`test:visual` **17 passed ×2**（含 `/notifications` 基线；导航新增入口导致存量基线整体位移）；`pnpm run lint` 0 error（3 条存量 max-lines warning）；`pnpm run typecheck` 7 包 Done；core / engine / platform build exit 0；`check:docs` / `check:doc-size`（warning 0）/ `lint:md:check` / `lint:i18n` / `check:orphan-ids`（0）通过。**残余**：① B5 周汇总延期 backlog，UI 开关置灰；② 视觉 / e2e 未注入 notification_log，投递记录区只覆盖空表；③ 收件人使用 `To:` 互见，未做 BCC；④ notification_log 无保留期 / 清理策略；⑤ 批次失败邮件缺 failureCode / failureStage / 失败仓库清单；⑥ 仅 SQLite 迁移测试，Postgres / MySQL DDL 分支未实机；⑦ `weeklyDigest` API 仍可写 true（UI 置灰），B5 上线时需清理存量 true / 迁移提示；⑧ catch-all / stale-cleanup 的通知调用无直接断言（仅代码审阅）。
- **风险与缓解**：**R1 邮件风暴** → 批次合并 + 24 小时窗口 + 每小时上限；**R2 漏发关键告警** → 窗口可调至 0 + 周汇总兜底；**R3 收件人扩散** → 仅触发者 + 管理员，上限与去重；**R4 触发点重复** → 条件写回成功 + `deliveryKey` 唯一；**R5 迁移风险** → 幂等迁移 + 启动备份 + 二次执行测试。

### M46.6 [P3 🧪] 视觉套件测试库 fixtures 前置断言（**已闭环** `d2b64886` + `00eacfce` + 本条登记）

- **目标**：本地视觉复跑前校验 `visual.sqlite` 的仓库集合与 fixtures 集合一致，残留非 fixtures 仓库时在像素比对前失败并给出可操作提示，避免把「库污染」误判为代码回归。
- **优先级**：P3
- **范围**：`apps/platform/server/utils/visual-repository-set.ts`（纯集合比较 / 清理编排 / 允许集合防线）+ 单测；`apps/platform/server/utils/visual-repository-client.test.ts`（HTTP 适配器异常分支）；`apps/platform/tests/visual/helpers/visual-db.ts`（Playwright 适配器）；`apps/platform/tests/visual/global-setup.ts`（清理 → 注入 → 断言）；`apps/platform/tests/visual/README.md`（操作约定与已知边界）；`docs/standards/testing.md §6.7`（一行指针）；`apps/platform/server/api/repos/index.ts`（全量返回依赖注释）。
- **验收标准**：
  - [x] ① 残留非 fixtures 仓库时，在截图前失败并列出多余 / 缺失仓库，不进入像素比对。
  - [x] ② 清理通道只允许删除视觉库内、非 fixtures 白名单仓库；幂等且不触碰主库。
  - [x] ③ CI 全新库行为不变；本地污染库按提示清理后复跑通过。
  - [x] ④ 测试覆盖集合比较与清理边界（幂等 / 非白名单拒绝 / 空与非法 allowlist / 适配器异常）。
- **不做什么**：不改视觉阈值与基线；不做全站覆盖；不改 `resetVisualFixtures` 的既有注入语义（仅补前置断言与清理通道）。
- **依赖**：2026-10-19 M45.6 审计探针实测残留 3 条 `parp3-*` 记录（复现：`sqlite3 apps/platform/data/visual.sqlite 'select owner,name from dependfix_repository'`）导致视口级基线失配；M45.5 / M45.6 视觉工程。
- **交付物**：2 commits / 8 文件——`d2b64886` 实现 6 文件（纯集合逻辑 + 2 个测试文件 + Playwright 适配器 + global-setup + repos 端点注释）；`00eacfce` 文档 2 文件（visual README + testing.md 指针）；本条登记 1 文件。
- **风险与缓解**：**R1 误删视觉库数据** → 空 / 非法 allowlist 在删除前拒绝 + 只删 extra + 幂等用例；**R2 误作用主库** → 清理作用于视觉服务进程当前 `DATABASE_PATH`（config 固定 `data/visual.sqlite`），README 明示不得指向主库；**R3 CI 行为变化** → 全新库空集场景纳入测试；**R4 集合真值依赖 `GET /api/repos` 全量返回** → 端点注释 + README 已登记，分页化时须同步调整。
- **闭环记录（2026-10-20）**：**审计** R1 `quick` **Pass**（0 blocker / 2 warning：空 allowlist 可清库、适配器零测试）→ 收口（空 / 非法 allowlist 防线 + 适配器 7 例 fail-fast 测试 + README / testing.md 指针）→ R2 `quick` **Pass**（0 blocker / 0 warning；5 suggest 中 4 项收口，测试文件位置注释 / allowlist 条目校验 / JSON 解析包装 / README 措辞）。**门禁**：`pnpm run lint` 0 error（2 条存量 max-lines warning）；`pnpm run typecheck` 7 包 Done；定向单测 26 passed；`test:visual` 16 passed（日志含 `repository set verified`）；污染实证：向视觉库插入 `parp3/probe` 后重跑自动清理并 16 passed，事后库内仅 3 条 fixtures；`check:docs` / `check:doc-size` / `lint:md:check` OK；改动源文件编号标记扫描 0 命中。
- **残余与观察项**：① 清理不级联 `schedule.repositoryIds`（JSON 引用），视觉库不应创建定时计划；② 集合按 `owner/name` 比较，同 key 不同 platform 属不可达路径；③ 测试文件因 vitest 排除 `tests/visual` 而放在 `server/utils`，文件头已注明原因。
