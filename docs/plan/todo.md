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

**§3.4 交叉核验**：6 项经 ① todo-archive 表格扫描（关键词 `环境性失败` / `构建版本` / `CI 口径` / `workflow 对齐` / `pnpm store` / `weekly_digest` / `check-orphan-ids` / `check-experience-landing` / `lint-staged` 仅命中来源批次与残余观察项，无「已闭环」范围）；② `git log --oneline -- <候选路径>`（`verify-project.ts` 最近 `d76dcea8` / `pr-creator.ts` 最近 `37c93068` / `repo-fix.ts` 最近 `dd195219` / `Dockerfile` 最近 `957bc58f` / `package.json` 最近 `89fdb6ce` 均未覆盖本阶段范围）；③ 代码 anchor（`verify-project.ts:40` 只消费默认链 / 仓库 `verifyCommands`，engine / platform 无读取目标仓库 workflow 的代码（`scripts/check-verify-chain.mjs` 仅解析 dependfix 自身 workflow）；`build-info` 插件仅向平台 stdout 打版本戳、engine 运行日志无版本，`ScanRun` 无构建版本列；`result-assembly.ts:22-25` 自述升级路径未消费 `environmental`；engine / platform 产品代码无 `store-dir` 配置；`package.json:90/94/98` 裸 `git add` 仍在），**0 项重复评估**。

**审计 depth 预告**：M47.1 / M47.2 / M47.3 / M47.4 / M47.5 → `standard`（M47.1 若跨 engine + platform + PR 契约，建议 2 分区并发；M47.2 含迁移建议 2 分区）；M47.6 → `quick`。

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
  - [ ] ① 目标仓库为单 job `run: pnpm lint` / `pnpm build` / `pnpm test` 时，PR 正文出现「CI 口径：一致」说明；缺 `typecheck` 时明确列出「本仓库 CI 未跑 typecheck，本次已验证」。
  - [ ] ② 无法解析（无 `.github/workflows`、非法 YAML、非 GitHub Actions）时不阻断运行，PR 正文标注「未能读取 CI 配置」，并有对应单测。
  - [ ] ③ 口径比对所依据的 workflow 在默认分支最近一次结论为 failure 时，PR 正文标注「默认分支同 workflow 最近一次失败（非本 PR 引入）」；API 失败 / 限流 / 超时时不标注且日志 warn。
  - [ ] ④ 不改 `DEFAULT_VERIFY_COMMANDS`（`runners/verification-runner.ts`）、不改执行顺序、不改 exit code 与交付判定；mutation 至少 3 项（去比对 / 去降级 / 去健康预检）。
  - [ ] ⑤ 设计小节落地；新增用户可见文案走 i18n 双语（若落 UI）。
- **不做什么**：不按 workflow 动态替换 `verifyCommands`；不解析 matrix / secrets / services 的完整执行语义；不改 PR 创建条件；不覆盖 GitHub Actions 之外的 CI。
- **依赖**：`yaml`（engine 既有依赖）；`verification-runner.ts` 的 `DEFAULT_VERIFY_COMMANDS` 单一事实源；`pr-creator.ts` Verification 区块；GitHub Octokit 既有封装；原 backlog 候选「验证链与目标仓库 CI 命令对齐 / 默认分支 workflow 健康预检」（本阶段已上收）。
- **交付物**：预估 3-4 commits（解析与比对模块 + 单测 / 报告与 PR 正文 / 平台接线（若有）/ 设计小节与文案），**10-14 文件 / 450-700 行**（执行角色锚点计数，D 阶段复测）。
- **风险与缓解**：**R1 解析过度承诺**（workflow 形态千变万化）→ 只做可识别命令子集并显式标注「未识别」；**R2 API 配额 / 弱网** → 单次调用 + 超时 + 降级不阻断；**R3 PR 正文膨胀** → 固定行数预算，仅差异展开；**R4 被读成「CI 必绿」承诺** → 文案限定「命令口径」并声明不预测结果。

### M47.2 [P1 🛠️] 构建版本回执与安装日志语义订正

