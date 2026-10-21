import 'reflect-metadata'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import betterSqlite3 from 'better-sqlite3'
import { DataSource, type QueryRunner } from 'typeorm'
import { afterEach, describe, expect, it } from 'vitest'
import { AddScanRunResourceColumns2800000000000 } from './2800000000000-AddScanRunResourceColumns'

describe('AddScanRunResourceColumns migration', () => {
    let dir: string | undefined
    const dataSources: DataSource[] = []
    const COLUMNS = ['memory_max_bytes', 'peak_rss_bytes', 'oom_killed', 'resource_json'] as const

    const makeDataSource = async (entityPrefix: string): Promise<DataSource> => {
        dir = await mkdtemp(join(tmpdir(), 'dependfix-scan-run-resource-'))
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

    const columnNames = async (ds: DataSource, table: string): Promise<string[]> => {
        const rows = await ds.query(`PRAGMA table_info('${table}')`) as { name: string }[]
        return rows.map((r) => r.name)
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

    it('adds all columns under the default dependfix_ prefix', async () => {
        const ds = await makeDataSource('dependfix_')
        await ds.query('CREATE TABLE dependfix_scan_run (id varchar(36) PRIMARY KEY)')

        await withRunner(ds, (runner) => new AddScanRunResourceColumns2800000000000().up(runner))

        const names = await columnNames(ds, 'dependfix_scan_run')
        for (const column of COLUMNS) {
            expect(names).toContain(column)
        }
    })

    it('is idempotent for up and down', async () => {
        const ds = await makeDataSource('dependfix_')
        await ds.query('CREATE TABLE dependfix_scan_run (id varchar(36) PRIMARY KEY)')
        const migration = new AddScanRunResourceColumns2800000000000()

        await withRunner(ds, async (runner) => {
            await migration.up(runner)
            await migration.up(runner)
            await migration.down(runner)
            await migration.down(runner)
        })

        expect(await columnNames(ds, 'dependfix_scan_run')).toEqual(['id'])
    })

    it('prefers the prefixed table when both exist', async () => {
        const ds = await makeDataSource('dependfix_')
        await ds.query('CREATE TABLE dependfix_scan_run (id varchar(36) PRIMARY KEY)')
        await ds.query('CREATE TABLE scan_run (id varchar(36) PRIMARY KEY)')

        await withRunner(ds, (runner) => new AddScanRunResourceColumns2800000000000().up(runner))

        const prefixed = await columnNames(ds, 'dependfix_scan_run')
        const unprefixed = await columnNames(ds, 'scan_run')
        for (const column of COLUMNS) {
            expect(prefixed).toContain(column)
            expect(unprefixed).not.toContain(column)
        }
    })

    it('is a no-op when the target table does not exist', async () => {
        const ds = await makeDataSource('dependfix_')
        await expect(
            withRunner(ds, (runner) => new AddScanRunResourceColumns2800000000000().up(runner)),
        ).resolves.toBeUndefined()
        await expect(
            withRunner(ds, (runner) => new AddScanRunResourceColumns2800000000000().down(runner)),
        ).resolves.toBeUndefined()
    })
})
