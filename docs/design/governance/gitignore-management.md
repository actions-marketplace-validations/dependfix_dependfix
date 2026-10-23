# .gitignore 自动管理

> 在 dependfix 运行结束后，自动确保目标仓库的 `.gitignore` 中忽略 `dependfix-reports/` 目录。

---

## 1. 动机

`writeReport()` 在 workDir 下创建 `./dependfix-reports/`，生成 Markdown + JSON 双格式报告。该目录不在任何 `.gitignore` 规则中，导致目标仓库 `git status` 显示 untracked files，用户可能误提交报告文件。

本设计确保**每次运行结束后，目标仓库的 `.gitignore` 自动包含 `dependfix-reports/`**，且：
- 已存在时不重复写入（幂等）
- 目标仓库不是 git 仓库时静默跳过
- 仅追加不修改已有内容

---

## 2. 设计决策

### 2.1 放置阶段

在 `DependfixApp.run()` 收尾阶段，`writeReport()` 调用之后：

```
run() →
  executeMode()        # 核心修复逻辑
  computeSummary()
  buildRunResult()
  writeReport()        # 写入报告文件
  → ensureGitignore()  # [NEW] 确保 .gitignore 忽略报告目录
  log "Run completed"
```

### 2.2 操作原则

| 原则 | 措施 |
|:-----|:-----|
| **幂等** | 按行匹配 `dependfix-reports/`，已存在则跳过 |
| **不侵入** | 仅追加新行，不修改已有内容 |
| **静默降级** | 非 git 仓库、文件不存在、无写权限 → 静默跳过 |
| **带注释** | 追加时带 `# dependfix` 注释分组，方便用户识别来源 |

### 2.3 不适用场景

- **GitHub Action 运行**：workflow 的工作区是临时的，不会被提交，不需要 `.gitignore`
  - `ensureGitignore()` 仍会执行但无害（临时工作区也可能有 `.gitignore`）
- **dry-run 模式**：报告仍会生成但内容为空标记，`.gitignore` 仍可写入（无害）

---

## 3. 实现

### 3.1 新增方法：`DependfixApp.ensureGitignore()`

