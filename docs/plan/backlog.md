# 待办积压 (Backlog)

> 本文档维护尚未进入正式阶段执行面的统一候选池，按 **长期主线任务** / **周期性回归验证层** / **短期与一次性候选任务** / **已知边界与 known-issue** 四象限区分。当前阶段任务见 [todo.md](todo.md)；已闭环归档见 [todo-archive.md](todo-archive.md)。
>
> **维护规则**：
> 1. 新功能需求、非阻塞优化与长期治理事项优先写入本文件，而不是直接写入 `todo.md`；已闭环条目从 backlog 移除，由 [todo-archive.md](todo-archive.md) 统一维护。
> 2. backlog 必须区分四类：长期主线（可跨阶段保留）/ 周期性回归验证层（健康检查层）/ 短期与一次性候选（评估后上收或关闭）/ 已知边界与 known-issue（CI / 浏览器兼容性等持续观察项）。
> 3. 长期主线被某阶段抽取后不删除主线卡片，只补记当前状态与下一次可切片方向；**若该主线验收条件已达成 / 目标被某阶段闭环，则按 [规划规范 §4.4 第 11 条](../standards/planning.md#44-大批量归档批次操作规范)「长期主线卡闭环同步」整卡删除或改写状态**。
> 4. 周期性回归验证层不是"一个任务"，而是所有长期主线的健康检查层；它按固定节奏运行，不参与阶段切片容量竞争。
> 5. 短期候选正式上收阶段后从 backlog 移除；评估为"暂不实现"的候选直接关闭并在归档中保留决策记录。
> 6. 当前仓库的 backlog 以中文为唯一事实源。

## 长期主线任务（可跨阶段保留）

> **状态口径**：进行中 / 观察中 / 暂停 / 已关闭。

### 主线 #1：network-audit 默认白名单持续扩展问题（G1）

- **目标**：把 network-audit 默认白名单从"按次新增"演进为"按域名 / SRI 哈希 / 输出区分"的可持续治理方案，避免每次构建工具跨 major 升级都需补白名单。
- **状态**：观察中（**「注册表域预置 + 动态发现生效 registry」方向已随 2026-10-11 M42 阶段闭环（M42.1）**；其余方向保留待评估）。
- **下一次可切片方向**（任一触发时重新评估）：
  1. 构建工具生态文档站类目预置白名单（rolldown.rs / swc.rs / rust-lang.org 等）—— 新增白名单诉求应转为"真实注册表域"申请而非"构建工具文档站"
  2. 按 SRI 哈希钉资源（推荐域动态发现）
  3. ~~**注册表域预置 + 动态发现生效 registry**（镜像站 / 企业私服被 deny-by-default 拦死 → install 失败 + 全量回滚）~~ —— **已随 2026-10-11 M42 阶段闭环（M42.1：`380e8f4` + `47f7c42` + `39df76d`，预置常见镜像源 + 从配置面动态发现生效 registry + 治理决议登记）**；剩余方向（构建工具生态文档站类目 / SRI 哈希钉定）保留待评估。
- **验收**：默认白名单不再按次新增；verification 阶段合法外联不被误判；剩余候选方向（SRI 哈希钉定等）任一实施或主线整体评估为长期保留后关闭本主线条目

## 周期性回归验证层

> **定位**：本层不是"一个任务"，而是所有长期主线的健康检查层。它不产生直接改进，只验证"没有回退"。按固定节奏执行，不参与阶段切片容量竞争。

### 固定执行入口（当前）

| 节奏 | 入口 | 最小固定组合 | 触发条件 |
|:---|:---|:---|:---|
| 阶段收口前 | `pnpm check:docs` + `pnpm run test:coverage` + `pnpm lint` + `pnpm typecheck` + `pnpm --filter @dependfix/platform exec playwright test` | 检查归档批次合入未引入回归 | 每次阶段归档前 |
| CI 端到端 | 上述 5 项 + `pnpm build` | 裁决合并 | PR 合并前 / commit 推送后 |

> **扩面候选**（待评估）：周级 `pnpm regression:weekly` 与发版前 `pnpm regression:pre-release` 入口未建立；当前依赖 CI 端到端裁决。

### 覆盖矩阵（每条长期主线的回归覆盖状态）

| 长期主线 | 阶段收口覆盖 | CI 端到端覆盖 |
|:---|:---|:---|
| #1 network-audit 默认白名单 | ✅ `packages/engine/src/runners/verification-runner.test.ts` + `network-audit.test.ts` | ✅ `pnpm run` verification job |

> 标注 `—` 的条目表示当前缺少自动化回归覆盖，是后续回归层扩面的候选方向。

### 漂移路由规则

回归验证发现的问题不自行修复，而是按以下规则路由到对应长期主线或短期候选：

| 回归发现问题 | 路由目标 |
|:---|:---|
| network-audit 真实注册表域新增诉求 / 命令输出 URL 阻断 regression | → 长期主线 #1（network-audit 默认白名单） |
| CI 失败 | → 当前阶段批次（无活跃阶段时登记 backlog 远期） |

## 短期 / 一次性候选任务（上收后去重）

> 共享说明：本区块条目当前均处于"候选评估中"或"延期暂缓"状态；正式上收阶段后从 backlog 移除并归档至 [todo-archive.md](todo-archive.md)。评估为"暂不实现"的候选直接关闭。

### 候选评估中（待评估 / 本阶段延后项）

- **PR Check 三源信号的 provider 原生日志富化（待评估）** —— 现象：M43.2 已完成三源（Checks + Commit Statuses + Deployments）归一化、聚合状态与失败源清单，但失败详情只到 provider / 信号层，**无 provider 原生 API 日志**（D2 裁定首批不做，留后续增量）。待评估点：是否接入 Vercel / Cloudflare / GitHub Actions 的原生失败日志拉取（需 provider 凭据承载面 + 配额控制 + 输出脱敏 + 单行 JSON 膨胀控制）。触发条件：用户报告「信号已失败但无日志可看」时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **零告警仓库的修复前基线采样成本（待评估）** —— 现象：M43.3 已使零告警仓库跳过 lockfile repair，但**修复前基线采样**仍执行一次完整验证链（其时机须早于修复动作写盘、无法后移），零告警仓库因此仍承担一次 install / verify 成本；同时该仓库的「处理成功」信号依赖修复后验证链的 `verificationPassed`（跳过会使多仓出口码判定退化）。待评估点：① 拆分 `prepareRepoFix` 的只读抓取与写盘两段，把「取告警」前移到基线采样之前，使零告警仓库完全不采样；② 或为零告警仓库引入显式「处理成功」信号以取代 `verificationPassed`。触发条件：零告警仓库占比高、install / verify 成为运行时长瓶颈时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **PR Check 告警关注集（可配置面）（待评估）** —— 现象：M43.2 的 D3 裁定为「全量只报警不阻断」（不引入配置面），因此任一非关注 check（如 provider 的 lint-only / preview 构建）失败都会进入告警面，长期可能产生噪音。待评估点：是否引入仓库级关注集（按 check 名 / provider / 状态过滤）以降低噪音，以及与「只报警不阻断」语义的兼容边界。触发条件：出现「告警噪音」反馈时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`alerts.vue` 存在一处闲置的 `useFixNow()` 解构（待评估）** —— 现象：`apps/platform/app/pages/alerts.vue` 顶部解构 `{ fixingRunId, fixError, fixSuccess, triggerFix }` 但全文件未使用（真正的「立即修复此仓库」入口在子组件 `alert-run-sidebar.vue`），伴随的注释也仍在描述已抽走的流程；该孤立实例同样不消费后加的 `fixMerged`。
  - **待评估点**：① 直接删除该解构 + 收敛注释（零行为风险）；② 或反向确认是否存在未接线的预期入口（若存在则补齐而非删除）。
  - **触发条件**：下次改动 `alerts.vue` 时（该文件已处 max-lines warning 带，顺带减法更划算）。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`architecture.md` 存在畸形 markdown 链接（未成对 `](`）（待评估）** —— 现象：`docs/design/governance/architecture.md` 的「监测系统 vs 自动合并解耦」表行末残留一处未成对的链接片段（`…experience-archive-§49-§57-recent-investigation.md#五十六) + …`），`check:docs` 因无法识别 `](` 而成对性静默跳过（不报错）。
  - **待评估点**：① 是否为重复拼接残留；② 自建链接校验器是否需补「未成对 `](` / `)` 计数」检测（当前只匹配合规 `](`）。
  - **触发条件**：下次改动该文件时；或加固 check-docs 链接校验口径时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **锚点回填的「链接文本 §N ↔ 锚点 §N」一致性缺少机检（待评估）** —— 现象：`check:docs` 只校验锚点**存在**，不校验链接文本声明的章节号与锚点所属章节是否一致；故「链接文本写 §五十六、锚点却指向 §五十」这类漂移在 `check:docs` 下**静默通过**（本次门禁落地批次的锚点回填实测命中 2 处，由审查阶段判 blocker 后发现）。
  - **待评估点**：① 是否在 `check-docs.mjs` 增补「`[x §N](target#anchor)` 形式的链接文本章节号须与锚点首段编号一致」断言（需处理中文数字 → 阿拉伯数字、`§5.1.x` 等复合形态与误报面）；② 或独立脚本 `check-anchor-text-consistency.mjs`；③ 误报面收敛策略。
  - **同族盲区（并入评估）**：VitePress 的**站点绝对链接**（`config.ts` 的 nav / sidebar `link:` 与 index frontmatter `link:`）`check:docs` 不校验，且 `ignoreDeadLinks: true` 下构建也不报错——该类死链只能靠人工 / 脚本核对（导航分层批次已用脚本逐条核对 0 死链）；建议同批评估是否一并纳入机检口径。
  - **触发条件**：再次出现锚点回填 / 批量链接改写批次时；或加固 `check-docs` 校验口径时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`design/packages/` → `design/modules/` 重命名的非导航面残留（待评估）** —— 背景：`docs/design/packages/` 已重命名为 `docs/design/modules/`，导航面（站点配置 + 首页卡片）已在门禁批次同步，但仍有非导航面残留未同步：
  - `scripts/distill-wisdom.mjs` 的迁移目标推荐串仍写 `docs/design/packages/`（蒸馏输出会把落点指向已不存在的目录）；
  - `docs/design/governance/docs-and-readme-i18n.md` 的现行陈述用旧目录名；
  - `docs/design/modules/index.md` 的 H1 仍为「模块设计（packages）」。
  - **待评估点**：① 三处一并订正（含脚本串 + 可能的单测断言）；② 是否与 [spec-and-doc-governance.md §1.2 问题 C](../design/governance/spec-and-doc-governance.md) 的既有记录合并处置。
  - **触发条件**：下次改动蒸馏脚本 / 设计文档索引时；或用户要求清理重命名残留。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **站点语言切换器对未翻译页指向不存在的 en 页（待评估）** —— 现象：VitePress 内建语言菜单按「当前路径 → 目标 locale 同路径」映射；对无 en 译文的页面（如 `plan/roadmap.md` / `plan/todo.md` / `standards/*` / `design/modules/*`）会生成 `/en-US/<同路径>` 链接，该页不存在 → 点「English」落 404（`ignoreDeadLinks: true` 下不报错，构建产物实测 `dist/plan/roadmap.html` 含该链接）。导航面（nav / 侧栏 / 首页卡片）已在门禁批次收敛为仅指向真实页面，本项为**剩余唯一非导航面死链来源**。
  - **待评估点**：① 是否为未翻译页提供 locale 兜底页（如指向 `/en-US/` 或 `/en-US/design/governance/architecture`）；② 还是接受现状（部分翻译站点常见行为）并在 i18n 规范中显式声明；③ 若需修，选型 = 主题层覆写 locale 菜单 vs 生成占位译文页。
  - **触发条件**：用户反馈语言切换落 404；或推进 en 翻译覆盖时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **设计文档存量超健康窗口（阈值表入表后暴露）（待评估）** —— 现象：文档行数阈值表统一（[文档规范 §3](../standards/documentation.md#3-文档行数阈值)）并接入计量脚本后，**存量**暴露为 warning 带 13 个文件 + 强制分片线豁免 1 个文件（`docs/design/governance/caomei-ui-migration.md`；清单以 `pnpm run check:doc-size` 输出为准，量级：warning 带 11 个设计文档 + `plan/roadmap.md` + `plan/todo-archive.md`）。
  - **待评估点**：① 是否按内容逻辑分批拆分至健康窗口（设计模块 / 治理设计 / 规划三类可分批）；② `caomei-ui-migration.md` 拆分方案（入链面广且 §15 迁移实证需保序）；③ 拆到 `archive/` 分片的命名与索引口径。
  - **触发条件**：用户要求清理文档体量；或某文件继续增长触发「强制分片」线时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`ai-collaboration.md` 跨段重复编号结构（历史遗留）（待评估）** —— 现象：该规范文件的 `## 1.4 P 阶段规划暂停协议` / `## 1.5 阶段归档检查…` / `## 1.6 …` / `## 1.7 …` 位于 `## 2. PDTFC+ 工作流` **之后**，且与 `### 1.4 单次提交审计阈值` 编号重复。经 `git show HEAD` 核对为历史遗留（非门禁批次引入）。
  - **待评估点**：① 是否重排为连续编号（牵动 7 处锚点引用，需按 [规划规范 §4.4](../standards/planning.md#44-大批量归档批次操作规范) 全仓更新）；② 或保留现状并在文件内加一行说明。
  - **触发条件**：再次改动该文件章节结构时；或用户要求清理编号。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **经验归档 `§49-§57` 分片文件名与内容范围不符（历史遗留）（待评估）** —— 现象：`docs/design/governance/experience-archive-§49-§57-recent-investigation.md` 实际内容覆盖 `§四十九 - §六十九`（文件名仍为 `§49-§57`）。H1 范围已在经验体系收敛批次订正，文件名未动。
  - **待评估点**：① 是否重命名为 `-§49-§69-`（牵动全仓引用，需按 §4.4 全仓更新）；② 或保留现状（文件名仅为分片标识）。
  - **触发条件**：再次改动该分片时；或用户要求清理命名。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **运行失败「受约束重试入口」（延后，保留待评估）** —— 「分类 + 筛选 + 展示」（`failure_code` / `failure_stage` / `failure_kind` 三列 + 三维筛选 + 阶段展示）已落地；设计稿 §5.5 的「仅 `transient` 可一键重试」入口（含非终态守卫 / 同仓库去重 / `retriedFromRunId` 审计来源）按用户 2026-10-06 决策延后。**现状锚点**：[run-failure-taxonomy.md §5.5](../design/governance/run-failure-taxonomy.md)。触发条件：① 分类 + 筛选上线后确认重试诉求；② 用户明确要求受约束重试。

- **扫描偏好服务端跨设备默认（延后，保留待评估）** —— 设备级方案 C 混合（localStorage：上次选择 + 可选配置化默认 + 重置）已落地；服务端用户 / 组织级默认偏好（跨设备、可管理，需实体 / API / 设置页，预计触发 governance 文档）按用户 2026-10-06 决策延后。**现状锚点**：`apps/platform/app/composables/use-scan-preferences.ts`。触发条件：① 用户实测多设备切换痛点；② 组织级统一默认诉求。

- **tech-stack 平台依赖表与 `apps/platform/package.json` 行级不一致（待评估）** —— `docs/guide/tech-stack.md` 核心框架表按 `^X.x` 粗粒度声明平台依赖，但其中 `@lucide/vue` 行写 `^1.48`（声明为 `^1.49.0`，区间仍覆盖但口径不同步）；`pinia` / `@vueuse/core` / `@vueuse/nuxt` / `@sentry/nuxt` / `@vite-pwa/nuxt` 5 行在 `apps/platform/package.json` 与 `nuxt.config.ts` 模块列表中**均无对应声明与引用**（疑似模板期占位行）。
  - **待评估点**：① 逐行核对整表与 `package.json` / `nuxt.config` 的对应关系；② 删除无引用行 vs 补声明（若确为规划中的能力）；③ 是否统一为「不写具体版本号，指向 package.json」以减少同类漂移。
  - **触发条件**：依赖变更需要核对文档时；或用户要求清理文档依赖表。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **队列 worker 进程按 role 跳过周期插件（待评估）** —— 独立 worker 进程形态的已知边界：worker 与 HTTP 进程共享同一 Nitro 产物，会重复启动 `stale-cleanup` / 启动期备份等周期插件（均幂等，代价为重复 DB 查询与日志）。
  - **待评估点**：引入 `DEPENDFIX_ROLE`（server / worker）让 worker 跳过 HTTP-only 插件；或按 `inProcessWorker` 条件跳过（注意单进程形态下该值为 true，不能跳过）。
  - **触发条件**：周期插件重复造成可观测噪声或资源浪费时；或用户要求。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`repo-history-dialog` history 模式与 legacy `/repos/[id]/runs` 页疑似无入口死代码（待评估）** —— 现象：全仓仅 `scans.vue` 以 `:query-key="'run'"` 挂载 `repo-history-dialog`；`repos.vue` 的历史入口已改为跳 `/scans?repository=`，故组件的 history 模式（list 视图 / 「返回列表」分支 / `queryKey='history'` 默认值）当前**不可达**；legacy 页 `app/pages/repos/[id]/runs.vue` 亦无站内链接（其注释引用的 backlog 删除候选已不存在）。
  - **待评估点**：① 删除 history 模式分支 + 收敛组件为单一 run 模式（减法）；② 或恢复 history 挂载点（若确有按仓库浏览历史的需求，可复用扫描页 `/scans?repository=` 路径）；③ legacy `/repos/[id]/runs` 页是否随 history 模式一并删除。
  - **触发条件**：组件 / 页面维护（如再次改动 `repo-history-dialog`）；或用户要求清理死代码。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`platform-scheduled-batch.md` 设计快照端点表 / 实体清单陈旧（待评估）** —— 现象：设计稿 `docs/design/governance/platform-scheduled-batch.md §6.1` 的定时计划 CRUD 端点表未登记新增的 `GET /api/schedules/monitor-status`（只读总开关状态端点），§3.1 实体清单仍无 `Schedule.kind` 列。该稿状态为「🔶 设计先行」快照，若后续被当作 API 契约参考会漏看新端点。
  - **待评估点**：① 是否将 design 快照视为需持续同步的契约（补 §6.1 端点表 + §3.1 实体字段）；② 或明确定位为「时点快照」并在阶段归档时统一回填。
  - **触发条件**：后续以该文档为 API 契约参考产生歧义；或用户要求同步设计稿。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`scans.vue` / `alerts.vue` 体量超 `max-lines` 上限（待评估）** —— 现象：`apps/platform/app/pages/scans.vue` 达 834 行（>800）触发 `max-lines` warning；`alerts.vue` 为同类存量债（833 行）。当前 lint 以 `--max-warnings 10` 通过，未阻断。
  - **待评估点**：① 抽取运行列表筛选工具栏（模板约 60 行）为独立组件，或抽 `exportLogs` 到 composable；② 是否一并治理 `alerts.vue`；③ 是否收紧 `max-lines` 阈值或引入 per-file 例外。
  - **触发条件**：两页继续增长致 warning 逼近上限；或用户要求清理。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **列表页筛选 / 分页能力的共享抽取（待评估）** —— 现象：`repos.vue` 与 `batch-runs.vue` 各自实现客户端筛选 + 重置 + 内建分页（形态相近但字段与语义不同），`scans.vue` 另有按仓库客户端分页实现；三处筛选 / 分页样板重复。展示口径统一批次（M42.5）判定两页形态尚未完全一致，故先页面内实现。
  - **待评估点**：① 抽取 `useClientTableFilter`（搜索关键字 + 筛选态 + 重置 + 过滤结果）的收益与形态约束；② 或仅抽「搜索 + 重置」最小面；③ 与组件内建分页的边界（分页本身不抽）。
  - **触发条件**：第四处列表页需要同类能力时；或筛选逻辑变更需多处同步时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **设置页严重级别查找与展示标签 helper 收敛（待评估）** —— 现象：`settings.vue` 内联实现 `find((option) => option.value === x)?.label ?? x`，与展示口径单一事实源的 helper 等价；该批次判定其已满足「同源查找」故未动。
  - **待评估点**：① 收敛到同一 helper（需处理设置页使用本地 computed 选项数组的差异）；② 或保持等价实现并注明。
  - **触发条件**：选项数组结构变更时；或设置页重构时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **镜像白名单：企业私服自带独立 CDN 域的补录（待评估）** —— 现象：镜像源动态发现只覆盖「配置面 registry 键的 host」；企业私服 tarball 若 302 到**独立 CDN 域**（与 registry 不同域），该域不在预置清单内 → 仍被 deny-by-default 拦截（交付时已登记为已知限制，需显式 `DEPENDFIX_ALLOWED_DOMAINS`）。
  - **待评估点**：① 是否按 302 `Location` 自动补录 CDN 域（可从审计记录观测补录）；② 或维持显式配置；③ 自动补录的安全边界（是否需用户确认）。
  - **触发条件**：出现企业私服 CDN 域被拦的实例；或用户要求自动化。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **文档中的「字面强调标记」存量破损（待评估）** —— 现象：部分历史文档存在未闭合 / 错位的强调标记（渲染后外露字面 `**`），`lint:md` / `check:docs` / `docs:build` 均不报错（属「合法 HTML、错误强调」类盲区）；归档批次实测 `archive/index.md` 七处 + `roadmap.md` 一处为存量（非该批引入）。
  - **待评估点**：① 是否引入「强调标记配对」机检（渲染级校验，覆盖 `archive/**` 等既有豁免面）；② 或一次性清理存量（需逐个判断是否为「本意字面」如代码示例内）。
  - **触发条件**：再次出现强调渲染破损；或加固文档渲染校验时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **浮层类组件视觉覆盖扩面（`Drawer` / `Tabs` / `Popover` / `Toast` 落点页）（待评估）** —— 现象：caomei-ui `0.6.0` 的浮层类语义变更（`drawer` / `popover-content` / `tabs-list` / `toast` / `color-picker` / `date-picker` / `multi-select` / `auto-complete` / `dropdown-menu-content` 背景改 `bg-elevated`、`popover` 圆角 `radius-lg`、`tabs` 列表 overflow 与分隔线重写）落在 `schedules.vue` / `scans.vue` / `alert-run-sidebar.vue` 等页面，而视觉回归最小集（M32.5 既定边界：alerts / repos / pr-checks / dialog-import-repos / login + `dialog-select-open-<theme>`）**不覆盖**这些落点页 → 该类变更当前只靠 e2e 行为断言兜底，无像素守卫。依据 [caomei-ui-migration.md §15.15](../design/governance/caomei-ui-migration.md#1515-caomei-ui-060-升级回归实证插队热修2026-10-12)。
  - **待评估点**：① 是否把这些落点页纳入视觉基线（页面级 vs 元素级；门户面板须视口级截图，模式见 [迁移评估 §15.14](../design/governance/caomei-ui-migration.md#1514-caomei-ui-050-升级实证m3422026-10-01) + `tests/visual/dialog-select-layer.visual.test.ts`）；② 覆盖优先级（`schedules` 表单浮层 > `scans` 弹窗 > `alert-run-sidebar`）；③ 基线数量与 CI 时长预算。
  - **触发条件**：再次出现组件库浮层类视觉变更未被门禁捕获；或用户要求扩面视觉覆盖。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`check-orphan-ids` 对「子任务字母后缀」形态编号的覆盖缺口（待评估）** —— 现象：`scripts/check-orphan-ids.mjs` 的 `PLANNING_ID_RE` 覆盖 `M\d{1,2}(\.(\d{1,2}|x))?`，**不含**子任务字母后缀形态（如 `M43.2a` / `M43.2b`）；源码注释或测试名写入该类编号时门禁报 0 命中（A 阶段审计实测：`M43.2b` 多处无文档指针仍通过）。
  - **待评估点**：① 扩展正则至 `M\d{1,2}(\.(\d{1,2}|x)[a-z]?)?` 并评估误报面（既有真常量白名单是否需同步）；② 或明确该类形态属「文档指针可省」并在注释规范中登记边界。
  - **触发条件**：再次出现源码注释引入子任务字母后缀编号而未被门禁捕获；或加固编号门禁时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`dialog-select-open-dark` 视觉基线的运行间非确定性（待评估）** —— 现象：`--update-snapshots=all` 重建时该基线多次产出与上一次不同但极接近的字节（实测差异约 28px / ratio 0.002% / maxΔ 35，集中在弹窗内 Select 面板的一小块区域），不带 update 复跑则稳定通过（差异远低于 `maxDiffPixels: 100` 预算）。2026-10-12~13 三次重建各复现一次（M43.1 / M43.2b / M43.2c 批次），均已还原为已提交版本。
  - **待评估点**：① 是否为暗色浮层阴影 / 抗锯齿在门户面板上的舍入抖动（需定位具体像素来源）；② 是否需扩大该基线的 `data-visual-mask` 覆盖区或改元素级截图；③ 是否接受为已知边界（当前不影响门禁判定）。
  - **触发条件**：该基线在**不带 update** 的复跑中失败（即超出容差）；或用户要求清理视觉基线噪声。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

### 待上收候选（评估完成，等待用户决策）

> 本节为「评估完成、等待用户决策」候选的暂存区；候选**不含 `M\d+` 阶段编号**（[规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement)）。

- **`git-signing.ts` 更名为 `git-isolation.ts`（待评估）**（P3，🛡️ 治理）—— 背景：该模块已承载「签名 + hooks」双语义（4 个隔离常量），但文件名仍只表达「签名」。
  - **本批已闭环的部分**：决策点「是否在 `docs/standards/git.md §3.8` 扩展 hooks 隔离子节」已于 2026-10-13 M43.5 落地——§3.8 改为「签名 + hooks，commit / push 双向隔离」单表 + 4 常量清单 + push 侧 `--no-verify` 口径；`code-quality-checklist` 对应矩阵行同步扩展。
  - **待评估点**：是否将 `packages/engine/src/github/git-signing.ts` 更名为 `git-isolation.ts` 并同步 `github/index.ts` re-export（公开 API）、平台侧 import、测试与 `git.md §3.8` 的路径引用。**未纳入 M43.5** 的理由：触及公开 API re-export 与平台侧多处 import，宜单独批次以保持改动面可控。
  - **触发条件**：下次改动该模块 / 公开 API 面时；或治理批次收敛模块命名时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

### 延期 / 暂缓项

- **T705 生产级部署**（PostgreSQL + Helm + Sentry）—— 2026-08-12 用户指示暂缓排期
- **T703 跨平台 Git**（GitLab + Bitbucket）—— 2026-08-12 用户指示暂缓排期
- **C30 Publish Docker build job 失败排查** —— 2026-08-18 用户决策暂缓（双平台构建 23m 2s 成功证明当前 docker.yml 可稳定工作）；恢复条件：① master 分支 push 频率显著提升；② 镜像实际发布成为强需求（v1.0.0 正式发布前）；③ 用户明确恢复
- **caomei-ui 0.x → 1.0 升级回归** —— 库处于 0.x（平台当前 `0.6.0`，2026-10-11 由 dependabot 升级、2026-10-12 完成升级回归，见 [caomei-ui-migration.md §15.15](../design/governance/caomei-ui-migration.md#1515-caomei-ui-060-升级回归实证插队热修2026-10-12)）。**剩余观察**：`1.0.0` 发布后的正式升级回归与「平台需跟进新组件能力」「用户明确恢复」两条触发条件。届时按 M31 迁移期实证索引（[caomei-ui-migration.md §15](../design/governance/caomei-ui-migration.md)）做回归；**升级回归的像素兜底已就位**（视觉回归基线 `apps/platform/tests/visual/`，覆盖 alerts / repos / pr-checks / dialog-import-repos / login，口径见 [测试规范 §6.7](../standards/testing.md)）
- **ScanResult 数据层去重（upsert 唯一索引）** —— 决策暂缓：应用层去重（fingerprint + occurrenceCount / firstSeenAt / lastSeenAt / affectedRunIds）已实施且满足当前业务需求；恢复条件：出现"fix 复用同一 `scan_run_id` 跨次刷新"或"历史 fixStatus 跨次保留"需求时迁移到数据层 upsert

### 远期登记 / 未排期增强候选

按主题分组：

#### MCP 能力

- **C37** 语言偏好多设备同步（当前仅单一设备语言偏好；多设备切换需重新设置；触发：用户实测反馈多设备用户；前置：服务端 API i18n 基础已就绪）

#### 多组织 / 多租户

- **D1** repo_admin + RepositoryAccess（实现仓库级 admin 角色区别于全局 admin；当前 owner 角色对仓库控制粒度不足；关联：C22 GitHub App 验证身份）
- **D3** 多租户组织体系（支持多个组织/org 共存；当前 single-org 模型限制 org 切换；前置：D1 仓库级权限；触发：org 场景用户痛点）
- **SAML 2.0 SSO**（D2 username 等待 SAML SSO 上后再决定 username 模型；当前 better-auth OIDC 优先）

#### 用户管理

- **D8** remove-user 关联资源检查（无 user→resource 关联时暂不需要；前置：先有 D1 资源关联表）

#### PR 管理

- **B2** 固定分支单线设计（独立平台部署后修复频率上升，需要固定修复分支如 `dependfix/auto-fix` 避免频繁向 master 提交 PR；触发：v1.0.0 后 M12 平台 UX 修复链路上线；关联：T210 指纹方案整合复用/重建策略 + force push 语义）

#### Code Scanning 规则体系

- **C15 Code Scanning B 类规则真实仓库样本核对（第二阶段）** —— 第一阶段（`sample-collector.mjs` 采集脚本 + 32 种子仓库跨 5 语言 fixture 占位 + 报告框架 `docs/research/code-scanning-b-class-samples.md`）；**剩余未闭环**：实际 GitHub API 样本采集 + 按需规则分级修正（`go/*` / `ruby/*` 补 `SUGGESTED_RULES`）。
  - **恢复条件**：CI / staging 环境具备 `GITHUB_TOKEN` 时执行 `node packages/engine/src/code-scanning/scripts/sample-collector.mjs --output=real-samples.json`，再据采集结果修正规则分级。
  - **不做**：不改 A/B/C 分层结构；不在无真实样本时臆测规则 id 变体。
  - **关联**：[docs/research/code-scanning-b-class-samples.md](../research/code-scanning-b-class-samples.md)（报告框架）
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 M\d+ 阶段编号**：等待用户明确决策启动

#### 网络优化

- **C68 Git 代理 / 镜像方案** —— 2026-09-04 实测发现：部分仓库（momei 25MB / caomei-auth 9MB）clone 持续超时（120s+），而大仓库（rss-impact-web 215MB）反而 12s 完成。根因：服务器到 GitHub CDN 网络质量差（实测 GitHub 下载速度 14KB/s vs 通用网络 629KB/s）。当前临时方案（超时 300s + 重试 3 次 + partial clone `--filter=blob:none`）可缓解但不治本。**只有代理才能根本解决网络问题**（tarball API 仍走 GitHub 域名，同样受限）。候选方案：
  - **方案 A：HTTP 代理** —— 配置 `http.proxy` / `https.proxy` 指向代理服务器；需运维提供代理基础设施
  - **方案 B：GitHub 镜像** —— 使用 GitHub Enterprise 镜像或自建 Git 镜像（如 Gitea/GitLab mirror）
  - **方案 C：Git 缓存代理** —— 部署 git-proxy 或 gitcache 缓存已 clone 的仓库，后续请求走缓存
  - **触发条件**：① 用户部署环境有可用代理；② clone 超时成为频繁阻塞问题；③ 运维提供镜像基础设施
  - **验收**：momei / caomei-auth clone 耗时 < 30s；无 TLS 错误；超时率 < 5%

#### 工作流

- **T905** git worktree 并行开发预案（触发条件：多 agent 并行开发成为常态；当前单 agent 工作流无需启用）

## 待人工验收（真实环境，随可用性推进）

> 以下条目为需真实环境（外部凭据 / 真实 Redis / staging 等）的验证任务，保留随可用性推进。

### T701 真实凭据 3 项

平台 OAuth / OIDC / 凭据配置相关真实环境验证：

- 真实 GitHub / Google OAuth 登录闭环（需 OAuth App 凭据）
- 真实 IdP OIDC 登录闭环（需 RFC 9207 iss 回显支持）
- 构建期配置凭据后按钮显示路径实测

### T702 HTTP 层状态流转

扫描 run 状态对外接口（pending → running → completed）真实环境验证：

- 状态流转时间序列正确性（pending → running → completed 端到端）
- 前端轮询体验与 stale state 处理（需后台服务 / staging 或 CI redis service）

### PR Check 真实 polling（总开关启用后）

- `ACTION_STATUS_MONITOR_ENABLED=true` 下的真实 polling 链路（手动触发端点 + 定时计划触发）需真实 GitHub 凭据与网络：
  验证「按 credential 聚合 → Octokit → 轮询写入 PRCheck」端到端；单次仓库上限与截断披露行为一并观察。

### T704 async 定时触发

定时任务真实环境验证：

- 真实 Redis >= 5 环境下 `TEMP_REDIS_INTEGRATION=true` 跑 BullMQ 集成测试
- staging / 后台服务下的调度轮询体验与 stale state 处理验证

### 发布管线收尾（P3）

- `release:auto-version` 完整流程待 schedule 启用后首个 cron 裁决
- main 副作用路径测试观察项

## 已知边界与 known-issue

### SQLite 单文件脆弱性 + TypeORM synchronize 风险（持续观察）

- **背景**：2026-09-01 `apps/platform/data/dependfix.sqlite` 业务数据被清空事故（详见 [经验归档 §五十](../design/governance/experience-archive-§49-§57-recent-investigation.md#五十sqlite-数据库业务数据被清空开发环境不可恢复事故2026-09-01)）。代码内无清空路径，最可能清空来源在代码外部（shell / CI / 运维）。
- **防御现状**：事故防御加固已完成（启动期备份 / db-restore / db-doctor / synchronize + migrationsRun 双 opt-in / e2e fixtures 双门控），规范见下方"规范挂接"。
- **持续观察项**：
  - TypeORM 1.x 升级 / 替换为 0.3.x（1.x 已停止维护）—— 当前无明确上收时机，待后续评估
  - PostgreSQL 多写者迁移 —— 当前 single-org 模型限制（依赖 D3 多租户组织体系上线），D3 未上收
  - better-sqlite3 WAL 模式启用 + auto-checkpoint 调整（减少断电时数据丢失风险）—— 已落地 `journal_mode=WAL`，但 better-sqlite3 库升级路径未评估
  - SQLite 文件 inode 监控（`fs.watch` 检测 .sqlite 文件被外部 rm / rename 触发紧急备份）—— 与启动期备份互补，可作后续加固
- **规范挂接**：[development.md §5.1.18](../standards/development.md) + [§5.1.19](../standards/development.md) + [platform.md §3.6](../standards/platform.md) + [§3.7](../standards/platform.md) + [security.md §2.1](../standards/security.md)

### E2E global-setup 串行场景 ECONNRESET 根因（持续观察）

- **已落地（部分闭环）**：~~候选 ②（Nitro h3 async generator）~~ 已 M24.2 commit `bbb8f30` 判定非根因；~~候选 ③（SQLite WAL + `busy_timeout`）~~ 已 M23.1 commit `2ffaa45` 治本落地；候选 ④（fixtures API 节流）为 M24.2 commit `bbb8f30` 登记的经验性 follow-up；helper 层兜底 `maxRetries: 2` 已 M22.7 commit `f617b56` 落地。
- **剩余未闭环**：候选 ① better-auth 1.7 transaction 关闭时序 —— 诊断基础设施已 M27.5 commit `b252f93` 落地（`AUTH_TRACE=1` / `E2E_TEST=true` 双开关），待 CI 复现一次确认是否仍存在 ECONNRESET。
- **触发条件**：CI E2E job 再次出现 global-setup 末尾 `DELETE /api/e2e/fixtures` → `ECONNRESET` 时，开启 `AUTH_TRACE=1` 跑一次定位；如复现 fixture 并发问题按经验性模板 `apps/platform/server/utils/fixtures-throttle.ts` 加 100ms 节流（见 [platform.md §3.7.1](../standards/platform.md#371-fixtures-api-无节流默认--节流触发条件)）。

### tsdown hash:false 下 entry 与共享 chunk 文件名冲突（持续观察）

- **背景**：2026-09-28 修复 engine 多 entry（`index` + `auth`）构建产物的 dts 入口错位——`hash: false` 时 entry 与共享 dts chunk 争用 `index.d.mts`，入口声明被挤出 `index2.d.mts`，而 `packages/engine/package.json#types` 指向 `index.d.mts`，导致 `apps/platform` 解析不到 engine 导出（TS2305）。
- **已落地**：engine `tsdown.config.ts` 用 `outputOptions.chunkFileNames` 把 chunk 统一隔离到 `chunks/` 子目录，entry 名保持稳定（chunk 名解析用 `chunk.name.slice(0, -2)` 而非占位符，规避 tsdown 升级回归）。
- **持续观察项**：`packages/core` / `packages/cli` / `packages/mcp` 当前无名为 `index` 的共享 chunk（dist 无 `index2` 冲突），故未做预防性改动；若未来某包出现「多 entry 共享 dts 声明」形成名为 `index` 的共享 chunk，需同样加入 `outputOptions` chunk 隔离。
- **触发条件**：任一 `packages/*` 构建后 `dist/` 出现 `index2.d.mts` / `index2.mjs`，或下游对该包类型解析报 TS2305。

### apps/platform `.output` 不随根构建脚本重建（操作提醒）

- **背景**：根构建脚本 `pnpm -r --filter "./packages/*" build` 不含 `apps/platform`，`.output` 需单独构建。
- **影响**：类型侧由 `nuxt typecheck` 覆盖；但涉及 `packages/*/dist`（如 engine chunk 结构）变更后，容器 / 运行时冒烟前需重建 `apps/platform/.output`，否则可能引用旧产物。
- **触发条件**：① 需要容器 / 运行时冒烟验证依赖 `packages/*/dist` 的变更时；② 跑 `apps/platform` e2e 或**视觉回归**（`pnpm --filter @dependfix/platform test:visual`，M32.5）前——两者都跑 `.output` 产物，源码改动不重建则验证的是旧产物（假绿；M32.1 / M32.5 均实证）。

### 依赖审计豁免复核（node-forge / braces，持续观察）

- **背景**：2026-10-05 weekly regression 因 `security:audit-deps` 阻断失败——node-forge ≤ 1.4.0（GHSA-86w9-cpqp-85rv）与 braces ≤ 3.0.3（GHSA-vfj7-8cjw-p6xm）为 high，但 advisory 声明的 patched 版本（1.4.1 / 3.0.4）**尚未发布**，overrides / `pnpm update` 无法解析。经用户决策（方案 A，调整为配置文件实现）在 [pnpm-workspace.yaml](../../pnpm-workspace.yaml) `audit.ignore` 显式豁免。
- **机制与复核**：以 `pnpm-workspace.yaml` `audit.ignore` 显式豁免（只过滤列表内编号，未列入的新漏洞仍使 `pnpm audit` exit 1）；机制、禁止项与复核条件以 [security.md §5.7](../standards/security.md#57-无可用修复版本漏洞的审计豁免auditignore2026-10-05) 为唯一权威，本条不重复。
- **复核条件**：node-forge 发布 > 1.4.0 或 braces 发布 > 3.0.3 后，移除 `pnpm-workspace.yaml` 对应条目并复跑 `pnpm audit --prod --audit-level=moderate --registry=https://registry.npmjs.org`。
- **触发条件**：每周回归 / 依赖升级 / 上游发布修复版本时复查。
- **可选增强**：以调度任务自动比对 `npm view node-forge version` / `npm view braces version` 探测上游修复发布，避免豁免长期挂账（暂未实现）。

---

## 文档位置速查

| 内容类型 | 位置 |
|:--|:--|
| 当前阶段活跃任务 | **暂无进行中阶段**——上一闭环阶段 M43（PR Check 能力补强 + 运行时可靠性与工程治理，6 原子条目，2026-10-14 归档）见 [todo-archive.md §M43](todo-archive.md#m43-pr-check-能力补强--运行时可靠性与工程治理2026-10-12-用户决策方案-a--2026-10-14-归档) |
| 下一阶段（未授权） | 无——按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 评估本文件候选池后由用户决策 |
| 已完成阶段归档 | [todo-archive.md](todo-archive.md)（主窗口 + [archive/](archive/) 分片） |
| 里程碑与阶段交付 | [roadmap.md](roadmap.md) |
| 长期主线 / 候选 / 待人工验收 / 已知边界 | 本文档（按四象限结构） |
| 历史归档索引 | [archive/index.md](archive/index.md) |
