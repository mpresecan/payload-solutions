/**
 * Plan mapping helpers in src/lib/stack.ts: the shapes handed to @better-auth/stripe on the server
 * and to Better Auth UI's billing adapter on the client, plus price formatting.
 */
import { describe, expect, it } from 'vitest'

import { defineStack, formatPrice, toBillingPlans, toStripePlans, type StackInput } from '@/lib/stack'
import { base, plans, presets } from '../helpers/stack-fixtures'

const stripe = (planList: NonNullable<Extract<StackInput['billing'], { provider: 'stripe' }>['plans']>) =>
  defineStack({ ...base, billing: { provider: 'stripe', attachedTo: 'user', plans: planList } })

describe('toStripePlans', () => {
  it('returns nothing without billing', () => {
    expect(toStripePlans(defineStack(base))).toEqual([])
    expect(toStripePlans(defineStack(presets['orgs-off']))).toEqual([])
  })

  it('maps every plan: id as name, monthly price, yearly as annual discount, limits, trial', () => {
    expect(toStripePlans(defineStack(presets['billing-org']))).toEqual([
      { name: 'starter', priceId: 'price_starter_m', limits: { projects: 10 } },
      { name: 'team', priceId: 'price_team_m', annualDiscountPriceId: 'price_team_y', limits: { projects: -1 }, freeTrial: { days: 14 } },
    ])
  })

  it('falls back to the first price when there is no monthly price', () => {
    const stack = stripe([{ id: 'yearly', name: 'Yearly', prices: [{ id: 'price_y', amount: 100, interval: 'year' }] }])
    expect(toStripePlans(stack)).toEqual([{ name: 'yearly', priceId: 'price_y', annualDiscountPriceId: 'price_y', limits: {} }])
  })

  it('uses one-time prices as the base price when that is all there is', () => {
    const stack = stripe([{ id: 'lifetime', name: 'Lifetime', prices: [{ id: 'price_once', amount: 100, interval: 'one-time' }] }])
    expect(toStripePlans(stack)).toEqual([{ name: 'lifetime', priceId: 'price_once', limits: {} }])
  })

  it('omits freeTrial when trialDays is unset and annualDiscountPriceId without a yearly price', () => {
    const [starter] = toStripePlans(defineStack(presets['billing-org']))
    expect(starter).not.toHaveProperty('freeTrial')
    expect(starter).not.toHaveProperty('annualDiscountPriceId')
  })
})

describe('toBillingPlans', () => {
  it('returns nothing without billing', () => {
    expect(toBillingPlans(defineStack(base))).toEqual([])
  })

  it('maps every plan for the client, marking seat-based plans', () => {
    expect(toBillingPlans(defineStack(presets['billing-org']))).toEqual([
      {
        id: 'starter',
        name: 'Starter',
        description: 'For small teams getting started.',
        prices: [{ id: 'price_starter_m', amount: 2900, currency: 'usd', interval: 'month' }],
        features: ['Up to 3 members', '10 projects'],
        highlighted: false,
        seatBased: false,
      },
      {
        id: 'team',
        name: 'Team',
        description: 'For growing teams that need room.',
        prices: [
          { id: 'price_team_m', amount: 9900, currency: 'usd', interval: 'month' },
          { id: 'price_team_y', amount: 99000, currency: 'usd', interval: 'year' },
        ],
        features: ['Up to 25 members', 'Unlimited projects'],
        highlighted: true,
        seatBased: true,
      },
    ])
  })

  it('never leaks server-side plan fields (limits, trialDays, seats) to the client', () => {
    for (const plan of toBillingPlans(defineStack(presets['billing-org']))) {
      expect(Object.keys(plan).sort()).toEqual(['description', 'features', 'highlighted', 'id', 'name', 'prices', 'seatBased'])
    }
  })

  it('keeps the same order and count as the config', () => {
    const stack = defineStack({ ...base, billing: { provider: 'stripe', plans: [...plans].reverse() } })
    expect(toBillingPlans(stack).map((p) => p.id)).toEqual(['team', 'starter'])
    expect(toStripePlans(stack).map((p) => p.name)).toEqual(['team', 'starter'])
  })
})

describe('formatPrice', () => {
  it.each([
    [2900, 'usd', '$29'],
    [2950, 'usd', '$29.50'],
    [0, 'usd', '$0'],
    [99000, 'usd', '$990'],
    [1, 'usd', '$0.01'],
    [2900, 'eur', '€29'],
    [2900, 'EUR', '€29'],
    [2900, 'gbp', '£29'],
  ])('formats %i %s as %s', (amount, currency, expected) => {
    expect(formatPrice(amount, currency)).toBe(expected)
  })

  it('respects the locale', () => {
    // Intl separates the amount and symbol with a non-breaking space; compare on plain spaces.
    expect(formatPrice(2950, 'eur', 'de-DE').replace(/ /g, ' ')).toBe('29,50 €')
  })
})
