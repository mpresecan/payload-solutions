import { describe, expect, it } from 'vitest'

import { decodeConsentCookie, encodeConsentCookie, getCookieValue, type ConsentCookieV1 } from '../src/index.js'

const sample: ConsentCookieV1 = {
  v: 1,
  id: '5f6a2b1c-0000-4000-8000-000000000000',
  d: { analytics: 1, marketing: 0, functional: 1 },
  t: 1_757_000_000,
  pv: 'p1',
  cv: 'c1',
  tv: 't1',
  dv: 'd1',
  j: 'in',
  s: 'b',
}

describe('cookie codec', () => {
  it('round-trips a payload through base64url', () => {
    const encoded = encodeConsentCookie(sample)
    expect(encoded).not.toMatch(/[+/=]/)
    expect(decodeConsentCookie(encoded)).toEqual(sample)
  })

  it('stays small', () => {
    expect(encodeConsentCookie(sample).length).toBeLessThan(260)
  })

  it('rejects garbage, wrong versions and malformed decisions', () => {
    expect(decodeConsentCookie(null)).toBeNull()
    expect(decodeConsentCookie('')).toBeNull()
    expect(decodeConsentCookie('not-base64!!')).toBeNull()
    expect(decodeConsentCookie(encodeConsentCookie({ ...sample, v: 2 as never }))).toBeNull()
    expect(decodeConsentCookie(encodeConsentCookie({ ...sample, d: { analytics: 'yes' as never } }))).toBeNull()
    expect(decodeConsentCookie(encodeConsentCookie({ ...sample, j: 'maybe' as never }))).toBeNull()
  })

  it('reads a named cookie from a Cookie header', () => {
    const header = `a=1; pl-consent=${encodeURIComponent('abc=def')}; b=2`
    expect(getCookieValue(header, 'pl-consent')).toBe('abc=def')
    expect(getCookieValue(header, 'missing')).toBeNull()
    expect(getCookieValue(null, 'x')).toBeNull()
  })
})
