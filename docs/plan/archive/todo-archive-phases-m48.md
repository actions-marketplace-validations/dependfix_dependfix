# 待办归档分片：M48 对外 PR 交付闭环

> 本分片由 2026-10-26 文档治理批次从 [todo-archive.md](../todo-archive.md) 迁出；正文逐字保留；相对链接按新位置重指。

---

## M48: 对外 PR 交付闭环（2026-10-24 用户决策 D+E / 2026-10-25 归档）

> **归档摘要**：6 原子条目；首父链 **41 commits**（M48.1 12 / M48.2 5 / M48.3 7 / M48.4 6 / M48.5 6 / M48.6 5，均含各原子闭环登记；`git log --first-parent --oneline 251c392c^..3bdd77fd` 去重统计）。类型平衡 🛠️ 5 + 🚀 1（🎨 / 🧪 独立条目缺口显式标注：UX 由已授权 E 阶段承担、测试随各条目内嵌）。阶段基线 **35-55 文件 / 2200-3700 行**；实际六条目按各原子收口记录累加 **204 文件 / +12,724 −931**，全阶段唯一 diff 实测 **127 文件 / +12,718 −925**——相当于基线文件约 2-4 倍、行约 3-6 倍，作为后续阶段容量校准数据记录。设计依据统一为 [pr-delivery-closure.md](../../design/governance/pr-delivery-closure.md)（六原子落在同一稿，未另立专项稿）。

> **证据来源**：各条目测试 / 审计数字取自 `.session/runtime-state.json` §`m48_plan` / `m48_2`-`m48_6`（M48.1 见 `.session/current-task.yaml` 完成摘要；本地会话记录，gitignored）与 `artifacts/review-gate/` 的 mutation / 审计工件（gitignored）；复核以对应 commit 与测试命令为准。归档时 `origin/master = 7b58c81b`（M48.5 收口点），M48.6 的 5 个 commit 与本归档批次尚未推送——ahead 按 `git rev-list --count HEAD ^origin/master` 动态核验，不写固定值。

### M48.1 [P0 🛠️] 兄弟包 / peer 家族锁步升级（**已闭环** `251c392c` + `c15bf8a8` + `5fb836bc` + `4a358bde` + `88c52744` + `8ff42a74` + `5033125f` + `ca4a95aa` + `f94981f0` + `48ff3d96` + `e3600c94` + `e60554eb`）

- **目标**：同一次修复内同生态成员保持同一版本线（vitest / typescript-eslint / jest / react），禁止跨大版本混装进入 PR。
- **落地**：`families.ts`（四家族清单 + `resolveFamily` / `planFamilyUpgrade` 两阶段纯函数）+ `family-versions.ts`（packument 解析 / peer 元数据 / URL 归一化与缓存）+ `manifest-upgrades.ts`（校验 → 备份 → 一次写盘 → 一次 install → 整体回滚，单包与家族共用）；接入常规分组（含拆组逐包）/ workspace 成员 / 跨线三条路径；`FixAction.family` + `collectFamilySummaries` + 报告 Family 段 + PR 正文 Family 列；`FAMILY_LOCKSTEP_FAILED` 登记平台 fix + deterministic。
- **审计**：quick Reject（跨 manifest 摘要交叠）→ standard Pass ×2（URL 归一化 / 不跟随重定向 / 错误只暴露 host / 同版本冲突整族放弃 / 原型污染防护 / peer fail-open 留痕）→ standard Reject（提交粒度）→ 拆三段并补环境性与分组成员回滚用例 → quick Reject（文档出口码 / 范围外测试）→ R2 Pass；mutation 4/4。
- **证据**：engine 83 文件 / 1508 passed；全仓 317 文件 / 4849 passed；lint 0 error（3 存量）；typecheck 7 包；build 全绿；文档九项 + `docs:build`；编号 0。
- **边界**：只覆盖同一 manifest 内的直接依赖（跨 manifest 家族不合并）；`eslint` 只做 peer range 校验；peer 不可解析 fail-open；同版本家族成员高于目标 → 整族放弃（不降级）；`peerCheckSkipped` 仅日志。

