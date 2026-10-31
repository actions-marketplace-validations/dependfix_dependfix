# C22 PAT 无感升级评估 分片：时间盒、决策回顾与改动清单（c22-pat-backward-compat.md §7-§8 + 附录 A）

> 本分片自 [c22-pat-backward-compat.md](./c22-pat-backward-compat.md) 按连续尾部章节迁出（章节编号全局唯一、跨文件稳定）；文中 `§N` 除显式标注文件路径者外，均指本分片或主文档的同名章节。

## 7. 时间盒预估（M18.1 实施工作量）

| 子任务 | 工作量预估 | 备注 |
|:---|:---:|:---|
| §4.1 新建 `packages/engine/src/auth/` 目录 | 30 分钟 | 6 文件骨架（不含测试）|
| §4.2 AuthProvider 接口设计 | 1 小时 | 含类型契约与 JSDoc |
| §4.3 createGitHubClient 签名变更 | 1 小时 | 含向后兼容包装 + 类型扩展 |
| §4.4 测试 helper 抽取 | 30 分钟 | `createTestPatAuth()` |
| §4.5 6 生产调用点改造 | 1 小时 | 同模式批量 + `@dependfix/engine/auth` 子路径导出 |
| §4.6 3 mock 测试改造 | 30 分钟 | mock 边界保持在 createGitHubClient 层 |
| §4.5 + §4.6 + JSDoc 同步总测试改造 | 1.5 小时 | 8 测试文件 |
| pat-provider 实施 + 单测 | 1 小时 | 简单包装，主要是测试覆盖 |
| app-provider 实施 + 单测（M18.1 主实施）| 3 小时 | JWT signing + getInstallationOctokit + 公钥指纹校验 |
| installation-token-cache 实施 + 单测（M18.1）| 2 小时 | 1h 滑窗 + 5min 提前刷新 + 失败重试 |
| 3 commits + A 阶段 audit | 1 小时 | 1 standard depth × 2 + 1 quick depth |
| **总计** | **~12 小时 / 1.5 工作日** | — |

注：原 M18 P 阶段估算"~11 commits"为阶段总投入预估；本评估报告聚焦 M18.1 单一子阶段，故时间盒包含 M18.1 全部实施内容（commit 1 + commit 2 + commit 3）。

## 8. 关键决策回顾（2026-08-29）

1. **方案选择 B（AuthProvider 注入）**：与 M18.1 C22.1 基础层天然对齐；长期单一入口；测试改造 helper 抽取降低重复
2. **PAT 路径保留硬编码 commit author**：用户决策 PAT 路径行为零变化（`getCommitAuthor()` 返回 `{ name: 'dependfix[bot]', email: 'dependfix[bot]@users.noreply.github.com' }`）
3. **fixtures 仅 mock**（决策 C）：用户接受风险；缓解措施 = 单测聚焦库 mock 输出契约 + changelog 监控 + 版本钉定
4. **deprecated 包装保留 1 个版本周期**：M18.1 实施后标记 `@deprecated`；M19+ 评估是否移除
5. **commit 拆分**：commit 1（AuthProvider 抽象层 8 文件）+ commit 2（6 生产 + 5 直接调用测试 = 11 文件，超 10 阈值需 audit standard depth）+ commit 3（App provider + cache = 4 文件）—— 避开 M17.4 单批 >10 文件教训

## 附录 A：精确改动清单

### A.1 新增文件（9 个）

```
packages/engine/src/auth/auth-provider.ts                          # AuthProvider 接口 + fromPat/fromApp
packages/engine/src/auth/pat-provider.ts                           # PatAuthProvider 实现
packages/engine/src/auth/app-provider.ts                           # AppAuthProvider 实现（M18.1 主实施）
packages/engine/src/auth/installation-token-cache.ts               # 缓存层（M18.1）
packages/engine/src/auth/auth-provider.test.ts                     # 接口契约单测
packages/engine/src/auth/pat-provider.test.ts                      # PAT provider 单测
packages/engine/src/auth/app-provider.test.ts                      # App provider 单测（M18.1）
packages/engine/src/auth/installation-token-cache.test.ts          # 缓存层单测（M18.1）
packages/engine/src/github/__tests__/test-auth.ts                  # 测试 helper（createTestPatAuth）
```

### A.2 修改文件（14 个）

```
# 生产代码（6）
packages/engine/src/app/repo-alerts.ts                                        # 行 117
packages/engine/src/app/index.ts                                              # 行 696
apps/platform/server/services/executor/container-executor.ts                  # 行 139
packages/mcp/src/tools/discover-repos.ts                                      # 行 39
packages/mcp/src/tools/fetch-alerts.ts                                        # 行 40
packages/mcp/src/tools/cleanup-branches.ts                                    # 行 44

# 测试文件（5 直接调用 + 3 mock）
packages/engine/src/github/client.test.ts                                     # 11 处
packages/engine/src/github/dependabot-fetcher.test.ts                         # 行 14
packages/engine/src/github/code-scanning-fetcher.test.ts                      # 行 11
packages/engine/src/github/code-quality-fetcher.test.ts                       # 行 11
packages/engine/src/github/repository-discovery.test.ts                       # 行 10
packages/mcp/src/tools/discover-repos.test.ts                                 # mock 调整
packages/mcp/src/tools/cleanup-branches.test.ts                               # mock 调整
apps/platform/server/services/executor/container-executor-pr.test.ts          # mock + toHaveBeenCalledWith 调整（行 86 + 行 136）

# 类型定义 + JSDoc 同步（3）
packages/engine/src/github/client.ts                                          # OctokitClientOptions 接口 + 函数签名 + JSDoc 行 45
packages/engine/src/github/dependabot-fetcher.ts                              # JSDoc 行 48
packages/engine/package.json                                                  # exports 字段声明 '@dependfix/engine/auth' 子路径
```

### A.3 不变更文件（已有占位）

```
apps/platform/server/entities/credential.ts                  # Credential.type 已枚举 'github-app'（行 17）；M18.1 仅扩展字段
apps/platform/server/schemas/credential.ts                   # credentialSchema 已允许 type='github-app'（行 6）；M18.1 仅扩展字段
packages/engine/src/github/token-scope.ts                    # 已有 best-effort scope 警告；M18.1 扩展 App installation token 探测
packages/engine/src/github/pr-creator.ts                     # 行 60-61 BOT_NAME/BOT_EMAIL 硬编码；M18.2 改造为动态
```

---

**报告版本**：v1（2026-08-29 M18.0 P0 docs only 评估子阶段产出）

**下一步**：M18.1 D 阶段按本报告 §4 落地步骤实施（预计 1.5 工作日 / 3 commits + 1 standard depth + 1 quick depth audit）