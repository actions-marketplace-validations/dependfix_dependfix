import type { MigrationInterface, QueryRunner } from 'typeorm'
import { addColumnIfMissing, dropColumnIfExists } from './migration-helpers'

/**
 * ScanRun 新增「执行资源 / OOM 归因」四列。
 *
 * 涉及 1 张表（幂等 + 前缀感知：表名经 `entityPrefix` 解析，列缺失才 ALTER）：
 * - scan_run：memory_max_bytes bigint NULL — 执行窗口 cgroup 内存上限（字节）
 * - scan_run：peak_rss_bytes bigint NULL — cgroup memory.current 采样峰值
 * - scan_run：oom_killed boolean NULL — 执行前后 oom_kill 计数是否增加（null = 不可采集）
 * - scan_run：resource_json text NULL — 采集来源 / 采样次数 / 降级原因 / SIGKILL 辅助信号
 *
 * 口径见 [executor-process-isolation.md §8.4](../../../../../docs/design/governance/executor-process-isolation.md)。
 * **列名必须用 snake_case**：raw SQL 走 `queryRunner.query()` 不经过 `SnakeCaseNamingStrategy`。
 */
export class AddScanRunResourceColumns2800000000000 implements MigrationInterface {
    name = 'AddScanRunResourceColumns2800000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await addColumnIfMissing(queryRunner, 'scan_run', 'memory_max_bytes', 'memory_max_bytes bigint NULL')
        await addColumnIfMissing(queryRunner, 'scan_run', 'peak_rss_bytes', 'peak_rss_bytes bigint NULL')
        await addColumnIfMissing(queryRunner, 'scan_run', 'oom_killed', 'oom_killed boolean NULL')
        await addColumnIfMissing(queryRunner, 'scan_run', 'resource_json', 'resource_json text NULL')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await dropColumnIfExists(queryRunner, 'scan_run', 'resource_json')
        await dropColumnIfExists(queryRunner, 'scan_run', 'oom_killed')
        await dropColumnIfExists(queryRunner, 'scan_run', 'peak_rss_bytes')
        await dropColumnIfExists(queryRunner, 'scan_run', 'memory_max_bytes')
    }
}
