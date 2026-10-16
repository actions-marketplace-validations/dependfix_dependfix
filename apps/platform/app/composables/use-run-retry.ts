import { ref, watch, type Ref } from 'vue'

/**
 * 运行失败「受约束重试入口」composable（口径见 docs/design/governance/run-failure-taxonomy.md §5.5）。
 *
 * 业务语义：
 * - 仅对 `failureKind === 'transient'` 的失败运行呈现入口（可见性由调用方按同一判据控制；
 *   后端亦独立校验，前端不可见 ≠ 后端可绕过）
 * - 触发 `POST /api/runs/[id]/retry`：前端只传 runId——新运行的参数与来源 run id 均由**服务端**
 *   按来源运行派生（不可伪造）；返回的 `retriedFromRunId` 供来源链展示
 * - **命中去重合并**（服务端返回顶层 `merged`）：本次触发未真正执行 → 只提示合并语义，
 *   与「立即修复」入口同口径（`common.scanTriggerMerged`）
 *
 * 四态分离（与 use-fix-now 同模式）：
 * - retryingRunId：当前正在触发的 run.id（按钮 loading 反馈，并发守卫防重复点击）
 * - retryError / retryMerged / retrySuccess：toast 状态（danger / warning / success），5s 自动清除
 *
 * 可测性：`useRunRetry(deps)` 支持注入 i18n / 请求 / 成功回调（缺省走 Nuxt 自动导入）。
 */

/** 重试响应（本 composable 消费的最小子集） */
export interface RetryRunResponse {
    id: string
    /** 重试来源 run id（服务端写入；非重试触发为 null） */
    retriedFromRunId?: string | null
    /** 去重合并提示（存在即表示本次触发被合并、未真正执行） */
    merged?: { code: string, message: string }
}

export interface UseRunRetryDeps {
    t: (key: string, params?: Record<string, string | number>) => string
    request: (runId: string) => Promise<RetryRunResponse>
    /** 触发成功（未合并）后的回调：供调用方刷新列表 / 关闭来源详情，缺省 no-op */
    onRetried?: (response: RetryRunResponse) => void | Promise<void>
}

export interface UseRunRetryReturn {
    retryingRunId: Ref<string | null>
    retryError: Ref<string>
    retryMerged: Ref<string>
    retrySuccess: Ref<string>
    retryRun: (runId: string) => Promise<void>
    resetMessages: () => void
}

/** 缺省 i18n 适配：`useI18n()` 必须在 setup 期解析（vue-i18n composable 约束） */
const resolveTranslator = (): UseRunRetryDeps['t'] => {
    const { t } = useI18n()
    return (key, params) => (params === undefined ? t(key) : t(key, params))
}

export const useRunRetry = (deps: Partial<UseRunRetryDeps> = {}): UseRunRetryReturn => {
    const t = deps.t ?? resolveTranslator()
    const request = deps.request ?? ((runId: string) => $fetch(
        `/api/runs/${runId}/retry`,
        { method: 'POST' },
    ) as unknown as Promise<RetryRunResponse>)
    const onRetried = deps.onRetried

    const retryingRunId = ref<string | null>(null)
    const retryError = ref('')
    const retryMerged = ref('')
    const retrySuccess = ref('')

    // 三条消息同策略：5s 自动清除（与 use-fix-now 一致）
    for (const message of [retrySuccess, retryError, retryMerged]) {
        watch(message, (v) => {
            if (v) {
                setTimeout(() => {
                    message.value = ''
                }, 5000)
            }
        })
    }

    const resetMessages = () => {
        retryError.value = ''
        retryMerged.value = ''
        retrySuccess.value = ''
    }

    /**
     * 触发重试：前端只传 runId；服务端校验「来源已终态 + 仅 transient」并派生参数与来源。
     * - 命中合并：提示合并语义、不当作成功（与「立即修复」入口同口径，见 §5.5）
     * - 成功：提示新运行 id 并回调 `onRetried`（供列表刷新）
     */
    const retryRun = async (runId: string) => {
        resetMessages()
        retryingRunId.value = runId
        try {
            const res = await request(runId)
            if (res.merged) {
                retryMerged.value = t('common.scanTriggerMerged')
                return
            }
            retrySuccess.value = t('runs.retry.success', { runId: res.id.slice(0, 8) })
            await onRetried?.(res)
        } catch (e: any) {
            retryError.value = t('runs.retry.failed', {
                message: e?.data?.message ?? e?.message ?? t('common.errors.unknown'),
            })
        } finally {
            retryingRunId.value = null
        }
    }

    return { retryingRunId, retryError, retryMerged, retrySuccess, retryRun, resetMessages }
}
