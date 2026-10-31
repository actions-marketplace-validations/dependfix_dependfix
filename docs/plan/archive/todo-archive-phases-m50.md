# 待办归档分片：M50 通知可信度收口（1.0-E 批次）

> 本分片由 2026-10-30 M50 阶段归档批次从 [todo.md](../todo.md) 迁出；正文按归档口径压缩（目标 / 落地 / 审计 / 证据 / 边界），相对链接按新位置重指。

---

## M50: 通知可信度收口（2026-10-29 用户决策 / 2026-10-30 归档）

> **归档摘要**：4 原子（🛠️ 1 + 🎨 1 + 🚀 1 + 🧪 1）+ 阶段期间 **1 批插队**（依赖安全补丁修复，属 §3.1 例外清单第 2 / 3 类〔依赖链高危漏洞 + CI 主链路阻塞〕，2 commits，未占条目编号）。阶段窗口首父链 **30 commits**（规划 1 + M50.1 7 + 插队 2 + M50.2 6 + M50.3 7 + M50.4 7；`git log --first-parent --oneline 0c2c06f5^..9bff1f93` 实测），阶段基线 **9-10 commits / 35-49 文件 / 1100-1690 行**，唯一 diff 实测 **50 文件 / +1345 −273**（`git diff --shortstat 0c2c06f5^..9bff1f93`）——文件略超基线上界（50 vs 49）、行数在区间内，commits 为基线的 3 倍，主因是每原子含「实现 + 审计收口 + 测试加固 + 文档」多段提交而非单点落地。
>
> **证据来源**：各条目数字取自 `.session/runtime-state.json` §`m50_1` / `m50_2` / `m50_3` / `m50_4` / `ci_fix_40859337458` 与 `artifacts/review-gate/*.md`；CI 事实以 run `40859337458` 的失败步骤日志与后续推送为准。

> **阶段目标**：把通知从「有投递记录」推进到「可信信号」——`Critical` 告警必达、严重级别术语可判读、周报失败可当周自愈、暗色形态有像素守卫。来源 = 1.0 台账批次 E 四项（[release-1.0-readiness.md](../../design/governance/release-1.0-readiness.md) §3.1）。

> **用户决策（2026-10-29）**：① E 批次落为 M50 独立阶段（F1/F2/G 顺延 M51-M53）；② 通知侧严重级别保留 `Critical` / `High` 专有名词，与扫描页 `scanSeverityLabel` 同源；③ `critical` 投递走**独立计数桶**，沿用同一 `maxPerHour` 数值。

> **容量评估（§1.1「是否补足至 5 项」）**：不补足——E 批次由 1.0 台账分档固定为 4 项，跨批搬入 F1 项会破坏批次语义边界（通知可信度 vs 语义与数据）与既定的 E → F1 顺序；4 项在 §1.1 上限内，类型覆盖 🛠️ 1 + 🎨 1 + 🚀 1 + 🧪 1。

> **原子间依赖**：M50.2 ← M50.1（类别拆分与必选行结构先定，术语只改文案值）；M50.4 ← M50.1 + M50.2（视觉基线必须晚于语义与文案改动）；M50.3 独立于类别拆分，依赖 M47.5 已落地的周期插件与逐用户投递键（`dedupe.ts#buildDigestDeliveryKey`）。

### M50.1 [P1 🛠️] `critical` 告警必选不可关闭（**已闭环** `374954b5` + `ffb60237` + `4748818d` + `3beb73d7` + `a3f320bd` + `56ad8fe3` + `3a9cb0d0`）

- **目标**：`critical` 级未修复告警在组织与个人类别开关均关闭时仍投递，仅受部署总开关熔断；每小时上限保留但计入独立桶。
- **落地**：新增必选类别 `security_critical`（与 `platform_incident` 同级、不入个人偏好表）；`security_high` 收窄为仅 `high`；`severityThreshold` 枚举与语义不变（仅决定是否附加 `high`），**无迁移**；投递侧双桶（critical 只数自身、共享桶 `Not(In(['weekly_digest','security_critical']))`）；收件人取触发者（已降级 viewer 除外）+ 管理员 + extra；前端个人 / 组织设置各加只读行，PATCH 必选类别返回 400。
- **审计**：R1 standard **Pass**（0B / 3W：阴性断言恒真、缺熔断用例、必选行「忽略组织开关」未锁定 / 5S）→ 全收口（viewer 守卫、删死代码 `queryUnfixedHighRisk`、补 3 类用例、设计稿双类别口径）→ **R2 quick Pass**。
- **证据**：定向 notification 136 passed；全量 platform 2274 passed；根 typecheck 0；e2e notifications 4 passed（只读行 + `aria-checked`）；视觉仅重建 `notifications-light.png` 连跑两遍 17 passed；mutation 4/4（必选分支短路 / 单一共享桶 / severity 映射 / 阈值门）。
- **边界**：不改冷却与指纹语义（D4 既定）；critical 超 `maxPerHour` 仍落 `skipped_throttled` 且无补发；存量 `securityHigh=false` 组织将新增 critical 邮件（待发布说明披露）。

