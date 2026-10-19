import type { MigrationInterface, QueryRunner } from 'typeorm'
import { addColumnIfMissing, dropColumnIfExists } from './migration-helpers'

/**
 * Repository 新增 PR Check 告警关注集列。
 *
 * 涉及 1 张表（幂等 + 前缀感知：表名经 `entityPrefix` 解析，列缺失才 ALTER）：
 * - repository：pr_check_focus (text NULL)
 *   · JSON 字符串：`{ providers?: string[], names?: string[], kinds?: string[] }`
 *   · null = 未配置 = 全量只报警不阻断（现状）
 *
 * 口径见 [pr-build-deploy-signals.md §9](../../../../../docs/design/governance/pr-build-deploy-signals.md)；
 * 落库实现见 `server/api/repos/**`，生效层见 `server/services/monitor/action-status-monitor.ts`。
 *
 * 列名按 snake_case（raw SQL 不经过 `SnakeCaseNamingStrategy`）。不建索引：该列只在仓库加载时
 * 随行读取，无按值过滤查询。
 *
 * 存量行不回填：历史仓库该列为 NULL，语义即「未配置关注集」，行为与改动前完全一致。
 */
export class AddRepositoryPrCheckFocus2500000000000 implements MigrationInterface {
    name = 'AddRepositoryPrCheckFocus2500000000000'

    async up(queryRunner: QueryRunner): Promise<void> {
        await addColumnIfMissing(queryRunner, 'repository', 'pr_check_focus', 'pr_check_focus text')
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await dropColumnIfExists(queryRunner, 'repository', 'pr_check_focus')
    }
}
