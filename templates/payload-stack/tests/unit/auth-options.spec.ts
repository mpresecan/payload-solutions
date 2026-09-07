/**
 * src/lib/auth/options.ts: the Better Auth server options derived from stack.config.ts.
 *
 * The module builds its plugin list at import time, so each case loads it under a preset (and,
 * where relevant, a stubbed environment) and inspects the result: which plugins are registered,
 * how email/password and sign-up are configured, which social providers are wired, and how Stripe
 * behaves with and without keys.
 */
import { describe, expect, it, vi } from 'vitest'

import { defineStack, type StackInput } from '@/lib/stack'
import { base, plans, presetEntries, presets, socialEnv } from '../helpers/stack-fixtures'
import { loadWithEnv, loadWithStack } from '../helpers/with-stack'

type Plugin = { id: string; options?: Record<string, unknown> }

const loadOptions = (input: StackInput, env: Record<string, string | undefined> = {}) =>
  loadWithEnv(env, () => loadWithStack(input, () => import('@/lib/auth/options')))

const pluginIds = (options: { plugins?: unknown[] }) => (options.plugins as Plugin[]).map((p) => p.id)
const plugin = (options: { plugins?: unknown[] }, id: string) => (options.plugins as Plugin[]).find((p) => p.id === id)

const stripeEnv = { STRIPE_SECRET_KEY: 'sk_test_123', STRIPE_WEBHOOK_SECRET: 'whsec_123' }

describe('roles', () => {
  it('exposes the roles payload-auth forwards to the admin plugin', async () => {
    const { ROLES, ADMIN_ROLES } = await import('@/lib/auth/options')
    expect(ROLES).toEqual(['user', 'admin'])
    expect(ADMIN_ROLES).toEqual(['admin'])
  })
})

