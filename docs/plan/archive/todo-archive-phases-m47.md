# 待办归档分片：M47 交付判定可信与运行自证

> 本分片由 2026-10-26 文档治理批次从 [todo-archive.md](../todo-archive.md) 迁出；正文逐字保留；相对链接按新位置重指。

---

## M47: 交付判定可信与运行自证（2026-10-22 用户决策方案 A′ / 2026-10-24 归档）

> **归档摘要**：6 原子条目；首父链 35 commits（阶段启动 3 + 文档订正 2 + Node 安全基线插队 3 + M47.6 3 + M47.2 5 + M47.1 4 + M47.3 4 + M47.4 6 + M47.5 5）。类型平衡 🎨 1 + 🛠️ 2 + 🚀 2 + 🧪 1（🎨 独立条目低于建议值 2，缺口显式标注）；阶段基线 41-59 文件 / 1600-2650 行；M47.1 因实际 diff 新增 governance 专项稿 `verification-ci-alignment.md`，M47.2 / M47.3 / M47.4 / M47.5 触发阈值后复用既有设计稿（run-failure-taxonomy / dependency-fixer-records / pnpm-lockfile-fixer / gitignore-management / platform-notification）。六条目均通过 Review Gate（M47.1 / M47.2 / M47.4 R1 Reject：M47.1 两分区、M47.2 分区 A、M47.4 两分区；M47.5 / M47.6 分区 B Reject；均收口后 Pass）；归档前 `git rev-list` 双向核验 ahead 0 / behind 0（origin/master = `327a02e0`）。

> **证据来源**：各批次测试 / 审计数字取自 `.session/runtime-state.json` §`m47_*`（本地会话记录，gitignored，均不入库）与 `artifacts/review-gate/` 工件（gitignored）；复核以对应 commit 与测试命令为准。

### M47.1 [P1 🎨] 验证链与目标仓库 CI 口径对齐（**已闭环** `384d2a21` + `8888999e` + `612a457b` + `4d11c83b` + 本条登记）

- **目标**：让 PR 正文 / 运行报告明确回答「本次验证链与目标仓库 CI 是否同一口径」，默认分支同 workflow 已红时标注「非本 PR 引入」。
- **落地**：core 新增 `CiAlignmentRecord` 四态模型与 Markdown 渲染；engine 只读默认分支 `.github/workflows` 的 `jobs.*.steps[].run`（`lstat` 拒绝软链 / 非普通文件，文件数与字节上限超限整体降级），识别 lint / build / typecheck / test 四语义项并做四态比对；默认分支健康预检单次 5s、最多 3 workflow、失败只 warn；`verifyProject` 记录实际执行命令集（并集），PR 正文新增固定行预算的「CI 口径」区块；平台零代码改动（`RunResult.ciAlignment` 随结果回到 `generatePRBody`），run 详情 UI 不做。
- **审计**：deep 两分区 R1 均 Reject（A：软链 `/dev/zero` 绕过字节上限并同步阻塞、计划链误报、多仓指针与 20 文件静默截断；B：设计稿超限语义与实现不符、平台零改动未记录）→ 全部收口（安全硬修、实际命令并集、剩余预算不足整块跳过、白名单 / sanitize）→ quick R2 Pass（2W）→ 收口 → quick R3 Pass（1 非阻塞 warning 已修）；mutation 4/4。
- **证据**：engine 82 文件 / 1471 passed；core 9 文件 / 197 passed；全仓 304 文件 / 4636 passed；platform 161 文件 / 2072 passed；lint 0 error；typecheck 7 包；文档七项 + `docs:build`；新增行编号标记 0。
- **边界**：只识别命令子集（matrix / secrets / services 语义不解析）；不按 workflow 替换 `verifyCommands`；健康预检单次调用、失败降级「未获取」。

### M47.2 [P1 🛠️] 构建版本回执与安装日志语义订正（**已闭环** `abed1ad5` + `1a557e1a` + `07456c81` + `9624bd87` + `ceb9b7f8` + 本条登记）

- **目标**：让日志与落库回答「本次运行由哪个构建执行」，并把 `Lockfile repaired` 的中性语义写清。
- **落地**：`scan_run.build_version` / `build_commit`（迁移 `2900000000000`，前缀感知 + 幂等 + 可空）+ 入队 / 同步新建写入、续跑 / `reuse` 刷新；`RuntimeConfig` 可选 `buildVersion` / `buildCommit`（无新增 env），引擎按「宿主注入 → 引擎包版本 → unknown」解析并输出 `[build] … source=host|engine-package`；运行详情弹窗「构建版本」元信息项（unknown / null 统一「未知」）；`tryLockfileRepair` 四分支文案（已合规 / 修复生效 / 状态未知 / 失败），旧串生产源码零残留。
- **审计**：deep 两分区 R1 A Reject（「零残留」口径不可复现 / D 阶段数字失真 + 4W）/ B Pass（4W）→ 全量收口（日志 `source`、B 模式口径、补 4 例、registry 真实增量迁移、`changed` 缺省中性文案、前端哨兵等值断言）→ quick R2 Pass → quick R3 Pass；mutation 4/4。
- **证据**：engine 83 文件 / 1487 passed；platform 161 文件 / 2090 passed；根全量 307 文件 / 4662 passed；lint 0 error；typecheck 7 包；定向 e2e alerts-sidebar 4 + scans 10；文档九项 + `docs:build`；编号 0。
- **边界**：`github-action` 模式两列记录平台构建，实际执行镜像在目标仓库 runner；不回填历史 run；版本不塞 `summaryJson`。

