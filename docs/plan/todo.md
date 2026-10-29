# 当前阶段待办

> 本文件**仅**登记当前阶段活跃待办；已闭环阶段归档于 [todo-archive.md](todo-archive.md)；未排期 / 延期 / 远期 / 长期主线 / 已知边界登记于 [backlog.md](backlog.md)。

---

## 文档位置速查

| 内容类型 | 位置 |
|:--|:--|
| 当前阶段任务 | **M50 通知可信度收口（1.0-E 批次）** —— 4 原子，见下方 §M50 |
| 下一阶段（已授权，未规划） | **1.0 发布门槛收口 F1 → F2 → G**（M51-M53；台账见 [release-1.0-readiness.md](../design/governance/release-1.0-readiness.md)） |
| 已完成阶段归档 | [todo-archive.md](todo-archive.md)（阶段索引 + [archive/](archive/) 分片；M0-M49 全部已归档） |
| 里程碑与阶段交付 | [roadmap.md](roadmap.md)（M0-M49 已归档；M50 进行中；1.0 门槛 F1/F2/G 待规划） |
| 未排期 / 延期 / 远期 / 长期主线 / 已知边界 | [backlog.md](backlog.md) |
| 历史归档索引 | [archive/index.md](archive/index.md) |

---

## M50: 通知可信度收口（1.0-E 批次 / 2026-10-29 用户决策 / 规划中）

> **阶段目标**：把通知从「有投递记录」推进到「可信信号」——`Critical` 告警必达、严重级别术语可判读、周报失败可当周自愈、暗色形态有像素守卫。
> **来源**：1.0 台账批次 E 四项（[release-1.0-readiness.md](../design/governance/release-1.0-readiness.md) §3.1）；四项对应的 [backlog.md](backlog.md) 候选已上收本阶段并去重。
> **阶段基线**（供插队容量再平衡按 [规划规范 §3.1.1](../standards/planning.md) 计算）：4 原子 / 预估 35-49 文件 / 1100-1690 行 / **9-10 commits**（= 逐原子交付物 3 + 2 + 2~3 + 2 之和；各条「交付物」为执行角色 P 阶段按变更面清点的预估值，非实测；D 阶段实测回填）。
> **建议顺序**：M50.1 → M50.2 → M50.3 → M50.4 —— 视觉基线必须晚于语义与文案改动，否则基线与实现同批漂移时无法判读差异来源。
> **2026-10-29 用户决策**：① E 批次落为 **M50** 独立阶段（F1/F2/G 顺延 M51-M53）；② 通知侧严重级别保留 `Critical` / `High` 专有名词，与扫描页 `scanSeverityLabel` 同源；③ `critical` 投递走**独立计数桶**，沿用同一 `maxPerHour` 数值。
> **容量评估（§1.1「是否补足至 5 项」）**：不补足。E 批次由 1.0 台账分档固定为 4 项；跨批搬入 F1 项会破坏批次语义边界（通知可信度 vs 语义与数据）与既定的 E → F1 执行顺序。4 项在 §1.1 上限内，类型覆盖 🛠️ 1 + 🎨 1 + 🚀 1 + 🧪 1。

### M50.1 [P1 🛠️] `critical` 告警必选不可关闭（**已闭环** `374954b5` + `ffb60237` + `4748818d` + `3beb73d7` + `a3f320bd` + `56ad8fe3`）

