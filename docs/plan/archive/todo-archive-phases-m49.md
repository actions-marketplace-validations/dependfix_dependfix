# 待办归档分片：M49 0.6.0 发版清障

> 本分片由 2026-10-29 M49 阶段归档批次从 [todo.md](../todo.md) 迁出；正文按归档口径压缩（目标 / 落地 / 审计 / 证据 / 边界），相对链接按新位置重指。

---

## M49: 0.6.0 发版清障（2026-10-25 用户决策 / 2026-10-29 归档）

> **归档摘要**：6 原子条目（🛡️ 4 + 📚 1 + 🚀 1）+ 阶段期间 **3 批**追加临时待办（sandbox 入口临时关闭 / 平台本地日志通道统一 / 发布与周回归门禁对齐，均不占条目编号）。阶段窗口首父链 **58 commits**（区间含 1 个本地未推送修复 `8fd83fc3`；M49 原子 24 + 追加临时待办 16 + 立项 2 + 文档治理 3 + 依赖巡检 13；`git log --first-parent --oneline 1d8997ce..8fd83fc3` 去重统计），阶段基线 **10-16 commits / 28-41 文件 / 1400-2430 行**，唯一 diff 实测 **185 文件 / +9919 −3485**（`git diff --shortstat 1d8997ce..8fd83fc3`，含 lockfile / CHANGELOG 与依赖巡检）——files 约 4.5-6.6 倍、行约 4-7 倍，主因是三个追加批次（日志通道约 2300 行）与发布工具链。

> **证据来源**：各条目数字取自 `artifacts/m49.*`（gitignored）与 `.session/runtime-state.json` §`m49_plan` / `m49_log_unify` / `gate_alignment`；发布事实以 npm registry / `gh release` / git tag / Actions run 为准，归档时逐项复核。

### M49.1 [P0 🛡️] 自产 code-scanning 告警清零（**已闭环** `43bad2cc` + `a71a3cb3` + `108e38f3` + `db0c6f0f`）

- **目标**：关闭仓库 2 条自产 code scanning 告警，且不改变既有清洗 / 解析语义。
- **落地**：`js/incomplete-sanitization`——抽出共享 `escapeTableCell`（**先反斜杠后竖线**，否则输入自带 `\|` 会拆列）+ 失败评论 URL 竖线按 `%7C` 编码 + 用例；`js/polynomial-redos`——marker 解析改为单遍线性扫描（`indexOf` + 单调缓存下一个 `>`），差分 fuzz 4000 轮逐字一致、100KB 恶意输入 < 50ms + 边界用例。
- **审计**：R1 standard Pass（3W + 1S）→ 全收口 → R2 quick Pass；mutation 5/5。
- **证据**：engine 定向与根全量 5127 passed；复扫 analysis `2026499469`（`108e38f3`，2026-10-26T10:30:53Z）`#28` / `#29` 均 `fixed`、open 0 条；基线 `artifacts/m49.1/code-scanning-baseline.txt`。
- **边界**：不改 marker 格式与归因规则；`sanitizeCheckName` 展示语义不变（仅补转义）。

### M49.2a [P0 🛡️] 依赖漏洞清零 A：critical / high（**已闭环** `29c4ace2` + `c58c4685` + `99cbbff8`）

- **目标**：Dependabot 开放 critical / high（未被 §5.7 豁免）清零；全量审计 critical / high 归零。
- **落地**：overrides 升级 `handlebars ^4.7.10` / `body-parser ^2.4.0` / `undici ^8.12.2`（锁 8.12.3）/ `launch-editor ^2.14.2` / `vitepress>vite ^6.4.4` / `qs ^6.16.1`；删除无消费者的 `vite@5` 死覆盖；braces 豁免随 advisory 撤回移除、node-forge 保持豁免；lockfile 仅目标包 + `qs` / `on-finished`。
- **审计**：R1 Reject（`qs` 被压回 6.16.0——overrides 替换解析范围，声明低于下游要求时会被压回；2026-10-30 订正口径见 [development.md §5.1.56](../../standards/development.md)）→ 全收口 → R2 quick Pass。
- **证据**：audit 基线 2 critical + 5 high → 非豁免 0；推送后 Dependabot 6 条可修复项均 fixed（2026-10-26T11:32:57Z–11:33:01Z）；`--frozen-lockfile` 通过；证据 `artifacts/m49.2a/`。
- **边界**：不用 `--ignore` / `--ignore-unfixable`；不跨大版本强升；platform moderate 归 2b。

