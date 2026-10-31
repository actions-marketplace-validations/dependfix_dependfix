// family-upgrade.test.ts — 家族锁步升级的一次写盘 / 一次安装 / 整体回滚语义。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRunTrackedCommand } = vi.hoisted(() => ({
    mockRunTrackedCommand: vi.fn(),
}))

vi.mock('../../runners/process-control', () => ({
    runTrackedCommand: mockRunTrackedCommand,
}))

import { cleanup, createTempProject } from './dependency.test-helpers'
import { upgradeFamilyDependencies } from './index'

function okInstallOutcome(): import('../../runners/process-control').TrackedCommandResult {
    return {
        started: true,
        exitCode: 0,
        signal: null,
        timedOut: false,
        aborted: false,
        errno: null,
        stdout: '',
        stderr: '',
        durationMs: 0,
    }
}

function readManifest(dir: string, manifestDir?: string): Record<string, Record<string, string> | undefined> {
    return JSON.parse(readFileSync(join(dir, manifestDir ?? '.', 'package.json'), 'utf-8')) as Record<string, Record<string, string> | undefined>
}

describe('upgradeFamilyDependencies', () => {
    beforeEach(() => {
        mockRunTrackedCommand.mockReset()
        mockRunTrackedCommand.mockResolvedValue(okInstallOutcome())
    })

    it('rewrites all family members before the single install', async () => {
        const project = createTempProject(
            { vitest: '^3.2.4' },
            { devDeps: { '@vitest/coverage-v8': '^3.2.4', '@vitest/ui': '~3.2.4' } },
        )
        // 锁死「先全部写盘、再 install」：安装时读到的 manifest 必须已是目标版本
        // （若实现退回「写一个装一次」，总次数仍为 1 但安装只看到部分成员）
        mockRunTrackedCommand.mockImplementation(async () => {
            const manifest = JSON.parse(readFileSync(project.pkgPath, 'utf-8')) as {
                dependencies?: Record<string, string>
                devDependencies?: Record<string, string>
            }
            expect(manifest.dependencies?.vitest).toBe('^4.0.1')
            expect(manifest.devDependencies?.['@vitest/coverage-v8']).toBe('^4.6.3')
            expect(manifest.devDependencies?.['@vitest/ui']).toBe('~4.6.0')
            return okInstallOutcome()
        })

        const result = await upgradeFamilyDependencies({
            workDir: project.dir,
            updates: [
                { packageName: 'vitest', targetVersion: '4.0.1' },
                { packageName: '@vitest/coverage-v8', targetVersion: '4.6.3' },
                { packageName: '@vitest/ui', targetVersion: '4.6.0' },
            ],
        })

        expect(result.success).toBe(true)
        expect(result.updates).toEqual([
            { packageName: 'vitest', fromVersion: '^3.2.4', toVersion: '^4.0.1', isMajor: true },
            { packageName: '@vitest/coverage-v8', fromVersion: '^3.2.4', toVersion: '^4.6.3', isMajor: true },
            { packageName: '@vitest/ui', fromVersion: '~3.2.4', toVersion: '~4.6.0', isMajor: true },
        ])
        expect(mockRunTrackedCommand).toHaveBeenCalledTimes(1)
        const manifest = readManifest(project.dir)
        expect(manifest.dependencies?.vitest).toBe('^4.0.1')
        expect(manifest.devDependencies?.['@vitest/coverage-v8']).toBe('^4.6.3')
        expect(manifest.devDependencies?.['@vitest/ui']).toBe('~4.6.0')
        // 成功后备份清理
        expect(existsSync(`${project.pkgPath}.bak`)).toBe(false)
        expect(existsSync(`${project.lockfilePath}.bak`)).toBe(false)

        cleanup(project)
    })

    it('rolls back every manifest and the lockfile when install fails', async () => {
        const project = createTempProject(
            { jest: '^29.7.0' },
            { devDeps: { '@types/jest': '^29.5.14' } },
        )
        writeFileSync(project.lockfilePath, 'lockfile v1\n')
        const originalManifest = readFileSync(project.pkgPath, 'utf-8')

        mockRunTrackedCommand.mockImplementation(async () => {
            // 模拟安装过程已改写 lockfile
            writeFileSync(project.lockfilePath, 'lockfile v2\n')
            return {
                ...okInstallOutcome(),
                exitCode: 1,
                stderr: 'ERR_PNPM_PEER_DEP_ISSUES',
            }
        })

        const result = await upgradeFamilyDependencies({
            workDir: project.dir,
            updates: [
                { packageName: 'jest', targetVersion: '30.0.0' },
                { packageName: '@types/jest', targetVersion: '30.0.0' },
            ],
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('ERR_PNPM_PEER_DEP_ISSUES')
        expect(readFileSync(project.pkgPath, 'utf-8')).toBe(originalManifest)
        expect(readFileSync(project.lockfilePath, 'utf-8')).toBe('lockfile v1\n')
        // 失败时仍保留尝试的声明，供报告展示
        expect(result.updates.map((update) => update.toVersion)).toEqual(['^30.0.0', '^30.0.0'])
        // 回滚成功后备份清理（回滚失败时保留备份，见 manifest-upgrades）
        expect(existsSync(`${project.pkgPath}.bak`)).toBe(false)
        expect(existsSync(`${project.lockfilePath}.bak`)).toBe(false)

        cleanup(project)
    })

    it('writes nothing when any member is missing from the manifest', async () => {
        const project = createTempProject({ vitest: '^3.2.4' })
        const originalManifest = readFileSync(project.pkgPath, 'utf-8')

        const result = await upgradeFamilyDependencies({
            workDir: project.dir,
            updates: [
                { packageName: 'vitest', targetVersion: '4.0.1' },
                { packageName: '@vitest/coverage-v8', targetVersion: '4.6.3' },
            ],
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('not found in dependencies')
        expect(readFileSync(project.pkgPath, 'utf-8')).toBe(originalManifest)
        expect(mockRunTrackedCommand).not.toHaveBeenCalled()

        cleanup(project)
    })

    it('refuses protocol declarations and writes nothing', async () => {
        const project = createTempProject({ react: '^18.2.0' }, { devDeps: { 'react-dom': 'catalog:' } })
        const originalManifest = readFileSync(project.pkgPath, 'utf-8')

        const result = await upgradeFamilyDependencies({
            workDir: project.dir,
            updates: [
                { packageName: 'react', targetVersion: '19.0.0' },
                { packageName: 'react-dom', targetVersion: '19.0.0' },
            ],
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('non-semver declaration')
        expect(readFileSync(project.pkgPath, 'utf-8')).toBe(originalManifest)
        expect(mockRunTrackedCommand).not.toHaveBeenCalled()

        cleanup(project)
    })

    it('rejects duplicate updates and empty batches', async () => {
        const project = createTempProject({ vitest: '^3.2.4' })

        const duplicate = await upgradeFamilyDependencies({
            workDir: project.dir,
            updates: [
                { packageName: 'vitest', targetVersion: '4.0.1' },
                { packageName: 'vitest', targetVersion: '4.0.2' },
            ],
        })
        expect(duplicate.success).toBe(false)
        expect(duplicate.error).toContain('duplicate manifest update')

        const empty = await upgradeFamilyDependencies({ workDir: project.dir, updates: [] })
        expect(empty.success).toBe(false)
        expect(empty.error).toContain('no family member updates')
        expect(mockRunTrackedCommand).not.toHaveBeenCalled()

        cleanup(project)
    })

    it('writes the member manifest while installing at the workspace root', async () => {
        const project = createTempProject({})
        const memberDir = 'packages/web'
        mkdirSync(join(project.dir, memberDir), { recursive: true })
        writeFileSync(
            join(project.dir, memberDir, 'package.json'),
            `${JSON.stringify({ name: 'web', devDependencies: { vitest: '^3.2.4', '@vitest/coverage-v8': '^3.2.4' } }, null, 2)}\n`,
        )

        const result = await upgradeFamilyDependencies({
            workDir: project.dir,
            manifestDir: memberDir,
            updates: [
                { packageName: 'vitest', targetVersion: '4.0.1' },
                { packageName: '@vitest/coverage-v8', targetVersion: '4.6.3' },
            ],
        })

        expect(result.success).toBe(true)
        expect(readManifest(project.dir, memberDir).devDependencies).toEqual({
            vitest: '^4.0.1',
            '@vitest/coverage-v8': '^4.6.3',
        })
        expect(mockRunTrackedCommand).toHaveBeenCalledWith(expect.objectContaining({ cwd: project.dir }))

        cleanup(project)
    })
})
