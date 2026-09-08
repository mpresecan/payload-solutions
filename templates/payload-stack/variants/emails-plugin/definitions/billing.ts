import { defineEmail } from '@payload-solutions/plugin-emails'

import { as, billingInput, billingVariables, resolveBilling, str } from './shared'

/**
 * Subscriptions and payments. Included only when `billing.provider` is `stripe` in stack.config.ts —
 * see ./index.ts.
 *
 * Amounts arrive as text, already formatted with the plan's currency by `formatPrice`
 * (src/lib/stack.ts), so no email has to know about minor units or locales. Stripe remains the
 * source of truth for what was actually charged: these messages tell the story, the invoice proves it.
 */

export const subscriptionStarted = defineEmail({
  slug: 'subscription-started',
  label: 'Subscription started',
  description: 'Confirms a new paid subscription.',
  trigger: '@better-auth/stripe subscription.onSubscriptionComplete',
  group: 'Billing',
  audience: 'user',
  inputSchema: [
    ...billingInput,
    { name: 'price', type: 'text', admin: { description: 'Formatted price, e.g. $29.00' } },
    { name: 'interval', type: 'text', admin: { description: 'month, year or one-time' } },
    { name: 'periodEnd', type: 'date' },
  ],
  variables: {
    ...billingVariables,
    'plan.price': { description: 'Formatted price', example: '$29.00' },
    'plan.interval': { example: 'month' },
    'period.end': { description: 'When the current period ends', example: '2026-10-08T00:00:00Z', type: 'date' },
  },
  resolve: ({ input }) => {
    const { interval, periodEnd, price } = as<{ interval?: string; periodEnd?: string; price?: string }>(input)
    return {
      ...resolveBilling(input),
      'plan.price': price ?? '',
      'plan.interval': interval ?? 'month',
      'period.end': periodEnd ?? '',
    }
  },
  to: ({ variables }) => str(variables['account.email']),
  defaults: {
    subject: 'Your {{site.name}} {{plan.name}} subscription is active',
    preheader: 'Everything on {{plan.name}} is switched on.',
    body: `
Thanks — **{{account.name}}** is now on the {{plan.name}} plan at {{plan.price}} per {{plan.interval}}.

<Button label="Open your dashboard" url="{{url.dashboard}}" fallback="false" />

The current period runs until {{period.end}}, and renews automatically unless you cancel. Invoices, payment method and plan changes are all under [billing]({{url.billing}}).
`,
  },
  sample: {
    accountName: 'Acme Inc',
    email: 'ada@example.com',
    interval: 'month',
    periodEnd: '2026-10-08T00:00:00Z',
    planName: 'Team',
    price: '$29.00',
  },
})

export const subscriptionUpdated = defineEmail({
  slug: 'subscription-updated',
  label: 'Plan changed',
  description: 'Confirms a move between plans, up or down.',
  trigger: '@better-auth/stripe subscription.onSubscriptionUpdate',
  group: 'Billing',
  audience: 'user',
  inputSchema: [
    ...billingInput,
    { name: 'previousPlanName', type: 'text' },
    { name: 'price', type: 'text' },
    { name: 'interval', type: 'text' },
    { name: 'periodEnd', type: 'date' },
  ],
  variables: {
    ...billingVariables,
    'plan.previous': { description: 'The plan before the change', example: 'Starter' },
    'plan.price': { example: '$99.00' },
    'plan.interval': { example: 'month' },
    'period.end': { example: '2026-10-08T00:00:00Z', type: 'date' },
  },
  resolve: ({ input }) => {
    const { interval, periodEnd, previousPlanName, price } = as<{
      interval?: string
      periodEnd?: string
      previousPlanName?: string
      price?: string
    }>(input)
    return {
      ...resolveBilling(input),
      'plan.previous': previousPlanName ?? '',
      'plan.price': price ?? '',
      'plan.interval': interval ?? 'month',
      'period.end': periodEnd ?? '',
    }
  },
  to: ({ variables }) => str(variables['account.email']),
  defaults: {
    subject: 'Your {{site.name}} plan is now {{plan.name}}',
    preheader: 'From {{plan.previous}} to {{plan.name}}.',
    body: `
**{{account.name}}** moved from {{plan.previous}} to **{{plan.name}}**, now {{plan.price}} per {{plan.interval}}.

Any difference for the rest of this period is settled on your next invoice. The period ends {{period.end}}.

<Button label="Review billing" url="{{url.billing}}" fallback="false" />
`,
  },
  sample: {
    accountName: 'Acme Inc',
    email: 'ada@example.com',
    interval: 'month',
    periodEnd: '2026-10-08T00:00:00Z',
    planName: 'Team',
    previousPlanName: 'Starter',
    price: '$99.00',
  },
})

