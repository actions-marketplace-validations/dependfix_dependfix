# 当前阶段待办

> 本文件**仅**登记当前阶段活跃待办；已闭环阶段归档于 [todo-archive.md](todo-archive.md)；未排期 / 延期 / 远期 / 长期主线 / 已知边界登记于 [backlog.md](backlog.md)。

---

## 文档位置速查

| 内容类型 | 位置 |
|:--|:--|
| 当前阶段任务 | **M48：对外 PR 交付闭环**（2026-10-24 用户决策 D+E；六原子见下） |
| 下一阶段（已授权，未规划） | **E：通知可信度收口**（4 项，待 M48 归档后启动 P 阶段） |
| 已完成阶段归档 | [todo-archive.md](todo-archive.md)（主窗口 + [archive/](archive/) 分片；M0-M47 全部已归档） |
| 里程碑与阶段交付 | [roadmap.md](roadmap.md) |
| 未排期 / 延期 / 远期 / 长期主线 / 已知边界 | [backlog.md](backlog.md) |
| 历史归档索引 | [archive/index.md](archive/index.md) |

---

## M48：对外 PR 交付闭环（2026-10-24 用户决策 D+E）

承接 M47 归档后的「**发出去的 PR 必须是绿的**」阶段。2026-10-24 对外 PR 巡检（60 个已建 PR / 60 个已合并 PR；66 为含历史可查 PR）暴露一条完整根因链：**写入侧不做家族约束**（`vitest@4` + `@vitest/coverage-v8@3` 混装）→ **验证侧只跑固定四语义项**（目标仓 CI 的 `coverage` / `e2e` 永不执行）→ **交付侧不记尝试**（PR 关闭后原样重开）→ **提交面过宽**（`git add .` 混入生成物）→ **回环缺失**（红 PR 无人收）→ **归因缺失**（合并后外部作业红与本次修复同列）。本阶段按此链拆为 6 原子，设计依据 [pr-delivery-closure.md](../design/governance/pr-delivery-closure.md)。

**阶段基线工作量（§3.1.1 再平衡分母）**：6 条目「交付物」区间和为 **35-55 文件 / 2200-3700 行**（量级估算，执行角色按候选锚点计数；D 阶段按实际 diff 复测）。

**6 原子条目**（🛠️ 5 + 🚀 1；🎨 / 🧪 独立条目缺口显式标注，测试随各条目内嵌）：

- **M48.1** [P0 🛠️] 兄弟包 / peer 家族锁步升级
- **M48.2** [P0 🛠️] CI 独有脚本纳入验证链（`--mirror-ci-scripts`）
- **M48.3** [P0 🛠️] 同告警尝试指纹去重与降级
- **M48.4** [P1 🛠️] 提交面白名单与 `pnpm-workspace.yaml` 定点编辑
- **M48.5** [P1 🛠️] PR 创建后 CI 回环（CLI / Action 侧）
- **M48.6** [P1 🚀] 外部作业归因与合并门禁

### M48.1 [P0 🛠️] 兄弟包 / peer 家族锁步升级

- **目标**：同一次修复内，同一生态成员必须保持同一版本线（首批 vitest / typescript-eslint / jest / react 四家族），禁止跨大版本混装进入 PR。
- **范围**：新增 `packages/engine/src/fixers/dependency/families.ts`（家族清单 + `resolveFamily` / `planFamilyUpgrade` 纯函数）；`fixers/dependency/index.ts`、`app/repo-fix.ts`、`app/repo-fix-member.ts` 接入升级计划与动作记录；`packages/core/src/report/types.ts` 增加 `FixAction.family`；`github/pr-creator.ts` 的改动摘要；定向测试。
- **验收标准**：
  1. `resolveFamily` 覆盖四家族成员，未知包返回 `null`；`eslint@9 + typescript-eslint@8` 合法反例不得判为违规（`eslint` 只做 peer range 校验，不属同 major 家族）；反向夹具（peer range 不满足）必须整族放弃并留痕。
  2. vitest 家族升级 `vitest` 3→4 时，`@vitest/coverage-v8` 同步升到 4.x；已在目标线的成员不降级、不重复写盘。
  3. 版本解析失败 / registry 不可达 → 整族回滚（含 lockfile），`FixAction.error = FAMILY_LOCKSTEP_FAILED`，不创建 PR；**不在 manifest 中的 peer 成员**记 `familyMemberSkipped` 并继续（两个条件分开实现）。
  4. 显式 `upgradeGroups` 优先于家族规则；`override-protect` 命中任一成员时整族放弃并留痕，不产生半族 PR。
  5. mutation 至少 2 处（成员匹配 / 回滚分支）被击杀；既有常规 / 跨线 / 成员 / overrides 升级链测试全绿。
