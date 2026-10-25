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

### M48.1 [P0 🛠️] 兄弟包 / peer 家族锁步升级（**已闭环** `251c392c` + `c15bf8a8` + `5fb836bc` + `4a358bde` + `88c52744` + `8ff42a74` + `5033125f` + `ca4a95aa` + `f94981f0` + `48ff3d96` + `e3600c94`）

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

**落地**（2026-10-25）：新增 `fixers/dependency/families.ts`（四家族清单 + `resolveFamily` / `planFamilyUpgrade` 两阶段纯函数，同 major / 同精确版本两种锁步维度）与 `family-versions.ts`（registry packument 解析 / peer 元数据 / URL 归一化与缓存）；`manifest.ts` + `manifest-upgrades.ts` 把单包与家族的「校验 → 备份 → 一次写盘 → 一次 install → 整体回滚」收敛到同一实现，回滚失败保留 `.bak` 并披露；`app/family-upgrade.ts` 编排（pending → 解析 → 重算 → 写盘），接入常规分组 / 拆组逐包（同批告警目标优先）、workspace 成员、跨线三条路径；`FixAction.family` + core `collectFamilySummaries`（只消费成功且非 noOp，仓库级收敛，`members ∩ skipped = ∅`）+ 报告 `Family Lockstep` 段 + PR 正文 Family 列 / 段；`FAMILY_LOCKSTEP_FAILED` 登记平台失败分类（fix + deterministic）。`eslint` 只做 peer range 校验（`eslint@9 + typescript-eslint@8` 合法反例）；peer 不可解析 fail-open 留痕；同版本家族成员高于目标 → 整族放弃（不降级）。为控制 max-lines，`upgradeAlert` 与跨线升级循环分别迁出为 `app/upgrade-alert.ts` / `app/repo-fix-major.ts`（纯搬迁）。
- **审计**：B1 quick Reject（1 blocker：跨 manifest 摘要合并产生 `members ∩ skipped ≠ ∅`；5 warning）→ 收口（仓库级口径 + 成功/非 noOp 过滤 + 测试补强）；B2 standard Pass（0 blocker / 4 warning，全部收口：回滚失败保留备份、失败口径回归断言、写盘顺序不变量）；B3 standard Pass（0 blocker / 9 warning，收口安全与语义：工厂 URL 归一化、不跟随重定向、错误只暴露 host、同版本冲突整族放弃、alertTargets 精确判定、manifest 原型污染防护、peer fail-open 留痕、测试补强）；B4 standard Reject（1 blocker：提交粒度 11 文件 / 混类型）→ 拆 C1 纯搬迁 / C2 编排 / C3 接线三段并补齐环境性 / 非环境性失败与分组成员回滚用例；B5 quick Reject（2 blocker：失败/出口码文档与实现矛盾、范围外测试混入）→ 收口 → R2 quick Pass（1 非阻塞 warning 已修）；mutation 4/4（成员匹配 / 回滚分支 / peer 校验 / 摘要过滤）。
- **证据**：`pnpm run typecheck` 7 包 Done；`pnpm test` 317 passed | 2 skipped 文件 / 4849 passed / 10 skipped（首跑 1 例偶发失败、复跑全绿）；`pnpm lint` 0 error（3 条存量 warning）；`pnpm run build` packages 全绿；`check:docs` OK / `check:doc-size` 0 warning / `lint:md` OK / `check:orphan-ids` 0（816 文件）/ `standards-redundant:strict` 0 / `experience-landing` OK / `verify-chain` OK / `docs:check:i18n` OK / `i18n:check:anchor` OK / `docs:build` exit 0（fallback 118）；mutation 工件 `artifacts/review-gate/2026-10-24-m48-1-mutation.md`（还原后 md5 一致）；新增/修改源文件编号标记 0 命中。
- **边界**：只覆盖同一 manifest 内的直接依赖（跨 manifest 家族不合并）；registry 解析依赖可达，`.npmrc` 按既有 registry-discovery 信任模型、`@scope:registry` 不覆盖；解析 / peer / 非环境性写入失败 → failed + `FAMILY_LOCKSTEP_FAILED`（影响 exit code），环境性安装失败走 `ENVIRONMENT_ERROR`（不计 failed），override-protect 为 noOp + skipped；`peerCheckSkipped` 仅日志留痕（不进报告）；同版本家族出现成员高于目标时整族放弃（宁可不修也不降级混装）。

