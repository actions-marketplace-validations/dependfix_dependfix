# 当前阶段待办

> 本文件**仅**登记当前阶段活跃待办；已闭环阶段归档于 [todo-archive.md](todo-archive.md)；未排期 / 延期 / 远期 / 长期主线 / 已知边界登记于 [backlog.md](backlog.md)。

---

## 文档位置速查

| 内容类型 | 位置 |
|:--|:--|
| 当前阶段任务 | **M47「交付判定可信与运行自证」**（6 原子条目，2026-10-22 用户决策方案 A′；见下方 §M47） |
| 下一阶段（未授权） | 无——M47 闭环归档后按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 重新评估候选池 |
| 已完成阶段归档 | [todo-archive.md](todo-archive.md)（主窗口 + [archive/](archive/) 分片；M0-M46 全部已归档） |
| 里程碑与阶段交付 | [roadmap.md](roadmap.md)（M0-M46 已归档，M47 进行中） |
| 未排期 / 延期 / 远期 / 长期主线 / 已知边界 | [backlog.md](backlog.md) |
| 历史归档索引 | [archive/index.md](archive/index.md) |

---

## M47: 交付判定可信与运行自证（2026-10-22 用户决策方案 A′）

承接 M46 归档后的「**判定可信、运行可自证**」阶段。M46 已把「有告警未修 / 环境性失败 / 跳过与截断」变成可见；本阶段继续收口三条生产信任缺口：① PR 正文的验证红字与目标仓库 CI 的绿/红不是同一口径，用户无法判断「PR 是否真的过 CI」（**M47.1**，2026-10-18 生产复盘）；② 日志缺行时无法区分「线上构建旧」与「代码路径未覆盖」，且 `Lockfile repaired` 文案把「本就合规」读成「修好未提交」（**M47.2**，2026-10-17 生产复盘）；③ 环境性失败计数只覆盖部分路径、分类语义未收窄，真实安装失败仍可能被误归因仓库（**M47.3**，M46.1 明文残余）。另有三项工程与运行侧收口：pnpm store 随 run 清理导致冷安装与误提交风险（**M47.4**）；M46.5 B5 周汇总按阶段容量延期（**M47.5**）；三条门禁 / 提交卫生缺口（**M47.6**）。

**6 原子条目**（🎨 1 + 🛠️ 2 + 🚀 2 + 🧪 1）：

- **M47.1** [P1 🎨] 验证链与目标仓库 CI 口径对齐（差异披露 + 默认分支 workflow 健康预检）
- **M47.2** [P1 🛠️] 构建版本回执与安装日志语义订正
- **M47.3** [P2 🛠️] 环境性失败归因收口（分类收窄 + 常规升级链路）
- **M47.4** [P2 🚀] pnpm store 持久化与提交卫生
- **M47.5** [P2 🚀] 通知周汇总（`weekly_digest`，M46.5 B5）
- **M47.6** [P3 🧪] 工程门禁与提交卫生收口

**类型平衡复核**：🎨 用户体验 1（M47.1）+ 🛠️ 技术债 2（M47.2 / M47.3）+ 🚀 能力扩展 2（M47.4 / M47.5）+ 🧪 测试与工程 1（M47.6）。**缺口显式标注**：🎨 独立条目 1 项低于建议值 2（M47.2 的版本回执含用户可见面，但主体是工程与数据层）。

**建议顺序**：M47.6（最小，先清门禁噪声）→ M47.2（建立「本次运行由哪个构建执行」的诊断基线）→ M47.1（最大且需设计结论，依赖 M47.2 的诊断面）→ M47.3（语义变更，待前两项稳定）→ M47.4（部署形态变更）→ M47.5（独立周期插件，可并行收尾）。

