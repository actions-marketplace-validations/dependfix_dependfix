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
- **安装失败证据形态（2026-10-18 更新）**：安装失败文本由 `fixers/dependency/overrides-io.ts` 的 `describeInstallError` 组装——**进程级信号在前、诊断在后**：`<signal SIGTERM, timed out | signal SIGKILL | exit code N | spawn error ENOENT>: <stderr+stdout 合并诊断 或 err.message 回退>`。pnpm 11 的安装脚本错误常写 stdout、stderr 为空，因此诊断必须同时读取两路；截断/脱敏口径以 [§12.11](#1211-安装诊断的-stdout-证据有界落定与基线快速失败2026-10-18) 为单一事实源（本段不再重复具体字符数）。
- **单一事实源**：进程信号抽取与渲染集中在 `fixers/process-signals.ts`，lockfile 修复链与依赖升级链共用；诊断文本由 `getInstallDiagnostics` 统一组装（stderr + stdout、先脱敏后摘要），lockfile 链再用尾部优先截断保留根因。两链的进程信号渲染与诊断读取同源；外层包装不同——lockfile 链写入 `environmental install failure (<signals>): <evidence>`，依赖升级链写入 `pnpm install failed: <signals>: <detail>`。
- **不做什么**：不改失败判定与出口码 / 回滚语义；不改告警选择与 override 策略；不做平台侧报告归档与 `actions` 落库（保留期与磁盘策略需单独决策）。

### 12.9 验证链与既有失败基线（默认链 / 既有失败归因 / 零告警按需采样）

- **默认链纳入 typecheck（M44.1，2026-10-14）**：默认验证链由 `install → lint → build → test` 扩为 `install → lint → build → typecheck → test`。**顺序硬约束**：typecheck 必须排在 build 之后——workspace 包的 `tsc` 依赖前置包已发射的 `dist` 声明（实测移出 `packages/{core,engine,cli}/dist` 后 `pnpm --filter @dependfix/platform typecheck` 报大量 `TS2307 Cannot find module`）；typecheck 排在 test 之前是为最大化基线采样覆盖率（`runVerification` 随首个失败命令中止，前缀覆盖见「已知限制」）。**动因（假绿实证）**：既有四条命令互不重叠地都不做类型检查（lint 只跑规则 / `dts` 只发射声明 / vitest 走 esbuild 转译），依赖升级引入的类型面破坏被判 `verificationPassed = true` 并交付成 PR——消费方 `nodemailer.Transporter` 在依赖升到 10.x 后不再存在（TS2503），直到目标仓库 CI 才红。**边界**：`"build": "tsc"` 形态的仓库 build 本身即类型检查，此时本命令为冗余（只增耗时，无害）而非新增防线；覆盖默认链的自定义命令（`--commands` / 平台 `verifyCommands` / action `commands`）须自行保留 `typecheck` / `test`——`--commands` 是**整链替换**，默认链扩展不会自动跟随；本仓库自用链（`.github/workflows/security-auto-fix.yml`）的这一一致性由 `pnpm run check:verify-chain` 门禁校验（判定口径见 `scripts/check-verify-chain.mjs` 头注释）。
- 已知限制：install/lint/build/typecheck 通过 ≠ 运行时功能正确（test 已纳入默认链，但仍无法覆盖未写成测试的运行时行为）；命令语义不实（如 `"typecheck": "tsc --noEmit || true"`）无法机检；「typecheck / test 长期为红」由命令级既有失败基线豁免，但基线随首个失败命令中止（前缀覆盖）——靠前命令先红会遮蔽其后的采样；验证耗时逐包完整链（含 typecheck / test，test 通常为最慢一步）；快照回滚不还原 node_modules；**既有失败基线已做区分（命令级）**——采样时机、豁免判定、两个口径（`verificationPassed` / `verificationBlocking`）与代价口径见本节内「零告警仓库按需跳过修复前基线采样」条（单一事实源）；**退出码 / 平台 run 状态口径已同步（2026-10-09 修复）**——「仅存在既有失败」的运行不再判失败：`PRE_EXISTING_FAILURE` 纳入 `SKIPPED_AUDIT_CATEGORIES`、既有失败验证 action（`preExisting`）不计入失败动作、仓库成功判定改用归因口径（`isRepoVerificationBlocked`，与门禁单一事实源）——这类运行的退出码为 0/1（平台 `completed`），不再触发 `engine_exit_2` 误标 `failed`；本次改动引入的失败（`verificationBlocking === true`）仍判失败（exit 2）不变；test 另引入三条新失败路径——占位 test 脚本（`npm init` 默认的 `exit 1`）/ 测试依赖网络·密钥·浏览器等外部资源 / 套件耗时超单命令超时（10 分钟），三者均按当前口径判失败并回滚。
- **环境性安装失败与非归因口径（2026-10-13）**：容器内 `pnpm install` 环境性失败（无 stderr 诊断）归 `ENVIRONMENT_ERROR` 并**不归因本次运行**（机制、信号保留与平台侧映射详见 [pnpm-lockfile-fixer.md §2.4](./pnpm-lockfile-fixer.md)）；**零告警仓库另跳过 lockfile repair**（保留修复后验证链——其 `verificationPassed` 是多仓库运行出口码判定的成功信号），既消除「零告警 + 环境性安装失败 + 既有基线失败」被 `engine_exit_2`「所有仓库失败或全量回滚」误标的最大放大器，又不退化多仓成功判定；`pnpm install` 执行方式（`--no-frozen-lockfile`）与锁文件修复策略链语义不变。**基线成本**：修复前基线采样对零告警仓库的开销已按「按需采样」收口（见下条）。
- **零告警仓库按需跳过修复前基线采样（2026-10-16）**：基线采样的实质作用只有一条——命令行级「修复前即红」集合，供修复后验证做 `preExisting` 豁免（出口码 / 门禁谓词的全部下游消费者均挂在 `FixAction.preExisting` 与 `PRE_EXISTING_FAILURE` 类别上；`verificationPassed` 是原始全绿信号，与基线无关）。零告警仓库（依赖告警与 Code Scanning 告警均计入 `alertsCount`）本次对该工作区无任何写操作，且此时运行尚未采样过基线 ⇒ 工作区仍是 pristine，故「修复后失败」与「若采样的基线同样失败」等价——**不采样但保留豁免**（run 级归因局限同 `verification-gate.ts` 所述：共享 workDir 下无法逐仓库区分）。落地三点：① **只读抓取前置**——`prepareRepoFix` 拆为只读告警抓取（`fetchRepoFixInputs`）与写盘段（`prepareRepoFixSets`），先取告警再决定是否付基线成本；② **采样点收敛为「首个有工作的仓库」**——运行级「首采一次 + 跨仓库复用」语义不变，全零告警运行省去整条基线链（该 run 的零告警仓库仍各自跑修复后验证链）；③ **无改动即豁免**——零告警且尚无基线时以 `verifyProject` 的 `noChanges` 选项替代采样（复用既有 `preExisting` 链路与类别，报告文案注明来源：`no alerts or pending fixes for this repository in this run`）。**不变量**（定向用例锁定）：单仓「零告警 + 既有失败」仍为 exit 0（`verificationPassed=false` + `verificationBlocking=false`）；「健康零告警 + 真实失败」仍为 exit 1；有告警仓库的采样 / 修复 / 验证 / 回滚链路零行为差异。**已知边界**：零告警仓库若处理在有工作的仓库之后，仍复用运行级首采基线（口径不变）；采样点之前的前置仓库会先跑一轮验证链（暖态），对「同命令同工作区」的判定无实质影响。
- **验证链注入 env 与目标仓库测试断言的冲突面（2026-10-16 实证）**：`buildSpawnEnv` 总是构造子进程 env，并在**父环境无代理**时注入审计代理（`HTTP_PROXY` / `HTTPS_PROXY` / `ALL_PROXY` 指向本地拦截代理，`NO_PROXY` / `no_proxy` 置空）——这正是「工具验证自身」时的形态：版本化 override 探针与修复后验证都会把该 env 传进**目标仓库自己的测试进程**。目标仓库的测试若断言「宿主环境无代理」（本仓库 `verification-runner.test.ts` 有两例），在该 env 下必然假红 → 探针判失败并回滚，外部现象是「抓到告警、修复 0」而失败点只能靠链差推理（2026-10-16 定时 run：3 个版本化 override 探针全失败、PR 零升级，根因即此）。**已落地处置：测试侧对宿主 env 免疫**（用例隔离时清零并还原全部代理形态、大小写各半），**不改注入语义**（「无代理才注入 + 有既有代理不覆盖」是网络审计的设计前提）；通用面（目标仓库自身的同类断言）属产品级设计问题，暂以「`quick-verify` 失败日志带失败命令 + 脱敏原因」保证可观测性。

### 12.10 安装类命令的超时口径与版本化 overrides 合批（2026-10-17）

- **超时口径单一事实源**：同类 `pnpm install` 调用（依赖升级安装 / 锁文件诊断 / frozen 校验 / 修复策略）此前四处各持一份硬编码超时（120s / 120s / 120s / 180s），与验证链单命令 10 分钟上限口径分裂——实测探针安装间隔 2m01s / 2m39s 与 120s 上限吻合，说明大量安装是**被超时打断**而非"装完失败"。收敛为 `packages/engine/src/fixers/install-timeouts.ts`：缺省 300s（依据：实测成功安装 30s–3min）、经 `DEPENDFIX_INSTALL_TIMEOUT_MS` 覆盖、越界 / 非法回退默认。验证链单命令上限**刻意不同源**（前者是"装依赖"、后者是"跑目标仓库脚本"，预算与性质分离）。
- **执行方式**：安装 / 锁文件修复 / 验证类命令统一走受管异步执行（`runners/process-control.ts`），命令启动前检查运行级取消（已取消则不启动），登记 PID 以便按进程树终止（见 [executor-process-isolation.md §8](../governance/executor-process-isolation.md#_8-执行超时与运行级取消-2026-10-17) 的契约）。
- **版本化 overrides 合批**：可修包 ≥ 2 时，先尝试**一次写盘 + 单次安装 + 组级验证**（`applyVersionedOverridesBatch` + `app/repo-fix-batch.ts`）；**非环境性**失败（普通安装失败或组级验证失败）→ 回滚到合批前快照 → 回退**逐包**路径。**合批只做加速**：成功时为每包各产出一条版本化 override 动作（报告表 / PR 正文 / 内容指纹 / 提交信息口径与逐包路径逐字一致）；非环境性失败时不产出动作、不计数、不写审计条目——真实归因交由逐包路径给出，故 `alertsFixed` / `alertsFailed` / 出口码在两种路径下语义等价。**环境性失败例外（见 [§12.11](#1211-安装诊断的-stdout-证据有界落定与基线快速失败2026-10-18)）**：信号终止 / 超时（且非运行级中止）时跳过逐包重试，记 `ENVIRONMENT_ERROR`（不归因本次运行）并停止后续成员 / 分组安装链；运行级中止按 `ABORTED` 独立上报，不写 `ENVIRONMENT_ERROR`。
- **单包不启用合批**：条目数 = 1 时行为与改动前完全一致（避免为优化引入无谓分支）。
- **公开 API 面变化（明示）**：`applyVersionedOverridesBatch` / `VersionedOverridesPlan` / `VersionedOverridesApplyResult` 经 `fixers/dependency` 出口对 `@dependfix/engine` 消费者可见（新增，非破坏性）；`LockfileFailureCategory` 联合类型新增 `'ABORTED'`（破坏性：穷举 switch 的消费者需补分支）；`repairLockfile` / `classifyLockfileFailure` 由同步改异步（破坏性，仓库内消费方已同批适配）。

### 12.11 安装诊断的 stdout 证据、有界落定与基线快速失败（2026-10-18）

- **stdout 证据（pnpm 11）**：pnpm 11 把安装脚本（`prebuild-install` / `node-gyp` / `postinstall`）的错误写到 **stdout**，stderr 为空是常态。旧的 `describeInstallError` / `classifyLockfileFailure` 只读 stderr，导致「`exit code 1` + `no stderr diagnostics`」这类无根因文本。现由 `fixers/process-signals.ts` 的 `getInstallDiagnostics` 统一读取 **stderr + stdout**：只有一路有内容时保持原纯文本形态（不破坏既有报告列），两路都有时按 `stderr:` / `--- stdout ---` 标注；每路头 2,000 + 尾 1,800 字符摘要（单路上限 4,000，两路合并约 8,000），先脱敏后截断，避免大输出撑爆日志与报告、也避免凭据落在截断边界。lockfile 链的失败详情再用尾部优先截断（500 字符）保留 `gyp` / `ELIFECYCLE` 等根因。`toExecLikeError` 同时回填 `stdout`，lockfile 链的 `verifyFrozenLockfile` / 策略错误与依赖升级链的 `describeInstallError` 共用该口径。
- **可读提示**：`classifyInstallFailure` 在既有 `minimumReleaseAge` 之外新增两类——`prebuild-install ... timed out` / `gyp ERR! find Python` / `node-gyp rebuild` → 「原生模块构建失败：预编译包下载可能超时且环境缺 Python / 构建工具链，安装 `python3/make/g++` 或确保 prebuild 可达」；`ERR_PNPM_IGNORED_BUILDS` → 「pnpm 忽略了未批准的构建脚本，仅对可信依赖补 `allowBuilds` / `onlyBuiltDependencies`」。只匹配错误码，不匹配普通成功安装也会打印的 `Ignored build scripts` 警告，避免误导排查方向。
- **有界落定（2s 宽限期）**：`runners/process-control.ts` 与 `runners/verification-runner.ts` 不再只等 `close`。直接子进程 `exit` 后启动 `STREAM_CLOSE_GRACE_MS`（2s）宽限：`close` 正常到来则立即落定；孙进程仍持有 stdout/stderr 时主动 `destroy` 管道并用已捕获输出落定；超时路径在杀进程后同样启动该兜底。若宽限期结束时仍未观察到直接子进程 `exit`（不可中断状态 / kill 未生效），结果标记 `terminationUnconfirmed`，调用方不得把「放弃等待」当成「已终止」。生产实证（run `6852f841180016bb`，push-all-in-cloud）：5 分钟安装超时因孙进程持有管道拖到 12 分钟，直接吃掉单仓 30 分钟预算。
- **修复前基线快速失败**：`verify-project.ts` 的 `findInstallBaselineFailure` 只识别默认链的安装命令（`pnpm install …` / `corepack pnpm@x install …`），不把 lint / build / test 的既有失败当成安装问题。`ensureVerificationBaseline` 额外返回**当前仓库**的基线（运行级首采记录 `repo`，多仓复用时不把 A 仓的安装失败套到 B 仓）；`repo-fix-finalize.ts` 的 `recordInstallBaselineFailure` 输出 `PRE_EXISTING_FAILURE`（含失败命令与诊断，跳过类白名单不计出口码），`processRepoFix` 据此跳过版本化 overrides / 跨线 / 成员 / 分组升级四条安装链。**边界**：仍运行 lockfile repair 与修复后验证——若 `--frozen-lockfile` 失败是 lockfile 漂移而非环境问题，修复后可让下一轮正常运行。**出口码语义**：环境破损（基线安装失败 / 合批环境性失败）按既有非归因口径不计入失败动作与出口码，可能出现「有证据、0 修复、exit 0」；平台不得把 exit 0 当成修复成功，需结合 `errors` / `alertsFixed` 判定。告警账目证据（run `6852f84106801968`，rss-impact-server）：`gh api '/repos/CaoMeiYouRen/rss-impact-server/dependabot/alerts?state=open&per_page=100' --jq length` = 26；默认上限保留 20、截断 6；跨大版本跳过 4（nodemailer 10.0.5 / 10.0.6 / 10.0.9、@opentelemetry/core 2.8.0）。
- **合批 / 逐包环境性短路**：`applyVersionedOverridesBatch` 的结果新增 `environmental`（信号终止 / 超时，由 `isEnvironmentalInstallError` 判定；`aborted` 优先返回 false，中止是独立类别 `ABORTED`）。合批失败为环境性时跳过逐包重试并记 `ENVIRONMENT_ERROR`（不归因本次运行）；逐包安装遇环境性失败时同样记 `ENVIRONMENT_ERROR`、不产出失败动作 / 不计 `alertsFailed`，并立即停止本仓库剩余安装尝试（含成员 / 分组升级）。**非环境性**（普通 exit 1）仍保留逐包回退，用于隔离单个坏 override。
- **运行镜像**：runtime 阶段补 `python3 make g++`（与 deps 阶段同口径）。目标仓库的原生模块优先下载 prebuild；下载失败或无对应 prebuild 时回退 `node-gyp` 源码编译，缺工具链会以 `gyp ERR! find Python` 失败；工具链不是充分条件——node headers / prebuild 源（`nodejs.org`、GitHub Releases、`~/.cache/node-gyp`）仍需可达，部分模块另需 `linux-headers`（当前未装，已知边界）。**校验**：逐个 `command -v`（busybox ash 下 `command -v a b c` 部分缺失仍可能 exit 0，不能作为门禁）；`smoke-test.sh` 场景 0 已加断言。**体积实测**（审计方同 digest 基础镜像）：`/usr` +约 303MB、content size +约 110MB、`docker images` disk +约 421MB；执行仍为非 root 容器；独立 installer 容器方向见 backlog 候选。
- **不做什么**：不持久化 pnpm store（P2 backlog）；不在运行摘要 / UI 展示截断与跨大版本跳过数（P2 backlog）；不做通用 `deadlineAt` / 剩余预算机制（P2 backlog）；不改 `EXECUTION_TIMEOUT_MS` / `DEPENDFIX_INSTALL_TIMEOUT_MS` 缺省值；不改验证链条数与顺序、告警选择与锁文件修复策略链语义。

### 12.12 交付正确性：零修复、安装既有失败、override 生效与收敛判定（2026-10-18）

生产复盘（`rss-image-download#103` / `hexo-cloudflare-counter#114` / `cookie-cloudflare#84` / `nest-template#2421`）暴露四类「PR 建了但不可信」的独立缺口，本批按 **P0 交付正确性** 收口：

- **零修复不交付**：`commitLocalChanges` / `executeFixAndPrMode` 原先只看 `hasGitChanges`；`.gitignore` / `pnpm-workspace.yaml` 的 allowBuilds 等 side-effect 改动也能让零修复运行产生 commit + PR（`nest-template#2421`：0 升级 / 0 锁文件修复，PR 只有 `.gitignore`；CI 以基线同一个 `ERR_PNPM_BROKEN_LOCKFILE` 失败）。现由 `app/delivery.ts` 的 `hasDeliverableFixes` 统一判定：至少一个成功且非 noOp 的 `dependency-upgrade`（排除 `PR #N` 记录）/ `code-scanning-fix` / `lockfile-repair`；零修复时跳过提交 / PR；PR 路径回滚本次运行产生的脏工作区（commit 模式保留工作区供检查；运行前已有用户改动时两路径都不自动回滚）。`tryLockfileRepair` 对「lockfile 已合规、内容未变」标记 `noOp`（`LockfileRepairResult.changed === false`），不再把「无需修复」计成修复动作。
- **修复后安装仍既有失败不交付**：`PRE_EXISTING_FAILURE` 只表示「不归因本次改动」，不等于「PR 的 CI 会绿」。若修复后验证中安装命令仍以 `preExisting: true` 失败（如目标仓库 lockfile 本身损坏），普通 PR 的 CI 必然同因失败。现由 `hasPreExistingInstallFailure` 在提交 / PR 前拦截；若 lockfile repair 让安装转绿（修复后无该失败 action），仍允许交付。新增 `app/skipped-delivery.ts` 承载跳过交付时的回滚（复用 `rollbackChanges`，保留 `preExistingDirty` 保护面）。
- **override 生效校验（所有写入路径）**：`pnpm install` 成功 ≠ override 真正生效。通用 override 已存在、但被更具体的路径级规则压过时，pnpm 可能认为 lockfile 已最新而不重解析——日志报「升级成功」、实际无 diff、commit 被跳过（`cmyr-skills-agents` 的 `undici` 7.28.0 实证）。现 `overrideTransitiveDependency` 与 `applyVersionedOverridesBatch` 在 install 后回读 **全部** 锁定实例（`override-verification.ts`）：单包 override 要求所有实例 >= 目标；版本化 override 只校验对应 major 的实例；仍有低于目标者 → 回滚 + 失败（不再有「假成功」）。原先仅覆盖「无 `pnpm-workspace.yaml` + pnpm v10+」的风险分支，现覆盖 workspace 写入路径。
- **收敛判定按全部实例**：`applyGroupUpgrades` 原先用 `readLockfileVersion`（最高版本）判断「已收敛」；`cookie-cloudflare` 的 `undici` 7.30.0 让 5.28.4 / 5.29.0 被误判为已修复，报告 `Converged: 1` 但 10 条 `< 6.28.0` 告警仍在。现按 `readLockfileVersions` 全量判定：**最高实例 < 目标**时仍走常规升级（no-downgrade 保护只在最高实例已达标时生效）；**最高实例 >= 目标且全部实例 >= 目标**才算 `alertsConverged`；**最高实例 >= 目标但仍有低实例**（低 major / 其它 manifest）时计入 `alertsSkipped` 并 warn「cross-major upgrade or manual review required」。
- **不做什么**：不改 `PRE_EXISTING_FAILURE` 的归因 / 出口码口径（仍不归因、不改出口码；但修复后安装仍红时阻断普通 PR 交付，二者不矛盾）；不改验证链 / 安装链顺序；不做 draft PR / issue 降级通道（P2 backlog）；不做「目标仓库 CI 命令对齐 / 默认分支 workflow 健康预检」（P2 backlog）；不把路径级 override 的生效校验细化为 `parent>child` 映射（当前跳过，由完整验证兜底）。