export const subscriptionCanceled = defineEmail({
  slug: 'subscription-canceled',
  label: 'Subscription cancelled',
  description: 'Confirms a cancellation that takes effect at the end of the period.',
  trigger: '@better-auth/stripe subscription.onSubscriptionCancel',
  group: 'Billing',
  audience: 'user',
  inputSchema: [...billingInput, { name: 'accessUntil', type: 'date' }],
  variables: {
    ...billingVariables,
    'access.until': { description: 'Last day of paid access', example: '2026-10-08T00:00:00Z', type: 'date' },
  },
  resolve: ({ input }) => {
    const { accessUntil } = as<{ accessUntil?: string }>(input)
    return { ...resolveBilling(input), 'access.until': accessUntil ?? '' }
  },
  to: ({ variables }) => str(variables['account.email']),
  defaults: {
    subject: 'Your {{site.name}} subscription will end on {{access.until}}',
    preheader: 'Nothing changes until then.',
    body: `
The {{plan.name}} subscription for **{{account.name}}** is set to end. Nothing changes until **{{access.until}}** — until then everything works exactly as it does now, and there is nothing more to pay.

Changed your mind? You can start it again at any point before then.

<Button label="Resume the subscription" url="{{url.billing}}" fallback="false" />

If something pushed you to cancel, we would like to hear it: [{{support.email}}](mailto:{{support.email}}).
`,
  },
  sample: { accessUntil: '2026-10-08T00:00:00Z', accountName: 'Acme Inc', email: 'ada@example.com', planName: 'Team' },
})

export const subscriptionEnded = defineEmail({
  slug: 'subscription-ended',
  label: 'Subscription ended',
  description: 'Sent when a subscription has actually lapsed.',
  trigger: '@better-auth/stripe subscription.onSubscriptionDeleted',
  group: 'Billing',
  audience: 'user',
  inputSchema: [...billingInput, { name: 'endedAt', type: 'date' }],
  variables: {
    ...billingVariables,
    endedAt: { description: 'When access stopped', example: '2026-10-08T00:00:00Z', type: 'date' },
  },
  resolve: ({ input }) => {
    const { endedAt } = as<{ endedAt?: string }>(input)
    return { ...resolveBilling(input), endedAt: endedAt ?? '' }
  },
  to: ({ variables }) => str(variables['account.email']),
  defaults: {
    subject: 'Your {{site.name}} subscription has ended',
    preheader: 'Your data is still here.',
    body: `
The {{plan.name}} subscription for **{{account.name}}** ended on {{endedAt}}, so paid features are switched off.

Your account and your data are still here. Starting a subscription again turns everything back on where you left it.

<Button label="Choose a plan" url="{{url.pricing}}" fallback="false" />
`,
  },
  sample: { accountName: 'Acme Inc', email: 'ada@example.com', endedAt: '2026-10-08T00:00:00Z', planName: 'Team' },
})

export const trialEnding = defineEmail({
  slug: 'trial-ending',
  label: 'Trial ending',
  description: 'Warns that a free trial is about to finish.',
  trigger: '@better-auth/stripe plan freeTrial.onTrialEnd',
  group: 'Billing',
  audience: 'user',
  inputSchema: [...billingInput, { name: 'trialEndsAt', type: 'date' }, { name: 'price', type: 'text' }],
  variables: {
    ...billingVariables,
    'trial.endsAt': { description: 'When the trial finishes', example: '2026-09-22T00:00:00Z', type: 'date' },
    'plan.price': { example: '$29.00' },
  },
  resolve: ({ input }) => {
    const { price, trialEndsAt } = as<{ price?: string; trialEndsAt?: string }>(input)
    return { ...resolveBilling(input), 'plan.price': price ?? '', 'trial.endsAt': trialEndsAt ?? '' }
  },
  to: ({ variables }) => str(variables['account.email']),
  defaults: {
    subject: 'Your {{site.name}} trial ends {{trial.endsAt}}',
    preheader: 'Add a payment method to keep {{plan.name}}.',
    body: `
The {{plan.name}} trial for **{{account.name}}** ends on {{trial.endsAt}}. After that it is {{plan.price}} unless you cancel.

<Button label="Review billing" url="{{url.billing}}" fallback="false" />

Not the right fit? Cancel before {{trial.endsAt}} and you will not be charged.
`,
  },
  sample: {
    accountName: 'Acme Inc',
    email: 'ada@example.com',
    planName: 'Team',
    price: '$29.00',
    trialEndsAt: '2026-09-22T00:00:00Z',
  },
})

export const trialExpired = defineEmail({
  slug: 'trial-expired',
  label: 'Trial expired',
  description: 'Sent when a trial finished without becoming a subscription.',
  trigger: '@better-auth/stripe plan freeTrial.onTrialExpired',
  group: 'Billing',
  audience: 'user',
  inputSchema: billingInput,
  variables: billingVariables,
  resolve: ({ input }) => resolveBilling(input),
  to: ({ variables }) => str(variables['account.email']),
  defaults: {
    subject: 'Your {{site.name}} trial has ended',
    preheader: 'Pick up where you left off whenever you like.',
    body: `
The {{plan.name}} trial for **{{account.name}}** has ended and paid features are switched off. Nothing was charged.

Everything you created during the trial is still here, waiting.

<Button label="Choose a plan" url="{{url.pricing}}" fallback="false" />

If it did not do what you needed, tell us what was missing: [{{support.email}}](mailto:{{support.email}}).
`,
  },
  sample: { accountName: 'Acme Inc', email: 'ada@example.com', planName: 'Team' },
})

