import { describe, expect, it } from 'vitest'

import { DEFAULT_JURISDICTION_OVERRIDES, countryFromHeaders, resolveJurisdictionModel } from '../src/index.js'

describe('jurisdiction resolution', () => {
  it('maps EEA members, UK, CH and BR to opt-in', () => {
    for (const c of ['DE', 'FR', 'PL', 'HR', 'NO', 'IS', 'GB', 'CH', 'BR']) {
      expect(resolveJurisdictionModel({ country: c })).toBe('opt-in')
    }
  })

  it('maps the US to opt-out, with state overrides winning', () => {
    expect(resolveJurisdictionModel({ country: 'US' })).toBe('opt-out')
    expect(resolveJurisdictionModel({ country: 'US', region: 'CA' })).toBe('opt-out')
    expect(
      resolveJurisdictionModel({
        country: 'US',
        region: 'TX',
        overrides: [{ region: 'US', model: 'opt-out' }, { region: 'US-TX', model: 'notice' }],
      }),
    ).toBe('notice')
  })

  it('falls back to opt-in for unknown countries by default and to the configured fallback otherwise', () => {
    expect(resolveJurisdictionModel({ country: 'JP' })).toBe('opt-in')
    expect(resolveJurisdictionModel({ country: null })).toBe('opt-in')
    expect(resolveJurisdictionModel({ country: 'XX', fallback: 'notice' })).toBe('notice')
    expect(resolveJurisdictionModel({ country: 'JP', fallback: 'none' })).toBe('none')
  })

  it('lets a later override beat an earlier one for the same region', () => {
    // The plugin appends: built-in defaults, then plugin options, then the editable rows in
    // Consent settings. An editor's row must win over the default it was meant to replace.
    const overrides = [...DEFAULT_JURISDICTION_OVERRIDES, { region: 'US', model: 'notice' as const }]
    expect(resolveJurisdictionModel({ country: 'US', overrides })).toBe('notice')
    expect(resolveJurisdictionModel({ country: 'DE', overrides })).toBe('opt-in')

    const eea = [...DEFAULT_JURISDICTION_OVERRIDES, { region: 'EEA', model: 'notice' as const }]
    expect(resolveJurisdictionModel({ country: 'FR', overrides: eea })).toBe('notice')
    // A country row still beats the EEA pseudo-region it belongs to.
    expect(resolveJurisdictionModel({ country: 'FR', overrides: [...eea, { region: 'FR', model: 'opt-in' }] })).toBe('opt-in')
  })

  it('reads the country from common CDN headers', () => {
    expect(countryFromHeaders(new Headers({ 'x-vercel-ip-country': 'de' }))).toBe('DE')
    expect(countryFromHeaders(new Headers({ 'cf-ipcountry': 'FR', 'x-vercel-ip-country': 'US' }))).toBe('FR')
    expect(countryFromHeaders({ 'x-country': 'pl' })).toBe('PL')
    expect(countryFromHeaders(new Headers())).toBeNull()
  })
})
