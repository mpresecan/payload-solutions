/**
 * src/lib/stack.ts: the schema behind stack.config.ts.
 *
 * Every option, its default, its validation rule and the feature flag it derives is pinned here.
 * When you add or change an option, this file is the first one to fail, and the first one to
 * extend.
 */
import { describe, expect, it } from 'vitest'

import {
  AUTH_METHODS,
  BILLING_INTERVALS,
  ORGANIZATION_ROLES,
  SOCIAL_PROVIDERS,
  defineStack,
  type StackInput,
} from '@/lib/stack'
import { base, configMatrix, plans, presetEntries, presets } from '../helpers/stack-fixtures'

const stripeUser = { provider: 'stripe', attachedTo: 'user', plans } satisfies StackInput['billing']

describe('constants', () => {
  it('exposes the option vocabularies the CLI and UI rely on', () => {
    expect(AUTH_METHODS).toEqual(['email-password', 'magic-link', 'passkey'])
    expect(SOCIAL_PROVIDERS).toEqual(['google', 'github', 'microsoft', 'apple', 'discord'])
    expect(BILLING_INTERVALS).toEqual(['month', 'year', 'one-time'])
    expect(ORGANIZATION_ROLES).toEqual(['owner', 'admin', 'member'])
  })
})

describe('defaults', () => {
  const stack = defineStack(base)

  it('fills every optional section with its documented default', () => {
    expect(stack.tagline).toBe('A new SaaS, built on Payload CMS.')
    expect(stack.description).toBe('')
    expect(stack.auth).toEqual({
      methods: ['email-password'],
      social: [],
      twoFactor: true,
      requireEmailVerification: false,
      allowSignUp: true,
    })
    expect(stack.organizations).toEqual({
      enabled: true,
      allowUserToCreate: true,
      creatorRole: 'owner',
      teams: false,
      additionalRoles: {},
    })
    expect(stack.billing).toEqual({ provider: 'none' })
    expect(stack.nav).toEqual([
      { label: 'Pricing', href: '/pricing' },
      { label: 'Docs', href: 'https://payload.solutions/docs/payload-stack' },
    ])
    expect(stack.social).toEqual({})
    expect(stack.legal).toEqual({ company: 'Test Ltd', jurisdiction: 'Ireland' })
  })

  it('keeps the required keys verbatim', () => {
    expect(stack.name).toBe('Test App')
    expect(stack.url).toBe('https://test.example')
    expect(stack.support.email).toBe('help@test.example')
  })

  it('derives feature flags from the defaults', () => {
    expect(stack.features).toEqual({
      organizations: true,
      teams: false,
      billing: false,
      billingAttachedTo: null,
      passkeys: false,
      magicLink: false,
      emailPassword: true,
      twoFactor: true,
    })
  })

  it('does not mutate the input', () => {
    const input: StackInput = { ...base, auth: { methods: ['passkey'] } }
    const snapshot = structuredClone(input)
    defineStack(input)
    expect(input).toEqual(snapshot)
  })
})

describe('required keys', () => {
  it.each([
    ['name', { ...base, name: '' }, /name/],
    ['url', { ...base, url: 'not a url' }, /url: Invalid URL/],
    ['support.email', { ...base, support: { email: 'nope' } }, /support\.email/],
    ['legal.company', { ...base, legal: { company: '', jurisdiction: 'x' } }, /legal\.company/],
    ['legal.jurisdiction', { ...base, legal: { company: 'x', jurisdiction: '' } }, /legal\.jurisdiction/],
  ] as const)('rejects an invalid %s with its path in the message', (_key, input, pattern) => {
    expect(() => defineStack(input as StackInput)).toThrow(/Invalid src\/stack\.config\.ts/)
    expect(() => defineStack(input as StackInput)).toThrow(pattern)
  })

  it('rejects a missing section entirely', () => {
    const { legal: _legal, ...withoutLegal } = base
    expect(() => defineStack(withoutLegal as StackInput)).toThrow(/legal/)
  })
})

