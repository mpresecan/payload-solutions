import { describe, expect, it } from 'vitest'

import { defineStack, toBillingPlans, toStripePlans } from '@/lib/stack'

const base = {
  name: 'Test App',
  url: 'https://test.example',
  support: { email: 'help@test.example' },
  legal: { company: 'Test Ltd', jurisdiction: 'Ireland' },
}

describe('defineStack', () => {
  it('applies defaults and derives feature flags', () => {
    const stack = defineStack(base)
    expect(stack.auth.methods).toEqual(['email-password'])
    expect(stack.organizations.enabled).toBe(true)
    expect(stack.billing.provider).toBe('none')
    expect(stack.features).toMatchObject({
      organizations: true,
      billing: false,
      emailPassword: true,
      magicLink: false,
      passkeys: false,
      twoFactor: true,
    })
  })

  it('rejects organization billing when organizations are disabled', () => {
    expect(() =>
      defineStack({
        ...base,
        organizations: { enabled: false },
        billing: {
          provider: 'stripe',
          attachedTo: 'organization',
          plans: [{ id: 'pro', name: 'Pro', prices: [{ id: 'price_1', amount: 1000 }] }],
        },
      }),
    ).toThrow(/organizations\.enabled is false/)
  })

  it('rejects unknown keys so a typo cannot pass silently', () => {
    // @ts-expect-error `nme` is not a StackInput key; tsc catches it and so does the schema.
    expect(() => defineStack({ ...base, nme: 'x' })).toThrow(/\(root\): Unrecognized key/)
    // @ts-expect-error `twoFactr` is not an auth key.
    expect(() => defineStack({ ...base, auth: { twoFactr: true } })).toThrow(/auth: Unrecognized key/)
  })

  it('rejects wrong enum values', () => {
    // @ts-expect-error not an auth method.
    expect(() => defineStack({ ...base, auth: { methods: ['email-pasword'] } })).toThrow(/auth\.methods\.0/)
  })

  it('requires creatorRole to be built in or declared in additionalRoles', () => {
    expect(() => defineStack({ ...base, organizations: { creatorRole: 'ownerr' } })).toThrow(
      /organizations\.creatorRole: "ownerr" is not a role/,
    )
    const custom = defineStack({
      ...base,
      organizations: { creatorRole: 'founder', additionalRoles: { founder: 'Founder' } },
    })
    expect(custom.organizations.creatorRole).toBe('founder')
    expect(defineStack({ ...base, organizations: { creatorRole: 'admin' } }).organizations.creatorRole).toBe('admin')
  })

  it('rejects invalid plan ids with a readable message', () => {
    expect(() =>
      defineStack({
        ...base,
        billing: { provider: 'stripe', plans: [{ id: 'Pro Plan', name: 'Pro', prices: [{ id: 'price_1', amount: 1000 }] }] },
      }),
    ).toThrow(/billing\.plans\.0\.id/)
  })

  it('maps plans for Better Auth Stripe and for Better Auth UI', () => {
    const stack = defineStack({
      ...base,
      billing: {
        provider: 'stripe',
        attachedTo: 'user',
        plans: [
          {
            id: 'team',
            name: 'Team',
            prices: [
              { id: 'price_m', amount: 9900, interval: 'month' },
              { id: 'price_y', amount: 99000, interval: 'year' },
            ],
            seats: 25,
            trialDays: 14,
            limits: { projects: -1 },
          },
        ],
      },
    })
    expect(toStripePlans(stack)).toEqual([
      { name: 'team', priceId: 'price_m', annualDiscountPriceId: 'price_y', limits: { projects: -1 }, freeTrial: { days: 14 } },
    ])
    expect(toBillingPlans(stack)[0]).toMatchObject({ id: 'team', seatBased: true, prices: [{ id: 'price_m', amount: 9900 }, { id: 'price_y' }] })
  })
})
