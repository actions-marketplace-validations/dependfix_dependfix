import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
    applyOverridesToDocument,
    applyWorkspaceOverrides,
    parseWorkspaceDocument,
    readOverridesSection,
    rollbackWorkspaceOverrides,
    stringifyWorkspaceDocument,
} from './workspace-yaml'
import { writeWorkspaceOverride } from './overrides-io'

const SINGLE_QUOTE = `packages:
  - 'packages/*'

overrides:
  'vite': '^5.0.0'

onlyBuiltDependencies:
  - esbuild
`

const PLAIN = `overrides:
  vite: ^5.0.0 # pinned on purpose
  esbuild: 0.21.5
`

const COMMENTED = `# workspace root
packages:
  - packages/*

# 覆盖条目：顺序不要动
overrides:
  # 构建链
  vite: ^5.0.0

catalog:
  react: ^18.3.1
`

const tempDirs: string[] = []

function tempWorkspace(content: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'dependfix-workspace-yaml-'))
    tempDirs.push(dir)
    const path = join(dir, 'pnpm-workspace.yaml')
    writeFileSync(path, content, 'utf-8')
    return path
}

afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
        try {
            rmSync(dir, { recursive: true, force: true })
        } catch {
            /* ignore */
        }
    }
})

describe('parseWorkspaceDocument', () => {
    it('接受三种常见风格并保留注释 / 引号 / 键序', () => {
        for (const raw of [SINGLE_QUOTE, PLAIN, COMMENTED]) {
            const parsed = parseWorkspaceDocument(raw)
            expect(parsed.ok).toBe(true)
            if (parsed.ok) {
                expect(Object.keys(readOverridesSection(parsed.doc) ?? {})).toEqual(['vite', ...(raw === PLAIN ? ['esbuild'] : [])])
            }
        }
    })

    it('重复键 / 别名 / 顶层非映射 / 非法语法 → 拒绝定点编辑', () => {
        expect(parseWorkspaceDocument('overrides:\n  vite: ^5\n  vite: ^6\n').ok).toBe(false)
        expect(parseWorkspaceDocument('base: &b\n  x: 1\noverrides:\n  vite: *b\n').ok).toBe(false)
        expect(parseWorkspaceDocument('- a\n- b\n').ok).toBe(false)
        expect(parseWorkspaceDocument('overrides: [\n').ok).toBe(false)
    })

    it('空文件视为空映射（可新增 overrides）', () => {
        const parsed = parseWorkspaceDocument('')
        expect(parsed.ok).toBe(true)
        if (parsed.ok) {
            expect(readOverridesSection(parsed.doc)).toEqual({})
        }
    })
})

