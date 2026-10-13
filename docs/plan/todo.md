# 当前阶段待办

> 本文件**仅**登记当前阶段活跃待办；已闭环阶段归档于 [todo-archive.md](todo-archive.md)；未排期 / 延期 / 远期 / 长期主线 / 已知边界登记于 [backlog.md](backlog.md)。

---

## 文档位置速查

| 内容类型 | 位置 |
|:--|:--|
| 当前阶段任务 | **M44 进行中**——验证链治本 + 文档门禁可信度收口（6 原子条目，见下方 §M44） |
| 下一阶段（未授权） | 无——本阶段闭环后按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 评估 [backlog.md](backlog.md) 候选池后由用户决策 |
| 已完成阶段归档 | [todo-archive.md](todo-archive.md)（主窗口 + [archive/](archive/) 分片；M0-M43 全部已归档） |
| 未排期 / 延期 / 远期 / 长期主线 / 已知边界 | [backlog.md](backlog.md) |
| 里程碑与阶段交付 | [roadmap.md](roadmap.md)（M0-M43 已归档 + M44 进行中） |
| 历史归档索引 | [archive/index.md](archive/index.md) |

---

## M44: 验证链治本 + 文档门禁可信度收口（2026-10-14 用户决策方案 A）

> **阶段定位**：承接 M43 归档后的阶段。主线为「**对质量的承诺与实际执行之间的落差**」——同一个根因在两条线上各出现一次：① **交付侧**：修复后验证链 `DEFAULT_VERIFY_COMMANDS` 四条命令均不做类型检查，依赖升级引入的类型面破坏被判「验证通过」并交付成 PR（用户 2026-10-14 反馈 nodemailer 10.x 升级后消费方 `nodemailer.Transporter` 报 TS2503 而目标仓库 CI 失败）；② **文档侧**：`check-docs` 只校验锚点**存在**、站点 `ignoreDeadLinks: true` 使跨 locale 死链静默通过，四类「合法文本但语义漂移」缺陷长期无门禁（M41 归档「未完成项」清单即该侧的存量暴露）。两条线均为「门禁形同虚设」同族，故合并为一个阶段。
>
> **类型平衡**：🛡️ 1（M44.1）+ 🛠️ 1（M44.2）+ 📚 3（M44.3 / M44.4 / M44.6）+ 🎨 1（M44.5）= 6 原子；**🚀 能力扩展与 🧪 测试覆盖独立条目缺口显式标注**（按 [规划规范 §1.1](../standards/planning.md#11-硬性约束) 类型平衡建议的显式标注惯例；本阶段以「门禁可信度」为单一主线，能力项留 M45 候选池）。**本批未含 🚀 项的原因**：候选池内 3 项能力候选（PR Check provider 原生日志富化 / PR Check 告警关注集 / 受约束重试入口）中前两项**同域**（同一采集层与配置面）且与 M43.2 强耦合，宜作为独立批次串行推进，避免与治本项争抢验证预算。
>
> **阶段期间插队热修（不占阶段编号，2026-10-14 用户授权）**：entrypoint 双进程信号处置顺序竞态——`apps/platform/docker/entrypoint.sh` 的 TERM / INT 转发 trap 晚于「看护进程 pid」就绪行安装，落在该窗口的停止信号按默认处置直接终止 PID 1（观测方读到 signal 终止而非约定的 143 退出码，看护循环与 worker 短暂失去父进程）；2026-10-13 master push 的同 commit Coverage 与 Docker QA job 偶发红、失败 job 重跑即绿（同 runner 镜像实证，非该提交引入）。按 [规划规范 §3.1 插队例外清单第 3 类「CI 主链路阻塞」](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 处置：修复 trap 安装顺序 + fail-safe 退出、补源码顺序静态守卫与退出形态断言，规则与检查点落 [platform.md §10.6](../standards/platform.md#106-队列执行进程隔离独立-worker-进程) + [review 检查点矩阵](../../.github/skills/code-reviewer/references/code-quality-checklist.md#规范条款-review-检查点矩阵严格约束逐条挂接)；批次记录见 [archive/index.md §4](archive/index.md)。**不计入本阶段原子条目数与类型平衡**。
>
> **§3.4 三重交叉核验**：**0 项重复评估**——① `todo-archive.md` + `archive/todo-archive-phases-*.md` 全量扫描（关键词 `typecheck` / `验证链` / `锚点一致性` / `强调标记` / `design/packages` / `§49-§57` / `locale` / `字体` / `依赖表`）零命中已闭环项，唯一同族命中为 M41 归档段自身的「未完成项」清单（即本批候选来源）；② `git log` 核验无对应实现 commit（`git log --oneline -3 -- scripts/check-docs.mjs` 最近为 `d315840` 本地验证跳过产物目录 / `verify-chain` 相关无 typecheck 条目 commit / `scripts/distill-wisdom.mjs` 迁移串未改 / `docs/.vitepress/config.ts` 无 locale 兜底 commit）；③ 代码 anchor 逐项实测未闭环（详见各条目「依赖」段）。
>
> **审计 depth 预告**：M44.1（跨 engine + cli / platform + docs，预估 20-30 文件）→ **`deep`**，建议 2 分区并发（P1 引擎与默认链 + 测试 / P2 文案口径与平台同步）；M44.2（脚本 + CI 接线 + 负例标定）→ `standard`；M44.3（跨仓锚点重排 + 分片重命名）→ `standard`；M44.4（批量文档拆分）→ `standard`；M44.5（站点配置 + 构建产物验证）→ `quick`；M44.6（文档依赖表核对）→ `quick`。
>
> **建议顺序**：M44.1（治本主线，先落地以结束假绿交付）→ M44.2（门禁机检，防后续文档批次回归）→ M44.3（命名 / 编号收口，牵动锚点面应先于拆分）→ M44.4（存量拆分，量大宜在门禁就位后分批）→ M44.5（站点兜底，可并行）∥ M44.6（依赖表核对，最小的收尾项）。
>
> **条目容量**：6 原子符合 [规划规范 §1.1](../standards/planning.md#11-硬性约束) 的 5-6 项上限；**M44.1 预估 > 10 文件（命中[设计文档硬阈值](../design/governance/spec-and-doc-governance.md#24-设计文档硬阈值hard-requirement)）**，承接面经用户 2026-10-14 裁定为「沿用 `docs/design/modules/dependency-fixer.md` 验证链章节承载」；**M44.3 亦触及 > 10 文件面（全仓锚点重指）**，承接面为该文档自身的编号结构与分片命名，不新增专项设计文档；其余条目均未超单条阈值。

### M44.1 [P2 🛡️] 验证命令链纳入 `typecheck`

- **目标**：把 `pnpm typecheck` 纳入修复后验证链的**同级直接阻断**命令（与 lint / build / test 同权），消除「依赖升级引入类型面破坏 → 被判验证通过 → 交付成 PR → 目标仓库 CI 才红」的假绿交付链路。
- **优先级**：P2
- **范围**：唯一事实源 `packages/engine/src/runners/verification-runner.ts:84-89`（`DEFAULT_VERIFY_COMMANDS`）+ 同文件 `:73-83`（补「为何纳入 typecheck」实证论证 JSDoc）；测试 `src/runners/verification-runner.test.ts:782-790` / `src/app/verify-project.test.ts:64-71,120,231-232,285-309,311+` / `src/app/major-upgrade.test.ts:276`；文案与口径同步（**22-28 文件量级**，测量方：执行角色；可复现：`rg -l "install/lint/build/test|lint \+ build \+ test" --glob '!docs/plan/archive/**'`）= `packages/engine/src/{helpers/index.ts:84,ai/safety-gate.ts:3,57,ai/app-integration.ts:184,config/index.ts:124,runners/verification-gate.ts:3}` + `packages/cli/src/cli/index.ts:167` + `packages/cli/README{,.en-US}.md:63,92` + `action.yml:116` + `.github/workflows/security-auto-fix.yml:46,90` + `apps/platform/{i18n/locales/{zh-CN,en-US}.json:138-139,server/entities/repository.ts:121,server/schemas/repository.ts:41}` + `skills/dependfix-remediator/{SKILL.md:75,REFERENCES.md:51}` 与 `packages/skills/**` 镜像 + `docs/{design/modules/dependency-fixer.md:394,454,461,design/modules/dependency-grouping.md:106,design/governance/{architecture.md:179,399,481,platform-ai-integration.md:227,384,github-action-workflow.md:54,sandbox-security-governance.md:97},guide/quick-start.md:201,329,333,334}` + `docs/i18n/en-US/**` 4 处（**反向恢复**：M30.3 C84 `21bf8bb` 曾把 `lint/typecheck/build/test` 口径改为 `install/lint/build/test` 以对齐当时的实际链，本条目改为含 typecheck 的 5 段口径）。
- **验收标准**：
  - [ ] ① **默认链形态**：定向单测断言链为 5 条且顺序为 `install --frozen-lockfile → lint → build → typecheck → test`（`pnpm --filter @dependfix/engine exec vitest run src/runners/verification-runner.test.ts src/app/verify-project.test.ts`）。
  - [ ] ② **真实端到端复现**（对齐 M29.3 范式，不可用 mock 替代）：临时目录构造「`lint` / `build` / `test` 全绿、`typecheck` 红」的仓库（`"typecheck": "tsc --noEmit"` + 一处类型错误）→ verification action 失败 + `enforceVerificationGate` 触发真实 git 回滚。
  - [ ] ③ **无脚本优雅跳过**：无 `typecheck` 脚本的仓库跳过该命令并记 `SCRIPT_NOT_FOUND` 审计（不误伤未配置类型检查的仓库），基线采样与修复后验证**同口径**。
  - [ ] ④ **既有失败豁免**：修复前即红的 `typecheck` 在修复后仍红时记 `PRE_EXISTING_FAILURE`、不归因本次改动、门禁不据此回滚。
  - [ ] ⑤ **口径同步全净**：`rg -n "install/lint/build/test|lint/typecheck/build/test" --glob '!docs/plan/archive/**'` 命中清单逐条复核为已同步或历史叙述；`pnpm lint` / `pnpm typecheck` / `pnpm test:coverage` / `pnpm run check:docs` / `pnpm run lint:md:check` 全绿。
- **不做什么**：不改 `quickVerifyProject`（保留 lint-only 的组级快速信号）；不做脚本名探测（`typecheck` / `type-check` / `tsc` 三选一自动识别）；不做「非阻断观察期」机制；不从目标仓库 CI workflow 反推验证链（另立候选）；不在默认链注入 `nuxt prepare`（沿用 `--commands` / 平台 `verifyCommands` / action `commands` 逃生舱，见 [经验归档 §三十六](../design/governance/experience-archive-§36-§40-toolchain.md)）；不改单命令超时（10 分钟）与 install 命令的 corepack 版本替换语义。
- **依赖**：用户 2026-10-14 反馈（nodemailer 10.x 事故）；先例 M29.3「验证链纳入 test」（同一唯一事实源口径 + 7 commits）；**顺序硬约束的实测依据**——移出 `packages/{core,engine,cli}/dist` 后 `pnpm --filter @dependfix/platform typecheck` exit 2 + 大量 `TS2307 Cannot find module '@dependfix/core'`，故 typecheck 必须在 build 之后；**承载面经用户裁定**为 [dependency-fixer.md](../design/modules/dependency-fixer.md) 验证链章节（该文档现 471 行，处 warning 带）。
- **交付物**：预计 4-6 commits——① `feat(engine)` 默认链 + JSDoc 论证；② `test(engine)` 断言与端到端复现用例；③ `docs` 文案 sweep（含 C84 反向恢复 4 文件 8 处 + 模块设计章节）；④ `docs(plan)` 闭环登记。预计 20-30 文件 / 250-450 行（以文案为主）。
- **风险与缓解**：**R1 目标仓库 `typecheck` 脚本长期红**——既有命令级基线豁免覆盖，但**基线为前缀覆盖**（`runVerification` 首失败即停），lint / build 先红会遮蔽 typecheck 采样 → 保守归因本次 → 误回滚；缓解：基线限制随本条目登记为已知边界，且 typecheck 置于 test 之前以最大化基线采样率。**R2 脚本语义不实**（`typecheck: tsc --noEmit || true`）无法机检；缓解：登记已知边界。**R3 需 `nuxt prepare` 的仓库默认链不成立面扩大**；缓解：逃生舱 + 文档显式登记。**R4 耗时上升**；缓解：单命令超时 10 min 与平台 `EXECUTION_TIMEOUT_MS`（默认 30 min）不变，列入观察项。**R5 漏改同源文案**；缓解：AC ⑤ 的结构化复扫 + 双语镜像单独扫（[规划规范 §4.4 第 13 条](../standards/planning.md#44-大批量归档批次操作规范)）。

### M44.2 [P3 🛠️] 文档门禁机检缺口收敛（四类「合法文本但语义漂移」）

- **目标**：把四类当前**静默通过**的文档缺陷变为 CI 可阻断的机检项——链接文本章节号与目标锚点不一致、VitePress 站点绝对链接（nav / sidebar / 首页卡片）死链、未成对 `](` 的畸形链接、强调标记（`**`）未配对破损。
- **优先级**：P3
- **范围**：`scripts/check-docs.mjs`（新增「链接文本 `§N` ↔ 目标锚点所属章节编号」一致性断言；补「未成对 `](` / `)` 计数」检测）+ 新增或扩展站点链接校验（`docs/.vitepress/config.ts` 的 nav / sidebar / 首页 frontmatter `link:` 面）+ 强调标记配对检测（渲染级）+ **`docs/plan/archive/**` 的 anchor 子集校验**（见下 AC ②）+ 负例标定（在目标文件植入缺陷 → exit 1 → 还原）+ `package.json` scripts + `.github/workflows/test.yml`（静态检查簇接线，置于 `docs:build` 之前）+ 规范一行引用（[documentation.md §3](../standards/documentation.md)、[ai-collaboration.md](../standards/ai-collaboration.md)）。
- **验收标准**：
  - [ ] ① **四类负例标定**：每类各植入 1 个最小负例 → 对应脚本 exit 1 且输出 `文件:行:明细`；还原后 exit 0（正例无误报）。
  - [ ] ② **正例零误报 + 豁免面显式化**：全仓现行文档跑通 exit 0；豁免面必须以显式清单 + 理由声明——`docs/plan/archive/**` 现由 `scripts/shared/md-walk.mjs:20-35` 整体豁免（理由已登记：归档动作会让历史相对链接指向预期外的位置，统一扫描会在每次归档批次误红 CI，存量约 98 处 file-dead 属独立修复批次），故本条目**只对 archive/ 启用 anchor 子集校验**（自锚点 + 跨文档锚点，含 `archive/index.md` 的 §5 表格链接；file-dead 维持豁免），并把该边界写入规范一行引用。
  - [ ] ③ **复合形态覆盖**：`§5.1.x` / 中文数字（`§五十六`）↔ 阿拉伯数字、双语镜像站点的链接文本形态均有断言或显式白名单说明。
  - [ ] ④ **CI 接线**：`pnpm run check:docs`（含新增断言 + archive anchor 子集）与站点链接校验在 Test job 静态检查簇内执行，本地与 CI 同口径；`pnpm run docs:build` 仍 exit 0。
- **不做什么**：不做外链（`http(s)`）存活检查（需网络，另立项）；不改变 `ignoreDeadLinks: true` 的既有宽松策略（改为独立校验面，不动站点构建行为）；不做文档全文渲染级校验（仅强调标记配对）；不引入新依赖（复用现有零依赖脚本形态）。
- **依赖**：M41 归档「未完成项」清单 ①（链接文本一致性机检，本次实测曾命中 2 处）+ 候选 `architecture.md` 畸形 markdown 链接（未成对 `](`）+ 候选「文档中的『字面强调标记』存量破损（实测 `archive/index.md` 七处 + `roadmap.md` 一处为存量）」；**代码 anchor**：`scripts/check-docs.mjs:131-169` 仅校验锚点**存在性**（`titles.has(normAnchor(anchor))`），不比对链接文本；`docs/.vitepress/config.ts:147` `ignoreDeadLinks: true`；`scripts/shared/md-walk.mjs:20-35` 记录 `docs/plan/archive/**` 豁免理由。**规划批次实测的活体实例**（M44 规划批次 A 阶段审计发现，随本条目一并修）：`archive/index.md:92`（M43 归档行）跨文档锚点与 `roadmap.md` H2 实际形式不匹配的存量死锚；该发现同时佐证 AC ② 的 archive anchor 子集校验必要性。
- **交付物**：预计 3-4 commits——① `feat(scripts)` 四类检测 + 负例标定；② `ci` 接线 + 存量清理（命中项逐条修）；③ `docs(standards)` 一行引用 + 闭环登记。预计 6-10 文件 / 250-450 行。
- **风险与缓解**：**R1 误报面失控**（中文数字 / 复合编号 / 引用性文本）→ 采用「可机检子集 + 显式白名单」而非全量猜测，白名单条目须带理由；**R2 站点链接面解析遗漏**（主题内建 locale 菜单等运行时生成的链接脚本看不到）→ 以构建产物抽样对照（`dist/**/*.html` 内链接集合 vs 校验面）并在规范声明覆盖边界；**R3 存量清理触碰归档文档**→ 按 [规划规范 §4.4](../standards/planning.md#44-大批量归档批次操作规范) 操作（anchor 实证 + 跨文件外链追踪）。

### M44.3 [P3 📚] 文档口径与命名一致性收口

- **目标**：清掉三处「旧路径 / 旧编号 / 旧命名」的存量不一致，使「目录名 - 文件 H1 - 章节编号 - 分片文件名」四者互相对齐且可机检。
- **优先级**：P3
- **范围**：① `scripts/distill-wisdom.mjs:61` 迁移目标推荐串仍写 `docs/design/packages/`（蒸馏输出会把落点指向已不存在目录）；② `docs/design/governance/docs-and-readme-i18n.md:123` 现行陈述用旧目录名 `design/packages/*`；③ `docs/design/modules/index.md:1` H1 仍为「模块设计（packages）」（实际目录为 `design/modules/`，该 H1 不被目录名字面 pattern 命中，须单独扫）；④ `docs/standards/ai-collaboration.md` 跨段重复编号——`## 1.4`–`## 1.7`（L82/91/99/109）位于 `## 2. PDTFC+ 工作流`（L58）**之后**（跨段错位），且与 `### 1.4` / `### 1.5`（L47/53）编号重复；`## 2.1` / `## 2.2`（L119/130）编号与 §2 自洽，但被上述错位块与 `## 3. 安全红线`（L147）夹住，重排时需一并归位；⑤ `docs/design/governance/experience-archive-§49-§57-recent-investigation.md` 文件名与内容范围不符（H1 实为「§四十九 - §六十八」）。
- **验收标准**：
  - [ ] ① `rg -n "design/packages" --glob '!docs/plan/archive/**'` 命中仅剩**历史叙述段**（`spec-and-doc-governance.md:43` 问题记录 + `todo-archive.md` M41 归档描述），逐条在条目闭环记录中列明并声明不改为「历史叙述」的理由。
  - [ ] ② `rg -n "^## |^### 1\.[0-9]" docs/standards/ai-collaboration.md` 编号唯一、无跨段重复、顺序连续；全仓引用该文件旧编号锚点的链接同批更新（`rg -n "ai-collaboration.md#1\.[4-7]" docs/ .github/`）。
  - [ ] ③ 分片文件名与 H1 范围一致，且全仓外链重指（`rg -n "§49-§57|experience-archive-§49" docs/ .github/ scripts/ | cat` 逐条核对）；改名按 [规划规范 §4.4 第 2 / 3 / 6 / 7 条](../standards/planning.md#44-大批量归档批次操作规范) 先列落点清单再改。
  - [ ] ④ `pnpm run check:docs` exit 0（151 links / 87 vue-interp 面零 error）+ `pnpm run lint:md:check` 通过 + `pnpm run check:doc-size` 无新增 warning（`ai-collaboration.md` 现 200 行（`wc -l`），重排后仍 ≤ 200 或显式登记）。
- **不做什么**：不改 standards 的规则语义（仅编号 / 标题 / 路径口径）；不删除历史归档叙述与问题记录段（`spec-and-doc-governance.md:43` 为历史问题记录，保留）；不动 `check-orphan-ids` 真常量白名单与其正则；不合并或拆分 `ai-collaboration.md` 的内容块（仅重排编号）。
- **依赖**：M41 归档「未完成项」清单 ②⑤⑥；**反向核验的实证依据**（可复现：`rg -n "design/packages" --glob '!docs/plan/archive/**'`）——现行引用 **2** 处（`scripts/distill-wisdom.mjs:61` + `docs/design/governance/docs-and-readme-i18n.md:123`）+ 历史记录 **2** 处（`spec-and-doc-governance.md:43` + `todo-archive.md:165`，保留不改）+ 目录名字面 pattern **不命中**的 H1 **1** 处（`docs/design/modules/index.md:1`，须单独扫）；`spec-and-doc-governance.md:43` 称「7 处未同步」为 2026-09-08 的历史快照，须以当前实测为准逐条判定。
- **交付物**：预计 3 commits——① `docs(governance+modules)` 旧路径与 H1 收口；② `refactor(standards)` `ai-collaboration.md` 编号重排 + 全仓锚点重指；③ `docs` 分片重命名 + 外链重指 + 闭环登记。预计 8-14 文件 / 150-350 行。
- **风险与缓解**：**R1 编号重排打破既有外链锚点**（该文件被 AGENTS.md / skills / agents / 多个 design 文档引用）→ 改前 `rg` 全仓落点清单、改后 `pnpm run check:docs` 兜底 + 明文列更新清单；**R2 分片重命名牵动跨目录相对路径**→ 严格按 §4.4 第 3 条（old 片段从路径字符起写、改后 malformed 检测 `rg -n "\[[^]\n]*\((\.\.?/|/)"` 0 命中）；**R3 与 M44.4 拆分批次互相踩踏**→ 本条目先行，M44.4 在本条目闭环后再动 `design/modules` 与 `design/governance` 内文件。

### M44.4 [P3 📚] 设计文档存量超健康窗口分批拆分

- **目标**：把处在 warning 带与强制分片线之上的文档按内容逻辑分批拆到健康窗口内，避免继续增长直接触「强制分片」线，并让索引 / 入口在拆分后保持可用。
- **优先级**：P3
- **范围**：以 `pnpm run check-doc-size` 输出为准（**13 个 warning 文件 + 1 个豁免文件**，测量方：执行角色；实测命令见「验收标准」④）——`docs/design/modules/{dependabot-fetcher, dependency-fixer, github-client, pnpm-lockfile-fixer, report-generator}.md`（>300）+ `docs/design/governance/{architecture, c22-pat-backward-compat, docs-and-readme-i18n, executor-sandbox, platform-ai-integration, platform-scheduled-batch}.md`（>400）+ `docs/plan/{roadmap,todo-archive}.md` + 豁免项 `docs/design/governance/caomei-ui-migration.md`（940 行）。
- **验收标准**：
  - [ ] ① **量级下降**：warning 带文件数由 13 降至 ≤ 6（测量方：执行角色，命令 `node scripts/check-doc-size.mjs`）；超阈值（强制分片）仍为 0。
  - [ ] ② **单批可独立验证**：每个拆分批次单独验收（拆分后目标文件 ≤ 阈值 + 主文档保留索引 / 入口指针 + `pnpm run check:docs` exit 0）。
  - [ ] ③ **信息不丢**：拆分保留原始层级与状态；按 [规划规范 §4.4 第 9 条](../standards/planning.md#44-大批量归档批次操作规范) 区分「可删除的已归档内容」与「必须保留的必要信息」。
  - [ ] ④ **规划文档拆分与归档协同**：`roadmap.md` / `todo-archive.md` 的拆分须与阶段归档批次协同（不产生二次改动）；拆分后归档批次登记与 `archive/index.md` 索引同步。
- **不做什么**：不缩小计量面、不新增豁免表条目（存量豁免已逐条登记）；不删除历史信息与既有实证数据；不在单批次内一次拆完全部 13 个文件（分批，每批独立验收 + 独立审计）；不改 `caomei-ui-migration.md §15` 迁移实证的时序（保序拆分）。
- **依赖**：M41.5「阈值与事实源唯一化」（`docs/standards/documentation.md §3` 为唯一权威阈值表 + `check-doc-size` 计量脚本）；M41 归档「未完成项」清单 ④（存量超健康窗口）；M44.3 先行（旧路径 / H1 / 分片命名收口后再拆，避免拆完再改名）。
- **交付物**：预计 3-5 commits（按目标文件分组成 3 批）——① `design/modules` 5 文件；② `design/governance` 6 文件；③ `plan/roadmap` + `plan/todo-archive` + 豁免项方案 + 闭环登记。预计 15-25 文件 / 净减 ≥ 600 行（拆分为分片迁移，非删除）。
- **风险与缓解**：**R1 拆分牵动大量外链与锚点**→ 每批先 `rg` 落点清单（§4.4 第 2 / 3 / 6 / 10 条）+ 改后 `pnpm run check:docs` 兜底；**R2 拆分后读者入口丢失**→ AC ② 强制「主文档保留索引 / 入口」；**R3 与 M44.2 门禁未就位时批量改动会引入新破损**→ 建议顺序上 M44.2 先行（门禁就位后再拆）。

### M44.5 [P3 🎨] 站点语言切换器未翻译页 404 兜底

- **目标**：消除「点击 English 落到 404」的站点体验缺陷——VitePress 内建语言菜单按「当前路径 → 目标 locale 同路径」映射，对无 en 译文的页面（`plan/roadmap.md` / `plan/todo.md` / `standards/*` / `design/modules/*` 等）生成不存在的 `/en-US/<同路径>` 链接。
- **优先级**：P3
- **范围**：`docs/.vitepress/config.ts`（locale 菜单行为面）+ 兜底策略实现（D 阶段定稿三选一：① 未翻译页 locale 兜底页 / 重定向；② 接受现状并在 [i18n.md](../standards/i18n.md) 显式声明为已知行为；③ 生成占位译文页）+ `docs/i18n/en-US/**` 结构 + 构建产物抽样断言。
- **验收标准**：
  - [ ] ① **选型落地**：D 阶段在三个候选中定稿并记录理由（含对 sitemap / 站内搜索的影响评估）。
  - [ ] ② **行为达标**（选 ① 或 ③ 时）：未翻译页点 English 不再落 404——以构建产物抽样断言（如 `dist/plan/roadmap.html` 不再含指向不存在 en 页的链接，或存在可用兜底目标），抽样页清单写进条目闭环记录。
  - [ ] ③ **导航面回归**：nav / sidebar 的语言项与既有入口行为不变（导航面已在 M41.4 收敛为仅指向真实页面，不得回退）。
  - [ ] ④ `pnpm --filter dependfix-docs build` exit 0 + `pnpm run check:docs` exit 0。
- **不做什么**：不做全量 en 翻译（未翻译页清单与翻译批次另立项）；不改 `ignoreDeadLinks: true`（站点构建策略不变）；不引入外部依赖；若选 ③，占位页不得进入站内搜索与导航（需 noindex / 排除配置）。
- **依赖**：M41 归档「未完成项」清单 ③（本次实测：`docs/.vitepress/config.ts:147` `ignoreDeadLinks: true`，故构建不报错；`locales` 配置见 `config.ts:158-190`）；M41.4 导航分层已收敛导航面，本项为**剩余唯一非导航面死链来源**。
- **交付物**：预计 2-3 commits——① `feat(docs)` 兜底策略实现 + 配置；② 产物抽样断言 / 文档（i18n.md 声明或兜底页说明）+ 闭环登记。预计 3-8 文件 / 80-250 行。
- **风险与缓解**：**R1 主题层覆写 locale 菜单耦合 VitePress 内部实现**（升级易碎）→ 优先级排序为「兜底页 / 重定向」优于「主题覆写」；**R2 兜底页污染搜索与 sitemap**→ AC ④ 强制排除或 noindex；**R3 选「接受现状」时体验缺陷仍在**→ 必须在 i18n.md 显式声明为已知行为并登记 backlog 观察项，不得静默保留。

### M44.6 [P3 📚] `tech-stack` 平台依赖表行级一致性

- **目标**：让 `docs/guide/tech-stack.md` 的平台依赖表与 `apps/platform/package.json` / `nuxt.config.ts` 逐行对应，消除「文档声明存在但代码无引用」与「版本口径不一致」两类漂移。
- **优先级**：P3
- **范围**：`docs/guide/tech-stack.md:37,39,40,41`（`@lucide/vue` 文档写 `^1.48` 而 `apps/platform/package.json:44` 为 `^1.53.0`；`@vueuse/core` / `@vueuse/nuxt` / `@sentry/nuxt` / `@vite-pwa/nuxt` 四行声明在 `package.json` 与 `nuxt.config.ts` 模块列表中无对应）+ en-US 镜像 `docs/i18n/en-US/guide/tech-stack.md` + 表格口径决策（是否统一为「不写具体版本号，指向 `package.json`」）。
- **验收标准**：
  - [ ] ① **逐行核对清单**：表中每一行的「依赖名 → 引用位置」对照（引用位置取值：`package.json` / `nuxt.config.ts` / 源码 import）清单落进条目闭环记录，第三方可凭清单复现核对。
  - [ ] ② **无引用行处置**：确认无引用的行**删除**（避免模板期占位残留）；若确为规划中能力，则补声明到 `package.json`（需在条目内说明依据）。
  - [ ] ③ **版本口径**：`@lucide/vue` 等版本不一致行同步为准确值，或按 D 阶段选型统一为「不写具体版本号 + 指向 `package.json`」。
  - [ ] ④ **双语与门禁**：en-US 镜像同步；`pnpm run docs:check:i18n` / `pnpm run check:docs` / `pnpm run lint:md:check` 通过。
- **不做什么**：不做依赖实际升级或降级（仅文档口径）；不为「规划中能力」新增未确认的运行时依赖；不改 `apps/platform/package.json` 中已正确声明的依赖版本。
- **依赖**：候选来源为 M43 归档前后的审计与复核衍生项（登记为「tech-stack 平台依赖表与 `apps/platform/package.json` 行级不一致」）；**实证**：`rg -n "pinia|@vueuse/core|@sentry/nuxt|@vite-pwa/nuxt" apps/platform/package.json` 零命中，`rg -n "@lucide/vue" apps/platform/package.json` 命中 `^1.53.0`；`docs/guide/tech-stack.md` 由 M40.6「平台环境变量文档完整性治理」批次同源形成。
- **交付物**：预计 1-2 commits——① `docs(guide)` 表格逐行修正 + 双语同步；② 闭环登记（如需补声明则另计 `chore(platform)` commit）。预计 3-5 文件 / 40-120 行。
- **风险与缓解**：**R1 误删「规划中能力」行**→ 删除前对每行 `rg` 全仓引用（`package.json` / `nuxt.config.ts` / `apps/platform/**` 源码）+ 清单留痕；**R2 补声明引入新依赖风险**→ 仅在能给出实际引用点时才补，否则按删除处置；**R3 表格口径反复**→ D 阶段先定「是否写版本号」的单一口径，避免后续再次漂移。
