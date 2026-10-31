import type { MigrationInterface, QueryRunner } from 'typeorm'
import { addColumnIfMissing, dropColumnIfExists } from './migration-helpers'

/**
 * ScanRun 新增「构建版本回执」两列。
 *
 * 涉及 1 张表（幂等 + 前缀感知：表名经 `entityPrefix` 解析，列缺失才 ALTER）：
 * - scan_run：build_version varchar(64) NULL — 本次运行所在构建产物版本（未注入为 `unknown`）
 * - scan_run：build_commit varchar(64) NULL — 本次运行所在构建产物 commit（未注入为 `unknown`）
 *
 * 取值来源 `runtimeConfig.buildVersion/buildCommit`（与 `/api/health`、启动 `[build]` 行同源）；
 * 存量行为 NULL（不回填，UI 按「未知」降级）。
 * 口径见 [platform.md](../../../../../docs/standards/platform.md) §10.7
 * 与 [run-failure-taxonomy.md §5.11](../../../../../docs/design/governance/run-failure-taxonomy.md)。
 *
 * **列名必须用 snake_case**：raw SQL 走 `queryRunner.query()` 不经过 `SnakeCaseNamingStrategy`。
 */
export class AddScanRunBuildColumns2900000000000 implements MigrationInterface {
    name = 'AddScanRunBuildColumns2900000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await addColumnIfMissing(queryRunner, 'scan_run', 'build_version', 'build_version varchar(64) NULL')
        await addColumnIfMissing(queryRunner, 'scan_run', 'build_commit', 'build_commit varchar(64) NULL')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await dropColumnIfExists(queryRunner, 'scan_run', 'build_commit')
        await dropColumnIfExists(queryRunner, 'scan_run', 'build_version')
    }
}
