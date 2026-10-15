# 当前阶段待办

> 本文件**仅**登记当前阶段活跃待办；已闭环阶段归档于 [todo-archive.md](todo-archive.md)；未排期 / 延期 / 远期 / 长期主线 / 已知边界登记于 [backlog.md](backlog.md)。

---

## 文档位置速查

| 内容类型 | 位置 |
|:--|:--|
| 当前阶段任务 | **M45 进行中**——运行可靠性与交付链收口（6 原子条目，见下方 §M45） |
| 下一阶段（未授权） | 无——本阶段闭环后按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 评估 [backlog.md](backlog.md) 候选池后由用户决策 |
| 已完成阶段归档 | [todo-archive.md](todo-archive.md)（主窗口 + [archive/](archive/) 分片；M0-M44 全部已归档） |
| 未排期 / 延期 / 远期 / 长期主线 / 已知边界 | [backlog.md](backlog.md) |
| 里程碑与阶段交付 | [roadmap.md](roadmap.md)（M0-M44 已归档 + M45 进行中） |
| 历史归档索引 | [archive/index.md](archive/index.md) |

---

## M45: 运行可靠性与交付链收口（2026-10-15 用户决策方案 A）

> **阶段定位**：承接 M44 归档后的「**跑得对、跑得省、看得见**」主线——核心交付链仍有可观测与成本缺口：① 本仓库自用的验证链与引擎默认链长期存在面差（自用链未含 `test`）；② 零告警仓库仍承担一次完整修复前基线采样成本；③ 独立 worker 进程重复启动 HTTP-only 周期插件；④ 运行失败只有「分类 + 筛选 + 展示」，缺受约束的重试入口；⑤ 浮层类组件落点页无像素门禁，视觉面只靠 e2e 行为断言兜底；⑥ PR Check 全量只报警不阻断，缺降噪配置面。经 2026-10-15 用户决策（**方案 A**）从 [backlog.md](backlog.md) §候选评估中上收 6 项候选。
>
> **类型平衡**：🛠️ 3（M45.1 / M45.2 / M45.3）+ 🎨 1（M45.4）+ 🚀 1（M45.6）+ 🧪 1（M45.5）= 6 原子；**🎨 用户体验独立条目仅 1 项，低于 [规划规范 §1.1](../standards/planning.md#11-硬性约束) 类型平衡建议值 2，缺口显式标注**（本阶段以运行可靠性与成本主线优先，候选池内 UX 类可上收项仅「受约束重试入口」与「平台死代码清理」两项，后者规模过小不足以独立成原子）。
>
> **§3.4 三重交叉核验**：**0 项重复评估**——① `todo-archive.md` + `archive/todo-archive-phases-*.md` 全量扫描（关键词 `commands` / 自用链 / `prepareRepoFix` / 基线采样 / `DEPENDFIX_ROLE` / `inProcessWorker` / `retriedFromRunId` / 受约束重试 / 视觉覆盖 / `popover` / 关注集）零命中已闭环项；② `git log` 核验无对应实现 commit（`security-auto-fix.yml` 最近为 `2188b16` 文档口径同步、`packages/engine/src/app/repo-fix.ts` 最近为 `4fee403` 信号保留、`apps/platform/server/plugins/**` 最近为 `0f73645` 注释重指、`apps/platform/tests/visual/**` 最近为 `1d12803` 信号详情用例（无浮层落点页）、`apps/platform/server/entities/pr-check.ts` 无关注集列）；③ 代码 anchor 逐项实测未闭环（`security-auto-fix.yml:90` 回退链为 install / nuxt prepare / lint / build / typecheck 不含 `test`；`repo-fix.ts:140` / `:175` `prepareRepoFix` 单段形态；全仓 `rg "DEPENDFIX_ROLE"` 零命中且 `plugins/stale-cleanup.ts` 无守卫；全仓 `rg "retriedFromRunId"` 零命中；`tests/visual/platform-pages.visual.test.ts` 仅 alerts / repos / pr-checks / dialog-import-repos / login；`pr-check.ts:71-120` 无关注集字段）。
>
> **审计 depth 预告**：M45.1（CI 链 + CLI 契约 + 引擎默认链口径）→ `standard`；M45.2（engine 归因 / 出口码写路径）→ `standard`；M45.3（平台插件注册与 env 面）→ `standard`；M45.4（新增平台端点 + 可能的落库字段）→ `standard`；M45.5（视觉基线 + 文档覆盖矩阵）→ `quick`；M45.6（配置承载 + 可能的 migration + 聚合生效层）→ `standard`（若含数据模型变更建议 2 分区并发）。
>
> **建议顺序**：M45.1（最小、隔离面清晰，先消除自用链漂移）→ M45.3（platform 插件守卫，与其它条目无耦合）→ M45.2（engine 归因，D 阶段先做「被跳过步骤语义清单」）→ M45.4（平台能力，端点 / 落库形态需裁定）→ M45.6（数据模型 + 配置面，面最广）→ **M45.5 放最后**——视觉基线须在 UI 变更（M45.4 / M45.6 均触平台页面）落地后建立，否则基线随批重建（M43.1 / M43.6 排序教训）。
>
> **条目容量**：6 原子符合 [规划规范 §1.1](../standards/planning.md#11-硬性约束) 的 5-6 项上限；**M45.6 预估 8-12 文件 / 200-380 行**，若 D 阶段裁定含数据模型变更则该条目内部拆「配置承载层 / 生效与展示层」两个可独立提交批次（拆分依据登记 M45.6 §交付物）；M45.4 / M45.5 预估在单条阈值内。

### M45.1 [P2 🛠️] 自用 dependfix 验证链面差收口（**已闭环** `16c6522` + `7f2e320` + `51af699` + `b3b2007` + `62d5672` + 本条登记）

- **目标**：消除本仓库自用 `commands` 链与引擎默认链（`install → lint → build → typecheck → test`）的长期面差（自用链缺 `test`），并让「默认链扩展时自用链是否会跟随」这一语义在契约层显式可查，避免同类漂移再次静默复发。
- **优先级**：P2
- **范围**：`.github/workflows/security-auto-fix.yml:45-46`（`commands` 输入 description）+ `:90`（回退链）+ 同段注释；`action.yml:115`（输入定义）/`:179` / `:202`（透传 `--commands`）；`packages/cli/src/cli/index.ts` + `packages/cli/src/app/pipeline.ts`（`--commands` 解析与透传）+ `packages/cli/README`（双语）+ CLI help；`packages/engine/src/app/verify-project.ts:38`（`customCommands ?? DEFAULT_VERIFY_COMMANDS` 的整链替换语义）；`docs/design/governance/github-action-workflow.md:54`（`commands` 契约表）+ `docs/guide/*` 与 `docs/i18n/en-US/**`（同源口径）；backlog 条目清出。
- **验收标准**：
  - [x] ① **面差归零或显式声明**：D1 裁定补齐 `test` 段 → 自用链 = `install → nuxt prepare → lint → build → typecheck → test`，与引擎默认链差异**仅剩 `nuxt prepare`**（理由：本仓库 eslint 依赖 `.nuxt/tsconfig.json` 生成物；已在门禁脚本 `DECLARED_EXTRAS` 登记理由 + `before: lint` 位置约束）。可复现：`check:verify-chain` 输出逐项对比（`覆盖…（install → lint → build → typecheck → test）；已声明差异项 0 / 额外项 1`）。
  - [x] ② **语义契约化**：D2 裁定**保持整链替换语义不变**（否决「追加 / 显式模式」：触及 CLI 公开契约与平台 `verifyCommands` 安全敏感面）→ `action.yml:116`、`github-action-workflow.md:54`、CLI help（`packages/cli/src/cli/index.ts:167`）三处均写明「整链替换 / 不做合并 / 默认链扩展不会自动跟随 / 默认链内条目须显式保留」（审计分区 B 逐处比对通过）；CLI help 实测渲染无 markdown 残留。
  - [x] ③ **漂移防护**：新增零依赖门禁 `scripts/check-verify-chain.mjs`（+ `check:verify-chain` 入口 + CI Test job 阻断接线），按**语义项**比对（`install` / 脚本名 / 复合命令全文），判定四类：缺默认链语义项须登记 `DECLARED_GAPS`、额外项须登记 `DECLARED_EXTRAS`（含理由与可选 `before` 位置约束）、共有项相对顺序一致、声明陈旧同样报错；解析失败（非单引号字面量 / 数组未闭合）按不一致上报，不静默通过。单测 29 例（含真实仓库文本四个变异 + 子进程退出码与机读模式）；负例标定工件 `artifacts/m45.1/negcase-verify-chain.txt`（记录被审修订 HEAD + 脚本 md5，四个负例均 exit 1 且输出 `文件:行:明细`，还原后 md5 一致）。
  - [x] ④ **门禁**：eslint（改动代码文件）0 error / 0 warning；root typecheck（7 包）全 Done 且无 `error TS`；`check:docs` / `check:doc-size` / `check:orphan-ids` / `check:standards-redundant:strict` / `check:experience-landing` / `docs:check:i18n` / `i18n:check:anchor` / `lint:md:check` / `check:verify-chain` 全 exit 0；`docs:build` exit 0；`packages/cli` 定向 vitest 163 passed；全量 `test:coverage` 四维均 ≥ 阈值（Statements 88.43 / Branches 83.14 / Functions 87.92 / Lines 88.57）。
- **D 阶段定稿（2026-10-15 用户裁定）**：**D1 = 补齐 `test` 段并联动调整任务超时上限**（证据：自用链历史成功运行耗时区间远低于原上限，但补入测试段后有告警仓库需跑「修复前基线采样 + 修复后验证」两轮链，故上限由十五分钟提至二十五分钟，引擎单命令十分钟超时不变）；**D2 = 保持整链替换语义不变 + 新增一致性门禁做漂移防护**（否决「追加 / 显式模式」：`--commands` 为公开契约且平台 `verifyCommands` 属远程命令执行面，改动面远超本条目粒度）。
- **不做什么**：不改引擎默认链的条数与顺序（`install → lint → build → typecheck → test` 冻结）；不改 `quickVerifyProject` 的 lint-only 定位；不改单命令超时与 corepack 版本替换语义；不把 `nuxt prepare` 注进引擎默认链（沿用 `--commands` 逃生舱）；不改平台侧 `verifyCommands` 配置项的既有默认值语义。
- **依赖**：M44.1（`DEFAULT_VERIFY_COMMANDS` 扩为五段链；该批次用户裁定仅补 `typecheck`，面差即当时登记为 backlog 候选）；[github-action-workflow.md:54](../design/governance/github-action-workflow.md)（`commands` 契约与「整链替换」既有声明）；[经验归档 §三十六](../design/governance/experience-archive-§36-§40-toolchain.md)（`commands` 引入缘由：run 31552922137 的 `nuxt prepare` 缺失致 eslint Parsing error）；backlog §候选评估中条目「本仓库自用 dependfix 验证链与引擎默认链的面差」。
- **交付物**：预计 2 commits——① `ci(workflows)` 自用链补齐 + 语义声明（若 D2 裁定含 CLI 语义变更则拆 `feat(cli)` / `test(cli)`）；② `docs` 同源口径同步 + 闭环登记。预计 4-8 文件 / 60-150 行。**实际（回填）**：6 commits / 20 文件——`feat(scripts)` 门禁脚本 + `package.json` 入口 / `test(scripts)` 单测（29 例）/ `ci(workflows)` 自用链 + 超时上限 + CI 接线 / `docs` 工具契约与命令行帮助口径 / `docs` 门禁口径与脚本索引同步 / `docs(plan)` 闭环登记。**估算偏差说明**：原估算未计入「漂移防护」需要新增门禁脚本与单测（AC ③ 的落地载体，合计 607 行），其余改动与估算同量级。
- **风险与缓解**：**R1 自用链补 `test` 后容器内耗时上升**（全量 vitest）→ 与 `timeout-minutes` / `EXECUTION_TIMEOUT_MS` 联动评估，超预算则改为定时巡检链路采样并登记观察项；**R2 「追加语义」触及 CLI 公开契约**（`--commands` 被 action、平台 `verifyCommands` 与多处文档引用）→ 改前做落点清单 + 三处声明一致（AC ②）+ README 双语与 en-US 镜像单独扫；**R3 断言形态脆弱**（字面串比对随措辞变更失效）→ AC ③ 明确按语义集合比对。
- **闭环记录（2026-10-15）**：**审计** —— 分区 A（门禁脚本 + CI 接线）standard **R1 Pass**（0 blocker / 3 warning / 4 suggest）→ 收口（数组内非单引号字面量与数组未闭合改为解析失败上报；`before` 目标缺失报「位置约束失效」；补齐子进程退出码与机读模式用例）；分区 B（文档口径与契约面）standard **R1 Pass**（0 blocker / 3 warning / 5 suggest）→ 收口（任务超时上限口径改净；受改文件行尾统一 LF；脚本索引移入独立小节；技能参考表权威源与镜像同步；roadmap 承接段标注已闭环；`quick-start` en-US 镜像漂移登记候选）；合并复审 **quick R2 Pass**（7 个修复点全部 closed，无新增回归）。
- **残余与观察项**：① 自用链六段 × 引擎单命令十分钟上限 > 任务二十五分钟上限（全挂场景由任务超时兜底，与改动前同族）；② 门禁语义分类未覆盖 `pnpm run <script>` / `corepack pnpm@<version>` / 内联 `&&` 形态（退化为全文比对，后果为保守误报，已在脚本头已知边界声明）；③ 数组项若写成「单引号字面量 + 行尾注释」会被判解析失败（同属保守方向，当前事实源无该形态）；④ `quick-start` 的 en-US 镜像为裁剪子集（既有漂移，已登记 backlog 候选，不在本条目范围）；⑤ 门禁说明在三处各一句指针（脚本索引 / 契约表 / 设计章节），符合单点声明原则，后续再增站点时收敛。

### M45.2 [P2 🛠️] 零告警仓库修复前基线采样成本

- **目标**：让零告警仓库不再承担一次完整的修复前基线验证链成本（当前仅跳过 lockfile repair），并在同一批次内证明多仓出口码判定不因此退化。
- **优先级**：P2
- **范围**：`packages/engine/src/app/repo-fix.ts:140`（`prepareRepoFix` 调用点）/`:175`（`prepareRepoFix` 定义——「只读抓取」与「写盘」两段的拆分边界）；`packages/engine/src/app/index.ts:276`（`preExistingDirty` 采样）/`:479` / `:540`（`enforceVerificationGate` 调用点）；`packages/engine/src/app/result-assembly.ts`（`computeExitCode` 归因口径）；定向单测（`app/**` 面）；承载面 [dependency-fixer-records.md](../design/modules/dependency-fixer-records.md) 验证链章节（含「分片索引」指针）。
- **验收标准**：
  - [ ] ① **零告警不采样**：零告警仓库不执行修复前基线验证链——单测断言基线阶段 `runVerification` 调用次数为 0；且「取告警」前置到基线采样之前（`prepareRepoFix` 的只读抓取与写盘两段已拆分，可独立验证）。
  - [ ] ② **出口码不变量**：多仓组合的出口码与现状一致（至少覆盖 `[健康零告警]` 仍成功、`[健康零告警 + 真实失败]` 与 `[零告警 + 有告警]` 混合形态），以定向用例锁定——形态参照 M43.3「整段跳过致出口码退化」的回归用例。
  - [ ] ③ **有告警仓库行为不变**：有告警仓库的基线采样 / 修复 / 验证 / 门禁回滚链路零行为差异（既有 engine 用例全绿 + 新增对照用量例）。
  - [ ] ④ **门禁**：`pnpm lint` 0 error + `pnpm typecheck` 0 error + `pnpm --filter @dependfix/engine exec vitest run` 定向通过 + `pnpm -r build` exit 0（workspace dist 纪律）。
- **不做什么**：不改 `enforceVerificationGate` 的回滚语义与 `preExistingDirty` 的保护面；不引入「零告警仓库显式处理成功信号」的替代方案（backlog 候选中的备选 ②，本批不涉及）；不改锁文件修复策略链与 `verificationPassed` 的既有消费者口径；不改多仓共享 `workDir` 的首采复用策略。
- **依赖**：M43.3（零告警仓库跳过 lockfile repair + 环境性失败归因；该批次审计 blocker 即「整段跳过致出口码退化」）；[dependency-fixer-records.md](../design/modules/dependency-fixer-records.md) 内 `repo-fix.ts:79` 的注释口径（多仓共享 `workDir` 时沿用首采结果的既有注释口径）；backlog §候选评估中条目「零告警仓库的修复前基线采样成本」。
- **交付物**：预计 2-3 commits——① `refactor(engine)` 拆分 `prepareRepoFix` 两段 + 零告警不采样；② `test(engine)` 出口码不变量与对照用例；③ `docs(design)` 验证链章节口径 + 闭环登记。预计 4-8 文件 / 120-260 行。
- **风险与缓解**：**R1 被跳过步骤承载其它语义**（M43.3 同族历史 blocker：`verificationPassed` 同时是多仓出口码的成功信号）→ D 阶段先产出「被跳过步骤的语义清单与消费者」，AC ② 以出口码不变量用例锁定；**R2 抓取前置改变进度上报 / 日志顺序**→ 逐调用点核对进度回调并纳入用例；**R3 `preExistingDirty` 首采复用受影响** → 用例覆盖多仓共享 `workDir` 形态。

### M45.3 [P2 🛠️] 队列 worker 进程按 role 跳过周期插件

- **目标**：让独立 worker 进程不再重复启动 HTTP-only 周期插件（`stale-cleanup` 孤儿清理与批次对账 / 启动期数据库引导与备份 / 构建信息），消除重复数据库查询与日志噪声；同时保持单进程形态行为不变。
- **优先级**：P2
- **范围**：`apps/platform/docker/entrypoint.sh:108-140`（worker 启动 env：`NUXT_QUEUE_ENABLED` / `NUXT_IN_PROCESS_WORKER` / `DATABASE_MIGRATIONS_RUN` / `NITRO_UNIX_SOCKET`）；`apps/platform/server/plugins/stale-cleanup.ts`（守卫）+ `plugins/database-bootstrap.ts` + `plugins/build-info.ts`（按 HTTP-only 判定逐个评估）；`apps/platform/nuxt.config.ts:113-120`（`inProcessWorker` 与环境解析；新增 `DEPENDFIX_ROLE` 或复用既有开关）；`.env.full.example` + `docs/guide/configuration.md` + [platform.md §10.6](../standards/platform.md#106-队列执行进程隔离独立-worker-进程)（队列执行进程隔离章节）+ 平台定向单测。
- **验收标准**：
  - [ ] ① **role 语义**：worker 进程跳过 HTTP-only 周期插件、HTTP 主进程行为不变；**单进程形态（`inProcessWorker=true`）不得跳过**（D 阶段裁定判定条件并写入设计 / 规范）。
  - [ ] ② **三态可断言**：`server` / `worker` / 未设置三态下插件注册与执行可断言（含「inProcessWorker=true 时不跳过」的反例用例）。
  - [ ] ③ **env 文档完整性**：新增或复用的环境变量进 `.env.full.example` 与 `docs/guide/configuration.md`（M40.6 文档完整性口径），有双语镜像时同步；缺省值 = 现行为（未设置时不改变任何进程行为）。
  - [ ] ④ **门禁**：`pnpm lint` 0 error + `pnpm --filter @dependfix/platform typecheck` 实测 0 error（`grep -E "error TS|Done"`，不接受仅 Done）+ 平台定向 vitest 通过 + `pnpm run check:docs` exit 0；涉及容器启动形态时跑 `apps/platform/docker/entrypoint.test.mjs`。
- **不做什么**：不改插件的清理 / 对账 / 备份逻辑与幂等语义；不改 `inProcessWorker` 与队列自动降级矩阵（[platform.md §10.4](../standards/platform.md)）语义；不引入进程管理器或新进程角色；不改 entrypoint 的看护循环与信号处置（[platform.md §10.6](../standards/platform.md#106-队列执行进程隔离独立-worker-进程) 严格约束 + 已知边界冻结）。
- **依赖**：M38（平台执行模型隔离，独立 worker 进程形态）；M40.4（entrypoint 看护循环与自动重启）；2026-10-14 M44 阶段期间 entrypoint 插队热修（信号处置顺序，[platform.md §10.6](../standards/platform.md#106-队列执行进程隔离独立-worker-进程)）；backlog §候选评估中条目「队列 worker 进程按 role 跳过周期插件」。
- **交付物**：预计 2-3 commits——① `feat(platform)` role 判定 + 插件守卫；② `test(platform)` 三态用例；③ `docs` env 文档 + 规范条目 + 闭环登记。预计 5-9 文件 / 80-200 行。
- **风险与缓解**：**R1 误判致 HTTP 进程跳过关键插件**（迁移 / 启动期备份）→ D 阶段先列「HTTP-only 插件清单 + 每条理由」，AC ② 以反例用例保护；**R2 迁移专用退出语义被破坏**（worker 侧 `DATABASE_MIGRATIONS_RUN=false` 已隔离）→ 不改迁移触发链；**R3 新 env 影响既有容器 / compose 部署** → 缺省值保持现行为 + 文档登记 + entrypoint 冒烟。

### M45.4 [P2 🎨] 运行失败「受约束重试入口」

- **目标**：在既有「失败分类 + 筛选 + 展示」基础上补齐重试入口，让用户对**仅 `transient` 类**失败可一键重跑；以非终态守卫、同仓库去重与审计来源约束滥用。
- **优先级**：P2
- **范围**：设计依据 [run-failure-taxonomy.md §5.5](../design/governance/run-failure-taxonomy.md)（重试 = 复用 `POST /api/repos/[id]/scan` 以原参数重新入队并记录来源）；`apps/platform/server/entities/scan-run.ts:63-79`（`failureCode` / `failureStage` / `failureKind`）；`apps/platform/server/api/runs/**`（端点形态按 D1 裁定）+ `apps/platform/server/api/repos/[id]/scan.post.ts`（既有去重合并路径）；`apps/platform/app/components/run-detail-dialog.vue` / `repo-history-dialog.vue`（入口落点按 D3 裁定）+ `apps/platform/app/utils/run-view.ts`（标签映射）+ i18n 双语；单测 + e2e。
- **验收标准**：
  - [ ] ① **受约束可见性**：仅 `failureKind === 'transient'` 的运行呈现重试入口；`deterministic` / 未分类 / 成功态不呈现（前端与后端双重校验，前端不可见 + 后端拒绝）。
  - [ ] ② **非终态守卫 + 去重不冲突**：存在进行中运行时不新建 run（走既有去重合并语义），且重试命中合并时前端提示口径与 M43.4 的合并感知一致（不出现「点了没跑」）。
  - [ ] ③ **审计来源**：新 run 可追溯其重试来源（`retriedFromRunId` 或按 D2 裁定等效承载），并在详情视图可见来源链。
  - [ ] ④ **门禁**：`pnpm --filter @dependfix/platform typecheck` 实测 0 error + 定向 vitest 通过 + e2e（入口出现 / 不出现两组）+ `pnpm run check:i18n` parity 0 + `pnpm run check:docs` exit 0。
- **D 阶段决策点**：**D1** 端点形态（新增 `POST /api/runs/[id]/retry` vs 前端复用 `POST /api/repos/[id]/scan` + 原参数）；**D2** 来源字段承载（新增列 + migration vs 复用 `summaryJson`）；**D3** 入口落点（run 详情 dialog vs 列表行内）；**D4** 重试是否需二次确认文案（消耗队列 / 容器资源）。
- **不做什么**：不做批量重试；不改 failure taxonomy 的分类规则与落库回填口径；不放开非 `transient` 重试（不做「强制重试」逃生舱）；不引入自动重试 / 定时重试；不改 `/api/runs` 既有列表筛选契约与 runs 导出契约。
- **依赖**：M37（运行失败分类与筛选落地，`failure_code` / `failure_stage` / `failure_kind` 三列 + 三维筛选）；[run-failure-taxonomy.md §5.5](../design/governance/run-failure-taxonomy.md)（2026-10-06 用户决策延后）；M43.4（`merged` 前端感知口径，重试命中合并时复用）；backlog §候选评估中条目「运行失败『受约束重试入口』（延后，保留待评估）」。
- **交付物**：预计 3 commits——① `feat(platform)` 端点 + 守卫 + 来源记录；② `feat(platform)` 前端入口 + i18n 双语；③ `test(platform)` 单测 + e2e + 闭环登记。预计 6-10 文件 / 150-300 行。
- **风险与缓解**：**R1 重试滥用消耗扫描队列与容器资源** → 仅 `transient` + 非终态守卫 + 审计来源（AC ①②③）；**R2 与去重合并语义重叠** → AC ② 复用 M43.4 提示口径；**R3 若引入新列触发 migration 幂等 / 前缀感知** → 按 [platform.md §3.3](../standards/platform.md) 基线自举口径 + e2e 二次运行验证幂等。

### M45.5 [P3 🧪] 浮层类组件视觉覆盖扩面

- **目标**：把 caomei-ui 浮层类组件（Drawer / Tabs / Popover / Toast / 选择器类）的落点页纳入像素门禁，消除该类语义变更当前只靠 e2e 行为断言兜底的盲区。
- **优先级**：P3
- **范围**：`apps/platform/tests/visual/platform-pages.visual.test.ts`（用例扩面）+ `__screenshots__/` 基线（新增 / 调整）+ `apps/platform/tests/visual/README.md`（覆盖边界与维护协议）+ [testing.md §6.7](../standards/testing.md)（视觉回归覆盖矩阵）+ [caomei-ui-migration.md §15.15](../design/governance/caomei-ui-migration.md#1515-caomei-ui-060-升级回归实证插队热修2026-10-12)（依据 / 如需）；backlog 条目清出。
- **验收标准**：
  - [ ] ① **覆盖落点**：至少覆盖 `schedules.vue` 表单浮层与 `scans.vue` 弹窗两类落点页（D 阶段按优先级定稿；`alert-run-sidebar` 视预算决定）；门户面板类按视口级截图，模式参照 `tests/visual/dialog-select-layer.visual.test.ts`。
  - [ ] ② **稳定性**：新基线 `--update-snapshots=all` 重建后，**不带 update** 连跑两遍通过；若出现运行间非确定性差异，须定位来源并按 `dialog-select-open-dark` 先例处置（mask 覆盖区 / 元素级截图 / 登记观察项）。
  - [ ] ③ **预算与文档**：用例数与 CI 时长增量登记；`tests/visual/README.md` 覆盖边界行 + [testing.md §6.7](../standards/testing.md) 覆盖矩阵同步；取证前 `pnpm --filter @dependfix/platform build` 的前置口径不变。
  - [ ] ④ **门禁**：`pnpm --filter @dependfix/platform test:visual` 通过（连跑两遍）+ `pnpm lint` 0 error + `pnpm run check:docs` exit 0 + `pnpm run lint:md:check` 通过。
- **不做什么**：不改视觉门禁阈值与既有权衡（`maxDiffPixels` 等）；不做全站覆盖（按优先级裁剪）；不改 caomei-ui 版本、不新增第三方视觉工具链；不改既有 5 个基线页面（除非被 UI 变更连带）。
- **依赖**：caomei-ui `0.6.0` 升级回归插队热修（2026-10-12，逐基线量化见 [§15.15](../design/governance/caomei-ui-migration.md#1515-caomei-ui-060-升级回归实证插队热修2026-10-12)）；M32.5（视觉回归最小集既定边界：alerts / repos / pr-checks / dialog-import-repos / login）；M33.4 / M33.5（既有扩面先例）；backlog §候选评估中条目「浮层类组件视觉覆盖扩面」。
- **交付物**：预计 2 commits——① `test(platform)` 用例 + 基线 + README；② `docs(standards)` 覆盖矩阵 + 闭环登记。预计 4-8 文件（含基线 PNG）/ 100-250 行 + 二进制基线。
- **风险与缓解**：**R1 基线随浮层动画 / 焦点态非确定性漂移**（`dialog-select-open-dark` 先例：约 28px 运行间差异）→ 等待策略 / mask 覆盖区 / 元素级截图，AC ② 以连跑两遍锁定；**R2 CI 时长与基线数量膨胀** → 按优先级裁剪 + 预算登记（AC ③）；**R3 门户面板差异面大导致基线脆弱** → 元素级 vs 视口级的选定依据写入 README；**R4 排序风险**——本条目置于 M45 末位，避免 M45.4 / M45.6 的 UI 变更使新基线立即失效。

### M45.6 [P3 🚀] PR Check 告警关注集（可配置面）

- **目标**：引入仓库级关注集，让「非关注 check（provider lint-only / preview 构建等）失败」不再进入告警面，从而降低噪音；同时保持与「全量只报警不阻断」语义的兼容边界清晰。
- **优先级**：P3
- **范围**：`apps/platform/server/entities/pr-check.ts:71-120`（三源归一化快照 / `overallStatus` / `failureSources` 聚合面）；`apps/platform/server/services/monitor/**`（聚合派生与告警触发点）+ `apps/platform/server/entities/repository.ts`（配置承载，D3 裁定：新增 JSON 列 vs 独立实体）+ 设置页 / 表单 + API + i18n 双语；设计稿 [pr-build-deploy-signals.md](../design/governance/pr-build-deploy-signals.md) 新增章节；单测 + e2e。
- **验收标准**：
  - [ ] ① **向后兼容**：未配置关注集时行为与现状完全一致（全量只报警不阻断；既有 PR Check 用例全绿）。
  - [ ] ② **过滤口径单一且声明**：关注集匹配（按 check 名 / provider / 状态）在**单一层**生效——采集层过滤 vs 展示层过滤由 D2 裁定并在设计中显式声明；被过滤信号的「是否仍落库 / 是否可审计」口径明确（不得出现「线上看不到、库里也没有」的静默丢弃）。
  - [ ] ③ **可配置且幂等**：仓库级配置可读写、校验与非法条目处置明确（配置面 UI / API 契约）；重复保存幂等。
  - [ ] ④ **门禁**：`pnpm --filter @dependfix/platform typecheck` 实测 0 error + 定向 vitest / e2e 通过 + `pnpm run check:i18n` parity 0 + `pnpm run check:docs` exit 0；**含数据模型变更时**e2e 二次运行验证 migration 幂等（前缀感知，[platform.md §3.3](../standards/platform.md)）。
- **D 阶段决策点**：**D1** 配置粒度（仓库级 vs 全局）；**D2** 过滤层（采集层 vs 展示层）+ 被过滤项是否仍落库；**D3** 承载形态（`Repository` JSON 列 vs 独立实体 + migration）。
- **不做什么**：不引入阻断语义（关注集只降噪，不改「只报警不阻断」）；不改 M43.2 三源采集与聚合判据；不做 provider 原生日志富化（另一独立候选）；不做通知 / webhook 集成；不做关注集的模板 / 继承（仅单仓库级）。
- **依赖**：M43.2（D3 裁定「全量只报警不阻断」，本条目为其后续增量）；设计稿 [pr-build-deploy-signals.md](../design/governance/pr-build-deploy-signals.md)；backlog §候选评估中条目「PR Check 告警关注集（可配置面）」。
- **交付物**：预计 3-4 commits——① `feat(platform)` 配置承载 + migration（若需）；② `feat(platform)` 生效层 + API / UI + i18n 双语；③ `test(platform)` 单测 + e2e；④ `docs(design)` 设计稿章节 + 闭环登记。预计 8-12 文件 / 200-380 行；**若含数据模型变更，按「配置承载层 / 生效与展示层」拆两个可独立提交批次**（拆分依据登记本节，各批 ≤ 10 文件 / ≤ 800 行）。
- **风险与缓解**：**R1 过滤层选错致漏报真实失败** → D 阶段先定过滤层与可见性口径（AC ②），并要求「被过滤项仍可审计」；**R2 降噪过度致用户看不到失败** → 默认不配置 = 现状 + UI 明示当前生效口径 + 一键恢复默认；**R3 新增 migration 幂等 / 前缀感知**（平台历史 blocker 同族）→ [platform.md §3.3](../standards/platform.md) 口径 + e2e 二次运行；**R4 与 M45.4 同触平台 UI** → 顺序相邻，M45.5 基线在其后建立。

### M45 追加临时待办（不占阶段条目编号，2026-10-16 用户授权）：批量日志导出范围口径

> **位置与标记**：本条为**追加临时待办**（追加在 §M45 段落末尾，处于 M45.6 之后）；标记口径（位置 / 编号 / 容量）以 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 为唯一权威声明。

- **目标**：消除「默认筛选下导出必然失败」的可用性缺口——批量导出默认改为**当前页**（与屏幕所见一致），并保留「全部筛选结果」入口（命中数超全量上限时禁用并在文案标注原因，不再让用户点一次必然 413 的操作）。
- **触发依据**：用户 2026-10-16 报告生产现象（默认筛选 162 条运行 → 413 `RUN_LOGS_EXPORT_TOO_LARGE`，导出入口在其主路径上不可用）并**明确授权插队**；处置口径 = [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement)「**追加临时待办（不占阶段条目编号）**」（本次为：追加于 §M45 段落末尾、未占用既有条目位置、未分配编号）。
- **范围**：`apps/platform/server/api/runs/logs-export.get.ts`（可选分页窗口路径 + 上限口径拆分 + 文件头范围行）；`apps/platform/app/pages/scans.vue`（`CaomeiSplitButton` 双档导出入口）；`apps/platform/app/utils/run-view.ts`（`EXPORT_RUNS_LIMIT` 镜像常量 + `buildExportScopeItems`）；i18n 双语；`server/api/runs/runs-logs.test.ts` / `tests/unit/run-view.test.ts` / `tests/e2e/scans.e2e.test.ts`；[development.md §5.1.43](../standards/development.md)（镜像阈值条款）+ review 检查点矩阵 1 行。
- **验收标准**：
  - [x] ① **默认不再失败**：默认筛选下点主按钮 → 请求携带与列表一致的 `page` / `pageSize`，服务端只导出该页（e2e 断言请求 URL 参数 + 200）。
  - [x] ② **全量入口可预判**：菜单项文案带命中数；命中数 > 全量上限时**禁用**并标注上限；未超限时点按走既有全量路径。
  - [x] ③ **契约向后兼容**：不传 `page` / `pageSize` → 行为与改动前一致（全量 + 超 `MAX_EXPORT_RUNS` 413）；文件头新增 `# 导出范围：` 行区分「第 N 页」与「全部筛选结果」；窗口越界 → 404 `RUN_LOGS_NOT_FOUND`。
  - [x] ④ **门禁**：`pnpm lint` 0 error / `pnpm run typecheck` 全包 Done / 定向单测 + `scans` e2e 全绿 / `build` exit 0 / 全仓 `test:coverage` 通过 / 文档与 i18n 门禁全 exit 0。
- **D 阶段定稿**：**D1 入口形态 = `CaomeiSplitButton`**（主按钮「导出当前页日志」+ 菜单「导出全部筛选结果（共 N 条）」，超限项禁用并带原因文案）；**D2 服务端 = 分页参数可选、缺省保持全量**（窗口路径**不**套用 `MAX_EXPORT_RUNS`——载荷保护由 `MAX_EXPORT_BYTES` 承担；否则会与列表允许的 `pageSize` 取值自相矛盾）；**D3 上限预判 = 前端具名镜像常量 + 权威侧等值断言**（不引入 `shared/` 目录与 vitest 别名改造）。
- **不做什么**：不改 `GET /api/runs` 列表契约（筛选 / 分页 / 排序）；不改单 run 日志导出端点；不引入 zip 打包与流式下载；不改 `MAX_EXPORT_BYTES` 与全量运行数上限取值；不新增导出格式（Markdown / JSON）。
- **交付物（回填）**：8 commits / 19 文件（7 = 服务端端点 + 共用分页事实源 + 页面 + 工具 + i18n 双语；4 = 三个测试文件 + 列表端点用例订正；8 = 规范条款 2 条（development §5.1.43 镜像阈值、planning §3.1 追加临时待办标记口径）+ 同源指针 2 处（ai-collaboration §2.1.1、AGENTS.md §新需求处理原则）+ 检查点矩阵 2 行 + 三份 plan 文档）。**规模说明**：单一原子（导出范围口径）跨 server / app / i18n / 测试 / 文档，不可再切；其中 2 个文件来自 A 阶段 R1 W1 修复（`runs-query.ts` 分页片段上提 + `index.get.ts` 改用共用片段 + 其用例订正）——该修复把「列表页宽与导出窗口取数同源」从「两侧各一份常量」改为结构性单一事实源。[规范与文档治理设计 §2.4](../design/governance/spec-and-doc-governance.md#24-设计文档硬阈值hard-requirement) 硬阈值**不适用**（属「现有模块功能扩展 / 体验调整」，非专项设计 / 专项治理 / 重大变更 / 新增模块）。
- **风险与缓解**：**R1 窗口与列表分页口径漂移**（`createdAt` 并列时跨请求窗口可能位移）→ 窗口按列表同一 `order` + `skip` / `take` 取数，用例以「相邻两页并集不重不漏」锁定（不锁定「哪一条在第 1 页」）；**R2 前端镜像常量与服务端上限漂移** → 权威侧等值断言 + mutation 标定。
- **闭环记录（2026-10-16）**：**基线现象** = 生产默认筛选 162 条运行 > 全量上限 100 → 413；**根因** = 端点按 M39.4 设计不接分页（改动前 `runs-query.ts` 注释「导出端点不引入分页」）且前端只传三维筛选 → 默认筛选下必然超限（用户可见的按钮在真实数据量下近乎不可用）。**审计**：`standard` **2 分区并发**——分区 A（平台代码 / 测试 / i18n）R1 **Pass**（0 blocker / 1 warning / 6 suggest）→ 修复 W1（分页常量与 schema 片段上提 `runs-query.ts` 共用，消除列表与导出两侧各自一份的取数口径漂移；补导出侧钳制用例）与 S1~S4（e2e 文案正则放宽 / 超限提示改成因中立 / stale 注释订正 / 去掉无调用点的缺省参数）→ R2 **Pass**（0 blocker / 0 warning，5 编号全关闭；2 条 suggest 一并应用）；分区 B（规范条款 + 检查点矩阵 + plan 登记）同批以 `standard` 审计：R1 **Pass**（0 blocker / 2 warning / 5 suggest），W01（插队依据改为落地 §3.1「追加临时待办（不占阶段条目编号）」标记口径，替代原「清单外体验缺口」表述）/ W02（roadmap 段压缩为指针）与 S01~S05 已随批收口。**mutation 标定 8/8 击杀**（窗口丢 `skip` / 去越界 404 / 窗口套用运行数上限 / 去文件头范围行 / 边界判断改 `>=` / 镜像常量改 101 / 共享每页上限改 300 / 去掉共享钳制）。**证据**：`lint` 0 error（2 条存量 `max-lines` warning）/ `typecheck` 7 包 Done / 全仓 `vitest` 257 文件 4115 passed / `scans` e2e 9 passed / `build` exit 0 / `test:coverage`（Statements 88.45 / Branches 83.16 / Functions 87.93 / Lines 88.59）/ 文档与 i18n 门禁全 exit 0 / 改动源文件编号标记扫描 0 命中。**残余与观察项**：① 窗口与列表的一致性受 `createdAt` 并列影响（秒级并列且无 tiebreaker 时跨请求窗口可能位移；需与列表同步改排序键，属 P 阶段决策，本批以「两页并集不重不漏」用例锁定划分语义）；② 前端镜像上限的漂移后果限于提示不一致（权威 413 未撤），等值断言在服务端用例内；③ 非法分页参数（`pageSize=0`、`page=1.5`）返回 400 与列表同口径但无新端点用例（R1 已记录边界）；④ `scans.vue` 860 行超 `max-lines` 健康线（存量 warning，已由既有 backlog 候选覆盖，本批不顺手重构）；⑤ 三处同步已闭环：`planning §3.1`（标记口径）/ `ai-collaboration §2.1.1`（指针）/ `AGENTS.md §新需求处理原则`（用户 2026-10-16 授权后补第 5 条指针）；⑥ R4 审计 suggest「门禁链接扫描面缺口」经复核**不成立**（`check:docs` 的 links 规则以仓库根为起点，`.github/**` 的 md 全在面内；误引为 vue-interp 规则的 `docs/` 专属注释）→ **未登记候选**，实证结论记入 [archive/index.md §4](archive/index.md)。**批次记录（含 commits）见 [archive/index.md §4](archive/index.md)**。
