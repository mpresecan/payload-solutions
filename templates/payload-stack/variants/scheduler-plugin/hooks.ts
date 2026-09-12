import type { Payload } from 'payload'
import type Stripe from 'stripe'

import { formatPrice } from '@/lib/stack'

import { DUNNING_INTERVAL_DAYS, daysFromNow, TRIAL_REMINDER_DAYS } from './actions/billing'

/**
 * Where the scheduling happens.
 *
 * `src/scheduler/actions` is the *what* — one definition per thing this project can do later. This
 * file is the *when*: it wraps the Better Auth option objects that `src/lib/auth/options.ts`
 * builds, so a trial starting or an invoice failing books the follow-up as it happens.
 *
 * These wrap rather than sit beside the email bundles for one reason: both plugins want
 * `stripe({ onEvent })`, and a second spread would quietly replace the first. Wrapping chains them.
 *
 * Nothing here throws. A scheduling failure must never break a checkout or make Stripe retry a
 * webhook it already delivered — the action is lost, the log says so, and the sale goes through.
 */

async function client(): Promise<Payload> {
  const { getPayloadClient } = await import('@/lib/payload')
  return getPayloadClient()
}

async function attempt(what: string, run: (payload: Payload) => Promise<unknown>): Promise<void> {
  let payload: Payload | undefined
  try {
    payload = await client()
    await run(payload)
  } catch (error) {
    const message = `[scheduler] could not schedule ${what}`
    if (payload) {
      payload.logger.error({ err: error, msg: message })
    } else {
      console.error(message, error)
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Trials
// ---------------------------------------------------------------------------------------------

type TrialSubscription = { plan: string; referenceId?: string; trialEnd?: Date | null | string }

/**
 * Wraps a plan's `freeTrial` callbacks, and moves the trial notice forward.
 *
 * Better Auth only tells you a trial has ended, which is the one day a reminder is no use. The
 * scheduler books `billing.trial-reminder` the moment the trial starts, for
 * `TRIAL_REMINDER_DAYS` before it ends — so `onTrialEnd` is dropped here rather than left to send
 * the same message a second time on the day. `onTrialExpired` (nothing was charged, paid features
 * are off) still fires from the event, where it belongs.
 */
export function withTrialCallbacks<T extends { onTrialEnd?: unknown }>(bundle: T) {
  const { onTrialEnd: _sentEarlyInstead, ...rest } = bundle
  return {
    ...rest,
    onTrialStart: async (subscription: TrialSubscription) => {
      const trialEnd = subscription.trialEnd ? new Date(subscription.trialEnd) : null
      if (!subscription.referenceId || !trialEnd || Number.isNaN(trialEnd.getTime())) {
        return
      }
      const lead = new Date(trialEnd.getTime() - TRIAL_REMINDER_DAYS * 24 * 60 * 60 * 1000)
      // A trial shorter than the lead time gets its reminder shortly, rather than never.
      const scheduleAt = lead.getTime() > Date.now() + 60_000 ? lead : new Date(Date.now() + 60_000)
      await attempt(`the trial reminder for ${subscription.referenceId}`, (payload) =>
        payload.scheduler.schedule(
          'billing.trial-reminder',
          {
            plan: subscription.plan,
            referenceId: subscription.referenceId!,
            trialEnd: trialEnd.toISOString(),
          } as never,
          { group: `trial:${subscription.referenceId}`, scheduleAt, unique: true },
        ),
      )
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------------------------

/**
 * One group per invoice, so the `invoice.paid` event can call off the follow-ups by name — and so
 * `unique: true` is per invoice rather than per customer. Deliberately not exported: the seam's
 * exports are the same in both branches, and the un-plugged one has no invoices to group.
 */
const invoiceGroup = (invoiceId: string) => `invoice:${invoiceId}`

/**
 * Wraps the Stripe plugin's webhook bundle, chaining the scheduler's handler after the email one so
 * both see every event.
 *
 * A declined payment books a follow-up for `DUNNING_INTERVAL_DAYS` later; a payment that arrives
 * before then — by Stripe's own retry, or because somebody updated their card — cancels it. The
 * action checks with Stripe as well before sending, because a payment made while the app was down
 * produced no webhook to cancel anything.
 */
export function withStripeEvents<T extends { onEvent?: (event: Stripe.Event) => Promise<void> }>(bundle: T) {
  return {
    ...bundle,
    onEvent: async (event: Stripe.Event) => {
      await bundle.onEvent?.(event)

      if (event.type === 'invoice.payment_failed') {
        const invoice = event.data.object as Stripe.Invoice
        const email = invoice.customer_email
        if (!invoice.id || !email) {
          return
        }
        const currency = (invoice.currency ?? 'usd').toUpperCase()
        await attempt(`a payment follow-up for invoice ${invoice.id}`, (payload) =>
          payload.scheduler.schedule(
            'billing.payment-reminder',
            {
              accountName: invoice.customer_name ?? email,
              amount: formatPrice(invoice.amount_due ?? 0, currency),
              email,
              invoiceId: invoice.id!,
              invoiceUrl: invoice.hosted_invoice_url ?? null,
              notice: 1,
              planName: invoice.lines?.data?.[0]?.description ?? 'your plan',
            } as never,
            {
              group: invoiceGroup(invoice.id),
              scheduleAt: daysFromNow(DUNNING_INTERVAL_DAYS),
              unique: true,
            },
          ),
        )
        return
      }

      if (event.type === 'invoice.paid') {
        const invoice = event.data.object as Stripe.Invoice
        if (!invoice.id) {
          return
        }
        await attempt(`nothing — clearing follow-ups for invoice ${invoice.id}`, (payload) =>
          payload.scheduler.cancelAll('billing.payment-reminder', { group: invoiceGroup(invoice.id!) }),
        )
      }
    },
  }
}
