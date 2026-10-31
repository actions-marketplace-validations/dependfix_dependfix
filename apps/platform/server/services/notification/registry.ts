import { EmailNotificationChannel } from './email-channel'
import { SlackStubChannel, WebhookStubChannel } from './stub-channels'
import type { NotificationChannel } from './channel'

const channels = new Map<string, NotificationChannel>()

/** 注册渠道（重复注册抛错，避免覆盖）。 */
export const registerNotificationChannel = (channel: NotificationChannel): void => {
    if (channels.has(channel.name)) {
        throw new Error(`Notification channel '${channel.name}' already registered`)
    }
    channels.set(channel.name, channel)
}

/** 注销渠道（测试用）。 */
export const unregisterNotificationChannel = (name: string): void => {
    channels.delete(name)
}

/** 列出所有已注册渠道。 */
export const listNotificationChannels = (): NotificationChannel[] => Array.from(channels.values())

let initialized = false
export const ensureNotificationChannelsRegistered = (): void => {
    if (initialized) {
        return
    }
    initialized = true
    registerNotificationChannel(new EmailNotificationChannel())
    registerNotificationChannel(new SlackStubChannel())
    registerNotificationChannel(new WebhookStubChannel())
}

ensureNotificationChannelsRegistered()
