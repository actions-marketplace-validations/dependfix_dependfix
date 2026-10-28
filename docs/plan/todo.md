# 当前阶段待办

> 本文件**仅**登记当前阶段活跃待办；已闭环阶段归档于 [todo-archive.md](todo-archive.md)；未排期 / 延期 / 远期 / 长期主线 / 已知边界登记于 [backlog.md](backlog.md)。

---

## 文档位置速查

| 内容类型 | 位置 |
|:--|:--|
| 当前阶段任务 | **M49：0.6.0 发版清障**（2026-10-25 用户决策；六原子 + 2 项追加临时待办（不占编号）见下） |
| 下一阶段（已授权，未规划） | **1.0 发布门槛收口**（E → F1 → F2 → G；台账见 [release-1.0-readiness.md](../design/governance/release-1.0-readiness.md)） |
| 已完成阶段归档 | [todo-archive.md](todo-archive.md)（阶段索引 + [archive/](archive/) 分片；M0-M48 全部已归档） |
| 里程碑与阶段交付 | [roadmap.md](roadmap.md)（M0-M48 已归档；M49 进行中） |
| 未排期 / 延期 / 远期 / 长期主线 / 已知边界 | [backlog.md](backlog.md) |
| 历史归档索引 | [archive/index.md](archive/index.md) |

---

## M49：0.6.0 发版清障（2026-10-25 用户决策）

承接 M48 归档后的发版窗口。2026-10-25 发布评估：0.5.0（2026-09-18）后累计 805 commits（132 feat / 85 fix / 2 类 breaking〔3 commits：Node 基线、安装链受管异步化及其消费方适配〕），`release:plan` 推导全包 minor → 目标 **0.6.0**；但仓库存在 4 类「带着发不体面」的问题：自产 code scanning 告警 2 条、依赖审计门禁（M49.3 前）仍为信号级且周回归连续 4 周红、critical / high 依赖漏洞未清零（含 1 条长期豁免）、用户可见文档 4 类 / 6 行漂移（其中设计索引含 3 行陈旧）。本阶段以「清障 → 发布 → 发布后验证」闭环为目标。

