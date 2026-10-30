import type { MigrationInterface, QueryRunner } from 'typeorm'
import { addColumnIfMissing, dropColumnIfExists } from './migration-helpers'

/**
 * ScanRun 新增「交付 PR 编号」列（M51.3 a：PR 回环反馈的观察态锚点）。
 *
 * - scan_run：pr_number integer NULL — `fix-and-pr` 交付创建的 PR 编号（新建或命中同内容 PR）
 *
 * 存量行为 NULL（不回填）：非 PR 交付与历史 run 不进入观察态。
 * 口径见 [pr-feedback-loop.md §3](../../../../../docs/design/governance/pr-feedback-loop.md)。
 *
 * **列名必须用 snake_case**：raw SQL 走 `queryRunner.query()` 不经过 `SnakeCaseNamingStrategy`。
 */
export class AddScanRunPrNumber2900000000001 implements MigrationInterface {
    name = 'AddScanRunPrNumber2900000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await addColumnIfMissing(queryRunner, 'scan_run', 'pr_number', 'pr_number integer NULL')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await dropColumnIfExists(queryRunner, 'scan_run', 'pr_number')
    }
}
