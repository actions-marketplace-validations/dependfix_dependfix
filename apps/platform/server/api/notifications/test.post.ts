import { requireRole } from '#server/utils/guard'
import { createLocalizedError } from '#server/utils/localized-error'
import { sendMail } from '#server/services/mailer'

/** POST /api/notifications/test：向当前管理员发送测试邮件（验证 SMTP 配置）。 */
export default defineEventHandler(async (event) => {
    const { user } = await requireRole(event, ['admin', 'org_admin'])
    try {
        const result = await sendMail({
            to: user.email,
            subject: '[dependfix][测试] 通知渠道测试',
            html: '<p>这是一封 Dependfix 通知测试邮件。若您收到此邮件，说明 SMTP 配置可用。</p>',
            text: '这是一封 Dependfix 通知测试邮件。若您收到此邮件，说明 SMTP 配置可用。',
        })
        return { delivered: result.delivered, mode: result.mode }
    } catch (error) {
        // 不向客户端透传 SMTP / transport 细节；仅日志留痕
        console.error('[notification:test] test email failed:', error)
        throw createLocalizedError(event, {
            statusCode: 500,
            code: 'NOTIFICATION_TEST_FAILED',
        })
    }
})
