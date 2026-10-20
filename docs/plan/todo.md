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

- **M46.1** [P1 🎨] 环境性失败与「有告警未修」的可见性
- **M46.2** [P2 🎨] 跨 major / 截断 / 子目录跳过的披露
- **M46.3** [P2 🛠️] 基线采样完整链与门禁回滚粒度
- **M46.4** [P1 🛠️] 执行容器内存下限与 OOM 归因
- **M46.5** [P2 🚀] 平台通知与邮件推送（issue #190）
- **M46.6** [P3 🧪] 视觉套件测试库 fixtures 前置断言

**建议执行顺序**：M46.6（最小、先清本地噪声）→ M46.1（P1 可见性，先落数据层）→ M46.2（复用同一 summary 承载）→ M46.5（通知消费未修复高危口径）→ M46.3（引擎基线，独立）→ M46.4（部署口径，独立）。若阶段容量收紧，M46.6 与 M46.5 的 B5 周汇总可优先移出。

**范围边界（不做什么）**：不改 exit code 语义与 failure taxonomy（M46.1）；不改跨 major 跳过策略、不新增仓库级 `allowMajorUpgrade` 开关（M46.2）；不做探针合批、不改默认验证命令链（M46.3）；不自动调高容器限制、不做 K8s 资源模板（M46.4）；不实现 Slack / Webhook 真实投递、不做仓库订阅与一键退订令牌（M46.5）；不改视觉阈值、不做全站基线（M46.6）。

**审计 depth 预告**：M46.1 / M46.2 / M46.4 / M46.5 → `standard`（M46.5 建议 2 分区并发：数据与策略 / 投递与 UI）；M46.3 → `deep`（验证门禁回滚语义变更）；M46.6 → `quick`。**M46.5 depth 判定口径**：按 B1-B5 拆至单 commit ≤ 10 文件 / ≤ 800 行后按单 commit 判定；任一批超限升 `deep`。

**§3.4 阶段启动交叉核验（2026-10-20）**：6 项均完成三重核验，**0 项重复评估**。① 归档表格扫描（`环境性失败` / `alertsSkipped` / `首失败即停` / `内存下限` / `邮件通知` / `视觉库`）仅命中来源批次与残余观察项，无已闭环实现；② `git log --oneline -- <路径>` 确认相关文件最近改动均未覆盖本阶段范围（`scan-run.ts` 最近 `741b72c` 为重试来源列 / `verify-project.ts` 最近 `eb9f094` 为交付守卫 / `verification-gate.ts` 最近 `7f01d3b` 为留痕 / `notification/policy.ts` 仅 `e80b7b0` 环境事件扩展）；③ 代码 anchor 逐项实证仍开放（`scan-run.ts` 无 `exitCode` 列、`run-detail-dialog.vue` 无 `alertsSkipped` 展示、`verify-project.ts:100` 首失败即停、`deployment.md:10` 仍写 1GB、`policy.ts` 仅 3 类环境事件、`tests/visual/global-setup.ts` 无仓库集合断言）。

**决策记录（2026-10-20 用户裁定）**：① 方案 A 六条目；② 邮件通知分必选（平台自身问题）与可选（高危 / 失败 / 完成摘要），完成类默认不发；③ 收件人定向触发者（新增 `triggeredByUserId`），管理员区分平台问题与告警问题；④ 24 小时窗口 + 指纹变化才再次发送 + 内容不变不重复；⑤ 全局配置落 `/notifications` 管理员页；⑥ 周汇总为可选项（默认关闭）。

---

### M46.1 [P1 🎨] 环境性失败与「有告警未修」的可见性

- **目标**：让「运行完成但存在环境性失败 / 有可修告警却 0 修复」在运行列表与详情可见，而不是显示为纯成功；引擎 exit code 与环境性失败计数落库，形成可查询的事实。
- **优先级**：P1
- **范围**：
  - `packages/core/src/report/types.ts`（`RunSummary` 新增环境性失败计数）；`packages/engine/src/app/result-assembly.ts:146-181`（环境性动作统计）；`packages/engine/src/app/repo-fix.ts` / `repo-fix-finalize.ts`（累加点）。
  - `apps/platform/server/entities/scan-run.ts`（新增 `exit_code` / `environmental_failure_count`）；新增幂等迁移并登记 `server/database/index.ts` 与迁移注册表测试。
  - `apps/platform/server/services/scan-orchestrator.service.ts:397-467`（终态落库）；`scan-run-state.ts:96-142`（复用同一判定，避免双源）；`apps/platform/server/api/scan-history/**`（序列化）。
  - `apps/platform/app/pages/scans.vue` + `components/run-detail-dialog.vue`（行标记 / 详情区块）；`app/utils/run-view.ts`（派生函数）。