export const paymentSucceeded = defineEmail({
  slug: 'payment-succeeded',
  label: 'Payment receipt',
  description: 'Receipt for a successful charge.',
  trigger: 'Stripe webhook invoice.paid',
  group: 'Billing',
  audience: 'user',
  inputSchema: [
    ...billingInput,
    { name: 'amount', type: 'text', required: true, admin: { description: 'Formatted amount charged' } },
    { name: 'paidAt', type: 'date' },
    { name: 'invoiceUrl', type: 'text', admin: { description: 'Stripe hosted invoice page' } },
  ],
  variables: {
    ...billingVariables,
    amount: { description: 'Formatted amount charged', example: '$29.00' },
    paidAt: { example: '2026-09-08T10:00:00Z', type: 'date' },
    'invoice.url': { description: 'Stripe hosted invoice', example: 'https://invoice.stripe.com/…', type: 'url' },
  },
  resolve: ({ input }) => {
    const { amount, invoiceUrl, paidAt } = as<{ amount: string; invoiceUrl?: string; paidAt?: string }>(input)
    return { ...resolveBilling(input), amount, 'invoice.url': invoiceUrl ?? '', paidAt: paidAt ?? '' }
  },
  to: ({ variables }) => str(variables['account.email']),
  defaults: {
    subject: 'Your {{site.name}} receipt for {{amount}}',
    preheader: '{{plan.name}} — paid {{paidAt}}.',
    body: `
We received {{amount}} for **{{account.name}}** on the {{plan.name}} plan, paid {{paidAt}}.

<Button label="View invoice" url="{{invoice.url}}" />

Every invoice is kept under [billing]({{url.billing}}), where you can also change your payment method.
`,
  },
  sample: {
    accountName: 'Acme Inc',
    amount: '$29.00',
    email: 'ada@example.com',
    invoiceUrl: 'https://invoice.stripe.com/sample',
    paidAt: new Date().toISOString(),
    planName: 'Team',
  },
})

export const paymentFailed = defineEmail({
  slug: 'payment-failed',
  label: 'Payment failed',
  description: 'Asks for a new payment method after a charge is declined.',
  trigger: 'Stripe webhook invoice.payment_failed',
  group: 'Billing',
  audience: 'user',
  required: true,
  inputSchema: [
    ...billingInput,
    { name: 'amount', type: 'text', required: true },
    { name: 'attemptedAt', type: 'date' },
    { name: 'nextAttemptAt', type: 'date' },
    { name: 'invoiceUrl', type: 'text' },
  ],
  variables: {
    ...billingVariables,
    amount: { description: 'Formatted amount that failed', example: '$29.00' },
    attemptedAt: { example: '2026-09-08T10:00:00Z', type: 'date' },
    nextAttemptAt: { description: 'When Stripe retries, if it will', example: '2026-09-11T10:00:00Z', type: 'date' },
    'invoice.url': { description: 'Where to pay it', example: 'https://invoice.stripe.com/…', type: 'url' },
  },
  resolve: ({ input }) => {
    const { amount, attemptedAt, invoiceUrl, nextAttemptAt } = as<{
      amount: string
      attemptedAt?: string
      invoiceUrl?: string
      nextAttemptAt?: string
    }>(input)
    return {
      ...resolveBilling(input),
      amount,
      attemptedAt: attemptedAt ?? '',
      nextAttemptAt: nextAttemptAt ?? '',
      'invoice.url': invoiceUrl ?? '',
    }
  },
  to: ({ variables }) => str(variables['account.email']),
  defaults: {
    subject: 'We could not take payment for {{site.name}}',
    preheader: '{{amount}} was declined.',
    body: `
A payment of {{amount}} for **{{account.name}}** on the {{plan.name}} plan was declined on {{attemptedAt}}.

Cards expire and banks decline for all sorts of reasons — updating the payment method usually settles it.

<Button label="Update payment method" url="{{url.billing}}" fallback="false" />

We will try again on {{nextAttemptAt}}. If the payment does not go through, the subscription will eventually stop. You can also [pay this invoice directly]({{invoice.url}}).
`,
  },
  sample: {
    accountName: 'Acme Inc',
    amount: '$29.00',
    attemptedAt: new Date().toISOString(),
    email: 'ada@example.com',
    invoiceUrl: 'https://invoice.stripe.com/sample',
    nextAttemptAt: '2026-09-11T10:00:00Z',
    planName: 'Team',
  },
})