describe('strictness', () => {
  it('rejects unknown keys at every level with the path of the offending key', () => {
    // @ts-expect-error unknown root key
    expect(() => defineStack({ ...base, nme: 'x' })).toThrow(/\(root\): Unrecognized key: "nme"/)
    // @ts-expect-error unknown auth key
    expect(() => defineStack({ ...base, auth: { twoFactr: true } })).toThrow(/auth: Unrecognized key: "twoFactr"/)
    // @ts-expect-error unknown organizations key
    expect(() => defineStack({ ...base, organizations: { enable: true } })).toThrow(/organizations: Unrecognized key/)
    // @ts-expect-error unknown legal key
    expect(() => defineStack({ ...base, legal: { ...base.legal, country: 'IE' } })).toThrow(/legal: Unrecognized key/)
    // @ts-expect-error unknown social key
    expect(() => defineStack({ ...base, social: { mastodon: 'x' } })).toThrow(/social: Unrecognized key/)
    // @ts-expect-error unknown nav item key
    expect(() => defineStack({ ...base, nav: [{ label: 'x', href: '/x', icon: 'y' }] })).toThrow(/nav\.0: Unrecognized key/)
    expect(() =>
      defineStack({
        ...base,
        // @ts-expect-error unknown plan key
        billing: { provider: 'stripe', plans: [{ id: 'p', name: 'P', prices: [{ id: 'x', amount: 1 }], popular: true }] },
      }),
    ).toThrow(/billing\.plans\.0: Unrecognized key/)
    expect(() =>
      defineStack({
        ...base,
        // @ts-expect-error unknown price key
        billing: { provider: 'stripe', plans: [{ id: 'p', name: 'P', prices: [{ id: 'x', amount: 1, period: 'month' }] }] },
      }),
    ).toThrow(/billing\.plans\.0\.prices\.0: Unrecognized key/)
  })

  it('lists every issue, not only the first one', () => {
    expect(() => defineStack({ ...base, name: '', url: 'x' })).toThrow(/name[\s\S]*url/)
  })
})

describe('auth', () => {
  it('accepts every documented method and provider', () => {
    const stack = defineStack({ ...base, auth: { methods: [...AUTH_METHODS], social: [...SOCIAL_PROVIDERS] } })
    expect(stack.auth.methods).toEqual([...AUTH_METHODS])
    expect(stack.auth.social).toEqual([...SOCIAL_PROVIDERS])
  })

  it('rejects unknown methods and providers with the index in the path', () => {
    // @ts-expect-error not an auth method
    expect(() => defineStack({ ...base, auth: { methods: ['email-pasword'] } })).toThrow(/auth\.methods\.0/)
    // @ts-expect-error not a provider
    expect(() => defineStack({ ...base, auth: { social: ['google', 'facebook'] } })).toThrow(/auth\.social\.1/)
  })

  it('requires at least one method', () => {
    expect(() => defineStack({ ...base, auth: { methods: [] } })).toThrow(/auth\.methods/)
  })

  it.each([
    [['email-password'], true, true],
    [['email-password'], false, false],
    [['magic-link'], true, false],
    [['passkey'], true, false],
    [['magic-link', 'passkey'], true, false],
    [['email-password', 'magic-link'], true, true],
  ] as const)('methods=%j twoFactor=%s → features.twoFactor=%s', (methods, twoFactor, expected) => {
    const stack = defineStack({ ...base, auth: { methods: [...methods], twoFactor } })
    expect(stack.features.twoFactor).toBe(expected)
  })

  it('keeps allowSignUp and requireEmailVerification as given', () => {
    const stack = defineStack(presets['invite-only'])
    expect(stack.auth.allowSignUp).toBe(false)
    expect(stack.auth.requireEmailVerification).toBe(true)
  })
})

