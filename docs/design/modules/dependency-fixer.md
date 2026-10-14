# T105 设计稿：依赖升级修复器

> 对应任务: [T105 实现依赖升级修复器](../../plan/todo-archive.md)
>
> **依赖**: T003（工具链模型）已完成，T104（过滤引擎）已完成
>
> **选型结论**: 直接修改 `package.json` 中目标包的版本号 + 执行 `pnpm install --no-frozen-lockfile` 更新 lockfile。不使用 `pnpm update`（它基于当前 range 更新，不适合精确版本定位）。升级前后备份关键文件，失败自动回滚。

---

## 1. 设计目标

- 对已过滤出的可修复告警执行单包精确版本升级
- 输出标准化修复结果（`fromVersion` / `toVersion` / `isMajor` / `success`）
- 升级失败（`pnpm install` 退出码非 0）时自动回滚 `package.json` 和 `pnpm-lock.yaml`
- 不在此层判断升级后的 lint/build/typecheck/test 是否通过（由 T107 验证执行器负责）
- 纯函数设计（以 `workDir` 为工作目录，不硬编码路径）

---

## 2. 升级策略

### 2.1 选型对比

| 方案 | 描述 | 优点 | 缺点 | M1 采用 |
|------|------|------|------|:---:|
| `pnpm update <pkg>@<version>` | 让 pnpm 处理 | 简单 | 基于现有 range 更新，不会将 `^4.17.20` 精确掰到 `4.17.21` | ❌ |
| 直接改 `package.json` + `pnpm install` | 手动改版本号，再跑安装 | 完全控制目标版本，设为精确值 | 需解析/修改 JSON；需处理不同 save 类型 | ✅ |

### 2.2 执行流程

```
1. 读取 package.json
2. 查找目标包在哪个依赖组（dependencies / devDependencies / optionalDependencies）
3. 记录当前版本（fromVersion）
4. 备份 package.json + pnpm-lock.yaml（写入同一目录的 .bak 后缀）
5. 修改依赖组中的版本号为精确目标版本（如 "4.17.21"）
6. 写入 package.json
7. 执行 pnpm install --no-frozen-lockfile
       ├── 成功（exit code 0）→ 返回 DependencyFixResult { success: true }
       └── 失败（exit code ≠ 0）→ 回滚: 还原备份 → 返回 { success: false, error }
```

### 2.3 为什么使用 `--no-frozen-lockfile`

`pnpm install` 默认行为等同于 `--frozen-lockfile`（如果 lockfile 存在则不允许变更）。修改 `package.json` 后 lockfile 必然变化，必须显式 `--no-frozen-lockfile` 允许 lockfile 重生成。

---

## 3. 核心接口设计

### 3.1 函数签名

```typescript
// packages/cli/src/fixers/dependency/index.ts

export interface UpgradeDependencyParams {
    /** 包名（如 'lodash', '@babel/traverse'） */
    packageName: string
    /** 目标精确版本（如 '4.17.21'） */
    targetVersion: string
    /** 工作目录（包含 package.json 和 pnpm-lock.yaml） */
    workDir: string
}

/**
 * 单包升级结果。
 * 调用方根据 `success` 决定是否继续后续修复或进入验证。
 */
export interface DependencyFixResult {
    /** 包名 */
    packageName: string
    /** 升级前版本（从 package.json 读取，保留原始 range 格式） */
    fromVersion: string
    /** 升级后版本（精确版本号） */
    toVersion: string
    /** 是否为 major 升级（主版本号发生变化） */
    isMajor: boolean
    /** 升级是否成功 */
    success: boolean
    /** 失败原因（仅 success=false 时有值） */
    error?: string
}

/**
 * 升级单个依赖到指定版本。
 *
 * - 在 workDir 中查找 `package.json` 并修改目标包的版本为精确值
 * - 执行 `pnpm install --no-frozen-lockfile` 更新 lockfile
 * - 失败时自动回滚 package.json 和 pnpm-lock.yaml
 * - 不执行任何验证（lint/build/typecheck/test），由 T107 负责
 *
 * @param params - 包名、目标版本、工作目录
 * @returns 修复结果
 *
 * @example
 * ```typescript
 * const result = await upgradeDependency({
 *     packageName: 'lodash',
 *     targetVersion: '4.17.21',
 *     workDir: '/path/to/repo',
 * })
 * // result = { packageName: 'lodash', fromVersion: '^4.17.20', toVersion: '^4.17.21', isMajor: false, success: true }
 * ```
 */
export async function upgradeDependency(
    params: UpgradeDependencyParams,
): Promise<DependencyFixResult>
```

### 3.2 内部 Helper

```typescript
// ---- 版本查找 ----

/**
 * 在 package.json 的 dependencies/devDependencies/optionalDependencies 中查找包。
 * 返回依赖组名称和当前声明的版本号。
 */
function findDependencyVersion(
    pkg: PackageJson,
    packageName: string,
): { group: 'dependencies' | 'devDependencies' | 'optionalDependencies'; version: string } | null

// ---- 版本解析 ----

/**
 * 从版本字符串提取主版本号。
 * 去除 range 前缀（^ ~ >= <= > < =）后解析。
 *
 * @example
 * parseMajorVersion('^4.17.20')   // → 4
 * parseMajorVersion('~2.0.0')     // → 2
 * parseMajorVersion('>=1.0.0 <2') // → 1
 * parseMajorVersion('3.0.0')      // → 3
 * parseMajorVersion('*')          // → -1
 */
function parseMajorVersion(version: string): number

// ---- 磁盘操作 ----

function readPackageJson(workDir: string): PackageJson
function writePackageJson(workDir: string, pkg: PackageJson): void
function backupFiles(workDir: string, files: string[]): void
function restoreBackups(workDir: string, files: string[]): void
```