- **验收标准**：
  - [ ] ① 新 run 落 `exit_code` 与 `environmental_failure_count`；旧数据为 `NULL` / `0` 时 API 与 UI 正常降级，不报错。
  - [ ] ② 列表与详情在计数 > 0 时显示「环境性失败 N」与「未修复告警 N」，tooltip 说明「不归因本次运行但可见」；计数为 0 时不显示噪音标记。
  - [ ] ③ 超时 / 无 `result` 的 run 显示「结果缺失」并保留 `execution_timeout` 分类，不误报成功；该 run 不参与告警明细 reconcile，UI 不显示误导性的「告警 0」。
  - [ ] ④ 迁移二次执行幂等；单测覆盖 summary 累加、落库映射、派生函数；页面变化时更新视觉基线。
- **不做什么**：不改 exit code 0 / 1 / 2 语义；不做历史数据全量回填；不新增独立页面；不改 `run-failure-classify.ts` 的分类表（真实安装失败被并入环境性的分类语义收窄见 backlog「环境性失败分类语义收窄」）。
- **依赖**：2026-10-17 / 18 生产复盘（13 仓库「有告警 / 0 修复」）；`run-failure-classify.ts` 既有 `failure_kind`；M43.3 环境性归因与 M45 交付守卫（交接来源）。
- **交付物**：预计 3-4 commits / 10-14 文件 / 300-450 行——① `feat(core/engine)` summary 环境性计数（3-4 文件 / 80-120 行）；② `feat(platform)` 实体列 + 幂等迁移 + 终态落库（3-4 / 100-150）；③ `feat(platform)` 列表 / 详情标记 + 序列化（2-3 / 80-120）；④ `test(platform)` 派生函数与视觉基线（2-3 / 40-60）。
- **风险与缓解**：**R1 双源判定漂移**（内存 exitCode 与落库计数不一致）→ 判定抽纯函数单一事实源 + 映射用例；**R2 UI 误读**（把「环境性失败」读成仓库代码问题）→ 文案与 tooltip 明确「不归因」；**R3 报告契约变更**（summary 新字段影响快照）→ core 类型契约测试 + 旧报告降级。

### M46.2 [P2 🎨] 跨 major / 截断 / 子目录跳过的披露

- **目标**：运行详情与 PR 正文展示 `alertsTruncated`、按原因分组的 `alertsSkipped` 与未关闭告警数，避免「部分修复」被读成「全部修复」。
- **优先级**：P2
- **范围**：
  - `packages/core/src/report/types.ts:35-48`（新增 `alertsSkippedByReason`（不含截断）+ `alertsTruncatedBySeverity`，保持 `alertsSkipped` / `alertsTruncated` 总数兼容）；`packages/engine/src/app/repo-fix.ts:231,276,673,752` / `repo-report.ts:27`（按原因 / 严重级别累加）；`packages/core/src/report/markdown-generator.ts:59-61`（报告表）；`packages/engine/src/github/pr-creator.ts:540-724`（`generatePRBody` 的跳过区块）。
  - `apps/platform/app/components/run-detail-dialog.vue` + `pages/scans.vue`（展示）；`apps/platform/server/services/batch/batch-aggregate.ts`（可选批次汇总）；`apps/platform/i18n/locales/{zh-CN,en-US}.json`。
- **验收标准**：
  - [ ] ① 详情显示 `20/26（6 截断，4 跨大版本）` 形式的分组；无跳过时不显示空区块。
  - [ ] ② PR 正文含同样的分组与「未关闭告警」计数；zh / en 文案成对。
  - [ ] ③ 旧 `summaryJson` 缺分组字段时降级显示总数，不抛错；`sum(alertsSkippedByReason) === alertsSkipped`、`sum(alertsTruncatedBySeverity) === alertsTruncated`。
  - [ ] ④ 单测覆盖分组累加与文案；报告快照 / 视觉基线按变化更新。