- **目标**：让每次运行的日志与落库记录能回答「本次运行由哪个构建版本 / commit 执行」，并把 `Lockfile repaired` 的中性语义写清楚。
- **优先级**：P1
- **范围**：
  - 数据层：`apps/platform/server/entities/scan-run.ts` 新增 `buildVersion` / `buildCommit`（可空）；新增迁移 `apps/platform/server/database/migrations/<新时间戳>-AddScanRunBuildInfo.ts` 并登记进 `createDataSourceOptions().migrations`。
  - 写入：`scan-orchestrator` / `scan-trigger` 的 run 创建点写两列（取值复用 `apps/platform/server/utils/build-info.ts` 的 `resolveBuildInfo()`，未注入为 `unknown`）。
  - 读取：run 详情 API / `run-detail-dialog`（或列表 tooltip）展示版本与 commit；`unknown` 不作错误态。
  - 引擎：`DependfixApp` 启动日志（`app/index.ts:296` 附近）输出版本 + commit；CLI 场景回退 `package.json` 版本；平台→引擎的传值形态在 D 阶段裁定（优先 `RuntimeConfig` 可选字段，避免新增隐式 env 依赖）。
  - 文案：`packages/engine/src/app/helpers.ts:564-568` 的无改动路径改为中性表述（如「lockfile 已合规，无需修复」），有改动路径保留原语义；核对报告 / PR 正文契约串消费者。
  - 文档：`docs/guide/configuration.md`（中英）+ 平台差异说明登记 env；`platform.md` 数据模型段同步列。
- **验收标准**：
  - [ ] ① 构建期注入时新建 run 两列写入真实值；未注入时为 `unknown`（非 null 崩溃）；API 返回且 UI 可见。
  - [ ] ② 引擎启动日志含版本 + commit；CLI 场景回退 package 版本，有单测。
  - [ ] ③ 「无改动」路径不再输出 `Lockfile repaired`（改中性文案）；「有改动」路径语义不变；`rg -n "Lockfile repaired"` 全仓无残留旧串（报告 / PR 正文消费者已核对）。
  - [ ] ④ 迁移在全新库与存量库真实迁移链均通过（复用 `migrations-registry.test.ts` 形态），两列可空。
  - [ ] ⑤ 不改 exit code / 交付判定；不改 `summaryJson` 契约（版本走独立列）。
- **不做什么**：不做部署回执（Jenkins webhook / 镜像推送对齐）；不回填历史 run（存量两列为 null）；不把构建版本塞进 `summaryJson`。
- **依赖**：`build-info.ts` 既有 `resolveBuildInfo()`；`ScanRun` 迁移链与 registry 测试；`helpers.ts` 日志行；原 backlog 候选「运行日志的语义订正与构建版本回执」（本阶段已上收）。
- **交付物**：预估 3-4 commits（迁移 + 数据层 / 引擎日志 / API + UI / 文档与文案），**8-11 文件 / 300-450 行**。
- **风险与缓解**：**R1 迁移漏登记**（生产 `synchronize=false` 时永不执行）→ 复用 registry 双向核对 + 存量库集成用例；**R2 构建期 env 未注入** → UI 显示 `unknown` + 文档写明注入方式，不影响运行；**R3 文案消费者漏改** → 结构化复扫 + 报告契约测试。

### M47.3 [P2 🛠️] 环境性失败归因收口（分类收窄 + 常规升级链路）

- **目标**：收窄「环境性失败」判定，并让常规分组 / 逐包升级 / major 路径消费安装结果的 `environmental` 标记，使环境性失败计数与真实环境故障一致。
- **优先级**：P2
- **范围**：
  - 归因接线：`packages/engine/src/app/result-assembly.ts:22-25` 自述的覆盖边界（常规分组 / 逐包升级 / major）→ 三条路径接入；调用点见 `app/repo-fix.ts:701,746` 与 major 路径。
  - 分类收窄：`ENVIRONMENT_ERROR` 判据从「stderr 空 / 信号 / 超时」扩展为「有明确 stderr 且非信号 / 非超时 → 非环境性」，抽单一判据函数（落 `runners/` 或 `fixers/` 既有分层）。
  - 语义交互：与 `failure_kind=transient`、`alertsFailed`、exit code、交付守卫的交互先在设计文档落结论（`docs/design/modules/dependency-fixer-records.md` 新增小节）再改代码。
  - 测试：三路径环境性用例、分类反例（明确 `ERR_PNPM_*` 不再环境性）、零修复且全部环境性 / 有真实失败两场景的 exit code 与交付回归。
- **验收标准**：
  - [ ] ① 常规 / 逐包 / major 路径在安装被信号杀死或超时时产出 `environmental` 标记并推 `ENVIRONMENT_ERROR`；`alertsFailed` 不计该告警；mutation 至少 3 项。
  - [ ] ② 有明确 stderr 的安装失败不再被判环境性（判据单测 + 端到端用例）。
  - [ ] ③ 「零修复且全部环境性」与「有真实失败」两场景的 exit code / status / 交付守卫与既有口径一致（回归用例）。
  - [ ] ④ 历史 run 计数不回填；文档声明仅新 run 生效。
  - [ ] ⑤ 设计结论小节先于实现提交（或同批 docs commit 在前）。