### M48.2 [P0 🛠️] CI 独有脚本纳入验证链（--mirror-ci-scripts）（**已闭环** `f28e4806` + `979a9775` + `c527f56d` + `c3750848`；文档随本批收口）

- **目标**：开启 `--mirror-ci-scripts` 后，目标仓库 CI 独有的 `pnpm run <script>` 进入验证链，使「本地绿」与「CI 绿」的差异可见、可执行、可归因。
- **范围**：`packages/engine/src/github/ci-alignment.ts` 新增结构化 `runFragments` 与 `planCiMirrorCommands`（不复用展示用 `unrecognized`）；`app/verify-project.ts` 在默认链后追加执行并接入基线采样；`config/index.ts` + CLI `--mirror-ci-scripts` + `action.yml`；`runners/verification-runner.ts` 超时 env；`packages/core/src/report/ci-alignment.ts` 增加 `mirrored` / `mirrorSkipped`，`FixAction.commandSource`；PR 正文「CI 口径」区块；设计 / 规范 / 配置文档同步。
- **验收标准**：
  1. 从 `runFragments` 解析出 `coverage` / `e2e` 等脚本并去重；`docker build` / `gh` / 任意 shell 记 `mirrorSkipped`；最多执行 3 条，超限披露。
  2. 开启时执行顺序为默认链 → CI 镜像脚本，首个失败即停；关闭时行为与现状等价（等价性用例锁定，不写「逐字节」）。
  3. 单条脚本沿用验证命令超时（`DEFAULT_COMMAND_TIMEOUT_MS` 10 分钟，env 可覆盖），运行级取消可中断。
  4. mirror 命令纳入修复前基线采样：基线已红 → `preExisting`，不参与回滚、不改变 exit code；非基线失败按本次改动归因。
  5. PR 正文显示「已镜像执行 N 条 / 跳过 M 条」；运行报告逐条记录 `source=default|repo-config|ci-mirror`。
  6. mutation 至少 2 处（脚本筛选 / 首失败短路）被击杀；既有 `ci-alignment` 与验证链测试全绿。
