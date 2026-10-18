import { copyFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import YAML from 'yaml'
import { resolveInstallTimeoutMs } from '../install-timeouts'
import {
    describeProcessSignals,
    extractProcessSignals,
    getInstallDiagnostics,
    isEnvironmentalInstallError,
    toExecLikeError,
    type ExecError,
} from '../process-signals'
import { runTrackedCommand } from '../../runners/process-control'
import type { DependencyFixResult, PackageJson } from './index'

/** 版本化 overrides 批量应用条目（一条 = 一个包的多 key overrides）。 */
export interface VersionedOverridesPlan {
    packageName: string
    overrides: Record<string, string>
}

/** 批量应用结果（不抛错：失败经 `error` 文本暴露，成功可带 `warning`）。 */
export interface VersionedOverridesApplyResult {
    success: boolean
    warning?: string
    error?: string
    /**
     * 失败阶段：`precheck`（未写盘）/ `install`（已写盘且安装失败）/
     * `verify`（安装成功但回读 lockfile 仍有低于目标的实例，已回滚）——供单包包装保持既有 `toVersion` 口径。
     */
    failurePhase?: 'precheck' | 'install' | 'verify'
    /** 安装失败是否由进程级环境问题导致（信号终止 / 超时）；调用方据此停止逐包重试 */
    environmental?: boolean
}

// ---------------------------------------------------------------------------
// pnpm overrides 写入 / 回滚 / 备份 的文件 IO 组
//
// 本组函数为 dependency/index.ts 升级链路的内部实现（不在 engine 公共
// 入口 re-export），供"写入 overrides → install → 失败回滚 → 清理备份"
// 各阶段复用。拆分动机：dependency/index.ts 文件行数治理（max-lines 800），
// 本组与核心升级逻辑无耦合，独立成文件后 index.ts 收敛到行数限制内。
// ---------------------------------------------------------------------------

/**
 * 执行 `pnpm install --no-frozen-lockfile`。
 *
 * 2026-10-17 可中断化：由同步 `execSync` 改为受管异步 `runTrackedCommand`——
 * ① 不阻塞事件循环（引擎与平台同进程，同步调用会让平台的执行超时定时器一起停摆）；
 * ② 子进程登记在案，运行级取消（平台执行超时 / 运维中止）时按进程树终止，
 * 不再留下"僵尸 pnpm 与后续仓库争抢内存"（2026-10-16 内核 OOM 级联的成因之一）；
 * ③ 超时口径与其余安装类调用统一（`resolveInstallTimeoutMs`，默认 300s、env 可覆盖）。
 *
 * 失败仍以**与 `execSync` 同形**的错误抛出（`status` / `signal` / `code` / `stderr`），
 * 使既有读取口径（`describeInstallError` / `extractProcessSignals`）零漂移。
 */
export function execPnpmInstall(workDir: string): Promise<void> {
    const command = 'pnpm install --no-frozen-lockfile'
    return runTrackedCommand({
        binary: 'pnpm',
        args: ['install', '--no-frozen-lockfile'],
        cwd: workDir,
        timeoutMs: resolveInstallTimeoutMs(),
    }).then((outcome) => {
        if (!outcome.started) {
            throw new Error(`run aborted — install not started: ${command}`)
        }
        if (outcome.exitCode !== 0 || outcome.timedOut) {
            throw toExecLikeError(command, outcome)
        }
    })
}

export function failResult(
    packageName: string,
    targetVersion: string,
    fromVersion: string,
    error: string,
): DependencyFixResult {
    return {
        packageName,
        fromVersion,
        toVersion: targetVersion, // 无原始前缀上下文
        isMajor: false,
        success: false,
        error,
    }
}

/**
 * 回滚一次 overrides 写入 + install 的全部变更（复用：install 失败与
 * 生效校验失败共用同一回滚路径，保证"写盘但未生效"也不残留脏状态）。
 */
export function rollbackOverrideWrite(params: {
    usesWorkspaceYaml: boolean
    workspaceYamlPath: string
    packageName: string
    oldOverride: string | undefined
    pkg: PackageJson
    pkgPath: string
    pkgBackup: string
    lockfilePath: string
    lockBackup: string
    workspaceBackup: string | null
}): void {
    const {
        usesWorkspaceYaml,
        workspaceYamlPath,
        packageName,
        oldOverride,
        pkg,
        pkgPath,
        pkgBackup,
        lockfilePath,
        lockBackup,
        workspaceBackup,
    } = params
    rollbackOverrides({
        usesWorkspaceYaml,
        workspaceYamlPath,
        packageName,
        oldOverride,
        pkg,
        pkgPath,
    })
    rollback(pkgPath, pkgBackup, lockfilePath, lockBackup)
    if (usesWorkspaceYaml && workspaceBackup) {
        rollback(workspaceYamlPath, workspaceBackup, lockfilePath, null)
    }
    cleanupBackups({ pkgBackup, lockBackup, workspaceBackup })
}

export function rollback(
    pkgPath: string,
    pkgBackup: string,
    lockfilePath: string,
    lockBackup: string | null,
): void {
    try {
        if (existsSync(pkgBackup)) {
            copyFileSync(pkgBackup, pkgPath)
        }
        if (lockBackup !== null && existsSync(lockBackup)) {
            copyFileSync(lockBackup, lockfilePath)
        }
    } catch {
        // 回滚失败 → 已写入 result.error，不在此层二次抛异常
    }
}

/**
 * 安全删除备份文件，失败静默忽略。
 */
function safeUnlink(filePath: string): void {
    try {
        if (existsSync(filePath)) {
            unlinkSync(filePath)
        }
    } catch {
        // 静默降级
    }
}

/**
 * 清理所有备份文件。
 */
export function cleanupBackups(paths: { pkgBackup: string, lockBackup: string | null, workspaceBackup?: string | null }): void {
    safeUnlink(paths.pkgBackup)
    if (paths.lockBackup !== null) {
        safeUnlink(paths.lockBackup)
    }
    if (paths.workspaceBackup) {
        safeUnlink(paths.workspaceBackup)
    }
}

/**
 * 在 `pnpm-workspace.yaml` 中写入一条 override。
 *
 * 读取现有 YAML → 设置 `overrides[packageName] = version` → 原样写回。
 *
 * @returns 写入前该包的旧值（`undefined` 表示原先不存在该 override）
 */
/**
 * 写入 pnpm-workspace.yaml 的 overrides 条目。
 *
 * `packageName` 参数为 override key，支持两种格式：
 * - 顶层覆盖：`packageName`（如 `vite`）或版本化 key（`vite@5`）
 * - 路径级覆盖：`parent>child`（如 `@vitejs/plugin-vue>vite`）
 *
 * @returns 旧值（undefined = 该 key 原本不存在）
 */
export function writeWorkspaceOverride(
    workspaceYamlPath: string,
    packageName: string,
    version: string,
): string | undefined {
    let doc: Record<string, unknown>

    try {
        const raw = readFileSync(workspaceYamlPath, 'utf-8')
        doc = YAML.parse(raw) as Record<string, unknown> ?? {}
    } catch {
        doc = {}
    }

    const overrides = (doc.overrides ?? {}) as Record<string, string>
    const old = overrides[packageName]
    overrides[packageName] = version
    doc.overrides = overrides

    writeFileSync(workspaceYamlPath, YAML.stringify(doc), 'utf-8')
    return old
}

/**
 * 回滚 override 写入操作。
 *
 * - `pnpm-workspace.yaml` 模式：删除刚写入的条目，或恢复旧值
 * - `package.json` 模式：同理操作 `pkg.pnpm.overrides`
 */
function rollbackOverrides(params: {
    usesWorkspaceYaml: boolean
    workspaceYamlPath: string
    packageName: string
    oldOverride: string | undefined
    pkg: PackageJson
    pkgPath: string
}): void {
    const { usesWorkspaceYaml, workspaceYamlPath, packageName, oldOverride, pkg, pkgPath } = params

    if (usesWorkspaceYaml) {
        try {
            const raw = readFileSync(workspaceYamlPath, 'utf-8')
            const doc = YAML.parse(raw) as Record<string, unknown> ?? {}
            const overrides = (doc.overrides ?? {}) as Record<string, string>

            if (oldOverride === undefined) {
                const next = Object.fromEntries(
                    Object.entries(overrides).filter(([key]) => key !== packageName),
                )
                if (Object.keys(next).length === 0) {
                    delete doc.overrides
                } else {
                    doc.overrides = next
                }
            } else {
                overrides[packageName] = oldOverride
            }

            writeFileSync(workspaceYamlPath, YAML.stringify(doc), 'utf-8')
        } catch {
            // 回滚失败 → 已被 backup 机制覆盖
        }
    } else {
        if (pkg.pnpm?.overrides) {
            const overrides = pkg.pnpm.overrides
            if (oldOverride === undefined) {
                const next = Object.fromEntries(
                    Object.entries(overrides).filter(([key]) => key !== packageName),
                )
                if (Object.keys(next).length === 0) {
                    delete pkg.pnpm.overrides
                    if (Object.keys(pkg.pnpm).length === 0) {
                        delete pkg.pnpm
                    }
                } else {
                    pkg.pnpm.overrides = next
                }
            } else {
                overrides[packageName] = oldOverride
            }
        }
        writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf-8')
    }
}

/**
 * 组装 `pnpm install` 失败的证据文本：进程级信号在前，原始诊断在后。
 *
 * 为什么不能只取 stderr：超时（`ETIMEDOUT`）与被信号杀死（`SIGKILL`）时 pnpm 的进度写在
 * stdout；更常见的是安装脚本（`prebuild-install` / `node-gyp`）的业务错误本身也写到 stdout
 * ——只取 stderr 会得到空串，把「为什么失败」整段丢掉（日志与报告里只剩
 * `pnpm install failed: `）。进程信号与 stderr / stdout 证据由 `getInstallDiagnostics`
 * 统一组装，口径与 lockfile 修复链的环境性安装失败同源。
 */
export function describeInstallError(err: unknown): string {
    if (!(err instanceof Error)) {
        return String(err).trim()
    }
    const signals = describeProcessSignals(extractProcessSignals(err))
    const detail = getInstallDiagnostics(err as ExecError).trim() || 'no error detail'
    return signals ? `${signals}: ${detail}` : detail
}

/** 安装失败是否属于进程级环境问题（信号终止 / 超时），供调用方决定是否停止后续安装尝试。 */
export function isInstallEnvironmentalFailure(err: unknown): boolean {
    return err instanceof Error && isEnvironmentalInstallError(err as ExecError)
}

// ---------------------------------------------------------------------------
// pnpm install 失败原因识别
// ---------------------------------------------------------------------------

/**
 * `pnpm install` 诊断中的已知失败特征 → 可读提示。
 *
 * 覆盖三类实际遇到的失败：
 * - 原生模块回退源码编译失败（预编译包下载超时 + 环境缺 Python / 构建工具链）
 * - pnpm 11 忽略未批准的构建脚本
 * - minimumReleaseAge 冷却期约束
 *
 * 顺序有意义：原生构建 / ERR_PNPM_IGNORED_BUILDS 是更具体的根因，先于通用冷却期匹配。
 */
const INSTALL_FAILURE_HINTS: [RegExp, string][] = [
    [
        /gyp ERR! find Python|node-gyp rebuild|prebuild-install.*(?:Request timed out|timed out)/i,
        'native module build failed: prebuild download may have timed out and the environment lacks Python/build tools; install python3/make/g++ in the execution image or ensure prebuilt binaries are reachable',
    ],
    [
        /ERR_PNPM_IGNORED_BUILDS/,
        'pnpm ignored dependency build scripts (ERR_PNPM_IGNORED_BUILDS); approve only trusted dependencies via pnpm-workspace.yaml allowBuilds (or onlyBuiltDependencies) and retry',
    ],
    [
        /ERR_PNPM_NO_MATURE_MATCHING_VERSION|ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION|minimumReleaseAge/i,
        'target repo has a minimumReleaseAge policy; the upgrade target version is too fresh (cooldown not elapsed). Retry after the cooldown period, or relax the policy',
    ],
]

/** 识别 `pnpm install` 失败原因，未识别返回 null。 */
export function classifyInstallFailure(diagnostics: string): string | null {
    for (const [pattern, hint] of INSTALL_FAILURE_HINTS) {
        if (pattern.test(diagnostics)) {
            return hint
        }
    }
    return null
}

/**
 * 格式化 `pnpm install` 失败错误信息：识别到已知原因时附加可读提示。
 * 供升级链路各 catch 块统一使用（upgradeDependency / overrideTransitiveDependency /
 * applyVersionedOverrides），避免三处重复匹配逻辑。
 */
export function formatInstallFailure(diagnostics: string): string {
    const hint = classifyInstallFailure(diagnostics)
    return hint ? `pnpm install failed: ${hint}: ${diagnostics}` : `pnpm install failed: ${diagnostics}`
}
