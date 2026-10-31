import type { MigrationInterface, QueryRunner } from 'typeorm'
import { addColumnIfMissing, dropColumnIfExists } from './migration-helpers'

/**
 * PRCheck 新增构建 / 部署信号三列（PR Check 扩展为三源信号聚合层，M43.2b）。
 *
 * 涉及 1 张表（幂等 + 前缀感知：表名经 `entityPrefix` 解析，列缺失才 ALTER）：
 * - pr_check：signals_json (text NULL) — 归一化三源信号快照（JSON 数组）
 * - pr_check：overall_status (varchar(16) NULL) — 聚合状态 failure / pending / success
 * - pr_check：failure_sources_json (text NULL) — 失败源清单（JSON 数组，去重）
 *
 * 口径见 [pr-build-deploy-signals.md §3.2 / §3.7 / §4](../../../../docs/design/governance/pr-build-deploy-signals.md)，
 * 落库实现见 `server/services/monitor/action-status-monitor.ts`。
 *
 * **不建索引**：三列均为展示 / 诊断载荷，无按列过滤查询；单组织 PRCheck 量级小（列表上限 500），
 * 新增索引会与基线迁移（实体元数据驱动）产生同名漂移，收益不足。后续如需按 provider / 状态筛选再单独加索引迁移。
 *
 * **列名必须用 snake_case**：raw SQL 走 `queryRunner.query()` 不经过 `SnakeCaseNamingStrategy`，
 * 业务表实际列名为 snake_case（详见开发规范 §5.1.19）。
 *
 * 存量行不回填：历史行三列为 NULL（语义为「本列上线前采集」），下次轮询该 PR 时自然回填。
 */
export class AddPrCheckBuildSignals2300000000000 implements MigrationInterface {
    name = 'AddPrCheckBuildSignals2300000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await addColumnIfMissing(queryRunner, 'pr_check', 'signals_json', 'signals_json text NULL')
        await addColumnIfMissing(queryRunner, 'pr_check', 'overall_status', 'overall_status varchar(16) NULL')
        await addColumnIfMissing(queryRunner, 'pr_check', 'failure_sources_json', 'failure_sources_json text NULL')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await dropColumnIfExists(queryRunner, 'pr_check', 'failure_sources_json')
        await dropColumnIfExists(queryRunner, 'pr_check', 'overall_status')
        await dropColumnIfExists(queryRunner, 'pr_check', 'signals_json')
    }
}