### 3.3 与 T104（过滤引擎）的接口约定

T104 过滤引擎输出 `NormalizedSecurityAlert[]`，其中包含：
- `fixable: true` — 确保有可升级版本
- `fixStrategy: 'upgrade'` — 修复策略为升级
- `recommendedVersion: '4.17.21'` — 目标精确版本

T105 消费：
```
NormalizedSecurityAlert.packageName      ──► UpgradeDependencyParams.packageName
NormalizedSecurityAlert.recommendedVersion ─► UpgradeDependencyParams.targetVersion
NormalizedSecurityAlert.manifestPath        ─► 确定 workDir（分包路径）
```

---

## 4. 回滚策略

### 4.1 机制

| 步骤 | 文件 | 备份命名 |
|------|------|---------|
| 升级前 | `{workDir}/package.json` | `{workDir}/package.json.bak` |
| 升级前 | `{workDir}/pnpm-lock.yaml` | `{workDir}/pnpm-lock.yaml.bak` |

备份文件写入 `workDir` 同一目录，失败回滚时以此还原。

### 4.2 回滚触发条件

| 场景 | 行为 |
|------|------|
| `pnpm install` 退出码 ≠ 0 | 还原备份 → 返回 `{ success: false, error: 'pnpm install failed: <stderr>' }` |
| `package.json` 读取失败 | 不备份、不改写 → 返回 `{ success: false, error: 'package.json not found' }` |
| 目标包不在 `package.json` 中 | 不备份、不改写 → 返回 `{ success: false, error: 'package <name> not found in dependencies' }` |
| 备份写入失败 | 中止操作 → 返回 `{ success: false, error: 'failed to backup' }` |
| 回滚还原失败 | 记录严重警告日志 → 返回 `{ success: false, error: 'rollback failed, manual recovery required' }` |

### 4.3 清理

- 成功：删除 `.bak` 文件（可选，M1 不强制清理，后续 run 会自动覆盖）
- 失败：`.bak` 文件保留，供人工排查

### 4.4 为什么不用 git

M1 不在工作目录执行 `git stash` / `git checkout`：
- 依赖修复可能在工作副本（clone 后的临时目录），不一定有 git 历史
- 文件级备份更轻量、更快，不依赖外部工具

---

## 5. 版本号判定逻辑

### 5.1 查找依赖组

按以下顺序搜索，返回第一个匹配的：

```
1. dependencies
2. devDependencies
3. optionalDependencies
```

若 package 同时出现在多个组中（如 dependencies 和 devDependencies），只更新第一个匹配的组。

### 5.2 `fromVersion` 取值

保留 `package.json` 中的原始版本声明：

```json
{ "dependencies": { "lodash": "^4.17.20" } }
```
→ `fromVersion: "^4.17.20"`

**设计理由**: 调用方（T108 报告生成器）需要向用户展示"原来声明了什么"和"改成了什么"，而非显示某种解析后的值。

### 5.3 `isMajor` 判定

```
parseMajorVersion(fromVersion) !== parseMajorVersion(toVersion)  →  isMajor: true
parseMajorVersion(fromVersion) === parseMajorVersion(toVersion)  →  isMajor: false
parseMajorVersion === -1（无法解析）                             →  isMajor: false（保守）
```

解析策略：

```
1. 去除版本前缀正则: /^[\^~]?\s*/
2. 尝试匹配第一个 semver 段: /^(\d+)\.\d+\.\d+/
3. 若匹配到 → 返回 parseInt(组1)
4. 否则返回 -1
```

**不引入 `semver` 包**：二分法的简单正则已满足 M1 需求。M5（AI 研判）若需要完整 semver 比较再引入。

### 5.4 `toVersion` 取值

**保留原始版本声明的前缀策略**，而非强制设为精确版本。

| 原始声明 | 升级后 | 说明 |
|---------|--------|------|
| `^4.17.20` | `^4.17.21` | 保留 caret（允许 4.x 更新） |
| `~4.17.0` | `~4.17.21` | 保留 tilde（允许 4.17.x patch） |
| `4.17.20` | `4.17.21` | 原为精确版本，保留精确 |
| `>=1.0.0 <2.0.0` | `^4.17.21` | 复杂 range → 降级为 caret |
| `*` / `latest` | `^4.17.21` | 无明确策略 → 默认 caret |

**前缀提取算法**：
```
1. 若原始版本以 ^ 开头 → 目标版本 = "^" + targetVersion
2. 若原始版本以 ~ 开头 → 目标版本 = "~" + targetVersion
3. 若原始版本是精确 semver（不含 ^~<>=*） → 目标版本 = targetVersion
4. 其他（复杂 range / * / latest / URL） → 目标版本 = "^" + targetVersion
```

**设计理由**：
- 工具只负责修复漏洞，不应改变用户的版本策略
- `^4.17.21` 范围内的任何 semver 兼容版本都包含安全修复
- 如果用户故意用精确版本（如 `4.17.20`），说明他不想要自动升级，保留精确

---

## 分片索引（迁出章节）

| 分片 | 章节范围 | 主题 |
|:--|:--|:--|
| [dependency-fixer-records.md](./dependency-fixer-records.md) | §6 - §12 | 增量与批量口径 / 错误分类 / 测试策略 / 实现文件清单 / 数据流 / 非目标 / 设计演进记录 |