- **不做什么**：不改跳过策略与跨 major 判定；不放开 `allowMajorUpgrade`（仓库级开关见 backlog「仓库级 `allowMajorUpgrade` 开关」）；不改 PR 正文的既有指纹与去重逻辑。
- **依赖**：`report/types.ts` 既有 `alertsSkipped` / `alertsTruncated`；`repo-fix.ts` 累加点；M46.1 的未修复口径可复用；M46.5 消费 `alertsTruncatedBySeverity` 披露截断高危。
- **交付物**：预计 2-3 commits / 8-12 文件 / 250-400 行——① `feat(core/engine)` 分组字段 + PR 正文（4-5 文件 / 120-180 行）；② `feat(platform)` 详情 / 列表展示 + i18n（3-4 / 100-150）；③ `test` 快照 / 视觉基线（1-3 / 30-70）。
- **风险与缓解**：**R1 分组口径漂移**（引擎累加点与展示口径不一致）→ 原因常量单一事实源 + 分组求和断言；**R2 PR 正文膨胀** → 单封 / 正文最多列 50 条，其余折叠；**R3 旧数据降级遗漏** → 纯函数防御式解析 + 用例。

### M46.3 [P2 🛠️] 基线采样完整链与门禁回滚粒度

- **目标**：修复前基线不再因首条命令失败而漏采后续（尤其 `test`）；门禁不再整仓回滚连带丢弃已验证通过的探针。目标可证伪：同一仓库的基线结果包含全部命令段；失败单元回滚后已通过探针仍可交付。
- **优先级**：P2
- **范围**：
  - `packages/engine/src/app/verify-project.ts:90-180`（基线改为完整链、各段独立记录；为 `SCRIPT_NOT_FOUND` / `No tests found` / 工具链缺失设与 `PRE_EXISTING_FAILURE` 同族豁免）；`packages/engine/src/runners/verification-runner.ts`（命令结果透传）。
  - `packages/engine/src/runners/verification-gate.ts:41-43`（回滚粒度）；`packages/engine/src/app/repo-fix*.ts`（探针边界与提交点）。
  - 设计口径同步：`docs/design/modules/dependency-fixer-records.md` + `docs/design/governance/run-failure-taxonomy.md`（基线 / 回滚语义）。
- **验收标准**：
  - [ ] ① 基线即使首条命令失败，仍记录后续命令结果；`test` 进入基线，`No tests found` 不再被误判为本次引入。
  - [ ] ② 修复后仅对「本次引入失败」的变更单元回滚；已通过探针不被整仓回滚，或在不支持细粒度时显式记录降级原因与影响范围。
  - [ ] ③ 用例覆盖 nest-template 形态（install 失败 + jest `No tests found`）与 picgo 形态（真实 TS 回归 + 已通过探针）；负例证明修复前会被整仓回滚。
  - [ ] ④ `preExistingDirty` 保护面不变；整仓回滚保留为逃生开关；回滚语义变更登记风险与审计。
- **不做什么**：不做探针合批（见 backlog「升级探针合批与门禁回滚粒度联动」）；不改默认验证命令链；不改既有失败基线归因；不动 `preExistingDirty` 的用户改动保护。
- **依赖**：M44.1 归档风险 R1（基线前缀覆盖）；2026-10-17 生产实证（nest-template / picgo）；本阶段从 backlog 上收「基线采样首失败即停」候选。
- **交付物**：预计 3-4 commits / 8-12 文件 / 300-500 行——① `feat(engine)` 基线完整链 + 豁免类（2-3 文件 / 80-140 行）；② `feat(engine)` 回滚粒度 + 逃生开关（2-3 / 100-170）；③ `test(engine)` 两类反例（2-3 / 80-140）；④ `docs(design)` 语义同步（2-3 / 40-50）。D 阶段先落设计结论再改实现。
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

### M46.5 [P2 🚀] 平台通知与邮件推送（issue #190）

- **目标**：落地 [platform-notification.md](../design/governance/platform-notification.md) 的四类事件（平台自身问题 / 高危告警 / 运行失败 / 完成摘要，外加可选周汇总）、三层配置（部署 / 组织 / 个人）、分流收件人与 24 小时去重；默认只在失败与未修复高危时打扰。
- **优先级**：P2
- **范围**：按设计稿 B1-B5 分批——① 迁移 + 实体字段（`notification_preference` / `notification_log` / `organization.notification_settings_json` / `scan_run` 与 `batch_run` 的 `triggered_by_user_id`）；② 策略层（事件分类、设置解析、个人偏好、收件人路由、高危查询、指纹 / 窗口纯函数）；③ 投递层（统一入口、幂等占位、模板、run / batch 触发点、平台事件接续）；④ 配置与展示（6 个 API + 个人卡片 + `/notifications` 管理员页 + i18n）；⑤ 可选周汇总（固定周期插件，默认关闭）。
- **验收标准**：
  - [ ] ① 默认策略符合设计稿 §13：完成类不发、失败类发送、高危仅未修复、平台事件必选；组织关闭后个人无法开启。
  - [ ] ② 收件人：平台事件仅管理员；业务事件定向 `triggeredByUserId` + 已开启该类别的管理员；标题含 `[平台]` / `[告警]` / `[运行]` / `[摘要]` / `[周报]` 标签。
  - [ ] ③ 降噪：一个批次只发一封高危；相同指纹不再重复发送；指纹变化且距上次超过 24 小时才再次发送；窗口内记 `skipped_cooldown`。
  - [ ] ④ 失败语义：SMTP 未配置 noop；发送异常不阻断扫描；投递记录可查；迁移二次执行幂等。
  - [ ] ⑤ 测试覆盖策略 / 路由 / 指纹 / 窗口 / 模板转义 / API 权限 / 迁移幂等；批次终态集成测试断言只发一封。
  - [ ] ⑥ 截断高危以「另有 N 条截断未纳入明细」披露（读取 M46.2 的 `alertsTruncatedBySeverity`），不少报。
