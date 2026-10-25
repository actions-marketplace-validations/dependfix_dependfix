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

### M48.4 [P1 🛠️] 提交面白名单与 `pnpm-workspace.yaml` 定点编辑（**已闭环** `61788594` + `71ccef1f` + `fdc1e8a2` + `97683ebb` + `bfb43212`；文档随本批收口）

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
- **交付物**：原估算 4-5 commits / 6-10 files / 400-700 行。**实际**：32 文件（27 修改 + 5 新增）/ `git diff --numstat` 实测 +425 −204，另新增文件 1380 行（合计约 1805 新增行）→ 按 §1.1 拆为 **6 个 commit**：YAML 定点编辑（5）/ 提交集合判定模块 + core 契约（4）/ `stageAndCommit` 收口 + 夹具（7）/ 编排接线与 app 级用例（4）/ 平台分类（4）/ 文档（9），每 commit ≤10 文件且 ≤800 新增行。
- **风险与缓解**：AI fixer 漏声明路径 → 未声明检测失败并打印路径；YAML 注释保留不完整 → 黄金夹具锁定三种风格；pathspec magic 绕过 → 前缀校验。
- **落地**（2026-10-25）：
  - **提交面（b 批）**：新增 `packages/engine/src/github/commit-scope.ts`。`normalizeCommitPath` 归一 `\` → `/`、去 `./`，拒绝绝对路径（含盘符）/`..`/`:(` 开头/控制字符/空路径；`isCommitWhitelisted` 允许任意层级 `package.json` 与仓库根 `pnpm-lock.yaml`/`pnpm-workspace.yaml`/`.npmrc`/`.gitignore`；`isGeneratedPath` 覆盖 `.nuxtrc`/`auto-imports.d.ts`/`components.d.ts`/`.nuxt`/`dist`/`node_modules`/`.pnpm-store`/`dependfix-reports`（任意层级目录名）；`listChangedPaths` 用 `git status --porcelain=v1 -z --untracked-files=all --no-renames`（全仓，不限 pathspec——`git commit` 提交整个索引）并按 `git rev-parse --show-prefix` 折算 workDir 相对路径，workDir 之外的改动标 `outside`（已暂存即拒绝）；`collectDeclaredPaths` 只取**成功且非 noOp** 动作的 `FixAction.changedPaths` 与 `code-scanning-fix.filePath`；`computeCommitScope` 产出 `paths / unexpected / ignored / rejected / missing / staged / conflicts`；`stageScopedChanges` 以 `git add -- :(literal)<path>`（每批 100，文件名含 `*`/`?`/`[` 也只暂存字面路径）暂存，并依次拒绝**未合并冲突**、**索引区越界暂存内容**（`git commit` 会连带提交索引，不擅自 `git reset` 用户暂存区）、workDir 子目录场景下**仓库根范围的已暂存改动**；`missing`（声明了但工作区无改动，如被 `.gitignore` 忽略）在两处调用点均告警留痕；`commitStaged` 保留 author / 签名 / hooks 三条隔离。`pr-creator.ts#stageAndCommit` 收窄为「ensureGitConfig → 判定暂存 → 提交」并返回 `{ staged, ignored, missing }`；`app/index.ts` 的 PR 路径单独捕获 `CommitScopeError` 写 `UNEXPECTED_CHANGES` / `NO_CHANGES`（不折叠成 `PR_CREATION_FAILED`），`--commit` 路径同类映射（其余仍 `COMMIT_FAILED`）；AI patch（`ai/app-integration.ts`）用 `appliedFiles` 声明 `changedPaths`。平台 `run-failure-classify` 新增两项 `deliver` + `deterministic` 映射，`scan-run-state` 交付失败白名单与对应用例同步。
  - **YAML 定点编辑（a 批）**：新增 `packages/engine/src/fixers/dependency/workspace-yaml.ts`：`parseDocument(uniqueKeys)` 拒绝重复键 / 别名 / 顶层非映射 / 非法语法，`setIn` 只改目标键（注释、引号风格、键序保留，写回单个尾随换行）；`readOverridesSection` 对 `overrides` 非映射返回 `null`（不覆盖）；`applyWorkspaceOverrides` / `rollbackWorkspaceOverrides` 为批量入口，`writeWorkspaceOverride` 委托定点实现并回传**实际写入 key**（归一化命中既有写法时与入参不同，回滚按实际 key）。`overrides:` 空值先物化为映射（保留键位置 / 注释）；键值非标量（含 null）一律拒绝定点编辑（旧值无法安全回写）；写回沿用原文件 CRLF / LF。AST 变更全程 try/catch → 单包与批量写盘失败均记 `precheck` 失败（`pnpm-workspace.yaml kept unchanged: …`）且不执行 install、不留 `.bak`，不再把文件覆盖成只剩 `overrides`。回滚**以备份还原为权威**（字节级），定点删除 / 恢复旧值仅在备份缺失 / 复制失败时兜底。
  - **文档**：设计稿 §7 按实现改写（白名单 / 生成物 / 校验 / 索引区 / 错误类别 / 平台映射 / YAML 口径）；新增开发规范 §5.1.54 与检查点矩阵新行；失败分类文档补两项 `deliver` + `deterministic`；报告契约文档补 `FixAction.changedPaths`。
- **审计**：R1 `standard` 两分区（分区 A engine / 分区 B core·platform·docs）：分区 A **Reject**（1B / 5W / 6S：`overrides:` 空值时 `setIn` 抛错并中止整仓且 `.bak` 残留（blocker）/ `missing` 无消费点 / workDir 子目录漏掉仓库根已暂存改动 / 回滚顺序把备份还原排在可抛路径之后 / 归一化后的实际 key 未用于回滚 / 新增 app 层拒绝路径无用例）→ 全部收口（空值物化 + 全段 try/catch + 非标量拒写、`missing` 双点告警、全仓 `git status` + `outside` 标记、备份还原为权威 + 定点兜底、回传实际 key、冲突态与跨 workDir 暂存拒绝、CRLF 保留、app 级 NO_CHANGES/UNEXPECTED_CHANGES 用例）→ R2 `quick` **Pass**（0B / 2W / 2S：todo 落地口径漂移 + app 层用例缺失 → 均已订正，其余 suggest 随手处理 1 条 / 记录 2 条边界）。实测用时：R1 发起 `07:43:44Z` → 分区 A 返回 < `08:07:36Z`（单分区串行发起；返回时刻未逐次打点，**第 6 次复现**该打点缺陷）；R2 发起 `08:07:36Z` → 返回 `08:17:24Z`（**≈9m48s**，超 quick 5 分钟盒，记录为分级校准数据）。
- **证据**：`pnpm -r build` 全绿；`pnpm run typecheck` 7 包 Done；`pnpm lint` 0 error / 3 条存量 warning；`pnpm test` 327 passed | 2 skipped 文件 / 4980 passed / 10 skipped；定向 `commit-scope` / `workspace-yaml` / `pr-creator` / `helpers` / dependency / `fix-and-pr-commit-scope` 全绿；文档九项 + `docs:build` 全 exit 0（check:docs links 166 / doc-size 健康 90 warning 0 / orphan 0 832 文件）；mutation **11/11** 击杀（工件 `artifacts/review-gate/2026-10-25-m48-4-mutation.md`，还原后 8 个被改文件 md5 一致）；新增/修改源文件编号标记 0 命中。
- **边界**：依赖类 fixer 的写盘（manifest / lockfile / workspace / `.npmrc`）靠白名单覆盖，不逐路径声明；源码类写盘必须显式声明，漏声明即 `UNEXPECTED_CHANGES`。目标仓库运行前已有未提交改动时：白名单内文件（典型 `package.json`）无法与我们同文件的改动区分，会一并提交；白名单外一律拒绝。索引区已有暂存内容不在提交集合内时拒绝（用户需自行 `git restore --staged`），不擅自清理。生成物按任意层级目录 / 文件名匹配（名为 `dist` 的源码目录也会被排除，属安全方向）。YAML 定点编辑对含别名文档整体跳过（回滚依赖备份），解析失败不降级为整文件重写。

### M48.5 [P1 🛠️] PR 创建后 CI 回环（CLI / Action 侧）（**已闭环** `cce39c09` + `3ef294ee` + `1b37a35e` + `acc78875` + `ff8fa60a`；文档随本批收口）

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
- **交付物**：原估算 5 commits / 6-9 files / 400-650 行。**实际**：30 文件（23 修改 + 7 新增）/ `git diff --numstat` 实测 +315 −9（跟踪）+ 2215 行（7 个新文件），合计约 2530 新增行 → 按 §1.1 拆为 **6 个 commit**：core 归因分类器（3 文件 / 294 行）/ 配置键 + 校验 + CLI + Action（7 / 178）/ 等待状态机模块（3 / 693）/ 等待状态机测试（1 / 620）/ 编排接线 + 报告契约 + app 级用例（9 / 715）/ 文档（7 / ≈32），每 commit ≤10 文件且 ≤800 新增行（源码与测试因阈值分家属，commit message 明示）。
- **风险与缓解**：等待吃满 job 预算 → 默认关闭 + 双预算；API 配额 → 运行级缓存 + 退避；误关 PR → 仅 `self_caused` + 显式开关 + dry-run 守卫。
- **落地**（2026-10-25）：
  - **前置分类器（M48.6 最小切片，先落地）**：新增 `packages/core/src/report/check-attribution.ts`——`CheckAttribution` / `CheckConclusion` 类型、`classifyCheckFailure` 规则纯函数、`aggregateCheckAttribution`（一致归因才保留，混合 → `unknown`）。规则顺序：`cancelled` / `skipped` / `stale` → `cancelled`；Dependabot / updater 文本签名 → `external_noise`；镜像 / registry `unknown manifest class` / `manifest unknown` → `external_noise`；父提交同 job 红 → `pre_existing`；失败且父提交同 job 绿 → `self_caused`；其余 → `unknown`。父提交比对不按作业名白名单限制（红 / 绿两侧对称），未知一律 `unknown`。
  - **等待状态机**：新增 `packages/engine/src/github/pr-check-watch.ts`。数据源 `checks.listForRef` + 分页 `listCommitStatusesForRef`（单源失败不阻断另一源；采集失败与「零观测」严格区分）。终态：全部完成且至少观测到一条 check → 有失败 `failed`（逐条归因后聚合）/ 有成功 `passed` / 仅 cancelled·skipped·neutral `cancelled`；宽限期 60s 且至少两轮轮询后才允许 `no_ci_detected`（绝不判 `passed`）；预算耗尽 `timeout`（报告记录绑定来源 `pr` / `run` / `job`）。**失败判定 fail-closed**：`unknown` 结论（GitHub 新增 / 未识别）与 `startup_failure`（workflow 无法启动）都按「失败但未判定」处理，绝不当作成功或取消。间隔 15s 指数退避到 60s + 轮询次数上限（防注入时钟不前进空转）；有效等待 = min(per-PR 上限, per-run 预算, 剩余 job 预算 × 70%)——job 预算基线缺省只在 `GITHUB_ACTIONS=true` 时按 25 分钟套用（`DEPENDFIX_JOB_BUDGET_MS` 可显式覆盖，本地 / 平台执行不臆造），`startedAt` 不含 Actions setup。父提交解析：head first parent → 失败回退 PR base → 再失败归因 `unknown` 并 warn 留痕。失败 check 的名称与 URL 均按不可信文本清洗（控制字符 / 换行 / 括号编码 / 仅 http(s)）。
  - **处置**：`failed` / `timeout` 默认评论（失败 job 名 + 详情 URL + 归因 + 尝试标记 + `<!-- dependfix:pr-check -->`）；`--close-failed-pr` 仅在**聚合归因 `self_caused`** 时关闭 PR 并删分支（关闭失败/删分支失败分别记 `closeError`，不改变终态）；`cancelled` / `no_ci_detected` 不评论；dry-run 不评论 / 不关闭 / 不删分支；评论 403 记 `commentError`。所有 API / 处置失败只降级记录，不改变修复结果与 exit code。
  - **配置与接线**：`waitPrChecks` / `closeFailedPr` / `prCheckTimeoutMs` / `prCheckRunBudgetMs`（env `DEPENDFIX_*`；CLI `--wait-pr-checks` / `--close-failed-pr`；Action `wait-pr-checks` / `close-failed-pr`）。配置校验：`waitPrChecks` 仅 `fix-and-pr`；`closeFailedPr` 必须同时开启等待；预算 60000-1800000 越界 fail-fast。`app/pr-check-watch-run.ts` 汇总预算并写入 `RunResult.prCheckWatch` / summary 计数器（`prsOpened` 在 PR 创建成功后 +1、`prsSkippedByFingerprint` 在去重命中时 +1、`prsClosedAfterFailure` 在关闭成功时 +1、`checksTimedOut` 在任意 `timeout` 时 +1；`computeSummary` 多次调用不清零），等待链自身异常也留一条 `timeout` 记录（不抛）；`createPullRequest` 回传 `headSha` 供精确轮询。
- **边界**：只等本次运行创建的 PR（去重命中同内容 PR 时不等待，只计数 `prsSkippedByFingerprint`）；不跨进程续等、不写平台库、不做 webhook、不自动合并；轮询以 PR head SHA（缺省分支名）为 ref，后续 force-push 的提交也会计入；父提交比对取 head 的 first parent（失败回退 PR base，再失败 → `unknown`）；采集 API 失败期间不推进 `no_ci_detected`；`self_caused` 依赖父提交同 job 为绿，目标仓库对同 job 做路径过滤 / 新 job 首次运行 → `unknown`（只评论不关闭）；混合归因一律 `unknown`；平台侧 PR Check 回环与本能力不复用（后续候选）。
- **审计**：R1 `standard` **Reject**（1B：`startup_failure` / 未识别结论被判「非失败」→ 可能 `passed` / `cancelled`，红 PR 静默；6W / 6S：预算来源未回传、job 基线无条件套用、URL 未清洗、父提交未回退 base、破坏性出口缺用例、拆批越线）→ 全量收口（fail-closed 失败判定 + `self_caused` 仅限硬失败、`budgetLimit`、`jobBudgetMs`、`sanitizeCheckUrl`、父提交两段回退、六类出口用例、mutation 补 M9/M10）→ R2 `quick` **Reject**（1B：用例未隔离 `GITHUB_ACTIONS`，CI 必红；W：per-run 预算未跨 PR 累计、poll 上限误标预算来源、catch 未计 `checksTimedOut`、422 一律静默）→ 收口（跨 PR 累计 + 耗尽短路、独立轮询上限标签、catch 计数、422 区分引用不存在 / 受保护）→ R3 `quick` **Pass**（0B；1W：交付物数字与实测不符 → 已回填；3S：404 用例 / catch 计入说明 / 枚举 JSDoc → 已订正）。实测用时：R1 发起 `09:10Z` → R2 发起约 `09:39Z` → R3 发起约 `10:06Z`、返回约 `10:14Z`；三轮（含收口修复与门禁复跑）自 `09:10Z` 至 `10:16Z` 共约 **66 分钟**，单轮返回时刻未逐次打点（**第 7 次复现**该缺陷，仅以周边命令时间戳回溯）。
- **证据**：`pnpm -r build` 全绿；`pnpm run typecheck` 7 包 Done；`pnpm lint` 0 error / 3 条存量 warning；`pnpm test` 331 passed | 2 skipped 文件 / 5046 passed / 10 skipped；`GITHUB_ACTIONS=true` 下 `pr-check-watch-run.test.ts` 8 passed（CI 环境等价）；文档九项 + `docs:build` 全 exit 0（check:docs links 166 / doc-size 健康 90 warning 0 / orphan 0 839 文件）；mutation **10/10** 击杀（工件 `artifacts/review-gate/2026-10-25-m48-5-mutation.md`，还原后 6 个被改文件 md5 一致）；新增/修改源文件编号标记 0 命中。

### M48.6 [P1 🚀] 外部作业归因与合并门禁（**已闭环** `9ebadc18` + `9523ae6e` + `330efff8` + `f1dc9133`；文档随本批收口）

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
- **落地**（2026-10-25）：
  - **归因分类器（前置切片，`cce39c09`）**：`packages/core/src/report/check-attribution.ts`——`CheckAttribution` / `CheckConclusion`（含 `startup_failure`）/ `classifyCheckFailure` / `aggregateCheckAttribution`，规则顺序见设计稿 §9.1；`self_caused` 按用户决策补齐为「**硬失败**且父提交同 job 绿」（红 → `pre_existing`，超时 / 待授权 / 启动失败 → `unknown`）；`unknown` / `startup_failure` 计入失败集合（fail-closed）。
  - **报告渲染**：`groupCheckAttributions` 按固定枚举顺序分组（空组省略）；Markdown 新增 `## Check Attribution`——归因计数 + 逐 PR 状态 / 聚合归因 / 失败 job 名 + 单项归因；仅存在失败项或非通过终态时渲染（全绿不出空表）；作业名经 `escapeCodeName`（转义 `|` / 换行 + 剥离反引号）；显式声明「归因只解释、不豁免 mergify 的 `check-success` 门禁」。
  - **平台视图**：`UnifiedBuildSignal.attribution` 由同一 `classifyCheckFailure` 计算（`parentConclusion` 恒缺省 → 平台只可能 `external_noise` / `cancelled` / `unknown`）；归因证据取 `output.title + output.summary`（`output.text` 仍作展示摘要，与 CLI 同口径）；**只对失败 / 取消结论产出归因**（成功 / 中性 / 未完成为 `undefined`）；三源未识别原始状态 fail-closed 为 `failure`，`startup_failure` 显式映射 `failure`，`completed + null` 维持 `skipped`；UI 标签仅失败 / 取消类信号展示，色调与文案键抽到 `pr-check-style` 纯函数（键存在性对照两份 locale 单测）。
  - **合并门禁**：`.github/mergify.yml` 两条规则补齐 `check-success=Test / Coverage / E2E / Visual Regression`；新增 `scripts/check-mergify-conditions.mjs`（`check:mergify`）——扫全部 `pull_request` workflow 的 PR job 并集与规则条件比对，缺失 / 多余 / author 规则缺失 / 声明陈旧 / matrix 表达式 job 名一律阻断；支持 `DECLARED_EXTRA_CHECKS` / `DECLARED_EXEMPT_JOBS` 声明表与 `check-success = <name>` 空格形态，`check-success~=` 等变体显式报不支持；CI Test job 在 `check:verify-chain` 之后阻断；root devDependency `yaml` 供解析（lockfile 仅新增该 importer 条目）。
  - **文档**：设计稿 §3.9（同源口径 / 可达集合 / 三源 fail-closed / `completed+null` 已知差异）、`auto-merge.md`（四条模板 + `skipped` 不等于 `success` + 机检入口 + 放宽示例警示）、`architecture-platform.md` 与 en-US 镜像同步「同批全部 PR job」。
- **边界**：平台不采集父提交 check → `self_caused` / `pre_existing` 只出现在 CLI 回环报告；平台归因不参与 `overallStatus` / 告警状态机 / mergify 判定；`completed + conclusion=null` 平台按 `skipped`、CLI 按失败（已裁定差异，平台侧不产出标签、CLI 侧仍标 `unknown`）；`DECLARED_EXTRA_CHECKS` / `DECLARED_EXEMPT_JOBS` 当前为空（本仓无外部 check / 豁免 job）；`pull_request_target` 不计入 PR job（基上下文运行，check 不落 PR head）；UI 标签的浏览器渲染路径由纯函数单测 + e2e fixture 字段保障，视觉基线未新增带标签用例（登记为后续候选）。
- **审计**：分区 A `standard` R1 **Pass**（0B / 4W / 5S：通过信号也产出归因、归因证据字段与 CLI 不一致、反引号未处理、UI 面缺验证通道）→ 全量收口 → R2 `quick` **Pass**（9 项全 closed；2W：UI 渲染证据缺失 → 抽 `shouldShowAttribution` 纯函数 + 用例；注释错位 → 已移正）；分区 B `standard` R1 **Reject**（1B：`pnpm-lock.yaml` 夹带 `chart.js` 无关升级；7W / 7S：注释自相矛盾、跨文件口径漂移、只扫 `test.yml`、空格条件、`conditions: true`、无声明表）→ 全量收口（lockfile 还原为仅 `yaml` importer、脚本改多 workflow 扫描 + 声明表 + 空格 / 简写形态、`pull_request_target` 边界、三处文案统一）→ R2 `quick` **Pass**（13 closed / 1 可接受 / 2 partial 已补用例）。实测用时：A-R1 发起 `10:56Z` → A-R2 返回约 `11:41Z`；B-R1 发起约 `11:12Z` → B-R2 返回约 `11:38Z`；分区串行执行，合计约 **45 分钟**（单轮返回时刻仍未逐次打点，**第 8 次复现**）。
- **证据**：`pnpm -r build` 全绿；`pnpm run typecheck` 7 包 Done；`pnpm lint` 0 error / 3 条存量 warning；`pnpm test` 332 passed | 2 skipped 文件 / 5090 passed / 10 skipped；`check:mergify` OK（2 条规则覆盖 4 个 PR job，25 例脚本单测）；`pnpm install --frozen-lockfile` exit 0；文档九项 + `docs:build` 全 exit 0（check:docs links 166 / doc-size 健康 90 warning 0 / orphan 0）；mutation **6/6** 击杀（工件 `artifacts/review-gate/2026-10-25-m48-6-mutation.md`，还原后 6 个被改文件 md5 一致）；新增/修改源文件编号标记 0 命中。
- **交付物**：原估算 5 commits / 6-10 files / 350-600 行。**实际**：26 文件（24 修改 + 2 新增）/ 5 commits（core 报告 4 文件 172 行 / 平台信号 3 文件 298 行 / 平台视图 6 文件 127 行 / 门禁与 CI 7 文件 737 行 / 文档 6 文件 60 行），合计 **1394 新增行**（两个门禁脚本 704 行 + 相关测试约 640 行占主体）。

**类型平衡复核**：🛠️ 5（M48.1 / M48.2 / M48.3 / M48.4 / M48.5）+ 🚀 1（M48.6）。🎨 / 🧪 独立条目缺口显式标注：本阶段由 P0/P1 外部交付证据驱动，UX / 测试能力分别由 E 阶段与各条目内嵌用例承担；不新增第 7 原子以避免越过 5-6 项上限。

**建议顺序**：M48.4 → M48.1 → M48.2 → M48.3 → M48.6 → M48.5。M48.4 最小且独立，先降后续 PR 的 diff 噪声；M48.1 断根因（家族混装）；M48.2 让验证结果可信；M48.3 收敛重复失败；M48.6 的分类纯函数先落地（无副作用、可独立验证），M48.5 的回环再消费它，避免循环依赖。

**条目容量**：6 原子符合 [规划规范 §1.1](../standards/planning.md#11-硬性约束) 的 5-6 项上限。M48.4 单体最大（6-10 文件 / 400-700 行），在上界附近；实际 > 10 文件即按 a/b 拆分。

**范围边界（不做什么）**：不做通用依赖图 / 自动家族推导；不执行 `docker build` / 任意 shell；不建平台尝试指纹表；不做聚合 issue；不新增合并后 check 采集；不自动在目标仓启用 mergify；归因不绕过 mergify 门禁；平台侧建 PR 后回环不在本阶段；不改 exit code 语义与 `PRE_EXISTING_FAILURE` 口径。

**§3.4 交叉核验**：6 项经 todo-archive 表格扫描（关键词 `锁步` / `peer` / `check-runs` / `git add .` / `失败指纹` / `external_noise` / `unrecognized` / `自动合并` / `mergify` 仅命中 M21.4 mergify 模板 + auto-merge 指南、M21 RG-W01 `git add .` 的 shell 注入修复、M24.1 PR Check open-only MVP——均为前置能力，非本阶段范围）+ `git log --all --grep=锁步`（命中 `8627edcb` 的 dependency-grouping 设计稿，已作为 M48.1 前置遗留项登记）+ `git log --oneline -- <路径>`（`ci-alignment.ts` 仅 `8888999e`；`pr-creator.ts` 最近 `612a457b` / `37c93068` / `8a6c84ef` / `cb5c1468`；`fixers/dependency/index.ts` 最近 `0d1dd455` / `873735d6` / `9f747fea`——均未覆盖本阶段范围（仅列最近条目，非穷举））+ 代码 anchor（`pr-creator.ts:230` 仍 `git add .`；`ci-alignment.ts:159/214` 仅记展示态 `unrecognized`；`findDependfixOpenPR` 仅 `state:'open'`；`fixers/dependency/index.ts:481/526` 仍 `YAML.stringify`；engine / cli 无 `check-runs` 调用；`external_noise` / `checkAttribution` 0 命中；`mergify.yml` dependfix 规则仅 `check-success=Test`），**0 项重复评估**。

**审计 depth 预告**：M48.1 / M48.3 / M48.4 / M48.5 → `standard`（M48.3 / M48.5 跨 engine + cli + action，建议 2 分区并发）；M48.2 → `standard`（engine + cli，2 分区）；M48.6 → `deep`（core + platform + CI 模板，含治理定义与外部调用）。

**后续阶段（已授权，待规划）**：**E：通知可信度收口**（4 项：`critical` 必选不可关闭 / 通知严重级别术语与阈值命名 / 周报投递重试与窗口锁 / `/settings` 与通知页 dark 视觉）。用户 2026-10-24 决策 D+E；E 待 M48 归档后按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 启动 P 阶段，不占 M48 条目容量与编号；启动时按 §1.1 评估是否补足至 5 项。
