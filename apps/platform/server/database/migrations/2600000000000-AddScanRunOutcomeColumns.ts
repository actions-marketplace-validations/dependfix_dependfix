import type { MigrationInterface, QueryRunner } from 'typeorm'
import { addColumnIfMissing, dropColumnIfExists } from './migration-helpers'

/**
 * ScanRun 新增「运行结果可信度」两列。
 *
 * 涉及 1 张表（幂等 + 前缀感知：表名经 `entityPrefix` 解析，列缺失才 ALTER）：
 * - scan_run：exit_code integer NULL — 引擎进程级退出码（0 / 1 / 2；B 模式与旧数据为 NULL）
 * - scan_run：environmental_failure_count integer NULL — 环境性失败事件数（无 result 的失败为 NULL）
 *
 * 口径见 [platform.md §6.2](../../../../docs/standards/platform.md)：
 * 环境性失败不归因本次运行，但仍需在运行列表 / 详情可见；`exit_code` 提供可查询的进程级事实。
 *
 * **列名必须用 snake_case**：raw SQL 走 `queryRunner.query()` 不经过 `SnakeCaseNamingStrategy`，
 * 业务表实际列名为 snake_case（详见开发规范 §5.1.19）。
 */
export class AddScanRunOutcomeColumns2600000000000 implements MigrationInterface {
    name = 'AddScanRunOutcomeColumns2600000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await addColumnIfMissing(queryRunner, 'scan_run', 'exit_code', 'exit_code integer NULL')
        await addColumnIfMissing(queryRunner, 'scan_run', 'environmental_failure_count', 'environmental_failure_count integer NULL')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await dropColumnIfExists(queryRunner, 'scan_run', 'environmental_failure_count')
        await dropColumnIfExists(queryRunner, 'scan_run', 'exit_code')
    }
}