**授权与归属**：M49 为用户 2026-10-25 决策的独立阶段（非插队）；M49.1 / M49.2a / M49.2b 属 [规划规范 §3.1](../standards/planning.md#_3-1-新需求默认走-评估-→-backlog-原则-hard-requirement) 例外清单第 1 / 2 类（安全漏洞），M49.3 / M49.4 / M49.5 属清单外**经用户明确授权**（Security 门禁治理 / 发版文档 / 发版），均纳入本阶段条目编号。

**§3.4 交叉核验**：M49 范围经 todo-archive 表格扫描（关键词 `code scanning` / `polynomial-redos` / `审计门禁` / `ai-api-key` / `MCP tool` 仅命中 M48 归档与既有残余候选，未见同范围闭环）+ `git log --oneline -- <路径>`（`pr-check-watch.ts` / `fix-fingerprint.ts` / `test.yml` 最近均为 M48.x 引入，未做安全收敛）+ 代码 anchor（code scanning 2 条开放 / `test.yml:46` 仍 `|| true`（M49.3 前；2026-10-27 已转正） / `pnpm-workspace.yaml audit.ignore` 2 条 / `quick-start.md:189` 输入名过期）→ **0 项重复评估**。

**类型平衡**：🛡️ 4 + 📚 1 + 🚀 1（🎨 / 🧪 缺口显式标注：发版窗口不引入 UX 新面，🎨 由后续 E 阶段承担；测试随各条目内嵌）。

**阶段基线工作量（§3.1.1 分母）**：6 条目「交付物」区间和为 **10-16 commits / 28-41 文件 / 1400-2430 行**（区间和口径；M48 实测倍率提示实际可能上浮 2-4 倍，D 阶段按实际 diff 复测）。

**6 原子条目**：

- **M49.1** [P0 🛡️] 自产 code-scanning 告警清零（`js/incomplete-sanitization` + `js/polynomial-redos`）
- **M49.2a** [P0 🛡️] 依赖漏洞清零 A：critical / high（直接依赖 / overrides）
- **M49.2b** [P0 🛡️] 依赖漏洞清零 B：platform 链 moderate 收口
- **M49.3** [P0 🛡️] Security 门禁转正（prod 阻断 + 全量信号；周回归转绿）
- **M49.4** [P0 📚] 发版面文档漂移收口（AI 输入名 / M5 遗留 / MCP tool 数 / 设计索引 3 行）
- **M49.5** [P0 🚀] 0.6.0 版本提升、发布与发布后验证

**阶段期间追加临时待办（不占编号）**：sandbox 入口临时关闭（2026-10-27）；平台本地日志通道统一（2026-10-27，已闭环）；发布与周回归门禁对齐（2026-10-28，M49.5 前置）。**累计 3 批，命中 [规划规范 §3.1.1](../standards/planning.md#_3-1-1-插队后的阶段容量再平衡-hard-requirement-2026-10-19) 阈值 1**——再平衡结论见本批条目末（**移出 0 项**）。

**建议顺序**：M49.1 → M49.2a → M49.2b → M49.4 → M49.3 → M49.5。M49.1 与 M49.2a 可并行评估；M49.3 改为**先翻转、后取证**——翻转后连续 3 次 `master` push 的 prod 阻断步骤 `conclusion=success` 且日志含审计结果行，回填为转正证据；回填前不闭环，任一 run 失败则回退 `|| true` 或按 §5.7 评估；M49.5 最后执行。

### M49.1 [P0 🛡️] 自产 code-scanning 告警清零

- **目标**：关闭仓库 2 条自产 code scanning 告警，且不改变既有清洗 / 解析语义。
- **范围**：`packages/engine/src/github/pr-check-watch.ts`（`sanitizeCheckUrl` / `sanitizeCheckName` 的转义补全）、`packages/engine/src/github/fix-fingerprint.ts`（marker 正则的 ReDoS 收敛：原子化 / 长度上限 / 线性扫描）；定向测试 + mutation。
- **验收标准**：
  1. `js/incomplete-sanitization`（`pr-check-watch.ts:463`）：表格单元格转义补齐反斜杠（先 `\` 后 `|`，控制字符沿用 `sanitizeCheckName` 剥离）；失败评论 URL 的竖线按 `%7C` 编码防拆列；补「含 `\` 与竖线」用例。
  2. `js/polynomial-redos`（`fix-fingerprint.ts:107`）：构造恶意 marker 输入（含大量制表符 / 重复属性）在 100KB 级仍线性（单次 < 50ms）；既有 marker 解析黄金夹具逐字不变。
  3. mutation ≥ 2（转义顺序 / 空白容错 / 属性区边界 / 回退正则 / URL 竖线编码）被击杀（实测 5/5）；engine 定向测试全绿。
  4. 用户推送后 code scanning 复扫 0 条（记录 analysis id 与查询时点；本批不自动 push）。
- **不做什么**：不改 marker 格式与归因规则；不改 `sanitizeCheckName` 的展示语义（仅补转义）。
- **依赖**：code scanning 复扫需 push；本批不自动 push。
- **交付物**：2-3 commits / 4-6 files / 200-350 行。
- **风险与缓解**：正则改写改变容错 → 黄金夹具 + 恶意样本双向用例；复扫需等 CI 完成 → 记录 analysis id 并在发布前查询。
- **D 阶段（2026-10-26）**：代码与测试已落地（6 文件 / 约 150 新增行；mutation 5/5；engine 1787 passed / 根全量 5127 passed）；AC 1-3 满足；**AC 4 已闭环**：推送后 analysis `2026499469`（`108e38f3`，2026-10-26T10:30:53Z）复扫 `#28` / `#29` 均 `fixed`，open 0 条（修复前基线 `artifacts/m49.1/code-scanning-baseline.txt`）。

### M49.2a [P0 🛡️] 依赖漏洞清零 A：critical / high（直接依赖 / overrides）

- **目标**：Dependabot 开放 critical / high（**未被 §5.7 豁免**）清零；`pnpm audit`（全量依赖）critical / high 归零。
- **范围**：所有 critical / high 路径（含 platform 链的 `vite` / `launch-editor` / `undici` high；`handlebars` → 4.7.10、`body-parser` 等）；`pnpm-workspace.yaml` overrides 与直接依赖升级；`audit.ignore` 两条（node-forge / braces）上游复核；lockfile 最小 diff。
- **验收标准**：
  1. `gh api repos/<owner>/<repo>/dependabot/alerts?state=open` 的 critical / high = 0（§5.7 豁免条目单列并登记 GHSA + 路径 + 复核条件）。
  2. `pnpm audit --audit-level=moderate --registry=https://registry.npmjs.org` 的**非 §5.7 豁免** critical / high = 0（moderate 剩余项留待 M49.2b）。
  3. `git diff -U0 pnpm-lock.yaml` 逐 hunk 复核，只含目标依赖；`pnpm install --frozen-lockfile` 通过。
  4. 全量测试 + typecheck + build 通过（升级涉及运行时依赖时按需加 e2e）。
   > 复核命令：`gh api repos/<owner>/<repo>/dependabot/alerts?state=open --jq '[.[]|select(.security_advisory.severity=="critical" or .security_advisory.severity=="high")|select(.security_advisory.ghsa_id!="GHSA-86w9-cpqp-85rv")]|length'` → 0；node-forge 豁免条目单列（GHSA + 路径 + 复核条件见 §5.7）。
- **不做什么**：不使用 `--ignore` / `--ignore-unfixable`；不为清零强行跨大版本（跨大版本须单列评估并留回滚路径）；不动 platform 链的 **moderate** 项（归 2b）。
- **依赖**：上游修复版本已发布（handlebars 4.7.10 已发布；其余以 audit 结果为准）。
- **交付物**：2-3 commits / 4-6 files / 300-500 行（含 lockfile）。
- **风险与缓解**：升级引发行为变更 → 分批升级 + 定向测试；无修复版本 → 按 §5.7 豁免并记录。
- **D 阶段（2026-10-26）**：overrides 升级 `handlebars ^4.7.10` / `body-parser ^2.4.0` / `undici ^8.12.2`（锁到 8.12.3）/ `launch-editor ^2.14.2` / `vitepress>vite ^6.4.4`（锁到 6.4.5）/ `qs ^6.16.1`（满足 body-parser 2.4.0 声明范围）；删除无消费者的 `vite@5` 死覆盖；braces 豁免因 advisory 于 2026-10-23 撤回而移除，node-forge 保持豁免（最新版仍 1.4.0）；`pnpm audit` 非豁免 critical / high = 0（基线 2 critical + 5 high；node-forge 为唯一 ignored high）；lockfile 仅目标包、`qs` 与 body-parser 传递依赖 `on-finished` 变动；`--frozen-lockfile` 通过；AC 1 待推送后 `gh api` 复核（node-forge 单列）。

### M49.2b [P0 🛡️] 依赖漏洞清零 B：platform 链 moderate 收口

- **目标**：platform 运行时链（nuxt / vite / nodemailer / undici / launch-editor 等）的 moderate 漏洞收敛；发布物（含 Docker 镜像）的剩余风险可解释。
- **范围**：`apps/platform` 相关依赖与 overrides；必要时 `pnpm-workspace.yaml` overrides；lockfile；platform 全量测试 + e2e + 视觉基线。
- **验收标准**：
  1. `pnpm audit --prod --audit-level=moderate --registry=https://registry.npmjs.org` 的 **moderate 由基线 15 降至 ≤ N**（N 在 2b 的 P 阶段锁定并写入条目），剩余项逐条说明（无修复版本 / 仅 dev / 可接受 三分类）。
  2. Dependabot 开放 moderate = 0 或逐条登记理由（`gh api` 查询记录）。
  3. 涉及 nuxt / vite 升级时：platform 全量测试 + e2e + 视觉通过（必要时 update 后 no-update 连跑两遍）。
  4. `git diff -U0 pnpm-lock.yaml` 只含目标依赖；`--frozen-lockfile` 通过。
- **不做什么**：不处理 critical / high（归 2a）；不做 major 升级（nuxt / vite 的 major 须单独立项）；不改平台 UI 行为。
- **依赖**：M49.2a 完成（避免同一 lockfile 冲突）。
- **交付物**：2-3 commits / 4-8 files / 400-700 行（含 lockfile 与测试适配）。
- **风险与缓解**：nuxt / vite 升级牵动构建与 UI → 每依赖一批，跑 e2e / 视觉；不可控项按 §5.7 评估。
- **P 阶段（2026-10-26）**：实测基线（M49.2a 后）prod moderate 8 / low 4（计划基线 15 为 2a 前口径）；锁定 **N = 0**——全部存在 4.x 内 minor / patch 修复版本，不涉及 major。分类：`nuxt` / `@nuxt/nitro-server`（minor 4.5.2→4.6.2）、`@vitest/mocker`（由 `vitest` 精确钉定，整体 4.1.11→4.1.12）、`ip-address`（override `^10.7.4`）、`fast-uri@3`（override `^3.1.9`）、`serialize-javascript`（override `^7.1.3`，low 顺带收敛）。
- **D 阶段（2026-10-26）**：`pnpm audit` 全量 / prod 均 0 条 advisory（仅 node-forge 1 high ignored）；推送后复核（`2026-10-26T12:41Z`）：Dependabot 8 medium + 4 low 全部关闭，开放项仅 node-forge 1 high（§5.7 豁免），AC 1 / AC 2 闭环；lockfile 大幅变更源于 nuxt 4.6 内部重构（`@nuxt/cli` 4 / `@nuxt/vite-server` / cssnano 9 / unimport 7 等），importers 仅 `nuxt` 与 `vitest` / `@vitest/coverage-v8` 两处；`--frozen-lockfile` 通过；platform 单测 2164 passed、e2e 两轮 203/204 passed + 2/1 flaky（scan-config 既有 + 首轮 repos-crud 删除；重试均通过）、视觉 17 passed；全量 5127 passed；lint 0 error（4 存量 warning）；typecheck 6 个 workspace 项目 Done（scope 7/8，skills 无 typecheck 脚本）+ packages/platform/docs build 通过。Nuxt 4.6 项目配置拆分后 `.nuxt/tsconfig.json` exclude `server/**/*`，`apps/platform/tsconfig.json` 覆盖 exclude 并同步 `eslint.config.js` 注释，恢复 server 深层目录的 type-checked lint。残余：Nuxt 4.6.2 自带的 transitive major（`@nuxt/cli` 4 / cssnano 9 / unimport 7 / srvx 1）与 `@nuxt/kit` 4.5.2 等多版本并存，已由 build / e2e / visual 覆盖；Docker 镜像构建归 M49.5 发布验证。

### M49.3 [P0 🛡️] Security 门禁转正（prod 阻断 + 全量信号；周回归转绿）

- **目标**：让风险依赖无法进入 master；周回归恢复绿色。
- **范围**：`.github/workflows/test.yml`（新增 / 改造审计步骤）、`docs/standards/security.md` §5.6 / §5.8（转正记录或判据修订）、`pnpm-workspace.yaml audit.ignore`、`.github/skills/code-reviewer/references/code-quality-checklist.md`（转正证据检查点）。
- **验收标准**：
  1. **阻断面**：`pnpm audit --prod --audit-level=moderate --ignore-registry-errors --registry=https://registry.npmjs.org` 无 `|| true`；registry 不可达时 exit 0（模拟验证）。
  2. **信号面**：全量依赖审计步骤保留（可作为信号），周回归 `security:audit-deps` 使用阻断命令并通过。
  3. **判据证据**：按 §5.6 记录转正日期 + 3 个 `master` **push** run id（`--event push`）。若 `audit.ignore` 使 clean 字面串不可达：按 §5.7 末句「修订 clean 判据」通道**同批**修订 §5.6（阻断面 / 信号面定义），并同步 §5.8 指针与检查点矩阵；不得以「记录依据」替代 run id。
  4. Weekly Regression 一次通过（`security:audit-deps` 不再 blocker）。
- **不做什么**：不以 `--ignore` 放宽；不把 dev 依赖审计信号移除；不做「只在文档里声明阻断」而无 CI 步骤。
- **依赖**：M49.2a / 2b 清零；3 次 push（用户推送确认）。
- **交付物**：2-3 commits / 4-6 files / 150-250 行（含规范与检查点）。
- **风险与缓解**：上游突发新漏洞导致门禁红 → 按 §5.7 评估豁免；判据修订需保留修订后的 3 个 run id，避免「改口径即转正」。
- **P 阶段（2026-10-27）**：`test.yml` 仅全量信号（`|| true`），无 prod 阻断步骤；`security:audit-deps` 无 `--registry`，本地默认 registry（npmmirror）无 audit endpoint → exit 1；`audit.ignore` 保留 node-forge（latest 1.4.0，无 >1.4.0 修复版本）；clean 字面串 `No known vulnerabilities found` 因 ignore 不可达。实证：`--ignore-registry-errors` 下 registry 不可达 exit 0、无 flag exit 1；临时 `lodash@4.17.20` 项目在 flag 下仍 exit 1（漏洞判定未被放宽）；显式 `--registry=https://registry.npmjs.org` 是必要的，否则镜像无 audit endpoint 时阻断步骤会被 `--ignore-registry-errors` 静默放行。结论：按 §5.7 末句修订 clean 判据，阻断步骤显式 `--registry` + `--ignore-registry-errors`，全量信号保留。
- **D 阶段（2026-10-27）**：`test.yml` 拆分全量信号 + prod 阻断（阻断无 `|| true`）；`security:audit-deps` 同步阻断命令；`security.md §5.6` 改写为转正后判据（阻断 exit 0、ignored 不参与阻断、统计命令改为查步骤 conclusion），§5.7 / §5.8 / §5.2 指针同步；`pnpm-workspace.yaml` audit.ignore 注释记录转正后仍保留；检查点矩阵新增 §5.6 行；readiness G1 改 ◐ 并登记阻断已上线、run id 待回填；backlog 记录转正。验证：YAML 解析通过；`check:verify-chain` 通过；registry 故障 + flag exit 0 / 无 flag exit 1；临时 `lodash@4.17.20` + flag exit 1；`pnpm run security:audit-deps` 在 registry 故障下按设计 exit 0（真实 clean 审计待 CI）；`lint:md` / `check:docs` / `docs:build` / `i18n:check:anchor` / `lint` / `typecheck` 通过。审计 R1 deep Reject（RG-B01：三处「翻转前 3 次 clean」时序声明与「先翻转」互斥）→ 全收口：三处改「先翻转、后取证」、§5.6 明确原条件未达成 → 按 §5.7 修订通道转正、判据补「日志含审计结果行」防 registry 假绿、checklist ③/⑤ 与 G1 ④ 同步、backlog 登记假绿加固候选；R2 quick Pass（0B/0W；RG-W04/W05/W06 + S04 已修）。
- **A 阶段补修（2026-10-27）**：首次周回归 `40431203719` 在 `Run weekly regression gate` 因 `artifacts/regression/current.md` 缺失 → ENOENT（`0b0ff93b` 迁移回归）失败；修复 `scripts/shared/regression-window.mjs` / `scripts/regression/run-periodic-regression.mjs` 自动初始化目录与文件，补缺失路径单测；本地 `pnpm run regression:weekly` exit 0（Review Gate Pass）。待推送后重跑周回归取证。
- **A/F 回填（2026-10-28，M49.3 闭环）**：翻转后 3 次 `master` push 的 prod 阻断步骤均 `success` 且日志含审计结果行——`40372808067`（`84615ce2`，1 high ignored）、`40466448172`（`ea07afa9`，1 high ignored）、`40690157020`（`16a19b6c`，1 low + 1 high ignored；该 run 的 Test job 因 `check:doc-governance` 文档字符预算失败，与审计步骤无关，已由 `ea89e7ec` 修复）。Weekly Regression `40693124400`（`16a19b6c`，2026-10-28 手动 dispatch）`success`（Build deps + Core Regression 全步骤 success，gate 日志含审计结果行；artifact `weekly-regression-40693124400` conclusion `Pass` / blocker 0 / warning 0）。证据同步 `security.md §5.6` 与 readiness G1。M49.3 闭环；下一项 M49.5。

### M49.4 [P0 📚] 发版面文档漂移收口

- **目标**：用户可见文档与实现一致，避免 0.6.0 发布带着错误指引。
- **范围**（6 处，逐条验收）：
  1. `docs/guide/quick-start.md:189-190`：AI 输入名与 `action.yml` 对齐（`ai-api-key` / `ai-base-url` / `ai-provider` / `ai-model` / `ai-api-url` / `ai-trigger`）。
  2. `docs/guide/configuration.md:191`：移除「计划中（M5）」遗留（AI 配置已落地，见同文档 §平台环境变量）。
  3. `docs/guide/release.md:18`：MCP tool 数「7 个」→「8 个」。
  4. `docs/design/governance/index.md`：MCP Server 设计「🔶 未开始」→ 已落地（`@dependfix/mcp` 已发布）。
  5. `docs/design/governance/index.md`：定时扫描与批量处理「🔶 设计中」→ 已落地（真实环境验证见 T704）。
  6. `docs/design/governance/index.md`：执行器设计与沙箱评估「🔶 设计中（2026-08-08）」→ 已落地（M38）。
- **验收标准**：
  1. 上述 6 处与 `action.yml` / `packages/mcp/src/index.ts` / 现状一致（对照记录进 audit 证据）。
  2. 若 `packages/mcp/README.md` 的 tool 清单与实现不一致，同批对齐（不新增「如有」口径）。
  3. `check:docs` / `lint:md` / `docs:build` / `i18n:check:anchor` 全通过。
- **不做什么**：不做 en-US 全量平价（F2）；不改实现。
- **依赖**：无。
- **交付物**：1-2 commits / 5-7 files / 100-180 行。
- **风险与缓解**：文档断言再次漂移 → 对照表进 audit 证据；后续可加 action 输入一致性机检（登记候选）。
- **P 阶段（2026-10-26）**：按 6 处基线逐项对照 `action.yml` / `packages/mcp/src/index.ts` / 设计文档现状。额外发现（归入 AC 2 口径）：`packages/mcp/README.md` / `README.en-US.md` 缺 `pnpm_audit` 与 `discover_repos.max_repos`；`mcp-server.md` 仍写 4 个 tool；`packages/mcp/src/index.ts` 注释写 7 个。同批对齐，避免发布物 tool 清单与实现不一致。执行器状态按实际实现标注（M38 为执行模型隔离、沙箱隔离基础设施为 M10 T1001；A 阶段实测 `buildCmd` 仍为占位，状态收窄为「设计已落地 / 真实引擎执行占位」）。
- **D 阶段（2026-10-26）**：6 处按事实源对齐；MCP tool 清单补齐为 8 个（新增 `pnpm_audit`）并同步 `discover_repos.max_repos`；`mcp-server.md` 由 4 个 tool 更新为 8 个、补 `pnpm_audit` 与已落地状态（0.2.0）；`index.md` 的 MCP / 定时扫描状态改为已落地，执行器/沙箱改为「设计已落地（M10 隔离基础设施 + M38 执行进程隔离），沙箱内真实引擎执行为占位」；`executor-sandbox.md` / `platform-scheduled-batch.md` 状态头与正文同步（M6/M7 表保留规划期快照并加注）；`quick-start` 增加 sandbox 占位限制提示；`github-action-workflow.md` 增加 T201 设计时点快照说明。A 阶段 Reject → 修复：`pnpm_audit` README / tool description 按实际 `requireToken()` 行为改为「复用 GITHUB_TOKEN 检查」；`mcp-server.md` 交付版本改为 0.2.0 / 0.5.0；`platform-scheduled-batch.md` 的 ScanQueue 历史时态订正。验证：`check:docs` / `check:readme-i18n` / `i18n:check:anchor` / `docs:check:i18n` / `lint:md:check` / `docs:build` 全通过；`packages/mcp` 单测 47 passed；`pnpm lint` 0 error（4 存量 warning）；`pnpm run typecheck` 通过。审计 R1 Reject（2B：`pnpm_audit` token 声明与实现冲突、sandbox 状态过度）→ 全收口 → R2 quick Pass（0B/0W；1 warning + 5 suggest 已修）。残余（已登记 backlog）：① SandboxExecutor 真实引擎执行占位（P1，启用 sandbox 前必须闭环）；② pnpm_audit token-free 回退意图与实现不一致（P2）；③ dependfix-remediator REFERENCES 的 MCP 状态/入参映射过期。

### M49.5 [P0 🚀] 0.6.0 版本提升、发布与发布后验证

- **目标**：发布 0.6.0 并验证发布物可用、可安装、可回滚。
- **范围**：`release:plan` 复核（未标注 breaking 的人工修正）→ `release:version --dry-run` 预览 → `release:version` → `pnpm changelog` → 提交 →（用户）push 到 master → Release workflow `workflow_dispatch` → 发布后核验（npm 5 包 + platform tag + Docker tag + GitHub Release + `npx` / 全局安装冒烟）。
- **验收标准**：
  1. 5 个 npm 包发布成功（`dependfix` / `core` / `engine` / `mcp` / `skills`），platform tag 创建。
  2. `npx dependfix --version` 与全局安装均为 0.6.0；`dependfix report-only --help` 正常。
  3. Docker `platform-<x.y.z>` tag 存在且可启动（health 200）。
  4. 五份 CHANGELOG 含当前版本段；GitHub Release notes 正确。
  5. 发布后 master CI 连续 3 次绿（作为 1.0 G4 窗口起点）。
- **不做什么**：不启用 `schedule` / `push` 自动发布（1.0 后）；不打 `@v1`（G 批次）；不在本批引入新功能。
- **依赖**：M49.1-M49.4 完成；用户推送 + 手动 dispatch 授权。
- **交付物**：1-2 commits（版本 + changelog）/ 7-8 files / 250-450 行 + 发布执行记录。
- **风险与缓解**：OIDC / changelog 校验失败 → 按 release.md 修复后重试；发布后发现缺陷 → 0.6.1 补丁并记录。

### 追加临时待办：sandbox 入口临时关闭（2026-10-27 用户授权，不占阶段条目编号）

- **背景**：M49.4 A 阶段实测 `SandboxExecutor.buildCmd` 仍为最小占位（回显 `RunResult`，不启动引擎）；UI 仍暴露 sandbox 选项，rootless Docker 可用时选择 sandbox 会返回 0 告警的假成功。用户 2026-10-27 裁定方案 A：0.6.0 前做最小入口收口，真实执行留 backlog P1。
- **范围**：
  1. UI：仓库表单 sandbox 选项禁用；存量 sandbox 仓库编辑时自动改为 container 并提示；列表 / 过滤标签标注「暂不可用」。
  2. API：仓库创建 / 更新 / 批量导入 / 扫描请求显式 `sandbox` 一律 400；e2e fixture 保留以模拟存量。
  3. 路由：存量 `executorKind=sandbox` 扫描强制 ContainerExecutor，`degradedReason.code=sandbox_entry_disabled`，run 状态 degraded；容器不可用则 failed `container_unavailable`。
  4. 文档：quick-start 标题改「实验性 / 当前暂不可用」；executor-sandbox / platform §3.8 / index / backlog 同步；backlog P1 保留真实执行。
- **验收标准**：
  1. 新增 / 更新 / 批量导入 / 扫描请求带 `sandbox` 均 400，错误信息明确；UI 不能选 sandbox，存量编辑自动迁移并提示。
  2. 存量 sandbox 仓库扫描走 container：成功 → degraded + `sandbox_entry_disabled`；容器不可用 → failed + `container_unavailable`；不再出现 0 告警假成功。
  3. 定向测试（schema / API / orchestrator）+ lint / typecheck / i18n 缺词 + 文档门禁通过；UI 浏览器验证 disabled 选项与迁移提示。
- **不做什么**：不实现真实 sandbox 执行（保留 P1）；不删除 `SandboxExecutor` 类 / 现有沙箱测试；不改 container / github-action 正常路径。
- **依赖**：M49.4 审计发现；用户 2026-10-27 明确授权。
- **交付物**：4 commits / 29 files / +335 / -259 + UI 验证记录。
- **风险与缓解**：UI 迁移误改其它字段 → 表单全量提交 + e2e 请求体断言；API 直连仍可写 sandbox → schema 拒绝 + e2e fixture 双门控；存量 sandbox 每次降级噪声 → 只落库不通知；`repositoryUpdateSchema.partial()` 默认值缺陷 → 登记 backlog P1（UI 全量提交暂不触发）；quick-start 恢复后操作误导 → 入口关闭块改注释命令 + 当前降级口径。
- **剩余未完成条目 / 剩余验证与交付预算**：本临时待办闭环后 M49 仅剩 M49.5（发布）；本批 4 commits / 29 files / +335−259；验证预算已覆盖平台全量 + 新 e2e + 文档门禁，A 阶段 R2 后提交。
- **P 阶段（2026-10-27）**：确认 UI/API/路由三处入口；`repo-form-dialog.vue` 当前 3 选项且无 disabled；`repositorySchema` / `repositoryUpdateSchema` / `scanRequestSchema` / `batchImportSchema` 接受 sandbox；`scan-orchestrator` 在 `isAvailable()` 时走 SandboxExecutor 占位。定方案：UI disabled + 存量编辑迁移提示；API 显式 sandbox 拒绝；路由强制 container + degraded `sandbox_entry_disabled`；e2e fixture 保留存量模拟。审计预期 deep（安全 / 可用性 + 数据写入 + UI）。
- **D 阶段（2026-10-27）**：UI 表单 sandbox 项 disabled、存量仓库打开即迁移为 container 并提示，列表 / 过滤标签标注「暂不可用」；仓库创建 / 更新 / 批量导入 / 扫描请求显式 sandbox 一律 400（共享 `SANDBOX_EXECUTOR_DISABLED_MESSAGE`）；编排层对存量 sandbox 强制 ContainerExecutor + degraded `sandbox_entry_disabled`（容器不可用 → failed `container_unavailable`），环境审计仍落 `sandbox_degraded` 但**只落库不通知**（避免噪声）；retry 对存量 sandbox run 归一为 container（避免 409）；e2e fixture 增加 `executorKind` 以注入存量仓库（仅测试端点）。文档同步 quick-start（入口关闭块改注释命令 + 当前降级口径）/ deployment zh+en / executor-sandbox / implementation §7.1/§7.4/§7.8.3 / index / platform §3.8 / backlog P1；`repositoryUpdateSchema.partial()` 默认值缺陷登记 backlog P1。验证：定向 6 文件 134 passed + retry 新增用例；platform 全量 165 files / 2168 passed / 9 skipped；新增 e2e 用例通过（disabled 选项 + 迁移提示 + PUT 请求体 `executorKind=container` + API 持久化）；`lint` 0 error / 3 存量 warning；`typecheck` 通过；platform build 通过；`lint:md` / `check:docs` / `check:readme-i18n` / `i18n:check:anchor` / `docs:check:i18n` / `docs:build` / `check:verify-chain` 全通过；`i18n:audit:missing` 0。实际 29 文件 / +335 / -259。A 阶段并发 deep：后端 **Pass**（W01/W02 已修、W03 登记 backlog、W04/W05 计数与提交粒度已修）；UI/文档 **Reject**（RG-B01 quick-start 仍含可执行 sandbox 命令 + 旧降级口径）→ 已修；R2 standard **Pass**（0B/0W；W06 测试标题 + S07-S11 已修）。残余：真实 sandbox 执行仍留 P1；`sandboxLimits` 字段保留供存量 / API 读取；e2e fixture 的 sandbox 仅测试模拟。

### 追加临时待办：平台本地日志通道统一（2026-10-27 用户授权，不占阶段条目编号）

- **背景**：用户 2026-10-27 决策——Sentry 走官方 SaaS；本地日志通道统一优先（本地文件可查）；除本地日志优化外的可观测性条目延后到 1.0 后。评估见 [第三方可观测性评估](../research/2026-10-27-third-party-observability-evaluation.md)。
- **目标**：把进程级日志从散落 `console.*` 收敛到统一 logger，输出到本地可查文件（`LOG_DIR` 默认 `data/logs`，容器内 `/app/data/logs`；按日轮转 + 错误文件），容器重建后仍可从数据卷检索。
- **范围**：
  1. `apps/platform/server/utils/logger.ts`：补齐 `exceptionHandlers` / `rejectionHandlers`，确认文件轮转 / 错误文件 / 生产压缩 / 31 天保留。
  2. 进程边界接入：Nitro 插件、队列 worker、执行器、通知四处；未迁移的 `console.*` 仍走 stdout，逐批迁移。
  3. 配置与入口：`LOG_DIR` / `LOG_LEVEL` / `LOGFILES`；自定义 `DATA_DIR` 时导出 `DATA_DIR` 或显式 `LOG_DIR=${DATA_DIR}/logs`，确保日志落数据卷。
  4. 文档：`docs/guide/deployment.md` / 环境变量文档补日志文件位置、轮转、排障命令。
  5. 脱敏与单测：日志消息 / context 复用 `sanitizeDeep`；补文件目录、不可写回退、异常钩子、`DATA_DIR` 派生用例。
- **验收标准**：
  1. 容器内 `/app/data/logs/YYYY-MM-DD.log` 与 `YYYY-MM-DD.errors.log` 可按日期查询；数据卷重建容器后文件仍在；自定义 `DATA_DIR` 时 `LOG_DIR` 跟随数据卷。
  2. `LOG_DIR` / `LOG_LEVEL` / `LOGFILES` 有文档与单测；不可写目录回退 / warn 不阻断启动。
  3. 至少 4 个进程边界使用统一 logger；`MemoryLogger` 运行日志不重复落文件；`docker logs` 仍可用。
  4. 敏感字段脱敏用例通过；`pnpm lint` / `pnpm typecheck` / platform 单测 / build 通过；文档门禁通过。
- **不做什么**：不接入 Axiom；不一次性迁移全部 161 处 `console.*`；不改变运行结果模型与运行详情下载；不引入外部日志服务。
- **依赖**：无；日志量 / 文件权限需在容器内验证；用户 2026-10-27 明确授权追加。
- **交付物**：4-6 commits / 12-18 files / 500-800 行（含文档与单测）。
- **风险与缓解**：重复输出 → 明确进程级 / 运行级分工；日志量 → 按日轮转 + 31 天保留 + 级别过滤；文件权限 → 数据卷写探针；`DATA_DIR` 未派生 → 入口显式 `LOG_DIR`；敏感数据 → `sanitizeDeep`。
- **P 阶段（2026-10-28）**：实测 `apps/platform/server/utils/logger.ts` 零生产调用点（仅 `logger.test.ts`），服务端非测试源码 166 处 `console.*` / 43 文件；`@axiomhq/winston` 未声明依赖且 ESM 产物下 `require()` 不可用 → **决策：移除 logger 内 Axiom 传输**（P2 接入时按动态 `import()` 重写；本批仍不发外部请求）。文件通道口径：`LOG_DIR` 缺省 `data/logs`（容器入口派生 `$DATA_DIR/logs` 并导出，自定义 `DATA_DIR` 跟随）；`LOG_LEVEL` 白名单校验（未知值回退 `info` + warn）；`LOGFILES` 缺省开、`NODE_ENV=test` 缺省关（防单测写仓库 `data/`；显式 `LOGFILES=true` 仍生效）；轮转按日 + `*.errors.log` + 31 天 + 生产压缩。**多进程**：容器默认 HTTP + worker 双进程共享同一日志目录，`winston-daily-rotate-file` 的 audit 文件按「角色 + 文件类型」隔离（否则两进程写同一 audit JSON）；写探针文件名带 pid + 时间戳（消除双进程同名探针互删导致误判不可写）。**异常钩子**：winston 内置 `exceptionHandlers` / `rejectionHandlers` + `exitOnError` 在 `process.exit` 前不保证异步流刷盘，改为自实现「stderr + 同步 `appendFileSync` 错误文件 + exit(1)」，语义与 Node 默认 fail-fast 一致（不吞异常）；幂等安装（`Symbol.for` 哨兵，dev 重载不重复注册）。**边界 5 处**：进程级插件（新增 `server/plugins/logger.ts`）/ Nitro 启动插件 / 队列 worker / 执行器 / 通知；`MemoryLogger` 保持「控制台 + `logs_json`」双通道，不进文件。**脱敏**：`sanitizeDeep` 增 `Error` 分支（否则 context 里的 Error 被清成 `{}`，栈与 message 全丢），消息同样过 `sanitizeString`。日志行格式复用 `buildFileFormatLine`，致命行与文件通道同构。审计预期 standard（多模块 + 配置面 + 进程边界，无鉴权 / 数据写入变更）。
- **D 阶段（2026-10-28）**：`logger.ts` 重写通道口径（`parseLogLevel` 白名单 + `LOGFILES` 测试默认关 + `/proc`/`/sys` 硬禁用 + 角色/类型隔离 audit + 唯一探针名 + `getLoggerState` / `formatLogStartupLine`），移除 Axiom 传输与 `tryLoadAxiomTransport`；新增 `server/utils/process-log.ts`（同步致命行 + `installProcessErrorHandlers`：stderr + `appendFileSync` + `exit(1)`，`Symbol.for` 幂等，卸载可重装）与 `server/plugins/logger.ts`（安装钩子 + 启动行 + close 卸载/关闭 transport，登记 `NON_HTTP_ONLY_PLUGINS`）；`sanitizeDeep` 增 `Error` 展开（`name/message/stack`）与循环引用占位；5 类边界迁移为统一 logger（Nitro 启动插件 5 个 / 队列 4 个 / 执行器 2 个 / 通知 4 个），`shouldSkipHttpOnlyPlugin` 注入 logger 使跳过日志也进文件；`entrypoint.sh` 派生并导出 `LOG_DIR=$DATA_DIR/logs`、以运行身份建目录；compose / `.env.full.example` / deployment（zh+en）/ configuration（zh+en）/ tech-stack（zh+en）/ platform §10.9 + 设计稿同步。验证：platform 用例 2168 → 2257（172 文件 / 9 skipped，新增 89 例）；根全量 341 文件 / 5221 passed；`lint` 0 error（3 存量 warning）；`typecheck` 7 包；platform build 通过；**真机证据**：生产产物启动 → `2026-10-28.log` 含 `[build]`/`[logger]`/`[resource]` 行、`*.errors.log` 空、`.server-*-audit.json` 就位、`/api/health` 200、SIGTERM 干净退出且日志完整；`tsx` 触发真实 `uncaughtException` → exit 1 且错误文件落 `[fatal]` 行；`LOG_DIR=/proc/...` 不阻塞（warn + 仅控制台）；mutation 17/17（/proc 守卫 / 测试默认 / audit 隔离 / 探针固定名 / 致命落盘 / 致命不退出 / 消息脱敏 / Error 展开 + LOGFILES 未知值 / stderr 分流 / 换行归一 / BigInt 兜底 / 敏感字段名 / 探针名不变量复核 + Error 环保护 / getter 字段兜底 / PEM 脱敏）。文档门禁 check:docs / doc-size（warning 0）/ orphan / standards-redundant / experience-landing / i18n:anchor / docs:check:i18n / verify-chain / lint:md / docs:build 全通过。偏差：① 实际 51 文件（43 修改 + 8 新增）/ +2303 −362（其中新文件 1143 行；预估 12-18 文件）——测试与文档占多数，按 5 个 commit 分层提交；② 为守住 standards ≤200 行窗口，§10.7-§10.9 改为紧凑列表（内容不变）。R1 审计：A Pass（8W/7S）、B Pass（3W/5S）、C Reject（2B+6W）→ 全量收口（compose 补 `LOG_LEVEL`/`LOGFILES` 转发；§10.9 去重复阈值并挂检查点矩阵；多副本 / `.gz` 竞争 / 邮箱 PII / 迁移失败同步行 / 探针名断言 / stderr 同步写 / 消息换行 / LOGFILES 白名单 / 凭据真实文件用例 / 文档数字与卷名 / gz 检索命令）。R2 审计：A Reject（新 blocker：`Error.cause` 环爆栈）+ B Pass + C Pass → 收口（Error 分支环保护 / 字段级 getter 降级 / 致命行整体兜底 / 脱敏移入 try / `[\r\n]+` 归一 / PEM 私钥块脱敏 / code 进致命行 / 调用序断言 / 白名单补 `LOG_LEVEL`/`LOGFILES`）→ R3 quick **Pass**（0 blocker；3 条非阻塞 suggest：设计稿 §7 口径同步已补、memory-logger 无本地 try（revoked Proxy 边界）、Error 块级降级不对称）。CI 首轮 push（run `40690157020`）Test 步 `check:doc-governance` 阻断：`platform.md` 30881 字符 > 30000 → 压缩 §10.9 为硬约束 + 指针、§10.8 / §10.6 去重复细节（降至 29683，阻断 0；健康线 warning 属存量）；本地补跑 CI 全量文档门禁（lint:i18n / i18n:audit:missing / check:readme-i18n / check:mergify / docs:check:fallback）。残余：① 双进程对同一 `%DATE%.log` 的跨进程轮转非严格串行（不丢行；生产压缩存在 `.gz` 覆盖写窗口），同角色多副本不受支持（audit 按角色隔离）；② 112 处 / 28 文件边界外 `console.*`（业务侧约 103 处）留待逐批迁移；③ 未跑 e2e / 视觉回归（无 UI 变更）与 Docker 冒烟（真机等价验证已覆盖文件通道）；④ `mailer` 收件人邮箱按投递审计保留原文（落文件 31 天）。
- **执行顺序 / 容量（§3.1.1）**：建议 M49.5 发布后、阶段归档前执行，不阻断 0.6.0 发布。剩余未完成 = M49.3（待推送取证）+ M49.5（发布）+ 本项；累计插队 2 批（<3 批阈值）；工作量 sandbox 594 行 + 本项 500-800 行 = 1094-1394 行，基线 1400-2430 行（下限 45% / 上限 99.6%，上限口径命中 50% 阈值）；剩余原子均为 P0 发版阻断、无可移出项 → 本项排在发布后；若窗口不足，M49 归档前移入 backlog 作为 1.0 前独立批次（恢复条件：M49.5 完成；最晚决策点：M49 归档前）。本项不占编号，不改变六原子与类型平衡；验证预算覆盖 platform 单测 / typecheck / lint / build + 文档门禁。

### 追加临时待办：发布与周回归门禁对齐（2026-10-28 用户授权，不占阶段条目编号）

- **背景**：Test run `40690157020` 因 `check:doc-governance`（`platform.md` 字符预算）失败，但 `release.yml` 与 `regression:weekly` profile 均未接该门禁——出现「Test 红但 release 仍可手动发版 / 周回归仍绿」的口径缺口（2026-10-28 发布预备检查发现）。
- **目标**：文档与治理门禁集合单点声明，Test / release / 周回归三处引用同一集合。
- **范围**：
  1. 新增 `scripts/run-doc-gates.mjs`（`DOC_GATES` 16 项 + 顺序执行 + 失败即停）与 `pnpm run gates:docs`。
  2. `release.yml` 质量门接入 `gates:docs`（替换单点 `lint:md:check`）。
  3. `regression:weekly` / `pre-release` / `phase-close` profile 用 `DOC_GATES` 生成步骤（保留逐步报告粒度）。
  4. 单测：`DOC_GATES` 唯一且覆盖 Test 步骤；发布 / 三 profile 均引用入口；失败即停语义。
  5. 文档：release.md CI 行为、`scripts/README.md`、testing.md §6.9 单点声明条款。
- **验收标准**：
  1. 本地 `pnpm run gates:docs` 16 项全通过；任一失败非零退出且停止后续。
  2. `release.yml` 含 `pnpm run gates:docs`；三个回归 profile 均含全部 `DOC_GATES` 步骤。
  3. 单测锁定两侧一致性（Test 文档步骤与集合**双向差集为空**、release 引用入口、集合名在 package.json 有对应脚本）；`check:mergify` / `check:verify-chain` 不回归。
  4. 文档门禁与 lint / typecheck 通过。
- **不做什么**：不改 Test 既有步骤粒度；不把 `pnpm test` / 覆盖率并入 `gates:docs`；不启用 release 自动触发。
- **交付物**：1 commit / 13 files（11 修改 + 2 新增）/ +344 −33。
- **依赖**：M49.3 闭环后的发布预备（用户 2026-10-28 授权）；无外部依赖。
- **风险与缓解**：release 门禁变严导致发布时红 → 本地先跑 `gates:docs` 基线；周回归时长增加 → 16 项均为轻量检查（docs:build 复用现有构建，无额外安装），基线约 5-8min。
- **执行顺序 / 容量（§3.1.1）**：M49 累计插队 3 批（sandbox / 日志通道 / 本项）→ **命中阈值 1**，须做容量评估：剩余原子仅 M49.5（P0 发布阻断）且依赖本项，无可移出项；插队工作量 sandbox 约 594 行 + 日志通道 2303 行 + 本项约 360 行 = 3257 行（已超阶段基线 1400-2430 行）；结论 = 本项与 M49.5 同属发布前置链，不拆分、不压缩验收；若发布窗口继续顺延，最晚决策点 = M49.5 启动前，届时将 E 阶段（通知可信度）候选继续留在 backlog，不新增插队批次；**恢复条件** = M49.5 发布完成 + master 连续 3 次绿。
- **P 阶段（2026-10-28）**：清点 Test 文档门禁 16 项 vs `release.yml`（0 项，仅 `lint:md:check`）与 weekly profile（4 项）→ 缺口 10-15 项；定方案 = 单点集合 + 三入口复用（不合并 Test 步骤）。
- **D 阶段（2026-10-28）**：新增 `run-doc-gates.mjs`（`DOC_GATES` 16 项，便宜静态检查在前、`docs:build` 先于 fallback；Windows 经 `cmd.exe`；runner 抛错 / 假值 / 无 status 均 fail-closed；`process.exitCode` 避免截断日志）；`gates:docs` 脚本；`release.yml` 质量门接入并替换单点 `lint:md:check`；三 profile 以 `buildDocGateSteps()` 工厂生成（weekly 21 / pre-release 22 / phase-close 22 步）；release.md / scripts README / testing §6.9 与检查点矩阵同步；`regression-weekly.yml` 超时与重复步骤注释订正。验证：本地 `gates:docs` 16 项通过；脚本单测 53 passed（双向差集、release 引用、Windows 命令、失败即停、抛错降级）；根全量 5236 passed；lint 0 error（3 存量）；`check:mergify` / `check:verify-chain` / YAML 解析通过；CI push `40699662737`（`b11ff89a`）Test success。R1 审计：A Reject（RG-A-B1 单向集合断言）+ B Reject（RG-B-B1 第三批插队未做 §3.1.1 再平衡）→ 收口（双向差集 + package.json 脚本校验、Windows 执行、容量记录与 roster、预算注释、矩阵补挂、todo 数字）→ R2 quick **A/B 均 Pass**（0 blocker；A 3 suggest、B 1 warning + 2 suggest）→ 收口（release 引用断言、profile 步骤对象按次生成、win32 注入路径用例、时长注释、移出 0 / 恢复条件、矩阵并列）→ R3 quick **Pass**（0 blocker；1 warning：`backlog.md` 越健康字符线 → 压缩两条候选归零；2 suggest：`DOC_GATE_STEPS` 符号名与矩阵 mutation 归位已修）。残余：release.yml 仍缺 prod 审计阻断与 platform 构建（既有边界，登记 backlog）。**覆盖率回补（2026-10-28）**：push 后 Codecov `codecov/patch` 在 `a6ebdca6` 判 76.47% < 83.34% —— 新脚本默认参数与 CLI 守卫未覆盖；补 `gates` 注入参数 + 默认 runner/log/error 用例（真实执行 `check:mergify`）、PATH 不可用时的默认 error 通道用例，CLI 守卫按项目惯例 `v8 ignore`；`run-doc-gates.mjs` 语句 / 行 / 函数 100%、分支 88.46%，全局 89.49 / 84.08 / 89.45 / 89.61 仍达标。**覆盖率回补 2（2026-10-29）**：发布安全门禁 `e94e3283` 的 `codecov/patch` 81.93% < 83.36% → 补 `main` / `permissionHint` / 分页失败与默认 sleep 分支用例，CLI 守卫与防御性重抛按惯例 `v8 ignore`；该脚本语句 / 行 / 函数完整、分支 94.44%。

> **下一阶段指针（不占阶段条目编号，2026-10-25 用户授权）**：1.0 发布门槛（G1-G8、P0 23 / P1 8 / 1.0 后 15+8、真实环境矩阵、批次 R/E/F1/F2/G）见 [release-1.0-readiness.md](../design/governance/release-1.0-readiness.md)。本区块只作指针，不占 M49 条目编号；批次表以台账 §5 为唯一事实源。
