// families.test.ts — 家族锁步规则与升级计划（纯函数）。
//
// 关键反例（2026-10-24 巡检）：eslint@9 + typescript-eslint@8 是官方支持组合，
// 不得因「同 major」判定为违规；eslint 只做 peer range 校验。
import { describe, expect, it } from 'vitest'
import {
    collectManifestDependencies,
    DEPENDENCY_FAMILIES,
    extractDeclaredVersion,
    isOnTargetLine,
    planFamilyUpgrade,
    resolveFamily,
    type FamilyPlanInput,
} from './families'

function input(overrides: Partial<FamilyPlanInput> & Pick<FamilyPlanInput, 'packageName' | 'targetVersion' | 'manifestDependencies'>): FamilyPlanInput {
    return overrides
}

describe('resolveFamily', () => {
    it('covers the four curated families and their members', () => {
        const expected: Record<string, string[]> = {
            vitest: ['vitest', '@vitest/coverage-v8', '@vitest/ui', '@vitest/browser'],
            'typescript-eslint': ['@typescript-eslint/parser', '@typescript-eslint/eslint-plugin', 'typescript-eslint'],
            jest: ['jest', '@types/jest'],
            react: ['react', 'react-dom', '@types/react', '@types/react-dom'],
        }
        expect(DEPENDENCY_FAMILIES.map((family) => family.id)).toEqual(Object.keys(expected))
        for (const [id, members] of Object.entries(expected)) {
            for (const member of members) {
                expect(resolveFamily(member)?.id).toBe(id)
            }
        }
    })

    it('returns null for unknown packages and for peer-only packages (eslint / ts-jest)', () => {
        expect(resolveFamily('lodash')).toBeNull()
        expect(resolveFamily('eslint')).toBeNull()
        expect(resolveFamily('ts-jest')).toBeNull()
        expect(resolveFamily('@vitest/something')).toBeNull()
    })
})

describe('collectManifestDependencies', () => {
    it('merges the three install groups and ignores peerDependencies', () => {
        const manifest = {
            dependencies: { react: '^19.0.0' },
            devDependencies: { vitest: '^4.0.0', eslint: '^9.0.0' },
            optionalDependencies: { fsevents: '^2.3.0' },
            peerDependencies: { 'react-dom': '^19.0.0' },
        }
        expect(collectManifestDependencies(manifest)).toEqual({
            react: '^19.0.0',
            vitest: '^4.0.0',
            eslint: '^9.0.0',
            fsevents: '^2.3.0',
        })
    })

    it('ignores prototype keys and non-string declarations from external manifest JSON', () => {
        const manifest = JSON.parse('{"dependencies":{"__proto__":{"polluted":true},"vitest":"^4.0.0","bad":3}}') as {
            dependencies: Record<string, string>
        }

        const merged = collectManifestDependencies(manifest)

        expect(merged).toEqual({ vitest: '^4.0.0' })
        expect(({} as Record<string, unknown>).polluted).toBeUndefined()
        expect(Object.getPrototypeOf(merged)).toBeNull()
    })
})

describe('isOnTargetLine', () => {
    it('treats same-or-higher major as on line', () => {
        expect(isOnTargetLine('^3.2.4', 'major', '4.0.1')).toBe(false)
        expect(isOnTargetLine('^4.0.0', 'major', '4.0.1')).toBe(true)
        expect(isOnTargetLine('^5.0.0', 'major', '4.0.1')).toBe(true)
    })

    it('compares exact versions for same-version families', () => {
        expect(isOnTargetLine('^8.46.0', 'version', '8.46.0')).toBe(true)
        expect(isOnTargetLine('^8.45.0', 'version', '8.46.0')).toBe(false)
        expect(isOnTargetLine('~8.46.0', 'version', '8.46.0')).toBe(true)
    })

    it('returns false for unparsable declarations', () => {
        expect(isOnTargetLine('catalog:', 'major', '4.0.0')).toBe(false)
        expect(extractDeclaredVersion('catalog:')).toBeUndefined()
    })

    it('treats pre-release versions as below the stable release', () => {
        expect(isOnTargetLine('^8.46.0-beta.1', 'version', '8.46.0')).toBe(false)
        expect(extractDeclaredVersion('^8.46.0-beta.1')).toBe('8.46.0-beta.1')
    })
})

