import type { Payload } from 'payload'
import type Stripe from 'stripe'

import { toPayloadId } from '@/lib/ids'
import { formatPrice } from '@/lib/stack'
import stack from '@/stack.config'

/**
 * Where the emails come from.
 *
 * `src/emails/index.ts` is the *what* — one function per message. This file is the *when*: bundles
 * of callbacks that `src/lib/auth/options.ts` and `src/collections/Users.ts` spread into Better
 * Auth's plugins, so every notice a SaaS owes its users is wired up out of the box.
 *
 * Without the emails plugin these bundles are empty objects (the same file, other branch), so the
 * call sites read identically either way.
 *
 * Nothing here throws: an email that cannot be sent must never break the sign-up, the membership
 * change or the webhook that triggered it.
 */

async function client(): Promise<Payload> {
  const { getPayloadClient } = await import('@/lib/payload')
  return getPayloadClient()
}

/**
 * Send, log a failure, and carry on. Callers that already hold a Payload instance pass it: only
 * Better Auth's callbacks, which run inside the Next server and have none, fall back to resolving
 * one lazily.
 */
async function send(slug: string, input: Record<string, unknown>, options: { payload?: Payload; to?: string } = {}) {
  if (options.to === '') return
  let payload: Payload | undefined = options.payload
  try {
    payload = payload ?? (await client())
    await payload.emails.send(slug as never, {
      input: input as never,
      ...(options.to ? { to: options.to } : {}),
    })
  } catch (error) {
    const message = `[emails] "${slug}" could not be sent`
    if (payload) payload.logger.error({ err: error, msg: message })
    else console.error(message, error)
  }
}

// ---------------------------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------------------------

/**
 * Called from the users collection when a document is created. The hook already holds `req.payload`,
 * so nothing here has to reach for one — which also means these two work in `payload run` scripts,
 * migrations and seeds, not only inside the Next server.
 */
export async function onUserCreated(user: { id: number | string }, payload: Payload) {
  await send('welcome', { user: user.id }, { payload })
}

/** Called from the users collection when the address on an account changes. */
export async function onUserEmailChanged(
  change: { newEmail: string; previousEmail: string },
  payload: Payload,
) {
  await send(
    'email-changed',
    { changedAt: new Date().toISOString(), newEmail: change.newEmail, previousEmail: change.previousEmail },
    { payload },
  )
}

/** Spread into Better Auth's `user.deleteUser`. */
export const deleteUserEmailCallbacks = {
  afterDelete: async (user: { email: string; name?: null | string }) => {
    await send('account-deleted', {
      deletedAt: new Date().toISOString(),
      email: user.email,
      name: user.name ?? undefined,
    })
  },
}

// ---------------------------------------------------------------------------------------------
// Two-factor
// ---------------------------------------------------------------------------------------------

/**
 * Spread into `twoFactor()`. Adding `otpOptions` turns on email as a second factor alongside an
 * authenticator app; the sign-in UI already understands both (src/lib/auth/two-factor-methods.ts).
 */
export const twoFactorEmailOptions = {
  otpOptions: {
    period: 3,
    sendOTP: async ({ otp, user }: { otp: string; user: { email: string } }) => {
      await send('two-factor-code', { code: otp, email: user.email, expiresIn: 3 })
    },
  },
}

// ---------------------------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------------------------

type OrgUser = { email: string; id?: number | string; name?: null | string }
type Org = { name: string }

/** Spread into `organization()`. Every hook is best-effort and never blocks the operation. */
export const organizationEmailHooks = {
  organizationHooks: {
    afterAcceptInvitation: async (data: {
      invitation: { inviterId?: string } & Record<string, unknown>
      organization: Org
      user: OrgUser
    }) => {
      await send('organization-member-joined', {
        email: data.user.email,
        name: data.user.name ?? undefined,
        organizationName: data.organization.name,
        role: (data.invitation as { role?: string }).role,
      })
      const inviter = await inviterOf(data.invitation.inviterId)
      if (!inviter) return
      await send('organization-invitation-accepted', {
        email: inviter.email,
        memberEmail: data.user.email,
        memberName: data.user.name ?? undefined,
        organizationName: data.organization.name,
        role: (data.invitation as { role?: string }).role,
      })
    },

    afterAddMember: async (data: { member: { role?: string }; organization: Org; user: OrgUser }) => {
      await send('organization-member-joined', {
        email: data.user.email,
        name: data.user.name ?? undefined,
        organizationName: data.organization.name,
        role: data.member.role,
      })
    },

    afterRemoveMember: async (data: { organization: Org; user: OrgUser }) => {
      await send('organization-member-removed', {
        email: data.user.email,
        name: data.user.name ?? undefined,
        organizationName: data.organization.name,
      })
    },

    afterUpdateMemberRole: async (data: {
      member: { role?: string }
      organization: Org
      previousRole: string
      user: OrgUser
    }) => {
      await send('organization-role-changed', {
        email: data.user.email,
        name: data.user.name ?? undefined,
        organizationName: data.organization.name,
        previousRole: data.previousRole,
        role: data.member.role ?? 'member',
      })
    },
  },
}

