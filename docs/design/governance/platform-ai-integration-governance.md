# 平台 AI 研判集成 分片：安全治理与验收记录（platform-ai-integration.md §8-§13）

> 本分片自 [platform-ai-integration.md](./platform-ai-integration.md) 按连续尾部章节迁出（章节编号全局唯一、跨文件稳定）；文中 `§N` 除显式标注文件路径者外，均指本分片或主文档的同名章节。

## 8. 安全性与治理

### 8.1 AI API Key 加密

- 复用现有 `ENCRYPTION_KEY`（平台级密钥，与 GitHub PAT 凭据同源）
- AES-256-GCM 加密（与 `Credential.encryptedToken` 一致）
- 仅在 `runScanInternal` 内存中解密，用后即弃
- 日志 / 错误信息脱敏（`maskSecrets` 工具）

### 8.2 AI 输出安全门

沿用 [architecture.md §AI 研判误判处理](./architecture-platform.md)：

- AI 输出必须通过 `install` / `lint` / `build` / `typecheck` / `test`（现有 verification 阶段）
- PR 不自动合并（与 [standards/index.md](../../standards/index.md) 一致）
- 置信度低于阈值仅输出建议（safety-gate.ts 已实施）
- limit patch 范围（防止大范围破坏性改动）

### 8.3 审计

- ScanRun 实体新增 `aiConfigSnapshot` 列（JSON），记录本次扫描实际使用的 AI 配置（脱敏 apiKey）
- aiUsage 数据持久化（保留在 run-result.summary 中，便于 run-history 视图聚合）
- 操作日志（AuditEvent）记录 PATCH / POST ai-config 端点的写操作

### 8.4 凭据最小化

- AI Key 仅传给 engine 层（不写入前端响应）
- 日志 / 错误响应 maskSecrets
- API 测试端点（`/api/e2e/fixtures`）不允许访问 ai-config

## 9. 验收标准

### 9.1 P0 落地验收

- Organization 创建 + API Key 配置 + 加密落库 + 解密读取链路跑通
- 单仓库 aiEnabled=true 时扫描触发 AI 研判（实际调用 deepseek API）
- 单仓库 aiEnabled=false 时扫描不触发 AI 研判（即使 Organization 配置了 Key）
- 运行时 override（aiEnabled / aiTrigger）按合并优先级生效
- ScanRun.aiConfigSnapshot 字段记录实际配置
- 三执行器（container / sandbox / github-action）一致透传 ai 字段
- 4 个 API 端点通过 contract test
- 数据库 migration（同步 + 增量）跑通

### 9.2 P1 增强验收

- Organization AI 配置 UI 完成（4 个表单字段 + Key 输入 + 测试连接）
- 仓库 AI 配置 UI 完成（开关 + trigger）
- 扫描对话框 AI override 面板完成
- RunDetailDialog AI 用量展示完成
- alerts 视图 AI 评估列完成
- zh-CN + en-US i18n 完成（`ai.*` 命名空间）

### 9.3 治理验收

- AI Key 加密（参考 Credential 凭据治理 audit）
- 审计日志（AuditEvent）记录
- maskSecrets 在 logs / error 响应中验证
- PR 不自动合并（依赖 verification 阶段保证）
- 文档同步更新（architecture.md / standards/index.md）

## 10. 上收触发条件（何时纳入 [todo.md](../../plan/todo.md) 当前阶段）

任一条件触发时，从 backlog 上收到 todo.md §当前阶段：

1. 用户实测反馈需要管理平台触发 AI 研判（典型场景：组织内多人协作希望统一管理 Key）
2. 公开部署（docker 一键部署）后用户配置 AI 研判门槛太高（CLI 用户少，希望面板化）
3. M7.2 平台能力深化阶段（后续阶段候选，阶段编号待用户决策分配）启动时
4. 与告警视图增强（C66，已 M23.3 闭环）联动评估
5. 用户明确触发上收

## 11. 关键决策回顾

（待用户上收阶段时填充）

- AI Key 挂载层级：Organization + 单仓库开关（vs Repository 级 vs 全局 platform.config vs Credential 复用）
- 三执行器一致性：container / sandbox / github-action 同步补齐（vs 仅 container 先落地）
- API Key 加密策略：与 Credential.encryptedToken 同源 AES-256-GCM（vs 单独加密层）
- 合并优先级：API override > Repository 默认 > Organization 共享（vs Repository 完全 override）
- ScanRun.aiConfigSnapshot 字段：记录实际使用配置便于审计（vs 不记录仅回写 logs）

## 12. 关联文档

- [architecture.md](./architecture-platform.md) — §AI 研判误判处理（治理基线）
- [sandbox-security-governance.md](./sandbox-security-governance.md) — §A 合法包被投毒 / §C 修复 PR 合入后投毒（AI 研判在供应链防护链路的角色）
- [platform-auth-users.md](./platform-auth-users.md) — Organization 实体已落地（M7.1），AI 字段扩展直接基于此
- [platform-scheduled-batch.md](./platform-scheduled-batch.md) — 定时扫描链路，AI 研判可在调度时统一应用
- [standards/index.md](../../standards/index.md) —"AI 研判相关功能默认不自动合并，仅创建分支/PR 待人工审核"
- [experience-archive.md](./experience-archive.md) — 经验沉淀（AI 研判相关条目将持续追加）
- [backlog.md](../../plan/backlog.md) — 候选条目登记
- [roadmap.md](../../plan/roadmap.md) — M7.2 平台能力深化阶段的远期候选

## 13. 文档元数据

- **设计先行稿创建时间**：2026-09-08
- **触发**：用户调研"如何在 apps/platform 中补充 AI 研判"
- **关联阶段**：M25.2a 基础层 + M26.1 应用层 已实施并归档（见 [M26](../../plan/archive/todo-archive-phases-m26.md)）
- **审计依据**：本文档作为 P0 落地的设计依据，未走 A 阶段 audit（与 design docs 治理惯例一致）