- **不做什么**：不执行 `docker build` / 任意 shell；不替换仓库级 `verifyCommands`；不解析 matrix / secrets / services；不改 M47.1 四语义比对口径；不在平台设置页新增开关（平台沿用默认 `false`）。
- **依赖**：M47.1 `ci-alignment`；受管异步执行基座；`verification-runner.ts` 超时口径；设计稿 §5。
- **交付物**：4-5 commits / 6-9 files（量级估算）。**实际**：5 commits / 27 文件 / +1237 −60（tracked +892/−60 + 3 个新测试文件 345 行；超估算原因为新增超时 env、3 个新测试文件与 7 个文档同步）。
- **风险与缓解**：每仓多跑一条完整测试链导致时长上升 → 默认关闭 + 上限 3 条 + 单命令超时 + 报告耗时；基线红仓库误回滚 → mirror 纳入基线采样。
- **落地**（2026-10-25）：`parseWorkflowCommands` 的 ok 结果新增 `runFragments`（原始命令 + `recognized|unrecognized` + workflow，仅镜像计划时收集，单 workflow 超 2000 片段整体降级）；`planCiMirrorCommands` 只接受单一形态 `pnpm|npm|yarn [run|run-script] <script>` 且脚本存在于根 `package.json#scripts`，按 workflow 顺序去重、最多 3 条，`docker` / `gh` / 任意 shell / 带 flag / env 赋值 / corepack 钉定记 `unsupported-command`，脚本不存在记 `script-not-found`，超限记 `over-limit`；语义项仅在**与默认链同形**时记 `recognized`（带 flag 者归 `unrecognized`，避免既不执行也不披露）。`resolveVerifyCommands` 统一产出命令来源与 mirror 计划，基线采样与修复后验证同源（同超时 / 同取消面 / 同 `preExisting` 归因），自定义链整链替换不叠加。`DEPENDFIX_VERIFY_TIMEOUT_MS`（严格整数，10s–30min）为默认链与镜像共用单命令超时。报告逐条标注 `commandSource`，PR 正文/报告披露「已镜像执行 N 条 / 跳过 M 条」（0 条也展示）；`ciAlignment` 只记实际执行集，多次验证取并集。
- **审计**：R1 `standard` 两分区并发：A **Pass**（0B / 4W / 7S）、B **Reject**（1 blocker：带 flag 的语义项既不执行也不披露 + 2W / 7S）→ 实现侧将带 flag/env/corepack 的语义项归 `unrecognized`，并收口 W1-W4 / S1-S7 → R2 `quick`：A **Reject**（RG-W1 用例无法击杀 `mirrorKey` 守卫 → 删除不可达分支；RG-S1 `ci-alignment` 日志仍裸写多行解析原因 → 套用 `clipLogText` + 用例）、B **Pass**（0B/0W）→ 收口 → R3 `quick` 两分区 **Pass**（A 0B/0W/2S、B 0B/0W/3S，suggest 已应用：注释去符号名、跳过项并集语义、install 覆盖口径、env 示例等长）。实测用时：R1 发起 03:46:22Z → R2 发起 04:03:11Z（**16m49s，超 standard 10m 盒**，两分区并发含分区内取证）；R2 发起 → R3 发起 04:16:53Z（13m42s，含执行方修复与门禁复跑，非纯审计用时）；R3 发起 → 返回 ≈04:22Z（≈5m）。
- **证据**：`pnpm -r build` 全绿；`pnpm run typecheck` 7 包 Done；`pnpm lint` 0 error / 3 条存量 warning；`pnpm test` 320 passed | 2 skipped 文件 / 4882 passed / 10 skipped；定向 `verify-project*.test.ts` 40 passed、`ci-alignment.test.ts` 41 passed；文档九项 + `docs:build` 全 exit 0（check:docs links 166 / doc-size 健康 90 warning 0 / orphan 0 818 文件）；mutation 7/7（工件 `artifacts/review-gate/2026-10-25-m48-2-mutation.md`，还原后 md5 一致）；新增行编号标记 0 命中。
- **边界**：只执行根 `package.json#scripts` 中存在的单一形态脚本，不覆盖 workspace filter / 递归 / 额外参数 / env 前缀 / corepack 钉定（一律披露跳过）；install 类命令无论 flag 均视为默认链已覆盖（不镜像、不披露）；单 workflow 片段 >2000 / 文件数 >20 / >512KB 或非法 YAML → 整体不镜像且只记日志；每仓最多 3 条、默认关闭（平台不新增开关）；只校验命令形态与脚本存在性，不审计脚本体（脚本内命令与 `pre`/`post` 钩子照常执行）；`mirrorSkipped` 按并集披露，可能保留后续轮次已不再适用的原因（仅证据，不影响结论 / exit code）；存量 `SCRIPT_CATEGORY` / `BINARY_CATEGORY` 原型链查表问题未在本批修复（fail-safe，已记录残余）。

### M48.3 [P0 🛠️] 同告警尝试指纹去重与降级（**已闭环** `1ee3cef8` + `c600eb64` + `1daf5f43` + `21ae0127` + `fe23df0c` + `fdec7fb1`；文档随本批收口）

