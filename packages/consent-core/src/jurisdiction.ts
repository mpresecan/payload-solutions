import type { ConsentModel } from './types.js'

/** EU-27 plus EEA (IS, LI, NO). */
export const EEA_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU',
  'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO',
] as const

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA',
  'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
] as const

export type JurisdictionOverride = { region: string; model: ConsentModel }

/**
 * Default region → model table. Regions are ISO 3166-1 alpha-2 country codes, the pseudo-region `EEA`,
 * or `US-XX` state codes. More specific entries win (US-CA over US over EEA over fallback).
 */
export const DEFAULT_JURISDICTION_OVERRIDES: JurisdictionOverride[] = [
  { region: 'EEA', model: 'opt-in' },
  { region: 'GB', model: 'opt-in' },
  { region: 'CH', model: 'opt-in' },
  { region: 'BR', model: 'opt-in' },
  { region: 'CA', model: 'opt-in' },
  { region: 'US', model: 'opt-out' },
]

export type ResolveJurisdictionInput = {
  country: string | null | undefined
  /** US state code when known (e.g. from `x-vercel-ip-country-region`). */
  region?: string | null
  overrides?: JurisdictionOverride[]
  fallback?: ConsentModel
}

/** The last override matching `region`, so appended tables override the ones they were appended to. */
export function lastOverride(overrides: JurisdictionOverride[], region: string): ConsentModel | undefined {
  for (let i = overrides.length - 1; i >= 0; i--) {
    if (overrides[i]!.region.toUpperCase() === region.toUpperCase()) return overrides[i]!.model
  }
  return undefined
}

export function resolveJurisdictionModel(input: ResolveJurisdictionInput): ConsentModel {
  const overrides = input.overrides ?? DEFAULT_JURISDICTION_OVERRIDES
  const fallback = input.fallback ?? 'opt-in'
  const country = input.country?.toUpperCase().trim() || null
  if (!country || country === 'XX' || country === 'T1') return fallback

  // Later entries win: the built-in table comes first, then plugin options, then the editable
  // overrides in Consent settings, so an editor's row beats the default for the same region.
  const lookup = (region: string) => lastOverride(overrides, region)

  if (country === 'US' && input.region) {
    const state = lookup(`US-${input.region.toUpperCase()}`)
    if (state) return state
  }
  const exact = lookup(country)
  if (exact) return exact
  if ((EEA_COUNTRIES as readonly string[]).includes(country)) {
    const eea = lookup('EEA')
    if (eea) return eea
  }
  return fallback
}

/** Header names commonly set by CDNs/hosts, in priority order. */
export const DEFAULT_COUNTRY_HEADERS = ['cf-ipcountry', 'x-vercel-ip-country', 'x-country', 'cloudfront-viewer-country']
export const DEFAULT_REGION_HEADERS = ['x-vercel-ip-country-region', 'cloudfront-viewer-country-region']

export function countryFromHeaders(
  headers: { get(name: string): string | null } | Record<string, string | string[] | undefined>,
  names: string[] = DEFAULT_COUNTRY_HEADERS,
): string | null {
  const get = (name: string): string | null => {
    if (typeof (headers as { get?: unknown }).get === 'function') {
      return (headers as { get(name: string): string | null }).get(name)
    }
    const v = (headers as Record<string, string | string[] | undefined>)[name]
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
  }
  for (const name of names) {
    const v = get(name)
    if (v && v.length === 2) return v.toUpperCase()
  }
  return null
}
