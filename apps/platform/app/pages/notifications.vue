<script setup lang="ts">
import type { DataTableColumn } from 'caomei-ui'
import { RefreshCw, Save, Send } from '@lucide/vue'
import { notificationSeverityThresholdOptions } from '~/utils/notification-options'

definePageMeta({
    middleware: 'auth',
    roles: ['admin', 'org_admin'],
})

interface NotificationSettingsView {
    categories: {
        securityHigh: boolean
        runFailure: boolean
        runCompleted: boolean
        weeklyDigest: boolean
    }
    severityThreshold: 'critical' | 'high'
    cooldownHours: number
    maxPerHour: number
    extraAdminRecipients: string[]
}

interface NotificationLogView {
    id: string
    category: string
    scopeType: string
    scopeId: string
    status: string
    recipients: string[]
    errorMessage: string | null
    sentAt: string | null
    createdAt: string
}

const { t, d } = useI18n()
const settings = ref<NotificationSettingsView>({
    categories: { securityHigh: true, runFailure: true, runCompleted: false, weeklyDigest: false },
    severityThreshold: 'high',
    cooldownHours: 24,
    maxPerHour: 6,
    extraAdminRecipients: [],
})
const extraRecipientsText = ref('')
const logs = ref<NotificationLogView[]>([])
const channelAvailable = ref(true)
const deploymentEnabled = ref(true)
const logsLoading = ref(false)
const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const error = ref('')
const success = ref('')

const severityOptions = computed(() => notificationSeverityThresholdOptions(t))

const loadSettings = async () => {
    const data = await $fetch<{ settings: NotificationSettingsView, channelAvailable: boolean, deploymentEnabled: boolean }>('/api/organizations/current/notification-settings')
    settings.value = data.settings
    extraRecipientsText.value = data.settings.extraAdminRecipients.join(', ')
    channelAvailable.value = data.channelAvailable
    deploymentEnabled.value = data.deploymentEnabled
}

const loadLogs = async () => {
    const data = await $fetch<{ items: NotificationLogView[] }>('/api/notifications?page=1&pageSize=20')
    logs.value = data.items
}

const refreshLogs = async () => {
    error.value = ''
    success.value = ''
    logsLoading.value = true
    try {
        await loadLogs()
    } catch (e: any) {
        error.value = t('notifications.loadFailed', { message: e?.data?.message ?? e?.message ?? t('common.errors.unknown') })
    } finally {
        logsLoading.value = false
    }
}

const load = async () => {
    loading.value = true
    error.value = ''
    try {
        await Promise.all([loadSettings(), loadLogs()])
    } catch (e: any) {
        error.value = t('notifications.loadFailed', { message: e?.data?.message ?? e?.message ?? t('common.errors.unknown') })
    } finally {
        loading.value = false
    }
}

const save = async () => {
    saving.value = true
    error.value = ''
    success.value = ''
    try {
        const extraAdminRecipients = extraRecipientsText.value
            .split(/[,\n]/)
            .map((value) => value.trim())
            .filter(Boolean)
        const data = await $fetch<{ settings: NotificationSettingsView }>('/api/organizations/current/notification-settings', {
            method: 'PATCH',
            body: { ...settings.value, extraAdminRecipients },
        })
        settings.value = data.settings
        extraRecipientsText.value = data.settings.extraAdminRecipients.join(', ')
        success.value = t('notifications.saved')
    } catch (e: any) {
        error.value = t('notifications.saveFailed', { message: e?.data?.message ?? e?.message ?? t('common.errors.unknown') })
    } finally {
        saving.value = false
    }
}

const sendTest = async () => {
    testing.value = true
    error.value = ''
    success.value = ''
    try {
        const result = await $fetch<{ delivered: boolean, mode: string }>('/api/notifications/test', { method: 'POST' })
        success.value = result.delivered ? t('notifications.testDelivered') : t('notifications.testNoop')
    } catch (e: any) {
        error.value = t('notifications.testFailed', { message: e?.data?.message ?? e?.message ?? t('common.errors.unknown') })
    } finally {
        testing.value = false
    }
}

