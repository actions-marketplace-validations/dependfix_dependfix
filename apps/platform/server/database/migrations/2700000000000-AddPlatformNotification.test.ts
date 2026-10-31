import 'reflect-metadata'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import betterSqlite3 from 'better-sqlite3'
import { DataSource, type QueryRunner } from 'typeorm'
import { afterEach, describe, expect, it } from 'vitest'
import { AddPlatformNotification2700000000000 } from './2700000000000-AddPlatformNotification'

/**
 * 通知承载层迁移：建表 + 加列 + 唯一索引 + 二次执行幂等 + down 清理。
 * 覆盖默认前缀与空前缀两种形态（与既有同类迁移测试同口径）。
 */
describe('AddPlatformNotification migration', () => {
    let dir: string | undefined
    const dataSources: DataSource[] = []

    const makeDataSource = async (entityPrefix: string): Promise<DataSource> => {
        dir = await mkdtemp(join(tmpdir(), 'dependfix-notification-migration-'))
        const ds = new DataSource({
            type: 'better-sqlite3',
            database: join(dir, 'test.sqlite'),
            driver: betterSqlite3,
            entities: [],
            migrations: [],
            synchronize: false,
            entityPrefix,
        })
        dataSources.push(ds)
        await ds.initialize()
        return ds
    }

    const base = (prefix: string) => ({
        organization: `${prefix}organization`,
        scanRun: `${prefix}scan_run`,
        batchRun: `${prefix}batch_run`,
        preference: `${prefix}notification_preference`,
        log: `${prefix}notification_log`,
    })

    const createBaseTables = async (ds: DataSource, prefix: string) => {
        const t = base(prefix)
        await ds.query(`CREATE TABLE ${t.organization} (id varchar(36) PRIMARY KEY)`)
        await ds.query(`CREATE TABLE ${t.scanRun} (id varchar(36) PRIMARY KEY)`)
        await ds.query(`CREATE TABLE ${t.batchRun} (id varchar(36) PRIMARY KEY)`)
    }

    const columnNames = async (ds: DataSource, table: string): Promise<string[]> => {
        const rows = await ds.query(`PRAGMA table_info('${table}')`) as { name: string }[]
        return rows.map((row) => row.name)
    }

    const tableNames = async (ds: DataSource): Promise<string[]> => {
        const rows = await ds.query(`SELECT name FROM sqlite_master WHERE type = 'table'`) as { name: string }[]
        return rows.map((row) => row.name)
    }

    const withRunner = async <T>(ds: DataSource, fn: (runner: QueryRunner) => Promise<T>): Promise<T> => {
        const runner = ds.createQueryRunner()
        try {
            return await fn(runner)
        } finally {
            await runner.release()
        }
    }

    afterEach(async () => {
        for (const ds of dataSources.splice(0)) {
            if (ds.isInitialized) {
                await ds.destroy()
            }
        }
        if (dir) {
            await rm(dir, { recursive: true, force: true })
            dir = undefined
        }
    })

    it('creates tables, unique delivery key index and trigger columns under default prefix', async () => {
        const ds = await makeDataSource('dependfix_')
        await createBaseTables(ds, 'dependfix_')

        await withRunner(ds, (runner) => new AddPlatformNotification2700000000000().up(runner))

        const t = base('dependfix_')
        expect(await tableNames(ds)).toEqual(expect.arrayContaining([t.preference, t.log]))
        expect(await columnNames(ds, t.organization)).toContain('notification_settings_json')
        expect(await columnNames(ds, t.scanRun)).toContain('triggered_by_user_id')
        expect(await columnNames(ds, t.batchRun)).toContain('triggered_by_user_id')

        const logIndexes = await ds.query(`PRAGMA index_list('${t.log}')`) as { name: string, unique: number }[]
        expect(logIndexes.some((index) => index.name === 'idx_notification_log_delivery_key' && index.unique === 1)).toBe(true)
        const prefIndexes = await ds.query(`PRAGMA index_list('${t.preference}')`) as { name: string, unique: number }[]
        expect(prefIndexes.some((index) => index.name === 'idx_notification_pref_user_category_channel' && index.unique === 1)).toBe(true)
    })

    it('is idempotent: running up twice does not throw or duplicate columns', async () => {
        const ds = await makeDataSource('dependfix_')
        await createBaseTables(ds, 'dependfix_')
        const migration = new AddPlatformNotification2700000000000()

        await withRunner(ds, async (runner) => {
            await migration.up(runner)
            await migration.up(runner)
        })

        const t = base('dependfix_')
        expect((await columnNames(ds, t.organization)).filter((name) => name === 'notification_settings_json')).toHaveLength(1)
        expect((await columnNames(ds, t.scanRun)).filter((name) => name === 'triggered_by_user_id')).toHaveLength(1)
    })

    it('supports empty entity prefix', async () => {
        const ds = await makeDataSource('')
        await createBaseTables(ds, '')

        await withRunner(ds, (runner) => new AddPlatformNotification2700000000000().up(runner))

        const t = base('')
        expect(await tableNames(ds)).toEqual(expect.arrayContaining([t.preference, t.log]))
        expect(await columnNames(ds, t.organization)).toContain('notification_settings_json')
    })

    it('down removes tables, indexes and columns idempotently', async () => {
        const ds = await makeDataSource('dependfix_')
        await createBaseTables(ds, 'dependfix_')
        const migration = new AddPlatformNotification2700000000000()

        await withRunner(ds, async (runner) => {
            await migration.up(runner)
            await migration.down(runner)
            await migration.down(runner)
        })

        const t = base('dependfix_')
        const names = await tableNames(ds)
        expect(names).not.toContain(t.preference)
        expect(names).not.toContain(t.log)
        expect(await columnNames(ds, t.organization)).not.toContain('notification_settings_json')
        expect(await columnNames(ds, t.scanRun)).not.toContain('triggered_by_user_id')
        expect(await columnNames(ds, t.batchRun)).not.toContain('triggered_by_user_id')
    })
})