- **不做什么**：不做自动家族推导；不做间接依赖家族合并；不承诺 TypeScript 编译器兼容矩阵；不扩展首批四家族之外。
- **依赖**：2026-10-24 巡检证据；既有 `upgradeDependency` / `upgradeAlert`；`docs/design/modules/dependency-grouping.md` §8「组内必须锁步」遗留项（M48.1 承接）；设计稿 §4。
- **交付物**：3-4 commits / 6-9 files（`families.ts` 新增、`fixers/dependency/index.ts`、`app/repo-fix.ts`、`app/repo-fix-member.ts`、`packages/core/src/report/types.ts`、`github/pr-creator.ts`、测试与文档）/ 350-600 行（量级估算）；实际 > 10 文件则拆 a/b 两批。
- **风险与缓解**：私有 registry 解析失败 → 整族回滚 + 记录；家族清单误配 → 反例夹具 + peer range 校验；显式分组冲突 → 优先级规则 + 整族放弃。

### M48.2 [P0 🛠️] CI 独有脚本纳入验证链

- **目标**：开启 `--mirror-ci-scripts` 后，目标仓库 CI 独有的 `pnpm run <script>` 进入验证链，使「本地绿」与「CI 绿」的差异可见、可执行、可归因。
- **范围**：`packages/engine/src/github/ci-alignment.ts` 新增结构化 `runFragments` 导出（不复用展示用 `unrecognized`）；`app/verify-project.ts` 在默认链后追加执行并接入基线采样；`config/index.ts` + CLI `--mirror-ci-scripts` + `action.yml`；`packages/core/src/report/ci-alignment.ts` 增加 `mirrored` / `mirrorSkipped`；PR 正文「CI 口径」区块。
- **验收标准**：
  1. 从 `runFragments` 解析出 `coverage` / `e2e` 等脚本并去重；`docker build` / `gh` / 任意 shell 记 `mirrorSkipped`；最多执行 3 条，超限披露。
  2. 开启时执行顺序为默认链 → CI 镜像脚本，首个失败即停；关闭时行为与现状等价（等价性用例锁定，不写「逐字节」）。
  3. 单条脚本沿用验证命令超时（`DEFAULT_COMMAND_TIMEOUT_MS` 10 分钟，env 可覆盖），运行级取消可中断。
  4. mirror 命令纳入修复前基线采样：基线已红 → `preExisting`，不参与回滚、不改变 exit code；非基线失败按本次改动归因。
  5. PR 正文显示「已镜像执行 N 条 / 跳过 M 条」；运行报告逐条记录 `source=default|repo-config|ci-mirror`。
  6. mutation 至少 2 处（脚本筛选 / 首失败短路）被击杀；既有 `ci-alignment` 与验证链测试全绿。
- **不做什么**：不执行 `docker build` / 任意 shell；不替换仓库级 `verifyCommands`；不解析 matrix / secrets / services；不改 M47.1 四语义比对口径；不在平台设置页新增开关（平台沿用默认 `false`）。
- **依赖**：M47.1 `ci-alignment`；受管异步执行基座；`verification-runner.ts` 超时口径；设计稿 §5。
- **交付物**：4-5 commits / 6-9 files（`ci-alignment.ts`、`verify-project.ts`、`config/index.ts`、`cli/index.ts`、`action.yml`、core 报告类型、测试）/ 400-650 行（量级估算）。
- **风险与缓解**：每仓多跑一条完整测试链导致时长上升 → 默认关闭 + 上限 3 条 + 单命令超时 + 报告耗时；基线红仓库误回滚 → mirror 纳入基线采样。

### M48.3 [P0 🛠️] 同告警尝试指纹去重与降级