describe('organizations', () => {
  it('accepts every built-in creatorRole', () => {
    for (const role of ORGANIZATION_ROLES) {
      expect(defineStack({ ...base, organizations: { creatorRole: role } }).organizations.creatorRole).toBe(role)
    }
  })

  it('accepts a creatorRole declared in additionalRoles', () => {
    const stack = defineStack(presets['custom-roles'])
    expect(stack.organizations.creatorRole).toBe('founder')
    expect(stack.organizations.additionalRoles).toEqual({ founder: 'Founder', billing: 'Billing contact' })
    expect(stack.organizations.allowUserToCreate).toBe(false)
  })

  it('rejects a creatorRole that is neither built in nor declared, and names the alternatives', () => {
    expect(() => defineStack({ ...base, organizations: { creatorRole: 'ownerr' } })).toThrow(
      /organizations\.creatorRole: "ownerr" is not a role; use "owner", "admin", "member"/,
    )
    expect(() =>
      defineStack({ ...base, organizations: { creatorRole: 'founder', additionalRoles: { lead: 'Lead' } } }),
    ).toThrow(/"founder" is not a role; use "owner", "admin", "member", "lead"/)
  })

  it('rejects an empty creatorRole', () => {
    expect(() => defineStack({ ...base, organizations: { creatorRole: '' } })).toThrow(/creatorRole/)
  })

  it('derives teams only when organizations are enabled', () => {
    expect(defineStack({ ...base, organizations: { enabled: true, teams: true } }).features.teams).toBe(true)
    expect(defineStack({ ...base, organizations: { enabled: false, teams: true } }).features.teams).toBe(false)
    expect(defineStack({ ...base, organizations: { enabled: true, teams: false } }).features.teams).toBe(false)
  })
})