### M49.2b [P0 🛡️] 依赖漏洞清零 B：platform 链 moderate 收口（**已闭环** `9a95ba21` + `e0504def` + `cc7452c8` + `fb49fcae`）

- **目标**：platform 链 moderate 收敛，发布物剩余风险可解释。
- **落地**：`nuxt` / `@nuxt/nitro-server` 4.5.2→4.6.2、`vitest` 4.1.11→4.1.12、overrides `ip-address ^10.7.4` / `fast-uri@3 ^3.1.9` / `serialize-javascript ^7.1.3`；Nuxt 4.6 项目配置拆分后 `.nuxt/tsconfig.json` exclude `server/**/*`，`apps/platform/tsconfig.json` 覆盖 exclude 恢复 server 深层目录 type-aware lint。
- **审计**：P 阶段锁定 **N = 0**（全部 4.x 内 minor / patch，无 major）；D 阶段全量 / prod audit 0 条 advisory。
- **证据**：Dependabot 8 medium + 4 low 于 2026-10-26T12:41Z 全部关闭；platform 单测 2164 passed、e2e 两轮与视觉 17 passed；全量 5127 passed；build 通过；lockfile diff 复核仅目标包。
- **边界**：Nuxt 4.6.2 自带的 transitive major（`@nuxt/cli` 4 / cssnano 9 / unimport 7 / srvx 1）与 4.5.2 并存，由 build / e2e / visual 覆盖；Docker 镜像验证归 M49.5。

### M49.3 [P0 🛡️] Security 门禁转正（**已闭环** `f7b7c604` + `84615ce2` + `733d6720` + `b11ff89a`）

- **目标**：让风险依赖无法进入 master；周回归恢复绿色。
- **落地**：`test.yml` 拆分全量信号 + **prod 阻断**（无 `|| true`）；`security:audit-deps` 同步阻断命令；`security.md §5.6` 改写为转正后判据（阻断 exit 0、ignored 不参与阻断、判据 = 步骤 conclusion + 日志含审计结果行），§5.7 / §5.8 / §5.2 指针同步；检查点矩阵新增行；readiness G1 改 ◐。
- **关键判据**：显式 `--registry=https://registry.npmjs.org` 是必要的——镜像无 audit endpoint 时 `--ignore-registry-errors` 会把「endpoint 不存在」当故障并 exit 0，门禁静默失效；因此判据不能只看 exit 0。
- **审计**：R1 deep Reject（「翻转前 3 次 clean」与「先翻转」时序互斥）→ 全收口 → R2 quick Pass。
- **证据**：翻转后 3 次 master push 的阻断步骤 success 且含结果行 `40372808067` / `40466448172` / `40690157020`；周回归 `40693124400` success（artifact Pass / blocker 0 / warning 0）。首跑 `40431203719` 因回归窗口文件缺失 ENOENT 失败，由 `db2f97b9` 自动初始化修复。
- **边界**：node-forge 仍按 §5.7 豁免（latest 1.4.0 无修复版本）；G1 ④ 的「周回归最近 3 次」属 1.0 口径，本阶段只要求 1 次。

### M49.4 [P0 📚] 发版面文档漂移收口（**已闭环** `858c2156` + `dfb9ab24` + `6416a922` + `04e44285`）

