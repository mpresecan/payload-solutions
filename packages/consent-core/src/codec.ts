import type { ConsentCookieV1, ConsentModel, ConsentSource } from './types.js'

const MODEL_TO_SHORT: Record<ConsentModel, ConsentCookieV1['j']> = {
  'opt-in': 'in',
  'opt-out': 'out',
  notice: 'notice',
  none: 'none',
}
const SHORT_TO_MODEL: Record<ConsentCookieV1['j'], ConsentModel> = {
  in: 'opt-in',
  out: 'opt-out',
  notice: 'notice',
  none: 'none',
}
const SOURCE_TO_SHORT: Record<ConsentSource, ConsentCookieV1['s']> = {
  banner: 'b',
  preferences: 'p',
  api: 'a',
  gpc: 'g',
  withdraw: 'w',
  implicit: 'i',
}
const SHORT_TO_SOURCE: Record<ConsentCookieV1['s'], ConsentSource> = {
  b: 'banner',
  p: 'preferences',
  a: 'api',
  g: 'gpc',
  w: 'withdraw',
  i: 'implicit',
}

export const modelToShort = (model: ConsentModel): ConsentCookieV1['j'] => MODEL_TO_SHORT[model]
export const shortToModel = (j: ConsentCookieV1['j']): ConsentModel => SHORT_TO_MODEL[j]
export const sourceToShort = (source: ConsentSource): ConsentCookieV1['s'] => SOURCE_TO_SHORT[source]
export const shortToSource = (s: ConsentCookieV1['s']): ConsentSource => SHORT_TO_SOURCE[s]

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (input.length % 4)) % 4)
  const binary = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary')
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeConsentCookie(payload: ConsentCookieV1): string {
  return toBase64Url(JSON.stringify(payload))
}

const isRecordOf01 = (value: unknown): value is Record<string, 0 | 1> =>
  typeof value === 'object' && value !== null && Object.values(value).every((v) => v === 0 || v === 1)

/** Returns null for anything that is not a well-formed v1 payload. Callers treat null as "undecided". */
export function decodeConsentCookie(raw: string | null | undefined): ConsentCookieV1 | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(fromBase64Url(raw)) as Partial<ConsentCookieV1>
    if (parsed.v !== 1) return null
    if (typeof parsed.id !== 'string' || parsed.id.length < 8) return null
    if (!isRecordOf01(parsed.d)) return null
    if (typeof parsed.t !== 'number' || !Number.isFinite(parsed.t)) return null
    for (const key of ['pv', 'cv', 'tv', 'dv'] as const) {
      if (typeof parsed[key] !== 'string') return null
    }
    if (!parsed.j || !(parsed.j in SHORT_TO_MODEL)) return null
    if (!parsed.s || !(parsed.s in SHORT_TO_SOURCE)) return null
    return parsed as ConsentCookieV1
  } catch {
    return null
  }
}

/** Parses a `Cookie` header (or `document.cookie`) and returns the raw value for `name`. */
export function getCookieValue(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return null
}
