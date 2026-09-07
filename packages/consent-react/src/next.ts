/**
 * Next.js server helpers (App Router). No Next.js import: pass the objects from `next/headers`.
 *
 *   const cookieStore = await cookies()
 *   const consent = readConsent(cookieStore, config)
 *   const raw = consentCookieValue(cookieStore, config.cookie.name)   // for <ConsentProvider initialCookie={raw}>
 */
import { getCookieValue, resolveConsent, type ConsentConfig, type ResolvedConsent } from '@payload-solutions/consent-core'

type CookieSource = string | null | undefined | { get(name: string): { value: string } | string | undefined | null }

export function consentCookieValue(source: CookieSource, name: string): string | null {
  if (!source) return null
  if (typeof source === 'string') return getCookieValue(source, name)
  const got = source.get(name)
  if (got && typeof got === 'object' && 'value' in got) return got.value
  if (typeof got === 'string') return got
  const header = source.get('cookie')
  return typeof header === 'string' ? getCookieValue(header, name) : null
}

export function readConsent(source: CookieSource, config: ConsentConfig, gpc = false): ResolvedConsent & { has(key: string): boolean } {
  const resolved = resolveConsent(consentCookieValue(source, config.cookie.name), config, { gpc })
  const required = new Set(config.categories.filter((c) => c.required).map((c) => c.key))
  return { ...resolved, has: (key) => required.has(key) || resolved.decisions[key] === true }
}

/** True when the request carries a Global Privacy Control header. */
export function gpcFromHeaders(headers: { get(name: string): string | null }): boolean {
  return headers.get('sec-gpc') === '1'
}
