// 验证命令脚本存在性校验：缺失 / 解析失败 / 原型链键名的降级口径。
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readPackageScripts, validateVerifyCommands } from './validate-commands'

describe('readPackageScripts / validateVerifyCommands', () => {
    let workDir: string

    beforeEach(() => {
        workDir = mkdtempSync(join(tmpdir(), 'dependfix-validate-commands-'))
    })

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true })
    })

    it('package.json 缺失 → 返回空映射（脚本引用照旧 skip，非脚本命令保留；与重构前等价）', () => {
        expect(readPackageScripts(workDir)).toEqual({})
        expect(validateVerifyCommands(['pnpm lint', 'pnpm install --frozen-lockfile'], workDir)).toEqual({
            valid: ['pnpm install --frozen-lockfile'],
            skipped: ['pnpm lint'],
        })
    })

    it('package.json 解析失败 → undefined（不校验，全部有效）', () => {
        writeFileSync(join(workDir, 'package.json'), '{ broken')

        expect(readPackageScripts(workDir)).toBeUndefined()
        expect(validateVerifyCommands(['pnpm lint'], workDir)).toEqual({ valid: ['pnpm lint'], skipped: [] })
    })

    it('按 scripts 跳过缺失脚本；原型链键名不得被误判为存在', () => {
        writeFileSync(join(workDir, 'package.json'), JSON.stringify({
            name: 'fixture',
            scripts: { lint: 'eslint .', empty: '' },
        }))

        const result = validateVerifyCommands(
            ['pnpm lint', 'pnpm test', 'pnpm empty', 'pnpm constructor', 'pnpm toString'],
            workDir,
        )

        expect(result.valid).toEqual(['pnpm lint'])
        expect(result.skipped).toEqual(['pnpm test', 'pnpm empty', 'pnpm constructor', 'pnpm toString'])
    })
})
