import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
    HTTP_ONLY_PLUGINS,
    isQueueWorkerProcess,
    NON_HTTP_ONLY_PLUGINS,
    parseProcessRole,
    PROCESS_ROLE_ENV,
    shouldSkipHttpOnlyPlugin,
    unknownProcessRoleValue,
} from './process-role'

/**
 * 进程角色判定单测：三态（server / worker / 未设置）判定 + 未识别值的 fail-safe 方向
 * + HTTP-only 插件清单与插件守卫的一致性（防「清单声明了但插件没守卫」）。
 * 口径见 docs/standards/platform.md §10.6。
 */

const PLUGINS_DIR = join(import.meta.dirname, '..', 'plugins')

const makeLog = () => ({
    info: vi.fn(),
    warn: vi.fn(),
})

describe('parseProcessRole / unknownProcessRoleValue', () => {
    it('worker 判为 worker（容忍大小写与空白）', () => {
        expect(parseProcessRole('worker')).toBe('worker')
        expect(parseProcessRole(' WORKER ')).toBe('worker')
    })

    it('server / 未设置 / 空串 / 未识别值一律判为 server（fail-safe 方向）', () => {
        for (const raw of ['server', undefined, '', '   ', 'queue', '1']) {
            expect(parseProcessRole(raw), `raw=${String(raw)}`).toBe('server')
        }
    })

    it('未识别值原样返回（合法值与未设置返回 null）', () => {
        expect(unknownProcessRoleValue('queue')).toBe('queue')
        expect(unknownProcessRoleValue(' worker ')).toBeNull()
        expect(unknownProcessRoleValue('server')).toBeNull()
        expect(unknownProcessRoleValue(undefined)).toBeNull()
        expect(unknownProcessRoleValue(' ')).toBeNull()
    })
})

describe('isQueueWorkerProcess / shouldSkipHttpOnlyPlugin', () => {
    it('三态判定：worker 跳过；server 与未设置不跳过', () => {
        expect(isQueueWorkerProcess({ [PROCESS_ROLE_ENV]: 'worker' })).toBe(true)
        expect(isQueueWorkerProcess({ [PROCESS_ROLE_ENV]: 'server' })).toBe(false)
        expect(isQueueWorkerProcess({})).toBe(false)
    })

    it('worker：返回 true 并输出一行跳过日志（供启动日志核对）', () => {
        const log = makeLog()
        expect(shouldSkipHttpOnlyPlugin('stale-cleanup', { [PROCESS_ROLE_ENV]: 'worker' }, log)).toBe(true)
        expect(log.info).toHaveBeenCalledTimes(1)
        expect(String(log.info.mock.calls[0]![0])).toContain('stale-cleanup')
        expect(log.warn).not.toHaveBeenCalled()
    })

    it('server / 未设置：返回 false 且不输出任何日志', () => {
        for (const env of [{ [PROCESS_ROLE_ENV]: 'server' }, {}]) {
            const log = makeLog()
            expect(shouldSkipHttpOnlyPlugin('build-info', env, log)).toBe(false)
            expect(log.info).not.toHaveBeenCalled()
            expect(log.warn).not.toHaveBeenCalled()
        }
    })

    it('未识别值：不跳过 + 一行 warn（不静默停用清理）', () => {
        const log = makeLog()
        expect(shouldSkipHttpOnlyPlugin('build-info', { [PROCESS_ROLE_ENV]: 'queue' }, log)).toBe(false)
        expect(log.warn).toHaveBeenCalledTimes(1)
        expect(String(log.warn.mock.calls[0]![0])).toContain('queue')
        expect(log.info).not.toHaveBeenCalled()
    })
})

describe('插件分类一致性', () => {
    it('清单内每个插件均在源码中调用守卫（防「声明了但没跳过」）', () => {
        for (const name of HTTP_ONLY_PLUGINS) {
            const source = readFileSync(join(PLUGINS_DIR, `${name}.ts`), 'utf8')
            expect(source, `${name}.ts 应调用 shouldSkipHttpOnlyPlugin('${name}')`).toContain(
                `shouldSkipHttpOnlyPlugin('${name}')`,
            )
        }
    })

    it('插件目录内每个 nitro 插件都已分类（新增插件必须显式判定）', () => {
        const classified = new Set<string>([...HTTP_ONLY_PLUGINS, ...NON_HTTP_ONLY_PLUGINS])
        const pluginFiles = readdirSync(PLUGINS_DIR).filter(
            (file) => file.endsWith('.ts') && !file.endsWith('.test.ts'),
        )
        expect(pluginFiles.length).toBeGreaterThan(0)
        for (const file of pluginFiles) {
            const name = file.replace(/\.ts$/, '')
            expect(classified.has(name), `${name} 未分类：须登记为 HTTP-only 或非 HTTP-only（platform.md §10.6）`).toBe(true)
        }
    })
})
