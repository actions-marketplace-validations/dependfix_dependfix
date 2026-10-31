# pnpm lockfile 修复器 设计分片：报告、测试与落地明细（pnpm-lockfile-fixer.md §7-§11）

> 本分片自 [pnpm-lockfile-fixer.md](./pnpm-lockfile-fixer.md) 按连续尾部章节迁出（章节编号全局唯一、跨文件稳定）；文中 `§N` 除显式标注文件路径者外，均指本分片或主文档的同名章节。

## 7. Lockfile Diff 报告

### 7.1 计算方式

```
修复前: 读取备份 .bak → 统计行数 + 解析包数量
修复后: 读取新的 pnpm-lock.yaml → 统计行数 + 解析包数量
diff: 行数差、包数量差
```

### 7.2 简化实现

不实现完整 YAML diff（成本过高）。使用以下方式：

- **行数变化**：`wc -l` 等价
- **包数量变化**：grep YAML 中的包条目键
- **摘要**：生成一句话描述，如 `"lockfile updated: +15/-3 lines, 2 packages changed"`

### 7.3 按策略调整粒度

| Strategy | Diff 期望 |
|---|---|
| `REGENERATE` | 中等变化（根据 manifest 重新生成） |
| `FIX_ENTRIES` | 小变化（仅修复损坏条目） |
| `REINSTALL` | 可能大变化（全量重解析） |

---

## 8. 测试策略

### 8.1 单元测试（Vitest，mock 子进程）

| 场景 | 待测点 |
|---|---|
| classifyLockfileFailure - LOCKFILE_NOT_FOUND | mock stderr 返回 `"Cannot find"` 关键词 |
| classifyLockfileFailure - MANIFEST_MISMATCH | mock stderr 返回 `"ERR_PNPM_OUTDATED_LOCKFILE"` |
| classifyLockfileFailure - VERSION_MISMATCH | mock stderr 返回 lockfileVersion 不兼容信息 |
| classifyLockfileFailure - CORRUPTED | mock stderr 返回 `"broken"` 关键词 |
| classifyLockfileFailure - CREDENTIAL | mock stderr 返回 `"E401"` 关键词 |
| classifyLockfileFailure - UNKNOWN | mock stderr 返回不匹配任何关键词的随机错误 |
| classifyLockfileFailure - ENVIRONMENT_ERROR | mock 无 stderr（进程被信号杀死 / 超时 / 静默非零退出）→ 归环境性 + 保留 exitCode / signal / timedOut |
| classifyLockfileFailure - ok | mock exitCode=0 |
| repairLockfile - LOCKFILE_NOT_FOUND → REGENERATE | mock chain: 失败 → REGENERATE 成功 → 验证通过 |
| repairLockfile - MANIFEST_MISMATCH → REGENERATE | mock chain: 失败 → REGENERATE 成功 → 验证通过 |
| repairLockfile - CREDENTIAL_ERROR → SKIP | mock 失败，分类为 CREDENTIAL → 直接返回 SKIP |
| repairLockfile - REGENERATE 失败 → REINSTALL | mock REGENERATE 失败 → REINSTALL 成功 |
| repairLockfile - 所有策略都失败 | mock 全部策略失败，验证 attempts 记录完整 |
| repairLockfile - 回滚 | mock REGENERATE 失败 + REINSTALL 失败，确认 .bak 已还原且清理 |
| computeLockfileDiff | 在临时目录创建前后 lockfile，计算 diff |
| resolvePnpmVersion - packageManager | mock package.json 含 `"packageManager": "pnpm@10.5.2"` |
| resolvePnpmVersion - toolchain 优先 | toolchain.pnpmVersion 覆盖 packageManager |
| resolvePnpmVersion - 无声明 | 既无 packageManager 也无 toolchain，返回 null |
| createPnpmLockfileFixerDescriptor | 确认返回 stub descriptor 兼容 app.ts |

### 8.2 集成测试（真实 pnpm，临时目录）

| 场景 | 描述 |
|---|---|
| lockfile 缺失修复 | 删除 `pnpm-lock.yaml` → repairLockfile → 验证生成 |
| manifest 不一致修复 | 修改 package.json 版本 → repairLockfile → 验证一致性 |
| 修复后 frozen-lockfile 通过 | repairLockfile 后 `pnpm i --frozen-lockfile` 成功 |
| 修复后 diff 非空 | 验证 LockfileDiff 有合理变化 |

### 8.3 测试依赖

- `vitest`（已有）
- `node:child_process` mock（`vi.mock`）
- `node:fs` 临时目录操作（`fs.mkdtempSync` / `fs.rmSync`）

---

## 9. 实现文件清单

| 文件 | 说明 |
|---|---|
| `packages/cli/src/fixers/pnpm/index.ts` | 主实现：`repairLockfile`、分类、策略、diff |
| `packages/cli/src/fixers/pnpm/index.test.ts` | 完整测试 |
| `packages/cli/src/fixers/pnpm/types.ts` | 类型定义（按需，可能 inline 在 index.ts） |

现有文件修改（可选）：
- `packages/cli/src/app.ts` — 如果 descriptor 签名变化
- `packages/cli/src/index.ts` — 如果新增导出

---

## 10. 数据流

```
输入: repairLockfile({ workDir, toolchain? })
  │
  ├─ 1. 备份 pnpm-lock.yaml → *.bak
  │
  ├─ 2. 诊断: pnpm i --frozen-lockfile
  │     ├─ 成功 → 返回 { success: true, diff: null }
  │     └─ 失败 → classifyLockfileFailure(stderr) → category
  │
  ├─ 3. 按 category 选择首发策略
  │     ├─ CREDENTIAL_ERROR → SKIP, 直接返回
  │     └─ 其他 → 执行策略命令
  │
  ├─ 4. 逐级尝试 (escalating)
  │     ├─ Strategy N 执行成功 → 记录 attempt
  │     ├─ 验证: pnpm i --frozen-lockfile
  │     │   ├─ 通过 → computeLockfileDiff → 返回 success
  │     │   └─ 失败 → 下一个策略
  │     └─ 所有策略失败 → 回滚, 返回 failure
  │
  └─ 5. cleanup: 删除 .bak
```

---

## 11. 非目标 (Non-Goals)

- **不处理 npm / yarn**：当前仅支持 pnpm
- **不自动启用 corepack**：corepack 开关属于仓库基础设施层面
- **不修改 package.json**：仅修复 lockfile，不改 manifest
- **不实现完整 YAML diff**：仅统计行数和包数量变化
- **不做跨仓库锁版本管理**：不维护全局 pnpm 版本策略
- **不处理 `node_modules`**：优先使用 `--lockfile-only` 避免安装