- **目标**：用户可见文档与实现一致，避免 0.6.0 带着错误指引发布。
- **落地**：6 处基线对齐（AI 输入名 / M5 遗留 / MCP tool 数 / 设计索引 3 行）；额外发现同批收口——`packages/mcp` README 缺 `pnpm_audit` 与 `discover_repos.max_repos`、`mcp-server.md` 仍写 4 个 tool；执行器状态收窄为「设计已落地（M10 隔离基础设施 + M38 执行进程隔离），沙箱内真实引擎执行为占位」；`quick-start` 增加 sandbox 占位限制提示；Action 示例版本引用对齐当时已发布的 `v0.5.0`。
- **审计**：R1 Reject（`pnpm_audit` token 声明与实现冲突、sandbox 状态过度）→ 全收口 → R2 quick Pass（0B / 0W）。
- **证据**：`check:docs` / `check:readme-i18n` / `i18n:check:anchor` / `docs:check:i18n` / `lint:md:check` / `docs:build` 全通过；`packages/mcp` 单测 47 passed；lint 0 error（4 存量 warning）；typecheck 通过。
- **边界**：不做 en-US 全量平价（F2）；不改实现。

### M49.5 [P0 🚀] 0.6.0 版本提升、发布与发布后验证（**已闭环** `e94e3283` + `a17b1a87` + `16ba97c5` + `efaa555f` + `8fd83fc3`）

- **目标**：发布 0.6.0 并验证发布物可用、可安装、可回滚。
- **落地**：
  1. **发布前安全告警门禁**：新增 `scripts/check-release-security-alerts.mjs`（Dependabot + Code Scanning 按级别判定，critical 含 dismissed 一律阻断，high 需台账豁免，Code Scanning 按实例 `location` 登记）+ 覆盖率回补；`release.yml` 在版本提升前预检、发布前阻断；token 按来源分离（Dependabot 用 `GH_PAT`，Code Scanning 用 Actions token）；`security.md §5.9` / 发布指南 / 检查点矩阵 / 设计稿 / AGENTS 同步。
  2. **发布工具链修复**：`release-publish` 固定官方 registry（不继承本机镜像配置）+ `--otp` 透传 + `execFileSync` 数组参数 + 未知参数 fail-closed；CHANGELOG 在「无包内可渲染 commit、无依赖变化但版本已提升」时生成「运行时基线更新」段（修复 engines-only 提升导致 `verify:changelog` 阻断）。
  3. **版本提升**：`core` / `dependfix` 0.6.0、`engine` 0.5.0、`mcp` / `skills` 0.3.0、`platform` 0.4.0；根与各包 CHANGELOG 重生成。
  4. **发布执行**：走**本地备用通道** `pnpm release:publish --otp`（`release.yml` OIDC 通道本批未触发）；7 个 tag（`v0.6.0` + 6 个包 tag，platform 为 tag-only）于 2026-10-28T18:23:43Z 创建；npm 5 包发布 18:24:16Z–18:25:00Z；GitHub Release `v0.6.0` 同步生成（含发布包清单 + 根 CHANGELOG）。
  5. **发布后缺陷修复**：`npx dependfix@0.6.0 --version` 实测报 `0.1.0`（`meta.version` 硬编码）→ `8fd83fc3` 改为读 `package.json`（发布产物 `../package.json` / 源码 `../../package.json`，按包名校验，兜底 `0.0.0-unknown`）+ 版本一致性用例；该修复本地待推送，随 0.6.1 发布。
- **验收**：
  1. ✅ 5 个 npm 包发布成功（`dependfix` 0.6.0 / `core` 0.6.0 / `engine` 0.5.0 / `mcp` 0.3.0 / `skills` 0.3.0），platform tag `@dependfix/platform@0.4.0` 创建。
  2. ◐ `dependfix report-only --help` 正常且命令面完整；`--version` **未达标**（报 0.1.0，修复已提交未发布）。
  3. ◐ Docker `workflow_dispatch` `40745976335`（`platform_version=0.4.0`）QA 与 smoke 步骤 success（哨兵 build-arg → `/api/health` 端到端），多架构推送执行中；归档时 `updatedAt` 停滞于 18:35:56Z（疑似挂起），`platform-0.4.0` tag 与镜像内 health 200 需 cancel + rerun 或收尾后复核。
  4. ✅ 根 + 5 个发布包（`core` / `engine` / `mcp` / `skills` / `platform`）CHANGELOG 均含当前版本段；GitHub Release notes 正确。
  5. ❌ 发布后 master 连续 3 次绿仅完成 **1 次**（`40744772890` Test success，E2E / Coverage / Visual 同时 success）；本地 ahead 提交推送后开始累计，作为 1.0 G4 窗口起点。