describe('billing', () => {
  it('defaults to no billing', () => {
    expect(defineStack(base).billing).toEqual({ provider: 'none' })
    expect(defineStack({ ...base, billing: { provider: 'none' } }).features.billing).toBe(false)
  })

  it('rejects unknown providers', () => {
    // @ts-expect-error not a provider
    expect(() => defineStack({ ...base, billing: { provider: 'paddle' } })).toThrow(/billing/)
  })

  it('rejects extra keys on provider none', () => {
    // @ts-expect-error plans do not belong to provider none
    expect(() => defineStack({ ...base, billing: { provider: 'none', plans } })).toThrow(/billing/)
  })

  it('requires at least one plan and at least one price per plan', () => {
    expect(() => defineStack({ ...base, billing: { provider: 'stripe', plans: [] } })).toThrow(/billing\.plans/)
    expect(() => defineStack({ ...base, billing: { provider: 'stripe', plans: [{ id: 'p', name: 'P', prices: [] }] } })).toThrow(
      /billing\.plans\.0\.prices/,
    )
  })

  it('defaults attachedTo to organization', () => {
    const stack = defineStack({ ...base, billing: { provider: 'stripe', plans } })
    expect(stack.billing.provider === 'stripe' && stack.billing.attachedTo).toBe('organization')
    expect(stack.features.billingAttachedTo).toBe('organization')
  })

  it('rejects organization billing when organizations are disabled', () => {
    expect(() =>
      defineStack({ ...base, organizations: { enabled: false }, billing: { provider: 'stripe', attachedTo: 'organization', plans } }),
    ).toThrow(/billing\.attachedTo is "organization" but organizations\.enabled is false/)
    // ...including through the default attachedTo
    expect(() => defineStack({ ...base, organizations: { enabled: false }, billing: { provider: 'stripe', plans } })).toThrow(
      /organizations\.enabled is false/,
    )
  })

  it('allows user billing with organizations either way', () => {
    expect(defineStack({ ...base, organizations: { enabled: false }, billing: stripeUser }).features.billingAttachedTo).toBe('user')
    expect(defineStack({ ...base, organizations: { enabled: true }, billing: stripeUser }).features.billingAttachedTo).toBe('user')
  })

  it('keeps freePlanId', () => {
    const stack = defineStack(presets['billing-org'])
    expect(stack.billing.provider === 'stripe' && stack.billing.freePlanId).toBe('starter')
  })

  describe('plans', () => {
    const withPlan = (plan: Record<string, unknown>) =>
      defineStack({ ...base, billing: { provider: 'stripe', plans: [plan as never] } })
    const planOf = (input: StackInput) => {
      const stack = defineStack(input)
      if (stack.billing.provider !== 'stripe') throw new Error('expected stripe')
      return stack.billing.plans[0]!
    }

    it('applies plan and price defaults', () => {
      const plan = planOf({ ...base, billing: { provider: 'stripe', plans: [{ id: 'pro', name: 'Pro', prices: [{ id: 'price_1', amount: 1000 }] }] } })
      expect(plan).toEqual({
        id: 'pro',
        name: 'Pro',
        prices: [{ id: 'price_1', amount: 1000, currency: 'usd', interval: 'month' }],
        features: [],
        highlighted: false,
        limits: {},
      })
      expect(plan.description).toBeUndefined()
      expect(plan.seats).toBeUndefined()
      expect(plan.trialDays).toBeUndefined()
    })

    it.each(['Pro Plan', 'pro_plan', 'Pro', 'pro.1', ''])('rejects plan id %j (must be a lowercase slug)', (id) => {
      expect(() => withPlan({ id, name: 'Pro', prices: [{ id: 'price_1', amount: 1000 }] })).toThrow(/billing\.plans\.0\.id: plan ids are lowercase slugs/)
    })

    it.each(['pro', 'pro-2', 'team-yearly-2026', 'a'])('accepts plan id %j', (id) => {
      expect(withPlan({ id, name: 'Pro', prices: [{ id: 'price_1', amount: 1000 }] }).billing.provider).toBe('stripe')
    })

    it('requires a plan name', () => {
      expect(() => withPlan({ id: 'pro', name: '', prices: [{ id: 'price_1', amount: 1000 }] })).toThrow(/billing\.plans\.0\.name/)
    })

    it('requires a Stripe price id and explains where it comes from', () => {
      expect(() => withPlan({ id: 'pro', name: 'Pro', prices: [{ id: '', amount: 1000 }] })).toThrow(
        /billing\.plans\.0\.prices\.0\.id: Stripe price id is required \(set the matching NEXT_PUBLIC_STRIPE_PRICE_\* env\)/,
      )
    })

    it('validates amounts as non-negative integers in minor units', () => {
      expect(() => withPlan({ id: 'pro', name: 'Pro', prices: [{ id: 'price_1', amount: -1 }] })).toThrow(/prices\.0\.amount/)
      expect(() => withPlan({ id: 'pro', name: 'Pro', prices: [{ id: 'price_1', amount: 10.5 }] })).toThrow(/prices\.0\.amount/)
      expect(withPlan({ id: 'free', name: 'Free', prices: [{ id: 'price_free', amount: 0 }] }).features.billing).toBe(true)
    })

    it('validates currency as a 3-letter code and keeps its case', () => {
      expect(() => withPlan({ id: 'pro', name: 'Pro', prices: [{ id: 'price_1', amount: 1, currency: 'usdd' }] })).toThrow(/prices\.0\.currency/)
      expect(() => withPlan({ id: 'pro', name: 'Pro', prices: [{ id: 'price_1', amount: 1, currency: 'us' }] })).toThrow(/prices\.0\.currency/)
      const plan = planOf({ ...base, billing: { provider: 'stripe', plans: [{ id: 'pro', name: 'Pro', prices: [{ id: 'price_1', amount: 1, currency: 'EUR' }] }] } })
      expect(plan.prices[0]!.currency).toBe('EUR')
    })

    it('accepts every billing interval and rejects others', () => {
      for (const interval of BILLING_INTERVALS) {
        const plan = planOf({ ...base, billing: { provider: 'stripe', plans: [{ id: 'pro', name: 'Pro', prices: [{ id: 'price_1', amount: 1, interval }] }] } })
        expect(plan.prices[0]!.interval).toBe(interval)
      }
      expect(() => withPlan({ id: 'pro', name: 'Pro', prices: [{ id: 'price_1', amount: 1, interval: 'weekly' }] })).toThrow(/prices\.0\.interval/)
    })

    it('requires positive integers for seats and trialDays', () => {
      const prices = [{ id: 'price_1', amount: 1 }]
      expect(() => withPlan({ id: 'pro', name: 'Pro', prices, seats: 0 })).toThrow(/plans\.0\.seats/)
      expect(() => withPlan({ id: 'pro', name: 'Pro', prices, seats: 2.5 })).toThrow(/plans\.0\.seats/)
      expect(() => withPlan({ id: 'pro', name: 'Pro', prices, trialDays: -7 })).toThrow(/plans\.0\.trialDays/)
      expect(() => withPlan({ id: 'pro', name: 'Pro', prices, trialDays: 0 })).toThrow(/plans\.0\.trialDays/)
    })

    it('accepts arbitrary numeric limits (negative means unlimited by convention)', () => {
      const plan = planOf({ ...base, billing: { provider: 'stripe', plans: [{ id: 'pro', name: 'Pro', prices: [{ id: 'price_1', amount: 1 }], limits: { projects: -1, seats: 10, storageGb: 0 } }] } })
      expect(plan.limits).toEqual({ projects: -1, seats: 10, storageGb: 0 })
      expect(() => withPlan({ id: 'pro', name: 'Pro', prices: [{ id: 'price_1', amount: 1 }], limits: { projects: 'many' } })).toThrow(
        /plans\.0\.limits\.projects/,
      )
    })

    it('keeps plan order', () => {
      const stack = defineStack({ ...base, billing: { provider: 'stripe', plans } })
      expect(stack.billing.provider === 'stripe' && stack.billing.plans.map((p) => p.id)).toEqual(['starter', 'team'])
    })
  })
})

