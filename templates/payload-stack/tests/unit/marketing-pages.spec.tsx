/**
 * Server-rendered marketing and dashboard pages, driven by stack.config.ts:
 *   - src/app/(frontend)/(marketing)/page.tsx (homepage copy and calls to action)
 *   - src/components/marketing/site-header.tsx and site-footer.tsx
 *   - src/app/(frontend)/(marketing)/pricing/page.tsx
 *   - src/app/(frontend)/(marketing)/legal/[slug]/page.tsx
 *   - src/app/(frontend)/(app)/dashboard/(overview)/page.tsx (which cards show)
 * Async server components are awaited and rendered to static markup; session and Payload are faked.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { paths } from '@/lib/paths'
import { defineStack, type StackInput } from '@/lib/stack'
import { base, presetEntries, presets } from '../helpers/stack-fixtures'
import { loadWithStack } from '../helpers/with-stack'

vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT:${to}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

type Session = { user: { id: string; name?: string; email: string; role?: string[] }; session: { activeOrganizationId?: string | null } } | null

const legalDocs = [
  { id: 1, title: 'Privacy Policy', slug: 'privacy', showInFooter: true, effectiveDate: '2026-01-15T00:00:00.000Z', content: { root: { type: 'root', children: [] } } },
  { id: 2, title: 'Terms of Service', slug: 'terms', showInFooter: true, effectiveDate: '2026-01-15T00:00:00.000Z', content: { root: { type: 'root', children: [] } } },
]

function fakePayload() {
  return {
    db: { defaultIDType: 'number' },
    find: vi.fn(async ({ collection, where }: { collection: string; where?: Record<string, { equals?: unknown }> }): Promise<{ docs: unknown[]; totalDocs: number }> => {
      if (collection === 'legal-pages') {
        const slug = where?.slug?.equals
        const docs = slug ? legalDocs.filter((d) => d.slug === slug) : legalDocs
        return { docs, totalDocs: docs.length }
      }
      if (collection === 'members') return { docs: [{ organization: { id: 42, name: 'Acme' } }], totalDocs: 1 }
      return { docs: [], totalDocs: 0 }
    }),
    count: vi.fn(async () => ({ totalDocs: 4 })),
    findByID: vi.fn(async () => ({ id: 42, name: 'Acme' })),
  }
}

async function renderPage<T>(input: StackInput, session: Session, importer: () => Promise<T>, pick: (m: T) => Promise<React.ReactElement> | React.ReactElement) {
  const payload = fakePayload()
  vi.doMock('@/lib/payload', () => ({ getPayloadClient: async () => payload }))
  vi.doMock('@/lib/auth/session', () => ({
    getSession: async () => session,
    requireSession: async (returnTo?: string) => {
      if (!session) throw new Error(`REDIRECT:${paths.auth.signIn}?redirectTo=${encodeURIComponent(returnTo ?? '')}`)
      return session
    },
    isSiteAdmin: (s: Session) => Boolean(s?.user.role?.includes('admin')),
  }))
  const mod = await loadWithStack(input, importer)
  vi.doUnmock('@/lib/payload')
  vi.doUnmock('@/lib/auth/session')
  const element = await pick(mod)
  return { html: renderToStaticMarkup(element), payload }
}

const visitor: Session = null
const member: Session = { user: { id: '7', name: 'Mira Lindqvist', email: 'mira@example.test' }, session: { activeOrganizationId: '42' } }

const home = (input: StackInput, session: Session) =>
  renderPage(input, session, () => import('@/app/(frontend)/(marketing)/page'), (m) => m.default())
const header = (input: StackInput, session: Session) =>
  renderPage(input, session, () => import('@/components/marketing/site-header'), (m) => m.SiteHeader())
const footer = (input: StackInput) =>
  renderPage(input, visitor, () => import('@/components/marketing/site-footer'), (m) => m.SiteFooter())
const dashboard = (input: StackInput, session: Session) =>
  renderPage(input, session, () => import('@/app/(frontend)/(app)/dashboard/(overview)/page'), (m) => m.default())

describe('homepage', () => {
  it.each(presetEntries)('preset %s: copy reflects the enabled features', async (_name, input) => {
    const stack = defineStack(input)
    const { html } = await home(input, visitor)

    expect(html).toContain(stack.tagline)
    if (stack.description) expect(html).toContain(stack.description)

    // Sign-in methods sentence.
    expect(html.includes('email and password')).toBe(stack.features.emailPassword)
    expect(html.includes('magic links')).toBe(stack.features.magicLink)
    expect(html.includes('passkeys')).toBe(stack.features.passkeys)
    for (const provider of stack.auth.social) expect(html).toContain(provider)
    expect(html.includes('two-factor authentication')).toBe(stack.features.twoFactor)

    // Teams vs solo.
    expect(html.includes('Built for teams')).toBe(stack.features.organizations)
    expect(html.includes('Your account, your data')).toBe(!stack.features.organizations)

    // Billing vs free preview.
    expect(html.includes('Simple pricing')).toBe(stack.features.billing)
    expect(html.includes('Free while in preview')).toBe(!stack.features.billing)
    expect(html.includes(`href="${paths.pricing}"`)).toBe(stack.features.billing)
    const hasTrial = stack.billing.provider === 'stripe' && stack.billing.plans.some((p) => p.trialDays)
    expect(html.includes('starting with a free trial')).toBe(hasTrial)

    // Primary call to action: sign-up when open, sign-in when invite-only.
    const primary = stack.auth.allowSignUp ? paths.auth.signUp : paths.auth.signIn
    expect(html).toContain(`href="${primary}"`)
    expect(html).toContain('Get started')
  })

  it('sends signed-in visitors to the dashboard instead', async () => {
    const { html } = await home(presets.defaults, member)
    expect(html).toContain('Open dashboard')
    expect(html).toContain(`href="${paths.dashboard.home}"`)
    expect(html).not.toContain(`href="${paths.auth.signUp}"`)
  })
})

describe('site header', () => {
  it('renders the configured navigation', async () => {
    const { html } = await header(presets['custom-nav'], visitor)
    expect(html).toContain('href="/changelog"')
    expect(html).toContain('Changelog')
    expect(html).toContain('href="https://blog.test.example"')
    expect(html).not.toContain('Pricing')
  })

  it('offers sign in and get started to visitors, only sign in when sign-up is closed, dashboard to members', async () => {
    const open = (await header(presets.defaults, visitor)).html
    expect(open).toContain('Sign in')
    expect(open).toContain('Get started')
    expect(open).toContain(`href="${paths.auth.signUp}"`)

    const closed = (await header(presets['invite-only'], visitor)).html
    expect(closed).toContain('Sign in')
    expect(closed).not.toContain('Get started')
    expect(closed).not.toContain(`href="${paths.auth.signUp}"`)

    const signedIn = (await header(presets.defaults, member)).html
    expect(signedIn).toContain('Open dashboard')
    expect(signedIn).not.toContain('Sign in')
  })
})

describe('site footer', () => {
  it('lists footer legal pages, navigation, support address and the company', async () => {
    const { html, payload } = await footer({ ...presets['custom-nav'], legal: { company: 'Ridgeline Software Ltd', jurisdiction: 'Poland' } })
    expect(html).toContain(`href="${paths.legal('privacy')}"`)
    expect(html).toContain('Privacy Policy')
    expect(html).toContain(`href="${paths.legal('terms')}"`)
    expect(html).toContain('href="/changelog"')
    expect(html).toContain('mailto:help@test.example')
    expect(html).toContain(`Copyright ${new Date().getFullYear()} Ridgeline Software Ltd`)
    expect(html).toContain('Ship faster')
    expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'legal-pages', where: { showInFooter: { equals: true } } }))
  })

  it('still renders when the database is unavailable', async () => {
    vi.doMock('@/lib/payload', () => ({ getPayloadClient: async () => { throw new Error('no db') } }))
    const { SiteFooter } = await loadWithStack(presets.defaults, () => import('@/components/marketing/site-footer'))
    vi.doUnmock('@/lib/payload')
    const html = renderToStaticMarkup(await SiteFooter())
    expect(html).toContain('Contact support')
    expect(html).not.toContain('Privacy Policy')
  })
})

describe('pricing page', () => {
  it('404s without Stripe billing', async () => {
    await expect(
      renderPage(presets.defaults, visitor, () => import('@/app/(frontend)/(marketing)/pricing/page'), (m) => m.default()),
    ).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it.each([
    ['billing-org', 'organization'],
    ['billing-user-no-orgs', 'account'],
  ] as const)('preset %s: addresses the %s and lists every plan', async (name, noun) => {
    const { html } = await renderPage(presets[name], visitor, () => import('@/app/(frontend)/(marketing)/pricing/page'), (m) => m.default())
    expect(html).toContain(`Pick a plan for your ${noun}`)
    expect(html).toContain('Starter')
    expect(html).toContain('Team')
    expect(html).toContain('$29')
    expect(html).toContain('$99')
  })
})

describe('legal page', () => {
  it('renders a seeded page by slug with its effective date and 404s unknown slugs', async () => {
    const mod = await renderPage(presets.defaults, visitor, () => import('@/app/(frontend)/(marketing)/legal/[slug]/page'), (m) =>
      m.default({ params: Promise.resolve({ slug: 'privacy' }) }),
    )
    expect(mod.html).toContain('Privacy Policy')
    expect(mod.html).toContain('Effective January 15, 2026')
    // Public read: access is NOT overridden for the page itself.
    expect(mod.payload.find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'legal-pages', overrideAccess: false }))

    await expect(
      renderPage(presets.defaults, visitor, () => import('@/app/(frontend)/(marketing)/legal/[slug]/page'), (m) =>
        m.default({ params: Promise.resolve({ slug: 'missing' }) }),
      ),
    ).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('prerenders every legal slug and titles the page', async () => {
    const payload = fakePayload()
    vi.doMock('@/lib/payload', () => ({ getPayloadClient: async () => payload }))
    const page = await loadWithStack(presets.defaults, () => import('@/app/(frontend)/(marketing)/legal/[slug]/page'))
    vi.doUnmock('@/lib/payload')
    expect(await page.generateStaticParams()).toEqual([{ slug: 'privacy' }, { slug: 'terms' }])
    expect(await page.generateMetadata({ params: Promise.resolve({ slug: 'terms' }) })).toEqual({ title: 'Terms of Service' })
    expect(await page.generateMetadata({ params: Promise.resolve({ slug: 'nope' }) })).toEqual({ title: 'Legal' })
  })
})

describe('dashboard overview', () => {
  it('redirects to sign-in with a return url without a session', async () => {
    await expect(dashboard(presets.defaults, visitor)).rejects.toThrow(`REDIRECT:${paths.auth.signIn}?redirectTo=${encodeURIComponent(paths.dashboard.home)}`)
  })

  it.each(presetEntries)('preset %s: shows the cards for the enabled features', async (_name, input) => {
    const stack = defineStack(input)
    const { html } = await dashboard(input, member)
    expect(html).toContain('Welcome back, Mira')
    expect(html).toContain('Manage projects')
    expect(html).toContain('>4<') // project count from payload.count

    expect(html.includes('Invite people')).toBe(stack.features.organizations)
    expect(html.includes('You are working in Acme')).toBe(stack.features.organizations)
    expect(html.includes(`Here is what is happening in ${stack.name}`)).toBe(!stack.features.organizations)

    expect(html.includes('Manage billing')).toBe(stack.features.billing)
    expect(html.includes('Review security')).toBe(!stack.features.billing)
    if (stack.features.billingAttachedTo === 'organization') expect(html).toContain(`href="${paths.dashboard.organizationBilling}"`)
    if (stack.features.billingAttachedTo === 'user') expect(html).toContain(`href="${paths.dashboard.billing}"`)
  })

  it('falls back to the email when the user has no name', async () => {
    const { html } = await dashboard(presets.defaults, { user: { id: '7', email: 'noname@example.test' }, session: { activeOrganizationId: '42' } })
    expect(html).toContain('Welcome back, noname@example.test')
  })
})

describe('dashboard layout', () => {
  const layout = (input: StackInput, session: Session, memberships: unknown[]) => {
    const payload = fakePayload()
    payload.find.mockImplementation(async () => ({ docs: memberships, totalDocs: memberships.length }))
    vi.doMock('@/lib/payload', () => ({ getPayloadClient: async () => payload }))
    vi.doMock('@/lib/auth/session', () => ({ getSession: async () => session, isSiteAdmin: () => false }))
    vi.doMock('@/components/dashboard/app-sidebar', () => ({ AppSidebar: () => null }))
    vi.doMock('@/components/dashboard/dashboard-header', () => ({ DashboardHeader: () => null }))
    vi.doMock('@/components/dashboard/active-organization-sync', () => ({ ActiveOrganizationSync: () => null }))
    return loadWithStack(input, () => import('@/app/(frontend)/(app)/dashboard/layout')).finally(() => {
      vi.doUnmock('@/lib/payload')
      vi.doUnmock('@/lib/auth/session')
      vi.doUnmock('@/components/dashboard/app-sidebar')
      vi.doUnmock('@/components/dashboard/dashboard-header')
      vi.doUnmock('@/components/dashboard/active-organization-sync')
    })
  }

  it('redirects anonymous visitors to sign-in', async () => {
    const mod = await layout(presets.defaults, visitor, [])
    await expect(mod.default({ children: null })).rejects.toThrow(`REDIRECT:${paths.auth.signIn}`)
  })

  it('sends members without an organization to onboarding, but only when organizations are enabled', async () => {
    const withOrgs = await layout(presets.defaults, member, [])
    await expect(withOrgs.default({ children: null })).rejects.toThrow(`REDIRECT:${paths.onboarding}`)

    const without = await layout(presets['orgs-off'], member, [])
    await expect(without.default({ children: 'ok' })).resolves.toBeTruthy()
  })

  it('renders the shell once the member has an organization', async () => {
    const mod = await layout(presets.defaults, member, [{ organization: { id: 42, name: 'Acme' } }])
    const html = renderToStaticMarkup(await mod.default({ children: <p>content</p> }))
    expect(html).toContain('content')
  })
})

describe('onboarding page', () => {
  const page = (input: StackInput, session: Session, memberships: unknown[]) => {
    const payload = fakePayload()
    payload.find.mockImplementation(async () => ({ docs: memberships, totalDocs: memberships.length }))
    vi.doMock('@/lib/payload', () => ({ getPayloadClient: async () => payload }))
    vi.doMock('@/lib/auth/session', () => ({
      getSession: async () => session,
      requireSession: async () => {
        if (!session) throw new Error(`REDIRECT:${paths.auth.signIn}`)
        return session
      },
    }))
    return loadWithStack(input, () => import('@/app/(frontend)/(app)/onboarding/page')).finally(() => {
      vi.doUnmock('@/lib/payload')
      vi.doUnmock('@/lib/auth/session')
    })
  }

  it('requires a session', async () => {
    const mod = await page(presets.defaults, visitor, [])
    await expect(mod.default()).rejects.toThrow(`REDIRECT:${paths.auth.signIn}`)
  })

  it('skips onboarding without organizations or once the user has one', async () => {
    await expect((await page(presets['orgs-off'], member, [])).default()).rejects.toThrow(`REDIRECT:${paths.dashboard.home}`)
    await expect((await page(presets.defaults, member, [{ organization: { id: 42 } }])).default()).rejects.toThrow(`REDIRECT:${paths.dashboard.home}`)
  })

  it('suggests a team name from the first name, or a generic one', async () => {
    const named = renderToStaticMarkup(await (await page(presets.defaults, member, [])).default())
    expect(named).toContain("Mira&#x27;s team")
    const anonymous = renderToStaticMarkup(await (await page(presets.defaults, { user: { id: '7', email: 'x@y.z' }, session: {} }, [])).default())
    expect(anonymous).toContain('My team')
    expect(named).toContain(`Your team&#x27;s workspace in ${defineStack(base).name}`)
  })
})