- **证据**：`npm view <pkg> version` / `time`；`gh release view v0.6.0`；`git tag --list`（7 个 tag，按 taggerdate 2026-10-29T02:23+08:00 过滤）；`npx dependfix@0.6.0 --version`（0.1.0）与 `report-only --help`；`vitest run packages/cli/src/cli/runner.test.ts` 8 passed；`tsc --noEmit -p packages/cli/tsconfig.json` exit 0。
- **边界与残余**（已登记 backlog）：本地备用通道不执行 `check:release-security`（门禁仅接在 `release.yml`）；0.6.0 发布物 `--version` 错误随 0.6.1 修复；3 连绿窗口未完成；Docker `platform-0.4.0` 镜像的 health 复核待 run 收尾。

### 追加临时待办：sandbox 入口临时关闭（2026-10-27 用户授权，不占编号；**已闭环** `dc66d221` + `83b53394` + `3ed2fd8e` + `ffce6543`）

- **背景**：A 阶段实测 `SandboxExecutor.buildCmd` 仍为最小占位（回显 `RunResult`，不启动引擎），UI 仍暴露 sandbox 选项；rootless Docker 可用时选择 sandbox 会返回 0 告警的假成功。用户裁定方案 A：0.6.0 前最小入口收口，真实执行留 backlog P1。
- **落地**：UI 表单 sandbox 项 disabled + 存量仓库打开即迁移为 container 并提示 + 列表 / 过滤标签标注「暂不可用」；创建 / 更新 / 批量导入 / 扫描请求显式 `sandbox` 一律 400（共享文案）；编排层对存量 sandbox 强制 ContainerExecutor（成功 → degraded `sandbox_entry_disabled`；容器不可用 → failed `container_unavailable`），retry 归一为 container；环境审计落 `sandbox_degraded` 但只落库不通知；文档 5 处同步。
- **审计**：并发 deep——后端 Pass（W01/W02 已修、W03 登记 backlog）；UI/文档 Reject（quick-start 仍含可执行 sandbox 命令 + 旧降级口径）→ 已修 → R2 standard Pass（0B / 0W）。
- **证据**：定向 134 passed；platform 2168 passed / 9 skipped；新 e2e（disabled 选项 / 迁移提示 / PUT body / API 持久化）通过；lint 0 error / typecheck / build / 文档门禁 / `i18n:audit:missing` 全通过；29 文件 / +335 −259。
- **边界**：真实 sandbox 执行未实现（backlog P1，启用前必须闭环）；`sandboxLimits` 字段保留供存量读取；e2e fixture 的 sandbox 仅测试模拟。

### 追加临时待办：平台本地日志通道统一（2026-10-27 用户授权，不占编号；**已闭环** 5 commits + 4 收口/修复）

