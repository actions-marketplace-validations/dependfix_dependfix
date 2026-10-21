import {
    Column,
    Entity,
    Index,
} from 'typeorm'
import { BaseEntity } from './base-entity'

/** 可配置的业务通知类别（平台事件必选，不落个人偏好）。 */
export type NotificationPreferenceCategory = 'security_high' | 'run_failure' | 'run_completed' | 'weekly_digest'

export const NOTIFICATION_PREFERENCE_CATEGORIES: readonly NotificationPreferenceCategory[] = [
    'security_high',
    'run_failure',
    'run_completed',
    'weekly_digest',
] as const

/**
 * 个人通知偏好（每用户每类别每渠道一行；缺行 = 按角色默认值）。
 *
 * 索引：类级复合唯一索引 `(userId, category, channel)`，防止重复 upsert 产生多行。
 * TypeORM 1.x 列级复合 `@Index([...])` 会生成单列索引，故必须类级声明。
 */
@Entity('notification_preference')
@Index('idx_notification_pref_user_category_channel', ['userId', 'category', 'channel'], { unique: true })
export class NotificationPreference extends BaseEntity {
    @Column({ type: 'varchar', length: 36 })
    userId!: string

    @Column({ type: 'varchar', length: 32 })
    category!: NotificationPreferenceCategory

    @Column({ type: 'varchar', length: 16, default: 'email' })
    channel!: 'email'

    @Column({ type: 'boolean', default: false })
    enabled!: boolean
}