describe('planFamilyUpgrade', () => {
    it('returns null for unknown packages and for indirect triggers', () => {
        expect(planFamilyUpgrade(input({
            packageName: 'lodash',
            targetVersion: '4.17.21',
            manifestDependencies: { lodash: '^4.17.20' },
        }))).toBeNull()
        expect(planFamilyUpgrade(input({
            packageName: 'vitest',
            targetVersion: '4.0.1',
            manifestDependencies: { '@vitest/coverage-v8': '^3.2.4' },
        }))).toBeNull()
    })

    it('upgrades vitest family members to the same major line', () => {
        const plan = planFamilyUpgrade(input({
            packageName: 'vitest',
            targetVersion: '4.0.1',
            manifestDependencies: {
                vitest: '^3.2.4',
                '@vitest/coverage-v8': '^3.2.4',
                '@vitest/ui': '^3.2.4',
            },
            resolvedMembers: {
                '@vitest/coverage-v8': { version: '4.6.3' },
                '@vitest/ui': { version: '4.6.0' },
            },
        }))

        expect(plan?.updates).toEqual([
            { packageName: 'vitest', fromVersion: '^3.2.4', targetVersion: '4.0.1', isMajor: true },
            { packageName: '@vitest/coverage-v8', fromVersion: '^3.2.4', targetVersion: '4.6.3', isMajor: true },
            { packageName: '@vitest/ui', fromVersion: '^3.2.4', targetVersion: '4.6.0', isMajor: true },
        ])
        expect(plan?.skipped).toEqual(['@vitest/browser'])
        expect(plan?.pendingMembers).toEqual([])
    })

    it('leaves members already on the target line untouched (no downgrade, no rewrite)', () => {
        const plan = planFamilyUpgrade(input({
            packageName: 'vitest',
            targetVersion: '4.0.1',
            manifestDependencies: {
                vitest: '^3.2.4',
                '@vitest/coverage-v8': '^4.6.0',
                '@vitest/ui': '^5.0.0',
            },
        }))

        expect(plan?.updates.map((update) => update.packageName)).toEqual(['vitest'])
        expect(plan?.untouched).toEqual(expect.arrayContaining(['@vitest/coverage-v8', '@vitest/ui']))
        expect(plan?.pendingMembers).toEqual([])
    })

    it('records members absent from the manifest as skipped and continues', () => {
        const plan = planFamilyUpgrade(input({
            packageName: 'vitest',
            targetVersion: '4.0.1',
            manifestDependencies: { vitest: '^3.2.4' },
        }))

        expect(plan?.updates.map((update) => update.packageName)).toEqual(['vitest'])
        expect(plan?.skipped).toEqual(['@vitest/coverage-v8', '@vitest/ui', '@vitest/browser'])
    })

    it('requests registry resolution for members below the target line', () => {
        const plan = planFamilyUpgrade(input({
            packageName: 'vitest',
            targetVersion: '4.0.1',
            manifestDependencies: { vitest: '^3.2.4', '@vitest/coverage-v8': '^3.2.4' },
        }))

        expect(plan?.pendingMembers).toEqual([
            { packageName: '@vitest/coverage-v8', lockstep: 'major', value: '4.0.1' },
        ])
        expect(plan?.updates).toEqual([])
    })

    it('always writes the trigger package when it is below the alert target (even within the same major)', () => {
        const plan = planFamilyUpgrade(input({
            packageName: 'vitest',
            targetVersion: '3.2.4',
            manifestDependencies: { vitest: '^3.2.0', '@vitest/coverage-v8': '^2.0.0' },
            resolvedMembers: { '@vitest/coverage-v8': { version: '3.2.5' } },
        }))

        expect(plan?.updates).toEqual([
            { packageName: 'vitest', fromVersion: '^3.2.0', targetVersion: '3.2.4', isMajor: false },
            { packageName: '@vitest/coverage-v8', fromVersion: '^2.0.0', targetVersion: '3.2.5', isMajor: true },
        ])
    })

    it('honours a same-major explicit alert target instead of skipping it as on-line', () => {
        const plan = planFamilyUpgrade(input({
            packageName: 'vitest',
            targetVersion: '4.0.1',
            manifestDependencies: { vitest: '^4.0.0', '@vitest/coverage-v8': '^4.0.0' },
            alertTargets: { '@vitest/coverage-v8': '4.2.0' },
        }))

        expect(plan?.updates).toEqual([
            { packageName: 'vitest', fromVersion: '^4.0.0', targetVersion: '4.0.1', isMajor: false },
            { packageName: '@vitest/coverage-v8', fromVersion: '^4.0.0', targetVersion: '4.2.0', isMajor: false },
        ])
    })

    it('abandons exact-version families when a member is above the target line', () => {
        const plan = planFamilyUpgrade(input({
            packageName: '@typescript-eslint/parser',
            targetVersion: '8.46.0',
            manifestDependencies: {
                '@typescript-eslint/parser': '^8.46.0',
                '@typescript-eslint/eslint-plugin': '^8.47.0',
            },
        }))

        expect(plan?.versionConflict).toContain('above the target line 8.46.0')
        expect(plan?.updates).toEqual([])
    })

    it('does not downgrade the trigger package when it is already at or above the alert target', () => {
        const plan = planFamilyUpgrade(input({
            packageName: 'vitest',
            targetVersion: '3.2.4',
            manifestDependencies: { vitest: '^3.4.0', '@vitest/coverage-v8': '^3.4.0' },
        }))

        expect(plan?.updates).toEqual([])
        expect(plan?.untouched).toEqual(expect.arrayContaining(['vitest', '@vitest/coverage-v8']))
    })

    it('accepts eslint 9 with typescript-eslint 8 (legal peer combination)', () => {
        const plan = planFamilyUpgrade(input({
            packageName: '@typescript-eslint/parser',
            targetVersion: '8.46.0',
            manifestDependencies: {
                '@typescript-eslint/parser': '^8.45.0',
                '@typescript-eslint/eslint-plugin': '^8.45.0',
                eslint: '^9.10.0',
            },
            resolvedMembers: {
                '@typescript-eslint/parser': {
                    version: '8.46.0',
                    peerDependencies: { eslint: '^8.57.0 || ^9.0.0' },
                },
                '@typescript-eslint/eslint-plugin': {
                    version: '8.46.0',
                    peerDependencies: { eslint: '^8.57.0 || ^9.0.0' },
                },
            },
            relatedVersions: { eslint: '9.10.0' },
        }))

        expect(plan?.peerViolation).toBeUndefined()
        expect(plan?.updates.map((update) => [update.packageName, update.targetVersion])).toEqual([
            ['@typescript-eslint/parser', '8.46.0'],
            ['@typescript-eslint/eslint-plugin', '8.46.0'],
        ])
    })

    it('abandons the whole family when the peer range rejects the installed related package', () => {
        const plan = planFamilyUpgrade(input({
            packageName: '@typescript-eslint/parser',
            targetVersion: '8.46.0',
            manifestDependencies: {
                '@typescript-eslint/parser': '^8.45.0',
                eslint: '^10.0.0',
            },
            resolvedMembers: {
                '@typescript-eslint/parser': {
                    version: '8.46.0',
                    peerDependencies: { eslint: '^8.57.0 || ^9.0.0' },
                },
            },
            relatedVersions: { eslint: '10.0.0' },
        }))

        expect(plan?.peerViolation).toContain('does not accept installed eslint@10.0.0')
        expect(plan?.updates).toEqual([])
    })

    it('validates ts-jest peer range against the target jest version', () => {
        const violating = planFamilyUpgrade(input({
            packageName: 'jest',
            targetVersion: '30.0.0',
            manifestDependencies: { jest: '^29.7.0', 'ts-jest': '^29.1.0' },
            resolvedMembers: { jest: { version: '30.0.0' } },
            relatedVersions: { 'ts-jest': '29.1.0' },
            relatedPeers: { 'ts-jest': { jest: '^29.0.0' } },
        }))
        expect(violating?.peerViolation).toContain('does not accept target jest@30.0.0')
        expect(violating?.updates).toEqual([])

        const accepted = planFamilyUpgrade(input({
            packageName: 'jest',
            targetVersion: '30.0.0',
            manifestDependencies: { jest: '^29.7.0', 'ts-jest': '^29.1.0' },
            resolvedMembers: { jest: { version: '30.0.0' } },
            relatedVersions: { 'ts-jest': '29.1.0' },
            relatedPeers: { 'ts-jest': { jest: '^29.0.0 || ^30.0.0' } },
        }))
        expect(accepted?.peerViolation).toBeUndefined()
        expect(accepted?.updates.map((update) => update.packageName)).toEqual(['jest'])
    })

    it('requests peer metadata when the member target peers are unknown', () => {
        const plan = planFamilyUpgrade(input({
            packageName: '@typescript-eslint/parser',
            targetVersion: '8.46.0',
            manifestDependencies: { '@typescript-eslint/parser': '^8.45.0', eslint: '^9.10.0' },
            relatedVersions: { eslint: '9.10.0' },
        }))

        expect(plan?.pendingPeers).toEqual([
            { packageName: '@typescript-eslint/parser', version: '8.46.0', target: 'member' },
        ])
        expect(plan?.updates).toEqual([])
    })

    it('requests related-package peer metadata for ts-jest compatibility checks', () => {
        const plan = planFamilyUpgrade(input({
            packageName: 'jest',
            targetVersion: '30.0.0',
            manifestDependencies: { jest: '^29.7.0', 'ts-jest': '^29.1.0' },
            relatedVersions: { 'ts-jest': '29.1.0' },
        }))

        expect(plan?.pendingPeers).toEqual([
            { packageName: 'ts-jest', version: '29.1.0', target: 'related' },
        ])
        expect(plan?.updates).toEqual([])
    })

    it('only validates peers for members that are actually being upgraded', () => {
        const plan = planFamilyUpgrade(input({
            packageName: '@typescript-eslint/parser',
            targetVersion: '8.46.0',
            manifestDependencies: { '@typescript-eslint/parser': '^8.46.0', eslint: '^10.0.0' },
            resolvedMembers: {
                '@typescript-eslint/parser': {
                    version: '8.46.0',
                    peerDependencies: { eslint: '^8.57.0 || ^9.0.0' },
                },
            },
            relatedVersions: { eslint: '10.0.0' },
        }))

        expect(plan?.peerViolation).toBeUndefined()
        expect(plan?.untouched).toContain('@typescript-eslint/parser')
    })

    it('records unparseable peer ranges as skipped instead of blocking the upgrade', () => {
        const plan = planFamilyUpgrade(input({
            packageName: '@typescript-eslint/parser',
            targetVersion: '8.46.0',
            manifestDependencies: { '@typescript-eslint/parser': '^8.45.0', eslint: '^9.10.0' },
            resolvedMembers: {
                '@typescript-eslint/parser': {
                    version: '8.46.0',
                    peerDependencies: { eslint: 'not-a-valid-range' },
                },
            },
            relatedVersions: { eslint: '9.10.0' },
        }))

        expect(plan?.peerViolation).toBeUndefined()
        expect(plan?.peerCheckSkipped).toHaveLength(1)
        expect(plan?.updates.map((update) => update.packageName)).toEqual(['@typescript-eslint/parser'])
    })

    it('gives explicit group targets precedence over registry resolution', () => {
        const plan = planFamilyUpgrade(input({
            packageName: 'vitest',
            targetVersion: '4.0.1',
            manifestDependencies: { vitest: '^3.2.4', '@vitest/coverage-v8': '^3.2.4' },
            alertTargets: { '@vitest/coverage-v8': '4.2.0' },
        }))

        expect(plan?.updates).toEqual([
            { packageName: 'vitest', fromVersion: '^3.2.4', targetVersion: '4.0.1', isMajor: true },
            { packageName: '@vitest/coverage-v8', fromVersion: '^3.2.4', targetVersion: '4.2.0', isMajor: true },
        ])
        expect(plan?.pendingMembers).toEqual([])
    })

    it('abandons the whole family when override-protect hits any member', () => {
        const plan = planFamilyUpgrade(input({
            packageName: 'vitest',
            targetVersion: '4.0.1',
            manifestDependencies: { vitest: '^3.2.4', '@vitest/coverage-v8': '^3.2.4' },
            protectedMembers: ['@vitest/coverage-v8'],
        }))

        expect(plan?.blocked).toEqual({ reason: 'override-protected', members: ['@vitest/coverage-v8'] })
        expect(plan?.updates).toEqual([])
    })

    it('does not rewrite protocol declarations (workspace: / catalog:)', () => {
        const plan = planFamilyUpgrade(input({
            packageName: 'react',
            targetVersion: '19.0.0',
            manifestDependencies: { react: '^18.2.0', 'react-dom': 'workspace:*' },
        }))

        expect(plan?.updates.map((update) => update.packageName)).toEqual(['react'])
        expect(plan?.protocolMembers).toEqual(['react-dom'])
        expect(plan?.skipped).toEqual(['@types/react', '@types/react-dom'])
    })

    it('locks typescript-eslint members to the same exact version', () => {
        const plan = planFamilyUpgrade(input({
            packageName: '@typescript-eslint/parser',
            targetVersion: '8.46.0',
            manifestDependencies: {
                '@typescript-eslint/parser': '^8.46.0',
                '@typescript-eslint/eslint-plugin': '^8.45.0',
                'typescript-eslint': '^8.46.0',
            },
            resolvedMembers: {
                '@typescript-eslint/eslint-plugin': { version: '8.46.0' },
            },
        }))

        expect(plan?.updates).toEqual([
            {
                packageName: '@typescript-eslint/eslint-plugin',
                fromVersion: '^8.45.0',
                targetVersion: '8.46.0',
                isMajor: false,
            },
        ])
        expect(plan?.untouched).toEqual(expect.arrayContaining(['@typescript-eslint/parser', 'typescript-eslint']))
    })
})