describe('plugins per preset', () => {
  it.each(presetEntries)('preset %s registers exactly the plugins its features need', async (_name, input) => {
    const stack = defineStack(input)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { betterAuthOptions } = await loadOptions(input, socialEnv(input))
    const ids = pluginIds(betterAuthOptions)

    // Always on.
    expect(ids.slice(0, 3)).toEqual(['admin', 'last-login-method', 'api-key'])
    // Feature driven.
    expect(ids.includes('two-factor')).toBe(stack.features.twoFactor)
    expect(ids.includes('passkey')).toBe(stack.features.passkeys)
    expect(ids.includes('magic-link')).toBe(stack.features.magicLink)
    expect(ids.includes('organization')).toBe(stack.features.organizations)
    // Stripe is registered only with keys; without them it warns once and skips the plugin.
    expect(ids.includes('stripe')).toBe(false)
    expect(warn).toHaveBeenCalledTimes(stack.features.billing ? 1 : 0)
    // nextCookies must be last so server actions can set cookies.
    expect(ids.at(-1)).toBe('next-cookies')
    // No duplicates.
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('core options', () => {
  it('derives app name, base URL, trusted origins and secret', async () => {
    const { betterAuthOptions } = await loadOptions(base, { BETTER_AUTH_SECRET: undefined, PAYLOAD_SECRET: 'payload-secret' })
    expect(betterAuthOptions.appName).toBe('Test App')
    expect(betterAuthOptions.baseURL).toBe('https://test.example')
    expect(betterAuthOptions.trustedOrigins).toEqual(['https://test.example'])
    expect(betterAuthOptions.secret).toBe('payload-secret')
  })

  it('prefers BETTER_AUTH_SECRET over PAYLOAD_SECRET when set', async () => {
    const { betterAuthOptions } = await loadOptions(base, { BETTER_AUTH_SECRET: 'ba-secret', PAYLOAD_SECRET: 'payload-secret' })
    expect(betterAuthOptions.secret).toBe('ba-secret')
  })

  it('caches the session cookie for five minutes', async () => {
    const { betterAuthOptions } = await loadOptions(base)
    expect(betterAuthOptions.session).toEqual({ cookieCache: { enabled: true, maxAge: 300 } })
  })

  it('enables email change and account deletion with confirmation emails', async () => {
    const { betterAuthOptions } = await loadOptions(base)
    expect(betterAuthOptions.user?.changeEmail?.enabled).toBe(true)
    expect(typeof betterAuthOptions.user?.changeEmail?.sendChangeEmailConfirmation).toBe('function')
    expect(betterAuthOptions.user?.deleteUser?.enabled).toBe(true)
    expect(typeof betterAuthOptions.user?.deleteUser?.sendDeleteAccountVerification).toBe('function')
  })
})

describe('email and password', () => {
  it('is enabled only when the method is listed', async () => {
    expect((await loadOptions(base)).betterAuthOptions.emailAndPassword?.enabled).toBe(true)
    expect((await loadOptions(presets['magic-link-only'])).betterAuthOptions.emailAndPassword?.enabled).toBe(false)
    expect((await loadOptions(presets['passkey-only'])).betterAuthOptions.emailAndPassword?.enabled).toBe(false)
  })

  it('maps allowSignUp to disableSignUp and requireEmailVerification to both password and verification settings', async () => {
    const open = (await loadOptions(base)).betterAuthOptions
    expect(open.emailAndPassword?.disableSignUp).toBe(false)
    expect(open.emailAndPassword?.requireEmailVerification).toBe(false)
    expect(open.emailVerification?.sendOnSignUp).toBe(false)

    const closed = (await loadOptions(presets['invite-only'])).betterAuthOptions
    expect(closed.emailAndPassword?.disableSignUp).toBe(true)
    expect(closed.emailAndPassword?.requireEmailVerification).toBe(true)
    expect(closed.emailVerification?.sendOnSignUp).toBe(true)
    expect(closed.emailVerification?.autoSignInAfterVerification).toBe(true)
  })

  it('wires every email callback', async () => {
    const { betterAuthOptions } = await loadOptions(base)
    expect(typeof betterAuthOptions.emailAndPassword?.sendResetPassword).toBe('function')
    expect(typeof betterAuthOptions.emailAndPassword?.onPasswordReset).toBe('function')
    expect(typeof betterAuthOptions.emailVerification?.sendVerificationEmail).toBe('function')
  })
})

describe('two-factor, passkeys and magic links', () => {
  it('names the two-factor issuer after the product', async () => {
    const { betterAuthOptions } = await loadOptions(base)
    expect(plugin(betterAuthOptions, 'two-factor')?.options).toEqual({ issuer: 'Test App' })
  })

  it('derives passkey relying party from the product url', async () => {
    const { betterAuthOptions } = await loadOptions({ ...base, url: 'https://app.test.example' , auth: { methods: ['passkey'] } })
    expect(plugin(betterAuthOptions, 'passkey')?.options).toEqual({
      rpName: 'Test App',
      rpID: 'app.test.example',
      origin: 'https://app.test.example',
    })
  })

  it('gives magic links a five minute lifetime and a sender', async () => {
    const { betterAuthOptions } = await loadOptions(presets['magic-link-only'])
    const magic = plugin(betterAuthOptions, 'magic-link')
    expect(magic?.options).toMatchObject({ expiresIn: 300 })
    expect(typeof magic?.options?.sendMagicLink).toBe('function')
  })
})

describe('organizations', () => {
  it('forwards allowUserToCreate, creatorRole and invitation policy', async () => {
    const { betterAuthOptions } = await loadOptions(presets['custom-roles'])
    const org = plugin(betterAuthOptions, 'organization')
    expect(org?.options).toMatchObject({
      allowUserToCreateOrganization: false,
      creatorRole: 'founder',
      invitationExpiresIn: 48 * 60 * 60,
      cancelPendingInvitationsOnReInvite: true,
    })
    expect(org?.options?.teams).toBeUndefined()
    expect(typeof org?.options?.sendInvitationEmail).toBe('function')
  })

  it('enables teams only when configured', async () => {
    const { betterAuthOptions } = await loadOptions(presets.teams)
    expect(plugin(betterAuthOptions, 'organization')?.options?.teams).toEqual({ enabled: true })
  })

  it('registers no organization plugin when organizations are off', async () => {
    const { betterAuthOptions } = await loadOptions(presets['orgs-off'])
    expect(plugin(betterAuthOptions, 'organization')).toBeUndefined()
  })
})

describe('social providers', () => {
  it('is empty when none are configured', async () => {
    const { betterAuthOptions } = await loadOptions(base)
    expect(betterAuthOptions.socialProviders).toEqual({})
  })

  it.each([
    ['google', 'GOOGLE'],
    ['github', 'GITHUB'],
    ['microsoft', 'MICROSOFT'],
    ['apple', 'APPLE'],
    ['discord', 'DISCORD'],
  ] as const)('fails at import when %s is listed but its credentials are missing', async (provider, prefix) => {
    const input: StackInput = { ...base, auth: { social: [provider] } }
    await expect(loadOptions(input, { [`${prefix}_CLIENT_ID`]: undefined, [`${prefix}_CLIENT_SECRET`]: undefined })).rejects.toThrow(
      `stack.config.ts lists "${provider}" under auth.social but ${prefix}_CLIENT_ID / _CLIENT_SECRET are not set.`,
    )
    // Half a credential pair is still missing.
    await expect(loadOptions(input, { [`${prefix}_CLIENT_ID`]: 'id', [`${prefix}_CLIENT_SECRET`]: undefined })).rejects.toThrow(/not set/)
  })

  it('wires every listed provider with its credentials and nothing else', async () => {
    const env = {
      GOOGLE_CLIENT_ID: 'g-id',
      GOOGLE_CLIENT_SECRET: 'g-secret',
      GITHUB_CLIENT_ID: 'gh-id',
      GITHUB_CLIENT_SECRET: 'gh-secret',
      MICROSOFT_CLIENT_ID: 'ms-id',
      MICROSOFT_CLIENT_SECRET: 'ms-secret',
      APPLE_CLIENT_ID: 'ap-id',
      APPLE_CLIENT_SECRET: 'ap-secret',
      DISCORD_CLIENT_ID: 'dc-id',
      DISCORD_CLIENT_SECRET: 'dc-secret',
    }
    const { betterAuthOptions } = await loadOptions(presets['all-auth'], env)
    expect(betterAuthOptions.socialProviders).toEqual({
      google: { clientId: 'g-id', clientSecret: 'g-secret' },
      github: { clientId: 'gh-id', clientSecret: 'gh-secret' },
      microsoft: { clientId: 'ms-id', clientSecret: 'ms-secret' },
      apple: { clientId: 'ap-id', clientSecret: 'ap-secret' },
      discord: { clientId: 'dc-id', clientSecret: 'dc-secret' },
    })

    const onlyGithub = await loadOptions({ ...base, auth: { social: ['github'] } }, env)
    expect(Object.keys(onlyGithub.betterAuthOptions.socialProviders ?? {})).toEqual(['github'])
  })
})

describe('stripe', () => {
  it('registers the Stripe plugin with keys, before nextCookies', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { betterAuthOptions } = await loadOptions(presets['billing-org'], stripeEnv)
    const ids = pluginIds(betterAuthOptions)
    expect(ids.indexOf('stripe')).toBe(ids.length - 2)
    expect(warn).not.toHaveBeenCalled()
  })

  it('maps plans and organization mode for per-organization billing', async () => {
    const { betterAuthOptions } = await loadOptions(presets['billing-org'], stripeEnv)
    const options = plugin(betterAuthOptions, 'stripe')?.options as Record<string, unknown>
    expect(options.stripeWebhookSecret).toBe('whsec_123')
    expect(options.createCustomerOnSignUp).toBe(false)
    expect(options.organization).toEqual({ enabled: true })
    expect(options.subscription).toMatchObject({
      enabled: true,
      requireEmailVerification: false,
      plans: [
        { name: 'starter', priceId: 'price_starter_m' },
        { name: 'team', priceId: 'price_team_m', annualDiscountPriceId: 'price_team_y', freeTrial: { days: 14 } },
      ],
    })
    const { authorizeSubscriptionReference } = await import('@/lib/auth/billing-authorization')
    expect((options.subscription as { authorizeReference: unknown }).authorizeReference).toBe(authorizeSubscriptionReference)
  })

  it('creates Stripe customers on sign-up for per-user billing and leaves organizations out', async () => {
    const { betterAuthOptions } = await loadOptions(presets['billing-user-with-orgs'], stripeEnv)
    const options = plugin(betterAuthOptions, 'stripe')?.options as Record<string, unknown>
    expect(options.createCustomerOnSignUp).toBe(true)
    expect(options.organization).toBeUndefined()
  })

  it('passes requireEmailVerification through to subscriptions', async () => {
    const input: StackInput = {
      ...base,
      auth: { requireEmailVerification: true },
      billing: { provider: 'stripe', attachedTo: 'user', plans },
    }
    const { betterAuthOptions } = await loadOptions(input, stripeEnv)
    const options = plugin(betterAuthOptions, 'stripe')?.options as { subscription: { requireEmailVerification: boolean } }
    expect(options.subscription.requireEmailVerification).toBe(true)
  })

  it.each([
    ['both missing', {}],
    ['secret only', { STRIPE_SECRET_KEY: 'sk_test_123' }],
    ['webhook only', { STRIPE_WEBHOOK_SECRET: 'whsec_123' }],
  ])('skips Stripe and warns when keys are incomplete (%s)', async (_label, env) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { betterAuthOptions } = await loadOptions(presets['billing-org'], { STRIPE_SECRET_KEY: undefined, STRIPE_WEBHOOK_SECRET: undefined, ...env })
    expect(pluginIds(betterAuthOptions)).not.toContain('stripe')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are not set'))
  })

  it('never registers Stripe without billing, even with keys present', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { betterAuthOptions } = await loadOptions(presets['orgs-off'], stripeEnv)
    expect(pluginIds(betterAuthOptions)).not.toContain('stripe')
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('authorizeSubscriptionReference', () => {
  const load = (members: Array<{ role: string }>) => {
    vi.resetModules()
    const find = vi.fn(async () => ({ docs: members }))
    vi.doMock('@/lib/payload', () => ({ getPayloadClient: async () => ({ db: { defaultIDType: 'number' }, find }) }))
    return import('@/lib/auth/billing-authorization').then((m) => ({ ...m, find }))
  }

  it('always allows a user to manage their own subscription without touching the database', async () => {
    const { authorizeSubscriptionReference, find } = await load([])
    await expect(authorizeSubscriptionReference({ user: { id: '7' }, referenceId: '7' })).resolves.toBe(true)
    expect(find).not.toHaveBeenCalled()
  })

  it.each([
    ['owner', true],
    ['admin', true],
    ['member', false],
    ['founder', false],
  ])('role %s → %s for an organization reference', async (role, expected) => {
    const { authorizeSubscriptionReference, find } = await load([{ role }])
    await expect(authorizeSubscriptionReference({ user: { id: '7' }, referenceId: '42' })).resolves.toBe(expected)
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'members',
        where: { and: [{ user: { equals: 7 } }, { organization: { equals: 42 } }] },
        overrideAccess: true,
      }),
    )
  })

  it('denies when the user is not a member at all', async () => {
    const { authorizeSubscriptionReference } = await load([])
    await expect(authorizeSubscriptionReference({ user: { id: '7' }, referenceId: '42' })).resolves.toBe(false)
  })
})