```typescript
private ensureGitignore(): void {
    try {
        const gitDir = join(this.workDir, '.git')
        if (!existsSync(gitDir)) return // 非 git 仓库

        const gitignorePath = join(this.workDir, '.gitignore')
        const entry = 'dependfix-reports/'

        let content = ''
        if (existsSync(gitignorePath)) {
            content = readFileSync(gitignorePath, 'utf-8')
        }

        // 幂等检查
        const lines = content.split('\n')
        if (lines.some((l) => l.trim() === entry)) return

        // 追加（末尾无换行时补一个）
        const suffix = content.endsWith('\n') ? '' : '\n'
        const block = `${suffix}# dependfix\n${entry}\n`
        writeFileSync(gitignorePath, content + block, 'utf-8')
    } catch {
        // 静默降级：权限不足、磁盘满等
    }
}
```

### 3.2 自身仓库 `.gitignore`

dependfix 仓库自身的 `.gitignore` 也需要添加 `dependfix-reports/`，避免本地调试时产生 untracked files。

---

## 4. 受影响文件

| 文件 | 改动 |
|:-----|:-----|
| `packages/cli/src/app.ts` | 新增 `ensureGitignore()` 私有方法 + `import { existsSync, readFileSync, writeFileSync } from 'node:fs'`（已存在） + `run()` 中调用 |
| `.gitignore` | 追加 `dependfix-reports/` 条目 |

---

## 5. 遗留风险

| 风险 | 级别 | 说明 |
|:-----|:-----|:-----|
| 用户手删 `.gitignore` 中的条目，下次运行又加回来 | 低 | 符合预期行为 |
| monorepo 子目录也有 `.gitignore` 但不是 git 根目录 | 低 | 只检查 `.git` 是否存在，即只在仓库根写入 |
| `.gitignore` 使用复杂 glob 规则 | 无 | 仅追加简单文本，不影响已有规则 |

---

## 6. 验证要点

- [ ] `workDir` 是 git 仓库 → `.gitignore` 新增 `dependfix-reports/`
- [ ] `workDir` 不是 git 仓库 → 静默跳过
- [ ] `.gitignore` 已存在 `dependfix-reports/` → 不重复写入
- [ ] `.gitignore` 不存在 → 创建新文件
- [ ] `writeFileSync` 失败 → 静默降级，不抛异常
- [ ] 追加内容前后带换行，不影响已有条目

---

## 7. 安装产物排除（.git/info/exclude）

依赖安装 / 验证会在目标仓库工作区留下 `.pnpm-store/`、`node_modules/`。这些产物**不得进入交付提交**，但落点与报告目录不同：

| 维度 | 报告目录（§1-§6） | 安装产物（本节） |
|:---|:---|:---|
| 落点 | 目标仓库 `.gitignore`（tracked 文件） | 目标仓库 `.git/info/exclude`（本地元数据，不可提交） |
| 理由 | 报告是 dependfix 的长期产物，用户希望在后续 clone 中也忽略 | 安装产物是运行期副产物；改 `.gitignore` 会让排除规则进入 PR，污染交付 |
| 时机 | run 收尾（报告写入之后） | run 开始（安装 / 验证之前） |

**为什么必须在安装之前**：`node_modules` 一旦出现在未被忽略的工作区，交付闸门依赖的「无变更」判定 与 `stageAndCommit()` 的 `git add .` 都会被污染——前者影响交付 / 回滚判断，后者会把依赖树提交进修复分支。run 开始时落盘可覆盖整个运行周期（含多次安装尝试）。

**条目与幂等**：`.pnpm-store/` 与 `node_modules/` 两条；按 §2.2 同一套语义等价归一化判定（`/node_modules`、`node_modules`、`**/node_modules/` 等等价写法视为已存在），并按 git「最后一条匹配规则胜出」处理取反行（`!node_modules` 撤销前面的排除 → 重新追加）；追加时带 `# dependfix：安装产物（不得进入交付提交）` 分组注释，重复执行字节级不变。

**失败可见性**：写入失败返回错误原因，运行日志 warn 后继续（不阻断，但不会静默让依赖树进入提交）；非 git 目录静默跳过。

**模式边界**：仅 `fix` / `fix-and-pr` 且非 `dry-run` 预置；`report-only`（只读扫描）、`cleanup-branches`（不动工作树）与 `dry-run`（不写盘）均不写 `.git/info/exclude`。本节只约束该文件；§1-§6 的报告目录 `.gitignore` 写入属既有行为，不受本节影响。

**边界**：

- 非 git 目录 → 静默跳过；写入失败 → warn 后继续（不阻断运行）；
- 工作树 / 子模块（`.git` 是文件）与仓库子目录统一由 `git rev-parse` 解析到 common dir 的 `info/exclude`；
- 已 tracked 的 `node_modules` 不受 `info/exclude` 影响（git 只对未跟踪路径生效），既有 tracked 文件的提交行为不变；
- **跨文件优先级**：git 中 `.gitignore` 的规则优先于 `info/exclude`，因此目标仓库若在 `.gitignore` 显式写 `!node_modules` 取反，仍可能撤销本节的排除（该形态属仓库显式意图，不覆盖）；本节只保证 `info/exclude` 自身的幂等与取反语义；
- 平台容器形态下 store 本体在 `/app/data/pnpm-store`（数据卷，不在工作区），`info/exclude` 是对「仓库内 store / 依赖目录」的兜底。

**实现落点**：`packages/engine/src/app/git-exclude.ts`（`ensureGitExclude` / `resolveGitDir`），由 `DependfixApp.run()` 在 `executeMode()` 之前调用；git 目录经 `git rev-parse --git-common-dir` 解析（覆盖仓库子目录 / 工作树 / 子模块，不自行解析 `.git` 文件内容）。单测 `git-exclude.test.ts` 覆盖幂等、等价 / 取反写法、子目录与工作树解析、写入失败上报与真实 `git add .` 场景。
