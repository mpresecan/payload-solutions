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
