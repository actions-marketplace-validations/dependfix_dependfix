# 依赖升级修复器 设计分片：运行口径与演进记录（dependency-fixer.md §6-§12）

> 本分片自 [dependency-fixer.md](./dependency-fixer.md) 按连续尾部章节迁出（章节编号全局唯一、跨文件稳定）；文中 `§N` 除显式标注文件路径者外，均指本分片或主文档的同名章节。

## 6. 增量修复 vs 批量修复

### 6.1 M1 策略：增量修复

每个包单独调用 `upgradeDependency()` 一次：

```
for (const alert of fixableAlerts) {
    const result = await upgradeDependency({
        packageName: alert.packageName,
        targetVersion: alert.recommendedVersion,
        workDir,
    })
    results.push(result)
    if (!result.success) break // 一个失败则停止（调用方可配置）
}
```

### 6.2 设计理由

| 维度 | 增量修复 | 批量修复 |
|------|---------|---------|
| 失败隔离 | 单个包失败不影响其他包的结果 | 一个失败需全部回滚或跳过 |
| 回滚粒度 | 单包回滚（1 个文件 diff） | 全量回滚成本高 |
| 故障定位 | 直接知道哪个包出问题 | 需要逐一排查 |
| M1 适用性 | ✅ M1 单仓库告警量通常 < 100，逐个处理可接受 | ❌ 复杂度不划算 |

调用方（T109 CLI 编排器）负责策略选择。本模块只提供单次升级能力，不内置循环。

---

## 7. 错误分类

| 错误码常量 | 场景 | 是否可恢复 |
|-----------|------|:---:|
| `PACKAGE_NOT_FOUND` | 目标包不在 `package.json` 的任何依赖组中 | 是（跳过此包） |
| `PNPM_INSTALL_FAILED` | `pnpm install` 退出码 ≠ 0 | 否（回滚后停止） |
| `BACKUP_FAILED` | 备份文件写入失败 | 否（无法回滚，停止） |
| `ROLLBACK_FAILED` | 回滚文件还原失败 | 否（需人工介入） |
| `IO_ERROR` | 读取/写入 `package.json` 失败 | 否 |

所有错误通过 `AppError` 抛出，`code` 使用上述枚举值。

---

## 8. 测试策略

### 8.1 单元测试（`packages/cli/src/fixers/dependency/index.test.ts`）

| # | 场景 | 验证 |
|---|------|------|
| 1 | 正常升级 dependencies 中的包 | `success: true`, `fromVersion` 正确, `toVersion` 为精确值, `package.json` 已更新 |
| 2 | 正常升级 devDependencies 中的包 | `fromVersion` 来自 `devDependencies` |
| 3 | 正常升级 optionalDependencies 中的包 | `fromVersion` 来自 `optionalDependencies` |
| 4 | major 升级检测（`^4.x` → `5.0.0`） | `isMajor: true` |
| 5 | minor 升级检测（`^4.17.0` → `4.19.1`） | `isMajor: false` |
| 6 | 包不在任何依赖组中 | `success: false`, `error` 包含 `PACKAGE_NOT_FOUND` |
| 7 | `pnpm install` 失败 | 回滚 → `package.json` 恢复原值, `success: false` |
| 8 | 工作目录无 `package.json` | `success: false`, `error` 包含路径信息 |
| 9 | scoped 包名正常升级 | `packageName: '@babel/traverse'`, 依赖组查找正确 |
| 10 | 版本号前缀 `~` `>=` `<` 正常解析 | `parseMajorVersion` 覆盖各前缀格式 |

### 8.2 集成测试（临时项目 Fixtures）

在测试中动态创建最小 pnpm 项目：

```
test-tmp/
├── package.json       # { dependencies: { "lodash": "^4.17.20" } }
├── pnpm-lock.yaml     # 正常 lockfile（需预先生成或 mock）
└── .gitignore
```

