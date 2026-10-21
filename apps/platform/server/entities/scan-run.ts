import {
    Column,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
} from 'typeorm'
import type { RunFailureKind, RunFailureStage } from '../services/run-failure-classify'
import { BaseEntity } from './base-entity'
import { Repository } from './repository'

/** 扫描运行状态 */
export type ScanRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'dispatched' | 'degraded'

/** 扫描运行状态枚举（API 校验用） */
export const SCAN_RUN_STATUSES: readonly ScanRunStatus[] = [
    'pending',
    'running',
    'completed',
    'failed',
    'dispatched',
    'degraded',
] as const

/** 扫描运行记录：一次扫描请求（同步执行模型 Q2，请求内完成） */
@Entity('scan_run')
export class ScanRun extends BaseEntity {
    @Index()
    @Column({ type: 'varchar', length: 36 })
    repositoryId!: string

    @ManyToOne(() => Repository, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'repository_id' })
    repository!: Repository | null

    /** 执行模式（report-only / fix / fix-and-pr） */
    @Column({ type: 'varchar', length: 32 })
    mode!: string

    /** 严重级别阈值 */
    @Column({ type: 'varchar', length: 32 })
    severityThreshold!: string

    /** 执行后端（container / github-action） */
    @Column({ type: 'varchar', length: 32, default: 'container' })
    executorKind!: string

    @Index()
    @Column({ type: 'varchar', length: 32 })
    status!: ScanRunStatus

    @Column({ type: 'datetime', nullable: true })
    startedAt!: Date | null

    @Column({ type: 'datetime', nullable: true })
    finishedAt!: Date | null

    /** 汇总统计（JSON：{repositoriesScanned, alertsFound, alertsFixed, environmentalFailures, ...}） */
    @Column({ type: 'text', nullable: true })
    summaryJson!: string | null

    /**
     * 引擎进程级退出码（0 成功 / 1 部分成功 / 2 全失败或全量回滚）。
     *
     * 仅当执行器产出 result 时落库；无 result 的执行器合成码 2（超时 / 容器不可用 / 交付失败）
     * 不是引擎进程码，不落库。B 模式（github-action）执行器返回的 0 / 2 是触发受理哨兵，
     * 编排层不传递；旧数据同样为 null——消费方须按 null 降级，不得推断为 0。
     */
    @Column({ type: 'integer', nullable: true })
    exitCode!: number | null

    /**
     * 环境性失败事件数（`RunSummary.environmentalFailures` 快照）。
     *
     * 语义为「不归因本次运行的安装环境失败」（信号杀死 / 超时 / 静默非零退出），
     * 与 `status=failed` / `alertsFailed` 独立：completed run 也可能 > 0。
     * 计数只覆盖已落 `ENVIRONMENT_ERROR` 审计条目的路径（lockfile 诊断 / 多版本 / 合批）；
     * 常规分组 / 逐包升级路径尚未分类（见 backlog 候选），计数可能低于真实环境性失败数。
     * 无 result 的失败（如执行超时）为 null；旧数据同为 null，UI 按 0 降级。
     */
    @Column({ type: 'integer', nullable: true })
    environmentalFailureCount!: number | null

    /** 执行级错误（executor error.code/message，非业务失败） */
    @Column({ type: 'text', nullable: true })
    errorJson!: string | null

    /**
     * 失败归一化码（`failure_code`）：原始 `error.code` 或引擎 `FixError.category`，
     * 便于审计；非失败终态为 null。见 [run-failure-taxonomy.md §5.2](../design/governance/run-failure-taxonomy.md)。
     */
    @Column({ type: 'varchar', length: 64, nullable: true })
    failureCode!: string | null

    /** 失败阶段（`failure_stage`）：source / clone / install / fix / verify / deliver / runtime / cleanup / unknown */
    @Column({ type: 'varchar', length: 32, nullable: true })
    failureStage!: RunFailureStage | null

    /** 处置建议（`failure_kind`）：transient（可重试）/ deterministic（需研判）/ unknown */
    @Column({ type: 'varchar', length: 16, nullable: true })
    failureKind!: RunFailureKind | null

    /**
     * 重试来源 run id（`retried_from_run_id`）：本 run 由「受约束重试入口」触发时记录来源 run id，
     * 供审计与详情视图的「来源链」追溯；非重试触发为 null。口径见
     * [run-failure-taxonomy.md §5.5](../design/governance/run-failure-taxonomy.md)。
     *
     * 不加索引：当前唯一消费面是按 id 读取的来源展示，与「失败三列不建索引」同族判断；
     * 后续若出现按来源反查的列表 / 统计需求，再单独加索引迁移。
     */
    @Column({ type: 'varchar', length: 64, nullable: true })
    retriedFromRunId!: string | null

    /**
     * 触发者用户 id（手动触发 / 重试写入；定时与系统触发为 null）。
     * 业务通知定向投递依据；用户删除后保留字符串，不做外键级联。
     */
    @Column({ type: 'varchar', length: 36, nullable: true, name: 'triggered_by_user_id' })
    triggeredByUserId!: string | null

    /** 执行日志（JSON 数组：[{timestamp, level, message, context}]） */
    @Column({ type: 'text', nullable: true })
    logsJson!: string | null

    /**
     * AI 研判配置快照（JSON 字符串）
     * - 记录本次扫描实际使用的 AI 配置：{ enabled, provider, model, baseUrl?, apiUrl?, trigger, hasApiKey }
     * - apiKey 不写入快照（避免日志/审计泄露）；hasApiKey 布尔代替
     * - 用于审计 + run-history 聚合（参见 [platform-ai-integration.md §8.3](../design/governance/platform-ai-integration-governance.md)）
     */
    @Column({ type: 'text', nullable: true, name: 'ai_config_snapshot' })
    aiConfigSnapshot!: string | null

    /** B 模式：action run 页面 URL（触发后轮询定位） */
    @Column({ type: 'varchar', length: 500, nullable: true })
    runUrl!: string | null

    /** 所属批量运行 id（定时/批量触发时关联；单独手动触发为 null） */
    @Index()
    @Column({ type: 'varchar', length: 36, nullable: true })
    batchRunId!: string | null
}
