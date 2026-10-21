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

> **扩面状态（2026-10-14 订正）**：周级入口**已建立并接线**——三个 profile 脚本（`scripts/regression/run-periodic-regression.mjs`，`package.json` 的 `regression:weekly` / `regression:pre-release` / `regression:phase-close`）+ [`.github/workflows/regression-weekly.yml`](../../.github/workflows/regression-weekly.yml)（每周五定时 + 手动触发，不阻断合并）；报告落点 `docs/reports/regression/current.md`（窗口注释自动维护）。**剩余待评估**：① 发版前入口与实际发布流程（[`.github/workflows/release.yml`](../../.github/workflows/release.yml)）的接线口径（当前仅本地手动可跑）；② 阶段收口入口（`regression:phase-close`）是否替换上方「阶段收口前」一行的手写 5 项组合（当前为并行两套口径）。

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

- **`quick-start` 指南的 en-US 镜像为裁剪子集（行级漂移）（待评估）** —— 现象：`docs/guide/quick-start.md`（408 行 / 命令行参数表 25 行）与其镜像 `docs/i18n/en-US/guide/quick-start.md`（133 行 / 11 行）结构不同源——镜像缺 `--commands` / `--history` / `--verbose` / `--commit` 等多行（2026-10-15 核对 `rg -c '^\| \`--'` 实测 25 vs 11）。该漂移属既有状态（本轮改动 `--commands`行时发现镜像无对端），`docs:check:i18n`仅查重复页、`check:readme-i18n` 仅覆盖 README，故无机检。
  - **待评估点**：① 是否补全镜像参数表（逐行对齐 zh，成本为一次性翻译同步）；② 或明确「en 侧为对外精简版」定位并在 i18n 新鲜度台账登记该差异（避免后续批次反复判定为遗漏）。
  - **触发条件**：下次 i18n 新鲜度同步批次；或再次改动 `quick-start` 参数表时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`alerts.vue` 存在一处闲置的 `useFixNow()` 解构（待评估）** —— 现象：`apps/platform/app/pages/alerts.vue` 顶部解构 `{ fixingRunId, fixError, fixSuccess, triggerFix }` 但全文件未使用（真正的「立即修复此仓库」入口在子组件 `alert-run-sidebar.vue`），伴随的注释也仍在描述已抽走的流程；该孤立实例同样不消费后加的 `fixMerged`。
  - **待评估点**：① 直接删除该解构 + 收敛注释（零行为风险）；② 或反向确认是否存在未接线的预期入口（若存在则补齐而非删除）。
  - **触发条件**：下次改动 `alerts.vue` 时（该文件已处 max-lines warning 带，顺带减法更划算）。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **扫描偏好服务端跨设备默认（延后，保留待评估）** —— **来源**：[issue #136](https://github.com/dependfix/dependfix/issues/136)（该 issue 的设备级需求已随 M37.2 交付，2026-10-15 关闭；本条保留其范围外的服务端默认部分）。设备级方案 C 混合（localStorage：上次选择 + 可选配置化默认 + 重置）已落地；服务端用户 / 组织级默认偏好（跨设备、可管理，需实体 / API / 设置页，预计触发 governance 文档）按用户 2026-10-06 决策延后。**现状锚点**：`apps/platform/app/composables/use-scan-preferences.ts`。触发条件：① 用户实测多设备切换痛点；② 组织级统一默认诉求。

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

- **`check-orphan-ids` 对「子任务字母后缀」形态编号的覆盖缺口（待评估）** —— 现象：`scripts/check-orphan-ids.mjs` 的 `PLANNING_ID_RE` 覆盖 `M\d{1,2}(\.(\d{1,2}|x))?`，**不含**子任务字母后缀形态（如 `M43.2a` / `M43.2b`）；源码注释或测试名写入该类编号时门禁报 0 命中（A 阶段审计实测：`M43.2b` 多处无文档指针仍通过）。
  - **待评估点**：① 扩展正则至 `M\d{1,2}(\.(\d{1,2}|x)[a-z]?)?` 并评估误报面（既有真常量白名单是否需同步）；② 或明确该类形态属「文档指针可省」并在注释规范中登记边界。
  - **触发条件**：再次出现源码注释引入子任务字母后缀编号而未被门禁捕获；或加固编号门禁时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`dialog-select-open-dark` 视觉基线的运行间非确定性（待评估）** —— 现象：`--update-snapshots=all` 重建时该基线多次产出与上一次不同但极接近的字节（实测差异约 28px / ratio 0.002% / maxΔ 35，集中在弹窗内 Select 面板的一小块区域），不带 update 复跑则稳定通过（差异远低于 `maxDiffPixels: 100` 预算）。2026-10-12~13 三次重建各复现一次（M43.1 / M43.2b / M43.2c 批次），均已还原为已提交版本。
  - **2026-10-16 补充证据（本候选不闭环）**：① **归属订正**——M44.1（2026-10-14）起连续 5 次 push 的 `Visual Regression` 红**不是**本现象：其差异为 2080 / 2403 px 且跨运行**逐字相同**，根因是 i18n 提示语补入 `typecheck` 造成的基线连带失配（已重建，见 [todo.md](todo.md)）；② **新增实证（指向 update 落盘路径）**——构建后**首次** `--update-snapshots=all` 落盘的帧与随后连续三次 no-update 帧在弹窗遮罩下的表格区（y 298-419）差约 4k 像素，**二次** update 与 no-update 帧逐字节一致 ⇒ 观察对象从「基线本身漂移」移到「update 路径落盘帧非稳定」，故「重建后不带 update 连跑复核」已升为规范条款（[testing.md §6.7](../standards/testing.md)）。
  - **待评估点**：① 是否为暗色浮层阴影 / 抗锯齿在门户面板上的舍入抖动（需定位具体像素来源）；② 是否需扩大该基线的 `data-visual-mask` 覆盖区或改元素级截图；③ 是否接受为已知边界（当前不影响门禁判定）；④ 是否在基线维护协议层面消除 update 落盘路径差异（统一「重建 + 连跑复核」两步产出基线，或对 update 产物加稳定帧二次取帧）。
  - **触发条件**：该基线在**不带 update** 的复跑中失败（即超出容差）；或用户要求清理视觉基线噪声。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **归档索引表格行的成对错位强调（`**；**` 形态，待评估）** —— 现象：`docs/plan/archive/index.md` 的 M16 / M17 等历史归档行内含 `` `**；**` ``（成对但无强调语义，渲染为加粗分号），系早期批次书写惯例遗留；此类 `**` 计数为**偶数**，`check-docs` 的 `emphasis` 规则按定义只覆盖**未配对**（奇数计数）形态（[文档规范 §2](../standards/documentation.md) 已把「成对但语义错位」声明为显式盲区）。
  - **待评估点**：① 是否统一清理（涉及多行同形，宜独立批次以保持归档排版一致）；② 或维持现状并在规范注释中作为盲区实例保留。
  - **触发条件**：归档索引再次批量编辑时；或用户要求清理归档排版。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **归档目录内 file-dead 相对链接前缀治本（待评估）** —— 现象：`docs/plan/archive/**` 的历史相对链接存在**目录前缀错误**（如从 `docs/plan/archive/` 引出 `../standards/…` 或 `../../design/governance/…`，实际应为 `../../standards/…` / `../../docs/design/governance/…`）；`check:docs` 的 links 面（file-dead）对该目录整体豁免（见 [md-walk 决策注释](../../scripts/shared/md-walk.mjs)），故长期不可见。
  - **待评估点**：① 是否对归档目录做一次路径前缀重指（使 `archive-anchors` 的跨文档锚点子集真正生效，消除该永久盲区）；② 或维持豁免并保留注释登记为既定边界。
  - **触发条件**：归档链接前缀批次立项；或用户要求清理归档死链。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **经验归档分片范围声明口径与段序（待评估）** —— 现象：分片命名存在两套口径——`experience-archive-§70-§99-delivery-platform.md` 按「建立时规划上界」命名（实际内容仅至 `## 七十二、`），而 `§1-§21` / `§49-§69` 等按**实测内容范围**命名；另 `experience-archive-§29-§35-integration.md` 内 `## 三十二、` 段排在 `## 二十九、` 之前（段序异常，范围本身齐备）。M44.3 已把 `§49` 分片的「文件名 / H1 / 内容范围」三方对齐，本条为同源剩余口径。
  - **待评估点**：① 统一「分片范围 = 实测内容范围」还是「= 建立时规划上界」并写入分片维护约定；② 段序是否按编号归位。
  - **触发条件**：新增 / 扩容经验分片时；或用户要求清理归档排序。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **zh 设计文档拆分后的 en-US 镜像结构漂移（待评估）** —— 现象：M44.4 分片化改造仅作用于 zh 事实源（`docs/design/**`），`docs/i18n/en-US/design/governance/{architecture,platform-ai-integration}.md` 等镜像仍为未拆分全量译文；镜像不在 `check-doc-size` 计量面（阈值表 glob 为 `docs/design/governance/*.md`）、`docs:check:i18n` 仅查 legacy/i18n 重复页，故该漂移无机检。**待评估点**：① 镜像是否随 zh 结构同步拆分（成本较高）；② 或在 i18n 新鲜度台账登记「zh 结构 → 镜像结构」映射并在后续同步批次对齐。
  - **触发条件**：下次 i18n 新鲜度同步批次；或 zh 侧继续分片化时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`caomei-ui-migration.md` 存量超标的保序拆分（待评估）** —— 现象：`docs/design/governance/caomei-ui-migration.md` 940 行（治理设计阈值 ≤400 / 强制分片 >700），由 [check-doc-size 豁免表](../../scripts/check-doc-size.mjs) 逐条登记（理由：阈值入表时即超标、入链面广、§15 迁移实证需保序）。本批已产出拆分方案：**主文档保留 §1-§11**（实测 387 行 + 分片索引，仍 ≤400）、**分片 A = §12-§14**（上收触发条件 / 关联文档 / 文档元数据）、**分片 B = §15.1-§15.10**（169 行）、**分片 C = §15.11-§15.15**（339 行）（§15 内部按子节保序切分，三处分片均 ≤400）；落点命名 `<slug>-<主题>.md` 同级；拆分后须移除豁免表条目并重指入链（§15 被 experience-archive / caomei-ui-migration 迁移评估 §15.x 等引用）。
  - **待评估点**：① 是否按上述方案执行（独立内容治理批次）；② 或维持豁免（当前状态）并在豁免理由中保留「待该批次落地后移除此条」。
  - **触发条件**：启动独立内容治理批次时；或该文档再次增量更新时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`architecture.md` 技术选型表含未采用的 momei 复用项（待评估）** —— 现象：`docs/design/governance/architecture.md` §技术选型表列出「监控 | Sentry（`@sentry/nuxt`）| momei」「PWA | `@vite-pwa/nuxt` | momei」等条目，而在全仓无依赖声明与源码引用（M44.6 已核对 `apps/platform/{package.json,nuxt.config.ts,app,server}`；`docs/design/governance/architecture.md` 等文档级提及属复用参考表，非声明）。该表有「来源」列显式标注 momei（属复用参考而非「当前已采用」断言），但读者可能误读为现状。
  - **待评估点**：① 加一句口径说明（表为 momei 复用参考，未采用项不在此表承诺）；② 或对未采用项加「未采用 / 暂缓」标注（Sentry 对应 backlog T705 暂缓项）。
  - **触发条件**：下次改动 `architecture.md` 或技术选型复核批次。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`docs/standards/ai-collaboration.md` 已处 200 行健康上界（待评估）** —— 现象：该文档当前 200 行（`docs/standards/*.md` 阈值：≤200 健康 / 201-400 warning），M44 归档批次新增审计条款时因越界被迫改落 `testing.md §6.12`。**待评估点**：① 下次需扩条时先做结构压缩（合并同源小节）；② 或按 [文档规范 §3](../standards/documentation.md#3-文档行数阈值) 拆分子文档（如「审计协议」独立篇）。**触发条件**：下次需向该文档新增条款时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **归档链接使用 `--`（双连字符）锚点形态在浏览器侧为死锚（待评估）** —— 现象：`docs/plan/**` 中 M4x 归档链接普遍写作 `#m43-pr-check-…--2026-10-14-归档`（双连字符），而 VitePress 构建产物 id 收敛为**单连字符**（实测 `id="m43-pr-check-能力补强-运行时可靠性与工程治理-2026-10-12-用户决策方案-a-2026-10-14-归档"`）；客户端路由 `getElementById(decodeURIComponent(hash).slice(1))` 不做归一化 → 点击锚点无法滚动到目标段（页面可正常加载）。`check:docs` 的 `normAnchor` 剥离全部标点（含 `-`）→ 门禁不报。**该形态在 HEAD 已普遍存在（M41/M42/M43 等），非 M44 归档批次引入**。
  - **待评估点**：① 批量把归档链接的 `--` 收敛为单连字符（并核对构建 id）；② 或在 `check-docs.mjs` 增加「锚点归一化后仍需与产物 id 一致」的规则（可机检子集 + 白名单）。
  - **2026-10-15 M45 规划批次实测补充**：以 `docs:build` 产物 id 为权威复扫后，文档侧锚点与产物 id 存在**两类**系统性差异——(a) 非词字符（`:` / `/` / `（` / `.` / `~`）在产物侧转为单连字符（`M45: 收口（2026…A / 进行中）` → `m45-收口-2026…-a-进行中`），文档侧「去标点 + 空格转连字符」写法（含 `--`）与之不符；(b) **数字开头的章节号在产物侧带 `_` 前缀**（`### 1.1 硬性约束` → `_1-1-硬性约束`，文档侧普遍写 `#11-硬性约束`）。同批复扫另发现**存量缺段锚点 2 处**（`roadmap.md:41` 与 `archive/index.md` 指向 M31 归档段，缺段产物 id 为 `m31-apps-platform-ui-组件库迁移-primevue-→-caomei-ui-m31-1-m31-6-全部已闭环-2026-09-29-归档`）。**本批处置**：新增的 **M45 目标锚点**按产物 id 实证形态书写（如 `#m45-…-2026-10-15-用户决策方案-a`），不新增同类死锚；本批新增行中**沿用存量家族形态**的链接（指向 `planning.md` / `platform.md` / `caomei-ui-migration.md` / `todo-archive.md` 的 11 处，均为既有写法的复用）**不随本批改写法**——统一迁移归本候选（含上述 2 处缺段），以免在单批内制造同文件双形态。复现命令：`pnpm run docs:build` 后 `rg -o 'id="[^"]*"' docs/.vitepress/dist/plan/todo.html`。
  - **触发条件**：下次归档批次或文档门禁扩面时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **M44 蒸馏新增条款的检查点挂接与配套收敛（待评估）** —— 现象：M44 阶段归档批次蒸馏新增 12 条严格约束（`planning.md §4.4` 第 16-20 条 / `testing.md §6.12` / `documentation.md §6` 五条），但 `code-quality-checklist.md` 的「规范条款 review 检查点矩阵」与 `code-auditor.agent.md` 必查项**均无对应行**（R1 分区 B 审计标记为「待补挂」）；另有 2 条 pattern 未落任何权威文档（「门禁规则扩面前先跑一次性探针量化分布」「E2E 取证临时仓库不要软链 node_modules」），及 3 处新条与既有条款主题重叠（`documentation.md §6` 量化断言 ↔ `planning.md §2.5`；`documentation.md §6` 引用范围措辞 ↔ 同节覆盖面声明；`planning.md §4.4` 第 18 条 ↔ 第 3 条）。
  - **待评估点**：① 矩阵 / agent 必查项补挂（建议至少覆盖 §4.4 第 16/18 条、`testing.md §6.12`、`documentation.md §6`「断言复现运行期真实条件」「非门禁面缺陷」）；② 2 条未落点 pattern 补写落点（或改判废弃）；③ 3 处重叠改为交叉引用收窄。
  - **触发条件**：下次改动上述规范文件 / 文档门禁扩面 / 阶段归档批次。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **运行日志的语义订正与构建版本回执（待评估，P2 📚）** —— 现象（2026-10-17 生产实证）：① `Lockfile repaired for <repo> (strategy: N/A)` 的实际语义是**诊断步发现 lockfile 本就合规、未做任何改动**（`packages/engine/src/fixers/pnpm/index.ts:439-451` 直接 `return { success: true, diff: null }` ⇒ 无 `strategy`；日志行 `packages/engine/src/app/helpers.ts:564-568`），该文案与紧随其后的 `No changes to commit` 组合后被读成"修好了但没提交"；② 本次复盘的首要动作变成"反推线上构建是否含某提交"——`todo.md` §M45 追加临时待办②/③ 的留痕提交（`7f01d3bc` / `701f55f7`）已入库但当日批次日志无对应行，仅能靠时间线推断构建陈旧。
  - **待评估点**：① 文案改为「lockfile 已合规 — 无需修复」类中性表述（并核对报告 / PR 正文契约串的消费者）；② 引擎运行起始输出**构建版本 + commit**（或平台在 run 记录落构建版本），使"日志缺留痕"可一眼区分「构建旧」与「代码路径未覆盖」；③ 与用户计划中的 Jenkins webhook 镜像推送部署联动（部署回执与 run 记录对齐）。
  - **触发条件**：用户计划引入自动构建/部署（Jenkins webhook → 镜像推送）时；或下次需要判定"线上是否含某提交"时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **验证链与目标仓库 CI 命令对齐 / 默认分支 workflow 健康预检（待评估，P2 🛠️）** —— 现象（2026-10-18 生产复盘）：dependfix 的验证链是固定默认链（`install → lint → build → typecheck → test`），不读取目标仓库 `.github/workflows/*.yml`；`rss-image-download#103` 的 CI 不跑 `pnpm test`，dependfix 却因「No test files found」把 test 标成既有失败；`hexo-cloudflare-counter#114` 的 CI 不跑 typecheck，dependfix 却因 TS 6 的 `TS5101 baseUrl` 标红；`cookie-cloudflare#84` 的 CI 只跑 install/lint/build，而合并后的 `Publish Docker` 失败（阿里 ACR OCI attestation）完全不在验证面内。结果：PR 正文的红字与 GitHub CI 的绿/红不是同一口径，用户难以判断「PR 是否真的过 CI」。
  - **待评估点**：① 是否按仓库读取 `test.yml` 的 `run:` 命令作为 `verifyCommands`（需处理 matrix / secrets / services / 多 job，建议先做「检测到差异时在 PR 正文告警」的保守版）；② 是否在建 PR 前查询默认分支最近 workflow 结论，若同 workflow 已红则在 PR 正文标注「非本 PR 引入」；③ 是否在 PR 创建后回读 check runs 并在失败时评论 / 关闭（成本与时序需评估）。
  - **触发条件**：用户再次以「PR 正文红但 CI 绿 / PR 绿但合并后红」报告困惑时；或新增仓库级 `verifyCommands` 配置面时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **基线红 / 安装失败的交付降级策略（draft PR / issue / 人工确认）（待评估，P2 🎨）** —— 现象（2026-10-18 生产复盘）：P0 交付正确性批次已实现「修复后安装仍既有失败 → 不建普通 PR」，但被跳过的告警仍只剩报告与日志，用户没有「可跟踪的待办载体」。`nest-template#2421` 的基线 lockfile 本身损坏，正确处置可能是开 issue / draft PR 说明「先修 lockfile」，而不是静默跳过。
  - **待评估点**：① 是否支持 `DEPENDFIX_ON_BASELINE_RED=skip|issue|draft`（默认 skip，保持当前行为）；② issue / draft PR 的标题、正文、标签与去重键（复用 `findDependfixOpenPR` 还是新 issue 查询）；③ 与 `PRE_EXISTING_FAILURE` / `alertsSkipped` 记账的衔接，避免同一原因反复开单；④ 交付被跳过仍为 exit-code 中性（`PRE_EXISTING_FAILURE` 在跳过类白名单），CI 无法从退出码感知「要求交付但未交付」——是否补一个**非归因但可见**的交付跳过信号（summary 字段 / 平台 run 状态 / UI 标记）。
  - **触发条件**：用户要求「0 修复也要有可跟踪记录」；或 baseline 红仓库占比持续升高时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **交付类同步调用未纳入运行级取消面（待评估，P2 🛠️）** —— 现象（2026-10-17 审计派生）：本轮把安装 / 锁文件修复 / 验证三类长命令迁到受管异步执行并纳入取消面，但 `github/pr-creator.ts` 的 `git push` / `git commit` 与 `app/helpers.ts` 的仓库状态查询仍是同步子进程调用 —— 弱网下 `git push` 会持续阻塞事件循环（平台执行超时定时器、队列锁续期与 HTTP 同族阻塞面的残留），且不受取消守卫覆盖（[executor-process-isolation.md §8.5](../design/governance/executor-process-isolation.md#_8-执行超时与运行级取消-2026-10-17) 已声明覆盖边界）。
  - **待评估点**：① 交付类调用是否迁移到受管异步执行（含 push 的进度输出与错误证据面）；② 短命令（版本探测 / 仓库状态查询）是否顺带收敛或维持豁免并写明理由；③ 与「推送失败留痕 / 恢复」既有链路的交互。
  - **触发条件**：弱网 / 大仓场景下再次出现「超时定时器延迟触发」或推送期间平台无响应。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **lint-staged 配置内的裸 `git add` 任务会全量暂存工作区（待评估，P2 🛠️）** —— 现象（2026-10-17 本批实证 3 次）：`package.json` 的 `lint-staged` 任务里 `*.{js,ts}` / `*.{css,scss,vue}` / `*.md` 三条均以裸 `git add`（无路径参数）收尾，lint-staged 自身已会重暂存其修改过的文件，该任务**额外把整个工作区未暂存改动一并入索引** ⇒ 同一工作区里的下一篇文档 / 下一个提交的文件的改动被"抢先"混入当前 commit（本批实测：引擎修复提交混入 `backlog.md`、规范文档提交混入 `todo.md`），原子提交边界失效；husky 另会打印「tasks use `git add`」告警。审计侧核对「commit 与内容归属」时表现为归属不符。
  - **待评估点**：① 直接移除三条任务里的裸 `git add`（lint-staged 自动重暂存已覆盖）；② 或改为带路径的形式（`git add -- <匹配文件>` 无意义，因为 lint-staged 已做）；③ 是否同时收紧 `packages/skills/**` 那条（该条带路径参数，属正确形态，可作为对照）。
  - **触发条件**：再次出现「提交内容与 commit 主题不符」或审计标记归属问题；或整理提交钩子配置时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **pnpm store 持久化与项目内 store 的提交卫生（待评估，P2 🚀 性能 / 🛡️ 技术债）** —— 现象（2026-10-18 安装失败复盘）：平台按 run 创建 `workRoot/<runId>` 并在结束时删除；当工作目录与 `$HOME` 位于不同文件系统时，pnpm 把 content-addressable store 放在项目内（实测 `/work/.pnpm-store/v11`），随 run 清理消失 ⇒ 每个仓库都是冷安装（大仓 2000+ 包、网络抖动时直接放大超时 / OOM 概率）。同时 `.pnpm-store/` 未被目标仓库 `.gitignore` 覆盖，而 `stageAndCommit` 使用 `git add .`——一旦有真实修复，存在把整份 store 提交进目标仓库的风险。
  - **待评估点**：① 是否把 `store-dir` 固定到持久卷（如 `/app/data/pnpm-store`）并配置容量 / 定期 GC；② 提交前是否统一把 `.pnpm-store/`（以及防御性 `node_modules/`）写入目标仓库 `.git/info/exclude` 或临时 `.gitignore`，避免 `git add .` 误收；③ 多仓库共享 store 的并发 / 权限边界（当前队列并发 1，风险可控）。
  - **触发条件**：再次出现冷安装导致的超时 / OOM；或平台部署批次调整数据卷 / 缓存策略时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **独立 installer 容器 / runtime 工具链移出（待评估，P2 🛡️ 安全 / 🚀 体积）** —— 背景（2026-10-18）：runtime 阶段补 `python3 make g++` 以支持目标仓库原生模块的 `node-gyp` 回退；审计实测同 digest 基础镜像下 content size +约 110MB、`docker images` disk +约 421MB（`/usr` +约 303MB），同时扩大了不可信仓库可用的编译面。工具链本身也不是充分条件：node headers / prebuild 源需可达，部分模块另需 `linux-headers`（当前未装）。
  - **待评估点**：① 是否把安装依赖拆到独立 installer 容器 / 阶段（只在该阶段保留工具链，主 runtime 仍只含 `.output`）；② 若保留在 runtime，是否补 `linux-headers` / 预置 node-gyp headers 缓存，并加镜像体积门禁；③ 与「pnpm store 持久化」候选的卷 / 缓存策略联动。
  - **触发条件**：镜像体积 / 安全评审要求收敛编译面；或再次出现「预编译包下载失败 + 缺 headers / 工具链」的原生构建失败。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **单仓通用执行预算 / deadline 检查（待评估，P2 🛠️ 可靠性）** —— 现象：2026-10-18 已用「修复前基线安装失败即跳过依赖链 + 合批环境性失败跳过逐包 + 逐包环境性中断」覆盖已观测的超时形态；但当基线安装成功、多个单包安装各自以**非环境性**失败结束时，仍可能把单仓 30 分钟预算耗在多次安装上。引擎目前只感知运行级 abort，不感知「剩余预算」。
  - **待评估点**：① 平台是否把 `deadlineAt`（或剩余毫秒）透传给引擎，在每次安装 / 验证前检查；② 或在编排层以「连续 N 次安装失败即停止本仓」的保守阈值兜底；③ 与「部分成功交付」的交互（停止前已完成的修复是否允许提交 / 验证）。
  - **触发条件**：再次出现「基线成功但逐包安装耗尽 30 分钟」的运行；或平台执行预算调整时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`sandboxLimits` / `tags` 等存量 JSON 配置列的写入闸门对齐（待评估）** —— 现象：`development.md §5.1.45` 已把「宽容输入 + `.strict()` 拒绝未知键 + 校验常量单一事实源」定为新增 / 修改配置列的 hard requirement，但 `Repository.sandboxLimits` 仍无 `.strict()`（未知键被 Zod 静默 strip）、`tags` 上限是 schema 内裸数字且 `parseTags` 不做 trim / 去重。**待评估点**：① 是否给 `sandboxLimits` 补 `.strict()` 并加未知键 400 用例；② 是否抽 `tags` / `sandboxLimits` 上限常量供 schema 与解析共用；③ 是否需要在 UI 侧提示未知键被拒绝。**触发条件**：下次改动仓库级配置列 / 仓库表单时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`ai-collaboration.md` / `platform.md` / `git.md` 均处 200 行上限的瘦身（待评估）** —— 现象：三文件行数均恰为 200（规范健康窗口上限），本批增补未越线但已零余量，任何后续增补都会进入 warning 带。**待评估点**：① 逐文件找可合并 / 可下沉段（重复表述、历史注记、可由设计稿承载的实现细节）；② 是否把长期稳定段迁入 design 后留一行指针；③ 瘦身不得删除 hard requirement 的唯一权威声明。**触发条件**：任一文件需再次增补时（先瘦身再增补）。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **`check-experience-landing` 按子条目（`###`）逐条校验落点（待评估）** —— 现象：脚本按 `##` 切分经验归档章节，同一 `##` 下多个 `###` 子条目只受「整节任意一条落点非空」保护；本批审计实测自指落点（「本条环境注记」）可假通过。**待评估点**：① 是否把校验粒度改为 `###`（每个子条目必须有非空落点）；② 是否对「本条环境注记」一类自指落点单独告警；③ 存量条目是否需要批量补真实落点。**触发条件**：下次大规模蒸馏 / 经验归档批次。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **环境性失败分类语义收窄（待评估，P2 🛠️）** —— 现象：M46.1 只把「环境性失败」变成可见，不改变分类；`ENVIRONMENT_ERROR` 仍以 stderr 为空 / 信号 / 超时判定，真实安装失败仍可能被并入环境性（源候选在 M46 上收时保留的残余点）。
  - **待评估点**：① 是否引入更细的分类（有 stderr / 有输出但失败 → 非环境性）；② 与 `failure_kind=transient` 的衔接；③ 历史数据是否回填。
  - **触发条件**：环境性失败计数持续高但实际可修；或再次出现「环境性失败掩盖真实安装失败」。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **常规升级链路的环境性失败归因对齐（待评估，P2 🛠️）** —— 现象：运行结果可信度的环境性失败计数只覆盖已落 `ENVIRONMENT_ERROR` 的路径（lockfile 诊断 / 多版本 / 合批）；`upgradeAlert` 的常规分组 / 逐包升级与 major 路径在安装被信号杀死 / 超时时仍产出普通 failed action，导致计数漏报并把失败归因到仓库。修复会改变 `alertsFailed` / exit code 语义，故未随可见性条目夹带。
  - **待评估点**：① 两路径消费安装结果的 `environmental` 标记并推 `ENVIRONMENT_ERROR`；② 与 exit code / status / 交付守卫的交互；③ 历史数据不回溯，仅对新 run 生效。
  - **触发条件**：环境性失败计数与真实环境故障偏差持续；或常规升级路径再次出现 OOM / 超时被误归因。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **仓库级 `allowMajorUpgrade` 开关（待评估，P2 🚀）** —— 现象：平台侧硬编码 `false`，跨 major 告警一律跳过；M46.2 只做披露，不放开升级（源候选在 M46 上收时保留的残余点）。
  - **待评估点**：① 仓库级开关（默认关）+ 完整验证 + AI 研判兜底；② 与交付守卫 / 基线的交互；③ 风险阈值与回滚边界。
  - **触发条件**：用户要求自动处理跨 major；或跨 major 告警占比持续升高。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **升级探针合批与门禁回滚粒度联动（待评估，P2 🛠️）** —— 现象：M46.3 只做基线完整链与按变更单元回滚，不做探针合批；合批会改变回滚单元、验证次数与失败回退语义。
  - **待评估点**：① 合批后的回滚单元（batch vs probe）；② 与 `verificationBlocking` 归因的衔接；③ 失败回退逐包的语义保持。
  - **触发条件**：单仓安装次数成为主要耗时；或 M46.3 落地后回滚粒度仍不足。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **通知周汇总（weekly_digest）固定周期插件（待评估，P2 🚀）** —— 现象：M46.5 B1-B4 已落地邮件通知（类别配置 / 收件人路由 / 指纹与 24h 冷却 / 投递记录），B5 周汇总按阶段容量移出。设计稿 §6.5 / §7.3 已定义周报口径：每周一 09:00（`DEPENDFIX_WEEKLY_DIGEST_HOUR`）按 ISO 周去重、内容未变化也发送、组织 + 个人双层开关、豁免每小时上限。
  - **待评估点**：① 固定周期插件按进程角色单实例运行（HTTP / worker 二选一）；② 按用户逐封投递的 `deliveryKey` 与 `recipientUserId` 语义；③ 活跃未修复高危快照 + 截断计数披露。
  - **触发条件**：用户需要周期提醒；或 24h 冷却导致新高危延迟被反馈。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

### 待上收候选（评估完成，等待用户决策）

> 本节为「评估完成、等待用户决策」候选的暂存区；候选**不含 `M\d+` 阶段编号**（[规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement)）。

- **`git-signing.ts` 更名为 `git-isolation.ts`（待评估）**（P3，🛡️ 治理）—— 背景：该模块已承载「签名 + hooks」双语义（4 个隔离常量），但文件名仍只表达「签名」。
  - **本批已闭环的部分**：决策点「是否在 `docs/standards/git.md §3.8` 扩展 hooks 隔离子节」已于 2026-10-13 M43.5 落地——§3.8 改为「签名 + hooks，commit / push 双向隔离」单表 + 4 常量清单 + push 侧 `--no-verify` 口径；`code-quality-checklist` 对应矩阵行同步扩展。
  - **待评估点**：是否将 `packages/engine/src/github/git-signing.ts` 更名为 `git-isolation.ts` 并同步 `github/index.ts` re-export（公开 API）、平台侧 import、测试与 `git.md §3.8` 的路径引用。**未纳入 M43.5** 的理由：触及公开 API re-export 与平台侧多处 import，宜单独批次以保持改动面可控。
  - **触发条件**：下次改动该模块 / 公开 API 面时；或治理批次收敛模块命名时。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **孤儿清理终态被迟到 worker 覆盖（待评估）**（P2 🛡️ 技术债）—— 现象：清理侧以「条件更新（WHERE status IN pending/running）」把 run 置 `failed` 后，仍在执行的 worker 若随后完成，`runScanInternal` 的最终 `save` 会整行写回，可能把终态覆盖为 `completed` / `failed`；当前以 active 锁过期 + job remove 降低概率，未根治。**关联**：[队列僵尸任务终结与去重键释放设计 §9](../design/governance/queue-stale-recovery.md#9-边界与残余风险)。
  - **待评估点**：① 编排层最终写库改为条件更新（仅当库中仍为 `pending` / `running`）；② 或在 `save` 前重读状态并短路；③ 与 `reuse` / `force-fail` 路径的兼容（复用路径需要重置终态字段，不能简单短路）。
  - **触发条件**：再次出现清理后终态被覆盖的实例；或下一次队列可靠性批次。
  - **按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 不带 `M\d+` 阶段编号**：等待评估与用户决策。

- **批次级「继续执行未完成项」入口（待评估）**（P2 🎨 用户体验）—— 背景：2026-10-18 用户报告宿主机重启导致批量任务中断，明确希望「至少给用户一个选项：直接结束还是继续执行」；同批已落地 P0（僵尸任务终结 + 去重键释放 + 触发自愈 + worker 慢重试），用户裁定本入口作为后续批次，形态选**批次级继续执行**（否决「新状态 + 启动弹窗」与「仅保留单条重试」）。
  - **待评估点**：① 入口落点（失败批次行内按钮 vs 展开详情）与二次确认文案；② 重启范围（仅 `orphan_run` / transient 且未完成子项 vs 全部失败子项）；③ 承载形态（复用 `executeBatchRun` 创建新 BatchRun 保留审计链 vs 复用原批次）；④ 与现有单条 `POST /api/runs/[id]/retry` 的关系（是否抽取共享「未完成项」判定）。
  - **触发条件**：用户要求该交互；或再次出现宿主机重启后的批量恢复诉求。
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

- **背景**：2026-09-01 `apps/platform/data/dependfix.sqlite` 业务数据被清空事故（详见 [经验归档 §五十](../design/governance/experience-archive-§49-§69-recent-investigation.md#五十sqlite-数据库业务数据被清空开发环境不可恢复事故2026-09-01)）。代码内无清空路径，最可能清空来源在代码外部（shell / CI / 运维）。
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

### 全量 vitest 偶发失败（单次未复现，持续观察）

- **背景**：2026-10-14 M44.4 批次② 的一次全量 `pnpm test` 出现失败，但输出被调用方截断、失败明细未捕获；随后同一工作区（仅文档与注释变更）连续多次复跑均全绿，未能复现（按 [AI 协作规范 §4.7](../standards/ai-collaboration.md) 阶段 3 登记根因观察项）。
- **持续观察项**：① 再次出现时须捕获完整失败明细后定位（首要假设：vitest worker 并发 / 资源竞争；其次：既有时序敏感用例）；② 长期不复现则维持观察。
- **触发条件**：再次出现同形失败（本地或 CI）。

### 依赖审计豁免复核（node-forge / braces，持续观察）

- **背景**：2026-10-05 weekly regression 因 `security:audit-deps` 阻断失败——node-forge ≤ 1.4.0（GHSA-86w9-cpqp-85rv）与 braces ≤ 3.0.3（GHSA-vfj7-8cjw-p6xm）为 high，但 advisory 声明的 patched 版本（1.4.1 / 3.0.4）**尚未发布**，overrides / `pnpm update` 无法解析。经用户决策（方案 A，调整为配置文件实现）在 [pnpm-workspace.yaml](../../pnpm-workspace.yaml) `audit.ignore` 显式豁免。
- **机制与复核**：以 `pnpm-workspace.yaml` `audit.ignore` 显式豁免（只过滤列表内编号，未列入的新漏洞仍使 `pnpm audit` exit 1）；机制、禁止项与复核条件以 [security.md §5.7](../standards/security.md#57-无可用修复版本漏洞的审计豁免auditignore2026-10-05) 为唯一权威，本条不重复。
- **复核条件**：node-forge 发布 > 1.4.0 或 braces 发布 > 3.0.3 后，移除 `pnpm-workspace.yaml` 对应条目并复跑 `pnpm audit --prod --audit-level=moderate --registry=https://registry.npmjs.org`。
- **复核记录（2026-10-17）**：周回归 `38929908272` 新增 3 critical / 5 high（`simple-git` ×2 / `@simple-git/argv-parser` / `shell-quote` / `seroval`，均经 `apps/platform > nuxt > @nuxt/devtools|@nuxt/vite-builder`）——patched 版本均已发布，按「升级优先」用锁文件提升闭合（`@nuxt/devtools` 3.4.3 / `seroval` 1.6.9 / `shell-quote` 1.12.0），**未新增豁免条目**；本清单两条仍按上述复核条件保持活跃。
- **触发条件**：每周回归 / 依赖升级 / 上游发布修复版本时复查。
- **可选增强**：以调度任务自动比对 `npm view node-forge version` / `npm view braces version` 探测上游修复发布，避免豁免长期挂账（暂未实现）。

---

## 文档位置速查

| 内容类型 | 位置 |
|:--|:--|
| 当前阶段活跃任务 | **M46**「运行结果可信度与可观测性」6 原子条目（2026-10-20 用户决策方案 A，见 [todo.md](todo.md) + [roadmap.md §M46](roadmap.md)）；插队容量治理（移出低优先级原子而非压缩验证）见 [planning.md §3.1.1](../standards/planning.md#_3-1-1-插队后的阶段容量再平衡-hard-requirement-2026-10-19) |
| 下一阶段（未授权） | 无——本阶段闭环后按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 评估本文件候选池后由用户决策 |
| 已完成阶段归档 | [todo-archive.md](todo-archive.md)（主窗口 + [archive/](archive/) 分片） |
| 里程碑与阶段交付 | [roadmap.md](roadmap.md)（M0-M45 已归档，M46 进行中） |
| 长期主线 / 候选 / 待人工验收 / 已知边界 | 本文档（按四象限结构） |
| 历史归档索引 | [archive/index.md](archive/index.md) |
