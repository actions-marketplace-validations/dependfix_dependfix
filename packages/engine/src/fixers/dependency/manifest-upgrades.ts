// manifest-upgrades.ts — 通用 manifest 依赖升级写盘（单包与家族锁步共用）。
//
// 语义：校验（全部成员先校验）→ 备份 → 改声明（可多条，一次写盘）→ 一次 install
// → 失败整体回滚（含 lockfile）。任一成员校验失败即整批放弃，避免部分写盘产生
// 半族 / 混合版本线。

import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
    cleanupBackups,
    describeInstallError,
    execPnpmInstall,
    formatInstallFailure,
    isInstallEnvironmentalFailure,
    rollback,
} from './overrides-io'
import { extractPrefix, findDependencyVersion, type PackageJson } from './manifest'
import { isNonSemverDeclaration, parseMajorVersion } from './semver'

export interface ManifestUpgradeRequest {
    packageName: string
    targetVersion: string
}

/** 单条写盘结果（版本声明保留原前缀）。 */
export interface ManifestUpgradeApplied {
    packageName: string
    fromVersion: string
    toVersion: string
    isMajor: boolean
}

export interface ManifestUpgradesOutcome {
    success: boolean
    /**
     * 已计算的声明。失败时是**尝试写入的目标**（precheck 失败可能从未写盘；
     * install 失败已回滚），调用方不得把它当作「已落地成员」展示。
     */
    updates: ManifestUpgradeApplied[]
    error?: string
    /** 安装失败是否由环境问题导致（信号终止 / 超时 / 无 stderr 诊断） */
    environmental?: boolean
    /** 失败阶段（仅失败时存在）：precheck = 未写盘；install = 已写盘且安装失败（已回滚） */
    failurePhase?: 'precheck' | 'install'
}

export async function applyManifestUpgrades(params: {
    workDir: string
    manifestDir?: string
    requests: ReadonlyArray<ManifestUpgradeRequest>
}): Promise<ManifestUpgradesOutcome> {
    const { workDir, manifestDir, requests } = params
    const pkgPath = join(workDir, manifestDir ?? '.', 'package.json')
    const lockfilePath = join(workDir, 'pnpm-lock.yaml')

    if (requests.length === 0) {
        return { success: false, updates: [], error: 'no manifest upgrades provided', failurePhase: 'precheck' }
    }

    // ---- 1. 读取 package.json ----
    if (!existsSync(pkgPath)) {
        return { success: false, updates: [], error: `${pkgPath}: file not found`, failurePhase: 'precheck' }
    }

    let pkg: PackageJson
    try {
        pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as PackageJson
    } catch {
        return { success: false, updates: [], error: `${pkgPath}: invalid JSON`, failurePhase: 'precheck' }
    }

    // ---- 2. 逐条校验并计算目标声明（任一失败即整批放弃，未写盘）----
    const seen = new Set<string>()
    const updates: ManifestUpgradeApplied[] = []
    for (const request of requests) {
        if (seen.has(request.packageName)) {
            return {
                success: false,
                updates,
                error: `duplicate manifest update for "${request.packageName}"`,
                failurePhase: 'precheck',
            }
        }
        seen.add(request.packageName)

        const dep = findDependencyVersion(pkg, request.packageName)
        if (!dep) {
            return {
                success: false,
                updates,
                error: `package "${request.packageName}" not found in dependencies / devDependencies / optionalDependencies`,
                failurePhase: 'precheck',
            }
        }

        // `workspace:` / `catalog:` / `link:` 等协议声明无法安全改写为 semver range
        // （extractPrefix 会将其误归为 `^`，导致声明被不可逆改写），明确失败。
        if (isNonSemverDeclaration(dep.version)) {
            return {
                success: false,
                updates: [...updates, {
                    packageName: request.packageName,
                    fromVersion: dep.version,
                    toVersion: request.targetVersion,
                    isMajor: false,
                }],
                error: `package "${request.packageName}" has a non-semver declaration "${dep.version}" (workspace:/catalog:/link:/etc.); manual upgrade required`,
                failurePhase: 'precheck',
            }
        }

        const fromVersion = dep.version
        const toVersion = `${extractPrefix(fromVersion)}${request.targetVersion}`
        const isMajor = parseMajorVersion(fromVersion) !== parseMajorVersion(toVersion)
            && parseMajorVersion(fromVersion) !== -1
            && parseMajorVersion(toVersion) !== -1
        updates.push({ packageName: request.packageName, fromVersion, toVersion, isMajor })
    }

    // ---- 3. 备份 ----
    const pkgBackup = `${pkgPath}.bak`
    const lockBackup = `${lockfilePath}.bak`

    try {
        copyFileSync(pkgPath, pkgBackup)
        if (existsSync(lockfilePath)) {
            copyFileSync(lockfilePath, lockBackup)
        }
    } catch {
        // 部分备份成功后失败时，清理已创建的备份，避免 `.bak` 残留进工作树
        cleanupBackups({ pkgBackup, lockBackup })
        return { success: false, updates, error: 'failed to create backup files', failurePhase: 'precheck' }
    }

    // ---- 4. 修改 package.json（全部成员一次写盘）----
    for (const update of updates) {
        const dep = findDependencyVersion(pkg, update.packageName)
        const deps = dep ? pkg[dep.group] : undefined
        if (!deps) {
            // 不应发生：上一步已确认该组存在且包含目标包
            rollback(pkgPath, pkgBackup, lockfilePath, lockBackup)
            cleanupBackups({ pkgBackup, lockBackup })
            return {
                success: false,
                updates,
                error: `dependency group "${dep?.group ?? 'unknown'}" is missing for "${update.packageName}"`,
                failurePhase: 'precheck',
            }
        }
        deps[update.packageName] = update.toVersion
    }
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf-8')

    // ---- 5. 执行 pnpm install ----
    try {
        await execPnpmInstall(workDir)
    } catch (installErr: unknown) {
        const restored = rollback(pkgPath, pkgBackup, lockfilePath, lockBackup)
        if (restored) {
            cleanupBackups({ pkgBackup, lockBackup })
        }
        const installError = formatInstallFailure(describeInstallError(installErr))
        return {
            success: false,
            updates,
            error: restored
                ? installError
                : `${installError}; rollback failed — backups kept at ${pkgBackup} / ${lockBackup}`,
            environmental: isInstallEnvironmentalFailure(installErr),
            failurePhase: 'install',
        }
    }

    // 成功 — 清理备份文件
    cleanupBackups({ pkgBackup, lockBackup })

    return { success: true, updates }
}
