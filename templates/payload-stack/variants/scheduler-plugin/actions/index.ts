import type { ActionSchedulerOptions } from '@payload-solutions/plugin-action-scheduler'

import { emailsEnabled } from '@/emails/hooks'
import stack from '@/stack.config'

import { paymentReminder, trialReminder } from './billing'
import { sendEmailLater } from './emails'
import { expireInvitations, pruneAuthRecords, purgeUnverified } from './maintenance'

/**
 * Everything this project knows how to do later.
 *
 * The catalogue follows `stack.config.ts` the way the rest of the template does: an action that
 * could never fire — a trial reminder in a product without billing, an invitation sweep without
 * organizations — is not registered at all, so the admin lists what this product actually has
 * rather than what the boilerplate shipped with. Messages additionally need the Payload Emails
 * plugin, since that is where the copy and the recipients live (see src/emails/hooks.ts).
 *
 * Add your own with `defineAction` and put it in this array. The slug is a promise: rows already in
 * the ledger refer to it, so rename it and those rows have nowhere to run.
 */

/** Billing notices are sent by these actions, so they need both billing and a catalogue to send from. */
const billingNotices = stack.features.billing && emailsEnabled

export const actions: ActionSchedulerOptions['actions'] = [
  // Always: auth tables grow forever otherwise, whatever this product sells.
  pruneAuthRecords,
  // Registered but unscheduled — it deletes accounts. See maintenance.ts.
  purgeUnverified,
  ...(stack.features.organizations ? [expireInvitations] : []),
  ...(billingNotices ? [trialReminder, paymentReminder] : []),
  ...(emailsEnabled ? [sendEmailLater] : []),
]

/**
 * The series that arm themselves at start-up. Each key is reconciled on every boot: change a cron
 * here and the next start moves the pending occurrence, remove a key and its series is dropped.
 * Times are UTC (`defaultTimezone` in src/scheduler/plugin.ts) and deliberately off the hour,
 * where a host's own cron traffic is lightest.
 */
export const recurring: NonNullable<ActionSchedulerOptions['recurring']> = [
  { key: 'prune-auth-records', hook: pruneAuthRecords.slug, cron: '15 3 * * *' },
  ...(stack.features.organizations
    ? [{ key: 'expire-invitations', hook: expireInvitations.slug, cron: '20 * * * *' }]
    : []),
]