测试流程：
1. 写入临时 `package.json` + `pnpm-lock.yaml`
2. 调用 `upgradeDependency({ packageName: 'lodash', targetVersion: '4.17.21', workDir })`
3. 验证 `package.json` 中版本变为 `"4.17.21"`
4. 验证 `pnpm-lock.yaml` 已更新（lodash 版本变化）
5. 清理临时目录

> 依赖：需 `pnpm` 在测试环境可执行。若 CI 环境无 pnpm 二进制，集成测试用 `it.skip()` 跳过。

### 8.3 测试依赖

```json
// 无需新增依赖
// - fs-extra: 已在 deps 中（文件读写）
// - zx: 已在 deps 中（执行 pnpm install）
// - vitest: 已在 devDeps 中
```

---

## 9. 实现文件清单

| 文件 | 说明 |
|------|------|
| `packages/cli/src/fixers/dependency/index.ts` | `upgradeDependency()` + 内部 helpers（替换现有 stub） |
| `packages/cli/src/fixers/dependency/index.test.ts` | 10 个单元测试 |
| `packages/cli/src/fixers/dependency/__fixtures__/` | 临时项目 directory（集成测试动态创建，不需静态文件） |

> 不新增 npm 依赖。所有所需工具已在 `packages/cli/package.json` 中。

---

## 10. 数据流

```
T104 (filter) 过滤后的 NormalizedSecurityAlert[]
    │
    │  fixable=true, fixStrategy='upgrade', recommendedVersion='4.17.21'
    ▼
T105 (upgradeDependency)
    │
    ├── 读取 package.json → 查找目标包 → 获取 fromVersion
    ├── 备份 package.json + pnpm-lock.yaml
    ├── 修改 package.json（精确版本）
    ├── 执行 pnpm install --no-frozen-lockfile
    │       │
    │       ├── 成功 → 清理 → 返回 DependencyFixResult { success: true }
    │       └── 失败 → 回滚 → 返回 DependencyFixResult { success: false, error }
    │
    ▼
T107 (验证执行器)
    │
    │  pnpm install --frozen-lockfile → pnpm lint → pnpm build → pnpm typecheck → pnpm test
    ▼
T108 (报告生成器)
```

---

## 11. 非目标 / 已解决

- ~~不处理 transitive（间接）依赖的升级（M5 AI 研判）~~ → **M2 已实现** `overrideTransitiveDependency()`，通过 pnpm overrides 修复间接依赖
- 不处理 workspace 协议（`workspace:*`）的版本替换
- 不处理 git/file 协议的依赖版本
- ~~不支持 pnpm overrides / pnpm.patchedDependencies~~ → **M2 已实现**，支持 `pnpm-workspace.yaml` 和 `package.json#pnpm.overrides` 双路径
- 不在此层判断升级后是否破坏 lint/build/typecheck/test（T107 负责）
- 不引入 semver 包做完整版本比较
- 不支持跨工作区批量升级（M4 T401）
- 不生成 `pnpm list --json` 做重验证（性能不划算）

---

## 12. 设计演进记录

### 12.1 间接依赖判定：行为反馈优先于 API 字段预判断

- Dependabot API 的 `dependency.relationship` 可能为 `null`，不能作为直接/间接依赖的唯一判定依据
- 做法：try→fallback——先尝试直接升级，失败且错误为"not found in dependencies"时回退 overrides 修复

### 12.2 防护要"精确修复"而非"扩大跳过"

- 根直接依赖 + lockfile 告警的 P0 防护从"整体跳过"演进为：多版本共存 → 版本化 overrides（精确修复）；单版本 → 维持跳过
- 原则：防护降级为"跳过/人工处理"时，应追问"能否精确修复"，而不是扩大跳过范围掩盖真实问题

### 12.3 多版本共存 → 版本化 overrides

