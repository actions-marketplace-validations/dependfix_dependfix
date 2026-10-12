import 'reflect-metadata'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import betterSqlite3 from 'better-sqlite3'
import { DataSource, type QueryRunner } from 'typeorm'
import { afterEach, describe, expect, it } from 'vitest'
import { AddPrCheckBuildSignals2300000000000 } from './2300000000000-AddPrCheckBuildSignals'

/**
 * PRCheck 构建 / 部署信号三列迁移的正确性 + 幂等性（口径见 pr-build-deploy-signals.md §4 / §3.7）。
 *
 * 覆盖点：
 * 1. 默认前缀 `dependfix_` 下真正生效（前缀感知，非静默 no-op）
 * 2. 无前缀表名（DATABASE_ENTITY_PREFIX=''）下同样生效
 * 3. up / down 各自幂等（二次运行不抛错）
 * 4. 目标表不存在时 no-op（不抛错）
 * 5. 前缀表与无前缀表并存时优先前缀表（不回落到无前缀表）
 */
describe('AddPrCheckBuildSignals migration', () => {
    let dir: string | undefined
    const dataSources: DataSource[] = []

    const makeDataSource = async (entityPrefix: string): Promise<DataSource> => {
        dir = await mkdtemp(join(tmpdir(), 'dependfix-pr-check-signals-'))
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

    const SIGNAL_COLUMNS = ['signals_json', 'overall_status', 'failure_sources_json']

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

    it('adds the three signal columns under the default dependfix_ prefix', async () => {
        const ds = await makeDataSource('dependfix_')
        await ds.query('CREATE TABLE dependfix_pr_check (id varchar(36) PRIMARY KEY, conclusion varchar(32))')

        await withRunner(ds, (runner) => new AddPrCheckBuildSignals2300000000000().up(runner))

        const names = await columnNames(ds, 'dependfix_pr_check')
        expect(names).toEqual(expect.arrayContaining(SIGNAL_COLUMNS))
    })

    it('adds the columns when prefix is empty', async () => {
        const ds = await makeDataSource('')
        await ds.query('CREATE TABLE pr_check (id varchar(36) PRIMARY KEY, conclusion varchar(32))')

        await withRunner(ds, (runner) => new AddPrCheckBuildSignals2300000000000().up(runner))

        const names = await columnNames(ds, 'pr_check')
        expect(names).toEqual(expect.arrayContaining(SIGNAL_COLUMNS))
    })

    it('is idempotent: up twice adds each column exactly once without throwing', async () => {
        const ds = await makeDataSource('dependfix_')
        await ds.query('CREATE TABLE dependfix_pr_check (id varchar(36) PRIMARY KEY)')
        const migration = new AddPrCheckBuildSignals2300000000000()

        await withRunner(ds, async (runner) => {
            await migration.up(runner)
            await migration.up(runner)
        })

        const names = await columnNames(ds, 'dependfix_pr_check')
        for (const column of SIGNAL_COLUMNS) {
            expect(names.filter((n) => n === column), column).toHaveLength(1)
        }
    })

    it('down drops the columns and is idempotent', async () => {
        const ds = await makeDataSource('dependfix_')
        await ds.query('CREATE TABLE dependfix_pr_check (id varchar(36) PRIMARY KEY)')
        const migration = new AddPrCheckBuildSignals2300000000000()

        await withRunner(ds, async (runner) => {
            await migration.up(runner)
            await migration.down(runner)
            await migration.down(runner)
        })

        const names = await columnNames(ds, 'dependfix_pr_check')
        for (const column of SIGNAL_COLUMNS) {
            expect(names).not.toContain(column)
        }
    })

    it('prefers the prefixed table when both prefixed and unprefixed tables exist', async () => {
        const ds = await makeDataSource('dependfix_')
        await ds.query('CREATE TABLE dependfix_pr_check (id varchar(36) PRIMARY KEY)')
        await ds.query('CREATE TABLE pr_check (id varchar(36) PRIMARY KEY)')

        await withRunner(ds, (runner) => new AddPrCheckBuildSignals2300000000000().up(runner))

        expect(await columnNames(ds, 'dependfix_pr_check')).toEqual(expect.arrayContaining(SIGNAL_COLUMNS))
        expect(await columnNames(ds, 'pr_check')).not.toEqual(expect.arrayContaining(SIGNAL_COLUMNS))
    })

    it('is a no-op when the target table does not exist', async () => {
        const ds = await makeDataSource('dependfix_')

        await expect(
            withRunner(ds, (runner) => new AddPrCheckBuildSignals2300000000000().up(runner)),
        ).resolves.toBeUndefined()
        await expect(
            withRunner(ds, (runner) => new AddPrCheckBuildSignals2300000000000().down(runner)),
        ).resolves.toBeUndefined()
    })
})