- **目标**：同一告警、同一目标版本、同一修复策略在连续两次关闭后不再原样重开；第 3 次尝试起跳过并留痕，用户可显式强制重试。
- **范围**：新增 `packages/engine/src/github/fix-fingerprint.ts`（尝试键 + 标记往返 + 可选失败签名归一化纯函数）、`github/attempt-history.ts`（最近关闭 PR 尝试索引 + 运行级缓存）、`app/repeated-failure.ts`（计划策略 + 上限跳过）；`github/pr-creator.ts` 写入 PR 正文标记；`app/repo-fix.ts` 在写盘前判定（拆分 `planRepoFixAlerts`，`app/index.ts` / `app/delivery.ts` 均不改跳过语义）；`packages/core/src/report/types.ts` 的 `SKIP_REASONS` 增加 `repeated-failure` + `RunResult.attemptTracking`；CLI / Action 开关 `--retry-failed`；报告 `alertsSkippedByReason` 与 `Repeated Failure Attempts` 段。**实际落点**：`app/index.ts`（marker 传参 / attemptRepo）、`app/helpers.ts`（ctx 契约）、`app/result-assembly.ts`（报告字段）、`app/duplicate-prs.ts`（max-lines 纯搬迁）替代原计划的 `app/delivery.ts` 记账。
- **验收标准**：
  1. 尝试键由 `source / packageName / targetVersion / planStrategy` 计算，创建前即可得到；同一输入稳定，策略或目标版本变化后不同。
  2. PR 正文标记可往返解析；`n` = 同 key 最近关闭 PR 数 + 1；标记被人工改写或解析失败按未命中处理（fail-open）。
  3. 同 key 第 1 / 2 次尝试允许执行；第 3 次起跳过，落 `FixAction.noOp` + `alertsSkippedByReason['repeated-failure']`，不创建 PR、不增 `alertsFailed`，且 `sum(alertsSkippedByReason) === alertsSkipped` 用例锁定。
  4. `--retry-failed` 显式忽略命中并强制再试，报告标注「人工强制」；目标版本变化后键自然失效。
  5. 最近关闭 PR 按仓库每轮缓存一次（不按告警重复 `pulls.list`）；上限 / 分页 / 缓存失败 fail-open 有用例。
  6. mutation 至少 2 处（尝试键归一化 / 命中分支）被击杀。