### M48.2 [P0 🛠️] CI 独有脚本纳入验证链（`--mirror-ci-scripts`）（**已闭环** `f28e4806` + `979a9775` + `c527f56d` + `c3750848` + `57a7ac76`）

- **目标**：开启后目标仓库 CI 独有的 `pnpm/npm/yarn run <script>` 进入验证链，使「本地绿」与「CI 绿」的差异可见、可执行、可归因。
- **落地**：`parseWorkflowCommands` 新增 `runFragments`（仅镜像计划时收集，单 workflow 超 2000 片段整体降级）；`planCiMirrorCommands` 只接受单一形态脚本且须存在于根 `package.json#scripts`，去重后最多 3 条，`docker` / `gh` / 任意 shell / 带 flag / env 赋值 / corepack 钉定记 `unsupported-command`，脚本缺失 / 超限分别记 `script-not-found` / `over-limit`；在默认链之后执行、与修复前基线采样同源（同超时 / 同取消面 / 同 `preExisting` 归因）；`DEPENDFIX_VERIFY_TIMEOUT_MS` 为默认链与镜像共用；报告 `mirrored` / `mirrorSkipped` + `FixAction.commandSource` + PR 正文「CI 口径」区块；CLI / Action 开关。
- **审计**：R1 A Pass / B Reject（带 flag 语义项既不执行也不披露）→ 归 `unrecognized` 并收口 → R2 A Reject（不可测守卫 / 裸写多行日志）/ B Pass → 删除不可达分支 + `clipLogText` + 用例 → R3 两分区 Pass；mutation 7/7。
- **证据**：全仓 320 文件 / 4882 passed；定向 40 + 41 passed；lint 0 error；typecheck 7 包；文档九项；编号 0。
- **边界**：只跑根 scripts 的单一形态（不覆盖 workspace filter / 递归 / 额外参数 / env 前缀 / corepack 钉定，一律披露跳过）；install 类命令视为默认链已覆盖；单 workflow 片段 / 文件数 / 体积超限或非法 YAML → 整体不镜像只记日志；每仓最多 3 条、默认关闭；只校验命令形态与脚本存在性，不审计脚本体。

### M48.3 [P0 🛠️] 同告警尝试指纹去重与降级（**已闭环** `1ee3cef8` + `c600eb64` + `1daf5f43` + `21ae0127` + `fe23df0c` + `fdec7fb1` + `ae337b2a`）

- **目标**：同一告警连续两次关闭后第 3 次起跳过，避免「原样重开」消耗 PR 配额与人工注意力。
- **落地**：尝试键 = `sha256(source / packageName / targetVersion / planStrategy)` 前 16 位，`planStrategy` 是**计划**标签（执行结果策略不参与），创建 PR 前即可算出；载体 = PR 正文头部 HTML 注释（一个 PR 多条、同键取最大 `n`、尾置截断即丢），只写**真正执行过**的键；读取 = 每仓每轮一次最近 50 条已关闭 PR（运行级缓存、只计未合并、失败 fail-open）；判定时点前移到分区后、基线采样与写盘前，全部命中与零告警仓库同语义（不采样基线、不跑 lockfile repair），跳过落 noOp + `repeated-failure` 分组；`--retry-failed` 强制重试并标注 forced；报告 `attemptTracking` + 段；平台展示镜像 4 站点。
- **审计**：R1 standard 两分区 Pass（A 4W/6S、B 5W/5S）→ 全量收口（repair 门禁收窄 + `hasWork`/repair 双断言、marker 执行集过滤、`n` 限 1-9999、平台边界入 §6.4、规范 ④ 缓存条款、报告文档、todo 数字回填）→ R2 quick Pass；mutation 9/9。
- **证据**：全仓 324 文件 / 4931 passed；定向 6 组全绿；lint 0 error；typecheck 7 包；文档九项；编号 0。
- **边界**：只覆盖 `fix-and-pr`；只覆盖依赖告警；只计**未合并**关闭 PR 与最近 50 条（更早 / 查询失败 = 少计，fail-open）；执行路径细调不改变键；全部命中时连 lockfile repair 一并跳过、终验仍执行；多仓仅 PR 落点仓库计数；平台交付链不写标记（候选）；`en-US` 配置指南 `retryFailed` 行未同步（16 行存量漂移）。