async function inviterOf(inviterId?: string): Promise<null | OrgUser> {
  if (!inviterId) return null
  try {
    const payload = await client()
    const user = await payload.findByID({
      id: toPayloadId(payload, inviterId),
      collection: 'users',
      depth: 0,
      overrideAccess: true,
    })
    return user as unknown as OrgUser
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------------------------

type SubscriptionRow = {
  periodEnd?: Date | null | string
  plan: string
  referenceId?: string
  seats?: null | number
  trialEnd?: Date | null | string
}

/** The plan as stack.config.ts describes it: display name and the price to quote in the email. */
function planDetails(planId: string) {
  if (stack.billing.provider !== 'stripe') return { interval: 'month', name: planId, price: '' }
  const plan = stack.billing.plans.find((p) => p.id === planId)
  if (!plan) return { interval: 'month', name: planId, price: '' }
  const price = plan.prices.find((p) => p.interval === 'month') ?? plan.prices[0]!
  return { interval: price.interval, name: plan.name, price: formatPrice(price.amount, price.currency) }
}

/**
 * Who gets a billing notice. With `billing.attachedTo: 'user'` the reference is the user; with
 * `'organization'` it is the organization, and the message goes to its owners.
 */
async function billingContact(referenceId?: string): Promise<null | { email: string; name: string }> {
  if (!referenceId) return null
  try {
    const payload = await client()
    const id = toPayloadId(payload, referenceId)
    if (stack.billing.provider !== 'stripe' || stack.billing.attachedTo === 'user') {
      const user = (await payload.findByID({ id, collection: 'users', depth: 0, overrideAccess: true })) as unknown as OrgUser
      return { email: user.email, name: user.name || user.email }
    }
    const org = (await payload.findByID({ id, collection: 'organizations', depth: 0, overrideAccess: true })) as unknown as Org
    const { docs } = await payload.find({
      collection: 'members',
      depth: 1,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      where: { and: [{ organization: { equals: id } }, { role: { equals: 'owner' } }] },
    })
    const owner = docs[0] as unknown as { user?: OrgUser | number | string } | undefined
    const user = owner?.user && typeof owner.user === 'object' ? owner.user : null
    return user ? { email: user.email, name: org.name } : null
  } catch {
    return null
  }
}

const iso = (value: Date | null | number | string | undefined): string | undefined => {
  if (value === null || value === undefined) return undefined
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

async function billingEmail(slug: string, subscription: SubscriptionRow, extra: Record<string, unknown> = {}) {
  const contact = await billingContact(subscription.referenceId)
  if (!contact) return
  const plan = planDetails(subscription.plan)
  await send(
    slug,
    {
      accountName: contact.name,
      email: contact.email,
      interval: plan.interval,
      planName: plan.name,
      price: plan.price,
      ...extra,
    },
    { to: contact.email },
  )
}

/** Spread into the Stripe plugin's `subscription` options. */
export const subscriptionEmailCallbacks = {
  onSubscriptionComplete: async ({ subscription }: { subscription: SubscriptionRow }) => {
    await billingEmail('subscription-started', subscription, { periodEnd: iso(subscription.periodEnd) })
  },
  onSubscriptionUpdate: async ({
    stripeSubscription,
    subscription,
  }: {
    stripeSubscription: Stripe.Subscription
    subscription: SubscriptionRow
  }) => {
    // Stripe fires this for renewals too; only a plan change is worth an email.
    const previous = (stripeSubscription as { metadata?: Record<string, string> }).metadata?.previousPlan
    if (!previous || previous === subscription.plan) return
    await billingEmail('subscription-updated', subscription, {
      periodEnd: iso(subscription.periodEnd),
      previousPlanName: planDetails(previous).name,
    })
  },
  onSubscriptionCancel: async ({ subscription }: { subscription: SubscriptionRow }) => {
    await billingEmail('subscription-canceled', subscription, { accessUntil: iso(subscription.periodEnd) })
  },
  onSubscriptionDeleted: async ({ subscription }: { subscription: SubscriptionRow }) => {
    await billingEmail('subscription-ended', subscription, { endedAt: new Date().toISOString() })
  },
}

/** Spread into each plan's `freeTrial` block. */
export const trialEmailCallbacks = {
  onTrialEnd: async ({ subscription }: { subscription: SubscriptionRow }) => {
    await billingEmail('trial-ending', subscription, { trialEndsAt: iso(subscription.trialEnd) })
  },
  onTrialExpired: async (subscription: SubscriptionRow) => {
    await billingEmail('trial-expired', subscription)
  },
}

/**
 * Receipts and dunning. These two come straight off the webhook rather than the local subscription
 * row, because Stripe is the only place that knows what was actually charged.
 */
export const stripeEmailEvents = {
  onEvent: async (event: Stripe.Event) => {
    if (event.type !== 'invoice.paid' && event.type !== 'invoice.payment_failed') return
    const invoice = event.data.object as Stripe.Invoice
    const email = invoice.customer_email ?? undefined
    if (!email) return
    const currency = (invoice.currency ?? 'usd').toUpperCase()
    const line = invoice.lines?.data?.[0]
    const planName = line?.description ?? 'your plan'
    const shared = {
      accountName: invoice.customer_name ?? email,
      email,
      invoiceUrl: invoice.hosted_invoice_url ?? undefined,
      planName,
    }

    if (event.type === 'invoice.paid') {
      await send(
        'payment-succeeded',
        {
          ...shared,
          amount: formatPrice(invoice.amount_paid ?? 0, currency),
          paidAt: iso(invoice.status_transitions?.paid_at) ?? new Date().toISOString(),
        },
        { to: email },
      )
      return
    }

    await send(
      'payment-failed',
      {
        ...shared,
        amount: formatPrice(invoice.amount_due ?? 0, currency),
        attemptedAt: new Date().toISOString(),
        nextAttemptAt: iso(invoice.next_payment_attempt),
      },
      { to: email },
    )
  },
}