### M47.3 [P2 🛠️] 环境性失败归因收口（**已闭环** `73ef8895` + `0d1dd455` + `729d37db` + `8da62c55` + 本条登记）

- **目标**：收窄「环境性失败」判定，并让常规分组 / 逐包 / major / 成员四条升级路径消费安装结果 `environmental`。
- **落地**：判据单点化到 `fixers/process-signals#isEnvironmentalInstallError`（取消 → 非环境性；信号 / 超时 → 环境性；有 stderr → 非环境性；stderr 空 → 环境性；stdout 只作证据），lockfile 诊断链经适配器共用；四路径统一经 `markEnvironmentalInstallFailure` 记 `ENVIRONMENT_ERROR` + 动作标记，不增 `alertsFailed`；停机语义端到端传导（成员返回 stop 标志、分组停机前跑组级验证、跨线置 `stopReason`）；取消守卫不产出 K 条同因失败；`not-fixable` 记账前移到告警分区处；`computeExitCode` 谓词零改动。
- **审计**：standard 两分区均 Pass（A 3W/4S、B 7W/4S）→ 全量收口 → quick R2 Pass（8 项全 closed，新增 2W 已修）；mutation 8/8。
- **证据**：engine 83 文件 / 1508 passed；全仓 307 文件 / 4683 passed；lint 0 error；typecheck 7 包；文档九项 + `docs:build`；编号 0。
- **边界**：静默非零退出（只写 stdout）仍按环境性处理，不增 `alertsFailed`、exit 0（证据进 `FixAction.error` 与日志）；历史 run 不回填。

### M47.4 [P2 🚀] pnpm store 持久化与提交卫生（**已闭环** `6acaf252` + `083b7a66` + `50e55e61` + `64f10c57` + `1dd677e3` + CI 首跑修复 `327a02e0`）

- **目标**：store 固定持久卷 + 交付提交排除 store / `node_modules`。
- **落地**：入口默认 `PNPM_CONFIG_STORE_DIR=$DATA_DIR/pnpm-store`（实测 pnpm 11 下 `npm_config_store_dir` 与项目 `.npmrc` 无效）；可写性用运行身份写探针（`test -w` 不看挂载只读属性），不可用 unset 回退；store 目录以运行身份创建、不对任意路径 chown、根 / 相对路径拒绝；引擎在 `run()` 起始（`executeMode()` 前）幂等写目标仓库 `.git/info/exclude`（子目录 / 工作树经 `rev-parse --git-common-dir` 解析，取反行按最后匹配胜出），仅 `fix` / `fix-and-pr` 且非 dry-run；Dockerfile 不固化 ENV、compose 同名转发、smoke 0c 落点断言。
- **审计**：standard 两分区 R1 均 Reject → R2（A Pass / B Reject）→ R3 Reject（矩阵 / no-chown 守卫）→ quick R4 Pass；mutation 8/8。
- **CI 首跑修复**：`327a02e0` 修 smoke 0c 宿主侧断言 × 入口 chown 的权限交互（非 root runner 失去 search 权限 → `[ -d ]` 恒假；数据目录 755 + 清理前交还所有权 + 失败打印 `ls -ld`），非 root / root 均 PASS。
- **证据**：engine 84 文件 / 1533 passed；全仓 308 文件 / 4725 passed；平台 docker 32 passed；真机四场景 + smoke 0c；lint 0 error；typecheck 7 包；文档九项 + `docs:build`；编号 0。
- **边界**：不做 store 自动 GC；多仓共享 store 并发控制不做（队列并发 1）；store 与工作目录须同文件系统；`.gitignore` 取反优先于 `info/exclude`。

### M47.5 [P2 🚀] 通知周汇总 weekly_digest（**已闭环** `51cd8287` + `7eb5e1af` + `c554f267` + `a6d94923` + `b447c87e` + 本条登记）