- **目标**：`critical` 级未修复告警在组织与个人类别开关均关闭时仍投递，仅受部署总开关熔断；每小时上限保留但计入独立桶，不再与其他类别争额度。
- **范围**：`apps/platform/server/services/notification/{types,preferences,settings,recipients,delivery,high-risk}.ts`、`{run-notification,batch-notification}.service.ts`、`business-templates.ts`（类别文案键）、`apps/platform/app/pages/{settings,notifications}.vue`、`apps/platform/i18n/locales/{zh-CN,en-US}.json`、对应 `*.test.ts`、设计稿 [platform-notification.md](../design/governance/platform-notification.md) §3 / §4.2 / §4.3 / §4.4 / §5 / §7.1 / §7.3 / §13 / §15。
- **验收标准**：
  1. **必达**：组织 `securityHigh=false` + 个人 `security_high` 关闭 + 存在 1 条未修复 `critical` → 运行终态产生 `security_critical` 投递且 `status='sent'`；同场景 `security_high` 不投递。
  2. **范围收窄**：`security_high` 只承载 `high` 级；`severityThreshold='critical'` 时 `high` 不投递而 `critical` 仍投递（阈值语义保持 `critical | high` 枚举不变，仅决定是否附加 high）。
  3. **独立桶**：`maxPerHour=6` 下先写 6 条其它类别 `sent` → `critical` 仍 `sent`；再写 6 条 `security_critical` `sent` → 第 7 条 `skipped_throttled`；`security_critical` 行不计入共享桶（随后 `platform_incident` 仍可发送）。
  4. **熔断**：`DEPENDFIX_NOTIFICATION_ENABLED=false` 时 `critical` 也落 `noop`。
  5. **兼容**：存量 `notification_settings_json`（无新键）解析结果等值；`.strict()` 未知键仍拒绝；本原子不新增迁移（复用组织 JSON 列与 `notification_preference` 表）。
  6. **门禁**：`pnpm --filter @dependfix/platform test` 全绿、`pnpm run test:coverage` 四维 ≥ 80%、`pnpm run lint` 0 error、`pnpm run typecheck` 0 error；新增行编号标记扫描 0 命中。
- **不做什么**：不新增 DB 列 / 迁移；不改冷却窗口与内容指纹语义（保持现状，口径见设计稿 [platform-notification.md](../design/governance/platform-notification.md) §15 D4）；不改 `maxPerHour` 数值与取值范围；不新增渠道；不动 `platform_incident` 链路；不把 `security_critical` 做成可配置类别。
- **依赖**：用户 2026-10-24 决策（`critical` 豁免类别开关、保留每小时上限）与 2026-10-29 决策（独立计数桶）；收件人路由沿用 `resolveNotificationRecipients`；邮件类别标签保持 `[告警]` 不变（既有主题过滤契约），严重级别在主题正文以 `Critical` / `High` 呈现（文案值归 M50.2）。
- **交付物**：3 commits，每 commit 独立可验证 —— ① 类型与策略层（`types` / `preferences` / `settings` / `recipients` + 单测）：验收 = `pnpm run typecheck` 0 error + 策略层单测通过（必达判定 / `.strict()` 兼容 / 角色默认）；若 `delivery` 等下游未同步导致 typecheck 不过，则 ① 需与下游同时落地（提交顺序在 D 阶段按编译可行性调整，并在此留痕）。② 投递与触发面（`delivery` / `high-risk` / `run-notification` / `batch-notification` + 单测）：验收 = 上文验收 1-4 的用例全绿（必达 / 范围收窄 / 独立桶 / 熔断）。③ 前端只读必选行 + i18n 键 + 设计稿：验收 = 页面只读行断言 + 双语键齐备（`i18n:audit:missing` 0）+ 设计稿 §3/§4.4 同步。预估 16-20 文件 / 550-750 行。
- **风险与缓解**：① 存量 `securityHigh=false` 的组织会**新增** `critical` 邮件 → 在 0.6.1/1.0 发布说明披露行为变化；② `security_critical` 不进个人偏好表 → 个人设置页需只读行（禁用态 + 「必选，不可关闭」说明）与平台自身问题行对齐，避免用户误以为漏配；③ 类别拆分波及 `ORG_CATEGORY_KEYS` 类型收窄 → 以 `pnpm run typecheck` 全包复验，禁止用 `as` 逃逸。

### M50.2 [P2 🎨] 通知侧严重级别术语与阈值命名收敛（**已闭环** `059208ed` + `6c1001d2` + `96f4deed` + `0aed2cb7`）