- 同一包在 lockfile 共存多个大版本时，单一 `pkg: version` 全局覆盖会误伤根声明
- 做法：对每个脆弱实例生成 `pkg@<major>: ^target`（版本化 key），只影响对应大版本线
- 约束：**只覆盖与 target 同 major 且低于目标的实例**（跨 major 会破坏子工作区且根验证无法覆盖）；同包多告警取 recommendedVersion 最高者；单版本根直接依赖维持 sub
- **既有 overrides 协同**（2026-08-09 复盘 + 2026-10-02 PR #298 修正）：目标与已有同 selector 条目取 max（剥离前缀比较），已有条目不删除、不改写形式；key 判定按**归一化 selector**——pnpm 把 selector 当 semver range 解析，`pkg@1` 与 `pkg@^1` 语义等价，命中已有等价 key 时沿用其原写法，避免同一 selector 并存两种写法（否则会同时写出 `brace-expansion@^1` 与 `brace-expansion@1`）；归一化只收敛裸 major / caret major / major 通配等价类，`~1`、`^1.2`、精确版本等保持区分。

### 12.4 单版本根直接依赖：推荐版本 >= 锁定版本时可安全修复（C10）

- 12.2 的"单版本 → 维持跳过"细化为**按版本关系判定**（2026-08-06）：
  - 推荐版本 >= 锁定版本 → root 可修：直接升级保留前缀不降级；override 回退为**精确版本**（`extractPrefix` 从裸 lockfile 版本取 `''`），精确版本 >= 锁定版本，不降级声明
  - 推荐版本 < 锁定版本 → sub（全局 overrides 会降级声明，run 30929090403 教训不变）
  - lockfile 无版本信息 → sub（无法判断降级风险，保守）
- 语义：以"是否降级声明"为唯一判据，而非一刀切跳过

### 12.5 workspace 成员包直接依赖识别（C11）

- 12.2 的"根直接依赖"判定扩展为"根 + 全部 workspace 成员包"（2026-08-06）：
  - pnpm-workspace.yaml `packages` glob 展开（字面路径 / `dir/*` / `dir/**` / `**`，递归收集子目录；`.` 与排除模式除外）
  - 成员包直接依赖 + 单版本 + 推荐 < 锁定 → sub（修复前会错误走全局 override 降级成员声明）
  - 已知限制：`!` 排除模式未处理（多算 sub，保守方向）；`**` 递归不跟随符号链接

### 12.6 跨线告警显式授权升级（T405，--allow-major-upgrade）

- PR #28 复盘的"跨线告警不自动修复"（推荐版本 major 不在 lockfile 实例 majors → 当前线内无修复版本）在默认行为下**保持不变**：不修复、不标 fixed/converged、计入 skipped 并提示人工。
- `--allow-major-upgrade`（CLI 专属，**无 env 通道**，Action 结构性禁用）显式授权后，**仅**以下跨线告警进入自动跨线链路（2.0.2）：
  - **根 package.json** 直接依赖（`isRootDirectDependency`，修复器只改根 manifest——workspace 成员独占声明维持人工，Review Gate P2-2 修正）
  - lockfile 中该包**单版本**（`readLockfileVersions` 长度 1）
- 处理流程：快照 → `upgradeDependency`（改根声明，install 失败内建回滚）→ **升级后实例复核**（重读 lockfile：仍存在 `< recommended` 的脆弱实例——workspace 成员同 range / 传递依赖 pin 残留——则回滚 + failed，不进入验证，避免误标 fixed 且下一轮被最高实例掩盖误判 converged）→ **强制完整验证**（`verifyProject`：install + lint + build + typecheck + test，非 lint-only——跨线 breaking change 面大，类型面破坏 lint / build 均无法兜底（lint 只跑规则、tsdown 的 `dts` 只发射声明、vitest 走 esbuild 转译）；test 用于捕获「lint/build 通过但测试无法运行或失败」的破坏；无 `typecheck` / `test` 脚本的仓库对应命令自动跳过并记 `SCRIPT_NOT_FOUND` 审计）→ 全部通过保留 / 任一失败 `restoreTrackedFiles` 回滚并计 failed。验证动作入 allActions（报告可审计，Review Gate P2-3 修正）。
- **维持人工的场景**（即使开启）：
  - 间接依赖跨线（全局 override 会波及所有实例与声明，破坏面不可控）
  - workspace 成员独占声明（root 未声明——修复器 `upgradeDependency` 仅改根 manifest，必然失败）
  - 多版本共存跨线（版本化 overrides 跨 major 会破坏依赖方 range 导致 install 失败；全局 override 会降级根声明——C10 教训）