- **目标**：固定周期插件（默认关闭），按 ISO 周 + 用户逐封去重，发送活跃未修复高危快照。
- **落地**：`weekly-digest-schedule`（ISO 周键 / 24h 触发窗口 / 小时 env 解析）+ `weekly-digest.service`（部署 → 组织 → 个人三层开关、全局活跃快照、逐用户投递）+ 插件（HTTP-only 角色守卫、30s 首跑 + 15 分钟节拍、组织 / 部署关闭时窗口内可重试）；`dispatchNotification` 扩展 `recipientUserId` / `recipientIdentity`，weekly_digest 豁免指纹 / 冷却 / 每小时上限并按「收件人 + 渠道 + ISO 周」占位；周报 sent 行不计入共享上限；正文披露截断与 `RunSummary.alertsConverged`；UI 去掉禁用态与占位说明。
- **审计**：standard 两分区 A Pass（3W/7S）/ B Reject（2B/6W/4S：diff 数字 / 交付物拆分）→ 全量收口 → quick R2 Pass（新 4 条 minor 已处理）；mutation 6/6。
- **证据**：platform 164 文件 / 2142 passed；通知域 17 文件 / 137 passed；notifications e2e 4 passed；视觉 update 一次 + no-update 连跑两遍 17 passed（仅 `notifications-light` 重建）；lint 0 error；typecheck 7 包；文档十项 + `docs:build`；编号 0。
- **边界**：部分用户失败本周内不重试；组织 / 部署关闭不写投递记录；零告警仍发送；locale 取部署级；仅截断无明细的仓库不披露；无 dark / settings 视觉基线；明细不含 converged 标记；崩溃遗留 `sending` 的窄场景。

### M47.6 [P3 🧪] 工程门禁与提交卫生收口（**已闭环** `ed26b5b7` + `9178a62b` + `0242aa30` + 本条登记）

- **目标**：补齐子任务字母后缀编号、经验归档子条目落点、lint-staged 全量暂存三条缺口。
- **落地**：`check-orphan-ids` 支持 `M43.2a` 形态并移除失效 D3 白名单；`check-experience-landing` 改为编号 `###` 子条目逐条校验、自指落点判空；lint-staged 三条业务 glob 移除裸 `git add` 并改文件级任务（生成物同步保留 pathspec 例外）；文档与检查点矩阵同步。
- **审计**：quick 分区 A Pass（0B/4W/3S）/ B Reject（B1 code-auditor 必查项 stale）→ quick R2 Reject（B2 交付物计数 14 vs 实测 19 且 0 commit）→ quick R3 Pass；mutation 5/5。
- **证据**：scripts 40 文件 / 748 passed（新增 15 例）；`check:orphan-ids` 0（780 文件）；`check:experience-landing` OK；lint 0 error；typecheck 7 包；文档八项 + `docs:build`；lint-staged 实测仅暂存目标文件。
- **边界**：CLI 退出码 / `--json` 无单测；`*.mjs` 不在 lint-staged 的 `*.js,ts` glob；CSS/Vue 任务仍为平台级 stylelint；共享尾部结构小节只惠及最后一个编号子条目。

### 阶段期间插队与文档订正（不占阶段条目编号）

- **Node 运行时安全基线升级（2026-10-22，3 commits / 19 文件）**：镜像改官方 `node:24.22.1-alpine`（manifest list digest）+ 移除 corepack shim 钉 pnpm 11.18.0 + runtime 去 npm/corepack/yarn + `check-node-version.mjs`（22/24/26 发布线，EOL 拒绝）+ `npm_config_nodedir` + 可选 `APK_MIRROR` / `NPM_REGISTRY` 构建参数；engines 抬升到 `^22.23.4 || ^24.22.1`（BREAKING CHANGE: Node 20 不再支持）；审计 standard R1（5W/5S）→ R2（2W）→ R3 quick Pass；镜像构建 + 冒烟 PASS。
- **运行面漏洞检测候选与基线口径订正（`f7b19003` + `ba726710`）**：订正 monorepo 运行面基线口径并登记候选，补数据源实测。

> **闭环记录（2026-10-24）**：六原子全部闭环；M47.1 新增 governance 专项稿 verification-ci-alignment；M47.2 / M47.3 / M47.4 / M47.5 触发阈值后复用既有设计稿（run-failure-taxonomy / dependency-fixer-records / pnpm-lockfile-fixer / gitignore-management / platform-notification），未另立专项稿。审计逐条目 R1 均以 Pass 或收口后 Pass 放行；全阶段 lint 0 error、typecheck 7 包、根全量 308 文件 / 4725 passed、platform 164 文件 / 2142 passed、engine 84 文件 / 1533 passed、视觉 17 passed ×3、文档与 i18n 门禁通过。归档前 `git rev-list --count` 双向核验 ahead 0 / behind 0（origin/master = `327a02e0`）。
> **残余（跨条目）**：CI 口径只识别命令子集、不承诺结果；构建版本 B 模式记录平台构建；环境性失败静默 stdout 边界；store 无自动 GC / 并发控制；周报明细不含 converged 标记；门禁脚本 `*.mjs` 无 pre-commit lint。各项详见上文明细。
