/**
 * src/consent: the seam between a project with Payload Consent and one without.
 *
 * No database here. These are the checks that catch what actually goes wrong when the plugin is
 * wired in: the legal-pages collection registered twice (or not at all), a seeded company that
 * silently disagrees with stack.config.ts, and a processor register that discloses recipients the
 * project does not use — or misses the one it does.
 */
import type { Config, Plugin } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { base, presets } from '../helpers/stack-fixtures'
import { loadWithStack, toStack } from '../helpers/with-stack'

type AnyConfig = Config & {
  collections: Array<{ slug: string }>
  globals: Array<{ slug: string }>
  endpoints: Array<{ path: string }>
}

const emptyConfig = () => ({ collections: [], globals: [], endpoints: [] }) as unknown as Config

/** Applies the stack's consent plugins to an empty Payload config, under the given stack.config.ts. */
async function apply(input = base) {
  const stack = toStack(input)
  const loaded = await loadWithStack(stack, async () => {
    const seam = await import('@/consent/plugin')
    const collections = await import('@/consent/collections')
    const seed = await import('@/consent/seed')
    const { getPluginOptions } = await import('@payload-solutions/plugin-consent')
    return { ...seam, ...collections, ...seed, getPluginOptions }
  })
  const config = loaded.consentPlugins.reduce<Config>(
    (acc, plugin) => (plugin as Plugin)(acc) as Config,
    emptyConfig(),
  ) as AnyConfig
  const options = loaded.getPluginOptions()
  // `seed: false` would mean no documents at all, which is not what this branch asks for.
  if (options.seed === false) throw new Error('the consent plugin was registered with seeding off')
  return { ...loaded, config, stack, options, seed: options.seed }
}

describe('registration', () => {
  it('owns the legal pages, and the template no longer registers its own', async () => {
    const { config, legalCollections } = await apply()
    // One `legal-pages` collection, and it is the plugin's: two would fail Payload's config sanitiser.
    expect(legalCollections).toEqual([])
    expect(config.collections.filter((c) => c.slug === 'legal-pages')).toHaveLength(1)
  })

  it('adds the consent collections, the settings global and the endpoints', async () => {
    const { config } = await apply()
    const slugs = config.collections.map((c) => c.slug)
    expect(slugs).toEqual(
      expect.arrayContaining([
        'consent-categories',
        'consent-trackers',
        'consent-records',
        'consent-processors',
        'consent-audits',
        'legal-pages',
      ]),
    )
    expect(config.globals.map((g) => g.slug)).toContain('consent-settings')
    expect(config.endpoints.length).toBeGreaterThan(0)
    for (const endpoint of config.endpoints) expect(endpoint.path.startsWith('/consent')).toBe(true)
  })

  it('leaves seeding to the plugin', async () => {
    const { seedLegal } = await apply()
    // The template's own seeder is gone; this must not throw when payload.config.ts calls it on boot.
    await expect(seedLegal(undefined as never)).resolves.toBeUndefined()
  })
})

describe('company details', () => {
  it('are taken from stack.config.ts, with the documented fallbacks', async () => {
    const { seed, stack } = await apply()
    const company = seed.company
    expect(company).toBeDefined()
    expect(company!.name).toBe(stack.name)
    expect(company!.url).toBe(stack.url)
    expect(company!.governingLaw).toBe(stack.legal.jurisdiction)
    // Unset in the fixture: the legal name falls back to the trading name, the privacy address to support.
    expect(company!.legalName).toBe(stack.legal.company)
    expect(company!.email).toBe(stack.support.email)
    // An address nobody filled in is left as a visible placeholder, so `payload-consent scan`
    // reports it rather than a plausible blank going to print.
    expect(company!.address).toMatch(/\[.+\]/)
  })

  it('prefer the explicit legal block when it is filled in', async () => {
    const { seed } = await apply({
      ...base,
      legal: {
        company: 'Test Ltd',
        jurisdiction: 'Ireland',
        legalName: 'Test Software Limited',
        address: '1 Main Street, Dublin',
        email: 'privacy@test.example',
        jurisdictions: ['EEA', 'GB'],
      },
    })
    const company = seed.company
    expect(company!.legalName).toBe('Test Software Limited')
    expect(company!.address).toBe('1 Main Street, Dublin')
    expect(company!.email).toBe('privacy@test.example')
    expect(company!.jurisdictions).toEqual(['EEA', 'GB'])
  })
})

describe('processor register', () => {
  it.each(Object.entries(presets))('preset %s: discloses the recipients this build reaches', async (_name, input) => {
    const { seed, stack } = await apply(input)
    const processors = seed.processors ?? []
    // Email and error monitoring are wired into every build of the stack.
    expect(processors).toEqual(expect.arrayContaining(['resend', 'sentry']))
    // Stripe only when there is billing: disclosing a recipient you do not use is its own error.
    expect(processors.includes('stripe')).toBe(stack.billing.provider === 'stripe')
  })
})

describe('recording', () => {
  it('links records to the signed-in user', async () => {
    const { options } = await apply()
    expect(options.recording.mode).toBe('linked')
    // Never the IP address, and never without a decision to record.
    expect(options.recording.userAgent).toBeDefined()
  })
})

describe('the homepage note', () => {
  it('gives the six steps and links the audit guide, in development only', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { LegalSetupNotice } = await loadWithStack(base, () => import('@/consent/legal-setup-notice'))

    const html = renderToStaticMarkup(LegalSetupNotice() as never)
    expect(html).toContain('npx payload-consent init')
    expect(html).toContain('npx payload-consent profile')
    expect(html).toContain('npx payload-consent scan')
    expect(html).toContain('https://payload.solutions/docs/plugins/payload-consent/audit')
    // The point of the note: these documents are not policy until a person has been through them.
    expect(html).toContain('None of this is legal advice')
    expect(html).toMatch(/>6</)

    // Never a word of this in front of a real visitor.
    vi.stubEnv('NODE_ENV', 'production')
    try {
      const { LegalSetupNotice: InProduction } = await loadWithStack(base, () => import('@/consent/legal-setup-notice'))
      expect(InProduction()).toBeNull()
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
