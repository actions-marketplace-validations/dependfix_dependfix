# 第三方可观测性接入评估（Sentry / 日志聚合 / 流量统计）

> 调研日期：2026-10-27
> 方法：momei 源码扫描（`nuxt.config.ts`、`sentry.client.config.ts`、`sentry.server.config.ts`、`plugins/*`、`server/utils/logger.ts`）+ dependfix 源码扫描（`apps/platform/server` 全量 `console.*` / logger 调用、`/api/health`、`Dockerfile`、依赖声明）+ Sentry 官方文档交叉验证（`@sentry/nuxt` v11 迁移、Logs、`dataCollection`）。
> 一句话结论：**2026-10-27 用户决策**——Sentry 走官方 SaaS；**本地日志通道统一优先并已上收 M49 追加临时待办**（本地文件可查，Axiom 作为后续增量）；除本地日志优化外的可观测性条目延后到 1.0 之后排期。

## 摘要

1. momei 的可观测栈是「Sentry（错误 / 性能 / Replay）+ Axiom（远程日志）+ Umami（流量）+ Microsoft Clarity（会话回放）+ GA / 百度统计」。其中 GA / 百度统计服务于公开展示型站点的流量指标，dependfix 管理平台没有对应诉求。
2. dependfix 已有**运行级**日志与失败归因（`MemoryLogger` → `logsJson` → UI 下载、`failureStage` / `failureKind`、summary 快照、资源采集、通知），但**没有进程级错误追踪、RUM / Web Vitals、远程日志聚合**；`/api/health` 只返回版本戳，未被 Docker `HEALTHCHECK` 或外部 uptime 使用（CI 镜像冒烟除外）。
3. **关键落差**：`apps/platform/server/utils/logger.ts` 的 Winston + 文件轮转 + Axiom 传输是**未接线代码**（非测试源码零调用点；服务端非测试源码 161 处 `console.(log|warn|error|info|debug)` 调用 / 43 文件），且 `@axiomhq/winston` 未声明依赖、`require()` 与 ESM 产物不匹配。因此「照搬 momei 的 Axiom」不是加一个 transport，而是先做日志通道统一。
4. **关键安全事实**：`@sentry/nuxt` v11 起 `dataCollection` 默认更宽松（userInfo / cookies / HTTP bodies / databaseQueryData / queues 默认采集），momei 未显式收紧；dependfix 必须显式关闭（含 `urlQueryParams` / `graphQL`）并在 `beforeSend*` 复用抽到 `shared/` 的 `sanitizeDeep`，否则会把仓库、告警、OAuth `code` / `state` 等上下文送出边界。
5. **2026-10-27 用户决策**：Sentry 走官方 SaaS；**本地日志通道统一优先并已上收 M49 追加临时待办**（不占条目编号，本地文件可查；Axiom 作为后续增量）；除本地日志优化外的条目（Sentry、Axiom、健康检查、Umami）延后到 1.0 之后排期。Sentry source map 上传作为 Sentry 候选的后续增量（默认关闭，不单列候选）；**不引入** Clarity / Replay / GA / 百度 / CLI 遥测 / Lighthouse。

## 一、momei 参照事实

| 能力 | momei 实现 | 证据 |
|:--|:--|:--|
| 错误 / 性能 | `@sentry/nuxt` `^11.8.0`；client `browserTracingIntegration` + `replayIntegration`，`tracesSampleRate: 1.0`，Replay 会话 10% / 出错 100%；server `tracesSampleRate: 1.0`；`sourcemaps.disable: true`（自部署不上传） | `package.json`、`nuxt.config.ts`、`sentry.client.config.ts`、`sentry.server.config.ts` |
| 远程日志 | `@axiomhq/winston` `^2.0.0`；`AXIOM_DATASET_NAME` + `AXIOM_API_TOKEN`；同时接管 `exceptionHandlers` / `rejectionHandlers` | `server/utils/logger.ts` |
| 流量统计 | 自托管 Umami（`docker-compose.umami.yml` + `setup:umami`），client 插件注入 `websiteId` / `scriptUrl` | `plugins/umami-analytics.client.ts`、`docs/guide/deploy.md` |
| 会话回放 / 热图 | `@microsoft/clarity` `^1.0.2`，`requestIdleCallback` 延迟初始化，提供 identify / tag / event / consent | `plugins/clarity.client.ts` |
| 流量（公网站点） | Google Analytics 4、百度统计，client 插件按配置注入 | `plugins/google-analytics.client.ts`、`plugins/baidu-analytics.client.ts` |
| 性能门禁 | Lighthouse CI + CWV 基线 + bundle budget（CI 门禁，非第三方 SaaS） | `docs/standards/performance.md` |