- **背景**：用户 2026-10-27 决策——Sentry 走官方 SaaS；本地日志通道统一优先（本地文件可查）；其余可观测性条目延后到 1.0 后。
- **落地**：`logger.ts` 重写通道口径（`LOG_LEVEL` 白名单 + `LOGFILES` 解析与 `NODE_ENV=test` 缺省关 + `/proc` `/sys` 硬禁用 + 角色 / 类型隔离 audit + 唯一写探针名 + 启动行）；移除未声明且 ESM 不可用的 Axiom 传输；新增 `process-log.ts`（stderr + 同步 `appendFileSync` 致命行 + exit(1)，`Symbol.for` 幂等）与 `plugins/logger.ts`；`sanitizeDeep` 增 `Error` 展开（`name/message/stack`）与环保护、PEM 脱敏；5 类进程边界迁移为统一 logger；入口派生并导出 `LOG_DIR=$DATA_DIR/logs`；文档 zh + en 同步。
- **审计**：standard 三分区 → R1 A Pass / B Pass / C Reject（2B + 6W）→ 收口 → R2 A Reject（`Error.cause` 环爆栈）→ 收口 → R3 quick Pass；mutation 17/17。
- **证据**：platform 172 文件 / 2257 passed / 9 skipped；根全量 341 文件 / 5221 passed；真机启动行落文件 + `/api/health` 200 + SIGTERM 干净退出 + 真实 `uncaughtException` exit 1；`LOG_DIR=/proc/...` warn 不阻塞；51 文件 / +2303 −362。
- **边界**：双进程共享日志文件的跨进程轮转非严格串行（不丢行；生产 `.gz` 存在覆盖写窗口）；同角色多副本不受支持；边界外 112 处 `console.*` 留待逐批迁移；`mailer` 收件人邮箱按投递审计保留原文。

### 追加临时待办：发布与周回归门禁对齐（2026-10-28 用户授权，不占编号；**已闭环** `a6ebdca6` + `9cf9ea49`）

- **背景**：Test run `40690157020` 因 `check:doc-governance` 字符预算失败，但 `release.yml` 与周回归 profile 均未接该门禁——出现「Test 红但 release 仍可发版 / 周回归仍绿」的口径缺口。
- **落地**：新增 `scripts/run-doc-gates.mjs`（`DOC_GATES` 16 项单点声明、便宜静态检查在前、`docs:build` 先于 fallback、失败即停、Windows 经 `cmd.exe`、runner 抛错 / 假值 / 无 status 均 fail-closed）+ `gates:docs`；`release.yml` 质量门接入（替换单点 `lint:md:check`）；weekly / pre-release / phase-close profile 用同一集合生成步骤；单测锁双向差集 + release 引用 + 集合名可解析。
- **审计**：R1 A Reject（单向集合断言）/ B Reject（第三批插队未做 §3.1.1 再平衡）→ 收口 → R2 A/B Pass → R3 Pass（0 blocker）。
- **证据**：`gates:docs` 16 项 exit 0；脚本单测 53 passed；根全量 5236 passed；CI push `40699662737` Test success；覆盖率回补后 `run-doc-gates` 语句 / 行 / 函数 100%。
- **边界**：`release.yml` 仍缺 prod 依赖审计阻断与 platform 构建（既有边界，已登记 backlog）；回归 profile 的 Phase 2 与工厂步骤有秒级重复（注释说明保留理由）；Windows 实机未验证（仅命令构造 + 注入路径单测）。

### 阶段收口

- 六原子全部闭环并通过 Review Gate；追加临时待办 3 批全部闭环（审计分别 deep / standard 三分区 / standard 两分区）。
- **发布结果**：0.6.0 已发布（npm 5 包 + 7 个 tag + GitHub Release），Docker platform 镜像随 `40745976335` 推送；发布后暴露的 `--version` 缺陷已修复待 0.6.1。**M49.5 验收对账：2 项达标（AC1 / AC4）、2 项待复核（AC2 `--version` / AC3 Docker）、1 项未完成（AC5 3 连绿 1/3）**——残余已登记 backlog。
- **门禁证据**：M49.4 文档九项 + `docs:build`；M49.5 `gates:docs` 16 项；M49.1-2b 的 audit / 依赖清零记录见 `artifacts/m49.*`（gitignored）。
- **容量校准**：唯一 diff 185 文件 / +9919 −3485（原子 24 commits 为主干，另含三批追加与依赖巡检）；「实现行 × 2-3」的测试与文档倍率再次成立。
- **残余（已登记 backlog）**：本地发布通道不跑安全门禁；0.6.0 `--version` 错误（0.6.1 修复）；master 3 连绿窗口未完成；Docker platform tag health 复核；`release.yml` 缺 prod 审计阻断与 platform 构建；回归 profile 秒级重复；Windows 实机门禁未验证。
