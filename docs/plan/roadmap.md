# 路线图

## Milestone 概述

| 阶段 | 目标 | 优先级 | 状态 |
|------|------|--------|:----:|
| M0: 基线收敛 | Monorepo 骨架 + 配置模型 + 工具链策略 + 告警模型 | P0 | 已完成（[archive/todo-archive-phases-m0-m1.md §M0](archive/todo-archive-phases-m0-m1.md#m0-基线收敛已归档)） |
| M1: MVP 单仓库修复 | 告警拉取→过滤→修复→验证→报告闭环 | P0 | 已完成（[archive/todo-archive-phases-m0-m1.md §M1](archive/todo-archive-phases-m0-m1.md#m1-mvp-单仓库自动修复已归档)） |
| M2: GitHub Action 接入 | workflow_dispatch + 定时 + PR + AI Token + Prompt 防护 | P1 | 已完成（[archive/todo-archive-phases-m2-m55.md §M2](archive/todo-archive-phases-m2-m55.md#m2-github-action-接入已归档)） |
| M3: Code Scanning 扩展 | 规则分级 + 可模板化修复 + 建议输出 | P1 | 已完成（[archive/todo-archive-phases-m2-m55.md §M3](archive/todo-archive-phases-m2-m55.md#m3-code-scanning-扩展已归档)） |
| M4: 多仓库治理增强 | 自动发现 + 并发控制 + 报告归档 | P2 | 已完成（[archive/todo-archive-phases-m2-m55.md §M4](archive/todo-archive-phases-m2-m55.md#m4-多仓库治理增强已归档)） |
| M4.5: 跨线升级显式授权 | `--allow-major-upgrade` 跨线告警显式授权自动升级 | P2 | 已完成（[archive/todo-archive-phases-m2-m55.md §M4.5](archive/todo-archive-phases-m2-m55.md#m45-跨线升级显式授权已归档)） |
| M4.6: Monorepo 成员级修复增强 | workspace 成员包直接依赖告警自动升级（T406 + T407） | P1 | 已完成（[archive/todo-archive-phases-m2-m55.md §M4.6](archive/todo-archive-phases-m2-m55.md#m46-monorepo-成员级修复增强已归档)） |
| M5: AI Breaking Change 研判 | Changelog 采集 + LLM 研判 + 修复生成 + 质量门 + CLI 解耦 | P1 | 已完成（[archive/todo-archive-phases-m2-m55.md §M5](archive/todo-archive-phases-m2-m55.md#m5-ai-breaking-change-研判已归档)） |
| M5.5: Skill 编排（CLI 先行） | 产品 skill 分发 + npx skills 主通道 + MCP 后端扩展 | P2 | 已完成（[archive/todo-archive-phases-m2-m55.md §M5.5](archive/todo-archive-phases-m2-m55.md#m55-skill-编排cli-先行已归档)） |
| M6: 最小平台 MVP | 仓库 + 凭据 + 仪表板 + MCP Server + Docker 部署 | P1 | 已完成（[archive/todo-archive-phases-m6-m7-t711.md §M6](archive/todo-archive-phases-m6-m7-t711.md#m6-最小平台-mvp已归档)） |
| M7: 企业级平台增强 | M7.1 用户体系 + M7.2 平台能力深化 | P2 | 已归档（[archive/todo-archive-phases-m6-m7-t711.md §M7](archive/todo-archive-phases-m6-m7-t711.md)） |
| M8: 安全加固与容器执行完备 | 兑现沙箱安全治理决议 G2-G7 | P0-P2 | 已完成（[archive/todo-archive-phases-m6-m7-t711.md §M8](archive/todo-archive-phases-m6-m7-t711.md#m8-安全加固与容器执行完备已归档)） |
| M9: i18n 基建同步 | 从 momei 同步 i18n 治理规范 + 审计脚本 | P2 | 已完成（[archive/todo-archive-phases-m11.md §M9](archive/todo-archive-phases-m11.md#m9-i18n-基建同步已归档)） |
| M10: 独立沙箱容器 C26 实施规划 | Docker rootless runtime + 应用层白名单代理 + cgroup v2 资源限制 | P1 | 已完成（[archive/todo-archive-phases-m10-c53-c59c61.md §M10](archive/todo-archive-phases-m10-c53-c59c61.md)） |
| M11: 业务可见性 + 沙箱落地 + 安全文档 | C53 闭环触发 + T1005 sandbox 路由 + C28 security.md + C-ENV-CHANGE-ALERT | P1 | 已完成（[archive/todo-archive-phases-m11.md §M11 推进批次](archive/todo-archive-phases-m11.md#m11-推进批次业务可见性--沙箱落地--安全文档--通知基建)） |
| M12: 平台 UX 一致性 + i18n 治理 | 2026-08-21 用户实测反馈 10 项平台 UX/安全/i18n 问题 | P1-P2 | 已完成（[archive/todo-archive-phases-m12.md §M12](archive/todo-archive-phases-m12.md)） |
| M13: 治理 + UX 反馈 + 网络治理 + Code Scanning | 2026-08-25~26 用户实测反馈 + 网络治理 + Code Scanning 规则化 | P0-P2 | 已完成（[archive/todo-archive-phases-m13.md §M13](archive/todo-archive-phases-m13.md)） |
| M14: platform release 通道 + UX 反馈跟进 | apps/platform 第 6 个发布单元 + UX-R1 + neat-freak 治理 | P1 | 已完成（[archive/todo-archive-phases-m14-m15.md §M14](archive/todo-archive-phases-m14-m15.md#m14-platform-release-通道闭环--ux-反馈跟进m14123xy-全部已闭环)） |
| M15: 扫描历史详情侧栏增强（UX-R2） | 承接 M14.2 UX-R1 后的 RunDetailDialog | P1 | 已完成（[archive/todo-archive-phases-m14-m15.md §M15](archive/todo-archive-phases-m14-m15.md#m15-扫描历史详情侧栏增强ux-r2已闭环)） |
| M16: 平台可用性深化 | 把 apps/platform 从 demo 落地为实际可用项目 | P1 | 已完成（[archive/todo-archive-phases-m16-m17.md §M16](archive/todo-archive-phases-m16-m17.md#m16-平台可用性深化m161m162m163m164m165-全部已闭环--2026-08-28-归档)） |
| M17: 安全与可用性收口 | C38 encryptionKey + 服务端 API i18n + admin viewer role check | P1-P3 | 已完成（[archive/todo-archive-phases-m16-m17.md §M17](archive/todo-archive-phases-m16-m17.md#m17-安全与可用性收口m171m172m173m174m175m176-全部已闭环--2026-08-28-归档)） |
| M18: 平台 GitHub App BYO App 模式 | PAT + GitHub App 二者并存 + 5 子阶段 + 治理批次 | P0-P3 | 已完成（[archive/todo-archive-phases-m18.md §M18](archive/todo-archive-phases-m18.md#m18-平台-github-app-byo-app-模式m180m181m182m183m184m18x-全部已闭环--2026-08-30-归档)） |
| M19: 治理 + 能力扩展 + 测试补强 | 按类型平衡原则 5 项任务（技术债 + 能力 + 体验 + 测试） | P2-P3 | 已完成（[archive/todo-archive-phases-m19-m21.md §M19](archive/todo-archive-phases-m19-m21.md#m19-治理--能力扩展--测试补强m191m192m193m194m195-全部已闭环--2026-08-31-归档)） |
| M20: ScanResult 数据模型重构 | per-alert 模型 + reconcile + API 简化 + UI + backfill | P2 | 已完成（[archive/todo-archive-phases-m19-m21.md §M20](archive/todo-archive-phases-m19-m21.md#m20-scanresult-数据模型重构m201m203m205m206m207-全部已闭环--2026-08-31-归档)） |
| M21: 治理收口 + 能力扩展 + 测试补强 | Code Scanning RG-W + M18.x 剩余风险 + B3 PR 自动合并 + T704 e2e | P3 | 已完成（[archive/todo-archive-phases-m19-m21.md §M21](archive/todo-archive-phases-m19-m21.md#m21-治理收口--能力扩展--测试补强m211m212m214m215-全部已闭环--2026-08-31-归档)） |
| M22: SQLite 数据保护防御加固 | 2026-09-01 dependfix.sqlite 数据清空事故 + 6 原子条目 | P0-P1 | 已完成（[archive/todo-archive-phases-m22.md §M22](archive/todo-archive-phases-m22.md#m22-sqlite-数据保护防御加固m221m222m223m224m225m226-全部已闭环--2026-09-01-归档)） |
| M23: M22 治理债收口 + 根因排查 + 能力扩展 + 测试补强 | M22.7+M22.8 根因 + C66 告警视图增强 | P1-P3 | 已完成（[archive/todo-archive-phases-m23.md §M23](archive/todo-archive-phases-m23.md#m23-m22-治理债收口--根因排查--能力扩展--测试补强m230m231m232m233m234-全部已闭环--2026-09-02-归档)） |
| M24: PR Check MVP + 治理债 + 测试补强 + 用户体验 | PR Check 状态监测 MVP + M22.7+M22.8 残留根因 + C36 i18n | P1-P3 | 已完成（[todo-archive.md §M24](todo-archive.md#m24-pr-check-mvp--治理债--测试补强--用户体验m241m242m243m244m245-全部已闭环--2026-09-03-归档)） |
| M25: PrimeUI License 治理 + 平台 AI 研判集成 + lint baseline + M24 follow-up 工具化 | C70 PrimeUI 降级 + C68 AI 研判基础层 + lint baseline + i18n-anchor-check + zod-helpers | P1-P3 | 已完成（[todo-archive.md §M25](todo-archive.md#m25-primeui-license-治理--平台-ai-研判集成--lint-baseline-治理--m24-follow-up-工具化m251m252am253m254-全部已闭环--2026-09-08-归档)） |
| M26: 平台 AI 研判应用层 + 批量导入 Resource owner 化 + 文档站 i18n + License 收口 + 经验沉淀 | C68 P1 应用层 + C67 + C69 P0 + primeicons 降级 + baseline 22 warnings 治理 + e2e 适配 + 经验归档沉淀 | P1-P3 | 已完成（[todo-archive.md §M26](todo-archive.md#m26-平台-ai-研判应用层--批量导入-resource-owner-化--文档站-i18n--license-收口--经验沉淀m261m262m263m264am264bm264cm265-全部已闭环--2026-09-10-归档)） |
| M27: 用户体验 + 治理优先 | M27.1 重复评估修正 + M27.2 W1 apps/platform stylelint + M27.3 W2 logger 补测 + M27.4 W4 container-executor 补测 + M27.5 ECONNRESET 候选 ① 诊断 | P1-P3 | 已完成（[todo-archive.md §M27](todo-archive.md#m27-用户体验--治理优先m271m272-w1m273-w2m274-w4m275-全部已闭环--2026-09-10-归档)） |
| M28: 治理债清理 + 能力扩展 | M28.1 backlog.md §已知边界段批量治理 + §4.4 第 11 条规则强化 + M28.2 C14 多 cs lint 性能 + M28.3 C15 B 类规则样本核对 + M28.4 C33 MCP P3 + M28.5 M22.8 follow-up ② | P2-P3 | 已完成（[todo-archive.md §M28](todo-archive.md)；2026-09-11 用户决策方案 M28-A + M28.1 重编号 + 完整 5 候选闭环 + M28.6 归档批次落地，commits 已推送 origin/master） |
| M29: 修复交付链路正确性 + 能力扩展 | C73 git 配置污染隔离 + C75 验证链纳入 test + C77 override 复发防护 + C78 alerts 未启用/获取失败区分 + C71 pnpm 路径级 overrides + C72 批量导入 archived/disabled 过滤 + vite 漏洞插队 hotfix + C79 devEx 配置缺口 + C80-A CI 审计覆盖（M29.8/M29.9 为 M29.1 衍生） | P2-P3 | 已完成（已归档，2026-10-01 M34 归档批次预防性分片迁出至 [archive/todo-archive-phases-m29.md §M29](archive/todo-archive-phases-m29.md#m29-修复交付链路正确性--能力扩展m291m299-全部已闭环--2026-09-27-归档)） |
| M30: 治理债清理 + 迁移可行性验证 + 能力扩展 + 测试补强 | C87 跳过类审计退出码 + C86 max-lines 拆分 + C84 文档对齐 + C74 getCommitAuthor 接线（App 路径）+ db-restore 补测 + UI 组件库迁移可行性验证 V1-V3 | P2-P3 | 已完成（[archive/todo-archive-phases-m30.md §M30](archive/todo-archive-phases-m30.md#m30-治理债清理--迁移可行性验证--能力扩展--测试补强m301m306-全部已闭环--2026-09-28-归档)） |
| M31: apps/platform UI 组件库迁移（PrimeVue → caomei-ui） | B0 基线与双库并存接线 + B1a/B1b DataTable 迁移 + B2 表单/浮层切换 + B3 收尾卸载与回归 + C90 db-restore 补强 | P2-P3 | 已完成（[todo-archive.md §M31](archive/todo-archive-phases-m31.md#m31-appsplatform-ui-组件库迁移primevue--caomei-ui-m311m316-全部已闭环--2026-09-29-归档)） |
| M32: 能力扩展优先 | C76 平台验证命令配置 + C85 目标仓库专属配置 + C89 Code Scanning 未启用区分 + C82 git 签名语义边界 + C92 视觉回归最小集 | P3 | 已完成（[todo-archive.md §M32](archive/todo-archive-phases-m32.md#m32-能力扩展优先m321m325-全部已闭环--2026-09-30-归档)） |
| M33: 治理债收口 + 测试基建扩展 | C91 review 检查点补挂 + 视觉回归 CI 转阻断 + M31 dependabot 死配置清理 + C93/C94 视觉回归覆盖扩展 + C80 观察期阻断语义 + M33.7 迁移入口 + M33.8–M33.10 UI 修复 + M33.11 存量漏洞治理 | P3 | 已完成（[archive/todo-archive-phases-m33.md §M33](archive/todo-archive-phases-m33.md#m33-治理债收口--测试基建扩展m331m3311-全部已闭环--2026-09-30-归档)；2026-09-30 归档） |
| M34: 治理与体验收口 + 组件库升级与巡检基建 | devEx `data/` 产物污染治理 + caomei-ui 0.5.0 升级（弹窗 Select 裁剪/层级） + 视觉回归灵敏度与弹窗覆盖 + 上游组件问题归因流程 + label 间距统一 + 字段堆叠口径复用化 + PrimeUI 文档同步 + C83 验证链失败基线 | P2-P3 | 已完成（[todo-archive-phases-m34.md §M34](archive/todo-archive-phases-m34.md#m34-治理与体验收口--组件库升级与巡检基建m341m347-全部已闭环--2026-10-01-归档)；2026-10-01 归档） |
| M35: 批量运行终态兜底对账 + 进度可见性修复 | 周期兜底对账服务 + 写回逻辑收敛 + `finishedAt` 真实化 + sync 立即终结 + 前端口径修正 + 存量订正脚本 + 设计口径同步 | P2-P3 | 已完成（[todo-archive-phases-m35.md §M35](archive/todo-archive-phases-m35.md#m35-批量运行终态兜底对账--进度可见性修复m351m356-全部已闭环--2026-10-02-归档)；2026-10-02 归档） |
| M36: 治理债清仓 + 可观测性与测试稳定性 | C81 孤立规划编号存量清理（分批）+ 文档陈旧状态清理 + BatchRun 写回竞态收敛 + 告警源可审计性判据 + api-i18n e2e 顺序偶发 + dependfix-platform 镜像体积治理 + pnpm overrides key 语义归一化 + Docker 首次启动数据库初始化与部署文档 + 扫描队列孤儿 job 释放 + 队列消费者维度自动降级 | P1-P3 | 已完成（[todo-archive.md §M36](archive/todo-archive-phases-m36.md#m36-治理债清仓--可观测性与测试稳定性m361m3610-全部已闭环--2026-10-05-归档)；2026-10-05 归档） |
| M37: 运行可观测性与体验记忆 | 运行失败分类与筛选 + 落库回填（failureStage / failureKind，不含重试入口）+ 扫描 / 批量扫描偏好记忆（方案 C 混合）+ BatchRun 写回与告警源错误信号残余治理 + caomei-ui 版本口径同步 + 孤立编号检测脚本接入 CI 门禁 + 目标仓库 git hooks 隔离 | P1-P3 | 已完成（2026-10-06 用户决策方案 B + 同日授权追加 M37.6；2026-10-08 已闭环归档，见 [todo-archive.md §M37](archive/todo-archive-phases-m37.md#m37-运行可观测性与体验记忆m371m376-全部已闭环--2026-10-08-归档)） |
| M38: 平台执行模型隔离 | 队列执行进程隔离（方案 ①′ 独立 worker 进程，治本）+ Worker 锁参数显式化与锁问题事件观测（止血）+ `scan.post` failover 透传 reuse + e2e 全页卡片计数断言解耦 + `scan-queue.ts` 注释 jobId 口径订正 + schedule 表单复用 scan-options 口径 | P1-P3 | 已完成（2026-10-06 用户授权 / 2026-10-09 已闭环归档，见 [todo-archive.md §M38](archive/todo-archive-phases-m38.md#m38-平台执行模型隔离m381m386-全部已闭环--2026-10-09-归档)） |
| M39: 平台视图体验与可观测补强 | 扫描页筛选与分页优化 + 扫描历史弹窗体验 + 告警视图「按包」聚合跨 severity 重复分组修正 + 运行日志下载与批量下载 + PR Check 监测启用链路打通 + 环境事件覆盖扩展 | P2-P3 | 已完成（2026-10-09 用户决策方案 A / 2026-10-10 已闭环归档，见 [todo-archive.md §M39](./archive/todo-archive-phases-m39-m40.md#m39-平台视图体验与可观测补强m391m396-全部已闭环--2026-10-10-归档)） |
| M40: 运行时可靠性与可观测性深化 | 部署产物版本戳陈旧校验 + 失败 run 落 summary 快照 + 执行超时可配置化 + 队列 worker 崩溃自动重启 + sandbox 降级回退路径落执行日志 + 平台环境变量文档完整性治理 | P2 | 已完成（2026-10-10 用户决策方案 A / D2 以环境变量文档治理替换 M40.6；2026-10-10 已闭环归档，见 [todo-archive.md §M40](./archive/todo-archive-phases-m39-m40.md#m40-运行时可靠性与可观测性深化m401m406-全部已闭环--2026-10-10-归档)） |
| M41: 规范与经验管理体系重构 | standards 去实现化瘦身 + 经验体系三层收敛与精简 + 规范/经验门禁落地（CI 阻断）+ 文档站导航分层 + 阈值与事实源唯一化 | P2-P3 | 已完成（2026-10-10 用户决策方案 B / 2026-10-10 已闭环归档，见 [todo-archive.md §M41](todo-archive.md#m41-规范与经验管理体系重构m411m415-全部已闭环--2026-10-10-归档)） |
| M42: 修复交付正确性 + 平台能力与体验补强 | network-audit 出站白名单镜像源扩充与动态发现 + `.gitignore` 幂等判定归一化 + 扫描复用路径误置既有 run 为 failed 修复 + PR Check 手动触发 + 平台列表页表格基础能力补强 + 严重级别展示策略统一 | P2-P3 | 已完成（2026-10-10 用户决策方案 A+B 混合 / 2026-10-11 已闭环归档，见 [todo-archive.md §M42](todo-archive.md#m42-修复交付正确性--平台能力与体验补强m421m426-全部已闭环--2026-10-11-归档)） |
| M43: PR Check 能力补强 + 运行时可靠性与工程治理 | PR Check 列表仓库标识 + PR 构建/部署错误多源采集（GitHub 三源聚合）+ 容器内 `pnpm install` 环境性失败可观测性与归因口径 + 扫描触发去重合并前端感知 + git 非仓库 / push 钩子边界收口 + 工程脚本加固（门禁产物排除 + 蒸馏计数假阴性） | P2-P3 | 已完成（2026-10-12 用户决策方案 A / 2026-10-14 已闭环归档，见 [todo-archive.md §M43](todo-archive.md#m43-pr-check-能力补强--运行时可靠性与工程治理2026-10-12-用户决策方案-a--2026-10-14-归档)） |
| M44: 验证链治本 + 文档门禁可信度收口 | 验证命令链纳入 `typecheck`（治本）+ 文档门禁机检缺口收敛（四类静默缺陷）+ 文档口径与命名一致性收口 + 设计文档存量超健康窗口分批拆分 + 站点语言切换器未翻译页 404 兜底 + `tech-stack` 平台依赖表行级一致性 | P2-P3 | 已完成（2026-10-14 用户决策方案 A / 2026-10-15 已闭环归档，见 [todo-archive.md §M44](todo-archive.md#m44-验证链治本--文档门禁可信度收口m441m446-全部已闭环--2026-10-15-归档)） |
| M45: 运行可靠性与交付链收口 | 自用验证链面差收口 + 零告警仓库修复前基线采样成本 + 队列 worker 按 role 跳过周期插件 + 运行失败受约束重试入口 + 浮层类组件视觉覆盖扩面 + PR Check 告警关注集 | P2-P3 | **进行中**（2026-10-15 用户决策方案 A，见 [todo.md §M45](todo.md#m45-运行可靠性与交付链收口-2026-10-15-用户决策方案-a)） |

> **本路线图定位**：按 [规划规范 §2.1](../standards/planning.md) 仅维护阶段概览（目标 / 优先级 / 状态）。详细实施记录 / commit 引用 / 关键决策 / 经验教训见对应归档段（详见下方"## 详细任务"索引）。

> **M0 - M38 阶段详情已迁出**：见 [archive/roadmap-phases-m0-m38.md](archive/roadmap-phases-m0-m38.md)（2026-10-15 M44.4 批次③ 迁出；主文档保留概述表与最近阶段）。

## M39: 平台视图体验与可观测补强（2026-10-09 用户决策方案 A / 2026-10-10 已闭环 + 归档）

承接 M38 平台执行模型隔离归档后的平台视图体验与可观测阶段。2026-10-08 定时扫描批量失败的排查过程中，用户在同一批反馈 8 项平台问题，经 2026-10-09 用户决策（方案 A）归并为 6 原子进入本阶段；同批排查另有「既有基线失败被误判为运行失败」的引擎口径缺陷 1 项，已按 [§3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 可用性插队例外先行修复（`e5c59b8`，口径见 [dependency-fixer.md §12.9](../design/modules/dependency-fixer-records.md)），不计入本阶段；其衍生的 3 项运行时可靠性候选（部署产物版本戳陈旧校验 / 失败 run 落 summary 快照 / 执行超时可配置化）留 [backlog.md](backlog.md) 待评估。

**6 原子条目**（覆盖 🎨 3 + 🚀 2 + 🛡️ 1，接近 [规划规范 §1.1 L12 类型平衡建议](../standards/planning.md#11-硬性约束)；🧪 无独立条目，缺口已显式标注）：

- **M39.1** [P2 🎨 用户体验] 扫描页筛选与分页优化（byRepo 聚合表状态筛选 + 分页 / 分区 + `scan-history/summary` 端点参数）
- **M39.2** [P3 🎨 用户体验] 扫描历史弹窗体验（移除冗余 body 关闭按钮 + 日志区自适应高度）
- **M39.3** [P2 🎨 用户体验] 告警视图「按包」聚合跨 severity 重复分组修正（含视觉 / e2e 基线与三处文档口径）
- **M39.4** [P2 🚀 能力扩展] 运行日志下载与批量下载（单 run 导出 + 按筛选批量导出）
- **M39.5** [P2 🚀 能力扩展] PR Check 监测启用链路打通（`kind` 落库 + 表单 + 总开关入口 + env 文档）
- **M39.6** [P3 🛡️ 可观测与治理] 环境事件覆盖扩展（container 执行器事件源 + 死类型处置 + 类型口径统一）

**类型平衡复核**：🎨 用户体验 3（M39.1 / M39.2 / M39.3）+ 🚀 能力扩展 2（M39.4 / M39.5）+ 🛡️ 可观测与治理 1（M39.6）；🧪 测试无独立条目（随 M39.3 视觉 / e2e 基线重建与各条目内嵌），显式标注缺口。

**建议顺序**：M39.3（先定聚合判据，测试 / 文档面最广）→ M39.1（UX 核心 + 后端参数）→ M39.2（最小体验）→ M39.5（能力打通）→ M39.4（能力扩展）→ M39.6（可观测）。

**范围边界（不做什么）**：不改引擎修复 / 验证业务语义；不改 `/api/runs` 既有契约与 runs 列表三筛选语义；不引入新组件库 / 对象存储 / 外部告警系统；不实现 GitHub App 的 pr-check 路径（当前仅 PAT）；不改 sandbox 执行器行为。

**§3.4 交叉核验**：6 项候选经 todo-archive 表格扫描 + git log + 代码 anchor 三重核验，**0 项重复评估**（逐项证据见 [todo-archive.md §M39](./archive/todo-archive-phases-m39-m40.md#m39-平台视图体验与可观测补强m391m396-全部已闭环--2026-10-10-归档) 阶段摘要）。

**commits 状态**：阶段启动前的 `e5c59b8`（运行时口径修复）+ `da148f8`（候选登记）已随 `origin/master` 推送（实证：双向核验均为 0）；本阶段全部 commits 归档时为本地 ahead——`git rev-list HEAD ^origin/master --count` 实测 = **23**（`git rev-list origin/master ^HEAD --count` = 0 双向核验），待用户推送确认。

> 详细任务与 8 要素见 [todo-archive.md §M39](./archive/todo-archive-phases-m39-m40.md#m39-平台视图体验与可观测补强m391m396-全部已闭环--2026-10-10-归档)（2026-10-10 已闭环归档）；上一阶段（M38）见 [todo-archive.md §M38](archive/todo-archive-phases-m38.md#m38-平台执行模型隔离m381m386-全部已闭环--2026-10-09-归档)。

---

## M40: 运行时可靠性与可观测性深化（2026-10-10 用户决策方案 A / 2026-10-10 已闭环 + 归档）

承接 M39 平台视图体验与可观测补强归档后的运行时可靠性阶段。来源为 2026-10-08 定时扫描批量失败排查中暴露、且经 M38/M39 归档后仍保留在 [backlog.md](backlog.md) 的运行时缺口（陈旧产物不可辨 / 失败 run 告警数误导 / 执行超时写死 / worker 崩溃无自愈 / 降级回退无日志），以及同批次审计 / 复核衍生的门禁工具缺口（本地门禁被 Playwright 产物污染）。经 2026-10-10 用户决策（方案 A）从 backlog §候选评估中上收 6 项候选；**同日追加用户决策 D2**：以「平台环境变量文档完整性治理」（用户直接提出的配置 / 文档治理需求）替换原 M40.6（门禁脚本产物排除 → 回退 backlog），维持 6 原子容量。

**6 原子条目**（覆盖 🚀 1 + 🎨 1 + 🛠️ 1 + 🛡️ 1 + 🐛 1 + 📚 1；🎨 独立条目 1 项低于 [规划规范 §1.1 L12 类型平衡建议](../standards/planning.md#11-硬性约束) 建议值 2，缺口已显式标注）：

- **M40.1** [P2 🚀 能力扩展] 部署产物版本戳 / 陈旧校验（构建期注入 commit + 健康端点 + 启动日志）
- **M40.2** [P2 🎨 用户体验] 失败 run 落 summary 快照（failed 分支写 `summaryJson`，仅快照不 reconcile）
- **M40.3** [P2 🛠️ 技术债] 执行超时可配置化（`EXECUTION_TIMEOUT_MS` env + 队列锁时长联动）
- **M40.4** [P2 🛡️ 可靠性] 队列 worker 进程崩溃自动重启（entrypoint 看护循环 + TERM 协同）
- **M40.5** [P2 🐛 缺陷修复] sandbox 降级回退路径落执行日志（回退分支消费 `logsJson`）
- **M40.6** [P2 📚 文档治理] 平台环境变量文档完整性与配置结构治理（`.env.example` 极简 + `.env.full.example` 完整 + `configuration.md` 平台段重构 + `trustedOrigins` 变量兼容）

**类型平衡复核**：🚀 能力扩展 1（M40.1）+ 🎨 用户体验 1（M40.2）+ 🛠️ 技术债 1（M40.3）+ 🛡️ 可靠性 1（M40.4）+ 🐛 缺陷修复 1（M40.5）+ 📚 文档治理 1（M40.6）；🎨 独立条目 1 项低于建议值 2，本阶段以可靠性主线优先，缺口显式标注。

**建议顺序**：M40.6（文档，隔离低风险）→ M40.5（最小缺陷修复）→ M40.2（服务端小改）→ M40.3（配置）→ M40.4（entrypoint 可靠性）→ M40.1（构建 / 基础设施，联动面最广）。

**条目调整**：2026-10-10 用户决策 D2——以「平台环境变量文档完整性治理」（用户直接提出）替换原 M40.6（门禁脚本排除 Playwright 产物 → 回退 [backlog.md](backlog.md)），维持 6 原子容量。

**范围边界（不做什么）**：不改引擎修复 / 验证业务语义与告警模型；不改 `/api/runs` 既有契约；不引入完整 versioning 框架 / 进程管理器（除非 M40.4 D 阶段裁定）；不实现执行可取消（属既有边界）；不改 CLI（`DEPENDFIX_*`）配置项语义与平台 env 的既有权重默认值。

**§3.4 交叉核验**：原 6 项候选经 todo-archive 表格扫描 + git log + 代码 anchor 三重核验，**0 项重复评估**（逐项证据见 [todo-archive.md §M40](./archive/todo-archive-phases-m39-m40.md#m40-运行时可靠性与可观测性深化m401m406-全部已闭环--2026-10-10-归档) 阶段摘要）；其中 ⑥（门禁脚本产物排除）已随同日 D2 回退 backlog，新 M40.6（平台环境变量文档完整性治理）另行三重核验亦 0 项重复。

**commits 状态**：本阶段全部 commits 归档时为本地 ahead——`git rev-list HEAD ^origin/master --count` 实测 = **20**（阶段启动 1 + M40.6 5 + M40.5 2 + M40.2 2 + M40.3 4 + M40.4 3 + M40.1 3；`git rev-list origin/master ^HEAD --count` = 0 双向核验），待用户推送确认。

> 详细任务与 8 要素见 [todo-archive.md §M40](./archive/todo-archive-phases-m39-m40.md#m40-运行时可靠性与可观测性深化m401m406-全部已闭环--2026-10-10-归档)（2026-10-10 已闭环归档）；上一阶段（M39）见 [todo-archive.md §M39](./archive/todo-archive-phases-m39-m40.md#m39-平台视图体验与可观测补强m391m396-全部已闭环--2026-10-10-归档)。

---

## M42: 修复交付正确性 + 平台能力与体验补强（2026-10-10 用户决策方案 A+B 混合 / 2026-10-11 已闭环 + 归档）

承接 M41 规范与经验管理体系重构归档后的「缺陷修复 + 平台补强」阶段。阶段定位为贯穿两条线——**修复被 dependfix 管理仓库的实际受害面**（验证阶段镜像源被 deny-by-default 拦死 → `pnpm install` 失败 → 门禁全量回滚；目标仓库 `.gitignore` 幂等判定失效致重复追加；扫描复用路径与同仓库去重合并叠加时误置既有 run 为 failed）与**平台能力/体验补强**（PR Check 手动触发；列表页表格筛选/搜索/分页；严重级别展示口径统一）。经 2026-10-10 用户决策（方案 A+B 混合）从 [backlog.md](backlog.md) §待上收候选 + §候选评估中上收 6 项，砍掉门禁脚本产物排除与 hooks 隔离锚点（P3 小项）换入 PL（平台）能力项。

**6 原子条目**（覆盖 🛡️ 2 + 🐛 1 + 🚀 1 + 🎨 2；🧪 独立条目缺口已显式标注，测试随条目内嵌）：

- **M42.1** [P2 🛡️ 安全治理] network-audit 出站白名单：预置常见镜像源 + 动态发现生效 registry（消除镜像源被 deny-by-default 拦死 → install 失败 → 全量回滚链路）
- **M42.2** [P2 🐛 缺陷] 目标仓库 `.gitignore` 幂等判定归一化（语义等价写法识别，消除重复追加 `dependfix-reports/`）
- **M42.3** [P2 🛡️ 数据正确性] 扫描复用路径与同仓库去重合并叠加时误置既有 run 为 failed 修复
- **M42.4** [P2 🚀 能力扩展] PR Check 手动触发（同步端点 + 总开关门控）
- **M42.5** [P2 🎨 体验] 平台列表页表格基础能力补强（repos / batch-runs 筛选 + 搜索 + 分页）
- **M42.6** [P3 🎨 体验] 严重级别展示策略统一（收敛到 `scanSeverityOptions` 单一事实源）

**类型平衡复核**：🛡️ 2（M42.1 / M42.3）+ 🐛 1（M42.2）+ 🚀 1（M42.4）+ 🎨 2（M42.5 / M42.6）；🧪 独立条目缺口显式标注（测试随各条目内嵌）——符合 [规划规范 §1.1 L12 类型平衡建议](../standards/planning.md#11-硬性约束)。

**建议顺序**：M42.1（安全治理，治理评审硬前置）→ M42.2 / M42.3（缺陷修复）→ M42.4（能力扩展）→ M42.5 / M42.6（体验收敛，可并行）。

**条目容量**：6 原子符合 [规划规范 §1.1](../standards/planning.md#11-硬性约束) 的 5-6 项上限；M42.5 预估 5-8 文件 / 200-350 行未超单条 > 10 文件 / > 800 行阈值。

**范围边界（不做什么）**：不放开 network-audit deny-by-default（未知域仍拦）；不做镜像源真实性校验与审批流程（用户裁定，恶意代码执行风险由沙箱承接）；不引入 `.gitignore` 完整语法解析依赖；不做「同仓库有进行中任务 → 409 前置拒绝」新方案；不做 PR Check 异步入队（重方案）；不改列表页服务端契约（客户端实现）；不改 env-events / alerts 的严重级别选项表（非同源）；不删除 legacy `/repos/[id]/runs` 页（死代码候选另登记）。

**§3.4 交叉核验**：6 项候选经 todo-archive 表格扫描（`rg` 关键词零命中已闭环修复）+ git log（无对应修复 commit：network-audit 最近 `2104b9f` 追加 `rolldown.rs` / `helpers.ts` 无幂等修复 / `scan.post.ts` 最近 `9f9d067` 降级路径透传 reuse）+ 代码 anchor（`network-audit.ts:65` 白名单 6 域无 `npmmirror` / `helpers.ts:668` 精确字符串比较 / `scan.post.ts:89-105` reused 置 failed / 无 `pr-checks/poll.post.ts` / `repos.vue:280` / `batch-runs.vue:245` 无分页筛选 / `run-view.ts:35` 等 3 类展示面并存）三重核验，**0 项重复评估**。

**审计 depth 预告**：M42.1 改变执行期网络边界 + 治理定义改动（[security.md §5.3](../standards/security.md) + [sandbox-security-governance.md §4.4](../design/governance/sandbox-security-governance.md) 治理评审为硬前置）→ `standard`（建议 2 分区并发）；M42.3 涉及 run 状态写路径 → `standard`；M42.4 新增公开 API 端点 → `standard`；M42.2 / M42.5 / M42.6 按规模 `quick`。

**commits 状态**：本阶段 commits 归档时为本地 ahead——`git rev-list HEAD ^origin/master --count` 实测 = **12**（M42.3 三个 + M42.4 三个 + M42.5 三个 + M42.6 三个；M42.1 / M42.2 及其前的阶段启动共 6 commits 已由用户推送，`origin/master` 顶端 = `e6f3857`），本归档 + 蒸馏批次 commits 另计，待用户推送确认。

> 详细任务与 8 要素见 [todo-archive.md §M42](todo-archive.md#m42-修复交付正确性--平台能力与体验补强m421m426-全部已闭环--2026-10-11-归档)（2026-10-11 已闭环归档；**6 原子 18 commits**）；上一阶段（M41）见 [todo-archive.md §M41](todo-archive.md#m41-规范与经验管理体系重构m411m415-全部已闭环--2026-10-10-归档)。

---

## M41: 规范与经验管理体系重构（2026-10-10 用户决策方案 B / 2026-10-10 已闭环 + 归档）

承接 M40 运行时可靠性与可观测性深化归档后的治理体系重构阶段。根因为「**有规则无门禁 → 必 drift**」——规范混入实现与教训、经验体系体量膨胀且无退出路径、阈值声明双事实源且无脚本计量、规则与执行分离。设计依据为 [standards-experience-refactor.md](../design/governance/standards-experience-refactor.md)（v2 先行稿，170 行；承接 [spec-and-doc-governance.md](../design/governance/spec-and-doc-governance.md) 的未竟部分）。经 2026-10-10 用户决策（方案 B）从 [backlog.md](backlog.md) §候选评估中上收整卡，A-E 五批对应 M41.1~M41.5。

**5 原子条目**（覆盖 📚 1 + 🛠️ 1 + 🧪 1 + 🎨 1 + 🛡️ 1；🎨 独立条目 1 项低于 [规划规范 §1.1 L12 类型平衡建议](../standards/planning.md#11-硬性约束) 建议值 2，且无能力扩展独立条目，缺口已显式标注）：

- **M41.1** [P2 📚 规范治理] 规范去实现化瘦身（standards 剥离实现细节 / 教训 / 实证 → 代码注释 / 设计文档 / L3 索引；`--strict` 归零 + 全部 ≤ 200 行或分片）
- **M41.2** [P2 🛠️ 经验治理] 经验体系三层收敛与精简（L1 门禁 / L2 检查点 / L3 索引；单分片 ≤ 400 行 + 「四者之一」准入）
- **M41.3** [P2 🧪 测试基建] 规范 / 经验门禁落地（`--strict` 接 CI 阻断 + `check-doc-size` 阈值计量 + 经验落点字段校验）
- **M41.4** [P3 🎨 文档体验] 文档站导航分层（侧栏不挂 `design/governance/**` 与 `plan/archive/**`；首页仅引导对外入口）
- **M41.5** [P3 🛡️ 治理同步] 阈值与事实源唯一化（`documentation.md §3` 为唯一权威；`spec-and-doc-governance §2.3` 收敛为一行引用）

**类型平衡复核**：📚 规范治理 1（M41.1）+ 🛠️ 经验治理 1（M41.2）+ 🧪 测试基建 1（M41.3）+ 🎨 文档体验 1（M41.4）+ 🛡️ 治理同步 1（M41.5）；🎨 独立条目 1 项低于建议值 2 且无能力扩展独立条目，本阶段以治理主线优先，缺口显式标注。

**建议顺序**：M41.1（规范瘦身，A1 → A2 → A3）→ M41.2（经验收敛，迁移目标就位后）→ M41.3（门禁接线，依赖 A/B 达标）→ M41.4（导航分层，可与 A 并行）∥ M41.5（阈值统一，依赖 A 达标）。

**批次粒度**：M41.1 预估 8-14 文件 / 净瘦 ~1200 行，超过 [规划规范 §1.1](../standards/planning.md#11-硬性约束) 的 > 10 文件 / > 800 行阈值 → 内部拆 3 个可独立提交批次（A1 `platform.md` / A2 `development.md` + `ai-collaboration.md` / A3 其余 11 文件），每批独立验收 + 独立审计。

**条目调整**：无（整卡上收，无替换 / 无追加）。

**范围边界（不做什么）**：不做 `srcExclude` 物理隔离 / 不拆双站点（发布策略不变）；不删除历史归档原始信息；不改规则的事实权威（单点声明保留）；不修改 `AGENTS.md`（实测其「硬阈值」为设计文档必要性阈值、与文档行数阈值表异源，如确需改动须用户明确确认）；不引入新工具链。

**§3.4 交叉核验**：整卡候选经 todo-archive 表格扫描（`rg` 0 命中）+ git log（无瘦身 / 经验重构 / 接线 commit）+ 代码 anchor（standards 3211 行 / experience-archive 2409 行 / `check:standards-redundant` 166 处命中且 CI 未接线 / `documentation.md §3` 缺 standards·design 行 / `spec-and-doc-governance §2.3` 双事实源 / 侧栏仍挂 6 篇治理设计稿）三重核验，**0 项重复评估**。

**审计 depth 预告**：本阶段为治理定义改动，按 [AGENTS.md §审计触发](../../AGENTS.md) + [spec-and-doc-governance §2.4](../design/governance/spec-and-doc-governance.md#24-设计文档硬阈值hard-requirement) 触发强制审计；M41.1（A 批 > 10 文件 / ~1200 行）适用 `deep`，建议 2 分区并发。

**commits 状态**：阶段启动规划 commit 落地后实测（`git rev-list HEAD ^origin/master --count` 双向核验），本阶段 commits 归档前均为本地 ahead，待用户推送确认。

> 详细任务与 8 要素见 [todo-archive.md §M41](todo-archive.md#m41-规范与经验管理体系重构m411m415-全部已闭环--2026-10-10-归档)（2026-10-10 已闭环归档；**5 原子 15 commits**：阶段启动 1 + M41.1 5 + M41.2 2 + M41.3 3 + M41.4 2 + M41.5 2；审计 5 原子全覆盖，M41.2 / M41.3 各经 Reject 后修复复审通过；同期范围内另有 1 commit 属并行 session 的候选登记）；上一阶段（M40）见 [todo-archive.md §M40](./archive/todo-archive-phases-m39-m40.md#m40-运行时可靠性与可观测性深化m401m406-全部已闭环--2026-10-10-归档)。

---

## M43: PR Check 能力补强 + 运行时可靠性与工程治理（2026-10-12 用户决策方案 A / 2026-10-14 已闭环 + 归档）

承接 M42 归档后的「平台能力补强 + 运行时可靠性」两条线。**PR Check 能力补强**线——① 列表行内补齐所属仓库标识（2026-10-12 用户反馈：跨仓库 PR 编号重号、行内无从判断归属）；② 把 PR Check 从单一 `Test` check 扩展为 GitHub 三源（Checks + Commit Statuses + Deployments）构建 / 部署信号聚合（设计先行稿 [pr-build-deploy-signals.md](../design/governance/pr-build-deploy-signals.md) 已定稿）。**运行时可靠性与工程治理**线——③ 容器内 `pnpm install` 环境性失败（非零退出且无 stderr）的可观测性与归因口径（消除 `engine_exit_2` 误归因）；④ 扫描触发被去重合并时的前端感知；⑤ git 非仓库目录语义与 push 侧 `pre-push` 钩子隔离收口；⑥ 门禁脚本 Playwright 产物排除与 `distill-wisdom` 计数假阴性修复。

经 2026-10-12 用户决策（方案 A）从 [backlog.md](backlog.md) §候选评估中 + §待上收候选上收 6 项。

**6 原子条目**（覆盖 🎨 2 + 🚀 1 + 🛡️ 2 + 🛠️ 1；🧪 独立条目缺口已显式标注，测试随条目内嵌）：

- **M43.1** [P2 🎨 体验] PR Check 监测列表补齐所属仓库标识（`owner/name`，消除跨仓库同号 PR 不可辨）
- **M43.2** [P2 🚀 能力扩展] PR 构建 / 部署错误多源采集（GitHub 三源聚合 + 归一化 + 告警沿用；**预估超任务粒度阈值，须拆 M43.2a / M43.2b**）
- **M43.3** [P2 🛡️ 可观测性 / 归因] 容器内 `pnpm install` 环境性失败的可观测性与归因口径（保留 stderr / exit code / signal + UI 文案分层）
- **M43.4** [P2 🎨 体验] 扫描触发被去重合并（`merged`）时的前端感知（消除「点了修复但没跑」）
- **M43.5** [P3 🛡️ 治本] git 边界收口：`hasGitChanges` 非仓库语义 + push 侧 `pre-push` 钩子隔离
- **M43.6** [P3 🛠️ devEx] 工程脚本加固：门禁产物排除（`playwright-report` / `test-results`）+ `distill-wisdom` 计数假阴性

**类型平衡复核**：🎨 2（M43.1 / M43.4）+ 🚀 1（M43.2）+ 🛡️ 2（M43.3 / M43.5）+ 🛠️ 1（M43.6）；🧪 独立条目缺口显式标注（测试随各条目内嵌）——符合 [规划规范 §1.1 L12 类型平衡建议](../standards/planning.md#11-硬性约束)。

**建议顺序**：M43.1（前端先行，避免 M43.2 同表两次改动）→ M43.2（大项，D 阶段先定稿子任务拆分）→ M43.3 → M43.4 → M43.5 → M43.6。

**条目容量**：6 原子符合 [规划规范 §1.1](../standards/planning.md#11-硬性约束) 的 5-6 项上限；**M43.2 预估 > 10 文件 / > 800 行，须拆 M43.2a（采集层）/ M43.2b（聚合 + 实体 + API/UI）**，拆分依据登记 `todo.md §M43.2`；其余条目未超单条阈值。**M43.1 与 M43.2 同表（`pr-checks`），仓库标识口径宜一并设计以避免两次改表。**

**范围边界（不做什么）**：不改 PRCheck 数据模型 / 状态机与 ack 语义（M43.1）；不改 engine 本地构建 / 验证逻辑、不新建 GitHub App、不做 webhook、首批不含 provider 原生日志富化（M43.2）；不改 `pnpm install` 执行方式与锁文件修复策略语义（M43.3）；不改 `POST /api/repos/[id]/scan` 去重合并语义与响应结构（M43.4）；不改 `--no-verify` 选型与签名隔离常量取值（M43.5）；不改编号正则 / 真常量白名单（M43.6）。

**§3.4 交叉核验**：6 项候选经 todo-archive 表格扫描（关键词零命中已闭环修复，唯一命中为 M24 PR Check MVP——属单 `Test` check MVP，非多源扩展）+ git log（`pr-checks.vue` 最近 `4aa1f7b` 手动触发入口无仓库列 / `services/monitor/**` 无 Deployments / Commit Statuses 采集 / `fixers/pnpm/index.ts` 无 signal 上报 / `pr-creator.ts` push 侧仅签名隔离）+ 代码 anchor（`pr-checks.vue:115-120` 6 列无仓库列 + `pr-checks/index.get.ts:33` 仅 `repositoryId` / `polling-source.ts` 仅单 check 名 / `use-fix-now.ts:65-84` 不消费 `merged` / `helpers.ts:669` 非仓库恒 `true` / `pushBranch` 无 hooks 隔离 / 两门禁脚本排除面缺产物目录 + `distill-wisdom.mjs:145` 正则不容忍「日期+类型」）三重核验，**0 项重复评估**。

**审计 depth 预告**：M43.2（数据模型 / migration / 公开 API / 外部调用）→ `standard`（建议 2 分区并发）；M43.3（归因口径 + 展示映射）→ `standard`；M43.5（engine git 行为 + 平台 push 路径）→ `standard`；M43.1 / M43.4（前端）→ `quick`；M43.6（脚本 + 单测）→ `quick`。

**commits 状态**：阶段启动规划 1 + 前置插队热修 3 + M43.1 3 + M43.2 27 + M43.3 5 + M43.4 3 + M43.5 4 + M43.6 4 = **50 commits**（`git log master --first-parent --oneline 68ad47f^..HEAD` 去重统计）；归档前 `git rev-list HEAD ^origin/master --count` 实测 = 11（`origin/master ^HEAD` = 0 双向核验；M43.1 / M43.2 / M43.3 及其前已推送），待用户推送确认。

> 详细任务与 8 要素见 [todo-archive.md §M43](todo-archive.md#m43-pr-check-能力补强--运行时可靠性与工程治理2026-10-12-用户决策方案-a--2026-10-14-归档)（2026-10-14 已闭环归档；**6 原子 50 commits** + 阶段期间 caomei-ui `0.6.0` 升级回归插队热修 3 commits）；上一阶段（M42）见 [todo-archive.md §M42](todo-archive.md#m42-修复交付正确性--平台能力与体验补强m421m426-全部已闭环--2026-10-11-归档)。

---

## M44: 验证链治本 + 文档门禁可信度收口（2026-10-14 用户决策方案 A / 2026-10-15 已闭环 + 归档）

承接 M43 归档后的「**对质量的承诺与实际执行之间的落差**」主线，同一根因在两条线各暴露一次——**交付侧**：验证链 `DEFAULT_VERIFY_COMMANDS` 四条命令互不重叠地都不做类型检查（lint 只跑规则 / tsdown `dts` 只发射声明 / vitest 走 esbuild 转译）→ 类型面破坏被判 `verificationPassed = true` 并交付成 PR（用户实证：nodemailer 10.x 升级后 `nodemailer.Transporter` 报 TS2503；M30.3 C84 `21bf8bb` 当年改文档而非补链路，使缺口在文档层被抹平）；**文档侧**：`check-docs.mjs:131-169` 只校验锚点存在性、`.vitepress/config.ts:147` `ignoreDeadLinks: true`，四类「合法文本但语义漂移」缺陷长期无门禁。经 2026-10-14 用户决策（方案 A）从 [backlog.md](backlog.md) §待上收候选（C95）+ §候选评估中上收 10 项候选，收敛为 6 原子条目。

**6 原子条目**（🛡️ 1 + 🛠️ 1 + 📚 3 + 🎨 1；🚀 与 🧪 独立条目缺口显式标注——候选池内两项能力候选同域且与 M43.2 强耦合，宜独立批次串行推进）：

- **M44.1** [P2 🛡️ 治本] 验证命令链纳入 `typecheck`（同级直接阻断；顺序 `install → lint → build → typecheck → test`——typecheck 依赖 workspace `dist`，实测移出 dist 后平台 typecheck exit 2 + 大量 TS2307，故必须在 build 之后、test 之前）
- **M44.2** [P3 🛠️ devEx] 文档门禁机检缺口收敛（链接文本 §N ↔ 锚点一致性 / VitePress 站点绝对链接 / 未成对 `](` / 强调标记配对，四类各带负例标定）
- **M44.3** [P3 📚 治理] 文档口径与命名一致性收口（`design/packages` 残留 3 处 + `ai-collaboration.md` 跨段重复编号 + 经验归档 `§49-§57` 分片文件名与内容范围不符）
- **M44.4** [P3 📚 治理] 设计文档存量超健康窗口分批拆分（warning 带 13 文件 + 强制分片线豁免 1 文件，分 3 批独立验收）
- **M44.5** [P3 🎨 体验] 站点语言切换器未翻译页 404 兜底（M41.4 导航分层后剩余唯一非导航面死链来源）
- **M44.6** [P3 📚 治理] `tech-stack` 平台依赖表行级一致性（版本口径不一致 + 无引用占位行）

**建议顺序**：M44.1（治本主线）→ M44.2（门禁就位，防后续文档批次回归）→ M44.3（命名 / 编号收口，牵动锚点面先于拆分）→ M44.4（存量拆分，在门禁就位后分批）→ M44.5（可并行）∥ M44.6。**条目容量**：6 原子（5-6 项上限内）；M44.1 与 M44.3 均触及 > 10 文件面——M44.1 命中[设计文档硬阈值](../design/governance/spec-and-doc-governance.md#24-设计文档硬阈值hard-requirement)，承载面经用户裁定为 [dependency-fixer.md](../design/modules/dependency-fixer-records.md) 验证链章节；M44.3 的承载面为该文件自身编号结构与分片命名。

**范围边界（不做什么）**：不改 `quickVerifyProject` 的 lint-only 定位、不做脚本名探测 / 非阻断观察期 / 从目标仓库 CI 反推验证链（M44.1）；不做外链存活检查与文档全文渲染校验（M44.2）；不改 standards 规则语义（M44.3）；不缩小计量面、不新增豁免表条目（M44.4）；不做全量 en 翻译、不改 `ignoreDeadLinks`（M44.5）；不做依赖实际升降级（M44.6）。

**§3.4 交叉核验**：**0 项重复评估**——归档表格扫描零命中已闭环项（唯一同族命中为 M41 归档段自身的「未完成项」清单，即本批候选来源）+ git log 无对应实现 commit（`scripts/check-docs.mjs` 最近为 `d315840`）+ 代码 anchor 逐项实证未闭环（`DEFAULT_VERIFY_COMMANDS` 4 条命令无 typecheck / `check-docs.mjs:131-169` 仅校验锚点存在 / `config.ts:147` `ignoreDeadLinks: true` / `distill-wisdom.mjs:61` + `docs-and-readme-i18n.md:123` + `modules/index.md:1` 旧目录名 / `ai-collaboration.md` L82/91/99/109 跨段编号 / `experience-archive-§49-§57-…md` H1 为「§四十九 - §六十八」/ `apps/platform/package.json:44` 版本口径与无声明行）。

**审计 depth 预告**：M44.1 → `deep`（建议 2 分区并发：P1 引擎与默认链 + 测试 / P2 文案口径与平台同步）；M44.2 / M44.3 / M44.4 → `standard`；M44.5 / M44.6 → `quick`。

**commits 状态**：阶段启动规划 commit 落地后按 [规划规范 §4.4 第 5 条](../standards/planning.md#44-大批量归档批次操作规范) 用 `git rev-list HEAD ^origin/master --count` 双向核验并动态描述，不写死数字。**本批实测登记的已知边界（已闭环）**：`roadmap.md` 因本段新增一度达 906 行 → 超「强制分片阈值（>900）」触发 `check-doc-size` error；本批先以**压缩本段回落到 warning 带**处置，完整拆分（M0–M38 段迁出至 `archive/roadmap-phases-m0-m38.md` + 全仓锚点重指）**已于 2026-10-15 随 M44.4 批次③ 落地**（`roadmap.md` 898 → 252 行，`check-doc-size` warning 带归零；原「待用户决策后立项」已兑现，见 [archive/index.md §4](archive/index.md)）。

**阶段期间插队热修（不占阶段编号）**：entrypoint 双进程信号处置顺序竞态（CI 偶发红；[规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 插队例外清单第 3 类「CI 主链路阻塞」+ 用户 2026-10-14 授权）—— 规则与检查点落 [platform.md §10.6](../standards/platform.md#106-队列执行进程隔离独立-worker-进程)，批次记录见 [archive/index.md §4](archive/index.md)。

> 详细任务与 8 要素见 [todo-archive.md §M44](todo-archive.md#m44-验证链治本--文档门禁可信度收口m441m446-全部已闭环--2026-10-15-归档)；上一阶段（M43）见 [todo-archive.md §M43](todo-archive.md#m43-pr-check-能力补强--运行时可靠性与工程治理2026-10-12-用户决策方案-a--2026-10-14-归档)。

---

## M45: 运行可靠性与交付链收口（2026-10-15 用户决策方案 A / 进行中）

承接 M44 归档后的「**跑得对、跑得省、看得见**」阶段。M44 已把「验证链不含类型检查」与「文档门禁形同虚设」两条假绿链路治本，本阶段转向**交付链自身残留的可靠性、成本与可观测缺口**——① 本仓库自用 `commands` 链与引擎默认链长期存在面差（自用链缺 `test`，且 `--commands` 为整链替换，默认链每扩展一次即漂移一次）——**已由 M45.1 闭环**（补齐测试段 + 新增一致性门禁）；② 零告警仓库虽已跳过 lockfile repair，修复前基线采样仍执行一次完整验证链——**已由 M45.2 闭环**（按需采样 + 无改动即豁免归因）；③ 独立 worker 进程与 HTTP 进程共享同一 Nitro 产物，重复启动 `stale-cleanup` / 启动期引导等周期插件；④ 运行失败已具备「分类 + 筛选 + 展示」，缺设计稿 §5.5 的「受约束重试入口」；⑤ 浮层类组件落点页无像素门禁；⑥ PR Check「全量只报警不阻断」缺降噪配置面。经 2026-10-15 用户决策（**方案 A**）从 [backlog.md](backlog.md) §候选评估中上收 6 项候选。

**6 原子条目**（覆盖 🛠️ 3 + 🎨 1 + 🚀 1 + 🧪 1；**🎨 独立条目仅 1 项，低于 [规划规范 §1.1 L12 类型平衡建议](../standards/planning.md#11-硬性约束) 建议值 2，缺口已显式标注**）：

- **M45.1** [P2 🛠️ 技术债] 自用 dependfix 验证链面差收口（补 `test` 与 `commands` 语义契约化）——**已闭环**
- **M45.2** [P2 🛠️ 技术债] 零告警仓库修复前基线采样成本（拆 `prepareRepoFix` 只读抓取 / 写盘两段）——**已闭环**
- **M45.3** [P2 🛠️ 技术债] 队列 worker 进程按 role 跳过周期插件（`DEPENDFIX_ROLE`）——**已闭环**
- **M45.4** [P2 🎨 用户体验] 运行失败「受约束重试入口」（设计稿 §5.5）
- **M45.5** [P3 🧪 测试覆盖] 浮层类组件视觉覆盖扩面（Drawer / Tabs / Popover / Toast 落点页）
- **M45.6** [P3 🚀 能力扩展] PR Check 告警关注集（可配置面）

**类型平衡复核**：🛠️ 3（M45.1 / M45.2 / M45.3）+ 🎨 1（M45.4）+ 🚀 1（M45.6）+ 🧪 1（M45.5）——🎨 独立条目 1 项低于建议值 2，本阶段以运行可靠性与成本主线优先，缺口显式标注（候选池内 UX 类可上收项仅「受约束重试入口」与「平台死代码清理」，后者规模不足以独立成原子）。

**建议顺序**：M45.1（最小、隔离面清晰，先消除自用链漂移）→ M45.3（platform 插件守卫，无耦合）→ M45.2（engine 归因，D 阶段先做被跳过步骤语义清单）→ M45.4（平台能力，端点 / 落库形态需裁定）→ M45.6（数据模型 + 配置面，面最广）→ **M45.5 放最后**（视觉基线须在 UI 变更后建立，避免 M45.4 / M45.6 使新基线立即失效）。

**条目容量**：6 原子符合 [规划规范 §1.1](../standards/planning.md#11-硬性约束) 的 5-6 项上限；**M45.6 预估 8-12 文件 / 200-380 行**，若 D 阶段裁定含数据模型变更则内部拆「配置承载层 / 生效与展示层」两批（拆分依据登记 [todo.md](todo.md) §M45.6）；其余条目均未超单条阈值。

**范围边界（不做什么）**：不改引擎默认链条数与顺序（M45.1）；不改 `enforceVerificationGate` 回滚语义与 `preExistingDirty` 保护面（M45.2）；不改插件清理 / 对账逻辑与 entrypoint 看护与信号处置（M45.3）；不做批量重试、不放开非 `transient`、不改 failure taxonomy 分类（M45.4）；不改视觉门禁阈值、不做全站覆盖（M45.5）；不引入阻断语义、不做 provider 日志富化与通知集成（M45.6）。

**§3.4 交叉核验**：6 项候选经 todo-archive 表格扫描（关键词 `commands` / 自用链 / `prepareRepoFix` / 基线采样 / `DEPENDFIX_ROLE` / `inProcessWorker` / `retriedFromRunId` / 受约束重试 / 视觉覆盖 / `popover` / 关注集 零命中已闭环项）+ git log（`security-auto-fix.yml` 最近 `2188b16` 文档口径同步 / `packages/engine/src/app/repo-fix.ts` 最近 `4fee403` 信号保留 / `apps/platform/server/plugins/**` 最近 `0f73645` 注释重指 / `apps/platform/tests/visual/**` 最近 `1d12803` 无浮层落点页 / `pr-check.ts` 无关注集列）+ 代码 anchor（`security-auto-fix.yml:90` 回退链不含 `test` / `repo-fix.ts:140` + `:175` `prepareRepoFix` 单段形态 / 全仓 `DEPENDFIX_ROLE` 零命中且 `plugins/stale-cleanup.ts` 无守卫 / 全仓 `retriedFromRunId` 零命中 / `tests/visual/platform-pages.visual.test.ts` 仅 5 个既有页面 / `pr-check.ts:71-120` 无关注集字段）三重核验，**0 项重复评估**。

**审计 depth 预告**：M45.1 / M45.2 / M45.3 / M45.4 → `standard`；M45.5 → `quick`；M45.6 → `standard`（若含数据模型变更建议 2 分区并发）。

**阶段期间追加临时待办（不占阶段条目编号，2026-10-16 用户授权）**：批量日志导出范围口径（默认导出当前页 + 保留「全部筛选结果」入口）——追加于 §M45 段落末尾（标记口径以 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 为唯一权威声明）；规则与检查点落 [development.md §5.1.43](../standards/development.md)，任务与闭环记录见 [todo.md](todo.md)，批次记录见 [archive/index.md §4](archive/index.md)。**不计入本阶段原子条目数与类型平衡**。

**commits 状态**：阶段启动规划 commit 落地后按 [规划规范 §4.4 第 5 条](../standards/planning.md#44-大批量归档批次操作规范) 用 `git rev-list HEAD ^origin/master --count` 双向核验并动态描述，不写死数字。

> 详细任务与 8 要素见 [todo.md §M45](todo.md#m45-运行可靠性与交付链收口-2026-10-15-用户决策方案-a)；上一阶段（M44）见 [todo-archive.md §M44](todo-archive.md#m44-验证链治本--文档门禁可信度收口m441m446-全部已闭环--2026-10-15-归档)。

---

## 详细任务

- 当前阶段任务：**M45 进行中**——运行可靠性与交付链收口（6 原子条目，见 [todo.md §M45](todo.md#m45-运行可靠性与交付链收口-2026-10-15-用户决策方案-a)）
- 已归档阶段：[todo-archive.md](todo-archive.md)（主窗口保留最近阶段完整段 + 指针段；M0-M44 全部已归档；早期阶段见 [archive/index.md](archive/index.md) 分片索引）
- 下一阶段（未授权）：无——本阶段闭环后按 [规划规范 §3.1](../standards/planning.md#31-新需求默认走评估--backlog原则hard-requirement) 评估 backlog 候选池后由用户决策
- 后续阶段任务（延期项 + 未排期增强候选）：[backlog.md](backlog.md)

## 交付原则

- 每个里程碑必须通过 lint + typecheck + build + test 质量门
- 里程碑交付前需经过 code-reviewer 技能审查
- 剩余风险必须在交付说明中清晰记录
