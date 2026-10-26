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
| M24: PR Check MVP + 治理债 + 测试补强 + 用户体验 | PR Check 状态监测 MVP + M22.7+M22.8 残留根因 + C36 i18n | P1-P3 | 已完成（[M24 分片](archive/todo-archive-phases-m24.md)） |
| M25: PrimeUI License 治理 + 平台 AI 研判集成 + lint baseline + M24 follow-up 工具化 | C70 PrimeUI 降级 + C68 AI 研判基础层 + lint baseline + i18n-anchor-check + zod-helpers | P1-P3 | 已完成（[M25 分片](archive/todo-archive-phases-m25.md)） |
| M26: 平台 AI 研判应用层 + 批量导入 Resource owner 化 + 文档站 i18n + License 收口 + 经验沉淀 | C68 P1 应用层 + C67 + C69 P0 + primeicons 降级 + baseline 22 warnings 治理 + e2e 适配 + 经验归档沉淀 | P1-P3 | 已完成（[M26 分片](archive/todo-archive-phases-m26.md)） |
| M27: 用户体验 + 治理优先 | M27.1 重复评估修正 + M27.2 W1 apps/platform stylelint + M27.3 W2 logger 补测 + M27.4 W4 container-executor 补测 + M27.5 ECONNRESET 候选 ① 诊断 | P1-P3 | 已完成（[M27 分片](archive/todo-archive-phases-m27.md#m27-用户体验--治理优先m271m272-w1m273-w2m274-w4m275-全部已闭环--2026-09-10-归档)） |
| M28: 治理债清理 + 能力扩展 | M28.1 backlog.md §已知边界段批量治理 + §4.4 第 11 条规则强化 + M28.2 C14 多 cs lint 性能 + M28.3 C15 B 类规则样本核对 + M28.4 C33 MCP P3 + M28.5 M22.8 follow-up ② | P2-P3 | 已完成（[M28 分片](archive/todo-archive-phases-m28.md)；2026-09-11 用户决策方案 M28-A + M28.1 重编号 + 完整 5 候选闭环 + M28.6 归档批次落地，commits 已推送 origin/master） |
| M29: 修复交付链路正确性 + 能力扩展 | C73 git 配置污染隔离 + C75 验证链纳入 test + C77 override 复发防护 + C78 alerts 未启用/获取失败区分 + C71 pnpm 路径级 overrides + C72 批量导入 archived/disabled 过滤 + vite 漏洞插队 hotfix + C79 devEx 配置缺口 + C80-A CI 审计覆盖（M29.8/M29.9 为 M29.1 衍生） | P2-P3 | 已完成（已归档，2026-10-01 M34 归档批次预防性分片迁出至 [archive/todo-archive-phases-m29.md §M29](archive/todo-archive-phases-m29.md#m29-修复交付链路正确性--能力扩展m291m299-全部已闭环--2026-09-27-归档)） |
| M30: 治理债清理 + 迁移可行性验证 + 能力扩展 + 测试补强 | C87 跳过类审计退出码 + C86 max-lines 拆分 + C84 文档对齐 + C74 getCommitAuthor 接线（App 路径）+ db-restore 补测 + UI 组件库迁移可行性验证 V1-V3 | P2-P3 | 已完成（[archive/todo-archive-phases-m30.md §M30](archive/todo-archive-phases-m30.md#m30-治理债清理--迁移可行性验证--能力扩展--测试补强m301m306-全部已闭环--2026-09-28-归档)） |
| M31: apps/platform UI 组件库迁移（PrimeVue → caomei-ui） | B0 基线与双库并存接线 + B1a/B1b DataTable 迁移 + B2 表单/浮层切换 + B3 收尾卸载与回归 + C90 db-restore 补强 | P2-P3 | 已完成（[M31 分片](archive/todo-archive-phases-m31.md#m31-appsplatform-ui-组件库迁移primevue--caomei-ui-m311m316-全部已闭环--2026-09-29-归档)） |
| M32: 能力扩展优先 | C76 平台验证命令配置 + C85 目标仓库专属配置 + C89 Code Scanning 未启用区分 + C82 git 签名语义边界 + C92 视觉回归最小集 | P3 | 已完成（[M32 分片](archive/todo-archive-phases-m32.md#m32-能力扩展优先m321m325-全部已闭环--2026-09-30-归档)） |
| M33: 治理债收口 + 测试基建扩展 | C91 review 检查点补挂 + 视觉回归 CI 转阻断 + M31 dependabot 死配置清理 + C93/C94 视觉回归覆盖扩展 + C80 观察期阻断语义 + M33.7 迁移入口 + M33.8–M33.10 UI 修复 + M33.11 存量漏洞治理 | P3 | 已完成（[archive/todo-archive-phases-m33.md §M33](archive/todo-archive-phases-m33.md#m33-治理债收口--测试基建扩展m331m3311-全部已闭环--2026-09-30-归档)；2026-09-30 归档） |
| M34: 治理与体验收口 + 组件库升级与巡检基建 | devEx `data/` 产物污染治理 + caomei-ui 0.5.0 升级（弹窗 Select 裁剪/层级） + 视觉回归灵敏度与弹窗覆盖 + 上游组件问题归因流程 + label 间距统一 + 字段堆叠口径复用化 + PrimeUI 文档同步 + C83 验证链失败基线 | P2-P3 | 已完成（[todo-archive-phases-m34.md §M34](archive/todo-archive-phases-m34.md#m34-治理与体验收口--组件库升级与巡检基建m341m347-全部已闭环--2026-10-01-归档)；2026-10-01 归档） |
| M35: 批量运行终态兜底对账 + 进度可见性修复 | 周期兜底对账服务 + 写回逻辑收敛 + `finishedAt` 真实化 + sync 立即终结 + 前端口径修正 + 存量订正脚本 + 设计口径同步 | P2-P3 | 已完成（[todo-archive-phases-m35.md §M35](archive/todo-archive-phases-m35.md#m35-批量运行终态兜底对账--进度可见性修复m351m356-全部已闭环--2026-10-02-归档)；2026-10-02 归档） |
| M36: 治理债清仓 + 可观测性与测试稳定性 | C81 孤立规划编号存量清理（分批）+ 文档陈旧状态清理 + BatchRun 写回竞态收敛 + 告警源可审计性判据 + api-i18n e2e 顺序偶发 + dependfix-platform 镜像体积治理 + pnpm overrides key 语义归一化 + Docker 首次启动数据库初始化与部署文档 + 扫描队列孤儿 job 释放 + 队列消费者维度自动降级 | P1-P3 | 已完成（[M36 分片](archive/todo-archive-phases-m36.md#m36-治理债清仓--可观测性与测试稳定性m361m3610-全部已闭环--2026-10-05-归档)；2026-10-05 归档） |
| M37: 运行可观测性与体验记忆 | 运行失败分类与筛选 + 落库回填（failureStage / failureKind，不含重试入口）+ 扫描 / 批量扫描偏好记忆（方案 C 混合）+ BatchRun 写回与告警源错误信号残余治理 + caomei-ui 版本口径同步 + 孤立编号检测脚本接入 CI 门禁 + 目标仓库 git hooks 隔离 | P1-P3 | 已完成（2026-10-06 用户决策方案 B + 同日授权追加 M37.6；2026-10-08 已闭环归档，见 [M37 分片](archive/todo-archive-phases-m37.md#m37-运行可观测性与体验记忆m371m376-全部已闭环--2026-10-08-归档)） |
| M38: 平台执行模型隔离 | 队列执行进程隔离（方案 ①′ 独立 worker 进程，治本）+ Worker 锁参数显式化与锁问题事件观测（止血）+ `scan.post` failover 透传 reuse + e2e 全页卡片计数断言解耦 + `scan-queue.ts` 注释 jobId 口径订正 + schedule 表单复用 scan-options 口径 | P1-P3 | 已完成（2026-10-06 用户授权 / 2026-10-09 已闭环归档，见 [M38 分片](archive/todo-archive-phases-m38.md#m38-平台执行模型隔离m381m386-全部已闭环--2026-10-09-归档)） |
| M39: 平台视图体验与可观测补强 | 扫描页筛选与分页优化 + 扫描历史弹窗体验 + 告警视图「按包」聚合跨 severity 重复分组修正 + 运行日志下载与批量下载 + PR Check 监测启用链路打通 + 环境事件覆盖扩展 | P2-P3 | 已完成（2026-10-09 用户决策方案 A / 2026-10-10 已闭环归档，见 [M39 分片](./archive/todo-archive-phases-m39-m40.md#m39-平台视图体验与可观测补强m391m396-全部已闭环--2026-10-10-归档)） |
| M40: 运行时可靠性与可观测性深化 | 部署产物版本戳陈旧校验 + 失败 run 落 summary 快照 + 执行超时可配置化 + 队列 worker 崩溃自动重启 + sandbox 降级回退路径落执行日志 + 平台环境变量文档完整性治理 | P2 | 已完成（2026-10-10 用户决策方案 A / D2 以环境变量文档治理替换 M40.6；2026-10-10 已闭环归档，见 [M40 分片](./archive/todo-archive-phases-m39-m40.md#m40-运行时可靠性与可观测性深化m401m406-全部已闭环--2026-10-10-归档)） |
| M41: 规范与经验管理体系重构 | standards 去实现化瘦身 + 经验体系三层收敛与精简 + 规范/经验门禁落地（CI 阻断）+ 文档站导航分层 + 阈值与事实源唯一化 | P2-P3 | 已完成（2026-10-10 用户决策方案 B / 2026-10-10 已闭环归档，见 [M41 分片](archive/todo-archive-phases-m41.md#m41-规范与经验管理体系重构m411m415-全部已闭环--2026-10-10-归档)） |
| M42: 修复交付正确性 + 平台能力与体验补强 | network-audit 出站白名单镜像源扩充与动态发现 + `.gitignore` 幂等判定归一化 + 扫描复用路径误置既有 run 为 failed 修复 + PR Check 手动触发 + 平台列表页表格基础能力补强 + 严重级别展示策略统一 | P2-P3 | 已完成（2026-10-10 用户决策方案 A+B 混合 / 2026-10-11 已闭环归档，见 [M42 归档分片](archive/todo-archive-phases-m42.md#m42-修复交付正确性-平台能力与体验补强-m42-1-m42-6-全部已闭环-2026-10-11-归档)） |
| M43: PR Check 能力补强 + 运行时可靠性与工程治理 | PR Check 列表仓库标识 + PR 构建/部署错误多源采集（GitHub 三源聚合）+ 容器内 `pnpm install` 环境性失败可观测性与归因口径 + 扫描触发去重合并前端感知 + git 非仓库 / push 钩子边界收口 + 工程脚本加固（门禁产物排除 + 蒸馏计数假阴性） | P2-P3 | 已完成（2026-10-12 用户决策方案 A / 2026-10-14 已闭环归档，见 [M43 分片](archive/todo-archive-phases-m43.md#m43-pr-check-能力补强--运行时可靠性与工程治理2026-10-12-用户决策方案-a--2026-10-14-归档)） |
| M44: 验证链治本 + 文档门禁可信度收口 | 验证命令链纳入 `typecheck`（治本）+ 文档门禁机检缺口收敛（四类静默缺陷）+ 文档口径与命名一致性收口 + 设计文档存量超健康窗口分批拆分 + 站点语言切换器未翻译页 404 兜底 + `tech-stack` 平台依赖表行级一致性 | P2-P3 | 已完成（2026-10-14 用户决策方案 A / 2026-10-15 已闭环归档，见 [M44 分片](archive/todo-archive-phases-m44.md#m44-验证链治本--文档门禁可信度收口m441m446-全部已闭环--2026-10-15-归档)） |
| M45: 运行可靠性与交付链收口 | 自用验证链面差收口 + 零告警仓库修复前基线采样成本 + 队列 worker 按 role 跳过周期插件 + 运行失败受约束重试入口 + 浮层类组件视觉覆盖扩面 + PR Check 告警关注集 | P2-P3 | 已完成（2026-10-15 用户决策方案 A / 2026-10-19 已闭环归档，见 [M45 分片](archive/todo-archive-phases-m45.md#m45-运行可靠性与交付链收口-2026-10-15-用户决策方案-a-2026-10-19-归档)） |
| M46: 运行结果可信度与可观测性 | 环境性失败与「有告警未修」可见性 + 跨 major / 截断 / 子目录跳过披露 + 基线完整链与门禁回滚粒度 + 执行容器内存下限与 OOM 归因 + 平台通知与邮件推送（issue #190）+ 视觉库 fixtures 前置断言 | P1-P3 | 已完成（2026-10-20 用户决策方案 A / 2026-10-22 已闭环归档，见 [M46 分片](archive/todo-archive-phases-m46.md#m46-运行结果可信度与可观测性-2026-10-20-用户决策方案-a-2026-10-22-归档)） |
| M47: 交付判定可信与运行自证 | 验证链与目标仓库 CI 口径对齐 + 构建版本回执与安装日志语义 + 环境性失败归因收口 + pnpm store 持久化与提交卫生 + 通知周汇总（`weekly_digest`）+ 工程门禁与提交卫生收口 | P1-P3 | 已完成（2026-10-22 用户决策方案 A′ / 2026-10-24 已闭环归档，见 [M47 分片](archive/todo-archive-phases-m47.md#m47-交付判定可信与运行自证-2026-10-22-用户决策方案-a′-2026-10-24-归档)） |
| M48: 对外 PR 交付闭环 | 兄弟包 / peer 家族锁步升级 + CI 独有脚本纳入验证链 + 同告警尝试指纹去重 + 提交面白名单与 YAML 定点编辑 + PR 创建后 CI 回环 + 外部作业归因与合并门禁 | P0-P1 | 已完成（2026-10-24 用户决策 D+E / 2026-10-25 已闭环归档，见 [M48 分片](archive/todo-archive-phases-m48.md#m48-对外-pr-交付闭环-2026-10-24-用户决策-d-e-2026-10-25-归档)） |
| M49: 0.6.0 发版清障 | 自产 code scanning 告警清零 + 依赖漏洞清零 + Security 门禁转正 + 发版文档漂移收口 + 0.6.0 发布与发布后验证 | P0 | 进行中（2026-10-25 用户决策；见 [todo.md §M49](todo.md#m49-0-6-0-发版清障-2026-10-25-用户决策)） |
| 1.0: 发布门槛收口 | E 通知可信度 + F1 语义与数据 + F2 文档与验证 + G 发布工程（契约冻结 / 迁移指南 / 真实环境矩阵 / `@v1`） | P0-P1 | 已授权，待 M49 后分批规划（台账见 [release-1.0-readiness.md](../design/governance/release-1.0-readiness.md)） |

> **本路线图定位**：按 [规划规范 §2.1](../standards/planning.md) 仅维护阶段概览（目标 / 优先级 / 状态）。详细实施记录 / commit 引用 / 关键决策 / 经验教训见对应归档段（详见下方"## 详细任务"索引）。

> **M0 - M38 阶段详情已迁出**：见 [archive/roadmap-phases-m0-m38.md](archive/roadmap-phases-m0-m38.md)（2026-10-15 M44.4 批次③ 迁出；主文档保留概述表与最近阶段）。

> **M39-M48 阶段详情已迁出**：见 [archive/roadmap-phases-m39-m48.md](archive/roadmap-phases-m39-m48.md)（2026-10-26 文档治理批次迁出；主文档保留里程碑概述表与当前阶段 M49）。

## M49: 0.6.0 发版清障（2026-10-25 用户决策 / 进行中）

2026-10-25 发布评估：0.5.0（2026-09-18）后累计 805 commits（132 feat / 85 fix / 2 类 breaking〔3 commits〕），`release:plan` 推导全包 minor → 目标 **0.6.0**；但存在 4 类「带着发不体面」的问题：2 条自产 code scanning 告警（`js/incomplete-sanitization` / `js/polynomial-redos`）、依赖审计门禁（M49.3 前）仍为信号级（`|| true`）且周回归连续 4 周红、critical / high 依赖漏洞未清零、4 处用户可见文档漂移。本阶段目标 = **清障 → 发布 0.6.0 → 发布后验证**。

**授权与归属**：M49 为用户 2026-10-25 决策的独立阶段（非插队）；M49.1 / 2a / 2b 属 [规划规范 §3.1](../standards/planning.md#_3-1-新需求默认走-评估-→-backlog-原则-hard-requirement) 例外清单第 1 / 2 类，M49.3 / 4 / 5 属清单外经用户明确授权。**§3.4 交叉核验 0 项重复评估**（todo-archive 扫描 + `git log -- <路径>` + 代码 anchor：2 条 code scanning / `test.yml:46` `|| true` / `audit.ignore` 2 条 / `quick-start.md:189` 过期输入名）。

**6 原子条目**（🛡️ 4 + 📚 1 + 🚀 1；🎨 / 🧪 缺口显式标注：发版窗口不引入 UX 新面，🎨 由 E 阶段承担；测试随条目内嵌）：

- **M49.1** [P0 🛡️] 自产 code-scanning 告警清零
- **M49.2a** [P0 🛡️] 依赖漏洞清零 A：critical / high（直接依赖 / overrides）
- **M49.2b** [P0 🛡️] 依赖漏洞清零 B：platform 链 moderate 收口
- **M49.3** [P0 🛡️] Security 门禁转正（prod 阻断 + 全量信号；周回归转绿）
- **M49.4** [P0 📚] 发版面文档漂移收口
- **M49.5** [P0 🚀] 0.6.0 版本提升、发布与发布后验证

**阶段基线工作量（§3.1.1 分母）**：6 条目区间和 **10-16 commits / 28-41 文件 / 1400-2430 行**（区间和口径；M48 实测倍率提示实际可能上浮 2-4 倍）。

**建议顺序**：M49.1 → M49.2a → M49.2b → M49.4 → M49.3 → M49.5。M49.3 改为**先翻转、后取证**——翻转后连续 3 次 `master` push 的 prod 阻断步骤 `conclusion=success` 且日志含审计结果行，回填为转正证据；回填前不闭环，任一 run 失败则回退 `|| true` 或按 §5.7 评估；M49.5 最后执行。

**范围边界（不做什么）**：不启用自动发布（1.0 后）；不打 `@v1`（G 批次）；不做 en-US 全量平价（F2）；不为清零强行跨大版本依赖升级。

**安全策略（2026-10-25 用户决策）**：Security Auto Fix 定时任务保持停用（dependfix 自身创建修复 PR，避免冲突）；本仓库改由 **Security 门禁**承担——Dependabot 作发现面、依赖审计作阻断面、code scanning 覆盖代码质量。详见 [release-1.0-readiness.md §6](../design/governance/release-1.0-readiness.md#_6-安全策略-2026-10-25-用户决策)。

**后续（已授权，待规划）**：1.0 发布门槛收口（E → F1 → F2 → G 四批），台账见 [release-1.0-readiness.md](../design/governance/release-1.0-readiness.md)；真实环境验证所需凭据 / staging / AI 预算由用户提供。

> 详细任务与 8 要素见 [todo.md §M49](todo.md#m49-0-6-0-发版清障-2026-10-25-用户决策)；上一阶段（M48）见 [M48 分片](archive/todo-archive-phases-m48.md#m48-对外-pr-交付闭环-2026-10-24-用户决策-d-e-2026-10-25-归档)。

---

## 详细任务

- 当前阶段任务：**M49：0.6.0 发版清障**（2026-10-25 用户决策；六原子见 [todo.md §M49](todo.md#m49-0-6-0-发版清障-2026-10-25-用户决策)）
- 已归档阶段：[todo-archive.md](todo-archive.md)（阶段索引 + 分片；M0-M48 全部已归档；分片治理见 [archive/index.md](archive/index.md)）
- 下一阶段（已授权，待规划）：**1.0 发布门槛收口**（E → F1 → F2 → G 四批；台账见 [release-1.0-readiness.md](../design/governance/release-1.0-readiness.md)；E 通知可信度 4 项为第一批）
- 后续阶段任务（延期项 + 未排期增强候选）：[backlog.md](backlog.md)

## 交付原则

- 每个里程碑必须通过 lint + typecheck + build + test 质量门
- 里程碑交付前需经过 code-reviewer 技能审查
- 剩余风险必须在交付说明中清晰记录
