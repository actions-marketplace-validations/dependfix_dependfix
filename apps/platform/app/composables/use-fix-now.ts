import { ref, watch, type Ref } from 'vue'

/**
 * alerts 视图 "立即修复此仓库" 一键修复 composable（todo.md §M16.2 C66-D）。
 *
 * 业务语义：
 * - 用户在 alerts 详情 Sidebar 选中一个 report-only 的受影响运行
 * - 一键复用该 run_id（reuseScanRunId）触发 fix 模式扫描，跳过 createPendingScanRun
 * - 成功后跳转扫描历史（/scans?repository=xxx&run=xxx）查看 fix 进度
 * - **命中去重合并**（服务端返回顶层 `merged`）：本次触发未真正执行、既有 run 记录保持不变
 *   → 提示合并语义且**不跳转**（跳过去只会看到未执行的既有 run，反而误导）
 *
 * 四态分离（与 alerts/batch-runs 同模式）：
 * - fixingRunId：当前正在触发修复的 run.id（按钮 loading 反馈，并发守卫防重复点击）
 * - fixError / fixMerged / fixSuccess：toast 状态（danger / warning / success），5s 自动清除
 *
 * 可测性：`useFixNow(deps)` 支持注入 i18n / 请求 / 导航实现（缺省走 Nuxt 自动导入），
 * 便于在无 Nuxt 运行时的单测中覆盖「合并 / 成功 / 失败」三条分支。
 */

interface FixableRunView {
    id: string
    repositoryId: string
    severityThreshold: string
}

/** 单仓库扫描响应（本 composable 消费的最小子集） */
export interface FixNowScanResponse {
    id: string
    /** 去重合并提示（服务端顶层字段；存在即表示本次触发被合并、未真正执行） */
    merged?: { code: string, message: string }
}

/** 可注入依赖（单测注入；缺省使用 Nuxt 自动导入的实现） */
export interface UseFixNowDeps {
    t: (key: string, params?: Record<string, string | number>) => string
    request: (
        repositoryId: string,
        body: { mode: 'fix', severityThreshold: string, reuseScanRunId: string },
    ) => Promise<FixNowScanResponse>
    navigate: (to: string) => Promise<unknown>
}

export interface UseFixNowReturn {
    fixingRunId: Ref<string | null>
    fixError: Ref<string>
    fixMerged: Ref<string>
    fixSuccess: Ref<string>
    triggerFix: (run: FixableRunView) => Promise<void>
    resetMessages: () => void
}

/** 缺省 i18n 适配：`useI18n()` 必须在 setup 期解析（vue-i18n composable 约束），
 *  故仅在未注入 `deps.t` 时求值；调用期再调用该方法会抛错并静默吞掉整条分支。 */
const resolveTranslator = (): UseFixNowDeps['t'] => {
    const { t } = useI18n()
    return (key, params) => (params === undefined ? t(key) : t(key, params))
}

export const useFixNow = (deps: Partial<UseFixNowDeps> = {}): UseFixNowReturn => {
    const t = deps.t ?? resolveTranslator()
    const request = deps.request ?? ((repositoryId, body) => $fetch(
        `/api/repos/${repositoryId}/scan`,
        { method: 'POST', body },
    ) as unknown as Promise<FixNowScanResponse>)
    const navigate = deps.navigate ?? ((to: string) => navigateTo(to))

    const fixingRunId = ref<string | null>(null)
    const fixError = ref('')
    const fixMerged = ref('')
    const fixSuccess = ref('')

    // 三条消息同策略：5s 自动清除
    for (const message of [fixSuccess, fixError, fixMerged]) {
        watch(message, (v) => {
            if (v) {
                setTimeout(() => {
                    message.value = ''
                }, 5000)
            }
        })
    }

    const resetMessages = () => {
        fixError.value = ''
        fixMerged.value = ''
        fixSuccess.value = ''
    }

    /**
     * 触发一键修复。
     * - body 携带 mode: 'fix' + reuseScanRunId：服务端跳过 createPendingScanRun，
     *   直接以复用 run.id 进入 fix 流程；scan_result 数据复用 report-only run 的输出
     *   （无需重拉 Dependabot / pnpm audit 等外部告警源）
     * - 命中合并（响应含顶层 `merged`）：本次触发未执行 → 只提示、不跳转（run 记录未被复用执行）
     * - 成功后跳转 /scans?repository=xxx&run=xxx，触发 scans.vue 内 mount 的
     *   `repo-history-dialog` query-key="run" 直接打开详情
     * - 失败：toast 错误信息（5s 自动清除）；不跳转
     */
    const triggerFix = async (run: FixableRunView) => {
        resetMessages()
        fixingRunId.value = run.id
        try {
            const res = await request(run.repositoryId, {
                mode: 'fix',
                severityThreshold: run.severityThreshold,
                reuseScanRunId: run.id,
            })
            if (res.merged) {
                fixMerged.value = t('common.scanTriggerMerged')
                return
            }
            fixSuccess.value = t('alerts.fixNow.success', { runId: res.id.slice(0, 8) })
            await navigate(`/scans?repository=${run.repositoryId}&run=${run.id}`)
        } catch (e: any) {
            fixError.value = t('alerts.fixNow.failed', { message: e?.data?.message ?? e?.message ?? t('common.errors.unknown') })
        } finally {
            fixingRunId.value = null
        }
    }

    return { fixingRunId, fixError, fixMerged, fixSuccess, triggerFix, resetMessages }
}
