/**
 * The schema behind `src/stack.config.ts`.
 *
 * Everything product-specific about your SaaS is declared once in that file and validated here at
 * import time. The rest of the codebase reads from `stack` (never from process.env directly for
 * product decisions), so changing the config changes the pricing page, checkout, sign-in screens,
 * navigation, legal pages and emails together.
 *
 * The config is typed end to end: `defineStack` takes a `StackInput`, so the editor autocompletes
 * every key and enum value, `pnpm typecheck` rejects typos and unknown keys, and the same schema
 * rejects them again at boot (objects are strict) with the path of the offending key.
 *
 * This module is imported on both the server (payload.config.ts) and the client (providers,
 * pricing), so it must stay free of secrets and of server-only imports.
 */
import { z } from 'zod'

export const AUTH_METHODS = ['email-password', 'magic-link', 'passkey'] as const
export const SOCIAL_PROVIDERS = ['google', 'github', 'microsoft', 'apple', 'discord'] as const
export const BILLING_INTERVALS = ['month', 'year', 'one-time'] as const
/** Roles Better Auth's organization plugin ships with. Extend with organizations.additionalRoles. */
export const ORGANIZATION_ROLES = ['owner', 'admin', 'member'] as const
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number]

/**
 * A built-in organization role, or a key declared in organizations.additionalRoles. The
 * `string & {}` half keeps custom roles legal while the editor still suggests the built-in ones.
 */
const organizationRoleSchema = z.custom<OrganizationRole | (string & {})>(
  (v) => typeof v === 'string' && v.length > 0,
  'role must be a non-empty string',
)

const priceSchema = z.strictObject({
  /** Stripe Price ID (price_...). Public identifier, safe to expose. */
  id: z.string().min(1, 'Stripe price id is required (set the matching NEXT_PUBLIC_STRIPE_PRICE_* env)'),
  /** Amount in the smallest currency unit, e.g. cents. Used for display only; Stripe is the source of truth. */
  amount: z.number().int().nonnegative(),
  currency: z.string().length(3).default('usd'),
  interval: z.enum(BILLING_INTERVALS).default('month'),
})

const planSchema = z.strictObject({
  /** Stable identifier, also used as the Better Auth plan name and in URLs. */
  id: z.string().regex(/^[a-z0-9-]+$/, 'plan ids are lowercase slugs'),
  name: z.string().min(1),
  description: z.string().optional(),
  prices: z.array(priceSchema).min(1),
  /** Marketing bullets shown on the pricing page and in billing settings. */
  features: z.array(z.string()).default([]),
  highlighted: z.boolean().default(false),
  /** Seat-based plans bill per member of the organization. */
  seats: z.number().int().positive().optional(),
  trialDays: z.number().int().positive().optional(),
  /** Arbitrary limits your own code can enforce, e.g. { projects: 10 }. */
  limits: z.record(z.string(), z.number()).default({}),
})

const stackSchema = z.strictObject({
  name: z.string().min(1),
  /** Short line used in metadata and the marketing hero. */
  tagline: z.string().default('A new SaaS, built on Payload CMS.'),
  description: z.string().default(''),
  /** Canonical origin, no trailing slash. */
  url: z.string().url(),
  support: z.strictObject({ email: z.string().email() }),

  auth: z
    .strictObject({
      methods: z.array(z.enum(AUTH_METHODS)).min(1).default(['email-password']),
      social: z.array(z.enum(SOCIAL_PROVIDERS)).default([]),
      twoFactor: z.boolean().default(true),
      requireEmailVerification: z.boolean().default(false),
      /** Set false to make the app invite-only (admins create users in the Payload admin). */
      allowSignUp: z.boolean().default(true),
    })
    .prefault({}),

  organizations: z
    .strictObject({
      enabled: z.boolean().default(true),
      allowUserToCreate: z.boolean().default(true),
      /** Role given to whoever creates an organization: a built-in role or an additionalRoles key. */
      creatorRole: organizationRoleSchema.default('owner'),
      teams: z.boolean().default(false),
      /** Extra roles beyond owner / admin / member, as { key: label }. */
      additionalRoles: z.record(z.string(), z.string()).default({}),
    })
    .superRefine((org, ctx) => {
      const known = [...ORGANIZATION_ROLES, ...Object.keys(org.additionalRoles)]
      if (!known.includes(org.creatorRole)) {
        ctx.addIssue({
          code: 'custom',
          path: ['creatorRole'],
          message: `"${org.creatorRole}" is not a role; use ${known.map((r) => `"${r}"`).join(', ')} or declare it in additionalRoles`,
        })
      }
    })
    .prefault({}),

  billing: z
    .discriminatedUnion('provider', [
      z.strictObject({ provider: z.literal('none') }),
      z.strictObject({
        provider: z.literal('stripe'),
        /** Who owns the subscription. 'organization' requires organizations.enabled. */
        attachedTo: z.enum(['user', 'organization']).default('organization'),
        plans: z.array(planSchema).min(1),
        /** Plan id that free / unsubscribed accounts are treated as. */
        freePlanId: z.string().optional(),
      }),
    ])
    .default({ provider: 'none' }),

  legal: z.strictObject({
    company: z.string().min(1),
    jurisdiction: z.string().min(1),
    address: z.string().optional(),
  }),

  /** Marketing navigation. Dashboard navigation lives in components/dashboard/nav-config.tsx. */
  nav: z
    .array(z.strictObject({ label: z.string(), href: z.string() }))
    .default([
      { label: 'Pricing', href: '/pricing' },
      { label: 'Docs', href: 'https://payload.solutions/docs/payload-stack' },
    ]),

  social: z
    .strictObject({
      twitter: z.string().optional(),
      github: z.string().optional(),
      linkedin: z.string().optional(),
    })
    .prefault({}),
})

