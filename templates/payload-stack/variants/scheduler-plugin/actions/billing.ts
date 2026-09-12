import { defineAction, SkipAction } from '@payload-solutions/plugin-action-scheduler'
import type { Payload } from 'payload'
import Stripe from 'stripe'

import { sendPaymentReminder, sendTrialReminder } from '@/emails/hooks'
import { env } from '@/lib/env'

/**
 * Billing actions: the two notices that cannot be sent from the event that causes them, because
 * the right moment is days later.
 *
 * Each one keeps only identifiers and the few strings the message needs in `args`; everything
 * else — who the owner is now, what the plan is called, whether the invoice was paid in the
 * meantime — is resolved when the action runs. An action is a promise about *when*, not a snapshot
 * of the world at the time it was made.
 */

/** Days before the trial ends that the reminder goes out. */
export const TRIAL_REMINDER_DAYS = 3
/** Days between one failed-payment follow-up and the next. */
export const DUNNING_INTERVAL_DAYS = 3
/** How many follow-ups to send before leaving the account alone. */
export const DUNNING_MAX_NOTICES = 2

export type TrialReminderArgs = { plan: string; referenceId: string; trialEnd?: null | string }

export const trialReminder = defineAction<TrialReminderArgs>({
  slug: 'billing.trial-reminder',
  label: 'Trial ending reminder',
  description: `Warns the account ${TRIAL_REMINDER_DAYS} days before a free trial becomes a paid subscription.`,
  group: 'billing',
  // The message is worth several attempts — a transient provider error should not cost the notice.
  retries: 4,
  timeout: '2m',
  inputSchema: [
    { name: 'referenceId', type: 'text', required: true },
    { name: 'plan', type: 'text', required: true },
    { name: 'trialEnd', type: 'text' },
  ],
  handler: async ({ args, log, payload }) => {
    await sendTrialReminder(payload, {
      plan: args.plan,
      referenceId: args.referenceId,
      trialEnd: args.trialEnd ?? undefined,
    })
    log(`Trial reminder sent for plan "${args.plan}"`)
    return { note: `Reminded ${args.referenceId} about the ${args.plan} trial` }
  },
})

export type PaymentReminderArgs = {
  accountName?: null | string
  amount: string
  email: string
  invoiceId: string
  invoiceUrl?: null | string
  notice: number
  planName: string
}

export const paymentReminder = defineAction<PaymentReminderArgs>({
  slug: 'billing.payment-reminder',
  label: 'Failed payment follow-up',
  description: `Follows up ${DUNNING_INTERVAL_DAYS} days after a declined payment, if it is still unpaid.`,
  group: 'billing',
  retries: 4,
  timeout: '2m',
  inputSchema: [
    { name: 'invoiceId', type: 'text', required: true },
    { name: 'email', type: 'text', required: true },
    { name: 'amount', type: 'text', required: true },
    { name: 'planName', type: 'text', required: true },
    { name: 'accountName', type: 'text' },
    { name: 'invoiceUrl', type: 'text' },
    { name: 'notice', type: 'number', required: true },
  ],
  handler: async ({ action, args, log, payload }) => {
    // Stripe is the only place that knows whether the money arrived. The `invoice.paid` webhook
    // cancels this action, but a payment made while the app was down would not have been seen, so
    // ask before sending. Without a key configured the reminder is sent unchecked.
    const status = await invoiceStatus(args.invoiceId, payload)
    if (status === 'settled') {
      throw new SkipAction(`Invoice ${args.invoiceId} is no longer outstanding`)
    }

    await sendPaymentReminder(payload, {
      accountName: args.accountName ?? undefined,
      amount: args.amount,
      email: args.email,
      invoiceUrl: args.invoiceUrl ?? undefined,
      planName: args.planName,
    })
    log(`Follow-up ${args.notice} of ${DUNNING_MAX_NOTICES} sent to ${args.email}`)

    if (args.notice < DUNNING_MAX_NOTICES) {
      // Same group as the first one, so `invoice.paid` still calls the whole ladder off.
      await payload.scheduler.schedule(
        'billing.payment-reminder',
        { ...args, notice: args.notice + 1 } as never,
        { group: action.group, scheduleAt: daysFromNow(DUNNING_INTERVAL_DAYS), unique: true },
      )
      return { note: `Sent follow-up ${args.notice}; next one in ${DUNNING_INTERVAL_DAYS} days` }
    }
    return { note: `Sent the last of ${DUNNING_MAX_NOTICES} follow-ups` }
  },
})

/** `settled` when Stripe says there is nothing left to pay, `outstanding` when there is or when we cannot tell. */
async function invoiceStatus(invoiceId: string, payload: Payload): Promise<'outstanding' | 'settled'> {
  if (!env.STRIPE_SECRET_KEY) {
    return 'outstanding'
  }
  try {
    const invoice = await new Stripe(env.STRIPE_SECRET_KEY).invoices.retrieve(invoiceId)
    return invoice.status === 'paid' || invoice.status === 'void' || invoice.status === 'uncollectible'
      ? 'settled'
      : 'outstanding'
  } catch (error) {
    // A deleted invoice or a network blip must not silence the reminder.
    payload.logger.warn({ err: error, msg: `[scheduler] could not read Stripe invoice ${invoiceId}` })
    return 'outstanding'
  }
}

export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}