- **不做什么**：不改 `failure_kind` 枚举本身（需新增值另立条目）；不回填历史数据；不改 exit code 语义。
- **依赖**：M46.1 的 `RunSummary.environmentalFailures` 与 `ENVIRONMENT_ERROR` 计数；M47.2 的版本日志（诊断辅助）；原 backlog 候选「环境性失败分类语义收窄」+「常规升级链路的环境性失败归因对齐」（本阶段已上收）。
- **交付物**：预估 3 commits（设计结论 / 归因接线 + 测试 / 分类收窄 + 回归），**6-9 文件 / 250-420 行**。
- **风险与缓解**：**R1 分类收窄把真实环境故障归因仓库** → 保守判据（只有明确 stderr 才非环境性）+ 反例用例；**R2 计数与 exit code 双源漂移** → 单一映射函数 + 映射用例；**R3 行为变更面广** → 先设计后实现，D 阶段定向回归 + `standard` 审计。

### M47.4 [P2 🚀] pnpm store 持久化与提交卫生

- **目标**：把 pnpm content-addressable store 固定到持久卷，并在交付提交前排除 store / `node_modules`，避免每 run 冷安装与误提交。
- **优先级**：P2
- **范围**：
  - `apps/platform/docker/entrypoint.sh`：在启动前设置 store 目录（`PNPM_CONFIG_STORE_DIR` 或 `pnpm config --global set store-dir`，D 阶段按 pnpm 官方口径实测二选一），默认 `/app/data/pnpm-store`；不可写时 warn 并回退既有行为。
  - `apps/platform/server/services/executor/container-executor.ts`（clone 后准备阶段）：幂等追加 `.pnpm-store/` / `node_modules/` 到目标仓库 `.git/info/exclude`；不修改目标仓库 `.gitignore`。
  - `apps/platform/Dockerfile` / `docs/guide/deployment.md`：数据卷挂载示例、容量建议、手工清理命令；env 权威登记与 `configuration.md` 同步。
  - 测试：entrypoint 源码顺序静态断言；`git/info/exclude` 幂等单测；`git add .` 后暂存区不含 store 的用例。
- **验收标准**：
  - [ ] ① 容器内 `pnpm store path` 落在持久目录（默认 `/app/data/pnpm-store`），跨 run 复用；未挂载持久卷时回退既有行为且日志 warn（不阻断）。
  - [ ] ② 目标仓库 `git add .` 后暂存区不含 `.pnpm-store/**` / `node_modules/**`（单测 + 真实场景）。
  - [ ] ③ `.git/info/exclude` 重复执行不重复追加；不修改目标仓库 `.gitignore`。
  - [ ] ④ 部署文档给出卷挂载、容量建议与清理方式；env 与 `configuration.md` 双语同步。
  - [ ] ⑤ 不改 clone / 安装 / 提交语义；mutation 至少 2 项。
- **不做什么**：不实现自动 GC 调度；不做多仓共享 store 并发控制（队列并发 1）；不改 pnpm 版本。
- **依赖**：原 backlog 候选「pnpm store 持久化与项目内 store 的提交卫生」（本阶段已上收）；`entrypoint.sh` 的信号 / 角色约束（`platform.md §10.6`）；pnpm 官方 `store-dir` 配置口径（已查证 `pnpm_config_store_dir` / `pnpm config set store-dir`）。
- **交付物**：预估 3 commits（entrypoint + 部署文档 / git exclude + 测试 / 文档与 env），**6-9 文件 / 200-350 行**。
- **风险与缓解**：**R1 持久卷未挂载导致磁盘占满** → 容量建议 + 启动 warn + 文档；**R2 store 与工作目录跨文件系统**（只能 copy 不能 hardlink，收益有限）→ 文档写明同卷要求；**R3 exclude 误伤** → 只写 `.git/info/exclude` 且幂等。

### M47.5 [P2 🚀] 通知周汇总（`weekly_digest`，M46.5 B5）

- **目标**：落地 `weekly_digest` 固定周期插件（默认关闭），按 ISO 周 + 用户逐封去重，发送活跃未修复高危快照。
- **优先级**：P2
- **范围**：
  - `apps/platform/server/plugins/` 新增周汇总插件（周一 09:00，`DEPENDFIX_WEEKLY_DIGEST_HOUR` 可覆盖），按进程角色单实例运行（复用 `server/utils/process-role.ts`；角色归属需与 `HTTP_ONLY_PLUGINS` / `NON_HTTP_ONLY_PLUGINS` 分类一致性用例同步）。
  - `apps/platform/server/services/notification/`：复用 `high-risk.ts` 查询 + 周报模板（按仓库分组 + 截断 / 豁免计数披露）+ `deliveryKey = sha256('digest', weekKey, recipientUserId, channel, 'weekly_digest')` 逐封投递；`weekly_digest` 豁免指纹 / 冷却 / 每小时上限（设计 §7.3 例外）。
  - `apps/platform/app/pages/settings.vue:594-598` 与 `notifications.vue`：去掉 `weekly_digest` 的 disabled / `weeklyDigestUnavailable`，改为可配置。
  - i18n 双语；`docs/design/governance/platform-notification.md` 状态与 B5 段更新。
  - 测试：ISO 周键与跨年周边界（注入时钟）、组织 + 个人双层开关、内容不变仍发送、按用户逐封去重、角色单实例、无收件人 / 渠道不可用。
