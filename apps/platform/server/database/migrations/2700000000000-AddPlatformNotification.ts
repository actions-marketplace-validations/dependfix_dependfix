import type { MigrationInterface, QueryRunner } from 'typeorm'
import { addColumnIfMissing, dropColumnIfExists, prefixedTableName } from './migration-helpers'

/**
 * 平台通知与邮件推送承载层：
 * - 新表 notification_preference：个人偏好唯一索引 (user_id, category, channel)
 * - 新表 notification_log：投递记录，delivery_key 唯一（并发占位），created_at 列表索引
 * - organization.notification_settings_json：组织设置 JSON（可空 = 默认）
 * - scan_run.triggered_by_user_id / batch_run.triggered_by_user_id：业务通知定向触发者
 *
 * 全部操作幂等：CREATE TABLE IF NOT EXISTS + 列存在性检查；可重复执行。
 * 列名 / 表名必须 snake_case（raw SQL 不经过 SnakeCaseNamingStrategy）。
 */
export class AddPlatformNotification2700000000000 implements MigrationInterface {
    name = 'AddPlatformNotification2700000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const isPostgres = queryRunner.dataSource.options.type === 'postgres'
        const dateType = isPostgres ? 'timestamptz' : 'datetime'
        const boolDefault = isPostgres ? 'false' : '(0)'
        const prefTable = prefixedTableName(queryRunner, 'notification_preference')
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS ${prefTable} (
                id varchar(36) NOT NULL PRIMARY KEY,
                user_id varchar(36) NOT NULL,
                category varchar(32) NOT NULL,
                channel varchar(16) NOT NULL DEFAULT 'email',
                enabled boolean NOT NULL DEFAULT ${boolDefault},
                created_at ${dateType} NOT NULL,
                updated_at ${dateType} NOT NULL
            )
        `)
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_pref_user_category_channel
                ON ${prefTable} (user_id, category, channel)
        `)

        const logTable = prefixedTableName(queryRunner, 'notification_log')
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS ${logTable} (
                id varchar(36) NOT NULL PRIMARY KEY,
                delivery_key varchar(128),
                category varchar(32) NOT NULL,
                scope_type varchar(16) NOT NULL,
                scope_id varchar(64) NOT NULL,
                channel varchar(16) NOT NULL,
                fingerprint varchar(32),
                recipient_user_id varchar(36),
                recipients_json text NOT NULL,
                status varchar(32) NOT NULL,
                error_message text,
                sent_at ${dateType},
                created_at ${dateType} NOT NULL,
                updated_at ${dateType} NOT NULL
            )
        `)
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_log_delivery_key
                ON ${logTable} (delivery_key)
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_notification_log_created
                ON ${logTable} (created_at)
        `)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_notification_log_scope
                ON ${logTable} (scope_type, scope_id, category)
        `)

        await addColumnIfMissing(queryRunner, 'organization', 'notification_settings_json', 'notification_settings_json text NULL')
        await addColumnIfMissing(queryRunner, 'scan_run', 'triggered_by_user_id', 'triggered_by_user_id varchar(36) NULL')
        await addColumnIfMissing(queryRunner, 'batch_run', 'triggered_by_user_id', 'triggered_by_user_id varchar(36) NULL')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await dropColumnIfExists(queryRunner, 'batch_run', 'triggered_by_user_id')
        await dropColumnIfExists(queryRunner, 'scan_run', 'triggered_by_user_id')
        await dropColumnIfExists(queryRunner, 'organization', 'notification_settings_json')

        const logTable = prefixedTableName(queryRunner, 'notification_log')
        await queryRunner.query(`DROP INDEX IF EXISTS idx_notification_log_scope`)
        await queryRunner.query(`DROP INDEX IF EXISTS idx_notification_log_created`)
        await queryRunner.query(`DROP INDEX IF EXISTS idx_notification_log_delivery_key`)
        await queryRunner.query(`DROP TABLE IF EXISTS ${logTable}`)

        const prefTable = prefixedTableName(queryRunner, 'notification_preference')
        await queryRunner.query(`DROP INDEX IF EXISTS idx_notification_pref_user_category_channel`)
        await queryRunner.query(`DROP TABLE IF EXISTS ${prefTable}`)
    }
}
