import { defineAction, PermanentError } from '@payload-solutions/plugin-action-scheduler'

import { notify } from '@/emails/hooks'

/**
 * Send any message in the catalogue later.
 *
 * The Payload Emails plugin can already defer a send by itself (`queue: { waitUntil }`), which is
 * the right tool for "in ten minutes, don't make the request wait". This action is for the other
 * case: a send far enough out that somebody will want to look at it, move it or call it off —
 * onboarding nudges, a renewal notice, a follow-up after a trial. It is a row in Scheduled Actions
 * with a log and a Cancel button, not a job that has vanished into the queue.
 *
 *   await payload.scheduler.schedule(
 *     'emails.send',
 *     { slug: 'welcome', to: user.email, input: { user: user.id } },
 *     { scheduleAt: '2026-10-01T09:00:00Z' },
 *   )
 */
export type SendEmailArgs = {
  input?: null | Record<string, unknown>
  slug: string
  to?: null | string
}

export const sendEmailLater = defineAction<SendEmailArgs>({
  slug: 'emails.send',
  label: 'Send an email',
  description: 'Sends one message from the email catalogue at a chosen time.',
  group: 'emails',
  retries: 4,
  timeout: '2m',
  inputSchema: [
    {
      name: 'slug',
      type: 'text',
      required: true,
      admin: { description: 'Slug of the email, as listed under Emails in the admin.' },
    },
    {
      name: 'to',
      type: 'text',
      admin: { description: 'Recipient. Leave empty to let the email definition decide.' },
    },
    {
      name: 'input',
      type: 'json',
      admin: { description: 'The input the email expects, as JSON — ids and strings, not documents.' },
    },
  ],
  handler: async ({ args, log, payload }) => {
    try {
      await notify(payload, args.slug, args.input ?? {}, { to: args.to ?? undefined })
    } catch (error) {
      // An email that is not in the catalogue will not appear in it on the next attempt: fail once,
      // loudly, so the row shows the typo instead of four identical failures.
      if (error instanceof Error && error.name === 'EmailNotDefinedError') {
        throw new PermanentError(error.message)
      }
      throw error
    }
    log(`Sent "${args.slug}"${args.to ? ` to ${args.to}` : ''}`)
    return { note: `Sent "${args.slug}"` }
  },
})
