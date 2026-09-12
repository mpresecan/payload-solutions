import type Stripe from 'stripe'

/**
 * Optional scheduler hooks — the branch without the Action Scheduler plugin.
 *
 * `src/emails/hooks.ts` answers *when* a message is sent in response to something that just
 * happened. These two answer *when something should happen later*, and they compose over the email
 * bundles rather than sitting beside them: both wrap the object they are given, so one Better Auth
 * option can carry an email callback and a scheduling callback without either overwriting the
 * other. Here they return their argument untouched, so the call sites in `src/lib/auth/options.ts`
 * read identically either way.
 */

/** Wraps the Stripe plugin's webhook bundle. */
export function withStripeEvents<T extends { onEvent?: (event: Stripe.Event) => Promise<void> }>(bundle: T): T {
  return bundle
}

/** Wraps a plan's `freeTrial` callbacks. */
export function withTrialCallbacks<T extends object>(bundle: T): T {
  return bundle
}