describe('applyWorkspaceOverrides（定点编辑）', () => {
    it('单引号风格：仅目标键变化，引号与键序不变', () => {
        const path = tempWorkspace(SINGLE_QUOTE)
        const result = applyWorkspaceOverrides(path, [{ key: 'rollup', value: '^4.0.0' }])
        expect(result.ok).toBe(true)
        expect(readFileSync(path, 'utf-8')).toBe(`packages:
  - 'packages/*'

overrides:
  'vite': '^5.0.0'
  rollup: ^4.0.0

onlyBuiltDependencies:
  - esbuild
`)
    })

    it('无引号 + 行内注释：新增键追加在同一映射末尾，既有注释保留', () => {
        const path = tempWorkspace(PLAIN)
        expect(applyWorkspaceOverrides(path, [{ key: 'undici', value: '6.19.2' }]).ok).toBe(true)
        expect(readFileSync(path, 'utf-8')).toBe(`overrides:
  vite: ^5.0.0 # pinned on purpose
  esbuild: 0.21.5
  undici: 6.19.2
`)
    })

    it('含注释文档：段注释 / 段内注释 / 其它顶层段顺序全部保留', () => {
        const path = tempWorkspace(COMMENTED)
        expect(applyWorkspaceOverrides(path, [{ key: 'esbuild', value: '0.21.5' }]).ok).toBe(true)
        expect(readFileSync(path, 'utf-8')).toBe(`# workspace root
packages:
  - packages/*

# 覆盖条目：顺序不要动
overrides:
  # 构建链
  vite: ^5.0.0
  esbuild: 0.21.5

catalog:
  react: ^18.3.1
`)
    })

    it('更新既有键：原位替换值，不改变位置与写法', () => {
        const path = tempWorkspace(SINGLE_QUOTE)
        expect(applyWorkspaceOverrides(path, [{ key: 'vite', value: '^5.1.0' }]).ok).toBe(true)
        const text = readFileSync(path, 'utf-8')
        expect(text).toContain('  \'vite\': \'^5.1.0\'\n')
        expect(text.indexOf('\'vite\'')).toBeLessThan(text.indexOf('onlyBuiltDependencies'))
    })

    it('语义等价 key 复用已有写法（pkg@^1 与 pkg@1 不并存）', () => {
        const path = tempWorkspace('overrides:\n  \'brace-expansion@^1\': 1.1.11\n')
        const result = applyWorkspaceOverrides(path, [{ key: 'brace-expansion@1', value: '1.1.12' }])
        expect(result.ok).toBe(true)
        expect([...result.applied.keys()]).toEqual(['brace-expansion@^1'])
        expect(readFileSync(path, 'utf-8')).toBe('overrides:\n  \'brace-expansion@^1\': 1.1.12\n')
    })

    it('解析失败 / overrides 非映射 → 不写盘（字节级不变）并返回原因', () => {
        const duplicate = tempWorkspace('overrides:\n  vite: ^5\n  vite: ^6\n')
        const before = readFileSync(duplicate, 'utf-8')
        const failed = applyWorkspaceOverrides(duplicate, [{ key: 'vite', value: '^6.0.0' }])
        expect(failed.ok).toBe(false)
        expect(failed.error).toContain('YAML')
        expect(readFileSync(duplicate, 'utf-8')).toBe(before)

        const scalar = tempWorkspace('overrides: "oops"\n')
        const scalarResult = applyWorkspaceOverrides(scalar, [{ key: 'vite', value: '^6.0.0' }])
        expect(scalarResult.ok).toBe(false)
        expect(scalarResult.error).toContain('映射')
        expect(readFileSync(scalar, 'utf-8')).toBe('overrides: "oops"\n')
    })

    it('overrides 段为空值（`overrides:`）→ 物化为映射后写入，回滚不抛', () => {
        const path = tempWorkspace('packages:\n  - \'packages/*\'\n\noverrides:\n')
        const applied = applyWorkspaceOverrides(path, [{ key: 'vite', value: '^5.0.0' }])
        expect(applied.ok).toBe(true)
        expect(readFileSync(path, 'utf-8')).toBe('packages:\n  - \'packages/*\'\n\noverrides:\n  vite: ^5.0.0\n')
        expect(rollbackWorkspaceOverrides(path, applied.applied).ok).toBe(true)
    })

    it('overrides 含非标量值 → 不写盘（旧值无法安全回写）', () => {
        const original = 'overrides:\n  vite:\n    nested: true\n'
        const path = tempWorkspace(original)
        const result = applyWorkspaceOverrides(path, [{ key: 'rollup', value: '^4.0.0' }])
        expect(result.ok).toBe(false)
        expect(readFileSync(path, 'utf-8')).toBe(original)
    })

    it('CRLF 文件沿用 CRLF（不整文件改行尾）', () => {
        const path = tempWorkspace('packages:\r\n  - \'packages/*\'\r\n\r\noverrides:\r\n  vite: ^5.0.0\r\n')
        expect(applyWorkspaceOverrides(path, [{ key: 'rollup', value: '^4.0.0' }]).ok).toBe(true)
        const text = readFileSync(path, 'utf-8')
        expect(text).toContain('overrides:\r\n  vite: ^5.0.0\r\n  rollup: ^4.0.0\r\n')
        expect(text.replace(/\r\n/g, '')).not.toContain('\n')
    })

    it('writeWorkspaceOverride 委托定点编辑：返回旧值且保留文件风格', () => {
        const path = tempWorkspace(SINGLE_QUOTE)
        const result = writeWorkspaceOverride(path, 'vite', '^5.2.0')
        expect(result).toEqual({ ok: true, key: 'vite', oldValue: '^5.0.0' })
        expect(readFileSync(path, 'utf-8')).toContain('  \'vite\': \'^5.2.0\'\n')

        const broken = tempWorkspace('overrides:\n  vite: ^5\n  vite: ^6\n')
        const failed = writeWorkspaceOverride(broken, 'vite', '^6.0.0')
        expect(failed.ok).toBe(false)
        expect(failed.error).toBeTruthy()
    })

    it('归一化命中既有写法时回传实际 key（回滚必须按实际 key）', () => {
        const path = tempWorkspace('overrides:\n  \'vite@^1\': ^1.0.0\n')
        const result = writeWorkspaceOverride(path, 'vite@1', '^1.2.0')
        expect(result).toMatchObject({ ok: true, key: 'vite@^1', oldValue: '^1.0.0' })
        expect(readFileSync(path, 'utf-8')).toBe('overrides:\n  \'vite@^1\': ^1.2.0\n')
    })
})