- 同包多条跨线告警按包聚合，取最高 `recommendedVersion` 为升级目标（镜像 `dedupeFixableAlerts` 语义，Review Gate P2-1 修正）
- 统计口径：跨线升级成功 → fixed；失败（install 失败 / 实例残留 / 验证失败）→ failed；维持人工 → skipped。不误标纪律延续（PR #28）。

### 12.7 目标仓库专属配置 `.github/dependfix.yml`（C85）

- **动机**：配置随仓库走（与 `dependabot.yml` / `mergify.yml` 同范式），管理大量仓库时无需在中央逐仓库维护名单；目标仓库可在自己的仓库内声明保护策略并随代码 review（受下方「中央优先」约束：仅在中央未指定该字段时生效）。
- **读取时机与位置**：`<workDir>/.github/dependfix.yml`。工作区即目标仓库检出——平台在 clone 之后才构造 `DependfixApp`（`container-executor.ts`），CLI 直接在工作区内运行，Action 由工作流 checkout 后运行。因此**不走 contents API**：省 API 配额、无需 base64 处理、CLI / 平台 / Action 三条路径共用同一实现。
- **首批字段**：仅 `overrideProtect`（与中央配置同名同语义，判定仍复用唯一事实源 `matchesOverrideProtect`）。
- **优先级：中央配置优先**。中央（env `DEPENDFIX_OVERRIDE_PROTECT` / CLI `--override-protect`）一旦指定该字段，目标仓库声明即被**整体忽略**（不按仓库 glob 逐条合并）——防止目标仓库通过声明弱化中央保护策略；中央未指定（含解析为空）时目标仓库声明生效。生效来源经日志区分（仓库生效 → `info`；被中央覆盖 → `debug`）。
- **降级矩阵**（一律**回退中央配置**、不中断修复）：文件缺失（预期常态，仅 `debug`）/ 空文件（等价未声明，无告警）/ 非普通文件（符号链接 · 目录 → **不跟随链接**读取检出目录之外的内容）/ 超过大小上限（256 KiB）/ 读取失败 / YAML 非法 / schema 不匹配（类型错误）→ `warn` 告警并忽略该文件；未知顶层键 → `warn` 列出后忽略（向前兼容后续版本新增字段，同时避免拼写错误静默失效）；`overrideProtect` 内的原型链风险键（`__proto__` / `constructor` / `prototype`）→ `warn` 丢弃（与 env / CLI 入口共用 `isSafePrototypeKey` 口径）。
- **不做什么**：不替代中央配置（两者并存）；不改 `dependabot.yml` 语义；不做全量配置项迁移（后续字段按需扩展 `repoConfigSchema`）；不新增 contents API 探测（读取走本地检出，见上）。

### 12.8 升级失败取证留痕与安装失败证据（2026-10-16）