### 插队：依赖安全补丁修复（2026-10-29，不占条目编号；`a6a82f77` + `ae54c306`）

- **来源**：CI run `40859337458`（Test workflow @ `ab8684b6`）的 `pnpm audit (prod, moderate+, blocking)` 红——新 advisory `vue-i18n` 家族 `GHSA-83rm-6c8r-g728`（high）与 `seroval` `GHSA-f86p-h4j2-7qgj` / `GHSA-9wx9-5pv9-3349`（moderate），锁文件仍是 11.4.8 / 1.6.9。
- **落地**：`overrides` 按 advisory 最小修复版本线钉定（`vue-i18n` 与 `@intlify/*` `^11.4.14`、`seroval` `~1.6.11`），锁文件升至 11.4.16 / 1.6.12；**未用 `audit.ignore`、未改 `minimumReleaseAge`**；backlog 登记范围事实与推进条件。
- **审计**：R1 deep **Reject**（`minimumReleaseAge: 60` 单位是**分钟**不是天 → 据此新增的 `minimumReleaseAgeExclude` 整块多余且治理口径错误）→ 删除 exclude、改 overrides 版本线、改写文档 → **R2 quick Pass**（2W：overrides 范围语义措辞 / 构建证据 → 已订正）。
- **证据**：prod audit exit 0（剩 1 low + node-forge 豁免）；全量 audit 同口径；`--frozen-lockfile` 0；根 test 5318 passed；`pnpm -r build` 0。
- **边界**：`seroval` 冻结在 1.6.x（跨 minor 需人工推进）；本地 `node_modules/.pnpm` 残留旧版本目录（不影响 lockfile 解析）。

### M50.2 [P2 🎨] 通知侧严重级别术语与阈值命名收敛（**已闭环** `059208ed` + `6c1001d2` + `96f4deed` + `0aed2cb7` + `ee60e5ae` + `b1c1221f`）

- **目标**：通知页、个人设置页、邮件主题正文统一使用 `Critical` / `High` 专有名词，消除「严重 / 高危」并列歧义。
- **落地**：邮件模板 `securityTitle` 增级别参数（按类别取 `Critical` / `High`），周报标题改「未修复告警 — Critical x / High y」、空快照改「本周无未修复告警」；通知页阈值字段改「严重级别阈值」，选项标签由 `scanSeverityLabel` 拼接（新增 `app/utils/notification-options.ts`）；类别名改 `Critical 告警` / `High 告警`，zh / en 同步；e2e 增术语归零断言；视觉重建通知页基线。
- **审计**：R1 standard **Reject**（B01 todo 未标闭环；B02 设计稿 §6.5 旧字面量 + D5 声明无 diff 支撑；W01 单测锁不住同源 / W02 注释口径 / W03 基线归属 / W04 AC 措辞）→ 收口 → **R2 quick Pass**（W01 经审计方独立 mutation 击杀验证）。
- **证据**：platform 全量 2278 passed；e2e notifications 4 passed；视觉连跑 5 轮 17 passed；术语归零两条 rg 0 命中；mutation 1/1（同源）。
- **边界**：服务端邮件模板仍自持一份字面量（跨 runtime，已登记 backlog 候选）；`notifications` 前置断言未锚定新文案（由 M50.4 补强）。

### M50.3 [P3 🚀] 周报投递重试与窗口锁（**已闭环** `142cb798` + `3268e688` + `65f93a9b` + `b43864fa` + `e6c1d680` + `7475390b` + `3b3b24ab`）