- **目标**：同一告警、同一目标版本、同一修复策略在连续两次关闭后不再原样重开；第 3 次尝试起跳过并留痕，用户可显式强制重试。
- **范围**：新增 `packages/engine/src/github/fix-fingerprint.ts`（尝试键 + 可选失败签名归一化纯函数）；`github/pr-creator.ts` 写入 / 解析 PR 正文标记、运行级缓存最近关闭 PR；`app/index.ts:581` / `app/delivery.ts` 跳过记账；`packages/core/src/report/types.ts` 的 `SKIP_REASONS` 增加 `repeated-failure`；CLI / Action 开关 `--retry-failed`；报告 `alertsSkippedByReason`。
- **验收标准**：
  1. 尝试键由 `source / packageName / targetVersion / planStrategy` 计算，创建前即可得到；同一输入稳定，策略或目标版本变化后不同。
  2. PR 正文标记可往返解析；`n` = 同 key 最近关闭 PR 数 + 1；标记被人工改写或解析失败按未命中处理（fail-open）。
  3. 同 key 第 1 / 2 次尝试允许执行；第 3 次起跳过，落 `FixAction.noOp` + `alertsSkippedByReason['repeated-failure']`，不创建 PR、不增 `alertsFailed`，且 `sum(alertsSkippedByReason) === alertsSkipped` 用例锁定。
  4. `--retry-failed` 显式忽略命中并强制再试，报告标注「人工强制」；目标版本变化后键自然失效。
  5. 最近关闭 PR 按仓库每轮缓存一次（不按告警重复 `pulls.list`）；上限 / 分页 / 缓存失败 fail-open 有用例。
  6. mutation 至少 2 处（尝试键归一化 / 命中分支）被击杀。
- **不做什么**：不新建平台持久表；不做聚合 issue；不改 open PR 去重语义；不自动关闭 PR；不做跨仓库签名聚合。
- **依赖**：既有 `FixAction.error` / `FixError.stage` 失败证据；`findDependfixOpenPR`；`packages/core` 跳过原因枚举；设计稿 §6。
- **交付物**：4 commits / 5-8 files（`fix-fingerprint.ts` 新增、`pr-creator.ts`、`app/index.ts`、`app/delivery.ts`、core 报告类型、CLI / Action、测试）/ 300-500 行（量级估算）。
- **风险与缓解**：关闭 PR 超过查询窗口漏命中 → fail-open + 文档边界；误跳过 → `--retry-failed` 逃生；人工关闭非失败 PR 被计数 → 文档声明 + 逃生开关。

### M48.4 [P1 🛠️] 提交面白名单与 `pnpm-workspace.yaml` 定点编辑

- **目标**：PR 提交只含修复相关文件与 fixer 声明路径；override 写入只改目标键，消除整文件引号 / 键序重排。
- **范围**：`packages/engine/src/github/pr-creator.ts` 以 `git add -- <paths>` 替换 `git add .`，提交前比对未声明改动；`fixers/dependency/index.ts` 改用 `YAML.parseDocument` + `setIn`；`app/helpers.ts` / `app/index.ts:617` / AI patch 汇总 `changedPaths`；临时仓库夹具。
- **验收标准**：
  1. 可执行调用 0 命中：`rg -n "\['add', '\.'\]" packages/engine/src --glob '!*.test.ts'` 期望 0（注释若保留该数组字面量会被计入，须改写为散文）；提交调用只接受显式路径集合。
  2. 临时仓库预置 `.nuxtrc` / `auto-imports.d.ts` / 未声明源码改动 → 提交集合只含白名单与声明路径；未声明改动报 `UNEXPECTED_CHANGES` 并打印路径。
  3. 白名单用 glob 覆盖成员 manifest（`**/package.json`）；路径校验拒绝绝对路径、`..`、`:(` 开头、控制字符。
  4. `pnpm-workspace.yaml` 三种既有风格（单引号 / 无引号 / 含注释）夹具仅目标键变化，引号、键序、注释保留；`parseDocument` 失败时保持原文件不写盘并留痕。
  5. AI patch 路径被纳入；空集合报 `NO_CHANGES`；生成物黑名单不被提交。
  6. mutation 至少 2 处（路径集合 / 未声明改动检测）被击杀；既有 `pr-creator` 与 dependency fixer 测试全绿。
- **不做什么**：不做黑名单式排除；不改 `.gitignore` 自动管理；不提交生成物；不改报告目录忽略规则。
- **依赖**：M47.4 的 `.git/info/exclude`；fixer / AI patch 的路径返回结构；设计稿 §7。
- **交付物**：4-5 commits / 6-10 files（`pr-creator.ts`、`fixers/dependency/index.ts`、`app/helpers.ts`、`app/index.ts`、AI patch 路径、测试）/ 400-700 行（量级估算）；实际 > 10 文件则拆 a/b 两批。
- **风险与缓解**：AI fixer 漏声明路径 → 未声明检测失败并打印路径；YAML 注释保留不完整 → 黄金夹具锁定三种风格；pathspec magic 绕过 → 前缀校验。