- **不做什么**：不新建平台持久表；不做聚合 issue；不改 open PR 去重语义；不自动关闭 PR；不做跨仓库签名聚合。
- **依赖**：既有 `FixAction.error` / `FixError.stage` 失败证据；`findDependfixOpenPR`；`packages/core` 跳过原因枚举；设计稿 §6。
- **交付物**：原估算 4 commits / 5-8 files / 300-500 行（`fix-fingerprint.ts` 新增、`pr-creator.ts`、`app/index.ts`、`app/delivery.ts`、core 报告类型、CLI / Action、测试）。**实际**：42 文件（8 新增 + 34 修改；含平台镜像 7 文件、文档与检查点矩阵 9 文件）/ `git diff --numstat` 实测 +1658 −96（口径：`git ls-files -o --exclude-standard | xargs wc -l` 取新增文件 1301 行 + 已跟踪 +357 行；复现时点 = 收口前工作区，`HEAD = 57a7ac76`）→ 按 §1.1 粒度拆为 **6 个 commit**：core 契约（4）/ engine 指纹与索引与配置（9）/ engine 编排接线 + CLI + Action（10）/ engine 判定模块与测试（3）/ 平台镜像（7）/ 文档 + 检查点矩阵（9），每 commit ≤10 文件且 ≤800 行。
- **风险与缓解**：关闭 PR 超过查询窗口漏命中 → fail-open + 文档边界；误跳过 → `--retry-failed` 逃生；人工关闭非失败 PR 被计数 → 文档声明 + 逃生开关。
- **审计**：R1 `standard` 两分区（engine 实现 / 契约·CLI·平台·文档）：A **Pass**（0B / 4W / 6S：零工作仓库仍跑 lockfile repair 破坏归因豁免前提 / `hasWork` 守卫无可击杀用例 / 平台不写标记的口径缺口 / 本批规模），B **Pass**（0B / 5W / 5S：`run-failure-taxonomy` 枚举漏 `repeated-failure` / 平台通用表述与实现不符 / 矩阵缓存项无规范依据 / `report-generator` 未登记新段 / todo 规模未回填）→ 全部收口（repair 门禁收窄 + `hasWork`/repair 双断言、marker 增加执行集过滤、`n` 只接受 1-9999、平台边界入 §6.4 + backlog 候选、规范 ④ 缓存条款、报告文档与 todo 数字回填）→ R2 `quick` **Pass**（0B / 2W / 2S：§6.4 repair 表述与收窄后实现冲突 / todo 规模快照过期且拆批越线 → 均已订正；2 条 suggest 随手处理）。实测用时：R1 发起 05:16:51Z（两分区**串行**：首次并发触发上游限流后改为逐个发起），到 R2 发起 06:13:55Z 共 **57m04s**（含两分区审计 + 执行方收口修复 + 全量门禁复跑，无法拆出单分区纯审计用时——单分区返回时刻未逐次打点，**第 5 次复现**该打点缺陷）；R2 发起 → 返回 ≈06:20:11Z（**≈6m16s**，quick 盒内）。
- **证据**：`pnpm -r build` 全绿；`pnpm run typecheck` 7 包 Done；`pnpm lint` 0 error / 3 条存量 warning；`pnpm test` 324 passed | 2 skipped 文件 / 4931 passed / 10 skipped；定向 `fix-fingerprint` / `attempt-history` / `repeated-failure` / `fix-and-pr-repeated-failure` / `pr-creator` / `repo-fix-finalize` 全绿；文档九项 + `docs:build` 全 exit 0（check:docs links 166 / doc-size 健康 90 warning 0 / orphan 0 827 文件）；mutation **9/9** 击杀（工件 `artifacts/review-gate/2026-10-25-m48-3-mutation.md`，还原后 7 个被改文件 md5 一致）；新增/修改源文件编号标记 0 命中。
- **边界**：只覆盖 `fix-and-pr`（`fix` / `report-only` 无 PR 载体，恒不判定）；只覆盖依赖告警（Code Scanning / Code Quality 无「包 + 目标版本」语义）；只计**未合并**的关闭 PR 与最近 50 条（更早关闭 / 查询失败 = 少计，fail-open）；`planStrategy` 是计划标签，执行路径细调（如 direct → override 回退）不改变键；跳过只覆盖升级链路，全部命中时连 lockfile repair 一并跳过（保持 pristine）、终验仍执行；多仓仅 PR 落点仓库计数；平台交付链不写标记（独立候选）；`--retry-failed` 在非 `fix-and-pr` 模式下静默无效；`en-US` 配置指南的 `retryFailed` 行未同步（与 16 行存量漂移同批处理，未在本批扩面）。
- **落地**（2026-10-25）：尝试键 = `sha256(source / packageName / targetVersion / planStrategy)` 前 16 位，`planStrategy` 是**计划**标签（`direct-upgrade` / `override` / `member-upgrade` / `family-lockstep`，由 `dependencyType` + manifest 归属 + 家族清单解析；执行结果策略不参与，两类标签不混用），因此在**创建 PR 前**即可算出。载体 = PR 正文 HTML 注释 `<!-- dependfix:attempt key=… n=… fp=? failed=? -->`，写在正文**头部**（尾部截断不丢标记），一个 PR 可携带多条，同键去重取最大 `n`，且只写**真正执行过**（存在非 noOp 升级动作）的键。读取 = 每仓库每轮一次 `pulls.list(state:'closed', sort:updated, per_page:50)`（运行级 Promise 缓存，失败也缓存并 fail-open 到 0），**只计未合并**的关闭 PR（合并即修复落地，不消耗尝试额度）。判定时点 = 告警分区之后、**修复前基线采样与任何写盘之前**（`app/repo-fix.ts` 拆出只读段 `planRepoFixAlerts`），命中即跳过升级链路，不白跑安装与验证；全部命中时 `hasWork = 剩余告警数 > 0` 为假，与零告警仓库同语义（不采样基线、不跑 lockfile repair，保持工作区 pristine 以维持 `noChanges` 归因豁免）。跳过落 `FixAction{noOp:true, strategy:'repeated-failure'}` + `addSkipped(...,'repeated-failure')`（`SKIP_REASONS` 新增 key，分组之和 === 总数由用例锁定），不增 `alertsFailed`、不建 PR。报告新增 `RunResult.attemptTracking`（逐告警 `key / attempt / status=attempt|forced|skipped`）与 `Repeated Failure Attempts` 段；`--retry-failed` / Action `retry-failed` / env `DEPENDFIX_RETRY_FAILED` 忽略命中并标注 `forced (manual retry)`。多仓运行只有 PR 落点仓库（第一个仓库）参与计数（`attemptRepo`），其余仓库不判定；平台交付链不写标记（边界见设计稿 §6.4，另立 backlog 候选）。

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