### M48.4 [P1 🛠️] 提交面白名单与 `pnpm-workspace.yaml` 定点编辑（**已闭环** `61788594` + `71ccef1f` + `fdc1e8a2` + `97683ebb` + `bfb43212` + `882bdfa0`）

- **目标**：提交集合可枚举（杜绝 `git add .` 混入生成物），`pnpm-workspace.yaml` 覆盖写入改为定点编辑。
- **落地**：提交集合 = 固定白名单（任意层级 `package.json` + 根 `pnpm-lock.yaml` / `pnpm-workspace.yaml` / `.npmrc` / `.gitignore`）∪ 成功且非 noOp 动作的 `FixAction.changedPaths` / code-scanning `filePath`；生成物黑名单（`.nuxtrc` / 类型声明 / `.nuxt` / `dist` / `node_modules` / `.pnpm-store` / `dependfix-reports`，任意层级）不提交且不告警；路径校验拒绝绝对 / `..` / `:(` / 控制字符，暂存用 `git add -- :(literal)<path>` 分批；未声明已跟踪改动 / 未合并冲突 / 索引区越界暂存 / workDir 外已暂存 → `UNEXPECTED_CHANGES`，空集合 `NO_CHANGES`（平台映射 deliver + deterministic，不 push 不建 PR）；`pnpm-workspace.yaml` 用 `parseDocument` + `setIn` 定点编辑（保留注释 / 引号 / 键序 / CRLF；解析失败与非标量旧值不写盘；`overrides:` 空值物化；回滚以备份还原为权威、定点按实际 key 兜底）。
- **审计**：R1 分区 A Reject（`overrides:` 空值 `setIn` 抛错中止整仓 + `.bak` 残留等 1B / 5W / 6S）→ 全量收口（空值物化 + 全段 try/catch + 非标量拒写、`missing` 双点告警、全仓 `git status` + outside 标记、备份优先级、回传实际 key、冲突与仓外暂存拒绝、CRLF 保留、app 级用例）→ R2 quick Pass；mutation 11/11。
- **证据**：全仓 327 文件 / 4980 passed；定向 6 组全绿；lint 0 error；typecheck 7 包；文档九项；编号 0。
- **边界**：fixer 写盘靠白名单覆盖（不逐路径声明）；运行前白名单内已有未提交改动会与本次改动一并提交（无法区分）；索引区越界暂存拒绝但不代清；生成物按任意层级名字匹配（名为 `dist` 的源码目录也会排除，属安全方向）；YAML 含别名文档整体跳过定点编辑。

### M48.5 [P1 🛠️] PR 创建后 CI 回环（CLI / Action 侧）（**已闭环** `cce39c09` + `3ef294ee` + `1b37a35e` + `acc78875` + `ff8fa60a` + `7b58c81b`）

- **目标**：创建 PR 后可选等待 check 终态；失败时默认评论失败摘要、可选关闭坏 PR，使红 PR 不再静默挂起。
- **落地**：`pr-check-watch.ts` 五态状态机（`passed` / `failed` / `cancelled` / `no_ci_detected` / `timeout`）+ 宽限期 60s 且 ≥2 轮后才允许 `no_ci_detected`；**fail-closed**（`startup_failure` / 未识别结论计为失败，绝不判通过）；15s→60s 退避 + 轮询上限；采集 `checks.listForRef` + 分页 `listCommitStatusesForRef`（单源失败不参与终态，采集失败 ≠ 零观测）；预算 min(per-PR、per-run 跨 PR 累计、剩余 job 预算 70%) 并回传绑定来源；处置 = 评论（job 名 + URL + 归因 + 尝试标记）/ 仅聚合 `self_caused` + 显式开关才关闭并删分支（404 与 Reference does not exist 幂等，受保护 422 留痕）/ dry-run 全出口守卫 / 名称与 URL 清洗；配置 5 键 + CLI 2 开关 + Action inputs；报告 `prCheckWatch` + 4 个 summary 计数器。
- **审计**：R1 Reject（`startup_failure` / 未知结论被判非失败 → 可能 `passed` / `cancelled`）→ R2 Reject（用例未隔离 `GITHUB_ACTIONS`，CI 必红；per-run 未累计 / poll 标签 / catch 计数 / 422）→ R3 Pass；mutation 10/10。
- **证据**：全仓 331 文件 / 5046 passed；`GITHUB_ACTIONS=true` 定向 8 passed；lint 0 error；typecheck 7 包；文档九项；编号 0。
- **边界**：只等本次创建的 PR（去重命中不等待、只计数）；不跨进程续等、不写平台库、不做 webhook、不自动合并；按 head SHA（缺省分支名）轮询，后续 force-push 的提交也计入；父提交取 first parent（失败回退 PR base，再失败 → `unknown`）；采集 API 失败期间不推进 `no_ci_detected`；路径过滤 / 新 job → `unknown`；混合归因一律 `unknown`；平台侧回环不复用（候选）。

