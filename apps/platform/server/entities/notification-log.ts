import {
    Column,
    Entity,
    Index,
} from 'typeorm'
import { BaseEntity } from './base-entity'

/** 投递记录状态（含所有跳过原因，便于 /notifications 审计）。 */
export type NotificationLogStatus =
    | 'sending'
    | 'sent'
    | 'noop'
    | 'failed'
    | 'skipped_duplicate'
    | 'skipped_cooldown'
    | 'skipped_throttled'
    | 'skipped_no_recipient'

/** 通知范围类型：平台事件 / 单仓 run / 批次 / 周报。 */
export type NotificationScopeType = 'platform' | 'run' | 'batch' | 'digest'

/**
 * 通知投递记录。
 *
 * `deliveryKey` 唯一约束用于并发占位：仅实际投递尝试（sending / sent）写入；
 * `noop` / `skipped_*` / `failed` 不占用，便于后续重试。
 */
@Entity('notification_log')
@Index('idx_notification_log_delivery_key', ['deliveryKey'], { unique: true })
@Index('idx_notification_log_created', ['createdAt'])
@Index('idx_notification_log_scope', ['scopeType', 'scopeId', 'category'])
export class NotificationLog extends BaseEntity {
    @Column({ type: 'varchar', length: 128, nullable: true })
    deliveryKey!: string | null

    @Column({ type: 'varchar', length: 32 })
    category!: string

    @Column({ type: 'varchar', length: 16 })
    scopeType!: NotificationScopeType

    @Column({ type: 'varchar', length: 64 })
    scopeId!: string

    @Column({ type: 'varchar', length: 16 })
    channel!: string

    @Column({ type: 'varchar', length: 32, nullable: true })
    fingerprint!: string | null

    /** 周报按用户逐封投递时写入；其余类别一封多收件人为 null。 */
    @Column({ type: 'varchar', length: 36, nullable: true })
    recipientUserId!: string | null

    @Column({ type: 'text' })
    recipientsJson!: string

    @Column({ type: 'varchar', length: 32 })
    status!: NotificationLogStatus

    @Column({ type: 'text', nullable: true })
    errorMessage!: string | null

    @Column({ type: 'datetime', nullable: true })
    sentAt!: Date | null
}
