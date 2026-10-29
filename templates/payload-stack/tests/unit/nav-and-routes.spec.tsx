/**
 * Everything that derives navigation and route tables from stack.config.ts:
 *   - src/components/dashboard/nav-config.tsx (sidebar)
 *   - src/app/(frontend)/(app)/dashboard/settings/[path]/page.tsx (settings tabs that exist)
 *   - src/app/(frontend)/(app)/dashboard/organization/[path]/page.tsx (organization tabs that exist)
 *   - src/app/(frontend)/auth/[path]/page.tsx (auth views)
 * Each is checked under every preset so a feature switched off never leaves a dangling link.
 */
import { describe, expect, it, vi } from 'vitest'

import { paths } from '@/lib/paths'
import { defineStack } from '@/lib/stack'
import { presetEntries, presets, type PresetName } from '../helpers/stack-fixtures'
import { loadWithStack } from '../helpers/with-stack'

vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(), notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }) }))

const loadNav = (name: PresetName) => loadWithStack(presets[name], () => import('@/components/dashboard/nav-config'))
const loadSettingsPage = (name: PresetName) =>
  loadWithStack(presets[name], () => import('@/app/(frontend)/(app)/dashboard/settings/[path]/page'))
const loadOrganizationPage = (name: PresetName) =>
  loadWithStack(presets[name], () => import('@/app/(frontend)/(app)/dashboard/organization/[path]/page'))

const titles = (items: { title: string; items?: { title: string }[] }[]) => items.map((i) => i.title)
const children = (items: { title: string; items?: { title: string; url: string }[] }[], title: string) =>
  items.find((i) => i.title === title)?.items ?? []

describe('mainNav', () => {
  it.each(presetEntries)('preset %s: sections follow the enabled features', async (name, input) => {
    const stack = defineStack(input)
    const { mainNav } = await loadNav(name)
    const items = mainNav()

    const expected = ['Overview', 'Projects', ...(stack.features.organizations ? ['Organization'] : []), 'Settings']
    expect(titles(items)).toEqual(expected)

    const settings = children(items, 'Settings')
    expect(settings.map((i) => i.title)).toEqual([
      'Account',
      'Security',
      ...(stack.features.organizations ? ['Organizations'] : []),
      ...(stack.features.billingAttachedTo === 'user' ? ['Billing'] : []),
    ])

    if (stack.features.organizations) {
      const org = children(items, 'Organization')
      expect(org.map((i) => i.title)).toEqual(['General', 'People', ...(stack.features.billingAttachedTo === 'organization' ? ['Billing'] : [])])
      expect(org.map((i) => i.url)).toEqual([
        paths.dashboard.organizationSettings,
        paths.dashboard.organizationPeople,
        ...(stack.features.billingAttachedTo === 'organization' ? [paths.dashboard.organizationBilling] : []),
      ])
    }
  })

  it('links every item to a path from src/lib/paths.ts', async () => {
    const { mainNav } = await loadNav('billing-org')
    const known = new Set<string>(Object.values(paths.dashboard))
    for (const item of mainNav()) {
      expect(known.has(item.url)).toBe(true)
      for (const child of item.items ?? []) expect(known.has(child.url)).toBe(true)
    }
  })

  it('places billing under Organization or Settings, never both', async () => {
    const orgBilling = (await loadNav('billing-org')).mainNav()
    expect(children(orgBilling, 'Organization').map((i) => i.title)).toContain('Billing')
    expect(children(orgBilling, 'Settings').map((i) => i.title)).not.toContain('Billing')

    const userBilling = (await loadNav('billing-user-with-orgs')).mainNav()
    expect(children(userBilling, 'Organization').map((i) => i.title)).not.toContain('Billing')
    expect(children(userBilling, 'Settings').map((i) => i.title)).toContain('Billing')

    const noBilling = (await loadNav('defaults')).mainNav()
    expect(children(noBilling, 'Organization').map((i) => i.title)).not.toContain('Billing')
    expect(children(noBilling, 'Settings').map((i) => i.title)).not.toContain('Billing')
  })
})