**条目容量**：6 原子符合 [规划规范 §1.1](../standards/planning.md#11-硬性约束) 的 5-6 项上限。**阶段基线工作量（§3.1.1 再平衡分母）**：6 条目的「交付物」文件数区间和为 **41-59 文件 / 1600-2650 行**（取整 40-60 / 1600-2700；执行角色按候选锚点计数的量级预估，文件跨批复用去重后偏低，D 阶段按实际 diff 复测）。M47.1 单体最大（10-14 文件 / 450-700 行）；若实际 diff 触发「> 10 文件 / > 800 行」的 [设计文档硬阈值](../design/governance/spec-and-doc-governance.md#24-设计文档硬阈值hard-requirement)，须补 governance 设计稿后再进入 D 阶段。

**范围边界（不做什么）**：不按目标仓库 workflow 动态替换 `verifyCommands`、不解析 matrix / secrets / services 的完整语义（M47.1）；不做部署回执（Jenkins / webhook）与历史 run 回填（M47.2）；不改 `failure_kind` 枚举本身、不回填历史数据（M47.3）；不实现 store 自动 GC 调度、不做多仓共享 store 并发控制（M47.4）；不做通用摘要调度器、不做周报历史归档页、不做时区逐用户配置（M47.5）；不做全仓编号重命名、不改 husky 其他钩子（M47.6）。

**§3.4 交叉核验**：6 项经 ① todo-archive 表格扫描（关键词 `环境性失败` / `构建版本` / `CI 口径` / `workflow 对齐` / `pnpm store` / `weekly_digest` / `check-orphan-ids` / `check-experience-landing` / `lint-staged` 仅命中来源批次与残余观察项，无「已闭环」范围）；② `git log --oneline -- <候选路径>`（`verify-project.ts` 最近 `d76dcea8` / `pr-creator.ts` 最近 `37c93068` / `repo-fix.ts` 最近 `dd195219` / `Dockerfile` 最近 `957bc58f` / `package.json` 最近 `89fdb6ce` 均未覆盖本阶段范围）；③ 代码 anchor（`verify-project.ts:40` 只消费默认链 / 仓库 `verifyCommands`，engine / platform 无读取目标仓库 workflow 的代码（`scripts/check-verify-chain.mjs` 仅解析 dependfix 自身 workflow）；`build-info` 插件仅向平台 stdout 打版本戳、engine 运行日志无版本，`ScanRun` 无构建版本列；`result-assembly.ts:22-25` 自述升级路径未消费 `environmental`；engine / platform 产品代码无 `store-dir` 配置；`package.json:90/94/98` 裸 `git add` 仍在（规划时点）），**0 项重复评估**。

**审计 depth 预告**：M47.1 / M47.2 / M47.3 / M47.4 / M47.5 → `standard`（M47.1 若跨 engine + platform + PR 契约，建议 2 分区并发；M47.2 含迁移建议 2 分区）；M47.6 → `quick`。

**容量再平衡（2026-10-22）**：移出 0 → backlog；插队 1 批（Node 运行时安全基线升级，19 文件 / +336 −39 行 ≈ 阶段基线的 32-46% 文件、13-21% 行）——未达「累计 ≥ 3 批」与「≥ 50%」阈值，且不占用剩余交付窗口，故不作条目移出。

**插队容量治理**：累计 ≥ 3 批或插队工作量 ≥ 本阶段基线 50% 时，按 [规划规范 §3.1.1](../standards/planning.md#_3-1-1-插队后的阶段容量再平衡-hard-requirement-2026-10-19) 评估移出低优先级原子，不得压缩验收 / 跳过 Review Gate / 缩短审计。

---

### M47.1 [P1 🎨] 验证链与目标仓库 CI 口径对齐（差异披露 + 默认分支健康预检）

- **目标**：让 PR 正文与运行详情明确回答「本次验证链与目标仓库 CI 实际执行的是否同一口径」，并在默认分支同 workflow 已红时标注「非本 PR 引入」，消除「PR 正文红 / CI 绿」的判读冲突。
- **优先级**：P1
- **范围**：
  - `packages/engine/src/github/` 新增 workflow 解析与口径比对模块（`yaml@^2.9.1` 已是 engine 依赖）：只解析默认分支 `.github/workflows/*.yml` 的 `jobs.*.steps[].run` 中可识别的 lint / build / typecheck / test 命令，不执行、不改命令链。
  - `packages/engine/src/app/verify-project.ts:40`（`resolveVerifyCommands`）/ `app/result-assembly.ts`：把本次实际执行的命令集暴露给报告与 PR 正文。
  - `packages/engine/src/github/pr-creator.ts:707-718`（Verification 区块）新增「CI 口径」说明段（固定 ≤ 5 行，仅差异存在时展开）。
  - 默认分支健康预检：复用 engine 既有 Octokit 上下文，只读「口径比对所依据的 workflow 文件」在默认分支的最近一次运行结论；失败 / 限流 / 超时降级为「未获取」，不阻断交付。
  - 平台侧 `apps/platform/server/services/executor/*` 只透传仓库上下文（不改执行链）；run 详情是否同步展示由 D 阶段按成本裁定，PR 正文为必交付面。
  - 文档：`docs/design/modules/dependency-fixer-records.md` 新增小节（解析边界 / 降级口径 / 不承诺 CI 结果）。
- **验收标准**：
  - [x] ① 目标仓库为单 job `run: pnpm lint` / `pnpm build` / `pnpm test` 时，PR 正文出现「CI 口径：一致」说明；缺 `typecheck` 时明确列出「本仓库 CI 未跑 typecheck，本次已验证」。
  - [x] ② 无法解析（无 `.github/workflows`、非法 YAML、非 GitHub Actions）时不阻断运行，PR 正文标注「未能读取 CI 配置」，并有对应单测。
  - [x] ③ 口径比对所依据的 workflow 在默认分支最近一次结论为 failure 时，PR 正文标注「默认分支同 workflow 最近一次失败（非本 PR 引入）」；API 失败 / 限流 / 超时时不标注且日志 warn。
  - [x] ④ 不改 `DEFAULT_VERIFY_COMMANDS`（`runners/verification-runner.ts`）、不改执行顺序、不改 exit code 与交付判定；mutation 至少 3 项（去比对 / 去降级 / 去健康预检）。
  - [x] ⑤ 设计小节落地；新增用户可见文案走 i18n 双语（若落 UI——本批无 UI，N/A）。
- **不做什么**：不按 workflow 动态替换 `verifyCommands`；不解析 matrix / secrets / services 的完整执行语义；不改 PR 创建条件；不覆盖 GitHub Actions 之外的 CI。
- **依赖**：`yaml`（engine 既有依赖）；`verification-runner.ts` 的 `DEFAULT_VERIFY_COMMANDS` 单一事实源；`pr-creator.ts` Verification 区块；GitHub Octokit 既有封装；原 backlog 候选「验证链与目标仓库 CI 命令对齐 / 默认分支 workflow 健康预检」（本阶段已上收）。
- **D 阶段裁定**：**平台零代码改动**——引擎在 `container-executor` 内进程化执行，仓库与默认分支上下文已由 `fetchDefaultBranch` 提供，`RunResult.ciAlignment` 随结果直接回到 `platform-delivery.generatePRBody`；**run 详情 UI 不做**（报告 Markdown / JSON 与 PR 正文已覆盖诊断面，UI 待明确需求）。实际 diff **22 文件 / 约 2100 行新增**（含测试与设计稿），已按设计文档硬阈值补 [verification-ci-alignment.md](../design/governance/verification-ci-alignment.md) 并拆 4 个原子 commit。
- **交付物**：预估 3-4 commits（解析与比对模块 + 单测 / 报告与 PR 正文 / 平台接线（若有）/ 设计小节与文案），**10-14 文件 / 450-700 行**（执行角色锚点计数，D 阶段复测）。
- **风险与缓解**：**R1 解析过度承诺**（workflow 形态千变万化）→ 只做可识别命令子集并显式标注「未识别」；**R2 API 配额 / 弱网** → 单次调用 + 超时 + 降级不阻断；**R3 PR 正文膨胀** → 固定行数预算，仅差异展开；**R4 被读成「CI 必绿」承诺** → 文案限定「命令口径」并声明不预测结果。

### M47.2 [P1 🛠️] 构建版本回执与安装日志语义订正

- **目标**：让每次运行的日志与落库记录能回答「本次运行由哪个构建版本 / commit 执行」，并把 `Lockfile repaired` 的中性语义写清楚。
- **优先级**：P1
- **范围**：
  - 数据层：`apps/platform/server/entities/scan-run.ts` 新增 `buildVersion` / `buildCommit`（可空）；新增迁移 `apps/platform/server/database/migrations/2900000000000-AddScanRunBuildColumns.ts` 并登记进 `createDataSourceOptions().migrations`。
  - 写入：`scan-orchestrator` / `scan-trigger` 的 run 创建点写两列（取值复用 `apps/platform/server/utils/build-info.ts` 的 `resolveBuildInfo()`，未注入为 `unknown`）。
  - 读取：run 详情 API / `run-detail-dialog`（或列表 tooltip）展示版本与 commit；`unknown` 不作错误态。
  - 引擎：`DependfixApp` 启动日志（`app/index.ts` 的 `run()` 首部）输出版本 + commit；CLI 场景回退 `package.json` 版本；平台→引擎的传值形态在 D 阶段裁定（优先 `RuntimeConfig` 可选字段，避免新增隐式 env 依赖）。
  - 文案：`packages/engine/src/app/helpers.ts` 的 `tryLockfileRepair` 日志段把无改动路径改为中性表述（如「lockfile 已合规，无需修复」），有改动路径保留原语义；核对报告 / PR 正文契约串消费者。
  - 文档：`docs/guide/configuration.md`（中英）+ 平台差异说明登记 env；`platform.md` 数据模型段同步列。
- **验收标准**：
  - [x] ① 构建期注入时新建 run 两列写入真实值；未注入时为 `unknown`（非 null 崩溃）；API 返回且 UI 可见。
  - [x] ② 引擎启动日志含版本 + commit；CLI 场景回退 package 版本，有单测。
  - [x] ③ 「无改动」路径不再输出 `Lockfile repaired`（改中性文案）；「有改动」路径语义不变；旧串在**生产源码**零残留（`rg -n "Lockfile repaired" packages apps --glob '!**/*.test.ts'` = 0；测试保留负例断言、规范 / 规划文档保留问题陈述，不计入判据），报告 / PR 正文消费者已核对。
  - [x] ④ 迁移在全新库与存量库真实迁移链均通过（复用 `migrations-registry.test.ts` 形态），两列可空。
  - [x] ⑤ 不改 exit code / 交付判定；不改 `summaryJson` 契约（版本走独立列）。
- **不做什么**：不做部署回执（Jenkins webhook / 镜像推送对齐）；不回填历史 run（存量两列为 null）；不把构建版本塞进 `summaryJson`。
- **依赖**：`build-info.ts` 既有 `resolveBuildInfo()`；`ScanRun` 迁移链与 registry 测试；`helpers.ts` 日志行；原 backlog 候选「运行日志的语义订正与构建版本回执」（本阶段已上收）。
- **D 阶段裁定**：
  - **平台→引擎传值形态**：`RuntimeConfig` 新增**可选** `buildVersion` / `buildCommit`（无新增 env；平台由 `server/utils/run-build-info.ts#resolveRunBuildStamp` 从 `runtimeConfig` 读取，与 `/api/health` 同源）。引擎 `app/build-info.ts` 按「宿主注入 → 引擎包 `package.json` 版本 → `unknown`」解析，启动日志固定输出 `[build] dependfix version=… commit=… source=host|engine-package`（先于 `Starting dependfix run`；`source` 区分宿主注入值与本地包版本回退，避免把引擎包版本读成产品版本）。
  - **落库写点**：`createPendingScanRun`（入队即写）+ `runScanInternal` 同步新建；`existing` 分支（队列续跑 / `reuse=true`）**随本次执行进程刷新**——跨部署续跑记录当前构建。迁移 `2900000000000-AddScanRunBuildColumns`（前缀感知 + 幂等 + 两列可空）。`github-action` 模式两列记录受理 / 派发的平台构建，实际执行镜像在目标仓库 runner（文档与 tooltip 已限定）。
  - **UI 面收敛**：只改运行详情弹窗 `run-detail-dialog.vue`（`构建版本` 元信息项，`unknown` / null 统一「未知」+ tooltip，`unknown` 判定由 `formatBuildLabel` 单点派生）；`/scans` 的 `repo-history-dialog.vue` 不重复渲染，**未重建视觉基线**。列表 / 触发响应白名单有意不动。
  - **文案口径**：旧串在**生产源码**零残留（`rg -n "Lockfile repaired" packages apps --glob '!**/*.test.ts'` = 0）；测试保留负例断言、规划 / 设计文档保留问题陈述。「有改动」改为 `Lockfile repair applied for …`（语义不变），`changed` 缺省走中性 `repair completed (change status unknown)`，`noOp` 判据与日志共用同一 `noChange`。
  - **实际 diff**：28 文件 / 约 880 行新增（`git diff --cached --numstat` 实测 `+877 −23`；含本段文档自身的个位数漂移），其中测试 + 迁移用例约 2/3（592 + 30 / 877 行），超出原估 8-11 文件 / 300-450 行；按审计 depth 映射（> 10 文件 + 跨 engine/platform 两模块）**升级为 `deep` 两分区**（预告为 standard）。设计结论落在 `run-failure-taxonomy.md §5.11`（governance 面，`scan_run` 列族单一事实源）+ `dependency-fixer-records.md §12.15`，不另立 slug 专项稿——与 M46.1（39 文件 / 945 插入，落点该文 §5.7/§5.8）同族。
  - **mutation 标定（4/4 击杀）**：去 `createPendingScanRun` 的版本落库 → 2 例失败；`noChange` 分支失效 → 文案用例失败；去引擎 `[build]` 启动行 → 2 例失败；续跑不刷新执行者版本 → 刷新用例失败。
  - **Review Gate R1（deep 两分区）**：分区 A **Reject**（2 blocker：「零残留」口径不可复现 / D 阶段数字失真；4 warning：B 模式执行者语义、引擎包版本与产品版本混读、透传无断言、回退分支缺测）＋分区 B **Pass**（4 warning：同步新建 / `reuse` 刷新无断言、`unknown` 哨兵裸字面量、B 模式语义、量化口径；3 suggest）→ 已收口：验收 ③ 限定域 + 允许命中清单、diff 数字与迁移名订正（提交前实测 `28 文件 / +877 −23`）、日志加 `source=host|engine-package`、B 模式口径写入 §5.11 / tooltip、补 4 例（同步新建 / `reuse` 刷新 / `ctx.config` 透传 / 解析失败回退）+ 前端哨兵等值断言、`changed` 缺省走中性文案、registry 用例改为「已记录前序迁移的存量库增量迁移」。
- **交付物**：预估 3-4 commits（迁移 + 数据层 / 引擎日志 / API + UI / 文档与文案），**8-11 文件 / 300-450 行**。
- **风险与缓解**：**R1 迁移漏登记**（生产 `synchronize=false` 时永不执行）→ 复用 registry 双向核对 + 存量库集成用例；**R2 构建期 env 未注入** → UI 显示 `unknown` + 文档写明注入方式，不影响运行；**R3 文案消费者漏改** → 结构化复扫 + 报告契约测试。

### M47.3 [P2 🛠️] 环境性失败归因收口（分类收窄 + 常规升级链路）

- **目标**：收窄「环境性失败」判定，并让常规分组 / 逐包升级 / major 路径消费安装结果的 `environmental` 标记，使环境性失败计数与真实环境故障一致。
- **优先级**：P2
- **范围**：
  - 归因接线：`result-assembly.ts#computeSummary` 原自述的覆盖边界（常规分组 / 拆组逐包 / major）→ 三条路径接入；调用点为 `app/repo-fix.ts#applyGroupUpgrades` 内经 `upgradeAlert` 的两处与 `major-upgrade` 分支（本批按同族一并收口 workspace 成员链路）。
  - 分类收窄：`ENVIRONMENT_ERROR` 判据从「stderr 空 / 信号 / 超时」扩展为「有明确 stderr 且非信号 / 非超时 → 非环境性」，抽单一判据函数（落 `runners/` 或 `fixers/` 既有分层）。
  - 语义交互：与 `failure_kind=transient`、`alertsFailed`、exit code、交付守卫的交互先在设计文档落结论（`docs/design/modules/dependency-fixer-records.md` 新增小节）再改代码。
  - 测试：三路径环境性用例、分类反例（明确 `ERR_PNPM_*` 不再环境性）、零修复且全部环境性 / 有真实失败两场景的 exit code 与交付回归。
- **验收标准**：
  - [x] ① 常规 / 逐包 / major 路径在安装被信号杀死或超时时产出 `environmental` 标记并推 `ENVIRONMENT_ERROR`；`alertsFailed` 不计该告警；mutation 至少 3 项。
  - [x] ② 有明确 stderr 的安装失败不再被判环境性（判据单测 + 端到端用例）。
  - [x] ③ 「零修复且全部环境性」与「有真实失败」两场景的 exit code / `alertsFailed` / 审计条目与既有口径一致（回归用例；`status` 由既有 `resolveScanRunState` 映射，本批不改映射，未新增平台断言）。
  - [x] ④ 历史 run 计数不回填；文档声明仅新 run 生效。
  - [x] ⑤ 设计结论小节先于实现落地（提交顺序按 docs → 代码 → 测试 → 计划登记执行）。
- **不做什么**：不改 `failure_kind` 枚举本身（需新增值另立条目）；不回填历史数据；不改 exit code 语义。
- **依赖**：M46.1 的 `RunSummary.environmentalFailures` 与 `ENVIRONMENT_ERROR` 计数；M47.2 的版本日志（诊断辅助）；原 backlog 候选「环境性失败分类语义收窄」+「常规升级链路的环境性失败归因对齐」（本阶段已上收）。
- **D 阶段裁定**：
  - **判据单点化**：`fixers/process-signals.ts#isEnvironmentalInstallError` 成为唯一判据（lockfile 诊断链把受管执行结果适配成同形错误后调用），规则 = 运行级取消 → 非环境性；信号 / 超时 → 环境性；有 stderr → 非环境性；stderr 空 → 环境性。**stdout 不参与归因**（pnpm 11 的 `gyp` / `prebuild-install` 输出仍按环境性处理，保留 §12.11 的既有决定），故本条不做「有输出即非环境性」的语义反转；升级链因此与诊断链同口径（静默非零退出不再误报为仓库失败，`ERR_PNPM_*` 仍归因）。
  - **消费点扩到四条路径 / 三个代码点**：`upgradeAlert`（常规分组 + 拆组逐包共用一个代码点）、跨线 `major-upgrade`、workspace 成员 `member-upgrade`（原范围写三条路径，成员链路属同一判据消费点，一并收口避免同族遗留）；统一经 `app/environmental-failure.ts#markEnvironmentalInstallFailure` 记 `ENVIRONMENT_ERROR`（`stage: 'fix'`）+ 动作标记 `environmentalFailure`。多版本逐包 / 合批沿用 §12.11 的「记审计、不产出失败动作」口径（测试已锁定）。
  - **计数 / 出口码交互**：`computeSummary` 跳过 `environmentalFailure` 动作（不进 `alertsFailed` / `alertsFixed`）；`environmentalFailures` 仍只按审计条目计数；`computeExitCode` 谓词零改动（跳过类 + `hasFailures` 排除）——零修复且全部环境性 → exit 0、平台 `completed` + 计数可见；真实失败并存时照常非零；`alertsUnfixed` 仍计未修复。
  - **停止语义**：环境性失败即停止本仓库剩余**升级类**安装尝试（成员停止剩余成员并让调用方跳过分组链；分组停止组内后续包并对已应用改动跑一次组级验证，通过计 fixed、失败整组回滚并计验证失败后退回；跨线置 `stopReason='environmental'` 跳过成员 / 分组链）。lockfile repair 仍按既有流程执行（独立动作，不计入「升级类」）；计数单位是安装尝试而非故障事件。
  - **审计 R1 收口（standard 2 分区均 Pass）**：A 分区 3 warning（成员停机不传导 / noOp 动作在停机回滚分支被改判失败 / 取消未启动被新判据误判环境性）+ 4 suggest（两分支与成员停机缺用例、`addSkipped` 被提前 return 跳过、日志丢证据、计数语义）；B 分区 7 warning + 4 suggest（成员停机口径、取消口径、`stage` 枚举、升级链注释陈旧、commit 声明、单一写入点措辞、风险方向 + 链接文字 / 行号 / 验收限定）。全部已收口：`applyMemberUpgrades` 返回停止标志并由 `processRepoFix` 跳过分组链、停机回滚分支排除 `noOp`、`execPnpmInstall` 未启动取消抛带 `aborted` 标记的错误、`notFixableCount` 记账前移到告警分区处、warn 带失败 detail、文档与注释口径改净、补 2 条分支用例与 2 成员停机用例。**R2 quick 复审 Pass**（8 项修复点全 closed；新增 2 warning：取消时组 / 成员循环仍会产出 K 条同因失败动作、整段跳过分组链时 `not-fixable` 仍未记账 → 已补取消守卫（成功动作保留、失败动作不入列）与记账上移，并补 2 条用例 / 2 项 mutation；3 suggest：diff 数字偏高、`report-generator` 两种错误文本形态混写、noOp 不入列属既有行为 → 前两项已订正、第三项按既有行为保留）。
  - **实际 diff**：24 文件 / `+675 −61`（含新增模块 46 行、测试 7 文件与文档 5 文件；审计收口新增的成员停机传导、noOp 排除、取消守卫、`not-fixable` 记账与 5 条用例；数字含本段自身微调），超出原估 6-9 文件 / 250-420 行，主因是四条路径各需一条端到端回归 + 判据反例；设计与计数口径落 [dependency-fixer-records.md §12.16](../design/modules/dependency-fixer-records.md) + [pnpm-lockfile-fixer.md §2.4](../design/modules/pnpm-lockfile-fixer.md) + [run-failure-taxonomy.md §4.3/§5.x](../design/governance/run-failure-taxonomy.md)，不另立专项稿（与 M47.2 同族）。
  - **mutation 标定（8/8 击杀）**：去 stderr 判据 → 27 例失败；去 `upgradeAlert` 的环境性标记 → 4 例；去 `computeSummary` 跳过 → 5 例；分组路径不停止 → 3 例；跨线不置 `stopReason` / 成员停机不传导 / 分组取消守卫 / `not-fixable` 记账 → 各 1 例。工件 `artifacts/review-gate/2026-10-23-m47-3-mutation.md`（还原后 md5 逐项一致）。
- **交付物**：计划 4 commits（设计结论 / 判据与接线 / 测试 / 计划登记），**24 文件 / 约 675 行**（原估 6-9 文件 / 250-420 行；审计两轮收口后测试与文档行数增加约 250 行）。
- **验证证据**：lint 0 error（3 条存量 warning）；`pnpm -r build` + `pnpm run typecheck` 7 包 Done；engine 83 文件 / 1508 passed / 1 skipped；全仓 307 文件 / 4683 passed / 10 skipped；mutation 8/8（工件 `artifacts/review-gate/2026-10-23-m47-3-mutation.md`，还原后 md5 逐项一致）；文档九项 + `docs:build` 全绿；新增行编号标记扫描 0 命中。
- **风险与缓解**：**R1 分类收窄把真实环境故障归因仓库** → 保守判据（只有明确 stderr 才非环境性）+ 反例用例；**R2 计数与 exit code 双源漂移** → 单一映射函数 + 映射用例；**R3 行为变更面广** → 先设计后实现，D 阶段定向回归 + `standard` 审计；**R4 判据在升级链上比改前更宽**（静默非零退出也算环境性）→ 仓库自身失败若只写 stdout 会被记为环境性（不增 `alertsFailed`、exit 0）：缓解为 stdout 证据仍进 `FixAction.error`、失败日志带 detail、`environmentalFailures` 单列可见，保留 §2.4 的既有决定并在 §12.16 登记。

### M47.4 [P2 🚀] pnpm store 持久化与提交卫生

- **目标**：把 pnpm content-addressable store 固定到持久卷，并在交付提交前排除 store / `node_modules`，避免每 run 冷安装与误提交。
- **优先级**：P2
- **范围**：
  - `apps/platform/docker/entrypoint.sh`：启动前设置 store 目录（实测选 `PNPM_CONFIG_STORE_DIR`，pnpm 11 下 `npm_config_store_dir` 无效、项目 `.npmrc` 的 `store-dir` 亦不生效），默认 `$DATA_DIR/pnpm-store`；不可用时 warn 并回退既有行为。
  - 目标仓库 `.git/info/exclude`：幂等追加 `.pnpm-store/` / `node_modules/`，不改目标仓库 `.gitignore`。
  - `apps/platform/Dockerfile` / `docs/guide/deployment.md`：数据卷挂载示例、容量建议、手工清理命令；env 权威登记与 `configuration.md` 同步（zh/en）。
  - 测试：entrypoint root / 非 root 两条路径与顺序断言；`git/info/exclude` 幂等 / 取反 / 子目录 / 工作树单测；真实 `git add .` 场景。
- **验收标准**：
  - [x] ① 容器内 `pnpm store path` 落在持久目录（默认 `/app/data/pnpm-store/v11`），跨容器复用；不可用（只读挂载 / 权限不足 / 非绝对路径）时回退既有行为且日志 warn（不阻断）。
  - [x] ② 目标仓库 `git add .` 后暂存区不含 `.pnpm-store/**` / `node_modules/**`（单测 + 真实 `git add .` 场景）。
  - [x] ③ `.git/info/exclude` 重复执行不重复追加；不修改目标仓库 `.gitignore`。
  - [x] ④ 部署文档给出卷挂载、容量建议与清理方式；env 与 `configuration.md` 双语同步。
  - [x] ⑤ 不改 clone / 安装 / 提交机制；mutation 8/8 击杀（原计划至少 2 项）。
- **不做什么**：不实现自动 GC 调度；不做多仓共享 store 并发控制（队列并发 1）；不改 pnpm 版本。
- **依赖**：原 backlog 候选「pnpm store 持久化与项目内 store 的提交卫生」（本阶段已上收）；`entrypoint.sh` 的信号 / 角色约束（`platform.md §10.6`）；pnpm 官方 `store-dir` 配置口径。
- **D 阶段裁定**：
  - **store 配置通道**：选环境变量 `PNPM_CONFIG_STORE_DIR`（实测 11.17.0：`PNPM_CONFIG_STORE_DIR` / `pnpm_config_store_dir` 生效，`npm_config_store_dir` 无效；项目 `.npmrc` 的 `store-dir` 在 pnpm 11 不生效，全局配置生效但优先级低于 env）。pnpm 11+ 的 `storeDir` 只从 CLI / env / `pnpm-workspace.yaml` / 全局配置读取，env 最高 → 平台固定缓存位置，目标仓库 workspace 的 `storeDir` 不再生效（缓存位置属执行环境基础设施）。`Dockerfile` **不**固化 ENV：入口按 `DATA_DIR` 派生，避免 `-e DATA_DIR=…` 时固化值与数据目录脱节；compose 仍同名转发（供 `docker compose exec` 与覆盖）。
  - **落点上移（计划偏差）**：`git/info/exclude` 的写入从计划的 `container-executor.ts`（clone 后准备阶段）上移到**引擎 `DependfixApp.run()` 起始**（`executeMode()` 之前）。理由：全仓 commit 唯一入口是引擎 `stageAndCommit` 的 `git add .`，平台 / CLI / Action / MCP 共用；且必须在安装前落盘，否则安装产物污染「无变更」判定与 `git add .`。实现在 `packages/engine/src/app/git-exclude.ts#prepareDeliveryHygiene`，仅 `fix` / `fix-and-pr` 且非 `dry-run` 预置（`report-only` / `cleanup-branches` / `dry-run` 零副作用）。
  - **判定用写探针而非 `test -w`**：`test -w` 只看 DAC 位、不看挂载只读属性——只读卷上「上次运行留下的 store 目录」会被误判可写，随后安装期 EROFS 硬失败。探针以真实运行身份执行（root 启动经 `su-exec`），并覆盖 ENOSPC / ACL；失败时 **unset 变量回退**（只 warn 不 unset 会让 pnpm 继续用坏路径）。
  - **store 目录以运行身份创建**：不对用户指定路径做 `chown`（`PNPM_CONFIG_STORE_DIR=/` 之类会波及根目录）；root 路径先 `chown -R` 数据卷 / HOME，再经 `su-exec mkdir` 建 store，最后探针判定。父目录已授权（777 / 预 chown）时自定义路径可用；未授权时创建失败即回退且不留 root 属主目录。
  - **exclude 语义**：复用 `.gitignore` 归一化 + 按「同一文件内最后一条匹配胜出」处理取反行；不解析 `.git` 文件内容（改 `git rev-parse --git-common-dir`，覆盖子目录 / 工作树 / 子模块）；写入失败返回 `error` 并 warn（不阻断）；跨文件优先级（`.gitignore` > `info/exclude`）登记为边界。
  - **审计收口**：R1 `standard` 两分区均 Reject（A：dry-run / cleanup-branches 仍写、子目录不解析、失败不可见、取反漏排除、用例依赖宿主 gpgsign；B：`test -w` 盲区、自定义路径 root 属主、root 路径无行为用例、§10.8 未挂检查点、Dockerfile ENV 冗余、相对路径、文档量化口径）→ 全量收口 → R2（A Pass / B Reject：smoke 0c 捕获两行、任意路径 chown、marker 不可证、§11 双标点）→ 收口 → R3 Reject（检查点矩阵仍写「先建后 chown」+ no-chown 无守卫）→ 收口 → R4 quick Pass（2 suggest 已一并收口）。
  - **实际 diff**：18 文件 / `+908 −23`（16 个改动 + 2 个新增；原估 6-9 文件 / 200-350 行）。新增行中测试占 358 行（entrypoint 24 例 + exclude 33 例，四轮审计收口所致），文档占约 180 行（双语镜像 + 检查点矩阵）。已触发 [设计文档硬阈值](../design/governance/spec-and-doc-governance.md#24-设计文档硬阈值hard-requirement)（> 10 文件 / > 800 行），设计结论落 [gitignore-management.md §7](../design/governance/gitignore-management.md) + [platform.md §10.8](../standards/platform.md)，不另立专项稿（与 M47.2 / M47.3 同族）。
  - **mutation 标定（8/8 击杀）**：移除 run 起始预置 → 3 例；删 4 处回退 unset → 3 例；跳过幂等 / 取反过滤 → 8 例；删 root `prepare` → 3 例；去 `dryRun` 闸门 → 2 例；探针退回 `[ -w ]` → 1 例；store 目录退回 root `mkdir` → 1 例；加回 `chown store` → 1 例。工件 `artifacts/review-gate/2026-10-23-m47-4-evidence.md`（还原后 md5 逐项一致）。
- **交付物**：计划 3 commits（entrypoint + 部署文档 / git exclude + 测试 / 文档与 env），**18 文件 / 约 908 行新增**（含测试 358 行）。
- **验证证据**：lint 0 error（3 条存量 warning）；`pnpm -r build` + `pnpm run typecheck` 7 包 Done；engine 84 文件 / 1533 passed / 1 skipped（终轮全仓 308 文件 / 4725 passed / 10 skipped）；平台 docker 目录 32 passed；真机容器四场景（默认可写 / 只读卷 + 已存在 store / 自定义已授权父目录 / 跨容器复用）+ smoke 0c 管道实证；文档九项 + `lint:md` + `docs:build`（fallback 116）全绿、`check:doc-size` 0 warning；编号标记 0 命中。
- **风险与缓解**：**R1 持久卷未挂载导致磁盘占满** → 容量经验值 + 启动 warn + `pnpm store prune` 文档；**R2 store 与工作目录跨文件系统**（只能 copy 不能 hardlink）→ 文档写明同卷要求；**R3 exclude 误伤** → 只写 `.git/info/exclude`、幂等、取反感知、不改 `.gitignore`；**R4 只读挂载误判** → 写探针 + 真机回归；**R5 自定义路径越权写** → 不做任意路径 chown、根路径拒绝、行为用例守卫。

### M47.5 [P2 🚀] 通知周汇总（`weekly_digest`，M46.5 B5）

- **目标**：落地 `weekly_digest` 固定周期插件（默认关闭），按 ISO 周 + 用户逐封去重，发送活跃未修复高危快照。
- **优先级**：P2
- **范围**：
  - `apps/platform/server/plugins/` 新增周汇总插件（周一 09:00，`DEPENDFIX_WEEKLY_DIGEST_HOUR` 可覆盖），按进程角色单实例运行（复用 `server/utils/process-role.ts`；角色归属需与 `HTTP_ONLY_PLUGINS` / `NON_HTTP_ONLY_PLUGINS` 分类一致性用例同步）。
  - `apps/platform/server/services/notification/`：复用 `high-risk.ts` 查询 + 周报模板（按仓库分组 + 截断 / 豁免计数披露）+ `deliveryKey = sha256('digest', weekKey, recipientUserId, channel, 'weekly_digest')` 逐封投递；`weekly_digest` 豁免指纹 / 冷却 / 每小时上限（设计 §7.3 例外）。
  - `apps/platform/app/pages/settings.vue` 与 `notifications.vue`：去掉 `weekly_digest` 的 disabled / `weeklyDigestUnavailable`，改为可配置。
  - i18n 双语；`docs/design/governance/platform-notification.md` 状态与 B5 段更新。
  - 测试：ISO 周键与跨年周边界（注入时钟）、组织 + 个人双层开关、内容不变仍发送、按用户逐封去重、角色单实例、无收件人 / 渠道不可用。
- **验收标准**：
  - [x] ① 默认关闭；组织 + 个人同时开启时每周一 09:00（服务器时区）发送一次，按 ISO 周去重，内容未变化也发送。
  - [x] ② 同一用户 + 渠道 + 周仅一封（并发占位）；投递记录写入 `recipientUserId`。
  - [x] ③ 任一层关闭（组织 / 个人 / 全局 `DEPENDFIX_NOTIFICATION_ENABLED=false`）不产生周报。
  - [x] ④ 仅一个进程执行（role 守卫 + 单测），HTTP / worker 双进程不双发。
  - [x] ⑤ 周报正文披露截断 / 豁免计数；`settings.vue` 不再显示「暂不可用」；设计稿状态同步。
- **不做什么**：不做通用摘要调度器；不做周报历史归档页；不做时区逐用户配置；不做 Slack / Webhook 投递。
- **依赖**：M46.5 B1-B4（通知服务 / 偏好 / 投递记录 / 去重键）；`platform-notification.md §6.5 / §7.3 / §B5`；`process-role.ts` 角色守卫。
- **D 阶段裁定**：
  - **触发形态**：插件加入 `HTTP_ONLY_PLUGINS`（与 `stale-cleanup` 同列）——容器双进程形态下 HTTP 主进程恒存在，worker 跳过；启动 30 秒后每 15 分钟检查一次，触发窗口 = 本周一 `DEPENDFIX_WEEKLY_DIGEST_HOUR`（默认 9）起 24 小时（窗口内重启补发，周中晚些时候启动不补发上周）；同进程同周只尝试一次，跨进程 / 重启由逐用户投递键兜底。否决「精确 setTimeout 到下周」：长定时器对时钟跳变 / DST 不友好，且无法自然补发。
  - **快照口径**：新增 `queryActiveUnfixedHighRisk`——不限定 `scanRunId`（`ScanResult` 为 per-alert 模型，`supersededAt IS NULL` 即当前活跃），与 alerts 视图同口径；截断计数取快照内各告警所属运行（去重）的 `alertsTruncatedBySeverity`。**豁免口径**：`ScanResult.fixStatus` 在生产只写 `not-tried`（修复结果不回写，M20.3 既有边界），故「豁免」改取快照运行的 `RunSummary.alertsConverged` 单列披露（「引擎汇总另有 N 条本地已满足」），不改明细计数——满足验收 ⑤ 的「截断 / 豁免计数」披露要求，且避免基于死列实现。否决「按本周新增 run 聚合」：会漏掉跨周仍未修复的存量高危。
  - **零快照行为**：本周无未修复高危时仍发送「本周无未修复高危」摘要——显式订阅的周期摘要应证明任务存活，避免订阅方把零告警误读为周报停摆。
  - **逐封投递**：`dispatchNotification` 新增 `recipientUserId` / `recipientIdentity`；`weekly_digest` 分支跳过指纹 / 冷却 / 每小时上限（设计 §7.3），投递键 `sha256('digest', weekKey, identity, channel, 'weekly_digest')`。额外管理员收件人无 userId → 身份取规范化邮箱、日志 `recipientUserId=null`（仍满足每收件人每周一封）。
  - **UI**：`settings.vue` / `notifications.vue` 去掉 `weekly_digest` 的 `disabled` 与「后续版本提供」占位说明，改为可配置并补一句触发口径 hint；`/notifications` 页可见文案变化 → 连带重建 `notifications-light.png`（其余 16 张基线未变）。
  - **交付物**：5 commits——① `feat(platform)` 周报核心（schedule / service / high-risk 全局快照 / delivery 例外 / 模板 / 插件 + 测试）；② `feat(platform)` UI 可配置 + i18n + e2e + 视觉基线；③ `docs(design)` 设计稿状态与触发口径 + `platform.md`；④ `docs(guide)` 配置指南双语 + `.env.full.example`；⑤ `docs(plan)` M47.5 闭环登记。实际 diff 见下条，F 阶段按此分组提交。
  - **实际 diff**：执行角色 2026-10-24 以 `git diff --numstat`（含 `git add -N` 的新文件）统计为 **28 文件 / `+1439 −101`**；其中 `docs/plan/todo.md` 自身 +18 −7，业务与文档 **27 文件 / +1421 −94**；测试文件新增约 839 行（含 e2e），新增源码模块 3 个 + 新增测试文件 3 个（另修改 5 个既有测试文件）。原估 5-8 文件 / 200-350 行。已触发 [设计文档硬阈值](../design/governance/spec-and-doc-governance.md#_2-4-设计文档硬阈值-hard-requirement)（> 10 文件 / > 800 行），治理落点 = 既有 [platform-notification.md](../design/governance/platform-notification.md)（§4.5 / §6.4 / §6.5 / §10 / §12 / §13）+ [platform.md §10.6/§11](../standards/platform.md)，不另立专项稿（与 M47.2 / M47.3 / M47.4 同族）。
  - **mutation 标定（6/6 击杀）**：周报不再豁免指纹 / 冷却 / 上限 → 1 例；去掉角色守卫 → 1 例；ISO 周偏移 → 1 例；投递键去收件人维度 → 1 例；豁免计数改数 success → 3 例；退回一封多收件人 → 2 例。工件 `artifacts/review-gate/2026-10-24-m47-5-mutation.md`（还原后 md5 逐项一致）。
- **验证证据**：lint 0 error（3 条存量 warning）；`pnpm run typecheck` 7 包 Done；platform 全量 164 文件 / 2142 passed / 9 skipped；通知域定向 17 文件 / 137 passed；notifications e2e 文件 4 passed（含「组织开启后个人开关可配置」）；`test:visual:update` 一次 + 不带 update 连跑两遍 17 passed（仅 `notifications-light.png` 重建）；mutation 6/6（工件 `artifacts/review-gate/2026-10-24-m47-5-mutation.md`，逐项记录文件 / md5 / 失败用例）；文档九项 + `lint:md` + `docs:build`（fallback 116）全绿、`check:doc-size` 0 warning、`check:orphan-ids` 0；新增行编号标记扫描 0 命中。
- **残余**：① 同进程同周只尝试一次——首次尝试部分用户 `failed` 时本周内不重试（投递键已释放，下周或进程重启可补发）；② 组织关闭 / 部署熔断时不写投递记录（审计面不可见「因开关跳过」）；`skipped_no_recipient` 同样保留本周锁（避免窗口内每 15 分钟写一条无收件人日志），窗口内才开启个人开关需等下周；③ 零告警仍发送，可能被部分订阅者视为噪声；④ 周报 locale 取部署级 `DEPENDFIX_LOCALE`，未按用户偏好；⑤ 若某仓库只有截断告警而无持久化明细则不披露其截断计数；⑥ 视觉仅覆盖 `/notifications` light，无 dark 基线（`/settings` 无视觉基线，改由 e2e 覆盖「组织开启后个人开关可配置」）；⑦ `ScanResult` 不标记 converged，周报明细计数仍含本地已满足告警（「豁免」仅按 `RunSummary.alertsConverged` 披露；跨 run 相加在脏数据下可能高估，正常 reconcile 后每仓活跃行指向最新 run）；⑧ 崩溃遗留 `sending` 行 + 窗口内重启的窄场景可能让该周停留 `skipped_duplicate`（10 分钟回收窗口后才可重试，实际下周由新键覆盖）。
- **实际 diff（最终）**：`git add -N . && git diff --numstat | awk '{a+=$1; d+=$2; n++} END {print n, a, d}'` → **28 文件 / +1439 −101**（含 `docs/plan/todo.md` 自身 +18 −7 与 1 张重建 PNG；排除 todo 后 27 文件 / +1421 −94）。
- **风险与缓解**：**R1 双进程双发** → role 守卫 + 单测；**R2 时区 / ISO 周边界** → 注入时钟用例；**R3 邮件量大** → 仅开启者接收 + 逐用户去重；**R4 与「内容未变化不重复推送」冲突** → 设计已声明周报例外，测试锁定。

### M47.6 [P3 🧪] 工程门禁与提交卫生收口

- **目标**：补齐三条工程门禁 / 提交卫生缺口，使子任务字母后缀编号、经验归档子条目落点、lint-staged 全量暂存都能被机检或消除。
- **优先级**：P3
- **范围**：
  - `scripts/check-orphan-ids.mjs`：`PLANNING_ID_RE` 支持子任务字母后缀（如 `M43.2a`），评估既有真常量白名单误报面；fixtures 用运行时拼接 token（避免被门禁自扫）。
  - `scripts/check-experience-landing.mjs`：落点校验粒度由 `##` 改为编号 `###` 子条目逐条；纯结构小节归所属条目；自指落点（「本条环境注记」等）判空并给出专用原因；存量条目按实测补真实落点或登记白名单。
  - `package.json:87-102` lint-staged：移除三条裸 `git add` 并改为文件级任务（`eslint --fix` / `lint-md --fix`），避免仓库级 formatter 连带暂存；保留 `packages/skills/**` 带路径的正确形态。
  - 文档：`docs/standards/documentation.md` / `testing.md` 对应条款（若需）+ review 检查点矩阵（若新增规则）。
- **验收标准**：
  - [x] ① `check-orphan-ids` 对 `M43.2a` 形态在源码注释 / 测试名中命中（fixture 不得进入门禁自扫面，必要时运行时拼接），合法文档指针仍通过；全仓 `pnpm check:orphan-ids` 0 error。
  - [x] ② `check-experience-landing` 对同 `##` 下某 `###` 无落点报错（fixture），存量全仓 0 error；自指落点被标记。
  - [x] ③ 移除三条业务 glob 的裸 `git add` 并改为文件级任务后，lint-staged 跑后暂存区仍仅含目标文件（实测）；`packages/skills/**` 的带 pathspec `git add` 作为生成物同步例外保留（husky 仍会由该条触发 `tasks use git add` 告警）。
  - [x] ④ 三条改动均有单测 / 实测证据；mutation 至少 3 项。
  - [x] ⑤ 不改变门禁退出码语义（新增规则自身除外）。
- **不做什么**：不做全仓编号重命名；不做 lint-staged 性能优化；不改 husky 其他钩子。
- **依赖**：原 backlog 三条候选（本阶段已上收）；`check-orphan-ids` 的产物排除改动；`check-experience-landing` 既有分片结构；`package.json` lint-staged 段。
- **交付物**：**19 文件**（含审计收口新增的治理 / 计划文件）；计划 3 commits（编号门禁 8 / 落点门禁 2 / lint-staged 与文档 9，F 阶段执行，提交后以 `git show --stat` 回填实际分组）。
- **风险与缓解**：**R1 字母后缀正则误报**（文档 ID / 版本号）→ 先跑一次性探针量化分布 + 白名单；**R2 `###` 粒度导致大量存量报错** → 先量化，必要时分批补落点并登记；**R3 移除裸 add 后重暂存行为变化** → 多文件提交实测。

### 追加临时待办（不占阶段条目编号）：Node 运行时安全基线升级（2026-10-21 安全公告）

> **授权依据**：用户 2026-10-22 明确授权；依据 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 插队例外清单第 1/2 类（已确认的安全漏洞 / 高危漏洞）与用户裁定的技术路线（先官方镜像止血；收敛回自建基底暂不迁移，待上游就绪后再评估）。**不分配阶段编号**，不计入 M47 条目容量与类型平衡。

- **目标**：把平台镜像运行时从 Node 24.18.1 升到已修复版本，并让该基线可机检，避免基础镜像 digest 静默回退到受影响版本。
- **评估结论**：
  - [Node.js 2026-10-21 安全公告](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases) 修复版本为 22.23.4 / 24.22.1 / 26.12.1；本仓镜像 digest 实测 Node 24.18.1（OpenSSL 3.5.8 / undici 7.29.0），`node:24.22.1-alpine` 为 OpenSSL 3.5.9 / undici 7.30.1。
  - 自建基础镜像（docker-builder 的 `alpine-nodejs`）走 `apk add nodejs`，而 Alpine v3.24 与 edge 仍停留在 24.18.1（`-r0` / `-r5`），重建自建镜像拿不到补丁 → 本轮改用官方 `node:24.22.1-alpine` 止血；待 docker-builder 改为官方 tarball 并发布 `alpine3.24-node24.22` 后再评估收敛（用户 2026-10-22 决定暂不迁移）。
  - 实测补充：pnpm 11.x（实测 11.28）与 undici `fetch` 均忽略请求头、按响应头自动解 br（`accept-encoding: gzip, deflate` 仍解 `content-encoding: br`）；本仓 `registry-discovery.ts` 信任目标仓库配置的 registry，且 pnpm 直连不走审计代理 → Brotli 解压面不止「GitHub API / AI 端点」，评级由 P2 上修为 P1。全仓 `dns.resolve` / startup snapshot / `--permission` / `ZipFile` 0 处，对应 CVE 不适用于本仓。
- **范围**：
  - `apps/platform/Dockerfile`：基础镜像改官方 `node:24.22.1-alpine`（manifest list digest，覆盖 amd64 / arm64）+ pnpm 11.18.0 全局安装（与切换前一致、移除 corepack shim）+ `npm_config_nodedir` 指向镜像自带 headers + runtime 去 npm / corepack / yarn + 构建期基线断言 + 可选 `APK_MIRROR` / `NPM_REGISTRY` 构建参数（受限网络，值经字符集校验且不写入运行期 ENV）。
  - `apps/platform/docker/check-node-version.mjs`（新增）：按 22 / 24 / 26 发布线取最低已修复版本，EOL 线一律拒绝；构建期与镜像冒烟共用。
  - `apps/platform/docker/smoke-test.sh`：新增场景 0 运行期基线断言。
  - 六个 `package.json` 的 `engines.node`：`^22.23.4 || ^24.22.1`。
  - 文档：`docs/guide/tech-stack.md` / `docs/guide/quick-start.md` / `README.md` 徽章 + en-US 镜像（`guide/quick-start` / `guide/tech-stack` / `design/governance/architecture`）+ `packages/skills/dependfix-remediator/SKILL.md`（经 `sync:skills` 同步到 `skills/`）。
- **验收标准**：
  - [x] ① 镜像内 `node -v` = 24.22.1，`check-node-version.mjs` 通过（构建期 + 冒烟期各一次）。
  - [x] ② 镜像不含 npm / corepack / yarn，pnpm 可用且版本与切换前一致（11.18.0）。
  - [x] ③ `SMOKE_BUILD=1 sh apps/platform/docker/smoke-test.sh` 全绿（better-sqlite3 原生模块、15 业务表、entrypoint 降权、HTTP 200）。
  - [x] ④ 基线断言负例可复现：`node apps/platform/docker/check-node-version.mjs --version=24.18.1` exit 1（不读环境变量，防镜像 ENV 旁路）；单测 8 例覆盖 22 / 24 / 26 达标、低于基线、EOL 线、参数解析。
  - [x] ⑤ `engines` 六处一致；`pnpm run lint`（0 error）/ `typecheck`（7 包 Done）/ 定向 vitest（8 passed）通过。
- **验证证据**：构建期 `[node-baseline] Node 24.22.1 >= 24.22.1`；运行期 `node -v` = v24.22.1、`process.versions.openssl` = 3.5.9、`undici` = 7.30.1、`pnpm -v` = 11.18.0（与切换前一致）、`npm/corepack/yarn` 均无；`SMOKE_BUILD=1` 与 `SMOKE_IMAGE=…` 两种入口均 PASS（15 业务表）；负例 `--version=24.18.1` → exit 1；定向 vitest 8 passed；`pnpm run lint` 0 error / `typecheck` 7 包 Done。
- **§3.1.1 容量评估**：1 批 / 19 文件 / +336 −39 行，约占阶段基线文件数 32-46%、行数 13-21%；未达「累计 ≥ 3 批」与「≥ 50%」阈值，剩余窗口可容纳审计与验证 → **不移出原子条目**。
- **不做什么**：不改 docker-builder（另一仓，收敛路线 A 另行跟进）；不引入 `--permission` / SEA 等缓解（本仓未使用）；不改目标仓库 install 语义与 pnpm 版本；不新增 audit 豁免。
- **依赖与风险**：**R1** 官方镜像经 public ECR 拉取，CI 需可达（不可达时回退 Docker Hub 同名 tag，digest 需重新核对）；**R2** 本地开发容器原 Node 24.19.0 低于新 engines 下限，已在本批验证期间升级到 24.22.1（环境动作，不入库）；**R3** 受限网络下构建需 `--build-arg APK_MIRROR` + `--build-arg NPM_REGISTRY`（冒烟脚本已支持 `SMOKE_APK_MIRROR` / `SMOKE_NPM_REGISTRY` 透传；构建参数值会记入镜像 history，仅可用于非敏感 URL）；**R4**（暂不迁移，条件性）收敛回自建基底时须重跑冒烟与 amd64 / arm64 构建，并复核 better-sqlite3 musl prebuild。**已知残余**：① 路线 A（收敛回自建基底）**用户 2026-10-22 决定暂不迁移**——docker-builder 仍走 `apk add nodejs`（Alpine v3.24/edge 为 24.18.1），待上游发布 `alpine3.24-node24.22` 后再评估；② runtime 镜像体积由 ~661MB 增至 ~787MB（官方 node 基底 + 保留原生编译工具链；工具链瘦身归 backlog 既有候选）；③ 官方 node 基底不含 corepack，`verify-project` 的 `corepack pnpm@<ver>` 回退路径在容器内不可用（切换前同样不可用，非本批回归，登记为已知限制）；④ 安全断言含 26 线而发布包 engines 只声明 22 / 24，二者口径不同为有意设计（engines 只声明支持面：22 / 24，CI 当前覆盖 24 线）。

---

## 交付原则

- 每个里程碑必须通过 lint + typecheck + build + test 质量门
- 里程碑交付前需经过 code-reviewer 技能审查
- 剩余风险必须在交付说明中清晰记录