describe('nav and social', () => {
  it('accepts custom navigation and every social link', () => {
    const stack = defineStack(presets['custom-nav'])
    expect(stack.nav).toEqual([
      { label: 'Changelog', href: '/changelog' },
      { label: 'Blog', href: 'https://blog.test.example' },
    ])
    expect(stack.social).toEqual({
      github: 'https://github.com/test',
      twitter: 'https://x.com/test',
      linkedin: 'https://linkedin.com/company/test',
    })
    expect(stack.legal.address).toBe('1 Test Street, Dublin')
    expect(stack.tagline).toBe('Ship faster')
    expect(stack.description).toBe('A product description.')
  })

  it('allows an empty navigation', () => {
    expect(defineStack({ ...base, nav: [] }).nav).toEqual([])
  })
})

describe('presets', () => {
  it.each(presetEntries)('preset %s is a valid configuration', (_name, input) => {
    expect(() => defineStack(input)).not.toThrow()
  })
})

describe('feature derivation across the full option matrix', () => {
  const cases = configMatrix()

  it('covers every combination of methods, two-factor, organizations and billing', () => {
    // 7 method subsets × 2 two-factor × (orgs off: 2 billing modes + orgs on: 3 + teams: 3)
    expect(cases).toHaveLength(7 * 2 * (2 + 3 + 3))
    expect(new Set(cases.map((c) => c.name)).size).toBe(cases.length)
  })

  it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const stack = defineStack(c.input)
    expect(stack.features).toEqual({
      organizations: c.organizations,
      teams: c.teams,
      billing: c.billing !== 'none',
      billingAttachedTo: c.billing === 'none' ? null : c.billing,
      passkeys: c.methods.includes('passkey'),
      magicLink: c.methods.includes('magic-link'),
      emailPassword: c.methods.includes('email-password'),
      twoFactor: c.twoFactor && c.methods.includes('email-password'),
    })
  })
})