momei 是**公开展示型站点**：流量统计、会话回放、Lighthouse / SEO 都有明确业务目标。dependfix 平台是**自托管安全控制面**：用户量小、页面不公开、页面数据包含仓库与告警元信息，不能按同一套默认值照搬。尤其 `tracesSampleRate: 1.0` 与 Replay 10% 是公网站点的取舍，不应作为 dependfix 的默认值。

## 二、dependfix 现状

| 能力 | 现状 | 证据 |
|:--|:--|:--|
| 运行级日志 | `MemoryLogger` 捕获引擎 / 执行器日志 → `scan_run.logs_json` → 运行详情与下载；消息与 context 走 `sanitizeDeep` | `apps/platform/server/utils/memory-logger.ts`、`server/api/runs/**` |
| 进程级日志 | 非测试源码 161 处 `console` 调用（43 文件；精确口径见 §三 交叉验证）；Winston logger 仅自身测试引用；`@axiomhq/winston` 未声明；Axiom 分支在真实环境不可达 | `apps/platform/server/**`、`apps/platform/package.json`、`server/utils/logger.ts` |
| 错误追踪 | 无 Sentry / 无全局 `error.vue` / 无服务端错误上报；API 错误以 `createError` 返回前端 | `apps/platform/app`、`apps/platform/server` |
| 性能 | 无 RUM / Web Vitals / tracing；无页面性能基线 | `apps/platform/nuxt.config.ts`、`apps/platform/app` |
| 健康检查 | `GET /api/health` 返回 `{ version, commit, startedAt }`；无 Docker `HEALTHCHECK`；无外部 uptime 接线 | `server/api/health.get.ts`、`apps/platform/Dockerfile` |
| 失败归因 | `failureStage` / `failureKind`、失败 run summary 快照、环境性失败分类、资源采集 | M37 / M40 / M43.3 / M46.4 归档段 |
| 通知 | 邮件 / Webhook / 周汇总（`weekly_digest`） | M46 / M47.5 归档段 |
| 构建回执 | `buildVersion` / `buildCommit` 落库 + `/api/health` + 启动日志 | `server/utils/build-info.ts`、`docs/standards/platform.md §10.7` |

**结论**：运行级可观测性已有较好基础；缺口集中在**进程级**（错误、性能、系统日志、存活探测），而不是再建一套运行结果模型。

## 三、交叉验证