### M48.6 [P1 🚀] 外部作业归因与合并门禁（**已闭环** `9ebadc18` + `9523ae6e` + `330efff8` + `f1dc9133` + `3bdd77fd`；分类器切片随 M48.5 前置）

- **目标**：已采集的 check 结果按五类归因，报告与平台视图同源；自动合并门禁覆盖同批 job。
- **落地**：`check-attribution.ts`（五类规则 + `aggregateCheckAttribution`，`self_caused` = 硬失败且父提交同 job 绿）；报告 `## Check Attribution`（归因计数 + 逐 PR 状态 / 聚合归因 / 失败 job 名；全绿不出空表；作业名经 `escapeCodeName`）；平台 `UnifiedBuildSignal.attribution` 由同一函数计算（只对失败 / 取消结论产出；证据取 `output.title + output.summary` 与 CLI 同口径；三源未识别原始状态 fail-closed；`completed + null` 平台 `skipped` 与 CLI 的差异显式记录）；UI 归因标签（纯函数色调 + 字面量 i18n 键 + 双 locale 单测）；mergify 两条规则补齐四条 `check-success` + `check:mergify` 门禁（扫全部 `pull_request` workflow、声明表 + 陈旧校验、空格条件、matrix 表达式报错）并接入 CI；root devDependency `yaml`。
- **审计**：A R1 standard Pass（4W/5S）→ R2 quick Pass；B R1 standard Reject（lockfile 夹带 `chart.js` 无关升级；门禁只扫 `test.yml` 等 1B/7W/7S）→ R2 quick Pass；mutation 6/6。
- **证据**：全仓 332 文件 / 5090 passed；`check:mergify` OK（脚本 25 例）；`pnpm install --frozen-lockfile` exit 0；lint 0 error；typecheck 7 包；文档九项；编号 0。
- **边界**：平台不采集父提交 → `self_caused` / `pre_existing` 不可达；归因不参与 `overallStatus` / 告警 / mergify 判定；`completed + null` 两端口径不同（已裁定，未统一）；声明表当前为空；`pull_request_target` 不计入 PR job；UI 标签缺视觉基线用例（候选）。

### 阶段收口

- 六原子全部闭环并通过 Review Gate（含收口后 Pass）；mutation 逐条 **4/4 / 7/7 / 9/9 / 11/11 / 10/10 / 6/6**；最终门禁 `lint` 0 error（3 条存量 warning）/ `typecheck` 7 包 / 全仓 **332 文件 5090 passed** / `build` 全绿 / 文档九项 + `docs:build` / 编号 0。
- **容量校准**：全阶段唯一 diff 127 文件 / +12,718 −925（各原子收口记录累加 204 文件 / +12,724 −931），相当于基线文件约 2-4 倍、行约 3-6 倍，主要来自测试与文档；后续阶段基线估算须按「实现行 × 2-3」计入测试与文档。
- **残余（已登记 backlog）**：平台 PR Check 回环复用 CLI 等待；平台 UI 归因标签视觉基线；平台 `completed + null` 与 CLI 结论统一；head 侧同 ref 多轮 run 按作业名收敛；`en-US` 配置指南 16 行存量漂移；M48.2 仅覆盖根 scripts 单一形态；M48.4 白名单内运行前改动归属不可区分。
