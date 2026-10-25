# 待办事项归档 (Todo Archive)

> 本文档包含已完成阶段的近线归档。当前活跃任务见 [todo.md](todo.md)。
> 后续阶段任务在 [backlog.md](backlog.md)。
> 主窗口保留最近 3-5 个已归档阶段摘要；早期阶段归档分片见 [archive/](archive/)。

## 深度归档索引

- 后续阶段归档分片存放于 `docs/plan/archive/` 目录。
- 归档治理规则见 [archive/index.md](archive/index.md)。
- 早期阶段分片：
  - [M0 / M1](archive/todo-archive-phases-m0-m1.md)（2026-08-07 迁出，115 行）
  - [M2 / M3 / M4 / M4.5 / M4.6 / M5 / M5.5](archive/todo-archive-phases-m2-m55.md)（2026-08-14 迁出，T906 执行，398 行）
  - [M6 / M7.1 / M7.2 / T711 / M8](archive/todo-archive-phases-m6-m7-t711.md)（2026-08-20 neat-freak 归档批次迁出，293 行）
  - **M9 / 2026-08-19 PR1-PR3 / 2026-08-19 C54+C55 / M11 推进批次（含 C53-后-A/B/C 衍生子任务）**：[archive/todo-archive-phases-m11.md](archive/todo-archive-phases-m11.md)（2026-08-20 迁出）
  - **M10 / T912 / C53 / 2026-08-20 平台 UI 增强（C59-C61）**：[archive/todo-archive-phases-m10-c53-c59c61.md](archive/todo-archive-phases-m10-c53-c59c61.md)（**2026-08-28 M16 归档批次同步迁出**——M16 段 110 行新增前主窗口 618 行接近 700 分片阈值，预防性迁出与 M15 归档批次同源策略）
  - **M13**：[archive/todo-archive-phases-m13.md](archive/todo-archive-phases-m13.md)（**2026-08-30 M18 归档批次预防性迁出**——M18 段新增前主窗口 673 行接近 700 分片阈值，预防性迁出与 M16/M15 归档批次同源策略）
  - **M14 + M15**：[archive/todo-archive-phases-m14-m15.md](archive/todo-archive-phases-m14-m15.md)（**2026-08-31 M19 归档批次预防性分片迁出**——M19 段新增前主窗口 699 行 + M19 段预估 80-100 行将超 700 强制分片阈值；M14 + M15 同源批次同期迁出，符合"主窗口保留 3-5 个阶段"健康策略）
  - **M16 + M17**：[archive/todo-archive-phases-m16-m17.md](archive/todo-archive-phases-m16-m17.md)（**2026-08-31 M20 归档批次预防性分片迁出**——M20 段新增前主窗口 638 行 + M20 段预估 100-130 行将超 700 强制分片阈值，预防性迁出与 M19/M18/M17/M16 归档批次预防性迁出 M14/M15/M13/M12/M10 同源策略）
  - **M22**：[archive/todo-archive-phases-m22.md](archive/todo-archive-phases-m22.md)（**2026-09-28 M30 归档批次预防性分片迁出**——M30 段新增前主窗口 682 行 + M30 段新增将超 700 强制分片阈值；M22 完整段迁出与 M19-M21 / M14-M15 / M16-M17 归档批次预防性迁出同源策略）
  - **M29**：[archive/todo-archive-phases-m29.md](archive/todo-archive-phases-m29.md)（**2026-10-01 M34 归档批次预防性分片迁出**——M34 段新增前主窗口 648 行 + M34 段新增将超 700 强制分片阈值；M29 是主窗口最早的完整段，按「主窗口保留 3-5 个阶段」健康策略迁出）
  - **M23**：[archive/todo-archive-phases-m23.md](archive/todo-archive-phases-m23.md)（**2026-09-30 M33 归档批次预防性分片迁出**——M33 段新增前主窗口 655 行 + M33 段新增将超 700 强制分片阈值；M23 是主窗口最早的完整段，按「主窗口保留 3-5 个阶段」健康策略迁出）
  - **M30**：[archive/todo-archive-phases-m30.md](archive/todo-archive-phases-m30.md)（**2026-10-02 M35 归档批次预防性分片迁出**——M35 段新增前主窗口 573 行，M35 段新增后完整段将达 6 个，超 [archive/index.md §2](archive/index.md) 定义的「3-5 个已归档阶段」上界；M30 是主窗口最早的完整段，按该健康策略迁出；M30 全部 commits 已推送 `origin/master`）
  - **M32**：[archive/todo-archive-phases-m32.md](archive/todo-archive-phases-m32.md)（**2026-10-08 M37 归档批次预防性分片迁出**——M37 段新增后完整段将达 6 个，超 [archive/index.md §2](archive/index.md) 定义的「3-5 个已归档阶段」上界；M32 是主窗口最早的完整段，按该健康策略迁出；M32 全部 commits 已推送 `origin/master`）
  - **M33**：[archive/todo-archive-phases-m33.md](archive/todo-archive-phases-m33.md)（**2026-10-09 M38 归档批次预防性分片迁出**——M38 段新增后完整段将达 6 个，超 [archive/index.md §2](archive/index.md) 定义的「3-5 个已归档阶段」上界；M33 是主窗口最早的完整段，按该健康策略迁出；M33 全部 commits 已推送 `origin/master`）
  - **M34**：[archive/todo-archive-phases-m34.md](archive/todo-archive-phases-m34.md)（**2026-10-10 M39 归档批次预防性分片迁出**——M39 段新增后完整段将达 6 个，超 [archive/index.md §2](archive/index.md) 定义的「3-5 个已归档阶段」上界；M34 是主窗口最早的完整段，按该健康策略迁出；M34 全部 commits 已推送 `origin/master`）
  - **M35**：[archive/todo-archive-phases-m35.md](archive/todo-archive-phases-m35.md)（**2026-10-10 M40 归档批次预防性分片迁出**——M40 段新增后完整段将达 6 个，超 [archive/index.md §2](archive/index.md) 定义的「3-5 个已归档阶段」上界；M35 是主窗口最早的完整段，按该健康策略迁出；M35 全部 commits 已推送 `origin/master`）
  - **M36**：[archive/todo-archive-phases-m36.md](archive/todo-archive-phases-m36.md)（**2026-10-10 M41 归档批次预防性分片迁出**——M41 段新增后完整段将达 6 个，超 [archive/index.md §2](archive/index.md) 定义的「3-5 个已归档阶段」上界；M36 是主窗口最早的完整段，按该健康策略迁出）
  - **M37**：[archive/todo-archive-phases-m37.md](archive/todo-archive-phases-m37.md)（**2026-10-11 M42 归档批次预防性分片迁出**——M42 段新增后完整段将达 6 个，超 [archive/index.md §2](archive/index.md) 定义的「3-5 个已归档阶段」上界；M37 是主窗口最早的完整段，按该健康策略迁出）
  - **M38**：[archive/todo-archive-phases-m38.md](archive/todo-archive-phases-m38.md)
  - **M44**：[archive/todo-archive-phases-m44.md](archive/todo-archive-phases-m44.md)（2026-10-19 M45 归档批次迁出——M45 段新增后主窗口超出 500 行健康窗口，按「主窗口保留最近 3-5 个完整段」+ 行数阈值处置）
  - **M43**：[archive/todo-archive-phases-m43.md](archive/todo-archive-phases-m43.md)（同上批次迁出——M44 迁出后仍超阈值，M43 为主窗口次早完整段）
  - **M42**：[archive/todo-archive-phases-m42.md](archive/todo-archive-phases-m42.md)（2026-10-22 M46 归档批次迁出——M46 段新增后主窗口超 500 行，M42 为次早完整段）
  - **M45**：[archive/todo-archive-phases-m45.md](archive/todo-archive-phases-m45.md)（2026-10-24 M47 归档批次迁出——M47 段新增后主窗口需保持 3 个完整段，M45 为次早完整段）