- **Sentry v11 迁移文档**：[getsentry/sentry-javascript MIGRATION.md](https://github.com/getsentry/sentry-javascript/blob/develop/MIGRATION.md) 明确 `sendDefaultPii` 被 `dataCollection` 取代，v11 默认 `userInfo: true` / `cookies: true` / `httpBodies` 全量 / `databaseQueryData: true` / `queues: true`；`enableLogs` 已移除；`sourceMapsUploadOptions` 已移除，关闭上传改用 `sourcemaps.disable`。
- **Sentry Nuxt / Logs 指南**：[Nuxt guide](https://docs.sentry.io/platforms/javascript/guides/nuxt/)、[Node Logs](https://docs.sentry.io/platforms/javascript/guides/node/logs/)（Winston 集成需 SDK ≥ 9.13.0；`beforeSendLog` 可过滤 / 脱敏）。
- **momei 实机旁证**：`@sentry/nuxt ^11.8.0` + Nuxt `^4.6.2` 已在 momei 仓库配置中组合使用，可作为 Nuxt 4 兼容性的先验信号；但仍需在 dependfix 构建链做真实构建验证。
- **源码计数口径**：`rg -n "console\.(log|warn|error|info|debug)\(" apps/platform/server --glob '!*.test.ts' | wc -l` → 161；`rg -l "console\.(log|warn|error|info|debug)\(" apps/platform/server --glob '!*.test.ts' | wc -l` → 43（2026-10-27 实测，含 `server/utils/logger.ts` 自身 2 处告警）。
- **规划口径**：新增候选未分配 `M\d+` 阶段编号、未写入 `todo.md`，符合「评估 → backlog → 用户决策」硬要求。

## 四、候选评估矩阵

| 候选 | 解决的问题 | 价值 | 成本 | 主要风险 | 结论 |
|:--|:--|:--:|:--:|:--|:--|
| 本地日志通道统一 | 进程级日志落本地文件 / 可查 / 可轮转 | 高 | 中 | 161 处中按边界逐步迁移；日志量；文件权限 | **P1 已上收 M49 追加临时待办** |
| Sentry（`@sentry/nuxt`） | 前端 / 服务端错误、路由与 Web Vitals、warn/error 日志 | 高 | 中 | v11 默认采集面偏宽；SaaS 出网；构建体积 | **P1（官方 SaaS，1.0 后）** |
| Axiom 远程日志 | 远程检索 / 告警 / 长期留存 | 中 | 中（依赖本地统一） | 双通道重复；成本；ESM | **P2 条件（1.0 后）** |
| 健康检查 / uptime | 进程存活、容器重启、外部可达性 | 高 | 低 | 公开端点信息面；误报 | **P2（1.0 后）** |
| Umami | 页面访问量 / 来源 / 留存 | 低 | 中 | 额外服务与脚本；管理台用户量小 | **P3 暂缓（1.0 后）** |
| Clarity / Sentry Replay | 会话回放 / 热图 / UI 问题复现 | 中 | 中 | 仓库、告警、账号信息进入第三方；自托管用户不接受 | **不引入**（如需，Sentry Replay 仅错误会话 + 全量遮罩） |
| GA / 百度统计 | 公网流量与渠道 | 低 | 低 | 隐私、无公网流量诉求、用户已明确排除 | **不引入** |
| Lighthouse CI | 实验室性能门禁 | 低 | 中 | 管理台无 SEO；CI 噪声 | **不引入**（Sentry RUM 覆盖真实性能） |
| OpenTelemetry / Prometheus | 指标、分布式追踪、告警 | 中（长期） | 高 | 运维复杂度；当前单实例 | **暂不引入**（多实例需求出现后再评估） |
| CLI / Action 遥测 | 使用量 / 失败率 | 低 | 中 | 安全工具信任问题；默认上报不可接受 | **不引入**（如未来做，必须显式 opt-in） |

## 五、推荐方案

### P1（已上收 M49 追加临时待办，不占条目编号）：平台本地日志通道统一

**目标**：把进程级日志从散落 `console.*` 收敛为统一 logger，输出到本地可查文件（`LOG_DIR` 默认 `data/logs`，容器内 `/app/data/logs`；按日轮转 + 错误文件），容器重建后仍可从数据卷检索。

- **接入面**：`apps/platform/server/utils/logger.ts`；Nitro 插件、队列 worker、执行器、通知四个进程边界。
- **本地文件**：`LOG_DIR` 默认 `data/logs`（容器内 `/app/data/logs`，随 `/app/data` 数据卷持久化）；`LOG_LEVEL` / `LOGFILES` 可配；按日轮转、`*.errors.log` 单独保留、生产压缩。
- **实现口径**：`LOG_DIR` 缺省仍为 `data/logs`；容器入口需导出 `DATA_DIR` 或显式设置 `LOG_DIR=${DATA_DIR}/logs`，确保自定义 `DATA_DIR` 时日志仍落在数据卷内。
- **异常面**：补 `exceptionHandlers` / `rejectionHandlers`，未捕获异常与 Promise 拒绝进入错误文件。
- **不重复**：`MemoryLogger` 的运行日志仍只落 `logs_json` 并输出 console，不再二次写入统一日志文件；进程级 logger 与运行级日志分工明确。
- **脱敏**：日志消息与 context 复用 `sanitizeDeep`，覆盖 token / Authorization / URL 内嵌凭据 / 敏感字段名。
- **默认行为**：不引入 Axiom、不发外部请求；`docker logs` 仍可用，文件日志是额外可查面。

**验收标准（建议）**：

1. 容器内 `/app/data/logs/YYYY-MM-DD.log` 与 `YYYY-MM-DD.errors.log` 可按日期查询；数据卷重建容器后文件仍在；自定义 `DATA_DIR` 时 `LOG_DIR` 跟随数据卷。
2. `LOG_DIR` / `LOG_LEVEL` / `LOGFILES` 有文档与单测；不可写目录回退 / warn 不阻断启动。
3. 至少 4 个进程边界使用统一 logger；`MemoryLogger` 运行日志不重复落文件。
4. `docker logs` 仍可看到控制台输出；无外部出网。
5. 敏感字段脱敏用例通过；`pnpm lint` / `pnpm typecheck` / platform 单测 / build 通过。

**不做什么**：不接入 Axiom；不一次性迁移 161 处 `console.*`（未迁移的仍走 stdout / `docker logs`，逐批迁移）；不改变运行结果模型与运行详情下载；不引入外部日志服务。

**依赖**：无；日志量 / 文件权限需在容器内验证。

**交付物（预估）**：4-6 commits / 12-18 files / 500-800 行。

**风险与缓解**：重复输出 → 明确进程级 / 运行级分工；日志量 → 按日轮转 + 31 天保留 + 级别过滤；文件权限 → 数据卷写探针；敏感数据 → 共享 `sanitizeDeep`。

**排期**：已作为 M49 追加临时待办（2026-10-27 用户授权）；建议 M49.5 发布后、阶段归档前执行，不阻断 0.6.0 发布。

### P1（1.0 后）：Sentry（错误 + 性能 + warn/error 日志）

**目标**：在不改变现有运行结果模型的前提下，补齐进程级错误、页面性能与关键生命周期日志。

- **托管**：官方 Sentry SaaS（`sentry.io`）DSN；默认关闭，DSN 未配置零出网；首期不承诺自建 / 兼容端点。
- **接入面**：仅 `apps/platform`（Nuxt 前端 + Nitro 服务端）；CLI / Action / MCP 不接入。
- **配置面**：`@sentry/nuxt/module`；根级 `sentry.client.config.ts` / `sentry.server.config.ts`；DSN、environment、release 走环境变量；`release` 复用 `buildVersion` / `buildCommit`；`sentry.sourcemaps.disable: true`（v11 无 `sourceMapsUploadOptions`，关闭上传只能靠该开关）。
- **共享脱敏**：新增 `apps/platform/shared/utils/sanitize.ts`（Nuxt 4 `shared/`），`server/utils/sanitize.ts` 改为 re-export；client / server 两侧 Sentry 配置共用同一 `sanitizeDeep`，避免复制规则。
- **采样**：服务端 `tracesSampleRate` 默认 0.1（env 可调）；客户端 browser tracing 默认 0.1；Web Vitals 随 browser tracing 上报；Profiling 不开。
- **日志**：`Sentry.logger` 只发关键生命周期事件（扫描开始 / 结束、队列 worker 重启、认证失败、通知投递失败等，控制在 10 处以内）；**不启用 `consoleLoggingIntegration`**（`MemoryLogger` 会把运行日志打到 console，启用会造成重复上报）；`beforeSendLog` 复用共享 `sanitizeDeep`。v11 已移除 `enableLogs` 选项，日志为「用即采集」，不要按 v9/v10 经验添加该选项。
- **隐私**：显式设置 `dataCollection`（`userInfo: false`、`cookies: false`、`httpHeaders: false`、`httpBodies: []`、`urlQueryParams: false`、`graphQL: { document: false, variables: false }`、`databaseQueryData: false`、`queues: false`、`genAI: { inputs: false, outputs: false }`、`stackFrameVariables: false`）；`beforeSend` / `beforeSendTransaction` / `beforeSendLog` 清洗；Replay 关闭；不调用 `Sentry.setUser` 写入真实账号。

**验收标准（建议）**：

1. DSN 未配置时 `@sentry/nuxt` 不初始化，页面与 Nitro 无 Sentry 出网请求（单测 + 构建产物断言）。
2. 浏览器异常、API 500、队列 worker 异常三类事件均可在 Sentry 看到，并带 `release` / `commit` / route / environment。
3. 事件与日志中不出现 token、Authorization、Cookie、URL 内嵌凭据，以及 OAuth 回调的 `?code=` / `?state=` / `?token=`（client / server 两侧固定样例 + 共享 `sanitizeDeep` 断言）。
4. 页面路由 transaction 与 LCP / CLS / INP 可在 Sentry 查看；采样率可由 env 调整。
5. `sentry.sourcemaps.disable: true` 生效（构建产物断言）；未配置 `SENTRY_AUTH_TOKEN` 时不发生 source map 上传。
6. `pnpm lint` / `pnpm typecheck` / platform 单测 / `pnpm --filter @dependfix/platform build` / e2e 通过；记录客户端 bundle 增量。

**不做什么**：不做 Session Replay；不做 source map 上传（作为后续增量：需要可读堆栈且已配置 `SENTRY_AUTH_TOKEN` 时再评估）；不做 CLI / Action 遥测；不引入 Umami / Clarity / GA / 百度。

**依赖**：Sentry 官方 SaaS 项目与 DSN；`@sentry/nuxt` v11 与 Nuxt 4.6 的兼容性在 D 阶段用真实构建验证。

**交付物（预估）**：4-6 commits / 10-15 files / 500-800 行（含配置、脱敏、单测、文档）。

**风险与缓解**：v11 默认采集面宽 → 显式 `dataCollection` + 固定脱敏用例；SDK 影响构建 → 先关 source map、记录 bundle 增量；SaaS 出网 → 默认关闭 + 文档声明；采样成本 → 默认 0.1 + env 调整。

**排期**：1.0 后（用户 2026-10-27 决策；不阻断 1.0）。

### P2（1.0 后）：Axiom 远程日志聚合（依赖本地统一）

**目标**：在本地日志通道统一后，按需把 warn/error 与关键事件推送到 Axiom，支持远程检索 / 告警。

- **现状**：`logger.ts` 已实现 Winston / 文件轮转 / Axiom 分支，但非测试源码零调用点；`@axiomhq/winston` 未声明；`require()` 与 ESM 产物不匹配；无 `exceptionHandlers` / `rejectionHandlers`。
- **接入方式**：在本地日志统一完成后，补 `@axiomhq/winston` 依赖与动态 `import()`；Axiom 与本地文件分流，只推 `warn` / `error` 与关键事件；默认关闭；异常钩子复用本地实现转发，不重复实现。
- **验收标准**：本地日志 M49 追加待办完成；Axiom 未配置时零出网；配置后可按 `runId` / `jobId` 检索；不重复推送 `MemoryLogger` 运行日志；敏感字段脱敏用例通过。
- **不做什么**：不重做本地日志（依赖 M49 追加待办）；不一次性迁移 161 处 `console.*`；不改变现有运行详情下载。
- **依赖**：平台本地日志通道统一（M49 追加待办）完成；Axiom 账号。
- **交付物（预估）**：3-5 commits / 8-12 files / 300-500 行。
- **风险与缓解**：日志量 / 成本 → 只推 `warn` / `error` + 采样；ESM → 动态 import + 构建产物冒烟；重复 → 与本地 logger 分流。

**排期**：1.0 后（用户 2026-10-27 决策）。

### P2（1.0 后）：健康检查与外部 uptime

**目标**：让「进程死了 / 容器没起来 / 数据库不可用」在 Sentry 之外也能被外部发现。

- **范围**：`apps/platform/Dockerfile` 增加 `HEALTHCHECK`（Node 内置 `fetch` 调 `/api/health`，不依赖 curl）；`docs/guide/deployment.md` 增加 Uptime Kuma / healthchecks.io / 自建探针接入口径；新增**需鉴权**的 `/api/health/details`（DB / Redis / 队列状态），不暴露给公网。
- **验收标准**：`docker inspect` 显示 healthy；**liveness**（公开 `/api/health`）在进程存活时 200；**readiness**（鉴权 `/api/health/details`）在停库 / Redis 不可用时非 200；外部探针文档可按步骤复现；公开 `/api/health` 不新增敏感字段。
- **不做什么**：不在公开 `/api/health` 暴露 DB / Redis 细节；不引入商业 uptime 依赖。
- **交付物（预估）**：2-3 commits / 5-8 files / 150-250 行。
- **风险与缓解**：健康检查误判 → 足够 `start-period` + 重试；信息面 → 详细状态单独鉴权端点。

**排期**：1.0 后（用户 2026-10-27 决策）。

### P3（1.0 后）：Umami（暂缓）

- **结论**：管理台用户量小，Sentry 的路由 transaction 已能回答「哪些页面慢 / 被访问」；Umami 的流量来源 / 留存价值不足以抵消额外服务与脚本成本。
- **触发条件**：需要产品级使用分析（功能采用率、页面路径）且 Sentry 数据不足；或平台对外提供多租户 SaaS 形态。
- **若启用**：自托管 Umami、无 Cookie、排除 `/api` 与敏感页面、文档声明数据边界。
- **排期**：1.0 后（用户 2026-10-27 决策）。

### 不引入（本轮结论）

- **Microsoft Clarity / Session Replay**：管理台页面包含仓库、告警、组织与账号信息，第三方回放的隐私成本高于收益；如未来确需，优先 Sentry Replay 的「仅错误会话 + `maskAllText` + `blockAllMedia` + 显式 opt-in」。
- **Google Analytics / 百度统计**：用户已明确排除；无公网流量与 SEO 诉求。
- **Lighthouse CI**：管理台无 SEO；真实性能由 Sentry RUM 覆盖，实验室基线暂不引入。
- **CLI / Action 遥测**：安全工具默认上报会破坏信任；如未来做，必须显式 opt-in + 文档化 payload。
- **OpenTelemetry / Prometheus**：当前单实例，Sentry traces + 现有资源采集足够；多实例 / 自托管运维需求出现后再评估。

## 六、隐私与安全边界（hard requirement）

1. **默认关闭**：DSN / token 未配置时，不初始化 SDK、不发起出网请求；内网 / air-gap 部署零影响。
2. **最小采集**：显式 `dataCollection` 关闭 userInfo / cookies / headers / bodies / URL query / GraphQL / DB query / queue data / genAI / stack variables；不发送请求体与响应体，避免 OAuth `code` / `state` 进入事件。
3. **统一脱敏**：`beforeSend` / `beforeSendTransaction` / `beforeSendLog` 复用抽到 `apps/platform/shared/utils/sanitize.ts` 的 `sanitizeDeep`（`server/utils/sanitize.ts` re-export），覆盖 URL 内嵌凭据、`Authorization`、GitHub PAT、敏感字段名；client / server 共用同一实现。
4. **不做回放**：Replay 关闭；如未来启用，必须全量遮罩 + 错误会话 + opt-in。
5. **密钥分层**：DSN 可公开但需开启项目级速率限制 / 事件过滤以防注入与配额消耗；禁止用 `Sentry.setUser` 写入真实账号；`SENTRY_AUTH_TOKEN` 仅 CI secret，不进入镜像、不进入前端、不进入日志。
6. **出网声明**：文档列出官方 Sentry SaaS 的 `*.ingest.sentry.io` 与 Axiom 域名；说明关闭方式。
7. **验证**：固定样例（含 token / cookie / URL 凭据 / OAuth `code` / `state`）断言不会出现在 Sentry 事件与日志中；client / server 两侧各跑一次。

## 七、待决策问题

1. **本地日志统一的执行顺序**：已作为 M49 追加临时待办；建议 M49.5 发布后、阶段归档前执行，避免阻断 0.6.0 发布；如需发布前完成需用户明确调整。
2. **Axiom**：本地日志统一后是否仍有远程检索 / 告警需求？没有则保持不引入；有则在 1.0 后按 P2 排期。
3. **Sentry / 健康检查 / Umami**：按 1.0 后批次排期；Sentry 官方 SaaS 已定，不再决策托管形态。
4. **Replay**：确认不引入；如未来需要，按上文「仅错误会话 + 全量遮罩」单独立项。

## 八、去向

- **M49 追加临时待办**：平台本地日志通道统一（已上收，不占条目编号；建议 M49.5 发布后、阶段归档前执行）。
- **backlog 候选**：Sentry 官方 SaaS（P1，1.0 后）、Axiom（P2，1.0 后）、健康检查与外部 uptime（P2，1.0 后）、Umami（P3，1.0 后）。
- **后续增量**：Sentry source map 上传（需要可读堆栈且已配置 `SENTRY_AUTH_TOKEN` 时再评估，不单列候选）。
- **T705 解耦**：T705 保留 PostgreSQL + Helm；Sentry 从 T705 拆出，避免「生产级部署整体暂缓」继续阻塞可观测性。
- **`todo.md` 边界**：本地日志统一已按用户授权追加 M49 临时待办（不占编号）；其余候选不进入 `todo.md`，等待 1.0 后批次决策。
