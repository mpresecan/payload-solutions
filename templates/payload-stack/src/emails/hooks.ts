import type { Payload } from 'payload'

/**
 * Optional email hooks — the branch without the emails plugin.
 *
 * `src/lib/auth/options.ts` and `src/collections/Users.ts` spread these bundles into Better Auth's
 * plugins. Here they are empty, so the messages this project sends are exactly the ones in
 * `src/emails/index.ts` and nothing else fires.
 *
 * Scaffolding with `create-payload-stack --emails` replaces this file with the version that wires up
 * the full catalogue — welcome, membership changes, subscription and payment notices — each one
 * editable in the Payload admin. See https://payload.solutions/docs/plugins/payload-emails.
 */

/**
 * Whether the catalogue exists. `src/scheduler/actions` reads this to decide which actions are
 * worth registering: an action whose only job is to send a message it cannot send is noise in the
 * ledger, so without the emails plugin those actions are left out entirely.
 */
export const emailsEnabled = false

/**
 * Sends one message from the catalogue by slug. Unlike the bundles below — which must never break
 * the operation that triggered them — this one throws, because its callers are scheduled actions:
 * a failure there is meant to be recorded, retried and visible.
 */
export async function notify(
  payload: Payload,
  slug: string,
  _input: Record<string, unknown>,
  _options: { to?: string } = {},
): Promise<void> {
  payload.logger.warn(`[emails] "${slug}" was requested but this project has no email catalogue.`)
}

/**
 * The two billing notices a scheduled action sends rather than a webhook: the trial reminder that
 * has to go out days before the trial ends, and the follow-up on a payment that is still failing.
 * The scheduler decides *when*; who receives them and what they say stays here, which is why
 * `src/scheduler/actions/billing.ts` knows nothing about plans, owners or Stripe invoices.
 */
export async function sendTrialReminder(
  _payload: Payload,
  _subscription: { plan: string; referenceId?: string; trialEnd?: Date | null | string },
): Promise<void> {}

export async function sendPaymentReminder(
  _payload: Payload,
  _invoice: {
    accountName?: string
    amount: string
    email: string
    invoiceUrl?: string
    nextAttemptAt?: string
    planName: string
  },
): Promise<void> {}

/** Called from the users collection after a user document is created. */
export async function onUserCreated(_user: { id: number | string }, _payload: Payload): Promise<void> {}

/** Called from the users collection when the address on an account changes. */
export async function onUserEmailChanged(
  _change: { newEmail: string; previousEmail: string },
  _payload: Payload,
): Promise<void> {}

/** Spread into Better Auth `user.deleteUser`. */
export const deleteUserEmailCallbacks = {}

/** Spread into `twoFactor()`. */
export const twoFactorEmailOptions = {}

/** Spread into `organization()`. */
export const organizationEmailHooks = {}

/** Spread into the Stripe plugin's `subscription` options. */
export const subscriptionEmailCallbacks = {}

/** Spread into each plan's `freeTrial` block. */
export const trialEmailCallbacks = {}

/** Spread into `stripe()`. */
export const stripeEmailEvents = {}