export type StackInput = z.input<typeof stackSchema>
export type StackConfig = z.output<typeof stackSchema> & {
  features: {
    organizations: boolean
    teams: boolean
    billing: boolean
    billingAttachedTo: 'user' | 'organization' | null
    passkeys: boolean
    magicLink: boolean
    emailPassword: boolean
    twoFactor: boolean
  }
}

export type StackPlan = z.output<typeof planSchema>

/**
 * Validates `src/stack.config.ts` and derives `features`. Pass an object literal so TypeScript
 * checks every key and value while you type; anything that slips past the types is rejected here
 * at import time with the path of the offending key.
 */
export function defineStack(input: StackInput): StackConfig {
  const parsed = stackSchema.safeParse(input)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n')
    throw new Error(`Invalid src/stack.config.ts:\n${issues}`)
  }
  const cfg = parsed.data

  if (cfg.billing.provider === 'stripe' && cfg.billing.attachedTo === 'organization' && !cfg.organizations.enabled) {
    throw new Error(
      'Invalid src/stack.config.ts: billing.attachedTo is "organization" but organizations.enabled is false.',
    )
  }

  return {
    ...cfg,
    features: {
      organizations: cfg.organizations.enabled,
      teams: cfg.organizations.enabled && cfg.organizations.teams,
      billing: cfg.billing.provider !== 'none',
      billingAttachedTo: cfg.billing.provider === 'stripe' ? cfg.billing.attachedTo : null,
      passkeys: cfg.auth.methods.includes('passkey'),
      magicLink: cfg.auth.methods.includes('magic-link'),
      emailPassword: cfg.auth.methods.includes('email-password'),
      twoFactor: cfg.auth.twoFactor && cfg.auth.methods.includes('email-password'),
    },
  }
}

/** Plans in the shape @better-auth/stripe expects on the server. */
export function toStripePlans(cfg: StackConfig) {
  if (cfg.billing.provider !== 'stripe') return []
  return cfg.billing.plans.map((plan) => {
    const monthly = plan.prices.find((p) => p.interval === 'month') ?? plan.prices[0]!
    const yearly = plan.prices.find((p) => p.interval === 'year')
    return {
      name: plan.id,
      priceId: monthly.id,
      ...(yearly ? { annualDiscountPriceId: yearly.id } : {}),
      limits: plan.limits,
      ...(plan.trialDays ? { freeTrial: { days: plan.trialDays } } : {}),
    }
  })
}

/** Plans in the shape @better-auth-ui's billing adapter expects on the client. */
export function toBillingPlans(cfg: StackConfig) {
  if (cfg.billing.provider !== 'stripe') return []
  return cfg.billing.plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    description: plan.description,
    prices: plan.prices.map((p) => ({
      id: p.id,
      amount: p.amount,
      currency: p.currency,
      interval: p.interval,
    })),
    features: plan.features,
    highlighted: plan.highlighted,
    seatBased: Boolean(plan.seats),
  }))
}

export function formatPrice(amount: number, currency: string, locale = 'en-US') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
  }).format(amount / 100)
}
