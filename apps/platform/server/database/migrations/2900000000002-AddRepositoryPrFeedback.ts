import type { MigrationInterface, QueryRunner } from 'typeorm'
import { addColumnIfMissing, dropColumnIfExists } from './migration-helpers'

/**
 * Repository 新增「PR 回环反馈配置」列。
 *
 * - repository：pr_feedback text NULL — JSON 配置（comment / closeFailed / retryFailed / windowHours）
 *
 * 存量行为 NULL（= 全默认：评论开、关闭与重试关、窗口 24h）。
 * 口径见 [pr-feedback-loop.md §7](../../../../../docs/design/governance/pr-feedback-loop.md)。
 *
 * **列名必须用 snake_case**：raw SQL 走 `queryRunner.query()` 不经过 `SnakeCaseNamingStrategy`。
 */
export class AddRepositoryPrFeedback2900000000002 implements MigrationInterface {
    name = 'AddRepositoryPrFeedback2900000000002'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await addColumnIfMissing(queryRunner, 'repository', 'pr_feedback', 'pr_feedback text NULL')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await dropColumnIfExists(queryRunner, 'repository', 'pr_feedback')
    }
}
