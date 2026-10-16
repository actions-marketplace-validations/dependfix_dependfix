import type { MigrationInterface, QueryRunner } from 'typeorm'
import { addColumnIfMissing, dropColumnIfExists } from './migration-helpers'

/**
 * ScanRun 新增「重试来源」列（运行失败「受约束重试入口」）。
 *
 * 涉及 1 张表（幂等 + 前缀感知：表名经 `entityPrefix` 解析，列缺失才 ALTER）：
 * - scan_run：retried_from_run_id (varchar(64) NULL) — 本 run 由重试入口触发时的来源 run id
 *
 * 口径见 [run-failure-taxonomy.md §5.5](../../../../docs/design/governance/run-failure-taxonomy.md)；
 * 写入方为 `POST /api/runs/[id]/retry`（服务端校验来源后写入，前端不可声明）。
 *
 * **不建索引**：当前唯一消费面是详情视图按 id 读取来源展示，与「失败三列不建索引」同族判断。
 *
 * **列名必须用 snake_case**：raw SQL 走 `queryRunner.query()` 不经过 `SnakeCaseNamingStrategy`，
 * 业务表实际列名为 snake_case（详见开发规范 §5.1.19）。
 */
export class AddScanRunRetriedFromRunId2400000000000 implements MigrationInterface {
    name = 'AddScanRunRetriedFromRunId2400000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await addColumnIfMissing(queryRunner, 'scan_run', 'retried_from_run_id', 'retried_from_run_id varchar(64) NULL')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await dropColumnIfExists(queryRunner, 'scan_run', 'retried_from_run_id')
    }
}