- **目标**：通知页、个人设置页、邮件主题正文与投递记录统一使用 `Critical` / `High` 专有名词，类别名与阈值名自解释，消除「严重 / 高危」并列歧义。
- **范围**：`apps/platform/i18n/locales/{zh-CN,en-US}.json`（`settings.notifications.*` / `notifications.*`）、`apps/platform/app/pages/notifications.vue`（阈值选项改用 `app/utils/scan-options.ts` 派生的 `scanSeverityOptions` 标签）、`apps/platform/app/pages/settings.vue`、`apps/platform/server/services/notification/business-templates.ts`、`run-notification.service.ts`、对应 `*.test.ts`、设计稿 §10 与 §3 表。
- **验收标准**：
  1. **术语归零**（应用文案面，测试目录除外——负向断言必须包含被禁字面量）：`rg -n "高危阈值|严重 \+ 高危|仅严重" apps/platform --glob '!**/CHANGELOG.md' --glob '!**/tests/**' --glob '!**/*.test.ts'` 0 命中；`rg -n "High-risk (threshold|alerts)" apps/platform --glob '!**/CHANGELOG.md' --glob '!**/tests/**' --glob '!**/*.test.ts'` 0 命中。
  2. **同源**：通知页阈值选项标签与 `scanSeverityOptions` 的 `critical` / `high` 标签逐字一致（单测断言 label 集合，禁止各写一份字面量）。
  3. **邮件**：主题与正文的严重级别标签逐字为 `Critical` / `High`（模板用例断言，含周报标题的「Critical N / High M」形态）。
  4. **双语齐备**：类别名（`Critical 告警` / `High 告警`）与必选行说明 zh / en 均在位，`pnpm run i18n:check:anchor`、`i18n:audit:missing`、`lint:md:check` 通过。
- **不做什么**：不改扫描页既有口径（`scanSeverityLabel` 已是权威）；不改 `severityThreshold` 枚举值与 API 字段名；不引入图标 / 色阶辅助（可作为后续候选）；不改邮件主题的 `[dependfix][告警]` 前缀。
- **依赖**：M50.1（类别拆分与必选行结构先定，本原子只改文案值）；扫描页口径见 `apps/platform/app/utils/scan-options.ts`。
- **交付物**：2 commits 计划内 + 2 commits 随批收口（验收 = 阈值选项与 `scanSeverityOptions` 同源断言 + 双语键齐备）—— ① 服务端模板与用例（`059208ed`）；② 前端 + i18n + e2e（`6c1001d2`）；③ 视觉复跑暴露的浮层弹窗可见性 flaky 放宽（`96f4deed`，范围外来源：文案改动后的视觉连跑复现）；④ 设计稿 / todo / 基线（`0aed2cb7`）。预估 8-12 文件 / 180-320 行。
- **风险与缓解**：① i18n 键改名会连带视觉基线文案变化 → 由 M50.4 在其后建立基线（顺序约束已在阶段头声明）；② 与 M50.1 的键结构改动重叠 → 明确分工：M50.1 负责键结构与必选语义，本原子只负责文案值，避免同批双改；③ 中文用户可读性下降 → 用类别说明行与阈值说明行补足（「含 Critical 与 High」）。

### M50.3 [P3 🚀] 周报投递重试与窗口锁（**已闭环** `142cb798` + `3268e688` + `65f93a9b`）

- **目标**：周报在本周触发窗口内可自愈——部分收件人失败可重试、无收件人时窗口内开启开关可当周补发，同时不放大日志噪声。
- **范围**：`apps/platform/server/plugins/weekly-digest.ts`（同周锁按结果分类）、`weekly-digest.service.ts`（返回细分终态）、`weekly-digest-schedule.ts`（重试退避常量）、`delivery.ts` / `notification-log` 查询（`skipped_no_recipient` 同周同状态幂等落库）、对应 `*.test.ts`、设计稿 §6.5 / §7.3 / §13 AC9。
- **验收标准**：
  1. **部分失败可重试**：2 收件人中 1 成功 1 失败 → 首轮 `status='partial'` 且进程内同周锁重置 → 下一 tick 再次尝试时已 `sent` 者命中 `buildDigestDeliveryKey` 记 `skipped_duplicate`，仅失败者重新发送（SMTP 调用次数断言 = 3）。
  2. **无收件人不锁死窗口**：首轮 `skipped_no_recipient` 后开启个人开关 → 窗口内 ≤ 2 个检查周期发送成功；同周同状态在 `notification_log` 最多 1 条（行数断言，防 15 分钟级刷日志）。
  3. **重试退避**：新增退避常量（≥ 30 分钟），失败后未过退避的 tick 不再尝试（用例断言）；24 小时窗口内重试次数有上界。
  4. **终态与回收**：`sent` 同周不再尝试（一收件人一封）；崩溃遗留 `sending` 10 分钟回收路径与既有用例保持通过。
