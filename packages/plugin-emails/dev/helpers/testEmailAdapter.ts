import type { EmailAdapter, SendEmailOptions } from 'payload'

/** Every message handed to the adapter, newest last. Inspected by the integration tests. */
export const sentEmails: SendEmailOptions[] = []

/**
 * Logs all emails to stdout and records them for tests.
 */
export const testEmailAdapter: EmailAdapter<{ messageId: string }> = ({ payload }) => ({
  name: 'test-email-adapter',
  defaultFromAddress: 'dev@payloadcms.com',
  defaultFromName: 'Payload Test',
  sendEmail: async (message) => {
    sentEmails.push(message)
    const to = Array.isArray(message.to) ? message.to.join(', ') : String(message.to ?? '')
    payload.logger.info(`[test-email-adapter] to: ${to} | subject: ${message.subject}`)
    if (process.env.EMAIL_PREVIEW_TEXT === 'true') {
      payload.logger.info(`\n${message.text}\n`)
    }
    return { messageId: `test-${sentEmails.length}` }
  },
})