describe('secondaryNav', () => {
  it('adds the Payload admin link for site admins only, first', async () => {
    const { secondaryNav } = await loadNav('defaults')
    expect(titles(secondaryNav(false))).toEqual(['Documentation', 'Support'])
    expect(titles(secondaryNav(true))).toEqual(['Payload admin', 'Documentation', 'Support'])
    expect(secondaryNav(true)[0]!.url).toBe(paths.payloadAdmin)
  })

  it('points Support at the configured support address', async () => {
    const { secondaryNav } = await loadNav('defaults')
    expect(secondaryNav(false).find((i) => i.title === 'Support')?.url).toBe('mailto:help@test.example')
  })
})

describe('settings routes', () => {
  it.each(presetEntries)('preset %s: static params match the features', async (name, input) => {
    const stack = defineStack(input)
    const page = await loadSettingsPage(name)
    const params = page.generateStaticParams().map((p) => p.path)
    expect(params).toEqual([
      'account',
      'security',
      ...(stack.features.organizations ? ['organizations'] : []),
      ...(stack.features.billingAttachedTo === 'user' ? ['billing'] : []),
    ])
  })

  it('renders known tabs and 404s unknown ones', async () => {
    const page = await loadSettingsPage('billing-user-with-orgs')
    await expect(page.default({ params: Promise.resolve({ path: 'billing' }) })).resolves.toBeTruthy()
    await expect(page.default({ params: Promise.resolve({ path: 'nope' }) })).rejects.toThrow('NEXT_NOT_FOUND')
    const orgBilling = await loadSettingsPage('billing-org')
    await expect(orgBilling.default({ params: Promise.resolve({ path: 'billing' }) })).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('titles the page after the tab', async () => {
    const page = await loadSettingsPage('defaults')
    await expect(page.generateMetadata({ params: Promise.resolve({ path: 'security' }) })).resolves.toEqual({ title: 'Security settings' })
  })

  it('explains missing Stripe keys on the billing tab instead of mounting the billing UI', async () => {
    // tests/unit/setup.ts clears STRIPE_*; env.billingReady is false.
    const without = await loadSettingsPage('billing-user-with-orgs')
    expect(renderedComponent(await without.default({ params: Promise.resolve({ path: 'billing' }) }))).toBe('BillingNotConfigured')
    expect(renderedComponent(await without.default({ params: Promise.resolve({ path: 'account' }) }))).toBe('Settings')

    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_1')
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_1')
    const withKeys = await loadSettingsPage('billing-user-with-orgs')
    expect(renderedComponent(await withKeys.default({ params: Promise.resolve({ path: 'billing' }) }))).toBe('Settings')
  })
})

/** Name of the component a `[path]` page renders below its heading. */
function renderedComponent(element: React.ReactElement): string {
  const [, body] = (element.props as { children: [unknown, React.ReactElement<unknown, React.ComponentType>] }).children
  return body.type.name
}

describe('organization routes', () => {
  it.each(presetEntries)('preset %s: static params match the features', async (name, input) => {
    const stack = defineStack(input)
    const page = await loadOrganizationPage(name)
    const params = page.generateStaticParams().map((p) => p.path)
    if (!stack.features.organizations) {
      expect(params).toEqual([])
      return
    }
    expect(params).toEqual([
      'settings',
      'people',
      ...(stack.features.teams ? ['teams'] : []),
      ...(stack.features.billingAttachedTo === 'organization' ? ['billing'] : []),
    ])
  })

  it('404s every organization page when organizations are off', async () => {
    const page = await loadOrganizationPage('orgs-off')
    await expect(page.default({ params: Promise.resolve({ path: 'settings' }) })).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('serves teams only with teams enabled', async () => {
    const withTeams = await loadOrganizationPage('teams')
    await expect(withTeams.default({ params: Promise.resolve({ path: 'teams' }) })).resolves.toBeTruthy()
    const without = await loadOrganizationPage('defaults')
    await expect(without.default({ params: Promise.resolve({ path: 'teams' }) })).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('explains missing Stripe keys on the billing tab instead of mounting the billing UI', async () => {
    const without = await loadOrganizationPage('billing-org')
    expect(renderedComponent(await without.default({ params: Promise.resolve({ path: 'billing' }) }))).toBe('BillingNotConfigured')
    expect(renderedComponent(await without.default({ params: Promise.resolve({ path: 'people' }) }))).toBe('Organization')

    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_1')
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_1')
    const withKeys = await loadOrganizationPage('billing-org')
    expect(renderedComponent(await withKeys.default({ params: Promise.resolve({ path: 'billing' }) }))).toBe('Organization')
  })
})

describe('auth routes', () => {
  const loadAuthPage = (name: PresetName) => loadWithStack(presets[name], () => import('@/app/(frontend)/auth/[path]/page'))

  it.each(presetEntries)('preset %s: prerenders exactly the views the config enables', async (name, input) => {
    const { features } = defineStack(input)
    const page = await loadAuthPage(name)
    const views = page.generateStaticParams().map((p) => p.path)

    expect(views).toEqual(
      expect.arrayContaining(['sign-in', 'sign-up', 'sign-out', 'forgot-password', 'reset-password', 'verify-email', 'callback', 'error']),
    )
    // A view whose plugin is off has no component; prerendering it would fail the build.
    expect(views.includes('magic-link')).toBe(features.magicLink)
    expect(views.includes('two-factor')).toBe(features.twoFactor)
    expect(views.includes('accept-invitation')).toBe(features.organizations)
  })

  it('404s anything else', async () => {
    const page = await loadAuthPage('billing-org')
    for (const p of ['signIn', 'login', 'admin', '']) {
      await expect(page.default({ params: Promise.resolve({ path: p }) })).rejects.toThrow('NEXT_NOT_FOUND')
    }
    await expect(page.generateMetadata({ params: Promise.resolve({ path: 'forgot-password' }) })).resolves.toEqual({ title: 'Forgot Password' })
  })

  it.each(presetEntries)('preset %s: every auth path the app links to exists', async (name, input) => {
    const { features } = defineStack(input)
    const page = await loadAuthPage(name)
    const views = new Set(page.generateStaticParams().map((p) => `/auth/${p.path}`))
    for (const [key, value] of Object.entries(paths.auth)) {
      if (key === 'base') continue
      // Invitations are only linked to when organizations are on.
      if (key === 'acceptInvitation' && !features.organizations) continue
      expect(views.has(value)).toBe(true)
    }
  })
})

describe('admin route', () => {
  it('404s for non-admins and unknown paths', async () => {
    vi.doMock('@/lib/auth/session', () => ({
      getSession: async () => ({ user: { role: ['user'] }, session: {} }),
      isSiteAdmin: (s: { user?: { role?: string[] } } | null) => Boolean(s?.user?.role?.includes('admin')),
    }))
    const page = await import('@/app/(frontend)/(app)/dashboard/admin/[path]/page')
    await expect(page.default({ params: Promise.resolve({ path: 'users' }) })).rejects.toThrow('NEXT_NOT_FOUND')
    vi.doUnmock('@/lib/auth/session')
  })

  it('renders the users view for admins only', async () => {
    vi.resetModules()
    vi.doMock('@/lib/auth/session', () => ({
      getSession: async () => ({ user: { role: ['admin'] }, session: {} }),
      isSiteAdmin: () => true,
    }))
    const page = await import('@/app/(frontend)/(app)/dashboard/admin/[path]/page')
    await expect(page.default({ params: Promise.resolve({ path: 'users' }) })).resolves.toBeTruthy()
    await expect(page.default({ params: Promise.resolve({ path: 'settings' }) })).rejects.toThrow('NEXT_NOT_FOUND')
    vi.doUnmock('@/lib/auth/session')
  })
})