- **不做什么**：不改逐用户投递键语义与 ISO 周口径；不改触发小时 / 窗口长度 / 检查间隔；不引入持久化调度器或新表；不改周报邮件内容与快照口径。
- **依赖**：M47.5 已落地的周期插件与逐用户投递键（`weekly-digest.{service,schedule}.ts`、`dedupe.ts#buildDigestDeliveryKey`）；M50.1 的类别拆分不影响周报路径（周报按快照聚合，不按类别拆分）。
- **交付物**：2-3 commits —— ① 服务层终态与退避纯函数 + 单测（验收 = 退避/终态分类单测绿）；② 插件锁语义与幂等落库 + 用例（验收 = 验收 1-2 的调用次数与日志行数断言绿）；③ 设计稿口径同步（验收 = §6.5 / §13 AC9 与实现一致）。预估 6-9 文件 / 250-400 行。**实测回填**：9 文件 / 约 290 行；退避常量与状态机落在新模块 `weekly-digest-attempt.ts`（原计划写在 `weekly-digest-schedule.ts`，为内聚改为独立实现，属范围偏差已留痕）。
- **风险与缓解**：① 重试放大 SMTP 失败噪声 → 「同周同状态幂等落库 + 退避」双约束，并在设计稿写明重试上界；② 进程重启丢锁 → 逐用户 `deliveryKey` 仍兜底（既有机制，用例覆盖）；③ 时间相关用例易 flaky → 时钟一律注入（`now` 参数），禁止真实等待。

### M50.4 [P3 🧪] `/settings` 与通知页 dark 视觉覆盖

- **目标**：`/settings`（通知偏好卡片 + 扫描偏好卡片）与 `/notifications` 的暗色形态纳入像素守卫，周汇总开关与提示文案不再是盲区。
- **范围**：`apps/platform/tests/visual/platform-pages.visual.test.ts`、`tests/visual/helpers/{visual,fixtures}.ts`（按需）、`tests/visual/README.md`（覆盖边界 / 已知盲区）、3 张新基线 PNG。
- **验收标准**：
  1. 新增基线 `settings-light.png` / `settings-dark.png` / `notifications-dark.png`，每例带前置假绿防护断言（必选行、周汇总 hint、类别行可见后才截图）。
  2. `pnpm --filter @dependfix/platform test:visual` **连跑两遍**全绿（含既有 **17** 例：`platform-pages` 13 + `dialog-select-layer` 4），无基线漂移。
  3. 反例标定 ≥ 1 次：注入 dark token / 文案变更后用例如期失败，记录像素差；标定后还原并复跑全绿。
  4. 非确定性取值（语言偏好、`当前生效：…` 派生行、时间）以 `data-visual-mask` 或 fixtures 钉死处理，并在 README「已知盲区」同步结论。
- **不做什么**：不扩到全站页面 × 多主题矩阵；不覆盖交互态（保存成功 / 错误提示 / 禁用点击）；不覆盖 `dialog-select-layer` 既有家族；不为让用例变绿放宽阈值或加遮蔽掩盖真实差异。
- **依赖**：M50.1 / M50.2（文案与结构先定，基线必须在其后建立）；视觉基建见 `apps/platform/tests/visual/README.md` 与 [测试规范](../standards/testing.md) 视觉回归节。
- **交付物**：2 commits —— ① 视觉用例 + 3 张基线（验收 = 新增 3 例单独跑绿）；② README 覆盖边界与标定结论（验收 = 反例标定记录 + 全套连跑两遍全绿）。预估 5-8 文件 / 120-220 行 + 3 PNG。
- **风险与缓解**：① `/settings` 含设备级偏好（localStorage）导致运行间漂移 → 用例内显式设置或 `storageState` 隔离，并在前置断言锁定「当前生效」行；② 页面长度可能超出视口截断 → 沿用既有视口级截图口径并断言目标卡片可见；③ 基线数量增长带来维护成本 → 仅新增 3 张，登记覆盖边界而不铺开矩阵。