- **目标**：周报在触发窗口内可自愈——部分失败可重试、无收件人时窗口内开启开关可当周补发，且不放大日志噪声。
- **落地**：新增纯函数状态机 `weekly-digest-attempt.ts`（30 分钟退避、单周 6 次发信上界、`sent`/`skipped_duplicate` 终态、`skipped_no_recipient` 只退避不计次、配置关闭清退避不清计数）；插件改状态机 + **重入守卫**（发送未结束跳过节拍）并以上一次发送完成时刻为退避基准；服务层 `skipped_no_recipient` 用 `hasNotificationLog` 按周幂等落库（查询失败 fail-open）。
- **审计**：R1 deep **Reject**（B01 todo 未闭环；W01 文件头 stale / W02 tick 无重入保护且读改写非原子 / W03 配置关闭清零计数可绕过上界；S01-S08）→ 收口 → **R2 quick Pass**（2S：SMTP 超时显式化已登记 backlog 候选、重入用例断言已修正）。
- **证据**：platform 全量 2293 passed；typecheck 0；mutation 5/5（partial 当终态 / 去退避 / 取消幂等 / no-recipient 计次 / 删重入守卫，均用文件备份还原）。
- **边界**：计数与幂等为「每进程」粒度（重启清零、多副本各 1 行，D6 既定）；6×30 分钟 = 2.5 小时，SMTP 中断更久则该周放弃自愈；nodemailer 未显式声明超时（已登记 backlog 候选）。

### M50.4 [P3 🧪] `/settings` 与通知页 dark 视觉覆盖（**已闭环** `3665905a` + `0177ad99` + `24f3c0f4` + `ba8b66e3` + `6f858797` + `d6f62f65` + `9bff1f93`）

- **目标**：`/settings`（通知偏好 + 扫描偏好卡片）与 `/notifications` 的暗色形态纳入像素守卫。
- **落地**：新增 `settings-light` / `settings-dark`（整页 1440×1473）/ `notifications-dark` 三张基线（`notifications-light` 逐字节未变）；每例带前置假绿断言（必选 `Critical` 只读行可见且禁用、`严重级别阈值`、`高危阈值` 0 命中、周汇总提示、`当前生效` 完整兜底串、语言选值、`#aiModel` 非空）；抽出 `openSelectPanel`（首等 10s + 再点一次 15s，**不按 Escape**——会关闭宿主模态弹窗，重试前先判已打开）收敛 4 处面板打开；README 补覆盖边界 / 确定性表 / 反例标定记录 / 盲区。
- **审计**：R1 standard **Reject**（B01 Escape 复位关闭模态弹窗使重试失效且首等压到 3s；B02 typecheck 实为红（M50.3 遗留 `TS2349`）；W01 标定像素未入库 / W02 投递记录空态 overclaim / W03 语言偏好无确定性结论 / W04 免 typecheck 理由不成立）→ 收口 → **R2 quick Pass**（0B / 0W；2 条 suggest 已顺手收口）。
- **证据**：视觉全量 20 例多轮全绿（含吞首次点击后的 35.1s 重试轮）；反例标定 2 组：`bg-elevated` → 33582 / 654 px、`text` → 8411 / 15211 px（超 `maxDiffPixels 100`）；注入式兜底标定 10.6s 证明重试路径生效；platform 2293 passed；typecheck 0（审计方独立复跑）。
- **边界**：`settings` 整页 1473px 依赖 `fullPage` 拼接（已登记纵向边界）；投递记录仅空态覆盖；`Select` 首点击不挂载根因未定位（helper 兜底 + 一次有界重试）。

### 阶段收口

- **插队与再平衡**：1 批插队（依赖安全补丁，2 commits：`a6a82f77` + `ae54c306`），未达 §3.1.1 任一阈值（批次 1 < 3；工作量远低于 50%；剩余窗口充足），**未触发移出**。
- **质量门**：`gates:docs` 16 项；根 `typecheck` 0 error；`lint` 0 error（3 存量 warning）；platform 全量 2293 passed / 9 skipped；视觉 20 例；e2e notifications 4 例；mutation 合计 10/10（M50.1 4 + M50.2 1 + M50.3 5）。
- **残余（已登记 backlog）**：① 跨 runtime 严重级别标签单点化（M50.2 复审衍生）；② 邮件传输超时与周报节拍约束（M50.3 复审衍生）；③ critical 超限无补发与存量组织行为变化（待发布说明披露）；④ `Select` 首点击不挂载根因。
- **1.0 台账联动**：G1 ④「周回归最近 3 次」仍待累计；G4 窗口需在推送后继续观察。
