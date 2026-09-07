// @vitest-environment jsdom
/**
 * src/components/providers.tsx: the Better Auth UI plugin list and provider props derived from
 * stack.config.ts. `<AuthProvider>` is replaced with a stub that records its props, so each preset
 * can be rendered and inspected without a browser.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { paths } from '@/lib/paths'
import { defineStack, type StackInput } from '@/lib/stack'
import { presetEntries, presets } from '../helpers/stack-fixtures'
import { loadWithStack } from '../helpers/with-stack'

type CapturedProps = Record<string, unknown> & { plugins: Array<{ id: string } & Record<string, unknown>> }
let captured: CapturedProps | null = null

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/components/auth/auth-provider', () => ({
  AuthProvider: (props: CapturedProps & { children: React.ReactNode }) => {
    captured = props
    return <>{props.children}</>
  },
}))

afterEach(() => {
  cleanup()
  captured = null
})

async function renderProviders(input: StackInput, billingReady = true) {
  const { Providers } = await loadWithStack(input, () => import('@/components/providers'))
  render(
    <Providers billingReady={billingReady}>
      <span>child</span>
    </Providers>,
  )
  if (!captured) throw new Error('AuthProvider was not rendered')
  return captured as CapturedProps
}

const ids = (props: CapturedProps) => props.plugins.map((p) => p.id)

describe('Providers plugin list', () => {
  it.each(presetEntries)('preset %s mirrors the server features', async (_name, input) => {
    const stack = defineStack(input)
    const props = await renderProviders(input)
    const list = ids(props)

    // Better Auth UI plugin ids are camelCase, unlike the server plugins.
    for (const always of ['admin', 'lastLoginMethod', 'theme', 'deleteUser', 'apiKey']) expect(list).toContain(always)
    expect(list.includes('magicLink')).toBe(stack.features.magicLink)
    expect(list.includes('passkey')).toBe(stack.features.passkeys)
    expect(list.includes('twoFactor')).toBe(stack.features.twoFactor)
    expect(list.includes('organization')).toBe(stack.features.organizations)
    expect(list.includes('billing')).toBe(stack.features.billing)
    expect(new Set(list).size).toBe(list.length)
  })

  it('hides billing when Stripe keys are missing even though the config enables it', async () => {
    const props = await renderProviders(presets['billing-org'], false)
    expect(ids(props)).not.toContain('billing')
  })

  it('scopes API keys to organizations only when organizations are enabled', async () => {
    const withOrgs = await renderProviders(presets.defaults)
    expect(withOrgs.plugins.find((p) => p.id === 'apiKey')?.organization).toBeTruthy()
    expect(withOrgs.plugins.find((p) => p.id === 'apiKey')?.organizationCards).toBeTruthy()
    const without = await renderProviders(presets['orgs-off'])
    expect(without.plugins.find((p) => p.id === 'apiKey')?.organization).toBeFalsy()
    expect(without.plugins.find((p) => p.id === 'apiKey')?.organizationCards).toBeUndefined()
  })

  it('forwards creatorRole and additionalRoles to the organization plugin', async () => {
    const props = await renderProviders(presets['custom-roles'])
    const org = props.plugins.find((p) => p.id === 'organization') as Record<string, unknown>
    expect(org.creatorRole).toBe('founder')
    expect(org.roles).toMatchObject({ founder: 'Founder', billing: 'Billing contact' })
    expect(org.logo).toMatchObject({ enabled: true })
  })

  it('attaches billing to the user or the organization, never both', async () => {
    const orgBilling = (await renderProviders(presets['billing-org'])).plugins.find((p) => p.id === 'billing')!
    expect(Boolean(orgBilling.organization)).toBe(true)
    expect(Boolean(orgBilling.user)).toBe(false)

    const userBilling = (await renderProviders(presets['billing-user-with-orgs'])).plugins.find((p) => p.id === 'billing')!
    expect(Boolean(userBilling.user)).toBe(true)
    expect(Boolean(userBilling.organization)).toBe(false)
  })
})

describe('Providers auth props', () => {
  it('derives base paths, redirect and email/password settings from config and paths', async () => {
    const props = await renderProviders(presets['invite-only'])
    expect(props.baseURL).toBe('https://test.example')
    expect(props.basePaths).toEqual({
      auth: paths.auth.base,
      settings: paths.dashboard.settings,
      organization: paths.dashboard.organization,
      admin: paths.dashboard.admin,
    })
    expect(props.redirectTo).toBe(paths.dashboard.home)
    expect(props.emailAndPassword).toEqual({
      enabled: true,
      requireEmailVerification: true,
      confirmPassword: true,
      strengthMeter: true,
      name: true,
    })
  })

  it('disables the password form for passwordless products', async () => {
    const props = await renderProviders(presets['magic-link-only'])
    expect((props.emailAndPassword as { enabled: boolean }).enabled).toBe(false)
    expect(ids(props)).toContain('magicLink')
    // The magic-link plugin takes over /auth/sign-in when the password form is off.
    const magic = props.plugins.find((p) => p.id === 'magicLink') as { fallbackViews?: { auth?: { signIn?: unknown } } }
    expect(magic.fallbackViews?.auth?.signIn).toBeTruthy()
  })

  it('passes social providers through', async () => {
    expect((await renderProviders(presets.defaults)).socialProviders).toEqual([])
    expect((await renderProviders(presets['all-auth'])).socialProviders).toEqual(['google', 'github', 'microsoft', 'apple', 'discord'])
  })

  it('keeps Payload admin separate from the in-app admin base path', async () => {
    const props = await renderProviders(presets.defaults)
    expect((props.basePaths as { admin: string }).admin).not.toBe(paths.payloadAdmin)
  })
})