### M48.5 [P1 🛠️] PR 创建后 CI 回环（CLI / Action 侧）

- **目标**：创建 PR 后可选等待 check 终态；失败时默认评论失败摘要、可选关闭坏 PR，使红 PR 不再静默挂起。
- **范围**：新增 `packages/engine/src/github/pr-check-watch.ts`（轮询状态机 + 退避 + per-PR / per-run 预算）；`pr-creator.ts` 接线；`app/index.ts:635` 调用点（581 的去重分支归 M48.3）；`packages/core/src/report/types.ts` 增加 `RunResult.prCheckWatch`；CLI `--wait-pr-checks` / `--close-failed-pr` + Action input；mock Octokit 测试。
- **验收标准**：
  1. 状态机覆盖 `passed / failed / cancelled / no_ci_detected / timeout`；终态要求「已观测到至少一条 check」，宽限期后仍为 0 → `no_ci_detected`，绝不判 `passed`。
  2. 默认失败动作 = 评论（含失败 job 名 + URL + 尝试标记）；`--close-failed-pr` 仅在分类 `self_caused` 时关闭并删分支；`unknown` 只评论不关闭。
  3. `external_noise` / `pre_existing` 只评论；`cancelled` 不评论；`no_ci_detected` 只写报告。
  4. dry-run 不评论、不关 PR、不删分支；per-PR 上限 15 分钟 + per-run 总预算 20 分钟（且 ≤ 剩余 job 预算 70%），超预算记 `checksTimedOut`。
  5. API 429 / 网络错误按退避重试并记录，不抛断运行；轮询不改变修复结果与 exit code。
  6. mutation 至少 2 处（终态判定 / 关闭条件）被击杀。
- **不做什么**：不跨进程续等；不下沉平台 PR Check 轮询；不做 webhook；不自动合并；平台侧建 PR 后回环不在本阶段。
- **依赖**：M48.6 分类器（先落地）；M48.3 尝试标记；Octokit checks / statuses API；设计稿 §8。
- **交付物**：5 commits / 6-9 files（`pr-check-watch.ts` 新增、`pr-creator.ts`、`app/index.ts`、core 报告类型、CLI / Action、测试）/ 400-650 行（量级估算）。
- **风险与缓解**：等待吃满 job 预算 → 默认关闭 + 双预算；API 配额 → 运行级缓存 + 退避；误关 PR → 仅 `self_caused` + 显式开关 + dry-run 守卫。

### M48.6 [P1 🚀] 外部作业归因与合并门禁

- **目标**：已采集的 check 结果按 `self_caused` / `pre_existing` / `external_noise` / `cancelled` / `unknown` 分类，报告与平台视图同源呈现；自动合并门禁覆盖同批 job。
- **范围**：新增 `packages/core/src/report/check-attribution.ts`（分类纯函数 + 规则表）；`packages/core/src/report/types.ts` 的 `RunResult.prCheckWatch` 分类字段；报告渲染；`apps/platform` PR Check 视图消费同一分类；`.github/mergify.yml` 两条规则统一补齐；`docs/guide/auto-merge.md` 与 `pr-build-deploy-signals.md` 口径同步。
- **验收标准**：
  1. 五类规则夹具（Dependabot updater / ACR manifest / 父提交已红 / cancelled / 未知）判定正确；未知一律 `unknown`，不得默认 `self_caused` 或 `external_noise`。
  2. 报告与平台 UI 分类来自同一纯函数（等价性用例），不出现两套标签。
  3. `.github/mergify.yml` 的 dependabot / dependfix 两条规则均含 Test / Coverage / E2E / Visual Regression；单测解析 `test.yml` job 名并与规则比对，漂移即失败；文档写明「`skipped` 不等于 success」。
  4. 归因只驱动报告 / UI / 评论 / 关闭（关闭仅 `self_caused`），**不绕过 mergify 的 `check-success` 门禁**；`unknown` 阻断合并但不关闭。
  5. mutation 至少 2 处（分类兜底 / 关闭条件）被击杀；既有 PR Check / 报告测试全绿。
