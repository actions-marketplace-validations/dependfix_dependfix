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

## 主窗口保留范围
- 主文档保留最近 3-5 个完整段的近线归档块（当前 3 个：**M45** + M42 + M41，按时间倒序排列在顶部；**M44 / M43 于 2026-10-19 M45 归档批次迁出**至 [todo-archive-phases-m44.md](archive/todo-archive-phases-m44.md) / [todo-archive-phases-m43.md](archive/todo-archive-phases-m43.md)；**M40 及更早阶段的完整段已收敛为指针段**，内容与 commits 见各自分片）。
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

## M45: 运行可靠性与交付链收口（2026-10-15 用户决策方案 A / 2026-10-19 归档）

> **归档日期**：2026-10-19
> **阶段摘要**：承接 M44 归档后的「跑得对、跑得省、看得见」阶段，覆盖 6 项交付链可靠性 / 成本 / 可观测缺口；阶段期间插入 **9 批**临时任务（生产故障、CI 双红、安装失败取证、交付正确性等），均按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement)「追加临时待办（不占阶段条目编号）」口径处置。**6 原子条目 + 9 批插队全部闭环**。
> **类型平衡**：🛠️ 3（M45.1 / M45.2 / M45.3）+ 🎨 1（M45.4）+ 🚀 1（M45.6）+ 🧪 1（M45.5）= 6 原子；🎨 独立条目仅 1 项低于建议值 2，缺口已在阶段启动时显式标注。
> **插队容量治理（本阶段触发的新规则）**：累计 9 批插队远超原计划执行预算，且当时只有「不占编号」标记口径、无容量约束 → 用户 2026-10-19 裁定新增 [规划规范 §3.1.1 插队后的阶段容量再平衡](../standards/planning.md#_3-1-1-插队后的阶段容量再平衡-hard-requirement-2026-10-19)（命中阈值时移出低优先级原子到 backlog，不得压缩验证）。规则自下一阶段起生效；M45 已闭环，不追溯移出。
> **阶段期间追加临时待办（9 批，不占条目编号）**：逐批详情（触发 / 根因 / 处置 / 审计 / 门禁 / 交付 commits）见 [archive/index.md §4](archive/index.md) 对应批次记录；清单见本节末表。
> **ahead commits 实证**：归档批次开始前 `git rev-list HEAD ^origin/master --count` 实测 = 0（`git rev-list origin/master ^HEAD --count` = 0 双向核验），M45.6 批次已由用户推送。
>
> **阶段定位**：承接 M44 归档后的「**跑得对、跑得省、看得见**」主线——核心交付链仍有可观测与成本缺口：① 本仓库自用的验证链与引擎默认链长期存在面差（自用链未含 `test`）；② 零告警仓库仍承担一次完整修复前基线采样成本；③ 独立 worker 进程重复启动 HTTP-only 周期插件；④ 运行失败只有「分类 + 筛选 + 展示」，缺受约束的重试入口；⑤ 浮层类组件落点页无像素门禁，视觉面只靠 e2e 行为断言兜底；⑥ PR Check 全量只报警不阻断，缺降噪配置面。经 2026-10-15 用户决策（**方案 A**）从 [backlog.md](backlog.md) §候选评估中上收 6 项候选。
>
> **类型平衡**：🛠️ 3（M45.1 / M45.2 / M45.3）+ 🎨 1（M45.4）+ 🚀 1（M45.6）+ 🧪 1（M45.5）= 6 原子；**🎨 用户体验独立条目仅 1 项，低于 [规划规范 §1.1](../standards/planning.md#11-硬性约束) 类型平衡建议值 2，缺口显式标注**（本阶段以运行可靠性与成本主线优先，候选池内 UX 类可上收项仅「受约束重试入口」与「平台死代码清理」两项，后者规模过小不足以独立成原子）。
>
> **§3.4 三重交叉核验**：**0 项重复评估**——① `todo-archive.md` + `archive/todo-archive-phases-*.md` 全量扫描（关键词 `commands` / 自用链 / `prepareRepoFix` / 基线采样 / `DEPENDFIX_ROLE` / `inProcessWorker` / `retriedFromRunId` / 受约束重试 / 视觉覆盖 / `popover` / 关注集）零命中已闭环项；② `git log` 核验无对应实现 commit（`security-auto-fix.yml` 最近为 `2188b16` 文档口径同步、`packages/engine/src/app/repo-fix.ts` 最近为 `4fee403` 信号保留、`apps/platform/server/plugins/**` 最近为 `0f73645` 注释重指、`apps/platform/tests/visual/**` 最近为 `1d12803` 信号详情用例（无浮层落点页）、`apps/platform/server/entities/pr-check.ts` 无关注集列）；③ 代码 anchor 逐项实测未闭环（`security-auto-fix.yml:90` 回退链为 install / nuxt prepare / lint / build / typecheck 不含 `test`；`repo-fix.ts:140` / `:175` `prepareRepoFix` 单段形态；全仓 `rg "DEPENDFIX_ROLE"` 零命中且 `plugins/stale-cleanup.ts` 无守卫；全仓 `rg "retriedFromRunId"` 零命中；`tests/visual/platform-pages.visual.test.ts` 仅 alerts / repos / pr-checks / dialog-import-repos / login；`pr-check.ts:71-120` 无关注集字段）。
>
> **审计 depth 预告**：M45.1（CI 链 + CLI 契约 + 引擎默认链口径）→ `standard`；M45.2（engine 归因 / 出口码写路径）→ `standard`；M45.3（平台插件注册与 env 面）→ `standard`；M45.4（新增平台端点 + 可能的落库字段）→ `standard`；M45.5（视觉基线 + 文档覆盖矩阵）→ `quick`；M45.6（配置承载 + 可能的 migration + 聚合生效层）→ `standard`（若含数据模型变更建议 2 分区并发）。
>
> **建议顺序**：M45.1（最小、隔离面清晰，先消除自用链漂移）→ M45.3（platform 插件守卫，与其它条目无耦合）→ M45.2（engine 归因，D 阶段先做「被跳过步骤语义清单」）→ M45.4（平台能力，端点 / 落库形态需裁定）→ M45.6（数据模型 + 配置面，面最广）→ **M45.5 放最后**——视觉基线须在 UI 变更（M45.4 / M45.6 均触平台页面）落地后建立，否则基线随批重建（M43.1 / M43.6 排序教训）。**实际执行（2026-10-19 用户裁定）**：M45.5 先于 M45.6 落地，顺序偏离的风险与连带重建口径见 §M45.5 风险 R4 与 [visual/README.md](../../apps/platform/tests/visual/README.md)「顺序约束」段。
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

### M45.2 [P2 🛠️] 零告警仓库修复前基线采样成本（**已闭环** `7d96dcf0` + `d5e58831` + `fee8f4d0` + `fb944b07` + 本条登记）

- **目标**：让零告警仓库不再承担一次完整的修复前基线验证链成本（当前仅跳过 lockfile repair），并在同一批次内证明多仓出口码判定不因此退化。
- **优先级**：P2
- **范围**：`packages/engine/src/app/repo-fix.ts:140`（`prepareRepoFix` 调用点）/`:175`（`prepareRepoFix` 定义——「只读抓取」与「写盘」两段的拆分边界）；`packages/engine/src/app/index.ts:276`（`preExistingDirty` 采样）/`:479` / `:540`（`enforceVerificationGate` 调用点）；`packages/engine/src/app/result-assembly.ts`（`computeExitCode` 归因口径）；定向单测（`app/**` 面）；承载面 [dependency-fixer-records.md](../design/modules/dependency-fixer-records.md) 验证链章节（含「分片索引」指针）。
- **验收标准**：
  - [x] ① **零告警不采样**：`prepareRepoFix` 拆为只读抓取（`fetchRepoFixInputs`：双源抓取 / 过滤 / 优先级 / 限流 / 默认分支）与写盘段（`prepareRepoFixSets`：Code Scanning 模板修复 + 清单分区），取告警前置到基线决策之前；`ensureVerificationBaseline(ctx, repo, { hasWork })` 在「本仓库无工作且运行尚无基线」时不采样。**用例**：`repo-fix-baseline.test.ts` 以替身委托 `runVerification` 计数锁定「零告警仓库整轮仅 1 次验证链（全部来自修复后验证）」与「有告警仓库 2 次（基线 + 修复后）」。
  - [x] ② **出口码不变量**：以 `noChanges` 归因豁免替代采样（复用既有 `FixAction.preExisting` 与 `PRE_EXISTING_FAILURE` 类别 ⇒ 出口码谓词 `SKIPPED_AUDIT_CATEGORIES` / `isRepoVerificationBlocked` / `hasFailures` 零退化）。**用例**：单仓「零告警 + 既有失败」→ `verificationPassed=false` + `verificationBlocking=false` + `computeExitCode === 0`；「健康零告警 + 有告警仓库真实失败」→ exit 1（不退化为 2）；多仓共享 workDir 三仓用例锁定运行级首采复用（第二个有工作仓库不再采样）。
  - [x] ③ **有告警仓库行为不变**：engine 全量 68 文件 / 1314 passed（含门禁集成 21 例、finalize 守卫、exit-code 谓词用例）；有告警仓库仅在「采样点」上由「抓取前」前移到「写盘前」（中间只有只读操作），采样 / 修复 / 验证 / 回滚链路无差异；门禁集成用例 fixture 由零告警改为「有工作」（不可修复告警）以保持「归属型失败必须阻断」的端到端锁定（零告警豁免路径另由 `repo-fix-baseline.test.ts` 覆盖）。承载面口径（验证链章节）已独立成节 [dependency-fixer-records.md §12.9](../design/modules/dependency-fixer-records.md)。
  - [x] ④ **门禁**：`pnpm run lint` exit 0（0 error / **2 存量** `max-lines` warning：alerts.vue / scans.vue——`repo-fix.ts` 越线 warning 已由搬迁消除）；`pnpm run typecheck` exit 0 且 `error TS` 计数 0；`pnpm --filter @dependfix/engine exec vitest run` 68 文件 / 1314 passed / 1 skipped；`pnpm run test:coverage` exit 0（Statements 88.68 / Branches 83.49 / Functions 88.07 / Lines 88.82）；`pnpm run docs:build` exit 0；门禁 `check:docs` / `check:doc-size` / `check:orphan-ids` / `check:standards-redundant:strict` / `check:experience-landing` / `docs:check:i18n` / `i18n:check:anchor` / `lint:md:check` / `check:verify-chain` 全 exit 0；改动源编号标记扫描 0 命中。
- **D 阶段定稿（2026-10-16 用户裁定）**：**D1 = 无改动即豁免**——零告警且运行尚无基线时，其修复后验证失败一律按既有失败处理（`preExisting` 标记 + `PRE_EXISTING_FAILURE` 类别，报告文案注明来源），**不新增类别、不改出口码谓词**；依据：pristine 工作区下「修复后失败」与「若采样的基线同样失败」等价（同命令同工作区）。否决「新增独立类别」（触及出口码 / 门禁非归因谓词面）与「保持全量归因」（单仓「零告警 + 既有失败」将由 exit 0 退化为 2，M43.3 同族回归）。**D2 = 采样点延迟到「首个有工作的仓库」**（先只读抓取再决定是否付成本；运行级「首采一次 + 跨仓库复用」语义不变）；否决「前置全量抓取」（编排层 fetch 与 process 解耦重构，超本条目粒度）。**审计驱动修订**：分区 B 的 blocker 指出候选移除后指针失效 → 模块头 / 承载面指针改指本闭环登记与 §12.9；分区 A 的 W2 指出门禁集成用例②注释与 fixture 不符 → fixture 改为「有工作」以恢复基线命中的端到端锁定。

- **不做什么**：不改 `enforceVerificationGate` 的回滚语义与 `preExistingDirty` 的保护面；不引入「零告警仓库显式处理成功信号」的替代方案（backlog 候选中的备选 ②，本批不涉及）；不改锁文件修复策略链与 `verificationPassed` 的既有消费者口径；不改多仓共享 `workDir` 的首采复用策略。
- **依赖**：M43.3（零告警仓库跳过 lockfile repair + 环境性失败归因；该批次审计 blocker 即「整段跳过致出口码退化」）；[dependency-fixer-records.md](../design/modules/dependency-fixer-records.md) 内 `repo-fix.ts:79` 的注释口径（多仓共享 `workDir` 时沿用首采结果的既有注释口径）；backlog §候选评估中条目「零告警仓库的修复前基线采样成本」。
- **交付物**：预计 2-3 commits——① `refactor(engine)` 拆分 `prepareRepoFix` 两段 + 零告警不采样；② `test(engine)` 出口码不变量与对照用例；③ `docs(design)` 验证链章节口径 + 闭环登记。预计 4-8 文件 / 120-260 行。**实际（回填）**：5 commits / 10 文件——`refactor(engine)` 先拆分（触发条件命中，`repo-fix.ts` 非空行 800 → 771）/ `feat(engine)` 按需采样 + 归因豁免（4 文件）/ `test(engine)` 新增与补强用例（2 文件）/ `docs` 验证链成节 + backlog 处置（2 文件）/ `docs(plan)` 闭环登记（2 文件）；合计 +474 / −93 行。**估算偏差说明**：上浮主要来自 ① 拆分提交（估算未预见该文件的 `max-lines` 触发条件命中，属登记候选的既定处置）与 ② 文档重排为独立小节（§12.9）；语义实现本体 4 文件 / 约 150 行落在估算区间内。
- **风险与缓解**：**R1 被跳过步骤承载其它语义**（M43.3 同族历史 blocker：`verificationPassed` 同时是多仓出口码的成功信号）→ D 阶段先产出「被跳过步骤的语义清单与消费者」，AC ② 以出口码不变量用例锁定；**R2 抓取前置改变进度上报 / 日志顺序**→ 逐调用点核对进度回调并纳入用例；**R3 `preExistingDirty` 首采复用受影响** → 用例覆盖多仓共享 `workDir` 形态。
- **闭环记录（2026-10-16）**：**审计** standard 2 分区并发 —— 分区 A（engine 代码与用例）**R1 Pass**（0 blocker / 2 warning / 2 suggest）→ 收口（W1 mutation 工件未钉住被审修订 → 重录工件并按批次 md5 钉住三源 + 三处用例；W2 门禁集成用例②注释与 fixture 不符 → fixture 改为「有工作」以恢复「基线命中 → PRE_EXISTING_FAILURE」端到端锁定）；分区 B（文档口径与提交史）**R1 Reject**（1 blocker / 3 warning / 5 suggest）→ 收口（RG-B1 候选移除后模块头与承载面指针失效 → 改指本闭环登记与 §12.9；RG-B2 源码注释「一次性采样」旧口径改净；RG-B3 本条闭环 + roadmap 逐项同步；RG-B4 验证链内容独立成节 §12.9 并收敛重复声明；RG-B5 前提措辞改为「本仓库无任何写操作」+ run 级归因局限指针；RG-B6 报告文案标注原文；RG-B7 四条提交正文补关联条目）。**mutation 6/6**（工件 `artifacts/m45.2/mutation.txt`，钉住被审修订 HEAD + 三源代码 md5 + 三处用例 md5，还原后逐字节一致；**首轮第 ④ 条未检出** —— 多仓用例只到第二个仓库，掩盖了运行级复用分支 → 补「第二个有工作仓库不再采样」断言后重做用例提交）。
- **残余与观察项**：① 基线替身与「采样失败」不可区分（`verificationBaseline.value` 仍 undefined 时后续零告警仓库会被豁免；当前由「前序仓库失去基线 ⇒ 后续仓库全量归因」兜住，治本可在持有器加 `attempted` 标志）；② dry-run 分支本批无定向用例（既有 dry-run 用例覆盖编排层，未断言 `exemptAttribution` 路径）；③ 采样点之前的前置仓库会先跑一轮验证链（暖态），对同命令同工作区判定无实质影响，未构造「仅冷态失败」反例实测；④ `concurrency > 1` 交错写盘与豁免组合未实验覆盖（属既有 run 级归因局限）；⑤ 多仓共享 `workDir` 的 run 级局限（无法逐仓库区分）口径未变；⑥ 并行负载下 `apps/platform/docker/entrypoint.test.mjs`「双进程形态」用例曾出现一例 5 秒超时（单独重跑全绿：261 文件 / 4151 passed），属既有用例在重负载下超时余量偏紧，登记观察（非本批引入）。
- **backlog 候选处置留痕**：来源 = §候选评估中「`repo-fix.ts` 触及 `max-lines` 上限的拆分候选（待评估）」（触发条件「再次改动 `repo-fix.ts` 需要新增语句时（先拆分再改）」）；触发命中证据 = 本条实现使该文件非空行 800 → 844（`eslint max-lines` 越线，权威计数口径 `awk 'NF'`）；取舍 = 按候选**首选处置**拆出 step 模块（否决 per-file 例外：例外会掩盖文件膨胀），拆出收尾与基线交接面（`app/repo-fix-finalize.ts`）后回落 771（含本条语义实现；仅搬迁的中间态为 770）；处置 = 候选已移出候选池（处置记录即本条 + 提交历史 `7d96dcf0`）。

### M45.3 [P2 🛠️] 队列 worker 进程按 role 跳过周期插件（**已闭环** `a5d850f` + `2c48094` + `d256056` + 本条登记）

- **目标**：让独立 worker 进程不再重复启动 HTTP-only 周期插件（`stale-cleanup` 孤儿清理与批次对账 / 启动期数据库引导与备份 / 构建信息），消除重复数据库查询与日志噪声；同时保持单进程形态行为不变。
- **优先级**：P2
- **范围**：`apps/platform/docker/entrypoint.sh:108-140`（worker 启动 env：`NUXT_QUEUE_ENABLED` / `NUXT_IN_PROCESS_WORKER` / `DATABASE_MIGRATIONS_RUN` / `NITRO_UNIX_SOCKET`）；`apps/platform/server/plugins/stale-cleanup.ts`（守卫）+ `plugins/database-bootstrap.ts` + `plugins/build-info.ts`（按 HTTP-only 判定逐个评估）；`apps/platform/nuxt.config.ts:113-120`（`inProcessWorker` 与环境解析；新增 `DEPENDFIX_ROLE` 或复用既有开关）；`.env.full.example` + `docs/guide/configuration.md` + [platform.md §10.6](../standards/platform.md#106-队列执行进程隔离独立-worker-进程)（队列执行进程隔离章节）+ 平台定向单测。
- **验收标准**：
  - [x] ① **role 语义**：D1 裁定**新增 `DEPENDFIX_ROLE`**（入口按进程注入 `worker` / `server`）；worker 子进程跳过两个 HTTP-only 插件——`stale-cleanup`（周期清理：孤儿清理 / 批次对账 / `_pending/` 目录删除）与 `build-info`（部署产物版本戳）；HTTP 主进程行为不变。**判定条件**：仅「角色值 = `worker`」跳过（大小写 / 空白容忍）；`server` / 未设置 / 未识别值一律不跳过（未识别值另告警，fail-safe）。**为何不用 `IN_PROCESS_WORKER` 作判据**：实测双进程形态下 worker 子进程与单进程形态都是 `true`（唯一为 `false` 的是 HTTP 主进程，语义恰好相反）。已写入 [platform.md §10.6](../standards/platform.md#106-队列执行进程隔离独立-worker-进程)（含判定口径 / 缺省回退 / 机检落点）。
  - [x] ② **三态可断言**：`server/utils/process-role.test.ts` 断言三态（worker → 跳过 + 一行跳过日志；server / 未设置 → 不跳过且无日志；未识别值 → 不跳过 + 一行 warn）+ 清单与插件源码一致性 + 「插件目录内每个 nitro 插件均已分类」（新增插件未分类即失败，负例探针实测可检出）。插件侧注册守卫用例：worker 角色下 `stale-cleanup` 不注册周期定时器与 close 钩子（`vi.getTimerCount() === 0`）、`build-info` 不打印版本戳；未设置角色下两者照常注册 / 打印。**反例（单进程形态不得跳过）**：`docker/entrypoint.test.mjs` 断言单进程形态（入口归一化为 `server`，等价于未设置）不跳过任何插件。
  - [x] ③ **env 文档完整性**：`DEPENDFIX_ROLE` 已进 `.env.full.example`（容器内条目 + 「由入口注入，请勿手工设置」告警）与 `docs/guide/configuration.md`（+ en-US 镜像成对），并在 `docs/guide/deployment.md`（+ en-US）的进程隔离说明与 [platform.md §10.6](../standards/platform.md#106-队列执行进程隔离独立-worker-进程) 登记；缺省口径 = **未设置与 `server` 行为一致（不跳过任何插件）**；容器单进程形态由入口归一化为 `server`（等价于未设置，见 D1 定稿）。
  - [x] ④ **门禁**：`pnpm run lint` exit 0（0 error / 2 存量 `max-lines` warning）；`pnpm --filter @dependfix/platform typecheck` exit 0 且 `error TS` 计数 0（root `pnpm run typecheck` 七包全 Done，`grep -E "error TS|Done"` 命中六包 Done + platform Done）；定向 vitest 4 文件 / **32 passed**（含 `docker/entrypoint.test.mjs` 11 例）；`pnpm run test:coverage` exit 0（Statements 88.66 / Branches 83.45 / Functions 88.06 / Lines 88.8，新文件 `process-role.ts` 四维 100%）；`check:docs` / `check:doc-size`（健康 86 / warning 0）/ `check:orphan-ids` / `check:standards-redundant:strict` / `check:experience-landing` / `docs:check:i18n` / `i18n:check:anchor` / `lint:md:check` 全 exit 0；`docs:build` exit 0；`dash -n apps/platform/docker/entrypoint.sh` 通过。
- **不做什么**：不改插件的清理 / 对账 / 备份逻辑与幂等语义；不改 `inProcessWorker` 与队列自动降级矩阵（[platform.md §10.4](../standards/platform.md)）语义；不引入进程管理器或新进程角色；不改 entrypoint 的看护循环与信号处置（[platform.md §10.6](../standards/platform.md#106-队列执行进程隔离独立-worker-进程) 严格约束 + 已知边界冻结）。
- **D 阶段定稿（2026-10-16 用户裁定）**：**D1 = 新增 `DEPENDFIX_ROLE`**（入口按进程注入 `worker` / `server`，缺省不设 = 现行为；非 `worker` 值一律不跳过）；否决「复用 `IN_PROCESS_WORKER`」（双进程形态下 worker 子进程与单进程形态都是 `true`，唯一 `false` 的是 HTTP 主进程，语义恰好相反）与「复用 `NITRO_UNIX_SOCKET`」（与监听语义耦合，用户给主进程设置即静默停用清理）。**D2 = `stale-cleanup` 跳过 + `build-info` 跳过 + `database-bootstrap` 保留**（非 HTTP-only：worker 自身依赖数据源引导，迁移唯一执行者已由 `DATABASE_MIGRATIONS_RUN=false` 隔离）。**D3 = 启动期备份双份不改**（受「不做什么」中「不改备份逻辑」约束），仅在 §10.6 已知边界登记。**审计驱动的 D1 细节修订**：审计 R1 的 W3 指出「单进程形态下外部显式 `DEPENDFIX_ROLE=worker` 会静默停用周期清理」违反本条自定的 fail-safe 原则 → 采纳入口归一化（单进程分支 `exec … env DEPENDFIX_ROLE=server`），并把「单进程不注入」措辞同步为「归一化为 `server`（等价于未设置）」；归一化后仍不跳过任何插件，语义不变，仅堵住配置错误的静默失效面。
- **依赖**：M38（平台执行模型隔离，独立 worker 进程形态）；M40.4（entrypoint 看护循环与自动重启）；
- **依赖**：M38（平台执行模型隔离，独立 worker 进程形态）；M40.4（entrypoint 看护循环与自动重启）；2026-10-14 M44 阶段期间 entrypoint 插队热修（信号处置顺序，[platform.md §10.6](../standards/platform.md#106-队列执行进程隔离独立-worker-进程)）；backlog §候选评估中条目「队列 worker 进程按 role 跳过周期插件」。
- **交付物**：预计 2-3 commits——① `feat(platform)` role 判定 + 插件守卫；② `test(platform)` 三态用例；③ `docs` env 文档 + 规范条目 + 闭环登记。预计 5-9 文件 / 80-200 行。**实际（回填）**：4 commits / 17 文件——`feat(platform)` 角色判定工具 + 两插件守卫 + 入口角色注入（4 文件）/ `test(platform)` 三态与守卫用例（4 文件，+222 行）/ `docs` 契约与 env 文档（7 文件，zh/en 成对）/ `docs(plan)` 闭环登记（2 文件）。**估算偏差说明**：文件数与行数上浮主要来自「双语镜像成对」（configuration / deployment 各 2 份）与插件注册守卫用例（含 fake timer 断言）；代码本体 4 文件 / 109 行落在估算区间内。
- **风险与缓解**：**R1 误判致 HTTP 进程跳过关键插件**（迁移 / 启动期备份）→ D 阶段先列「HTTP-only 插件清单 + 每条理由」，AC ② 以反例用例保护；**R2 迁移专用退出语义被破坏**（worker 侧 `DATABASE_MIGRATIONS_RUN=false` 已隔离）→ 不改迁移触发链；**R3 新 env 影响既有容器 / compose 部署** → 缺省值保持现行为 + 文档登记 + entrypoint 冒烟。
- **闭环记录（2026-10-16）**：**审计** standard 2 分区并发 —— 分区 A（角色判定 / 插件守卫 / 容器注入）**R1 Pass**（0 blocker / 3 warning / 5 suggest）→ 收口（W1 修复测试真实缺陷：原入口用例在父进程预置角色导致 worker 侧注入删除后仍通过 → 重构为「父进程未预置」主断言 + 冲突值归一化例 + 单进程两例，并重跑 mutation 工件 7/7 检出；W2 补跑 `test:coverage`；W3 取入口归一化）；分区 B（契约与文档）**R1 Pass**（0 blocker / 2 warning / 4 suggest）→ 收口（设计稿陈旧同源口径同行追加实施结果引用；`platform.md` 201 → 200 行回健康窗口；`.env.full.example` 示例值措辞）；R2 **quick Pass**（修复点逐条 closed + 1 条注释同源残留 warning 已同批修掉）。**mutation 7/7**（工件 `artifacts/m45.3/mutation.txt`，钉住被审修订 HEAD + 改动源 md5，还原后逐字节一致）。
- **残余与观察项**：① 未识别角色值会按插件各打一行 warn（当前 2 行，判定与告警耦合在一个函数内，已由 JSDoc 声明）；② `su-exec`（root 启动）+ 角色注入的实际执行路径无测试覆盖（`entrypoint.test.mjs` 以 `id` 桩固定走非 root 分支，存量盲区）；③ 真实容器双进程（Redis 可用、async）下 HTTP 主进程周期清理的运行时行为未实测，仅由 `queue-mode.ts` 源码推演（`QUEUE_ENABLED=true` → async → `scanQueue` 非空）；④ 本条「已知边界冻结」仅指 §10.6 边界 ⑤⑥（信号相关），边界 ② 改写与 ⑦ 新增属任务本体授权范围；⑤ 「`database-bootstrap` 保留」使 worker 侧启动期备份与主进程各备份一次（双进程形态固有，见 §10.6 边界 ⑦，治本需独立条目）；⑥ 复核发现既有口径待核查：§10.6「直连 `node .output/server/index.mjs` 仍用进程内 worker」与 `nuxt.config.ts` 的 `IN_PROCESS_WORKER` 默认值存在措辞粒度差（直连裸跑需显式置 `true`），属存量面。

### M45.4 [P2 🎨] 运行失败「受约束重试入口」（**已闭环** `741b72c6` + `cdf040c3` + `77fbc02a` + 本条登记）

- **目标**：在既有「失败分类 + 筛选 + 展示」基础上补齐重试入口，让用户对**仅 `transient` 类**失败可一键重跑；以非终态守卫、同仓库去重与审计来源约束滥用。
- **优先级**：P2
- **范围**：设计依据 [run-failure-taxonomy.md §5.5](../design/governance/run-failure-taxonomy.md)（**D1 落地形态 = 新增专用重试端点**：前端只传 runId，参数与来源均由服务端派生并记录；原「复用 scan 端点 + 原参数」设想已被取代）；`apps/platform/server/entities/scan-run.ts:63-79`（`failureCode` / `failureStage` / `failureKind`）；`apps/platform/server/api/runs/**`（端点形态按 D1 裁定）+ `apps/platform/server/api/repos/[id]/scan.post.ts`（既有去重合并路径）；`apps/platform/app/components/run-detail-dialog.vue` / `repo-history-dialog.vue`（入口落点按 D3 裁定）+ `apps/platform/app/utils/run-view.ts`（标签映射）+ i18n 双语；单测 + e2e。
- **验收标准**：
  - [x] ① **受约束可见性**：前端 `canRetry = failureKind === 'transient'` 才呈现入口（详情弹窗失败归因块内）；后端 `POST /api/runs/[id]/retry` 独立三重守卫——来源须已终态（`pending` / `running` → 409 `RUN_RETRY_SOURCE_RUNNING`）、`failureKind !== 'transient'`（含 `deterministic` / `unknown` / 成功态 → 409 `RUN_RETRY_NOT_ALLOWED`）、来源持久化参数不可复用（→ 409 `RUN_RETRY_PARAMS_INVALID`，避免与非 transient 共用文案而误导）。**前端不可见 ≠ 后端可绕过**：直接调用 API 亦被拒绝（端点用例矩阵锁定）。
  - [x] ② **非终态守卫 + 去重不冲突**：重试与 scan 端点共用 `services/scan-trigger.service`（入队 / 同仓库去重合并 / 入队失败降级同步单点），存在进行中任务时按既有 `merged` 语义回应；前端 `use-run-retry` 命中合并时提示 `common.scanTriggerMerged` 且**不当作成功、不回调跳转**（与「立即修复」入口同口径，e2e 锁定「提示合并语义且不提示成功」）。
  - [x] ③ **审计来源**：新列 `scan_run.retried_from_run_id`（D2；实体 + 迁移 `2400000000000-AddScanRunRetriedFromRunId` + 登记 + 幂等与存量库链用例）由服务端写入（前端不可声明）；落库覆盖三条路径（异步入队新建 pending / 同步新建 / 入队失败 failover 续用），且 runId 续用与 reuse 路径**不覆写**历史来源（编排层用例 + mutation 锁定）；详情端点返回 `retriedFromRunId`，弹窗展示来源链（e2e 断言短 id 可见）。
  - [x] ④ **门禁**：`pnpm --filter @dependfix/platform typecheck` exit 0 且 `error TS` 计数 0（root typecheck 同为 0 error）；platform 全量 **136 文件 / 1825 passed / 9 skipped**；**e2e 10 passed**（新增 3：入口出现 + 二次确认（含取消不触发 / 请求体为空 / 成功跳转）/ 入口不出现 + 来源链 / 合并提示；同弹窗回归 alerts-fix-now 4 + alerts-sidebar 3，合计 10）；i18n 三命令全过（AC ④ 原文写 `pnpm run check:i18n`——**该 script 不存在**，实跑等效面 `lint:i18n` + `i18n:audit:missing`（parity none）+ `i18n:check:anchor`，并补 `i18n:audit:duplicates` exit 0）；`check:docs` / `check:doc-size` / `check:orphan-ids` / `check:standards-redundant:strict` / `check:experience-landing` / `docs:check:i18n` / `lint:md:check` / `check:verify-chain` 全 exit 0；`pnpm run lint` exit 0（0 error / 2 存量 `max-lines` warning）。
- **D 阶段决策点**：**D1** 端点形态（新增 `POST /api/runs/[id]/retry` vs 前端复用 `POST /api/repos/[id]/scan` + 原参数）；**D2** 来源字段承载（新增列 + migration vs 复用 `summaryJson`）；**D3** 入口落点（run 详情 dialog vs 列表行内）；**D4** 重试是否需二次确认文案（消耗队列 / 容器资源）。
- **D 阶段定稿（2026-10-16 用户裁定）**：**D1 = 新增专用重试端点** `POST /api/runs/[id]/retry`（前端只传 runId，参数与来源由服务端派生；同时把入队 / 去重合并 / 降级同步抽为共享触发服务）；否决「扩展既有 scan 端点」（需改其 schema 默认值语义）与「前端传原参数 + 声明来源」（来源可信度最弱）。**D2 = 新增专职列 + 迁移**（否决复用 `summaryJson`：与引擎摘要透传混用且不可索引）。**D3 = 入口落运行详情弹窗**（否决列表行内：`scans.vue` 已越行数上限需先拆分）。**D4 = 需要二次确认**（提示将按原参数重新入队、占用扫描队列与容器资源）。**审计驱动修订**：分区 B 的 blocker 指出设计稿同文档状态口径未同步（5 处旧表述与悬空前向指针）→ 全部改净；分区 A 的 W1 指出「来源落库」无测试覆盖（审计独立变异实证 61 用例全绿）→ 补编排层三路径落库用例 + 详情读取断言并纳入 mutation；A 的 S1 指出错误码双语义文案误导 → 拆出 `RUN_RETRY_PARAMS_INVALID`；B 的 W2/B3/B10/B12 与本批新增样式缺失、事件无消费者、无去向、关闭未清理一并收口。
- **不做什么**：不做批量重试；不改 failure taxonomy 的分类规则与落库回填口径；不放开非 `transient` 重试（不做「强制重试」逃生舱）；不引入自动重试 / 定时重试；不改 `/api/runs` 既有列表筛选契约与 runs 导出契约。
- **依赖**：M37（运行失败分类与筛选落地，`failure_code` / `failure_stage` / `failure_kind` 三列 + 三维筛选）；[run-failure-taxonomy.md §5.5](../design/governance/run-failure-taxonomy.md)（2026-10-06 用户决策延后）；M43.4（`merged` 前端感知口径，重试命中合并时复用）；backlog 候选「运行失败『受约束重试入口』」已随本阶段上收（候选已移出候选池，处置见本条目闭环记录）。
- **交付物**：预计 3 commits——① `feat(platform)` 端点 + 守卫 + 来源记录；② `feat(platform)` 前端入口 + i18n 双语；③ `test(platform)` 单测 + e2e + 闭环登记。预计 6-10 文件 / 150-300 行。**实际（回填）**：4 commits / 26 文件（+约 1350 行；实测 `git diff --name-only` 含登记文件）——`feat(platform)` 后端切片 16 文件（端点 / 共享触发服务 / 实体与迁移 / 详情读取 / 错误码与语言包 / 端点与编排层用例）/ `feat(platform)` 前端切片 5 文件（composable / 详情弹窗 / alerts 接线 / 单测 / e2e）/ `docs` 设计稿口径与前后端状态同步（3 文件：设计稿 + 设计索引双语）/ `docs(plan)` 闭环登记（2 文件）。**估算偏差说明**：上浮主要来自 ① 触发路径抽取（新增共享服务，属 D1 的配套重构）与 ② 审计收口轮次（落库用例 / 独立错误码 / 样式与事件接线 / e2e 三组增强）——本体实现约 6 文件 / 300 行落在估算区间内。
- **风险与缓解**：**R1 重试滥用消耗扫描队列与容器资源** → 仅 `transient` + 非终态守卫 + 审计来源（AC ①②③）；**R2 与去重合并语义重叠** → AC ② 复用 M43.4 提示口径；**R3 若引入新列触发 migration 幂等 / 前缀感知** → 按 [platform.md §3.3](../standards/platform.md) 基线自举口径 + e2e 二次运行验证幂等。
- **闭环记录（2026-10-16）**：**审计** standard 2 分区并发 —— 分区 A（后端端点 / 守卫 / 来源落库 / 迁移 / 触发路径抽取）**R1 Pass**（0 blocker / 2 warning / 4 suggest）→ 收口（W1 来源落库无测试覆盖 → 补编排层三路径 + 详情读取用例并纳入 mutation（该变异首轮**未检出**，61 用例全绿，审计独立实证）；W2 diff 规模超阈值 → 四切片提交 + 估算回填；S1 错误码双语义 → 拆 `RUN_RETRY_PARAMS_INVALID`；S2 隐式不变量 → 注释补分类器指针；S3 注释规划标记 → 改描述性文字）；分区 B（前端入口 / i18n / e2e / 文档）**R1 Reject**（1 blocker / 6 warning / 5 suggest）→ 收口（RG-B1 设计稿同文档 5 处旧状态口径 + 悬空前向指针改净；RG-B2 新增块样式缺失与类名笔误 → 补样式并改用既有 meta 类；RG-B3/B10 事件无消费者且成功无去向 → alerts 接线跳转扫描历史打开新运行；RG-B4 取消确认分支未覆盖 → e2e 补；RG-B5 来源链未断言 → e2e 补；RG-B6 请求体为空未断言 → e2e 补；RG-B11 来源链一跳边界登记；RG-B12 关闭弹窗未清理重试三态 → 补）。**mutation 6/6**（工件 `artifacts/m45.4/mutation.txt`，钉住 HEAD + 四源 md5 + 五处用例 md5，还原后逐字节一致；顺序第 4 条变异同时改「异步入队」与「同步新建」两处，故报 3 failed）。
- **R2 复审（quick）Reject → 收口后重做切片**：R2 指出 ①（blocker）设计索引双语状态行仍为「重试入口延后 / deferred」（同源口径三向扫描的 ②③ 面未覆盖）②（warning）本条闭环声明「测试名规划标记已改净」失实——`retry.post.test.ts` 残留 `AC ②` ③（suggest）依赖行仍指已移出候选池的 backlog 条目、交付物计数与实测不一致、mutation 标签口径不精确。收口：设计索引 zh/en 两行改为「已补受约束重试入口」、测试名改描述性文字、依赖行改「候选已随本阶段上收」、计数订正为 26 文件、mutation 标签注明两处同改；随后 `git reset --soft` 重做 C1~C3 切片（保持「后端 / 前端 / 文档」边界）并重命闭环 hash。
- **残余与观察项**：① 前端 `canRetry` 仅按 `failureKind` 判定（弹窗只在失败详情打开；后端三重守卫兜底）——若未来出现「kind=transient 但来源仍非终态」的脏数据，前端会呈现入口而后端拒绝（提示走 `RUN_RETRY_SOURCE_RUNNING`）；② 来源链当前仅展示一跳（不做 A→B→C 链式溯源，已在设计稿 §5.5 已知边界登记）；③ 重试成功去向 = 跳转扫描历史打开新运行（与「立即修复」同口径），未做「原弹窗内切换到新运行」；④ AI 研判 override 不随运行落库，重试按仓库 / 组织默认重新解析（设计稿 §5.5 已登记）；⑤ 真实容器 / Redis 异步形态下的「重试入队 → worker 执行 → 来源链」未做真实设施端到端（e2e 以路由拦截 + 单测覆盖，运行时面由后续运维观察）。

### M45.5 [P3 🧪] 浮层类组件视觉覆盖扩面（**已闭环** `228a75f9` + `33e2f206` + `af60dc71` + 本条登记）

- **目标**：把 caomei-ui 浮层类组件（Drawer / Tabs / Popover / Toast / 选择器类）的落点页纳入像素门禁，消除该类语义变更当前只靠 e2e 行为断言兜底的盲区。
- **优先级**：P3
- **范围**：`apps/platform/tests/visual/platform-pages.visual.test.ts`（用例扩面）+ `__screenshots__/` 基线（新增 / 调整）+ `apps/platform/tests/visual/README.md`（覆盖边界与维护协议）+ [testing.md §6.7](../standards/testing.md)（视觉回归覆盖矩阵）+ [caomei-ui-migration.md §15.15](../design/governance/caomei-ui-migration.md#1515-caomei-ui-060-升级回归实证插队热修2026-10-12)（依据 / 如需）；backlog 条目清出。
- **验收标准**：
  - [x] ① **覆盖落点**（D1 定稿为「AC 最低线 + Drawer + Toast」共 5 张视口级基线）：`schedules` 计划表单弹窗 + 业务类型 Select **门户面板展开态**（light / dark 各一张）、`scans` 运行详情弹窗（`/scans?run=` 深链的 `repo-history-dialog`）、`alerts` 运行抽屉（`alert-run-sidebar` 的 `CaomeiDrawer`）、`pr-checks` Toast（`CaomeiToastProvider`，由「立即检查」在监测未启用时触发的 warning 提示，**不触网 / 不改库**）。模式参照 `dialog-select-layer.visual.test.ts`：门户面板类先断言「面板不是弹窗后代」再截图。**未纳入项**：`Tabs` 切换态（`scans` 按仓库聚合视图）与 `Popover`（全仓无落点页）——前者登记为盲区，后者在 README 显式声明无落点。实测基线：`schedules-form-layer-light.png` / `schedules-form-layer-dark.png` / `scans-run-detail-light.png` / `alerts-run-drawer-light.png` / `pr-checks-toast-light.png`。
  - [x] ② **稳定性**：新基线落地后**不带 update 连跑两遍**通过（16 passed ×2，21.3s / 21.1s；提交后复跑第三次同绿）；未出现运行间非确定性差异，故无需按 `dialog-select-open-dark` 先例加遮蔽或改元素级。**确定性取值前置**（D2 定稿）：`ScanRun` 的 `id` / `createdAt` / `startedAt` / `finishedAt` / `errorJson` 在 fixtures 端点支持显式钉死、由视觉数据集逐项赋值（此前由注入时刻与自动生成主键填充，短 ID 与时间列会逐次漂移）；`schedules` 的 cron 预览是「当前时刻 + cron」派生值，改用 `data-visual-mask` 遮蔽（同 `alerts` 时间列先例）。
  - [x] ③ **预算与文档**：用例数 11 → **16**（+5；另含 `dialog-select-layer` 4 例不变）；单次 no-update 时长 17.6s → **21.3s**（增量 ≈ +3.7s，单用例 0.85~1.2s）；`tests/visual/README.md` 覆盖边界行（4 条新落点 + 确定性取值表 + 已知盲区 + 顺序约束）与 [testing.md §6.7](../standards/testing.md)（新条款「确定性取值锚定」+ 读基线须知覆盖面）同步；取证前 `pnpm --filter @dependfix/platform build` 的前置口径不变（本批 exit 0）。
  - [x] ④ **门禁**：`pnpm --filter @dependfix/platform test:visual` 通过（update 一次 + 不带 update 连跑两遍 + 提交后复跑，共 4 次 16 passed）；`pnpm run lint` 0 error（2 条存量 `max-lines` warning：alerts.vue 842 / scans.vue 860）；`pnpm run typecheck` 7 包全 Done；`pnpm run check:docs` exit 0（links 163 / vue-interp 99 / link-text 163 / link-syntax 195 / emphasis 195 / site-links 3 / archive-anchors 31）；`pnpm run lint:md:check` 通过；另跑 `pnpm --filter @dependfix/platform test`（139 passed | 2 skipped 文件 / 1879 passed | 9 skipped）、`check:doc-size`（计量 88 / 健康 87 / warning 0 / 豁免 1 / 超阈值 0）、`check:orphan-ids`（0 / 721 文件）、`check:standards-redundant:strict` / `check:experience-landing` / `check:verify-chain` / `docs:check:i18n` / `i18n:check:anchor` / `check:readme-i18n` 全 exit 0；改动源文件编号标记扫描新增行 0 命中。
- **D 阶段定稿（2026-10-19 用户裁定）**：**D1 = 覆盖范围「AC 最低线 + Drawer + Toast」**（5 张视口级基线；`Popover` 全仓无落点、`Tabs` 切换态与本批预算不匹配，均显式登记）；**D2 = 确定性取值「扩展 fixtures 钉死」**（否决「用 `data-visual-mask` 遮蔽时间列」与「只取元素级截图绕开时间文本」：前者丢弃时间列这一可检信号、后者与门户面板必须视口级的口径冲突）；**D3 = 顺序偏离获准**——M45.5 原定排在阶段末位以避免 M45.6 的平台 UI 变更使新基线立即失效，用户裁定先做 M45.5，风险按 R4 登记（README「顺序约束」段 + 本条闭环记录）；**D4 = M45.4「受约束重试入口 + 二次确认层」本轮不覆盖**（该层挂在 `alerts` 页 `run-detail-dialog` + `CaomeiConfirmDialog`，非 `scans.vue` 弹窗；覆盖它需要「告警 → `transient` 失败运行」链路，补齐会连带重建 `alerts` 基线，改动面超出视觉扩面条目）→ 登记为 README 已知盲区。**审计驱动修订**：W1 `tests/visual/helpers/fixtures.ts` docblock 曾声明第 4 个失败运行「用于覆盖失败归因块与重试入口」，与 D4 及 README 盲区声明矛盾（该运行实际只作底图首行用途）→ 改为描述性文字；W2 提交拆分调整（`.md` 一律 `docs`：视觉 README 从用例 commit 移入 `docs(standards)` commit，`schedules.vue` 遮蔽属性与 5 张基线保持同 commit 以免中间态回归）；suggest 三项：反例注入点须落在新增浮层内部（已在本条闭环记录逐项注明）、`failureStage` / `failureKind` 改用服务端枚举派生的联合类型、文件计数须声明「PNG 单列为资产」口径。
- **不做什么**：不改视觉门禁阈值与既有权衡（`maxDiffPixels` 等）；不做全站覆盖（按优先级裁剪）；不改 caomei-ui 版本、不新增第三方视觉工具链；不改既有 5 个基线页面（本批**未改动任何既有基线**——fixtures 钉死后既有 11 例不改基线仍全绿，已实测）。
- **依赖**：caomei-ui `0.6.0` 升级回归插队热修（2026-10-12，逐基线量化见 [§15.15](../design/governance/caomei-ui-migration.md#1515-caomei-ui-060-升级回归实证插队热修2026-10-12)）；M32.5（视觉回归最小集既定边界：alerts / repos / pr-checks / dialog-import-repos / login）；M33.4 / M33.5（既有扩面先例）；M45.4（`run-detail-dialog` 的重试入口与二次确认层，本批按 D4 不覆盖）；backlog §候选评估中条目「浮层类组件视觉覆盖扩面」**已随本条上收并移出候选池**。
- **交付物（回填）**：**4 commits / 文本 9 文件（+320 −12 行）+ 5 张 PNG 基线资产**——`228a75f9` `test(platform)` fixtures 端点支持钉死运行主键与时间戳（端点 + 单测 + e2e helper 类型，3 文件）；`33e2f206` `test(platform)` 新增浮层落点页视觉用例与基线（视觉数据集 + 5 用例 + `schedules.vue` 遮蔽属性 + 5 张 PNG，8 文件）；`af60dc71` `docs(standards)` 视觉基线确定性取值锚定口径（`testing.md` §6.7 + review 检查点两行 + 视觉 README，3 文件）；本条 `docs(plan)` 闭环登记（todo + roadmap，2 文件）。**原估算偏差说明**：预估 2 commits / 4-8 文件 / 100-250 行 + 二进制基线 → 实际 4 commits / 文本 9 文件 / +320 行，上浮来自三处原估算未预见的面：① **fixtures 端点能力扩展**（时间戳与主键此前由端点自动填充，钉死它们必须动端点 + 单测 + 类型，并抽取三态语义解析器）；② **落点从 2 类扩到 4 类**（用户 D1 定稿纳入 Drawer 与 Toast）；③ **规范与检查点同步**（新增「确定性取值锚定」条款并挂 review 检查点）。**计数口径**：5 张 PNG 为基线资产，按 [规划规范 §1.1](../standards/planning.md#11-硬性约束) 的文件数阈值口径单列（不计入文本文件数）；[规范与文档治理设计 §2.4](../design/governance/spec-and-doc-governance.md#24-设计文档硬阈值hard-requirement) 硬阈值**不适用**（属「现有模块测试覆盖扩面」，非专项设计 / 治理 / 重大变更 / 新增模块）。
- **风险与缓解**：**R1 基线随浮层动画 / 焦点态非确定性漂移**（`dialog-select-open-dark` 先例：约 28px 运行间差异）→ 等待策略 / mask 覆盖区 / 元素级截图，AC ② 以连跑两遍锁定（本批实测无漂移，无需启用）；**2026-10-16 订正**：M44.1 之后连续 5 次 push 红**不是**该非确定性——实为 i18n 提示语补入 `typecheck` 导致的基线连带失配（确定性，2080 / 2403 px，已随本日追加临时待办重建）；「update 落盘帧非稳定」这一支仍待评估，观察对象与证据已并入 backlog 候选「`dialog-select-open-dark` 视觉基线的运行间非确定性」；**R2 CI 时长与基线数量膨胀** → 按优先级裁剪 + 预算登记（AC ③：+5 例 / +3.7s）；**R3 门户面板差异面大导致基线脆弱** → 元素级 vs 视口级的选定依据写入 README（门户面板挂在 body、不在弹窗子树内 → 只能视口级）；**R4 排序风险**——本条目置于 M45 末位，避免 M45.4 / M45.6 的 UI 变更使新基线立即失效。**R4 实际处置**：经用户裁定先于 M45.6 执行，风险转为「M45.6 若改动 `schedules` / `scans` / `alerts` 的可见结构或文案，须按 [testing.md §6.7](../standards/testing.md)「改动页面即需重建其基线」连带重建并连跑两遍复核」，落 [visual/README.md](../../apps/platform/tests/visual/README.md)「顺序约束」段。
- **闭环记录（2026-10-19）**：**审计**：`quick` 单分区（按 [todo §M45 审计 depth 预告](#m45-运行可靠性与交付链收口-2026-10-15-用户决策方案-a-2026-10-19-归档)）R1 **Pass**（0 blocker / 2 warning / 3 suggest）→ 全部收口后提交（详见 D 阶段定稿的「审计驱动修订」）。**审计方独立复现**：`test:visual` 不带 update 连跑两遍 16 passed ×2；`fixtures.post.test.ts` 9 passed；构建产物 chunk 与工作区源码逐字一致（含新增 `resolveTimestamp` / `id` / `createdAt` / `errorJson` 逻辑）；新基线 PNG 均 1440×900（视口级）；**独立像素解码实证遮蔽生效**（`schedules` 两主题含遮蔽块 6336 px、`alerts` 抽屉 11664 px、`scans` / `toast` 为 0 = 依赖钉死取值而非遮蔽）；对 4 个新画面逐项扫描未发现未钉死的动态来源（`window.lastRunAt` 实测取 `runs[0].createdAt` 而非 `Date.now()`）。**反例标定（testing.md §6.7 反例验证纪律）**：临时 spec 副本注入可见样式改动 → **5/5 如期失败**，像素差分别为 `schedules` light 17627 / dark 17590、`scans` 弹窗 59057（弹窗底色）、`alerts` 抽屉 124588（宽度 560→420）、`pr-checks` Toast 26039；**注入点均落在新增浮层内部**（门户面板底色 / 弹窗底色 / 抽屉宽度 / 提示底色），证明新基线对目标区域敏感而非「页面上有变化」；脚手架（临时 spec + 快照副本）跑完即删，工作区无残留。**证据**：见 AC ④（lint / typecheck / platform 全量 / 文档与 i18n 十项门禁 / 编号标记扫描）。**审计用时实测（宿主时钟）**：R1 发起 `2026-10-19T06:15:36Z` → 返回上界 = 首个 commit 前（≤ 26m，含修复与门禁复跑）；**返回时刻未单独打点**（既有流程缺陷第四次复现，quick 盒 5m 无法据此核验）。**commits 与本条登记见上文标题 + 交付物回填**。
- **残余与观察项**：① **M45.4「受约束重试入口 + 二次确认层」无像素守卫**（`run-detail-dialog` + `CaomeiConfirmDialog`；需「告警 → `transient` 失败运行」链路，补齐会连带重建 `alerts` 基线）→ 已登记 README 已知盲区，待独立需求时评估；② **`Tabs` 切换态未覆盖**（`scans` 按仓库聚合视图）与 `schedules` 列表行未覆盖（视觉库不注入定时计划 fixtures，仅覆盖空态 + 表单浮层）；③ Toast 其余 tone（success / danger）与「自动消失」时序未覆盖；④ `--update-snapshots` 落盘帧非稳定支仍未评估（本批实测 update 与 no-update 帧一致，但该支不闭环，观察对象仍在 backlog 候选）；⑤ `scans` 底图运行列表的时间文本依赖固定 `locale` / `timezoneId`（与既有基线同源风险，非本批引入）；⑥ 第 4 个失败运行目前只作「底图首行」用途，其失败归因块 / 重试层仍无像素守卫（同 ① ）。

### M45.6 [P3 🚀] PR Check 告警关注集（可配置面）（**已闭环** `bf2c8959` + `b751c313` + `30ae9b73` + `62ccaa13` + `57cee745` + 本条登记）

- **目标**：引入仓库级关注集，让「非关注 check（provider lint-only / preview 构建等）失败」不再进入告警面，从而降低噪音；同时保持与「全量只报警不阻断」语义的兼容边界清晰。
- **优先级**：P3
- **范围**：`apps/platform/server/entities/pr-check.ts:71-120`（三源归一化快照 / `overallStatus` / `failureSources` 聚合面）；`apps/platform/server/services/monitor/**`（聚合派生与告警触发点）+ `apps/platform/server/entities/repository.ts`（配置承载，D3 裁定：新增 JSON 列 vs 独立实体）+ 设置页 / 表单 + API + i18n 双语；设计稿 [pr-build-deploy-signals.md](../design/governance/pr-build-deploy-signals.md) 新增章节；单测 + e2e。**实际落点（回填）**：`entities/repository.ts` 加列 + `utils/pr-check-focus.ts` 纯函数（解析 / 规范化 / 匹配 / 过滤）+ `services/monitor/action-status-monitor.ts` 聚合过滤 + `utils/pr-check-view.ts` 逐信号标注 + `api/repos/**` 读写 + `repo-form-dialog.vue` / `pr-checks.vue` + 设计稿 §9。
- **验收标准**：
  - [x] ① **向后兼容**：未配置关注集时行为与现状完全一致（全量只报警不阻断；既有 PR Check 用例全绿）。实现走快照原值与关注面派生两条路径，未配置路径由等价性用例逐字段锁定。
  - [x] ② **过滤口径单一且声明**：关注集匹配在**单一层**（聚合 / 告警层）生效，全量采集与全量落库（`signalsJson` 不裁剪），被过滤信号仍可通过 API / 展开行查看并标注「未关注」——**不含任何静默丢弃**。原括注「按 check 名 / provider / **状态**」按 D4 落地为 **provider / name / kind（信号来源类型）**；`state` 经用户裁定不作匹配维度（读 `state` 过滤会把 `pending` 忽略成假成功），偏差已在设计稿 §9「已知边界」显式对账。
  - [x] ③ **可配置且幂等**：仓库级 `Repository.prCheckFocus`（JSON 列）+ 仓库编辑弹窗 + `PUT /api/repos/[id]`；Zod 校验（维度上限 / 长度 / 枚举 / `.strict()` 拒绝未知维度）、非法条目 400、重复保存幂等、清空即恢复默认（未传不修改 / `null` 或三维全空清空）。
  - [x] ④ **门禁**：`pnpm --filter @dependfix/platform typecheck` 实测 0 error；平台全量 vitest 141 文件 / 1925 passed；定向 e2e 14 passed ×2（第二次跑在既有库上 → migration 幂等 / 前缀感知）；`i18n:audit:missing` parity 0；`check:docs` exit 0。
- **D 阶段定稿（2026-10-19 用户裁定）**：**D1 = 仓库级**（不做全局 / 模板 / 继承）；**D2 = 聚合 / 告警层过滤**（全量采集 + 全量落库 + UI 标注；否决采集层丢弃与展示层过滤）；**D3 = `Repository` JSON 列 + 仓库编辑弹窗**（否决独立实体 / pr-checks 页专用弹窗）；**D4 = 三维白名单**（`providers` / `names` / `kinds`；维度内 OR、维度间 AND、空维度不限、三维全空 = 未配置）。
- **不做什么**：不引入阻断语义（关注集只降噪，不改「只报警不阻断」）；不改 M43.2 三源采集与聚合判据；不做 provider 原生日志富化（另一独立候选）；不做通知 / webhook 集成；不做关注集的模板 / 继承（仅单仓库级）。
- **依赖**：M43.2（D3 裁定「全量只报警不阻断」，本条目为其后续增量）；设计稿 [pr-build-deploy-signals.md](../design/governance/pr-build-deploy-signals.md)；backlog §候选评估中条目「PR Check 告警关注集（可配置面）」。
- **交付物（回填）**：**6 commits / 31 文本文件 + 2 张 PNG 基线资产**（+1508 −77 行量级）——`bf2c8959` `feat(platform)` 数据承载与校验（实体列 + 幂等前缀感知迁移 + 校验 + 纯函数模块，8 文件）；`b751c313` `feat(platform)` 仓库 API 读写（4 文件）；`30ae9b73` `feat(platform)` 聚合 / 告警层过滤 + 视图标注（8 文件）；`62ccaa13` `feat(platform)` 仓库表单配置 + 连带视觉基线（6 文件，含 2 张基线资产）；`57cee745` `docs(design)` 设计章节 + 视觉 README（2 文件）；本条 `docs(plan)` 闭环登记（todo / roadmap / archive-index / backlog / 文档首页，5 文件）。**拆分依据**：按「配置承载层（前 2 commits）/ 生效与展示层（第 3-4 commits）/ 设计章节 / 闭环登记」拆分，各 commit 均 ≤ 8 文件、≤ 800 行；符合本节「含数据模型变更时拆两个可独立提交批次」的既定要求。**估算偏差说明**：预估 8-12 文件 / 200-380 行，实际上浮来自三处原估算未预见的面：① **测试面**（新增纯函数 / 迁移 / 视图容错 / 等价性护栏 / 三维校验用例合计约占新增行多数）；② **配置面 UI**（三维输入 + 多选 + 回显/清空 + e2e）与**连带视觉基线**（仓库编辑弹窗变高，2 张视口级基线重建）；③ **设计章节**（§9 含决策表 / 已知边界 / AC 偏差对账）。
- **风险与缓解**：**R1 过滤层选错致漏报真实失败** → D 阶段先定过滤层与可见性口径（AC ②），并要求「被过滤项仍可审计」；**R2 降噪过度致用户看不到失败** → 默认不配置 = 现状 + UI 明示当前生效口径 + 一键恢复默认；**R3 新增 migration 幂等 / 前缀感知**（平台历史 blocker 同族）→ [platform.md §3.3](../standards/platform.md) 口径 + e2e 二次运行；**R4 与 M45.4 同触平台 UI** → 顺序相邻，M45.5 基线在其后建立。
- **闭环记录（2026-10-19）**：**审计** `standard` **三分区并发** R1 **均 Pass**（P1 数据与校验层 0 blocker / 0 warning / 4 suggest；P2 API 与生效层 0 blocker / 2 warning / 6 suggest；P3 UI / i18n / e2e / 视觉基线 / 设计稿 0 blocker / 5 warning / 3 suggest）→ 全部 warning 与可落地 suggest 收口 → **R2 quick Pass**（修复点逐条 closed，无新增 blocker / warning）。**审计驱动修订**：`kinds` 补 trim 与重复项容忍、`prCheckFocus` 加 `.strict()` 拒绝未知维度（避免「配了但静默不生效」）、`matchesPRCheckFocus` 改防御式读取 + 视图丢弃非对象脏元素（单条脏行不再可能打挂列表）、补「未配置路径逐字段沿用快照值」等价性用例（并实测两个 null 分支 mutant 由存活变击杀）、设计稿补三条已知边界（零命中→终态静默窗口 / 读时 `focused` 与落库聚合的瞬时差 / 不登记 `AuditEvent` 的取择）、两个新迁移文件的章节指针与相对路径修正、`focusKind` 选项改显式 i18n 键并统一术语、新增 PR Check 页「未关注」标注 e2e、AC ② 的「状态」口径显式对账。**审计方独立复验**：三分区各自重跑定向 vitest / typecheck / eslint / 文档与 i18n 门禁；P2 实测「合法数组 + 脏元素」修复前后行为与 mutant 击杀；P3 独立重建后复跑视觉与 e2e、逐像素确认基线差异仅限弹窗区域。**mutation 6/6 击杀**（关闭关注集过滤 / 去 kind 维度 / 视图恒 `focused:true` / API 忽略 `prCheckFocus` / null 路径 `checkRunId` 改派生 / null 路径 `overallStatus` 改派生；均临时改动后还原并核验一致）。**审计用时实测（宿主时钟）**：R1 发起 `2026-10-19T11:48:24Z` → 分区证据落盘 `12:05:15Z` / `12:11:40Z`（≈17m / ≈23m，超出 `standard` ≤10m 时间盒 → 记为分级校准数据：分区内自行执行了构建与实验，实际按 `deep` 用时）；R2 发起 ≈`12:36Z` → 返回 `12:42Z`（≈6m，`quick` 盒略超）。
- **残余与观察项**：① **既有迁移目录的相对路径死链**——同目录 4 个存量迁移文件用 4 级 `../`（应为 5 级），本批新增文件已按正确深度书写；存量属既有约定错误，建议后续单独 `chore` 批量修正；② **条目数上限作用在去重前**——`kinds` 允许重复项交由规范化去重，但 `.max(20)` 在去重前判定（API 客户端传 21 个重复项会 400；UI 多选无法产生重复项）；③ **关注集标注无视觉基线**（「关注集生效」/「未关注」需「仓库已配关注集 + 该行含未命中信号」的组合，会连带重建 `pr-checks` 基线）→ 已由 e2e 可见性用例承担断言，视觉面登记为 [visual/README.md](../../apps/platform/tests/visual/README.md) 已知盲区；④ **视觉测试库残留污染事件**——审计探针在 `apps/platform/data/visual.sqlite` 创建了 3 个非 fixtures 仓库，使 `/repos` 与弹窗基线的背景行数变化（差异集中在表格区，与代码无关）；已按主键清理并复跑视觉两遍通过；已登记 backlog 候选「视觉套件测试库残留非 fixtures 仓库导致基线失配」；⑤ 匹配为大小写不敏感**精确**匹配（无通配 / 子串），check 重命名后需同步改配置；⑥ 配置变更到下一轮 polling 之间，展开行 `focused` 标注与行级聚合存在瞬时不一致（下轮收敛）；⑦ 关注面零命中会被视为终态并进入 30 分钟静默窗口（同 SHA 迟到关注信号最长 30 分钟才检出）；⑧ 关注集变更不登记 `AuditEvent`（取择同 `tags` / `sandboxLimits`；仅 `verifyCommands` 因属执行面留痕）。**阶段状态**：M45 已闭环并归档（2026-10-19 归档批次完成；6 原子 + 9 批插队全部收口）。

### 阶段期间追加临时待办（9 批，不占阶段条目编号）

> 对应关系：10-17「依赖升级探针次数与安装超时口径收敛」与「执行超时真中断与单仓内存口径」两行共用同一条 [archive/index.md §4](archive/index.md) 记录；其余每行各对应一条。

| 日期 | 事项 | 结果概述 |
|:--|:--|:--|
| 2026-10-16 | 批量日志导出范围口径 | 默认导出当前页 + 保留全量入口；分页常量与 schema 上提共用；镜像上限等值断言 |
| 2026-10-16 | 升级失败取证留痕与安装失败证据 | 共享进程信号抽取 + 安装失败证据回退 + 三处失败分支就地留痕 |
| 2026-10-16 | CI 双红收口（视觉基线连带失配 + 自验链代理 env 假红） | 连带重建基线 + 测试侧对宿主 env 免疫 + `quick-verify` 失败留痕 |
| 2026-10-17 | 依赖升级探针次数与安装超时口径收敛 | 安装超时单一事实源（缺省 300s + env 覆盖）+ 版本化 overrides 合批 |
| 2026-10-17 | 执行超时真中断与单仓内存口径 | 受管异步执行 + 进程树终止 + 运行级取消接入编排与验证链 |
| 2026-10-17 | CI 双红收口（周回归审计门禁 + entrypoint 用例竞态） | 依赖审计闭合（升级优先）+ 用例等待 worker 标记 |
| 2026-10-18 | 队列僵尸任务终结与去重键释放 | 队列探针 + 三档归属释放 + 触发自愈 + entrypoint 慢重试 |
| 2026-10-18 | 安装失败取证与执行预算快速失败 | runtime 工具链 + stdout 证据 + 2s 有界落定 + 基线快速失败 |
| 2026-10-18 | 交付正确性（零修复 / override 生效 / 收敛判定 / 基线安装失败） | 零修复与安装既有失败交付守卫 + override 回读 + 分组三分支 |

## M44: 验证链治本 + 文档门禁可信度收口（已归档 → 2026-10-19 M45 归档批次迁出至 [archive/todo-archive-phases-m44.md](archive/todo-archive-phases-m44.md)）

## M43: PR Check 能力补强 + 运行时可靠性与工程治理（已归档 → 2026-10-19 M45 归档批次迁出至 [archive/todo-archive-phases-m43.md](archive/todo-archive-phases-m43.md)）
## M42: 修复交付正确性 + 平台能力与体验补强（M42.1~M42.6 全部已闭环 / 2026-10-11 归档）

> **归档日期**：2026-10-11
> **阶段摘要**：承接 M41 规范与经验管理体系重构归档后的「缺陷修复 + 平台补强」阶段，经 2026-10-10 用户决策（**方案 A+B 混合**）从 backlog §待上收候选 + §候选评估中上收 6 项，砍掉「门禁脚本产物排除」与「hooks 隔离锚点收敛」两项 P3 小项换入平台能力项。贯穿两条线——**修复被 dependfix 管理仓库的实际受害面**（验证阶段镜像源被 deny-by-default 拦死 → install 失败 → 门禁全量回滚；目标仓库 `.gitignore` 幂等判定失效致重复追加；扫描复用路径与同仓库去重合并叠加时误置既有 run 为 failed）与**平台能力/体验补强**（PR Check 手动触发；列表页筛选 / 搜索 / 分页；严重级别展示口径统一）。**6 原子条目全部闭环**，覆盖 🛡️ 2 + 🐛 1 + 🚀 1 + 🎨 2（🧪 独立条目缺口显式标注，测试随条目内嵌）。
>
> - **M42.1** [P2 🛡️] network-audit 出站白名单：预置常见镜像源 + 动态发现生效 registry（治理评审硬前置 + engine 实现 + 单测 + 四文档同步）—— `380e8f4` + `47f7c42` + `39df76d`
> - **M42.2** [P2 🐛] 目标仓库 `.gitignore` 幂等判定归一化（归一化比较 + 与 git 语义逐形态对齐 + 零覆盖函数补测）—— `6a258d8` + `e6f3857`
> - **M42.3** [P2 🛡️] 扫描复用路径与同仓库去重合并叠加时误置既有 run 为 failed 修复（按主体分派 + 响应 merged 字段 + 治理落点细化）—— `cb64ce2` + `677aa4f` + `f1fc102`
> - **M42.4** [P2 🚀] PR Check 手动触发（抽共享 polling + 同步端点 + 单次仓库上限 + 前端入口 + e2e + 视觉基线）—— `85eb0d9` + `4aa1f7b` + `f093e5a`
> - **M42.5** [P2 🎨] 平台列表页表格基础能力补强（repos / batch-runs 客户端筛选 + 搜索 + 分页 + e2e + 视觉基线）—— `6a95800` + `a069c9a` + `1f8a2e2`
> - **M42.6** [P3 🎨] 严重级别展示策略统一（`scanSeverityLabel` 单一事实源 + 六处展示点收敛 + 删冗余导出 + e2e 断言修复）—— `669584d` + `92bf299` + `2b5e6a7`
>
> **commit 数量实证**：`git log master --first-parent --oneline 66f0ee3..HEAD`（自 M42 启动前一并行 session 设计稿起）去重统计 = **18 commits**（阶段启动 1 + M42.1 3 + M42.2 2 + M42.3 3 + M42.4 3 + M42.5 3 + M42.6 3，逐项见上方列表；每个 commit 仅归属一条目，无重复计数）。
>
> **关键决策**（2026-10-10 用户裁定 + 各原子 D 阶段定稿）：
>
> - **D1**：候选组合 = **方案 A+B 混合**（6 原子）；砍掉两项 P3 小项（门禁脚本产物排除 / hooks 隔离锚点收敛）换入平台能力项；§3.4 三重交叉核验 0 项重复评估。
> - **D2**：M42.1 网络边界治理 = **预置常见可信镜像源 + 从配置面动态发现生效 registry**；不做镜像源真实性 / SRI / TLS 钉定（恶意代码执行风险由沙箱承接）；治理评审为**硬前置**（治理决议登记）。
> - **D3**：M42.3 采用「**复用既有 run 记录保持不变、仅回「已合并」提示**」；不引入「同仓库存在进行中任务 → 409 前置拒绝」新方案（另登记候选）。
> - **D4**：M42.4 形态 = **同步端点 + 总开关门控** + 单次仓库上限并披露截断；不做异步入队；HTTP 显式超时接受为已知边界。
> - **D5**：M42.5 = **客户端实现**（服务端契约不变）；不抽共享 composable（两页形态未完全一致，待重复面扩大）。
> - **D6**：M42.6 = **统一到 `scanSeverityLabel` 单源查找**（级别展示由小写直通改为首字母大写，属本条目目标口径）；`settings.vue` 等价实现接受不改。
>
> **类型平衡复核**：🛡️ 2（M42.1 / M42.3）/ 🐛 1（M42.2）/ 🚀 1（M42.4）/ 🎨 2（M42.5 / M42.6）；🧪 独立条目缺口显式标注（测试随各条目内嵌），符合 [规划规范 §1.1](../standards/planning.md#11-硬性约束)。
>
> **关键实证**（细节见各条目闭环记录与相关规范文档）：
>
> - **M42.1**：新增 registry 动态发现（配置面读取 + host 严格校验 + 缓存上限 + fail-open 回退环境变量与预置清单），白名单扩 6 项镜像站域（registry 与其 tarball CDN 域成对）；**真实环境实证**——新白名单下真实 pnpm 元数据请求经审计代理 `exit = 0` + 捕获镜像域 CONNECT + **0 violation**；**同环境反例对照**（修复前旧清单）**2 violation**；非预置域动态发现命中；四处 mutation 全击杀。
> - **M42.2**：归一化比较**与 git 实际判定逐形态对齐**（15 种写法实测 7 IGNORED / 8 NOT-IGNORED 全一致）；审计首轮用判定命令实测否决首版「行中 `#` 当注释」处理（**安全方向回归 blocker**：假命中 → 漏追加 → 报告目录可能随提交入库）。
> - **M42.3**：`reused` 分支按主体分派——复用既有终态 run **不触碰任何字段**、新建孤儿 pending run 维持置 failed 落库；响应新增顶层 `merged` 字段（两类主体同源暴露）。
> - **M42.4**：抽出共享 polling 函数（`triggerPrCheckSchedule` 改薄封装，既有链路逐项不变）；端点 `admin/org_admin` 门控 + 组织范围收敛 + 单次仓库上限并披露截断；e2e 服务端日志证实「点击 → 端点 → 共享函数 → skipped」全链路。
> - **M42.5**：两页客户端筛选 / 搜索 / 分页（服务端契约不变，增量 reconcile 仍作用全量）；**视觉基线连带重建**（repos 整页 + 以 repos 为背景的弹窗视口基线）；e2e 自建数据断言每页条数三档与排序叠加分页。
> - **M42.6**：六处展示点收敛到 `scanSeverityLabel`（逐点复核 0 残留直通）；**排序 e2e 断言根因定位**——组件排序触发器是表头内按钮（表头单元格无点击），原断言实际由默认创建时间倒序满足（弱断言 + 偶发重试通过）。
>
> **审计**：A 阶段覆盖全部 6 原子 —— M42.1（standard 2 分区并发 R1 双 Pass → R2 Pass → R3 Pass）；M42.2（quick **R1 Reject**（行中 `#` 误判为注释）→ R2 Pass → R3 Pass）；M42.3（standard R1 Pass）；M42.4（standard **R1 Reject**（视觉基线未随页头改动重建）→ R2 Pass → R3 Pass）；M42.5（quick R1 Pass → R2 Pass → R3 Pass）；M42.6（standard **R1 Reject**（e2e 断言未随行为变更同步 + 排序断言弱化）→ R2 Pass）。全部收敛后放行，记录在 `artifacts/review-gate/`（gitignored）。
>
> **未完成项 / 已知边界**（登记 backlog §候选评估中，不随本阶段闭环）：① 扫描触发被去重合并时的前端感知（`merged` 字段未被前端消费）；② `useClientTableFilter` 抽取（两页形态未完全一致）；③ `settings.vue` 的等价 severity 查找未收敛；④ PR Check 总开关启用后的真实 polling 待人工验收（登记 backlog §待人工验收，需真实凭据）；⑤ 企业私服自带独立 CDN 域需显式配置镜像白名单；⑥ 门禁脚本未排除 e2e 产物（本阶段多次实测误报，仍待评估）。
>
> **ahead commits 实证**：归档批次开始前 `git rev-list HEAD ^origin/master --count` 实测 = **12**（`git rev-list origin/master ^HEAD --count` = 0 双向核验；M42.1 / M42.2 及其前的阶段启动共 6 commits 已由用户推送，`origin/master` 顶端 = `e6f3857`），本归档 + 蒸馏批次 commits 另计，均待用户推送确认。
>
> **关联**：[roadmap.md §M42](roadmap.md#m42-修复交付正确性--平台能力与体验补强2026-10-10-用户决策方案-ab-混合--2026-10-11-已闭环--归档) + [archive/index.md](archive/index.md) + [sandbox-security-governance.md](../design/governance/sandbox-security-governance.md)（治理决议登记）+ [security.md](../standards/security.md)（§5.3.1 网络外联审计）+ [backlog.md](backlog.md)（M42 衍生候选）


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