- **动机**：失败原因原先只落在 `FixAction.error`，而平台执行后工作目录（含 `dependfix-reports/`）被整体清理、平台仅持久化引擎日志与 `summary`——「抓到告警、已修复 0」的运行事后没有失败原因可查。生产实证：四次 run 中 11 次依赖升级全部失败，日志里只有 `applying versioned overrides`，没有任何失败文本。
- **失败就地留痕（计数与日志成对）**：依赖升级链的三处**升级动作**失败分支（版本化 overrides / 跨线升级 / 成员级升级）在失败计数自增的同一处输出 `warn`——`[<scope>] <包名>: upgrade failed — <失败文本>`（成员级升级带成员 manifest 路径），由 `app/upgrade-failure.ts` 的 `recordUpgradeFailure` 统一承载。**就地**而非收尾统一输出的理由：平台按执行超时截断时只保留截断前已产生的日志（`MemoryLogger` 快照早于引擎收尾），收尾输出可能整段丢失。日志文本与报告 Fix Actions 表同源，且**不写入 `allErrors`**——失败判定与出口码口径不变。**范围说明**：链上其余失败分支（升级后的实例残留 / 快速验证 / 完整验证 / 锁文件修复）本就有各自的 `warn`，本条目只补齐此前仅计数不留痕的三处。
- **安装失败证据形态**：安装失败文本由 `fixers/dependency/overrides-io.ts` 的 `describeInstallError` 组装——**进程级信号在前、原始诊断在后**：`<signal SIGTERM, timed out | signal SIGKILL | exit code N | spawn error ENOENT>: <stderr 或 err.message 回退>`。超时与被信号杀死时 pnpm 的进度写在 stdout，**stderr 为空是常态**，此时 `err.message`（如 `spawnSync /bin/sh ETIMEDOUT`）与进程信号是唯一能区分「超时 / 被杀 / 装不动」的证据；两者都缺时以 `no error detail` 占位，不留空尾。
- **单一事实源**：进程信号抽取与渲染集中在 `fixers/process-signals.ts`，lockfile 修复链与依赖升级链共用（此前两处各一份实现，升级链缺 `err.message` 回退 → 日志与报告只剩前缀 `pnpm install failed:`（冒号后为空））。两链的**进程信号渲染**同源；外层包装与证据裁剪口径不同——lockfile 链写入 `environmental install failure (<signals>): <evidence>` 且 stderr 证据截断到 200 字符（见 [pnpm-lockfile-fixer.md §2.4](./pnpm-lockfile-fixer.md)），依赖升级链写入 `pnpm install failed: <signals>: <detail>` 且不截断（证据完整性优先）。
- **不做什么**：不改失败判定与出口码 / 回滚语义；不改告警选择与 override 策略；不做平台侧报告归档与 `actions` 落库（保留期与磁盘策略需单独决策）。

### 12.9 验证链与既有失败基线（默认链 / 既有失败归因 / 零告警按需采样）