## 主窗口保留范围
- 主文档保留最近 3-5 个完整段的近线归档块（当前 4 个：**M48** + M47 + M46 + M41，按时间倒序排列在顶部；**M45 于 2026-10-24 M47 归档批次迁出**至 [todo-archive-phases-m45.md](archive/todo-archive-phases-m45.md)；**M42 于 2026-10-22 M46 归档批次迁出**至 [todo-archive-phases-m42.md](archive/todo-archive-phases-m42.md)；**M44 / M43 于 2026-10-19 M45 归档批次迁出**至 [todo-archive-phases-m44.md](archive/todo-archive-phases-m44.md) / [todo-archive-phases-m43.md](archive/todo-archive-phases-m43.md)；**M40 及更早阶段的完整段已收敛为指针段**，内容与 commits 见各自分片）。
- **2026-10-25 M48 归档批次**：M48 段（6 原子压缩块）新增至主窗口顶部；主窗口完整段保持 **4 个**（M48 + M47 + M46 + M41，未触发迁出）；`todo.md` 骨架化为无活跃阶段；M48.6 的 commit 与本批次尚未推送（`origin/master = 7b58c81b`，ahead 动态核验）。
- **2026-10-24 M47 归档批次（当时）**：M47 段（6 原子压缩块）新增至主窗口顶部；M45 段迁出至 [todo-archive-phases-m45.md](archive/todo-archive-phases-m45.md)（主窗口完整段保持 3 个：M47 + M46 + M41）；`todo-archive.md` 417 行（`wc -l` 实测；较迁移前 500 行净减 83）；首父链 35 commits / ahead 0（`e190b975^..327a02e0`，双向核验）。
- **2026-10-19 M45 归档批次**：M45 段（6 原子条目 + 阶段期间 9 批追加临时待办）新增至主窗口顶部；追加待办在归档块内压缩为清单表（逐批详情见 [archive/index.md §4](archive/index.md)），M45.1~M45.6 完整条目保留。M45 段新增前主窗口 496 行，新增后按「3-5 个完整段 + ≤500 行」双约束处置：**M44**（171 行）与 **M43**（42 行）迁出为分片（迁出后对其全部外链重指分片，`rg` 复核 0 残留旧锚点）；M45.6 批次已由用户推送 `origin/master`。
- **2026-10-15 M44.4 批次③ 迁出记录**：M40 / M39 完整段随该批次迁出至 [todo-archive-phases-m39-m40.md](archive/todo-archive-phases-m39-m40.md)（主窗口完整段由 5 个收敛为 3 个，原位置留指针段）。
- **2026-10-14 M43 归档批次**：M43 段（6 原子条目 **50 commits**（阶段启动 1 + 前置热修 3 + M43.1 3 + M43.2 27 + M43.3 5 + M43.4 3 + M43.5 4 + M43.6 4；`git log master --first-parent --oneline 68ad47f^..HEAD` 去重统计，实证见 [commit 数量](archive/todo-archive-phases-m43.md#m43-pr-check-能力补强--运行时可靠性与工程治理2026-10-12-用户决策方案-a--2026-10-14-归档)））新增至主窗口顶部；主窗口保留范围相应调整为 **M43/M42/M41/M40/M39 共 5 个完整段**（位于 [archive/index.md §2](archive/index.md) 定义的 3-5 个阶段区间上界）；**M38 完整段随 M43 新增预防性迁出**至 [archive/todo-archive-phases-m38.md](archive/todo-archive-phases-m38.md)（M43 段新增后完整段将达 6 个，超区间上界，M38 为主窗口最早完整段）；M43 前期条目（M43.1 / M43.2 / M43.3 及其前）已由用户推送 `origin/master`，M43.4 / M43.5 / M43.6 共 11 commits 归档前为本地 ahead（`git rev-list HEAD ^origin/master --count` 实测 = 11，`origin/master ^HEAD` = 0 双向核验），待用户推送确认。同期同步 `M0-M42` → `M0-M43` 里程碑口径（`docs/index.md` + `backlog.md` + `todo.md`）。
- **2026-10-10 M41 归档批次**：M41 段（5 原子条目 **15 commits**（阶段启动 1 + M41.1 5 + M41.2 2 + M41.3 3 + M41.4 2 + M41.5 2；`git log master --first-parent --oneline 1681d0a^..HEAD` 去重统计，实证见 [commit 数量](#m41-规范与经验管理体系重构m411m415-全部已闭环--2026-10-10-归档)）；范围内另有 1 commit 属并行 session 的候选登记，不计入本阶段）新增至主窗口顶部；主窗口保留范围相应调整为 **M41/M40/M39/M38/M37 共 5 个完整段**（位于 [archive/index.md §2](archive/index.md) 定义的 3-5 个阶段区间上界）；**M36 完整段随 M41 新增预防性迁出**至 [archive/todo-archive-phases-m36.md](archive/todo-archive-phases-m36.md)；M41 全部 commits 归档时为本地 ahead（`git rev-list HEAD ^origin/master --count` 归档前实测 = 21，`origin/master ^HEAD` = 0 双向核验），待用户推送确认。同期同步 `M0-M40` → `M0-M41` 里程碑口径（`docs/index.md` + `docs/i18n/en-US/index.md` + `backlog.md` + `todo.md`）。
- **2026-10-10 M40 归档批次**：M40 段（6 原子条目 **20 commits**（阶段启动 1 + M40.6 5 + M40.5 2 + M40.2 2 + M40.3 4 + M40.4 3 + M40.1 3；`git log master --first-parent --oneline origin/master..HEAD` 去重统计，实证见 [commit 数量](archive/todo-archive-phases-m39-m40.md#m40-运行时可靠性与可观测性深化m401m406-全部已闭环--2026-10-10-归档)））新增至主窗口顶部；主窗口保留范围相应调整为 **M40/M39/M38/M37/M36 共 5 个完整段**（位于 [archive/index.md §2](archive/index.md) 定义的 3-5 个阶段区间上界）；**M35 完整段随 M40 新增预防性迁出**至 [archive/todo-archive-phases-m35.md](archive/todo-archive-phases-m35.md)（M40 段新增后完整段将达 6 个，超区间上界，M35 为主窗口最早完整段）；M40 全部 commits 归档时为本地 ahead（`git rev-list HEAD ^origin/master --count` 实测 = 20，`origin/master ^HEAD` = 0 双向核验），待用户推送确认。同期同步 `M0-M39` → `M0-M40` 里程碑口径（`docs/index.md` + `docs/i18n/en-US/index.md` + `backlog.md` + `todo.md`）。
- **2026-10-10 M39 归档批次**：M39 段（6 原子条目 **23 commits**（阶段启动 1 + M39.3 3 + M39.1 3 + M39.2 4 + M39.5 4 + M39.4 4 + M39.6 4；`git log master --first-parent --oneline origin/master..HEAD` 去重统计，实证见 [commit 数量](archive/todo-archive-phases-m39-m40.md#m39-平台视图体验与可观测补强m391m396-全部已闭环--2026-10-10-归档)））新增至主窗口顶部；主窗口保留范围相应调整为 **M39/M38/M37/M36/M35 共 5 个完整段**（位于 [archive/index.md §2](archive/index.md) 定义的 3-5 个阶段区间上界）；**M34 完整段随 M39 新增预防性迁出**至 [archive/todo-archive-phases-m34.md](archive/todo-archive-phases-m34.md)（M39 段新增后完整段将达 6 个，超区间上界，M34 为主窗口最早完整段）；M39 全部 commits 归档时为本地 ahead（`git rev-list HEAD ^origin/master --count` 实测 = 23，`origin/master ^HEAD` = 0 双向核验），待用户推送确认。同期同步 `M0-M38` → `M0-M39` 里程碑口径（`docs/index.md` + `docs/i18n/en-US/index.md` + `backlog.md` + `todo.md`）。
- **2026-10-09 M38 归档批次**：M38 段（6 原子条目 **16 commits**（自 M37 归档末 `5a5c99b` 起 `git log master --first-parent` 去重统计：设计先行稿 1 + 阶段启动规划 1 + M38.1 4 + M38.2 2 + M38.3 2 + M38.4 2 + M38.5 2 + M38.6 2，实证见 [commit 数量](archive/todo-archive-phases-m38.md#m38-平台执行模型隔离m381m386-全部已闭环--2026-10-09-归档)））新增至主窗口顶部；主窗口保留范围相应调整为 **M38/M37/M36/M35/M34 共 5 个完整段**（位于 [archive/index.md §2](archive/index.md) 定义的 3-5 个阶段区间上界）；**M33 完整段随 M38 新增预防性迁出**至 [archive/todo-archive-phases-m33.md](archive/todo-archive-phases-m33.md)（M38 段新增后完整段将达 6 个，超区间上界，M33 为主窗口最早完整段）；M38 全部 commits 归档时为本地 ahead（`git rev-list HEAD ^origin/master --count` 实测 = 18（含 M37 收尾 2），`origin/master ^HEAD` = 0 双向核验），待用户推送确认。同期同步 `M0-M37` → `M0-M38` 里程碑口径（`docs/index.md` + `docs/i18n/en-US/index.md` + `backlog.md` + `todo.md`）。
- **2026-10-05 M36 归档批次**：M36 段（10 原子条目 **42 commits** 实证见 [commit 数量](archive/todo-archive-phases-m36.md#m36-治理债清仓--可观测性与测试稳定性m361m3610-全部已闭环--2026-10-05-归档)）新增至主窗口顶部；主窗口保留范围相应调整为 **M36/M35/M34/M33/M32 共 5 个完整段**（位于 [archive/index.md §2](archive/index.md) 定义的 3-5 个阶段区间上界）；**M31 完整段随 M36 新增预防性迁出**至 [archive/todo-archive-phases-m31.md](archive/todo-archive-phases-m31.md)（M36 段新增后完整段达 6 个，超区间上界，M31 为主窗口最早完整段）；M36 全部 commits 已推送 `origin/master`（`git rev-list HEAD ^origin/master --count` 归档时实测 = 0）。同期同步 `M0-M35` → `M0-M36` 里程碑口径（`docs/index.md` + `docs/i18n/en-US/index.md` + `backlog.md` + `todo.md`）。
- **2026-10-02 M35 归档批次**：M35 段（6 原子条目 **7 commits** 实证见 [commit 数量](archive/todo-archive-phases-m35.md#m35-批量运行终态兜底对账--进度可见性修复m351m356-全部已闭环--2026-10-02-归档)）新增至主窗口顶部；主窗口保留范围相应调整为 **M35/M34/M33/M32/M31 共 5 个完整段**（位于 [archive/index.md §2](archive/index.md) 定义的 3-5 个阶段区间上界）；**M30 完整段随 M35 新增预防性迁出**至 [archive/todo-archive-phases-m30.md](archive/todo-archive-phases-m30.md)（M35 段新增后完整段将达 6 个，超区间上界，M30 为主窗口最早完整段）；M35 全部 commits 已推送 `origin/master`（`git rev-list HEAD ^origin/master --count` 归档时实测 = 0）。同期同步 `M0-M34` → `M0-M35` 里程碑口径（`docs/index.md` + `docs/i18n/en-US/index.md` + `backlog.md` + `todo.md`）。
- **2026-10-01 M34 归档批次**：M34 段（7 原子条目 **25 commits** 实证见 [commit 数量](archive/todo-archive-phases-m34.md#m34-治理与体验收口--组件库升级与巡检基建m341m347-全部已闭环--2026-10-01-归档)）新增至主窗口顶部；M34 段实增 40 行（主窗口 648 → 迁出 M29 后 533 → 新增 M34 段与批次说明后 573 行），**未触及 700 强制分片阈值**；**M29 完整段随 M34 新增预防性迁出**至 [archive/todo-archive-phases-m29.md](archive/todo-archive-phases-m29.md)；同期同步 `M0-M33` → `M0-M34` 里程碑口径（`docs/index.md` + `docs/i18n/en-US/index.md` + `backlog.md` + `todo.md`）。M34 commits 归档时为本地 ahead（`git rev-list HEAD ^origin/master --count` 实证，待用户推送）。
- **2026-09-30 M33 归档批次**：M33 段（11 原子条目 **20 commits** 实证见 [commit 数量](archive/todo-archive-phases-m33.md#m33-治理债收口--测试基建扩展m331m3311-全部已闭环--2026-09-30-归档)）新增至主窗口顶部；M33 全部 commits 已推送 `origin/master`（`git rev-list HEAD ^origin/master --count` 归档时实测 = 0）。主窗口保留范围相应调整为 **M33/M32/M31/M30/M29 共 5 个完整段**（位于 [archive/index.md §2](archive/index.md) 定义的 3-5 个阶段区间上界）+ M23 / M27 / M26 / M22 等指针段；**M23 完整段随 M33 新增预防性迁出**至 [archive/todo-archive-phases-m23.md](archive/todo-archive-phases-m23.md)（M33 段新增前主窗口 655 行 + M33 段新增将超 700 强制分片阈值）；段新增后主窗口 648 行，**未触及 700 强制分片阈值**（位于 [文档规范 §3 阈值表](../standards/documentation.md#3-文档行数阈值) 的 501-700 warning 带）；同期同步 `M0-M32` → `M0-M33` 里程碑口径（`docs/index.md` + `docs/i18n/en-US/index.md` + `backlog.md`）。
- **2026-09-30 M32 归档批次**：M32 段（5 原子条目 **26 commits** 实证见 [commit 数量](archive/todo-archive-phases-m32.md#m32-能力扩展优先m321m325-全部已闭环--2026-09-30-归档) + 1 merge commit `300e833`）新增至主窗口顶部；阶段启动 2 commits（`6315119` + `f3e6423`）已在 `origin/master`，M32 全部 commits 已推送 `origin/master`（本批核验：`git merge-base --is-ancestor 0c79845 origin/master` 成立）。主窗口保留范围相应调整为 **M32/M31/M30/M29/M23 共 5 个完整段**（位于 [archive/index.md §2](archive/index.md) 定义的 3-5 个阶段区间上界）+ M27/M26 指针段；段新增后主窗口 655 行，**未触及 700 强制分片阈值**（位于 [文档规范 §3 阈值表](../standards/documentation.md#3-文档行数阈值) 的 501-700 warning 带），故本批次无预防性迁出；同期同步 `M0-M31` → `M0-M32` 里程碑口径（`docs/index.md` + `docs/i18n/en-US/index.md` + `backlog.md` + `todo.md`）。
- **2026-09-27 M29 归档批次**：M29 段（9 原子条目 35 atomic commits = **35 commits 全部 ahead=0 已推送至 origin/master**）新增至主窗口顶部；主窗口保留范围相应调整为 M29/M28/M27/M26/M23 共 5 个阶段（M22 完整段于 2026-09-28 M30 归档批次预防性迁出，见下条）。
- **2026-09-28 M30 归档批次**：M30 段（6 原子条目 7 commits + 2 docs 收口 + 6 衍生治理 = **15 commits 全部 ahead=0 已推送至 origin/master**）新增至主窗口顶部；主窗口保留范围相应调整为 M30/M29/M27/M26/M23 共 5 个阶段；**M22 完整段随 M30 新增预防性迁出**至 [archive/todo-archive-phases-m22.md](archive/todo-archive-phases-m22.md)（M30 段新增前主窗口 682 行 + M30 段新增将超 700 强制分片阈值）。
- **2026-09-29 M31 归档批次**：M31 段（6 原子条目 **17 commits** 实证见 [commit 数量](archive/todo-archive-phases-m31.md#m31-appsplatform-ui-组件库迁移primevue--caomei-ui-m311m316-全部已闭环--2026-09-29-归档) + 1 启动决策 commit `a05ac3b`）新增至主窗口顶部；其中 M31.1-M31.4（11 commits）已推送 `origin/master`，M31.5-M31.6（6 commits）归档时为本地 ahead（`git rev-list HEAD ^origin/master --count` 实证）。主窗口保留范围相应调整为 **M31/M30/M29/M23 共 4 个完整段** + M27/M26 指针段；段新增后主窗口 607 行，**未触及 700 强制分片阈值**（位于 [文档规范 §3 阈值表](../standards/documentation.md#3-文档行数阈值) 的 501-700 warning 带），故本批次无预防性迁出；同期同步 `M0-M30` → `M0-M31` 里程碑口径（`docs/index.md` + `docs/i18n/en-US/index.md` + `backlog.md`）。
- 当 `todo-archive.md` 超过 700 行时，将早期阶段迁入分片归档（最近一次迁出于 2026-10-14 M43 归档批次预防性迁出 M38 至新分片 `todo-archive-phases-m38.md`，主窗口完整段保持 5 个）。
- **2026-10-10 M41 归档批次**预防性迁出 **M36** 至新分片 `todo-archive-phases-m36.md`（主窗口完整段保持 5 个）。
- **2026-08-20 归档批次**：M9 / 2026-08-19 PR1-PR3 / 2026-08-19 C54+C55 / M11 推进批次迁入分片 [archive/todo-archive-phases-m11.md](archive/todo-archive-phases-m11.md)。
- **2026-08-25 归档批次**：M12 9 子任务完整闭环，**所有 19 commits 已推送至 `origin/master`**（ahead=0，git rev-list HEAD ^origin/master --count 核验）。详见 [archive/todo-archive-phases-m12.md](archive/todo-archive-phases-m12.md)（**2026-08-28 M17 归档批次预防性分片迁出**）。
- **2026-08-26 归档批次（M13）**：M13.1+M13.2+M13.3+M13.4 全部 12 子任务完整闭环，**26 commits 已推送至 `origin/master`**（含 T1310 部分 ahead commit；git rev-list HEAD ^origin/master --count 实证：ahead=3，仅 M13.4 三 commits 当时待推送（后续已推送 origin/master）：T1401 `2dce01d` + T1402+T1403 `bb3b49a` + todo.md 收口 `8762a4b`）。详见 [archive/todo-archive-phases-m13.md](archive/todo-archive-phases-m13.md)（**2026-08-30 M18 归档批次预防性迁出**）。
- **2026-08-30 归档批次（M18）**：M18.0+M18.1+M18.2+M18.3+M18.4+M18.x 全部 6 子阶段 + 1 治理批次完整闭环，**~24 commits 已全部推送至 `origin/master`**（ahead=0 `git rev-list HEAD ^origin/master --count` 2026-08-30 实测）。详见下方 §M18 段。
- **2026-08-31 归档批次（M19）**：M19.1+M19.2+M19.3+M19.4+M19.5 全部 5 子任务完整闭环，**5 commits 已全部推送至 `origin/master`**（ahead=0 `git rev-list HEAD ^origin/master --count` 2026-08-31 实测；M19.1 `0c536c1` + M19.2 `c998d58` + M19.3 `5839771` + M19.4 `8db2fd4` + M19.5 `a20ea02` + M19.x 收口 `ae33671` + 配套 commits `2f9eb38` / `bee5c3f` / `61b3ddc` / `4231ffb` 共 11 commits 落地）。详见下方 §M19 段。
- **2026-08-31 同期动作**：M14 + M15 共 2 个早期批次从 todo-archive.md 主窗口预防性迁出至新分片 [archive/todo-archive-phases-m14-m15.md](archive/todo-archive-phases-m14-m15.md)（M19 段新增前主窗口 699 行 + M19 段预估 80-100 行将超 700 强制分片阈值，预防性迁出与 M18/M17/M16 归档批次预防性迁出 M13/M12/M10 同源策略）；主窗口保留范围相应调整为 M19/M18/M17/M16 共 4 个完整段。
- **2026-08-26 同期动作（已迁出）**：M14.1 / M14.2 / M14.3 / M14.x / M14.y + M15.1 详见 [archive/todo-archive-phases-m14-m15.md](archive/todo-archive-phases-m14-m15.md)（2026-08-31 M19 归档批次预防性迁出）。M14.1 / M14.2 / M14.x / M14.y 阶段 commits 已全部推送至 `origin/master`（ahead=0 `git rev-list HEAD ^origin/master --count` 2026-08-26 实测）；M15.1 3 commits 落地 + release.yml CI 修复 1 commit 同期落地（后续已推送 origin/master；ahead commits 按 [规划规范 §4.4 §5 ahead 实证](../../docs/standards/planning.md) 动态核验）。

---

## M48: 对外 PR 交付闭环（2026-10-24 用户决策 D+E / 2026-10-25 归档）

> **归档摘要**：6 原子条目；首父链 **41 commits**（M48.1 12 / M48.2 5 / M48.3 7 / M48.4 6 / M48.5 6 / M48.6 5，均含各原子闭环登记；`git log --first-parent --oneline 251c392c^..3bdd77fd` 去重统计）。类型平衡 🛠️ 5 + 🚀 1（🎨 / 🧪 独立条目缺口显式标注：UX 由已授权 E 阶段承担、测试随各条目内嵌）。阶段基线 **35-55 文件 / 2200-3700 行**；实际六条目按各原子收口记录累加 **204 文件 / +12,724 −931**，全阶段唯一 diff 实测 **127 文件 / +12,718 −925**——相当于基线文件约 2-4 倍、行约 3-6 倍，作为后续阶段容量校准数据记录。设计依据统一为 [pr-delivery-closure.md](../design/governance/pr-delivery-closure.md)（六原子落在同一稿，未另立专项稿）。

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

## M47: 交付判定可信与运行自证（2026-10-22 用户决策方案 A′ / 2026-10-24 归档）

> **归档摘要**：6 原子条目；首父链 35 commits（阶段启动 3 + 文档订正 2 + Node 安全基线插队 3 + M47.6 3 + M47.2 5 + M47.1 4 + M47.3 4 + M47.4 6 + M47.5 5）。类型平衡 🎨 1 + 🛠️ 2 + 🚀 2 + 🧪 1（🎨 独立条目低于建议值 2，缺口显式标注）；阶段基线 41-59 文件 / 1600-2650 行；M47.1 因实际 diff 新增 governance 专项稿 `verification-ci-alignment.md`，M47.2 / M47.3 / M47.4 / M47.5 触发阈值后复用既有设计稿（run-failure-taxonomy / dependency-fixer-records / pnpm-lockfile-fixer / gitignore-management / platform-notification）。六条目均通过 Review Gate（M47.1 / M47.2 / M47.4 R1 Reject：M47.1 两分区、M47.2 分区 A、M47.4 两分区；M47.5 / M47.6 分区 B Reject；均收口后 Pass）；归档前 `git rev-list` 双向核验 ahead 0 / behind 0（origin/master = `327a02e0`）。

> **证据来源**：各批次测试 / 审计数字取自 `.session/runtime-state.json` §`m47_*`（本地会话记录，gitignored，均不入库）与 `artifacts/review-gate/` 工件（gitignored）；复核以对应 commit 与测试命令为准。

### M47.1 [P1 🎨] 验证链与目标仓库 CI 口径对齐（**已闭环** `384d2a21` + `8888999e` + `612a457b` + `4d11c83b` + 本条登记）

- **目标**：让 PR 正文 / 运行报告明确回答「本次验证链与目标仓库 CI 是否同一口径」，默认分支同 workflow 已红时标注「非本 PR 引入」。
- **落地**：core 新增 `CiAlignmentRecord` 四态模型与 Markdown 渲染；engine 只读默认分支 `.github/workflows` 的 `jobs.*.steps[].run`（`lstat` 拒绝软链 / 非普通文件，文件数与字节上限超限整体降级），识别 lint / build / typecheck / test 四语义项并做四态比对；默认分支健康预检单次 5s、最多 3 workflow、失败只 warn；`verifyProject` 记录实际执行命令集（并集），PR 正文新增固定行预算的「CI 口径」区块；平台零代码改动（`RunResult.ciAlignment` 随结果回到 `generatePRBody`），run 详情 UI 不做。
- **审计**：deep 两分区 R1 均 Reject（A：软链 `/dev/zero` 绕过字节上限并同步阻塞、计划链误报、多仓指针与 20 文件静默截断；B：设计稿超限语义与实现不符、平台零改动未记录）→ 全部收口（安全硬修、实际命令并集、剩余预算不足整块跳过、白名单 / sanitize）→ quick R2 Pass（2W）→ 收口 → quick R3 Pass（1 非阻塞 warning 已修）；mutation 4/4。
- **证据**：engine 82 文件 / 1471 passed；core 9 文件 / 197 passed；全仓 304 文件 / 4636 passed；platform 161 文件 / 2072 passed；lint 0 error；typecheck 7 包；文档七项 + `docs:build`；新增行编号标记 0。
- **边界**：只识别命令子集（matrix / secrets / services 语义不解析）；不按 workflow 替换 `verifyCommands`；健康预检单次调用、失败降级「未获取」。

### M47.2 [P1 🛠️] 构建版本回执与安装日志语义订正（**已闭环** `abed1ad5` + `1a557e1a` + `07456c81` + `9624bd87` + `ceb9b7f8` + 本条登记）

- **目标**：让日志与落库回答「本次运行由哪个构建执行」，并把 `Lockfile repaired` 的中性语义写清。
- **落地**：`scan_run.build_version` / `build_commit`（迁移 `2900000000000`，前缀感知 + 幂等 + 可空）+ 入队 / 同步新建写入、续跑 / `reuse` 刷新；`RuntimeConfig` 可选 `buildVersion` / `buildCommit`（无新增 env），引擎按「宿主注入 → 引擎包版本 → unknown」解析并输出 `[build] … source=host|engine-package`；运行详情弹窗「构建版本」元信息项（unknown / null 统一「未知」）；`tryLockfileRepair` 四分支文案（已合规 / 修复生效 / 状态未知 / 失败），旧串生产源码零残留。
- **审计**：deep 两分区 R1 A Reject（「零残留」口径不可复现 / D 阶段数字失真 + 4W）/ B Pass（4W）→ 全量收口（日志 `source`、B 模式口径、补 4 例、registry 真实增量迁移、`changed` 缺省中性文案、前端哨兵等值断言）→ quick R2 Pass → quick R3 Pass；mutation 4/4。
- **证据**：engine 83 文件 / 1487 passed；platform 161 文件 / 2090 passed；根全量 307 文件 / 4662 passed；lint 0 error；typecheck 7 包；定向 e2e alerts-sidebar 4 + scans 10；文档九项 + `docs:build`；编号 0。
- **边界**：`github-action` 模式两列记录平台构建，实际执行镜像在目标仓库 runner；不回填历史 run；版本不塞 `summaryJson`。

### M47.3 [P2 🛠️] 环境性失败归因收口（**已闭环** `73ef8895` + `0d1dd455` + `729d37db` + `8da62c55` + 本条登记）

- **目标**：收窄「环境性失败」判定，并让常规分组 / 逐包 / major / 成员四条升级路径消费安装结果 `environmental`。
- **落地**：判据单点化到 `fixers/process-signals#isEnvironmentalInstallError`（取消 → 非环境性；信号 / 超时 → 环境性；有 stderr → 非环境性；stderr 空 → 环境性；stdout 只作证据），lockfile 诊断链经适配器共用；四路径统一经 `markEnvironmentalInstallFailure` 记 `ENVIRONMENT_ERROR` + 动作标记，不增 `alertsFailed`；停机语义端到端传导（成员返回 stop 标志、分组停机前跑组级验证、跨线置 `stopReason`）；取消守卫不产出 K 条同因失败；`not-fixable` 记账前移到告警分区处；`computeExitCode` 谓词零改动。
- **审计**：standard 两分区均 Pass（A 3W/4S、B 7W/4S）→ 全量收口 → quick R2 Pass（8 项全 closed，新增 2W 已修）；mutation 8/8。
- **证据**：engine 83 文件 / 1508 passed；全仓 307 文件 / 4683 passed；lint 0 error；typecheck 7 包；文档九项 + `docs:build`；编号 0。
- **边界**：静默非零退出（只写 stdout）仍按环境性处理，不增 `alertsFailed`、exit 0（证据进 `FixAction.error` 与日志）；历史 run 不回填。

### M47.4 [P2 🚀] pnpm store 持久化与提交卫生（**已闭环** `6acaf252` + `083b7a66` + `50e55e61` + `64f10c57` + `1dd677e3` + CI 首跑修复 `327a02e0`）

- **目标**：store 固定持久卷 + 交付提交排除 store / `node_modules`。
- **落地**：入口默认 `PNPM_CONFIG_STORE_DIR=$DATA_DIR/pnpm-store`（实测 pnpm 11 下 `npm_config_store_dir` 与项目 `.npmrc` 无效）；可写性用运行身份写探针（`test -w` 不看挂载只读属性），不可用 unset 回退；store 目录以运行身份创建、不对任意路径 chown、根 / 相对路径拒绝；引擎在 `run()` 起始（`executeMode()` 前）幂等写目标仓库 `.git/info/exclude`（子目录 / 工作树经 `rev-parse --git-common-dir` 解析，取反行按最后匹配胜出），仅 `fix` / `fix-and-pr` 且非 dry-run；Dockerfile 不固化 ENV、compose 同名转发、smoke 0c 落点断言。
- **审计**：standard 两分区 R1 均 Reject → R2（A Pass / B Reject）→ R3 Reject（矩阵 / no-chown 守卫）→ quick R4 Pass；mutation 8/8。
- **CI 首跑修复**：`327a02e0` 修 smoke 0c 宿主侧断言 × 入口 chown 的权限交互（非 root runner 失去 search 权限 → `[ -d ]` 恒假；数据目录 755 + 清理前交还所有权 + 失败打印 `ls -ld`），非 root / root 均 PASS。
- **证据**：engine 84 文件 / 1533 passed；全仓 308 文件 / 4725 passed；平台 docker 32 passed；真机四场景 + smoke 0c；lint 0 error；typecheck 7 包；文档九项 + `docs:build`；编号 0。
- **边界**：不做 store 自动 GC；多仓共享 store 并发控制不做（队列并发 1）；store 与工作目录须同文件系统；`.gitignore` 取反优先于 `info/exclude`。

### M47.5 [P2 🚀] 通知周汇总 weekly_digest（**已闭环** `51cd8287` + `7eb5e1af` + `c554f267` + `a6d94923` + `b447c87e` + 本条登记）

- **目标**：固定周期插件（默认关闭），按 ISO 周 + 用户逐封去重，发送活跃未修复高危快照。
- **落地**：`weekly-digest-schedule`（ISO 周键 / 24h 触发窗口 / 小时 env 解析）+ `weekly-digest.service`（部署 → 组织 → 个人三层开关、全局活跃快照、逐用户投递）+ 插件（HTTP-only 角色守卫、30s 首跑 + 15 分钟节拍、组织 / 部署关闭时窗口内可重试）；`dispatchNotification` 扩展 `recipientUserId` / `recipientIdentity`，weekly_digest 豁免指纹 / 冷却 / 每小时上限并按「收件人 + 渠道 + ISO 周」占位；周报 sent 行不计入共享上限；正文披露截断与 `RunSummary.alertsConverged`；UI 去掉禁用态与占位说明。
- **审计**：standard 两分区 A Pass（3W/7S）/ B Reject（2B/6W/4S：diff 数字 / 交付物拆分）→ 全量收口 → quick R2 Pass（新 4 条 minor 已处理）；mutation 6/6。
- **证据**：platform 164 文件 / 2142 passed；通知域 17 文件 / 137 passed；notifications e2e 4 passed；视觉 update 一次 + no-update 连跑两遍 17 passed（仅 `notifications-light` 重建）；lint 0 error；typecheck 7 包；文档十项 + `docs:build`；编号 0。
- **边界**：部分用户失败本周内不重试；组织 / 部署关闭不写投递记录；零告警仍发送；locale 取部署级；仅截断无明细的仓库不披露；无 dark / settings 视觉基线；明细不含 converged 标记；崩溃遗留 `sending` 的窄场景。

### M47.6 [P3 🧪] 工程门禁与提交卫生收口（**已闭环** `ed26b5b7` + `9178a62b` + `0242aa30` + 本条登记）

- **目标**：补齐子任务字母后缀编号、经验归档子条目落点、lint-staged 全量暂存三条缺口。
- **落地**：`check-orphan-ids` 支持 `M43.2a` 形态并移除失效 D3 白名单；`check-experience-landing` 改为编号 `###` 子条目逐条校验、自指落点判空；lint-staged 三条业务 glob 移除裸 `git add` 并改文件级任务（生成物同步保留 pathspec 例外）；文档与检查点矩阵同步。
- **审计**：quick 分区 A Pass（0B/4W/3S）/ B Reject（B1 code-auditor 必查项 stale）→ quick R2 Reject（B2 交付物计数 14 vs 实测 19 且 0 commit）→ quick R3 Pass；mutation 5/5。
- **证据**：scripts 40 文件 / 748 passed（新增 15 例）；`check:orphan-ids` 0（780 文件）；`check:experience-landing` OK；lint 0 error；typecheck 7 包；文档八项 + `docs:build`；lint-staged 实测仅暂存目标文件。
- **边界**：CLI 退出码 / `--json` 无单测；`*.mjs` 不在 lint-staged 的 `*.js,ts` glob；CSS/Vue 任务仍为平台级 stylelint；共享尾部结构小节只惠及最后一个编号子条目。

### 阶段期间插队与文档订正（不占阶段条目编号）

- **Node 运行时安全基线升级（2026-10-22，3 commits / 19 文件）**：镜像改官方 `node:24.22.1-alpine`（manifest list digest）+ 移除 corepack shim 钉 pnpm 11.18.0 + runtime 去 npm/corepack/yarn + `check-node-version.mjs`（22/24/26 发布线，EOL 拒绝）+ `npm_config_nodedir` + 可选 `APK_MIRROR` / `NPM_REGISTRY` 构建参数；engines 抬升到 `^22.23.4 || ^24.22.1`（BREAKING CHANGE: Node 20 不再支持）；审计 standard R1（5W/5S）→ R2（2W）→ R3 quick Pass；镜像构建 + 冒烟 PASS。
- **运行面漏洞检测候选与基线口径订正（`f7b19003` + `ba726710`）**：订正 monorepo 运行面基线口径并登记候选，补数据源实测。

> **闭环记录（2026-10-24）**：六原子全部闭环；M47.1 新增 governance 专项稿 verification-ci-alignment；M47.2 / M47.3 / M47.4 / M47.5 触发阈值后复用既有设计稿（run-failure-taxonomy / dependency-fixer-records / pnpm-lockfile-fixer / gitignore-management / platform-notification），未另立专项稿。审计逐条目 R1 均以 Pass 或收口后 Pass 放行；全阶段 lint 0 error、typecheck 7 包、根全量 308 文件 / 4725 passed、platform 164 文件 / 2142 passed、engine 84 文件 / 1533 passed、视觉 17 passed ×3、文档与 i18n 门禁通过。归档前 `git rev-list --count` 双向核验 ahead 0 / behind 0（origin/master = `327a02e0`）。
> **残余（跨条目）**：CI 口径只识别命令子集、不承诺结果；构建版本 B 模式记录平台构建；环境性失败静默 stdout 边界；store 无自动 GC / 并发控制；周报明细不含 converged 标记；门禁脚本 `*.mjs` 无 pre-commit lint。各项详见上文明细。

## M46: 运行结果可信度与可观测性（2026-10-20 用户决策方案 A / 2026-10-22 归档）

> **归档摘要**：6 原子条目；M46.5 B1-B4 闭环、B5 周汇总延期（见 backlog）。六条目逐项 R1/R2 收口（M46.2 / M46.3 / M46.5 曾 Reject，最终均 Pass）；归档前 ahead 以 `git rev-list` 双向核验（见 archive/index §4）。

### M46.1 [P1 🎨] 环境性失败与「有告警未修」的可见性（**已闭环** `c3132555` + `900ab6f1` + `a70c5dc4` + `c040e05b` + `c7101de8` + `b36bcb36` + 本条登记）
- **目标**：让「运行完成但存在环境性失败 / 有可修告警却 0 修复」在运行列表与详情可见，而不是显示为纯成功；引擎 exit code 与环境性失败计数落库，形成可查询的事实。
- **优先级**：P1
- **范围**：
  - `packages/core/src/report/types.ts`（`RunSummary` 新增环境性失败计数）；`packages/engine/src/app/result-assembly.ts:146-181`（环境性动作统计）；`packages/engine/src/app/repo-fix.ts` / `repo-fix-finalize.ts`（累加点）。
  - `apps/platform/server/entities/scan-run.ts`（新增 `exit_code` / `environmental_failure_count`）；新增幂等迁移并登记 `server/database/index.ts` 与迁移注册表测试。
  - `apps/platform/server/services/scan-orchestrator.service.ts:397-467`（终态落库）；`scan-run-state.ts:96-142`（复用同一判定，避免双源）；`apps/platform/server/api/scan-history/**`（序列化）。
  - `apps/platform/app/pages/scans.vue` + `components/run-detail-dialog.vue` + `components/repo-history-dialog.vue`（行标记 / 两处详情区块）；`app/utils/run-view.ts`（派生函数）；i18n 双侧；e2e / 视觉 fixtures。
- **验收标准**：
  - [x] ① 新 run 落 `exit_code` 与 `environmental_failure_count`；旧数据为 `NULL` / `0` 时 API 与 UI 正常降级，不报错。
  - [x] ② 列表与详情在计数 > 0 时显示「环境性失败 N」与「未修复告警 N」，tooltip 说明「不归因本次运行但可见」；计数为 0 时不显示噪音标记。
  - [x] ③ 超时 / 无 `result` 的 run 显示「结果缺失」并保留 `execution_timeout` 分类，不误报成功；该 run 不参与告警明细 reconcile，UI 不显示误导性的「告警 0」。
  - [x] ④ 迁移二次执行幂等；单测覆盖 summary 累加、落库映射、派生函数；页面变化时更新视觉基线。
- **不做什么**：不改 exit code 0 / 1 / 2 语义；不做历史数据全量回填；不新增独立页面；不改 `run-failure-classify.ts` 的分类表（真实安装失败被并入环境性的分类语义收窄见 backlog「环境性失败分类语义收窄」）。
- **依赖**：2026-10-17 / 18 生产复盘（13 仓库「有告警 / 0 修复」）；`run-failure-classify.ts` 既有 `failure_kind`；M43.3 环境性归因与 M45 交付守卫（交接来源）。
- **交付物（实际）**：6 commits（不含本条登记）/ 39 文件 / 945 插入。拆分：`c3132555` core/engine 汇总契约（9 文件）；`900ab6f1` 实体列 + 迁移 + 终态落库（8）；`a70c5dc4` API 序列化 + fixtures（7）；`c040e05b` 列表 / 两处详情 / i18n（7）；`c7101de8` e2e + 视觉基线（5）；`b36bcb36` 标准与设计文档（3）。**超原估**（10-14 文件 / 300-450 行）的主因：`/scans?run=` 实际挂载 `repo-history-dialog`（与 alerts 侧栏 `run-detail-dialog` 为两套详情），两者都需展示结果可信度；另补列表 / 两详情 / 结果缺失的 e2e 与视觉前置断言。
- **风险与缓解**：**R1 双源判定漂移**（内存 exitCode 与落库计数不一致）→ `resolveScanRunOutcome` 纯函数单一映射 + 映射用例；**R2 UI 误读**（把「环境性失败」读成仓库代码问题）→ 文案与 tooltip 明确「不归因」；**R3 报告契约变更**（summary 新字段影响快照）→ core 类型契约测试 + 旧报告降级；**R4 无 result 的执行器合成 exitCode=2 污染** → 仅在 result.summary 存在时落两列；**R5 视觉基线阈值内假绿**（单字符差异低于 100px）→ 删除基线重建 + 截图前断言语义 + 两次 no-update。
- **闭环记录（2026-10-21）**：**审计** R1 `standard` 三分区并发（A core/engine/数据层 · B API/fixtures · C UI/视觉/文档）均 **Pass**（0 blocker；A 4 warning / B 3 warning / C 4 warning）→ 收口（无 result 两列 NULL、reuse 用例改为 catch-all 生效、主链路覆盖边界收窄 + backlog 候选、B 模式哨兵注释、0 值落库断言、repo-history 空态、已修复列归一、英文文案、结果缺失隐藏告警 0、converged 视觉覆盖等）→ R2 `quick` **Pass**（0 blocker / 1 warning：告警侧栏详情无断言）→ 补 `alerts-sidebar` e2e 的未修复 / 环境性失败 / 退出码 / 结果缺失断言 → 复跑通过。**门禁**：定向单测 141 passed（另 core/report 98 passed）；`test:visual` 16 passed（update 后连续两次 no-update；基线人工查看「未修复 1 / 环境性失败 1 / 退出码 1」，另以 `maxDiffPixels:0` 严格配置复验逐像素一致）；e2e 全量 198 passed + 2 flaky（repos-crud 删除 / scan-config 记住上次选择，单独重跑均通过），新增列表 / 两详情 / 结果缺失用例通过；`pnpm run lint` 0 error（3 warning：alerts.vue / scans.vue 存量 max-lines + scan-orchestrator.test max-lines-per-function）；`pnpm run typecheck` 7 包 Done；core / engine / platform build exit 0；`check:docs` / `check:doc-size`（warning 0）/ `lint:md:check` / `lint:i18n` / `check:orphan-ids`（0 命中）通过。**残余**：① 常规分组 / 逐包升级路径尚未消费 `environmental` 标记，计数可能低于真实环境性失败数（backlog「常规升级链路的环境性失败归因对齐」）；② `dispatched`（B 模式结果未就绪）仍显示「告警 0」，R1 接受为既有设计；③ `exit_code` 的 mysql / postgres 分支未实测（与既有同类迁移同风险）；④ 告警侧栏详情新增断言已覆盖，`run-detail-dialog` 的窄屏布局未单独验证。

### M46.2 [P2 🎨] 跨 major / 截断 / 子目录跳过的披露（**已闭环** `90034946` + `54942da9` + `37c93068` + `2673e044` + `73252ad7` + `05006854` + `966ea01e` + 本条登记）
- **目标**：运行详情与 PR 正文展示 `alertsTruncated`、按原因分组的 `alertsSkipped` 与未关闭告警数，避免「部分修复」被读成「全部修复」。
- **优先级**：P2
- **范围**：
  - `packages/core/src/report/types.ts:35-48`（新增 `alertsSkippedByReason`（不含截断）+ `alertsTruncatedBySeverity`，保持 `alertsSkipped` / `alertsTruncated` 总数兼容）；`packages/engine/src/app/repo-fix.ts:231,276,673,752` / `repo-report.ts:27`（按原因 / 严重级别累加）；`packages/core/src/report/markdown-generator.ts:59-61`（报告表）；`packages/engine/src/github/pr-creator.ts:540-724`（`generatePRBody` 的跳过区块）。
  - `apps/platform/app/components/run-detail-dialog.vue` + `components/run-outcome-breakdown.vue`（新增）+ `components/repo-history-dialog.vue` + `pages/scans.vue`（展示）；`apps/platform/i18n/locales/{zh-CN,en-US}.json`；e2e / 视觉 fixtures。**批次汇总未做**（条目内可选）。
- **验收标准**：
  - [x] ① 详情显示 `未修复 20 / 26 · 截断 6（未评估）· 跳过 4` 形式的分组；无跳过 / 截断时不显示空区块；列表增加紧凑 Tag。
  - [x] ② PR 正文含 Summary 的 Skipped / Truncated / Unfixed 与 `Not Fixed / Skipped` 分组表；Markdown 报告同口径；zh / en 文案成对。
  - [x] ③ 旧 `summaryJson` 缺分组字段时回退 `other` 总数，不抛错；`sum(alertsSkippedByReason) === alertsSkipped`、`sum(alertsTruncatedBySeverity) === alertsTruncated`，并有 helper / 引擎真实路径断言。
  - [x] ④ 单测覆盖分组累加、告警级未修复、旧数据回退与 PR / Markdown 文案；视觉基线按新增分组更新并连续两次无更新比对。
- **不做什么**：不改跳过策略与跨 major 判定；不放开 `allowMajorUpgrade`（仓库级开关见 backlog「仓库级 `allowMajorUpgrade` 开关」）；不改 PR 正文的既有指纹与去重逻辑。
- **依赖**：`report/types.ts` 既有 `alertsSkipped` / `alertsTruncated`；`repo-fix.ts` 累加点；M46.1 的未修复口径可复用；M46.5 消费 `alertsTruncatedBySeverity` 披露截断高危。
- **交付物（实际）**：7 commits（不含本条登记）/ 47 文件 / 1090 插入。拆分：`90034946` core 分组字段 + Markdown（9 文件）；`54942da9` engine 跳过归组 + 告警级未修复（10）；`37c93068` engine PR 正文 + summary 夹具（8）；`2673e044` platform 详情 / 列表 / i18n（8）；`73252ad7` 失败快照重算 + fixtures schema（5）；`05006854` e2e + 视觉基线（5）；`966ea01e` 设计与标准文档（2）。**超原估**（8-12 文件 / 250-400 行）的主因：R1 审计发现 `alertsFixed` 是 action 数，修复为告警级 `alertsUnfixed`（同包多 GHSA / 跨 major 部分满足）并补 converged 告警级计数；`/scans?run=` 实际挂载 `repo-history-dialog`（与 alerts 侧栏 `run-detail-dialog` 为两套详情），两者都需披露；另补列表 / 两详情 / 结果缺失的 e2e 与视觉前置断言。
- **风险与缓解**：**R1 分组口径漂移**（引擎累加点与展示口径不一致）→ 原因常量单一事实源 + 分组求和断言 + 与 core 枚举同序单测；**R2 PR 正文膨胀** → 分组表最多约 9 行，且紧跟 Summary、尾部截断不吞披露；**R3 旧数据降级遗漏** → 纯函数防御式解析 + `other` 回退用例；**R4 未修复用 action 数冒充告警数** → 新增告警级 `alertsUnfixed`，同包多告警 / 跨 major 部分满足用例；**R5 失败快照保留内存未修复数** → `alertsFixed=0` 时同步按 `found − converged` 重算。
- **闭环记录（2026-10-21）**：**审计** R1 `standard` 两分区（A core/engine · B UI/视觉/文档）：B **Pass**（4 warning），A **Reject**（1 blocker：unfixed 用 action 数冒充告警数；5 warning：not-fixable 吞 dedupe 已修复告警 / code-quality 落子目录桶 / 未修复分母含截断语义误导 / PR 分组区块过靠后 / 覆盖不足）→ 收口（新增 `alertsUnfixed` + 告警级 converged、not-fixable 逐条残差、code-quality 排除、文案改为「已评估 / 截断未评估」、PR 区块紧跟 Summary、补同包多告警 / 跨 major / not-fixable / 分组求和用例）→ R2 `quick` **Reject**（B1 残差：converged 仍包级；失败快照保留内存 `alertsUnfixed`；§5.7 / JSDoc 旧公式）→ 收口（converged 改告警级 + 同包两告警收敛用例、失败快照重算、文档/JSDoc 同步）→ R3 `quick` **Pass**（0 blocker；1 warning：versioned overrides 收敛分支当前不可达，已加防御性注释；2 suggest 已收口）。**门禁**：定向 vitest 257 passed（含 summary-counters / result-assembly / non-fixable / index-isolation / scan-orchestrator / pr-creator / run-view）；全量 e2e 干净库 200 passed + 1 flaky（scan-config 记住上次选择，单独重跑通过）；`test:visual` 16 passed ×2（update 后连续两次 no-update；基线人工查看 `未修复 20 / 26 · 截断 6（未评估）· 跳过 4`、`Critical 2` / `High 4` / `跨大版本 / 人工复核 4`）；`pnpm run lint` 0 error（3 warning：alerts.vue / scans.vue / scan-orchestrator.test 存量 max-lines）；`pnpm run typecheck` 7 包 Done；core / engine / platform build exit 0；`check:docs` / `check:doc-size`（warning 0）/ `lint:md:check` / `lint:i18n` / `check:orphan-ids`（0 命中）通过。**残余**：① 批次汇总 `batch-aggregate` 未扩展（条目内可选）；② `versioned overrides` 的 `alertsConverged` 告警级累加分支当前不可达（上游已按 overrides 非空过滤，保留防御性注释）；③ code-quality findings 现在计入未修复但不进入跳过原因（与 code-scanning 同源，由 Code Quality Findings 区展示）；④ B 模式 artifact 仍为 `as RunResult` 断言，缺 `summary` 的畸形 result 可能被外层 catch 归为 `orchestration_failed`（低概率既有风险）。

### M46.3 [P2 🛠️] 基线采样完整链与门禁回滚粒度（**已闭环** `d76dcea8` + `a0b5adf8` + `dd195219` + `e1fb087c` + `532552d7` + `87f0c0d6` + 本条登记）
- **目标**：修复前基线不再因首条命令失败而漏采后续（尤其 `test`）；门禁不再整仓回滚连带丢弃已验证通过的探针。目标可证伪：同一仓库的基线结果包含全部命令段；失败单元回滚后已通过探针仍可交付。
- **优先级**：P2
- **范围**：
  - `packages/engine/src/app/verify-project.ts:90-180`（基线改为完整链、各段独立记录；为 `SCRIPT_NOT_FOUND` / `No tests found` / 工具链缺失设与 `PRE_EXISTING_FAILURE` 同族豁免）；`packages/engine/src/runners/verification-runner.ts`（命令结果透传）。
  - `packages/engine/src/runners/verification-gate.ts:41-43`（回滚粒度）；`packages/engine/src/app/repo-fix*.ts`（探针边界与提交点）。
  - 设计口径同步：`docs/design/modules/dependency-fixer-records.md` + `docs/design/governance/run-failure-taxonomy.md`（基线 / 回滚语义）。
- **验收标准**：
  - [x] ① 基线即使首条命令失败，仍记录后续命令结果；`test` 进入基线，`No tests found` 不再被误判为本次引入。
  - [x] ② 修复后仅对「本次引入失败」的变更单元回滚；已通过探针不被整仓回滚，或在不支持细粒度时显式记录降级原因与影响范围。
  - [x] ③ 用例覆盖 nest-template 形态（install 失败 + jest `No tests found`）与 picgo 形态（真实 TS 回归 + 已通过探针）；负例证明修复前会被整仓回滚。
  - [x] ④ `preExistingDirty` 保护面不变；整仓回滚保留为逃生开关；回滚语义变更登记风险与审计。
- **不做什么**：不做探针合批（见 backlog「升级探针合批与门禁回滚粒度联动」）；不改默认验证命令链；不改既有失败基线归因；不动 `preExistingDirty` 的用户改动保护。
- **依赖**：M44.1 归档风险 R1（基线前缀覆盖）；2026-10-17 生产实证（nest-template / picgo）；本阶段从 backlog 上收「基线采样首失败即停」候选。
- **交付物（实际）**：6 commits / 29 文件 / 926 插入（+ 本条登记）。拆分：`d76dcea8` 基线完整链（4）；`a0b5adf8` 回滚粒度配置 / CLI（5）；`dd195219` 单元 checkpoint / 选择性回滚 / 降级审计（10）；`e1fb087c` 平台配置贯通 / 分类映射（3）；`532552d7` 设计 / 配置文档（6）；`87f0c0d6` 门禁边界说明（1）。**D 阶段确认**：用户 2026-10-21 选择「单元 checkpoint + 单次重验」（默认 `unit`；`repo` 为逃生）。**超原估**主因：checkpoint 恢复需同步 actions / errors / progress / summary，且需覆盖真实 TS 回归、dirty 跳过、降级审计与平台配置贯通。
- **闭环记录（2026-10-21）**：**审计** R1 `standard` 两分区（A 基线 / B 回滚）：A **Pass**（3 warning / 3 suggest）；B **Reject**（1 blocker：平台 `RuntimeConfig` 未贯通 `rollbackGranularity`，CI rebuild 后平台 tsc 必红且平台静默维持整仓回滚；8 warning / 6 suggest）→ 收口（平台生产 config + env 逃生、executor 夹具、optional 字段 + 引擎缺省 unit、no-checkpoint / later-failed 降级审计、平台分类映射、taxonomy 章节归位、en 配置行、真实 tsc 用例、`preExistingDirty` 禁用选择性、CLI 大小写、repair 重做仅变更时、回调异常兜底）→ R2 `quick` **Pass**（0 blocker；3 新 warning：平台 env 大小写 / allErrors 归因文案 / 陈旧注释；2 suggest：repair 失败 action / CLI 大写用例）→ 逐项收口（trim+lowercase + 非法告警、文案、陈旧注释、repair 失败跳过选择性、`REPO` 用例）。**门禁**：engine **1437 passed / 1 skipped**（81 文件）；platform **2039 passed / 9 skipped**（154 文件）；root `pnpm test` 复跑 exit 0（首轮并行临时失败未复现）；`pnpm run typecheck` 7 包 Done；`pnpm run lint` 0 error（3 条存量 max-lines warning）；engine build exit 0；`check:docs` / `check:doc-size`（warning 0）/ `lint:md` / `lint:i18n` / `check:orphan-ids`（0）/ `check:verify-chain` 通过。**残余**：① 基线完整链最坏 5×10min，仅对「有工作」仓库采样，长 install 失败 + 超时可能挤压单仓预算（未做真实 repo 计时）；② 选择性回滚只尝试最近单元一次，失败并非最近单元 / 后续失败单元 / 无 checkpoint → 显式降级整仓；③ checkpoint 仅已跟踪文件，AI 新建未跟踪文件 / 用户 staged vs unstaged 区分不在回退面；④ Windows / LFS / submodule / shallow clone 未实机；⑤ 平台 env 非法值回退 unit 并 console.warn（不 fail-fast）；⑥ 真实 nest-template / picgo 目标仓库端到端未跑（由 mock 分层 + 真实 tsc 覆盖）。
- **风险与缓解**：**R1 回滚粒度变更影响交付安全** → 设计先行 + 反例测试 + 逃生开关，默认行为变更须在 D 阶段向用户确认；**R2 共享 workDir 限制**（多仓共享目录无法天然按仓回滚）→ 先做「按已通过探针提交 / 失败单元回滚」的可行性探测，做不到则显式降级并保留 repo 级；**R3 基线耗时上升** → 仅对已确定有工作的仓库采样，沿用 M45.2 豁免。

### M46.4 [P1 🛠️] 执行容器内存下限与 OOM 归因（**已闭环** `baed892c` + `dafec407` + `36cecf81` + `cd0f9585` + `530bee03` + 本条登记）
- **目标**：统一控制面与执行面的内存口径，并在启动期 / 运行期留下可观测信号，使 `SIGKILL` 可归因到 OOM 而非超时或代码缺陷。
- **优先级**：P1
- **范围**：
  - `docs/guide/deployment.md:10`（1 CPU / 1GB → 区分控制面最低与执行面 ≥ 8GB）+ `docs/i18n/en-US/guide/deployment.md` + `docs/guide/configuration.md` + 部署 compose（若存在默认资源）。
  - 启动期：`apps/platform/server/plugins/**`（记录 cgroup / 宿主机内存 + 并发，低于建议值 warn，不阻断）。
  - 运行期：`apps/platform/server/entities/scan-run.ts` 新增 `memory_max_bytes` / `peak_rss_bytes` / `oom_killed`（或 `resource_json`）；`services/executor/**` 采集（Linux cgroup，其他平台降级）。
  - 设计口径同步：`docs/design/governance/executor-process-isolation.md` §8.4。
- **验收标准**：
  - [x] ① 部署文档与治理设计口径一致：控制面最低规格与执行面 ≥ 8GB 分列，不再出现「按 1GB 部署即执行安装」的误导。
  - [x] ② 启动日志包含检测到的内存上限与并发；低于建议值时 warn，不阻断启动。
  - [x] ③ 运行记录可查询峰值内存与 OOM 标记；不可采集时明确降级为 `NULL` 并记录原因，不伪造 0。
  - [x] ④ 单测覆盖阈值判定与跨平台降级；文档链接 / i18n / 构建门禁通过。
- **不做什么**：不自动调高容器限制；不做 K8s 资源模板（T705 暂缓，见 [backlog.md](backlog.md)）；不改变 `Repository.sandboxLimits` 默认 2048MB（若 D 阶段裁定调整则单列）；不做实时监控面板。
- **依赖**：2026-10-17 内核 OOM 实证（41 次 `SIGKILL`，`journalctl -k` 实测）；`executor-process-isolation.md` §8.4 建议值；`Repository.sandboxLimits` 既有按仓限额。
- **交付物（实际）**：5 commits / 36 文件 / 1331 插入（+ 本条登记）。拆分：`baed892c` 启动期探测 + cgroup 采集（8）；`dafec407` 落库 + 容器接线 + API（10）；`36cecf81` 三态 / 降级 / 迁移测试（5）；`cd0f9585` 运行详情展示（5）；`530bee03` 资源口径 / OOM 归因文档（8）。**超原估**主因：跨 cgroup v1/v2、启动 / 运行期双面探测、四列迁移 + API + UI 三态、以及 R1 审计后的角色阈值 / catch-all 保真修复。
- **闭环记录（2026-10-21）**：**审计** R1 `standard` 两分区均 **Pass**（A：3 warning / 6 suggest；B：3 warning / 5 suggest，无 blocker）→ 收口：①平台规范 §10.6 补 `resource-probe` 分类；②启动阈值按 `plane=control|execution` 区分（纯 HTTP 1GiB / 执行面 8GiB），并补控制面测试；③文档明示引擎超时也会渲染 SIGKILL、不能反推 OOM；④OOM `null` 且峰值可采时 UI 显示不可采集 + 原因；⑤catch-all 保留已采集快照；⑥API / 迁移 / parse 补 false / partial / 非法 JSON 用例；⑦bigint 精度守门 + 相对链接层级 + env 排版。R2 `quick` **Pass**（0 blocker；2 warning：Redis 同步降级时 HTTP 也执行安装、日志样例缺 `plane` / 阈值文案）→ 文档补同步降级例外、样例补 `plane=execution`、阈值改为「执行面 <8GB / 控制面 <1GB」。**门禁**：platform **2063 passed / 9 skipped**（158 文件）；visual **17 passed**（不更新基线）；platform typecheck Done；`pnpm run lint` 0 error（3 条存量 max-lines warning）；`check:docs` / `check:doc-size`（warning 0）/ `lint:md` / `lint:i18n` / `check:orphan-ids`（0）通过。**残余**：①MySQL / PostgreSQL 迁移未实机（仅 SQLite + TypeORM transformer 推断）；②真实 cgroup v1/v2 + `mem_limit` OOM 未复现（仅注入文件单测）；③宿主级 OOM（未设容器 limit）不保证增加 cgroup `oom_kill`，`sigkillDetected` 与引擎超时同形；④sandbox / github-action 执行器未接入采集（落 NULL + executor 原因）；⑤`executeRun` 抛错时监控快照丢弃，orchestrator 记「before resource snapshot」；⑥同步降级路径的 HTTP 进程无法由启动探测预知，需部署侧按执行面准备；⑦未做 K8s 资源模板 / 实时监控面板（非目标）。
- **风险与缓解**：**R1 跨平台采集差异**（Windows dev 无 cgroup）→ 仅 Linux 采集，其他平台降级并记录；**R2 指标开销** → 采样阈值与只读 cgroup 文件；**R3 文档口径再次漂移** → 以治理设计为权威源，配置指南与 compose 单点引用。

### M46.5 [P2 🚀] 平台通知与邮件推送（issue #190）（**B1-B4 已闭环；B5 延期** `eea2c581` + `104952f6` + `3aa8955f` + `4a65d9e5` + `253ea52b` + `61354f99` + `23cf9f79` + `b3c6cf49` + `19d69f1a` + `fd731c28` + `e0ac9a15` + `13c69da2` + `8210ec60` + 本条登记）
- **目标**：落地 [platform-notification.md](../design/governance/platform-notification.md) 的四类事件（平台自身问题 / 高危告警 / 运行失败 / 完成摘要，外加可选周汇总）、三层配置（部署 / 组织 / 个人）、分流收件人与 24 小时去重；默认只在失败与未修复高危时打扰。
- **优先级**：P2
- **范围**：按设计稿 B1-B5 分批——① 迁移 + 实体字段（`notification_preference` / `notification_log` / `organization.notification_settings_json` / `scan_run` 与 `batch_run` 的 `triggered_by_user_id`）；② 策略层（事件分类、设置解析、个人偏好、收件人路由、高危查询、指纹 / 窗口纯函数）；③ 投递层（统一入口、幂等占位、模板、run / batch 触发点、平台事件接续）；④ 配置与展示（6 个 API + 个人卡片 + `/notifications` 管理员页 + i18n）；⑤ 可选周汇总（固定周期插件，默认关闭）——**本批未纳入，延期 backlog；UI 开关置灰并提示后续版本提供**。
- **验收标准**：
  - [x] ① 默认策略符合设计稿 §13：完成类默认不发、失败类发送、高危仅未修复、平台事件必选；组织关闭后个人无法开启。
  - [x] ② 收件人：平台事件仅管理员；业务事件定向 `triggeredByUserId` + 已开启该类别的管理员；标题含 `[平台]` / `[告警]` / `[运行]` / `[摘要]`（`[周报]` 随 B5）。
  - [x] ③ 降噪：一个批次只发一封高危；相同指纹不再重复发送；指纹变化且距上次超过 24 小时才再次发送；窗口内记 `skipped_cooldown`。
  - [x] ④ 失败语义：SMTP 未配置 noop；发送异常不阻断扫描；投递记录可查；迁移二次执行幂等。
  - [x] ⑤ 测试覆盖策略 / 路由 / 指纹 / 窗口 / 模板转义 / API 权限 / 迁移幂等；批次终态服务测试断言只发一封。
  - [x] ⑥ 截断高危以「另有 N 条截断未纳入明细」披露（读取 M46.2 的 `alertsTruncatedBySeverity`），不少报。
  - [x] ⑦ 部署总开关可熔断全部通知；SMTP 不可用时管理员页 / 个人页提示。
  - [x] ⑧ 组织设置写操作登记 `notification_settings_update` 审计事件；通知记录 / 测试发送仅 admin / org_admin。
  - [x] ⑨（不纳入）周汇总按设计稿 §12 移出至 backlog；本批不宣称 AC⑨ 完成。
- **不做什么**：不实现 Slack / Webhook 真实投递；不做仓库订阅关系；不做一键退订令牌；不做通用摘要调度器（周报为固定周期插件）；不在本期做通知历史独立页面（投递记录并入 `/notifications`）。
- **依赖**：设计稿 [platform-notification.md](../design/governance/platform-notification.md)（2026-10-20 决策已定稿）；现有 `notification/` 渠道注册表与 `mailer/`；M46.1 / M46.2 的未修复高危与截断高危口径；[issue #190](https://github.com/dependfix/dependfix/issues/190)（用户 2026-10-20 明确授权纳入方案 A）。
- **交付物（实际）**：13 commits / 83 文件 / 4119 插入（含导航新增导致的 12 张存量视觉基线同步；B5 未纳入）。拆分：`eea2c581` 承载实体 + 迁移（8）；`104952f6` 设置 / 偏好 / 降噪纯函数（7）；`3aa8955f` 收件人 + 高危查询（5）；`4a65d9e5` 投递幂等 + 业务模板（4）；`253ea52b` 渠道注册 + 平台事件（8）；`61354f99` 单仓 / 批次终态服务（3）；`23cf9f79` 触发者写入 + 单仓终态（8）；`b3c6cf49` 批次写回触发（4）；`19d69f1a` 6 API + 错误码 + 审计类型（10）；`fd731c28` 管理员页 / 个人卡片 / i18n（6）；`e0ac9a15` 通知页视觉基线（8）；`13c69da2` 权限 e2e + 存量基线（8）；`8210ec60` 设计 / env / backlog 文档（2）。**超原估**的主因：B4 同时落 6 API + 两处 UI + 视觉基线；导航新增一项使 12 张存量页面截图整体位移；审计后补部署熔断、唯一冲突重放、sending 回收、失败路径通知、Postgres DDL、审计事件与 API 权限测试。
- **闭环记录（2026-10-21）**：**审计** R1 `standard` 两分区（A 数据/策略/投递/触发 · B API/UI/视觉/文档）：B **Pass**（9 warning）；A **Reject**（1 blocker：`DEPENDFIX_NOTIFICATION_ENABLED` 未接入投递链；7 warning：平台唯一冲突被吞 / sending 无回收 / 失败路径漏通知 / weekly_digest 空开关 / extra 收件人绕过 / Postgres DDL / completed 默认关闭仍写日志）→ 收口（部署熔断入口、唯一冲突 rethrow + 平台键、10 分钟 sending 回收、catch-all / stale-cleanup 通知、周报 UI 置灰、recipients 部署防御、Postgres 类型、completed 开关；业务模板 locale；B 区 test.post 脱敏、组织设置审计、设计 §9、刷新 / 保存 / label / 权限测试）→ R2 `quick` **Pass**（0 blocker；W0 JSON 缩进 / W1 重复分支覆盖 notified / W2 多渠道键 / W4 extra 函数内防御 / W6 管理员页熔断状态 / W7 文档路径与 env 登记 / W8 刷新 loading / W9 实体默认值）→ 逐项收口（含 AuditEvent 事务 + 测试、平台重放 / 部署 / 回收测试）→ 终验。**门禁**：定向 vitest **280 passed**（25 文件：notification services/API/migration + scan/retry/batch/orchestrator/localized-error）；全量 e2e 干净库 **202 passed + 2 flaky**（alerts-rowgroup 排序 / scan-config 记忆，属既有 flake，exit 0）；`test:visual` **17 passed ×2**（含 `/notifications` 基线；导航新增入口导致存量基线整体位移）；`pnpm run lint` 0 error（3 条存量 max-lines warning）；`pnpm run typecheck` 7 包 Done；core / engine / platform build exit 0；`check:docs` / `check:doc-size`（warning 0）/ `lint:md:check` / `lint:i18n` / `check:orphan-ids`（0）通过。**残余**：① B5 周汇总延期 backlog，UI 开关置灰；② 视觉 / e2e 未注入 notification_log，投递记录区只覆盖空表；③ 收件人使用 `To:` 互见，未做 BCC；④ notification_log 无保留期 / 清理策略；⑤ 批次失败邮件缺 failureCode / failureStage / 失败仓库清单；⑥ 仅 SQLite 迁移测试，Postgres / MySQL DDL 分支未实机；⑦ `weeklyDigest` API 仍可写 true（UI 置灰），B5 上线时需清理存量 true / 迁移提示；⑧ catch-all / stale-cleanup 的通知调用无直接断言（仅代码审阅）。
- **风险与缓解**：**R1 邮件风暴** → 批次合并 + 24 小时窗口 + 每小时上限；**R2 漏发关键告警** → 窗口可调至 0 + 周汇总兜底；**R3 收件人扩散** → 仅触发者 + 管理员，上限与去重；**R4 触发点重复** → 条件写回成功 + `deliveryKey` 唯一；**R5 迁移风险** → 幂等迁移 + 启动备份 + 二次执行测试。

### M46.6 [P3 🧪] 视觉套件测试库 fixtures 前置断言（**已闭环** `d2b64886` + `00eacfce` + 本条登记）
- **目标**：本地视觉复跑前校验 `visual.sqlite` 的仓库集合与 fixtures 集合一致，残留非 fixtures 仓库时在像素比对前失败并给出可操作提示，避免把「库污染」误判为代码回归。
- **优先级**：P3
- **范围**：`apps/platform/server/utils/visual-repository-set.ts`（纯集合比较 / 清理编排 / 允许集合防线）+ 单测；`apps/platform/server/utils/visual-repository-client.test.ts`（HTTP 适配器异常分支）；`apps/platform/tests/visual/helpers/visual-db.ts`（Playwright 适配器）；`apps/platform/tests/visual/global-setup.ts`（清理 → 注入 → 断言）；`apps/platform/tests/visual/README.md`（操作约定与已知边界）；`docs/standards/testing.md §6.7`（一行指针）；`apps/platform/server/api/repos/index.ts`（全量返回依赖注释）。
- **验收标准**：
  - [x] ① 残留非 fixtures 仓库时，在截图前失败并列出多余 / 缺失仓库，不进入像素比对。
  - [x] ② 清理通道只允许删除视觉库内、非 fixtures 白名单仓库；幂等且不触碰主库。
  - [x] ③ CI 全新库行为不变；本地污染库按提示清理后复跑通过。
  - [x] ④ 测试覆盖集合比较与清理边界（幂等 / 非白名单拒绝 / 空与非法 allowlist / 适配器异常）。
- **不做什么**：不改视觉阈值与基线；不做全站覆盖；不改 `resetVisualFixtures` 的既有注入语义（仅补前置断言与清理通道）。
- **依赖**：2026-10-19 M45.6 审计探针实测残留 3 条 `parp3-*` 记录（复现：`sqlite3 apps/platform/data/visual.sqlite 'select owner,name from dependfix_repository'`）导致视口级基线失配；M45.5 / M45.6 视觉工程。
- **交付物**：2 commits / 8 文件——`d2b64886` 实现 6 文件（纯集合逻辑 + 2 个测试文件 + Playwright 适配器 + global-setup + repos 端点注释）；`00eacfce` 文档 2 文件（visual README + testing.md 指针）；本条登记 1 文件。
- **风险与缓解**：**R1 误删视觉库数据** → 空 / 非法 allowlist 在删除前拒绝 + 只删 extra + 幂等用例；**R2 误作用主库** → 清理作用于视觉服务进程当前 `DATABASE_PATH`（config 固定 `data/visual.sqlite`），README 明示不得指向主库；**R3 CI 行为变化** → 全新库空集场景纳入测试；**R4 集合真值依赖 `GET /api/repos` 全量返回** → 端点注释 + README 已登记，分页化时须同步调整。
- **闭环记录（2026-10-20）**：**审计** R1 `quick` **Pass**（0 blocker / 2 warning：空 allowlist 可清库、适配器零测试）→ 收口（空 / 非法 allowlist 防线 + 适配器 7 例 fail-fast 测试 + README / testing.md 指针）→ R2 `quick` **Pass**（0 blocker / 0 warning；5 suggest 中 4 项收口，测试文件位置注释 / allowlist 条目校验 / JSON 解析包装 / README 措辞）。**门禁**：`pnpm run lint` 0 error（2 条存量 max-lines warning）；`pnpm run typecheck` 7 包 Done；定向单测 26 passed；`test:visual` 16 passed（日志含 `repository set verified`）；污染实证：向视觉库插入 `parp3/probe` 后重跑自动清理并 16 passed，事后库内仅 3 条 fixtures；`check:docs` / `check:doc-size` / `lint:md:check` OK；改动源文件编号标记扫描 0 命中。
- **残余与观察项**：① 清理不级联 `schedule.repositoryIds`（JSON 引用），视觉库不应创建定时计划；② 集合按 `owner/name` 比较，同 key 不同 platform 属不可达路径；③ 测试文件因 vitest 排除 `tests/visual` 而放在 `server/utils`，文件头已注明原因。

---

## M45: 运行可靠性与交付链收口（已归档 → 2026-10-24 M47 归档批次迁出至 [archive/todo-archive-phases-m45.md](archive/todo-archive-phases-m45.md)）

## M44: 验证链治本 + 文档门禁可信度收口（已归档 → 2026-10-19 M45 归档批次迁出至 [archive/todo-archive-phases-m44.md](archive/todo-archive-phases-m44.md)）

## M43: PR Check 能力补强 + 运行时可靠性与工程治理（已归档 → 2026-10-19 M45 归档批次迁出至 [archive/todo-archive-phases-m43.md](archive/todo-archive-phases-m43.md)）
## M42: 修复交付正确性 + 平台能力与体验补强（已归档 → 2026-10-22 M46 归档批次迁出至 [archive/todo-archive-phases-m42.md](archive/todo-archive-phases-m42.md)）

## M41: 规范与经验管理体系重构（M41.1~M41.5 全部已闭环 / 2026-10-10 归档）

> **归档日期**：2026-10-10
> **阶段摘要**：承接 M40 运行时可靠性与可观测性深化归档后的**治理体系重构**阶段。根因为「**有规则无门禁 → 必 drift**」——规范混入实现与教训、经验体系体量膨胀且无退出路径、阈值声明双事实源、规则与执行分离（关键词检查仅报告、CI 未接线）。设计依据 [standards-experience-refactor.md](../design/governance/standards-experience-refactor.md)（v2 先行稿）；经 2026-10-10 用户决策（方案 B）从 backlog §候选评估整卡上收，A-E 五批对应 M41.1~M41.5。**5 原子条目全部闭环**，覆盖 📚 1 + 🛠️ 1 + 🧪 1 + 🎨 1 + 🛡️ 1（🎨 独立条目 1 项低于类型平衡建议值 2 且无能力扩展独立条目，缺口显式标注）。
>
> - **阶段启动规划**：`1681d0a`
> - **M41.1** [P2 📚 规范治理] 规范去实现化瘦身（A1 `ab55d86` / A2 `9245ebf` / A3a `2362d2f` / A3b `0d69f72` / 闭环 `82c723c`）
> - **M41.2** [P2 🛠️ 经验治理] 经验体系三层收敛与精简（`95b20cf` + 闭环 `a19f9d0`）
> - **M41.3** [P2 🧪 测试基建] 规范 / 经验门禁落地（C1 `062c365` / C2 `3c2cd9c` / 闭环 `30dd819`）
> - **M41.4** [P3 🎨 文档体验] 文档站导航分层（`c748cc8` + 闭环 `7eb888d`）
> - **M41.5** [P3 🛡️ 治理同步] 阈值与事实源唯一化（`f27575b` + 闭环 `181defc`）
>
> **commit 数量实证**：`git log master --first-parent --oneline 1681d0a^..HEAD` 去重统计 = **16 commits**（阶段启动 1 + M41.1 5 + M41.2 2 + M41.3 3 + M41.4 2 + M41.5 2 = 15 属本阶段），另有 **1 commit 属并行 session 的候选登记**（`ee2151d` `ensureGitignore()` 幂等失效候选 → backlog §候选评估中），不计入本阶段原子条目。
> **关键决策**（用户裁定 + 各原子 D 阶段定稿）：① **用户决策方案 B**（先出设计先行稿 → 评审后按 A-E 分批）；② M41.1 剥离方式 = **保留段骨架 + 压缩 + 一行外链**、迁移落点 = **纯文档**（不下沉源码）；因「保留全部标题」与「≤200 行」预算冲突，追加裁定 = **合并无外部引用的叶子标题**为带编号加粗条目（编号文本保留以维持全仓文本引用）；③ M41.2 = **纯精简不重分片**（`## §NN` 标题与编号零变化）、决策记录载体 = 索引文件、L3 = 单索引文件；④ M41.3 阻断强度 = 超强制分片阈值阻断 / warning 仅报告，落点校验 = **独立脚本**，豁免形态 = 脚本内 `{ path, reason }` 显式表；⑤ M41.4 非挂载页卡片 = 改指语义更贴的已挂载页或移除，en 侧栏按**实际译文**裁剪；⑥ M41.5 合并口径 = 以 `documentation.md §3` 行为序（**取值零改动**），归档索引同类阈值段判定同源一并收敛。
> **类型平衡复核**：📚 规范治理 1（M41.1）/ 🛠️ 经验治理 1（M41.2）/ 🧪 测试基建 1（M41.3）/ 🎨 文档体验 1（M41.4）/ 🛡️ 治理同步 1（M41.5）；🎨 独立条目 1 项低于建议值 2 且无能力扩展独立条目，缺口显式标注。
> **关键实证**（细节见各条目闭环记录）：
> - **M41.1**：standards **3225 → 1644 行**（14 文件全部 ≤200，最大 200）；关键词命中 **166 → 0**（`--strict` exit 0）；代码块与 commit hash 清零；A2 将 `§5.1.x` 38 条转为带编号条目以保全全仓约 150 处文本引用；A3 拆分依据 = 变更越 §1.4 的 10 文件线。
> - **M41.2**：经验体系 **2409 → 1017 行**（单分片最大 375 ≤400）；剥离过程叙事保留「结论 + 落点」；**全 68 条落点具体化**（旧条目补 `落点：` 行）；索引重写为「三层体系 + 分片索引 + 六类主题索引（68 条全覆盖）+ 收敛决策记录」。
> - **M41.3**：新增 `check-doc-size.mjs` / `check-experience-landing.mjs`（各含单测，`scripts/` 630 passed）并接入 CI Test job（三步各含负例标定 / 自指面 / 阻断强度三件套）；关键词门禁**精度收敛**（豁免行内代码与链接整体）；**24 处精确锚点回填**；新门禁首跑即命中 2 条真实缺口（经验分片 §四十一 / §四十二 无规范落点标记）。
> - **M41.4**：挂载面收敛为仅 `architecture` + `governance/index`（恰 6 处）与归档目录零挂载；同时收敛 4 类**真实死链**（旧目录名重命名残留 / 调研侧栏 3 项 / en 导航与侧栏 / 首页未挂载页卡片）；产物实证裁剪生效（保留导航项出现于全部 112 页）。
> - **M41.5**：`documentation.md §3` 成为**唯一权威阈值表**（10 类文档，取值逐行一致）；`spec-and-doc-governance §2.3` 与归档索引 §1 收敛为一行引用；`check-doc-size` 实测计量 **74 文档**（健康 60 / warning 13 / 豁免 1 / 超阈值 0）。
> **审计轮次**：A 阶段覆盖全部 5 原子（M41.1 三批次 deep；M41.2 deep **R1 Reject**（落点占位符 + 分片 H1 误删）→ R2 quick Pass；M41.3 deep **R1 Reject**（CI 三件套声明不全）→ **R2 Reject**（锚点前缀贪婪匹配致 2 处误指）→ R3 quick Pass；M41.4 standard R1 Pass → R2 quick Pass；M41.5 standard R1 Pass → R2 quick Pass），记录在 `artifacts/review-gate/`（gitignored）。
> **未完成项 / 已知边界**（均登记 backlog §候选评估中，不随本阶段闭环）：① **链接文本与锚点章节号一致性**缺机检（本次实测命中 2 处）；② `design/packages → modules` 非导航面残留（蒸馏脚本推荐串 / 设计文档现行陈述 / 模块索引 H1）；③ 站点语言切换器对未翻译页指向不存在的 en 页（VitePress 内建映射）；④ 设计文档存量超健康窗口（warning 带 13 + 强制分片线豁免 1）；⑤ `ai-collaboration.md` 跨段重复编号结构（历史遗留）；⑥ `§49-§57` 经验分片文件名与内容范围不符（历史遗留；⑤⑥ 已另行登记 backlog 候选，不含阶段编号）。
> **ahead commits 实证**：归档批次开始前 `git rev-list HEAD ^origin/master --count` 实测 = **21**（`git rev-list origin/master ^HEAD --count` = 0 双向核验），全部为本阶段及此前 M40 归档批次 commits，待用户推送确认。
> **关联**：[roadmap.md §M41](roadmap.md#m41-规范与经验管理体系重构2026-10-10-用户决策方案-b--2026-10-10-已闭环--归档) + [standards-experience-refactor.md](../design/governance/standards-experience-refactor.md) + [backlog.md](backlog.md)（M41 衍生候选）+ [archive/index.md](archive/index.md)
## M40: 运行时可靠性与可观测性深化（已归档 → 2026-10-15 M44.4 批次③ 迁出至 [archive/todo-archive-phases-m39-m40.md](archive/todo-archive-phases-m39-m40.md)）
## M39: 平台视图体验与可观测补强（已归档 → 2026-10-15 M44.4 批次③ 迁出至 [archive/todo-archive-phases-m39-m40.md](archive/todo-archive-phases-m39-m40.md)）
## M38: 平台执行模型隔离（M38.1~M38.6 全部已闭环 / 2026-10-09 归档 → 2026-10-14 M43 归档批次预防性分片迁出）
## M36: 治理债清仓 + 可观测性与测试稳定性（M36.1~M36.10 全部已闭环 / 2026-10-05 归档 → 2026-10-10 M41 归档批次预防性分片迁出）

> 完整段见 [archive/todo-archive-phases-m36.md](archive/todo-archive-phases-m36.md)。
## M35: 批量运行终态兜底对账 + 进度可见性修复（M35.1~M35.6 全部已闭环 / 2026-10-02 归档 → 2026-10-10 M40 归档批次预防性分片迁出）

> 详见 [archive/todo-archive-phases-m35.md](archive/todo-archive-phases-m35.md#m35-批量运行终态兜底对账--进度可见性修复m351m356-全部已闭环--2026-10-02-归档)。

---
## M34: 治理与体验收口 + 组件库升级与巡检基建（M34.1~M34.7 全部已闭环 / 2026-10-01 归档 → 2026-10-10 M39 归档批次预防性分片迁出）

> 详见 [archive/todo-archive-phases-m34.md §M34](archive/todo-archive-phases-m34.md#m34-治理与体验收口--组件库升级与巡检基建m341m347-全部已闭环--2026-10-01-归档)。

---

## M33: 治理债收口 + 测试基建扩展（M33.1~M33.11 全部已闭环 / 2026-09-30 归档 → 2026-10-09 M38 归档批次预防性分片迁出）

> 详见 [archive/todo-archive-phases-m33.md §M33](archive/todo-archive-phases-m33.md#m33-治理债收口--测试基建扩展m331m3311-全部已闭环--2026-09-30-归档)。

---


## M32: 能力扩展优先（M32.1~M32.5 全部已闭环 / 2026-09-30 归档 → 2026-10-08 M37 归档批次预防性分片迁出）

> 详见 [archive/todo-archive-phases-m32.md §M32](archive/todo-archive-phases-m32.md#m32-能力扩展优先m321m325-全部已闭环--2026-09-30-归档)。

---


## M31: apps/platform UI 组件库迁移（PrimeVue → caomei-ui）（已归档 → 2026-10-05 M36 归档批次预防性分片迁出）

> 详见 [archive/todo-archive-phases-m31.md §M31](archive/todo-archive-phases-m31.md#m31-appsplatform-ui-组件库迁移primevue--caomei-ui-m311m316-全部已闭环--2026-09-29-归档)。

---


## M30: 治理债清理 + 迁移可行性验证 + 能力扩展 + 测试补强（已归档 → 2026-10-02 M35 归档批次预防性分片迁出）

> 详见 [archive/todo-archive-phases-m30.md §M30](archive/todo-archive-phases-m30.md#m30-治理债清理--迁移可行性验证--能力扩展--测试补强m301m306-全部已闭环--2026-09-28-归档)。

---


## M29: 修复交付链路正确性 + 能力扩展（已归档 → 2026-10-01 M34 归档批次预防性分片迁出）

> 详见 [archive/todo-archive-phases-m29.md §M29](archive/todo-archive-phases-m29.md#m29-修复交付链路正确性--能力扩展m291m299-全部已闭环--2026-09-27-归档)。

---



## M23: M22 治理债收口 + 根因排查 + 能力扩展 + 测试补强（已归档 → 2026-09-30 M33 归档批次预防性分片迁出）

> 详见 [archive/todo-archive-phases-m23.md §M23](archive/todo-archive-phases-m23.md#m23-m22-治理债收口--根因排查--能力扩展--测试补强m230m231m232m233m234-全部已闭环--2026-09-02-归档)。

---


## M27: 用户体验 + 治理优先（M27.1+M27.2 W1+M27.3 W2+M27.4 W4+M27.5 全部已闭环 / 2026-09-10 归档）

> 本段已迁出至分片：内容、commits 关联表与导航见 [archive/todo-archive-phases-m27.md](archive/todo-archive-phases-m27.md)（主窗口仅保留指针）。

## M26: 平台 AI 研判应用层 + 批量导入 Resource owner 化 + 文档站 i18n + License 收口 + 经验沉淀（M26.1+M26.2+M26.3+M26.4a+M26.4b+M26.4c+M26.5 全部已闭环 / 2026-09-10 归档）

> 本段已迁出至分片：内容、commits 关联表与导航见 [archive/todo-archive-phases-m26.md](archive/todo-archive-phases-m26.md)（主窗口仅保留指针）。

## M22: SQLite 数据保护防御加固（M22.1+M22.2+M22.3+M22.4+M22.5+M22.6 全部已闭环 / 2026-09-01 归档 → 2026-09-28 M30 归档批次预防性分片迁出）

> **2026-09-28 M30 归档批次预防性分片迁出**：M22 段（M22 沉淀 + 6 原子条目，13 commits，commits 已推送 `origin/master`）已从 `todo-archive.md` 主窗口迁至新分片 [archive/todo-archive-phases-m22.md](archive/todo-archive-phases-m22.md)。M30 完整段新增前主窗口 682 行 + M30 段新增将超 700 强制分片阈值，触发预防性分片（与 M26/M28 归档批次同源策略）。

---

## M19: 治理 + 能力扩展 + 测试补强（M19.1+M19.2+M19.3+M19.4+M19.5 全部已闭环 / 2026-08-31 归档 → 2026-09-10 M26 归档批次预防性分片迁出）

> 本段已迁出至分片：内容、commits 关联表与导航见 [archive/todo-archive-phases-m19-m21.md](archive/todo-archive-phases-m19-m21.md)（主窗口仅保留指针）。

## M20: ScanResult 数据模型重构（M20.1+M20.3+M20.5+M20.6+M20.7 全部已闭环 / 2026-08-31 归档 → 2026-09-10 M26 归档批次预防性分片迁出）

> 本段已迁出至分片：内容、commits 关联表与导航见 [archive/todo-archive-phases-m19-m21.md](archive/todo-archive-phases-m19-m21.md)（主窗口仅保留指针）。

## M21: 治理收口 + 能力扩展 + 测试补强（M21.1+M21.2+M21.4+M21.5 全部已闭环 / 2026-08-31 归档 → 2026-09-10 M26 归档批次预防性分片迁出）

> 本段已迁出至分片：内容、commits 关联表与导航见 [archive/todo-archive-phases-m19-m21.md](archive/todo-archive-phases-m19-m21.md)（主窗口仅保留指针）。

## M18: 平台 GitHub App BYO App 模式（已归档 → 2026-09-01 M22 归档批次预防性分片迁出）

> 详见 [archive/todo-archive-phases-m18.md §M18](archive/todo-archive-phases-m18.md#m18-平台-github-app-byo-app-模式m180m181m182m183m184m18x-全部已闭环--2026-08-30-归档)。

---



## M17: 安全与可用性收口（已归档 → 2026-08-31 M20 归档批次预防性分片迁出）

> 详见 [archive/todo-archive-phases-m16-m17.md §M17](archive/todo-archive-phases-m16-m17.md#m17-安全与可用性收口m171m172m173m174m175m176-全部已闭环--2026-08-28-归档)。

---


## M16: 平台可用性深化（已归档 → 2026-08-31 M20 归档批次预防性分片迁出）

> 详见 [archive/todo-archive-phases-m16-m17.md §M16](archive/todo-archive-phases-m16-m17.md#m16-平台可用性深化m161m162m163m164m165-全部已闭环--2026-08-28-归档)。

---


## M13: 治理 + UX 反馈 + 网络治理 + Code Scanning（已归档 → 2026-08-30 M18 归档批次预防性分片迁出）

> 本段已迁出至分片：内容、commits 关联表与导航见 [archive/todo-archive-phases-m13.md](archive/todo-archive-phases-m13.md)（主窗口仅保留指针）。

## M14: platform release 通道闭环 + UX 反馈跟进（已归档 → 2026-08-31 M19 归档批次预防性分片迁出）

> 本段已迁出至分片：内容、commits 关联表与导航见 [archive/todo-archive-phases-m14-m15.md](archive/todo-archive-phases-m14-m15.md)（主窗口仅保留指针）。

## M15: 扫描历史详情侧栏增强（UX-R2）（已归档 → 2026-08-31 M19 归档批次预防性分片迁出）

> 本段已迁出至分片：内容、commits 关联表与导航见 [archive/todo-archive-phases-m14-m15.md](archive/todo-archive-phases-m14-m15.md)（主窗口仅保留指针）。

## M12: 平台 UX 一致性 + i18n 治理（已归档 → 2026-08-28 M17 归档批次预防性分片迁出）

> 本段已迁出至分片：内容、commits 关联表与导航见 [archive/todo-archive-phases-m12.md](archive/todo-archive-phases-m12.md)（主窗口仅保留指针）。

## M8: 安全加固与容器执行完备（已归档 → 迁出至分片）

> 本段已迁出至分片：内容与导航见 [archive/todo-archive-phases-m6-m7-t711.md](archive/todo-archive-phases-m6-m7-t711.md)（主窗口仅保留指针）。

## C53 / M10 / T912 / 2026-08-20 平台 UI 增强（C59-C61）/ 2026-08-20 M11 推进批次（已归档 → 迁出至分片）

> 本段已迁出至分片：内容、commits 关联表与导航见 [archive/todo-archive-phases-m10-c53-c59c61.md](archive/todo-archive-phases-m10-c53-c59c61.md)（主窗口仅保留指针）。

## M24: PR Check MVP + 治理债 + 测试补强 + 用户体验（M24.1+M24.2+M24.3+M24.4+M24.5 全部已闭环 / 2026-09-03 归档）

> 本段已迁出至分片：内容、commits 关联表与导航见 [archive/todo-archive-phases-m24.md](archive/todo-archive-phases-m24.md)（主窗口仅保留指针）。

## M25: PrimeUI License 治理 + 平台 AI 研判集成 + lint baseline 治理 + M24 follow-up 工具化（M25.1+M25.2a+M25.3+M25.4 全部已闭环 / 2026-09-08 归档）

> 本段已迁出至分片：内容、commits 关联表与导航见 [archive/todo-archive-phases-m25.md](archive/todo-archive-phases-m25.md)（主窗口仅保留指针）。
## M28: 治理债清理 + 能力扩展（M28.1-M28.5 全部已闭环 / 2026-09-11 归档）

> 本段已迁出至分片：内容、commits 关联表与导航见 [archive/todo-archive-phases-m28.md](archive/todo-archive-phases-m28.md)（主窗口仅保留指针）。