- **不做什么**：不新增合并后 check 采集链路；不自动在目标仓启用 mergify；不改平台 open PR 轮询；不把归因结果用于 exit code。
- **依赖**：平台 `monitor/build-signals` 数据面；`PRE_EXISTING_FAILURE` 既有口径；M48.5 的真实 CLI check 接线（本条先以夹具 + 平台现有数据验证）；设计稿 §9。
- **交付物**：5 commits / 6-10 files（`check-attribution.ts` 新增、core 报告类型、平台视图、`.github/mergify.yml`、`auto-merge.md`、`pr-build-deploy-signals.md`、测试）/ 350-600 行（量级估算）。
- **风险与缓解**：外部作业形态变化 → `unknown` 兜底 + 规则表注释 + 样例夹具；mergify 条件与 job 名漂移 → 单测比对 `test.yml`；误判真实回归 → 关闭仅 `self_caused`、归因不参与合并放行。

**类型平衡复核**：🛠️ 5（M48.1 / M48.2 / M48.3 / M48.4 / M48.5）+ 🚀 1（M48.6）。🎨 / 🧪 独立条目缺口显式标注：本阶段由 P0/P1 外部交付证据驱动，UX / 测试能力分别由 E 阶段与各条目内嵌用例承担；不新增第 7 原子以避免越过 5-6 项上限。

**建议顺序**：M48.4 → M48.1 → M48.2 → M48.3 → M48.6 → M48.5。M48.4 最小且独立，先降后续 PR 的 diff 噪声；M48.1 断根因（家族混装）；M48.2 让验证结果可信；M48.3 收敛重复失败；M48.6 的分类纯函数先落地（无副作用、可独立验证），M48.5 的回环再消费它，避免循环依赖。

**条目容量**：6 原子符合 [规划规范 §1.1](../standards/planning.md#11-硬性约束) 的 5-6 项上限。M48.4 单体最大（6-10 文件 / 400-700 行），在上界附近；实际 > 10 文件即按 a/b 拆分。

**范围边界（不做什么）**：不做通用依赖图 / 自动家族推导；不执行 `docker build` / 任意 shell；不建平台尝试指纹表；不做聚合 issue；不新增合并后 check 采集；不自动在目标仓启用 mergify；归因不绕过 mergify 门禁；平台侧建 PR 后回环不在本阶段；不改 exit code 语义与 `PRE_EXISTING_FAILURE` 口径。

**§3.4 交叉核验**：6 项经 todo-archive 表格扫描（关键词 `锁步` / `peer` / `check-runs` / `git add .` / `失败指纹` / `external_noise` / `unrecognized` / `自动合并` / `mergify` 仅命中 M21.4 mergify 模板 + auto-merge 指南、M21 RG-W01 `git add .` 的 shell 注入修复、M24.1 PR Check open-only MVP——均为前置能力，非本阶段范围）+ `git log --all --grep=锁步`（命中 `8627edcb` 的 dependency-grouping 设计稿，已作为 M48.1 前置遗留项登记）+ `git log --oneline -- <路径>`（`ci-alignment.ts` 仅 `8888999e`；`pr-creator.ts` 最近 `612a457b` / `37c93068` / `8a6c84ef` / `cb5c1468`；`fixers/dependency/index.ts` 最近 `0d1dd455` / `873735d6` / `9f747fea`——均未覆盖本阶段范围（仅列最近条目，非穷举））+ 代码 anchor（`pr-creator.ts:230` 仍 `git add .`；`ci-alignment.ts:159/214` 仅记展示态 `unrecognized`；`findDependfixOpenPR` 仅 `state:'open'`；`fixers/dependency/index.ts:481/526` 仍 `YAML.stringify`；engine / cli 无 `check-runs` 调用；`external_noise` / `checkAttribution` 0 命中；`mergify.yml` dependfix 规则仅 `check-success=Test`），**0 项重复评估**。

**审计 depth 预告**：M48.1 / M48.3 / M48.4 / M48.5 → `standard`（M48.3 / M48.5 跨 engine + cli + action，建议 2 分区并发）；M48.2 → `standard`（engine + cli，2 分区）；M48.6 → `deep`（core + platform + CI 模板，含治理定义与外部调用）。

**后续阶段（已授权，待规划）**：**E：通知可信度收口**（4 项：`critical` 必选不可关闭 / 通知严重级别术语与阈值命名 / 周报投递重试与窗口锁 / `/settings` 与通知页 dark 视觉）。用户 2026-10-24 决策 D+E；E 待 M48 归档后按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 启动 P 阶段，不占 M48 条目容量与编号；启动时按 §1.1 评估是否补足至 5 项。