- **验收标准**：
  - [ ] ① 默认关闭；组织 + 个人同时开启时每周一 09:00（服务器时区）发送一次，按 ISO 周去重，内容未变化也发送。
  - [ ] ② 同一用户 + 渠道 + 周仅一封（并发占位）；投递记录写入 `recipientUserId`。
  - [ ] ③ 任一层关闭（组织 / 个人 / 全局 `DEPENDFIX_NOTIFICATION_ENABLED=false`）不产生周报。
  - [ ] ④ 仅一个进程执行（role 守卫 + 单测），HTTP / worker 双进程不双发。
  - [ ] ⑤ 周报正文披露截断 / 豁免计数；`settings.vue` 不再显示「暂不可用」；设计稿状态同步。
- **不做什么**：不做通用摘要调度器；不做周报历史归档页；不做时区逐用户配置；不做 Slack / Webhook 投递。
- **依赖**：M46.5 B1-B4（通知服务 / 偏好 / 投递记录 / 去重键）；`platform-notification.md §6.5 / §7.3 / §B5`；`process-role.ts` 角色守卫。
- **交付物**：预估 3-4 commits（插件 + 周期触发 / 周报查询与模板 + 测试 / UI 与 i18n / 设计稿状态），**5-8 文件 / 200-350 行**。
- **风险与缓解**：**R1 双进程双发** → role 守卫 + 单测；**R2 时区 / ISO 周边界** → 注入时钟用例；**R3 邮件量大** → 仅开启者接收 + 逐用户去重；**R4 与「内容未变化不重复推送」冲突** → 设计已声明周报例外，测试锁定。

### M47.6 [P3 🧪] 工程门禁与提交卫生收口

- **目标**：补齐三条工程门禁 / 提交卫生缺口，使子任务字母后缀编号、经验归档子条目落点、lint-staged 全量暂存都能被机检或消除。
- **优先级**：P3
- **范围**：
  - `scripts/check-orphan-ids.mjs`：`PLANNING_ID_RE` 支持子任务字母后缀（如 `M43.2a`），评估既有真常量白名单误报面；fixtures 用运行时拼接 token（避免被门禁自扫）。
  - `scripts/check-experience-landing.mjs`：落点校验粒度由 `##` 改为 `###` 逐条；自指落点（「本条环境注记」）单独告警；存量条目按实测补真实落点或登记白名单。
  - `package.json:87-102` lint-staged：移除三条裸 `git add`（保留 `packages/skills/**` 带路径的正确形态）。
  - 文档：`docs/standards/documentation.md` / `testing.md` 对应条款（若需）+ review 检查点矩阵（若新增规则）。
- **验收标准**：
  - [ ] ① `check-orphan-ids` 对 `M43.2a` 形态在源码注释 / 测试名中命中（fixture 单测），合法文档指针仍通过；全仓 `pnpm check:orphan-ids` 0 error。
  - [ ] ② `check-experience-landing` 对同 `##` 下某 `###` 无落点报错（fixture），存量全仓 0 error；自指落点被标记。
  - [ ] ③ 移除裸 `git add` 后，多文件工作区下单个 commit 仅含指定文件（实测）；husky 不再打印 `tasks use git add` 告警。
  - [ ] ④ 三条改动均有单测 / 实测证据；mutation 至少 3 项。
  - [ ] ⑤ 不改变门禁退出码语义（新增规则自身除外）。
- **不做什么**：不做全仓编号重命名；不做 lint-staged 性能优化；不改 husky 其他钩子。
- **依赖**：原 backlog 三条候选（本阶段已上收）；`check-orphan-ids` 的产物排除改动；`check-experience-landing` 既有分片结构；`package.json` lint-staged 段。
- **交付物**：预估 3 commits（编号门禁 / 落点门禁 / lint-staged + 文档），**6-8 文件 / 200-380 行**。
- **风险与缓解**：**R1 字母后缀正则误报**（文档 ID / 版本号）→ 先跑一次性探针量化分布 + 白名单；**R2 `###` 粒度导致大量存量报错** → 先量化，必要时分批补落点并登记；**R3 移除裸 add 后重暂存行为变化** → 多文件提交实测。

---

## 交付原则

- 每个里程碑必须通过 lint + typecheck + build + test 质量门
- 里程碑交付前需经过 code-reviewer 技能审查
- 剩余风险必须在交付说明中清晰记录