describe('rollbackWorkspaceOverrides', () => {
    it('新增键回滚后文件字节级还原（含 overrides 段整体移除）', () => {
        const original = 'packages:\n  - \'packages/*\'\n'
        const path = tempWorkspace(original)
        const applied = applyWorkspaceOverrides(path, [{ key: 'vite', value: '^5.0.0' }])
        expect(applied.ok).toBe(true)
        expect(readFileSync(path, 'utf-8')).not.toBe(original)

        expect(rollbackWorkspaceOverrides(path, applied.applied).ok).toBe(true)
        expect(readFileSync(path, 'utf-8')).toBe(original)
    })

    it('更新既有键回滚后恢复旧值，其余内容不变', () => {
        const path = tempWorkspace(SINGLE_QUOTE)
        const applied = applyWorkspaceOverrides(path, [{ key: 'vite', value: '^5.9.9' }])
        expect(applied.ok).toBe(true)

        expect(rollbackWorkspaceOverrides(path, applied.applied).ok).toBe(true)
        expect(readFileSync(path, 'utf-8')).toBe(SINGLE_QUOTE)
    })

    it('回滚失败（文件被改成非法 YAML）不抛错、交由备份还原', () => {
        const path = tempWorkspace(SINGLE_QUOTE)
        writeFileSync(path, 'overrides:\n  vite: ^5\n  vite: ^6\n', 'utf-8')
        const result = rollbackWorkspaceOverrides(path, new Map([['vite', '^5.0.0']]))
        expect(result.ok).toBe(false)
        expect(result.error).toBeTruthy()
    })
})

describe('stringifyWorkspaceDocument', () => {
    it('恰好一个尾随换行', () => {
        const parsed = parseWorkspaceDocument('overrides:\n  vite: ^5.0.0\n\n\n')
        expect(parsed.ok).toBe(true)
        if (parsed.ok) {
            const text = stringifyWorkspaceDocument(parsed.doc)
            expect(text.endsWith('\n')).toBe(true)
            expect(text.endsWith('\n\n')).toBe(false)
        }
    })

    it('applyOverridesToDocument 不修改传入 updates', () => {
        const parsed = parseWorkspaceDocument(PLAIN)
        expect(parsed.ok).toBe(true)
        if (parsed.ok) {
            const updates = [{ key: 'vite', value: '^6.0.0' }]
            applyOverridesToDocument(parsed.doc, updates)
            expect(updates).toEqual([{ key: 'vite', value: '^6.0.0' }])
        }
    })
})
