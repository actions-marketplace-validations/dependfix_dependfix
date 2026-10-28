# 路线图阶段详情：M49

> 本分片由 2026-10-29 M49 阶段归档批次从 [roadmap.md](../roadmap.md) 迁出；正文逐字保留，相对链接按新位置重指。
> 对应阶段正文与证据见 [todo-archive-phases-m49.md](todo-archive-phases-m49.md#m49-0-6-0-发版清障-2026-10-25-用户决策-2026-10-29-归档)。

---

## M49: 0.6.0 发版清障（2026-10-25 用户决策 / 2026-10-29 已闭环 + 归档）

2026-10-25 发布评估：0.5.0（2026-09-18）后累计 805 commits（132 feat / 85 fix / 2 类 breaking〔3 commits〕），`release:plan` 推导全包 minor → 目标 **0.6.0**；但存在 4 类「带着发不体面」的问题：2 条自产 code scanning 告警（`js/incomplete-sanitization` / `js/polynomial-redos`）、依赖审计门禁（M49.3 前）仍为信号级（`|| true`）且周回归连续 4 周红、critical / high 依赖漏洞未清零、4 处用户可见文档漂移。本阶段目标 = **清障 → 发布 0.6.0 → 发布后验证**。

**授权与归属**：M49 为用户 2026-10-25 决策的独立阶段（非插队）；M49.1 / 2a / 2b 属 [规划规范 §3.1](../../standards/planning.md#_3-1-新需求默认走-评估-→-backlog-原则-hard-requirement) 例外清单第 1 / 2 类，M49.3 / 4 / 5 属清单外经用户明确授权。**§3.4 交叉核验 0 项重复评估**（todo-archive 扫描 + `git log -- <路径>` + 代码 anchor：2 条 code scanning / `test.yml:46` `|| true` / `audit.ignore` 2 条 / `quick-start.md:189` 过期输入名）。

**6 原子条目**（🛡️ 4 + 📚 1 + 🚀 1；🎨 / 🧪 缺口显式标注：发版窗口不引入 UX 新面，🎨 由 E 阶段承担；测试随条目内嵌）：

- **M49.1** [P0 🛡️] 自产 code-scanning 告警清零
- **M49.2a** [P0 🛡️] 依赖漏洞清零 A：critical / high（直接依赖 / overrides）
- **M49.2b** [P0 🛡️] 依赖漏洞清零 B：platform 链 moderate 收口
- **M49.3** [P0 🛡️] Security 门禁转正（prod 阻断 + 全量信号；周回归转绿）
- **M49.4** [P0 📚] 发版面文档漂移收口
- **M49.5** [P0 🚀] 0.6.0 版本提升、发布与发布后验证

**阶段基线工作量（§3.1.1 分母）**：6 条目区间和 **10-16 commits / 28-41 文件 / 1400-2430 行**（区间和口径；M48 实测倍率提示实际可能上浮 2-4 倍）。

**建议顺序**：M49.1 → M49.2a → M49.2b → M49.4 → M49.3 → M49.5。M49.3 改为**先翻转、后取证**——翻转后连续 3 次 `master` push 的 prod 阻断步骤 `conclusion=success` 且日志含审计结果行，回填为转正证据；回填前不闭环，任一 run 失败则回退 `|| true` 或按 §5.7 评估；M49.5 最后执行。

**阶段期间追加临时待办（不占条目编号，2026-10-27 用户授权）**：sandbox 入口临时关闭 + 平台本地日志通道统一（本地文件可查；Sentry 官方 SaaS / Axiom / 健康检查 / Umami 等其余可观测性条目 1.0 后）；2026-10-28 追加发布与周回归门禁对齐——三批均于阶段内闭环，不占 M49 条目编号、不改变六原子与类型平衡。

**范围边界（不做什么）**：不启用自动发布（1.0 后）；不打 `@v1`（G 批次）；不做 en-US 全量平价（F2）；不为清零强行跨大版本依赖升级。

**安全策略（2026-10-25 用户决策）**：Security Auto Fix 定时任务保持停用（dependfix 自身创建修复 PR，避免冲突）；本仓库改由 **Security 门禁**承担——Dependabot 作发现面、依赖审计作阻断面、code scanning 覆盖代码质量。详见 [release-1.0-readiness.md](../../design/governance/release-1.0-readiness.md#_6-安全策略-2026-10-25-用户决策)。

> **闭环记录（2026-10-29）**：六原子 + 三批追加临时待办全部闭环并归档；0.6.0 已发布（npm 5 包 + 7 个 tag + GitHub Release，Docker platform 镜像随 run `40745976335` 推送）；M49.5 验收 2 项达标 / 2 项待复核 / 1 项未完成；发布后暴露的 CLI `--version` 缺陷已修复待 0.6.1，master 3 连绿窗口与本地发布通道门禁缺口登记 backlog。审计 / 容量校准 / 验收逐项明细见 [todo-archive-phases-m49.md](todo-archive-phases-m49.md#m49-0-6-0-发版清障-2026-10-25-用户决策-2026-10-29-归档)。
> 上一阶段（M48）见 [todo-archive-phases-m48.md](todo-archive-phases-m48.md#m48-对外-pr-交付闭环-2026-10-24-用户决策-d-e-2026-10-25-归档)；M39-M48 阶段详情见 [roadmap-phases-m39-m48.md](roadmap-phases-m39-m48.md)。