const categoryLabel = (category: string) => t(`notifications.category.${category}`)

const statusLabel = (status: string) => t(`notifications.status.${status}`)

const statusTone = (status: string) => {
    if (status === 'sent') {
        return 'success' as const
    }
    if (status === 'failed') {
        return 'danger' as const
    }
    if (status === 'noop') {
        return 'warning' as const
    }
    return 'neutral' as const
}

const columns = computed<DataTableColumn<NotificationLogView>[]>(() => [
    { key: 'createdAt', header: t('notifications.colTime') },
    { key: 'category', header: t('notifications.colCategory') },
    { key: 'scope', header: t('notifications.colScope') },
    { key: 'status', header: t('notifications.colStatus') },
    { key: 'recipients', header: t('notifications.colRecipients') },
    { key: 'errorMessage', header: t('notifications.colError') },
])

onMounted(load)
</script>

<template>
    <div class="notifications-page">
        <div class="notifications-page__header">
            <div>
                <h2>{{ t('notifications.title') }}</h2>
                <p class="text-muted">
                    {{ t('notifications.subtitle') }}
                </p>
            </div>
            <CaomeiButton
                variant="ghost"
                size="sm"
                :loading="testing"
                @click="sendTest"
            >
                <template #icon>
                    <CaomeiIcon :icon="Send" />
                </template>
                {{ t('notifications.test') }}
            </CaomeiButton>
        </div>

        <CaomeiMessage
            v-if="error"
            tone="danger"
            :closable="false"
        >
            {{ error }}
        </CaomeiMessage>
        <CaomeiMessage
            v-if="success"
            tone="success"
            :closable="false"
        >
            {{ success }}
        </CaomeiMessage>
        <CaomeiMessage
            v-if="!channelAvailable"
            tone="warning"
            :closable="false"
        >
            {{ t('notifications.channelUnavailable') }}
        </CaomeiMessage>

        <div v-if="loading" class="text-muted">
            {{ t('common.empty.loading') }}
        </div>
        <div v-else class="notifications-page__grid">
            <CaomeiCard :title="t('notifications.categoriesCard')">
                <div class="notifications-form">
                    <div class="notifications-row">
                        <span>{{ t('notifications.category.platform_incident') }}</span>
                        <small class="text-muted">{{ t('notifications.platformIncidentNote') }}</small>
                    </div>
                    <div class="notifications-row">
                        <span>{{ t('notifications.category.security_critical') }}</span>
                        <small class="text-muted">{{ t('notifications.criticalNote') }}</small>
                    </div>
                    <div class="notifications-row">
                        <label for="org-notify-security">{{ t('notifications.category.security_high') }}</label>
                        <CaomeiSwitch id="org-notify-security" v-model="settings.categories.securityHigh" />
                    </div>
                    <div class="notifications-row">
                        <label for="org-notify-run-failure">{{ t('notifications.category.run_failure') }}</label>
                        <CaomeiSwitch id="org-notify-run-failure" v-model="settings.categories.runFailure" />
                    </div>
                    <div class="notifications-row">
                        <label for="org-notify-run-completed">{{ t('notifications.category.run_completed') }}</label>
                        <CaomeiSwitch id="org-notify-run-completed" v-model="settings.categories.runCompleted" />
                    </div>
                    <div class="notifications-row">
                        <label for="org-notify-weekly">{{ t('notifications.category.weekly_digest') }}</label>
                        <CaomeiSwitch
                            id="org-notify-weekly"
                            v-model="settings.categories.weeklyDigest"
                        />
                    </div>
                    <small class="text-muted">{{ t('notifications.weeklyDigestHint') }}</small>
                    <CaomeiButton
                        type="button"
                        :loading="saving"
                        @click="save"
                    >
                        <template #icon>
                            <CaomeiIcon :icon="Save" />
                        </template>
                        {{ t('notifications.save') }}
                    </CaomeiButton>
                </div>
            </CaomeiCard>

            <CaomeiCard :title="t('notifications.deliveryCard')">
                <form class="notifications-form" @submit.prevent="save">
                    <div class="notifications-field">
                        <label for="severity">{{ t('notifications.severity') }}</label>
                        <CaomeiSelect
                            id="severity"
                            v-model="settings.severityThreshold"
                            :options="severityOptions"
                            option-label="label"
                            option-value="value"
                        />
                    </div>
                    <div class="notifications-field">
                        <label for="cooldown">{{ t('notifications.cooldownHours') }}</label>
                        <CaomeiInput
                            id="cooldown"
                            :model-value="String(settings.cooldownHours)"
                            @update:model-value="value => settings.cooldownHours = Number(value)"
                        />
                    </div>
                    <div class="notifications-field">
                        <label for="maxPerHour">{{ t('notifications.maxPerHour') }}</label>
                        <CaomeiInput
                            id="maxPerHour"
                            :model-value="String(settings.maxPerHour)"
                            @update:model-value="value => settings.maxPerHour = Number(value)"
                        />
                    </div>
                    <div class="notifications-field">
                        <label for="extraRecipients">{{ t('notifications.extraRecipients') }}</label>
                        <CaomeiTextarea
                            id="extraRecipients"
                            v-model="extraRecipientsText"
                            :rows="3"
                        />
                        <small class="text-muted">{{ t('notifications.extraRecipientsHint') }}</small>
                    </div>
                    <CaomeiButton type="submit" :loading="saving">
                        <template #icon>
                            <CaomeiIcon :icon="Save" />
                        </template>
                        {{ t('notifications.save') }}
                    </CaomeiButton>
                </form>
            </CaomeiCard>
        </div>

        <CaomeiCard class="notifications-page__logs" :title="t('notifications.logsCard')">
            <div class="notifications-page__logs-header">
                <small class="text-muted">{{ t('notifications.logsHint') }}</small>
                <CaomeiButton
                    variant="ghost"
                    size="sm"
                    :loading="loading"
                    @click="refreshLogs"
                >
                    <template #icon>
                        <CaomeiIcon :icon="RefreshCw" />
                    </template>
                    {{ t('notifications.refresh') }}
                </CaomeiButton>
            </div>
            <CaomeiDataTable
                :data="logs"
                :columns="columns"
                row-key="id"
                striped
                :empty-text="t('notifications.emptyLogs')"
            >
                <template #cell-createdAt="{ row }">
                    {{ d(new Date(row.createdAt), 'long') }}
                </template>
                <template #cell-category="{ row }">
                    {{ categoryLabel(row.category) }}
                </template>
                <template #cell-scope="{ row }">
                    <span class="text-muted">{{ row.scopeType }} · {{ row.scopeId }}</span>
                </template>
                <template #cell-status="{ row }">
                    <CaomeiTag :tone="statusTone(row.status)">
                        {{ statusLabel(row.status) }}
                    </CaomeiTag>
                </template>
                <template #cell-recipients="{ row }">
                    <span class="text-muted">{{ row.recipients.join(', ') || '—' }}</span>
                </template>
                <template #cell-errorMessage="{ row }">
                    <span class="text-muted">{{ row.errorMessage ?? '—' }}</span>
                </template>
            </CaomeiDataTable>
        </CaomeiCard>
    </div>
</template>

<style lang="scss" scoped>
.notifications-page {
    display: flex;
    flex-direction: column;
    gap: $space-4;

    &__header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: $space-3;

        h2 {
            margin: 0 0 $space-1;
        }

        p {
            margin: 0;
            font-size: $font-size-sm;
        }
    }

    &__grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: $space-4;
    }

    &__logs-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: $space-3;
        margin-bottom: $space-3;
    }
}

.notifications-form {
    display: flex;
    flex-direction: column;
    gap: $space-3;
}

.notifications-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-3;
    padding: $space-2 0;
    border-bottom: 1px solid var(--caomei-color-border);

    small {
        flex: 1;
    }
}

.notifications-field {
    display: flex;
    flex-direction: column;
    gap: $space-1;

    label {
        font-size: $font-size-sm;
        font-weight: 500;
    }
}
</style>
