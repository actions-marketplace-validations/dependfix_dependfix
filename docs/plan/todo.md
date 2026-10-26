# 当前阶段待办

> 本文件**仅**登记当前阶段活跃待办；已闭环阶段归档于 [todo-archive.md](todo-archive.md)；未排期 / 延期 / 远期 / 长期主线 / 已知边界登记于 [backlog.md](backlog.md)。

---

## 文档位置速查

| 内容类型 | 位置 |
|:--|:--|
| 当前阶段任务 | **M49：0.6.0 发版清障**（2026-10-25 用户决策；六原子见下） |
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
- **D 阶段（2026-10-27）**：`test.yml` 拆分全量信号 + prod 阻断（阻断无 `|| true`）；`security:audit-deps` 同步阻断命令；`security.md §5.6` 改写为转正后判据（阻断 exit 0、ignored 不参与阻断、统计命令改为查步骤 conclusion），§5.7 / §5.8 / §5.2 指针同步；`pnpm-workspace.yaml` audit.ignore 注释记录转正后仍保留；检查点矩阵新增 §5.6 行；readiness G1 改 ◐ 并登记阻断已上线、run id 待回填；backlog 记录转正。验证：YAML 解析通过；`check:verify-chain` 通过；registry 故障 + flag exit 0 / 无 flag exit 1；临时 `lodash@4.17.20` + flag exit 1；`pnpm run security:audit-deps` 在 registry 故障下按设计 exit 0（真实 clean 审计待 CI）；`lint:md` / `check:docs` / `docs:build` / `i18n:check:anchor` / `lint` / `typecheck` 通过。审计 R1 deep Reject（RG-B01：三处「翻转前 3 次 clean」时序声明与「先翻转」互斥）→ 全收口：三处改「先翻转、后取证」、§5.6 明确原条件未达成 → 按 §5.7 修订通道转正、判据补「日志含审计结果行」防 registry 假绿、checklist ③/⑤ 与 G1 ④ 同步、backlog 登记假绿加固候选；R2 quick Pass（0B/0W；RG-W04/W05/W06 + S04 已修）。残余：3 次 `master` push Test run id 与 1 次 Weekly Regression run 待推送后回填；回填前 M49.3 不闭环。

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

> **追加临时待办（不占阶段条目编号，2026-10-25 用户授权）**：1.0 发布门槛（G1-G8、P0 23 / P1 8 / 1.0 后 15+8、真实环境矩阵、批次 R/E/F1/F2/G）见 [release-1.0-readiness.md](../design/governance/release-1.0-readiness.md)。本区块只作指针，不占 M49 条目编号；批次表以台账 §5 为唯一事实源。