- **默认链纳入 typecheck（M44.1，2026-10-14）**：默认验证链由 `install → lint → build → test` 扩为 `install → lint → build → typecheck → test`。**顺序硬约束**：typecheck 必须排在 build 之后——workspace 包的 `tsc` 依赖前置包已发射的 `dist` 声明（实测移出 `packages/{core,engine,cli}/dist` 后 `pnpm --filter @dependfix/platform typecheck` 报大量 `TS2307 Cannot find module`）；typecheck 排在 test 之前是为最大化基线采样覆盖率（`runVerification` 随首个失败命令中止，前缀覆盖见「已知限制」）。**动因（假绿实证）**：既有四条命令互不重叠地都不做类型检查（lint 只跑规则 / `dts` 只发射声明 / vitest 走 esbuild 转译），依赖升级引入的类型面破坏被判 `verificationPassed = true` 并交付成 PR——消费方 `nodemailer.Transporter` 在依赖升到 10.x 后不再存在（TS2503），直到目标仓库 CI 才红。**边界**：`"build": "tsc"` 形态的仓库 build 本身即类型检查，此时本命令为冗余（只增耗时，无害）而非新增防线；覆盖默认链的自定义命令（`--commands` / 平台 `verifyCommands` / action `commands`）须自行保留 `typecheck` / `test`——`--commands` 是**整链替换**，默认链扩展不会自动跟随；本仓库自用链（`.github/workflows/security-auto-fix.yml`）的这一一致性由 `pnpm run check:verify-chain` 门禁校验（判定口径见 `scripts/check-verify-chain.mjs` 头注释）。
- 已知限制：install/lint/build/typecheck 通过 ≠ 运行时功能正确（test 已纳入默认链，但仍无法覆盖未写成测试的运行时行为）；命令语义不实（如 `"typecheck": "tsc --noEmit || true"`）无法机检；「typecheck / test 长期为红」由命令级既有失败基线豁免，但基线随首个失败命令中止（前缀覆盖）——靠前命令先红会遮蔽其后的采样；验证耗时逐包完整链（含 typecheck / test，test 通常为最慢一步）；快照回滚不还原 node_modules；**既有失败基线已做区分（命令级）**——采样时机、豁免判定、两个口径（`verificationPassed` / `verificationBlocking`）与代价口径见本节内「零告警仓库按需跳过修复前基线采样」条（单一事实源）；**退出码 / 平台 run 状态口径已同步（2026-10-09 修复）**——「仅存在既有失败」的运行不再判失败：`PRE_EXISTING_FAILURE` 纳入 `SKIPPED_AUDIT_CATEGORIES`、既有失败验证 action（`preExisting`）不计入失败动作、仓库成功判定改用归因口径（`isRepoVerificationBlocked`，与门禁单一事实源）——这类运行的退出码为 0/1（平台 `completed`），不再触发 `engine_exit_2` 误标 `failed`；本次改动引入的失败（`verificationBlocking === true`）仍判失败（exit 2）不变；test 另引入三条新失败路径——占位 test 脚本（`npm init` 默认的 `exit 1`）/ 测试依赖网络·密钥·浏览器等外部资源 / 套件耗时超单命令超时（10 分钟），三者均按当前口径判失败并回滚。
- **环境性安装失败与非归因口径（2026-10-13）**：容器内 `pnpm install` 环境性失败（无 stderr 诊断）归 `ENVIRONMENT_ERROR` 并**不归因本次运行**（机制、信号保留与平台侧映射详见 [pnpm-lockfile-fixer.md §2.4](./pnpm-lockfile-fixer.md)）；**零告警仓库另跳过 lockfile repair**（保留修复后验证链——其 `verificationPassed` 是多仓库运行出口码判定的成功信号），既消除「零告警 + 环境性安装失败 + 既有基线失败」被 `engine_exit_2`「所有仓库失败或全量回滚」误标的最大放大器，又不退化多仓成功判定；`pnpm install` 执行方式（`--no-frozen-lockfile`）与锁文件修复策略链语义不变。**基线成本**：修复前基线采样对零告警仓库的开销已按「按需采样」收口（见下条）。
- **零告警仓库按需跳过修复前基线采样（2026-10-16）**：基线采样的实质作用只有一条——命令行级「修复前即红」集合，供修复后验证做 `preExisting` 豁免（出口码 / 门禁谓词的全部下游消费者均挂在 `FixAction.preExisting` 与 `PRE_EXISTING_FAILURE` 类别上；`verificationPassed` 是原始全绿信号，与基线无关）。零告警仓库（依赖告警与 Code Scanning 告警均计入 `alertsCount`）本次对该工作区无任何写操作，且此时运行尚未采样过基线 ⇒ 工作区仍是 pristine，故「修复后失败」与「若采样的基线同样失败」等价——**不采样但保留豁免**（run 级归因局限同 `verification-gate.ts` 所述：共享 workDir 下无法逐仓库区分）。落地三点：① **只读抓取前置**——`prepareRepoFix` 拆为只读告警抓取（`fetchRepoFixInputs`）与写盘段（`prepareRepoFixSets`），先取告警再决定是否付基线成本；② **采样点收敛为「首个有工作的仓库」**——运行级「首采一次 + 跨仓库复用」语义不变，全零告警运行省去整条基线链（该 run 的零告警仓库仍各自跑修复后验证链）；③ **无改动即豁免**——零告警且尚无基线时以 `verifyProject` 的 `noChanges` 选项替代采样（复用既有 `preExisting` 链路与类别，报告文案注明来源：`no alerts or pending fixes for this repository in this run`）。**不变量**（定向用例锁定）：单仓「零告警 + 既有失败」仍为 exit 0（`verificationPassed=false` + `verificationBlocking=false`）；「健康零告警 + 真实失败」仍为 exit 1；有告警仓库的采样 / 修复 / 验证 / 回滚链路零行为差异。**已知边界**：零告警仓库若处理在有工作的仓库之后，仍复用运行级首采基线（口径不变）；采样点之前的前置仓库会先跑一轮验证链（暖态），对「同命令同工作区」的判定无实质影响。