- **不做什么**：不实现 Slack / Webhook 真实投递；不做仓库订阅关系；不做一键退订令牌；不做通用摘要调度器（周报为固定周期插件）；不在本期做通知历史独立页面（投递记录并入 `/notifications`）。
- **依赖**：设计稿 [platform-notification.md](../design/governance/platform-notification.md)（2026-10-20 决策已定稿）；现有 `notification/` 渠道注册表与 `mailer/`；M46.1 / M46.2 的未修复高危与截断高危口径；[issue #190](https://github.com/dependfix/dependfix/issues/190)（用户 2026-10-20 明确授权纳入方案 A）。
- **交付物**：预计 5 个批次 / 41-58 文件 / 1800-2850 行（B1-B5 求和，文件跨批复用；不含 B5 为 36-50 文件 / 1600-2500 行）——① B1 迁移 + 实体字段（6-8 / 200-300）；② B2 策略纯函数 + 单测（10-14 / 450-700）；③ B3 投递入口 / 幂等 / 模板 / 触发点（10-14 / 450-700）；④ B4 API + 个人卡片 + `/notifications` 管理员页 + i18n（10-14 / 500-800）；⑤ B5 周汇总（5-8 / 200-350，可选，可按容量移出）。
- **风险与缓解**：**R1 邮件风暴** → 批次合并 + 24 小时窗口 + 每小时上限；**R2 漏发关键告警** → 窗口可调至 0 + 周汇总兜底；**R3 收件人扩散** → 仅触发者 + 管理员，上限与去重；**R4 触发点重复** → 条件写回成功 + `deliveryKey` 唯一；**R5 迁移风险** → 幂等迁移 + 启动备份 + 二次执行测试。

### M46.6 [P3 🧪] 视觉套件测试库 fixtures 前置断言

- **目标**：本地视觉复跑前校验 `visual.sqlite` 的仓库集合与 fixtures 集合一致，残留非 fixtures 仓库时在像素比对前失败并给出可操作提示，避免把「库污染」误判为代码回归。
- **优先级**：P3
- **范围**：`apps/platform/tests/visual/global-setup.ts`（集合断言）；`apps/platform/tests/visual/helpers/fixtures.ts`（允许集合单一事实源 + 清理通道）；`apps/platform/tests/visual/README.md`（操作约定）；脚本级测试。
- **验收标准**：
  - [ ] ① 残留非 fixtures 仓库时，在截图前失败并列出多余 / 缺失仓库，不进入像素比对。
  - [ ] ② 清理通道只允许删除视觉库内、非 fixtures 白名单仓库；幂等且不触碰主库。
  - [ ] ③ CI 全新库行为不变；本地污染库按提示清理后复跑通过。
  - [ ] ④ 测试覆盖集合比较与清理边界（幂等 / 非白名单拒绝）。
- **不做什么**：不改视觉阈值与基线；不做全站覆盖；不改 `resetVisualFixtures` 的既有注入语义（仅补前置断言与清理通道）。
- **依赖**：2026-10-19 M45.6 审计探针实测残留 3 条 `parp3-*` 记录（复现：`sqlite3 apps/platform/data/visual.sqlite 'select owner,name from repository'`）导致视口级基线失配；M45.5 / M45.6 视觉工程。
- **交付物**：预计 2 commits / 4-6 文件 / 120-200 行——① `test(platform)` 前置集合断言 + 清理通道（2-3 文件 / 60-100 行）；② `docs(test)` 视觉 README 操作约定（2-3 / 60-100）。
- **风险与缓解**：**R1 误删视觉库数据** → 仅 allowlist + 备份 + 只读断言优先；**R2 误作用主库** → 路径校验限定 `data/visual.sqlite`；**R3 CI 行为变化** → 全新库空集场景纳入测试。
