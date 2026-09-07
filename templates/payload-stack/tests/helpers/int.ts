/**
 * Helpers for the integration tests: one Payload instance per worker and thin wrappers around the
 * Better Auth server API (`payload.betterAuth.api`) that carry a session cookie the way a browser
 * would. Every user and organization gets a unique suffix so files can share one database.
 */
import { getPayload, type Payload } from 'payload'
import { vi } from 'vitest'

import config from '@/payload.config'
import type { PayloadWithAuth } from '@/lib/payload'

export type TestPayload = PayloadWithAuth

/**
 * The Better Auth server API with plugin endpoints. `payload.betterAuth.api` is typed from the
 * core options only (plugins are chosen at runtime from stack.config.ts), so tests address the
 * endpoints through this loose surface. Response shapes are asserted in the tests themselves.
 */
type EndpointArgs = {
  body?: Record<string, unknown>
  query?: Record<string, unknown>
  headers?: Headers
  returnHeaders?: boolean
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AuthApi = Record<string, (args?: EndpointArgs) => Promise<any>>

export const api = (payload: TestPayload): AuthApi => payload.betterAuth.api as unknown as AuthApi

let instance: Promise<TestPayload> | null = null

/** Boots Payload (schema push + legal seed) once per worker. */
export function getTestPayload(): Promise<TestPayload> {
  instance ??= getPayload({ config }).then((p) => p as TestPayload)
  return instance
}

export const PASSWORD = 'Long-Enough-Passw0rd!'

const runStamp = Date.now().toString(36)
let counter = 0

export function unique(prefix = 'user'): string {
  counter += 1
  return `${prefix}-${runStamp}-${counter}`
}

export function uniqueEmail(prefix = 'user'): string {
  return `${unique(prefix)}@example.test`
}

/**
 * Turns Set-Cookie headers into a Cookie request header the way a browser jar would: later
 * cookies win, cleared cookies (empty value) are dropped. The `session_data` cookie cache is left
 * out by default so `getSession` reads the database, which is what the assertions are about;
 * pass `{ cache: true }` to keep it.
 */
export function cookieHeader(headers: Headers, opts: { cache?: boolean } = {}): string {
  const jar = new Map<string, string>()
  const raw = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : (headers.get('set-cookie') ?? '').split(/,(?=\s*[A-Za-z0-9_.-]+=)/)
  for (const entry of raw) {
    const pair = entry.trim().split(';')[0] ?? ''
    const eq = pair.indexOf('=')
    if (eq === -1) continue
    const name = pair.slice(0, eq).trim()
    const value = pair.slice(eq + 1)
    if (!name) continue
    if (value === '') jar.delete(name)
    else jar.set(name, value)
  }
  if (!opts.cache) jar.delete('better-auth.session_data')
  return [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
}

/** The token Better Auth put into an emailed link: either `?token=` or the last path segment. */
export function tokenFromUrl(url: string): string {
  const parsed = new URL(url)
  const fromQuery = parsed.searchParams.get('token')
  if (fromQuery) return fromQuery
  const segment = parsed.pathname.split('/').filter(Boolean).at(-1)
  if (!segment) throw new Error(`no token in ${url}`)
  return segment
}

export const withCookie = (cookie: string) => new Headers({ cookie, 'user-agent': 'vitest' })

/** Request headers for an anonymous call (some endpoints refuse an empty Headers object). */
export const anonymous = () => new Headers({ 'user-agent': 'vitest' })

export type Actor = {
  id: string
  email: string
  name: string
  cookie: string
  headers: Headers
}

/** Signs up a new user through Better Auth and returns a session-bearing actor. */
export async function signUp(payload: TestPayload, opts: { email?: string; name?: string; password?: string } = {}): Promise<Actor> {
  const email = opts.email ?? uniqueEmail()
  const name = opts.name ?? 'Test User'
  const { headers, response } = await api(payload).signUpEmail!({
    body: { email, name, password: opts.password ?? PASSWORD },
    returnHeaders: true,
  })
  const cookie = cookieHeader(headers)
  const user = (response as { user: { id: string } }).user
  return { id: String(user.id), email, name, cookie, headers: withCookie(cookie) }
}

export async function signIn(payload: TestPayload, email: string, password = PASSWORD): Promise<Actor> {
  const { headers, response } = await api(payload).signInEmail!({ body: { email, password }, returnHeaders: true })
  const cookie = cookieHeader(headers)
  const user = (response as { user: { id: string; name: string } }).user
  return { id: String(user.id), email, name: user.name, cookie, headers: withCookie(cookie) }
}

/** Promotes a user to site admin the way the Payload admin (or a migration) would. */
export async function makeAdmin(payload: TestPayload, actor: Actor) {
  const { toPayloadId } = await import('@/lib/ids')
  await payload.update({
    collection: 'users',
    id: toPayloadId(payload, actor.id),
    data: { role: ['admin'] } as never,
    overrideAccess: true,
  })
}

export async function createOrganization(payload: TestPayload, actor: Actor, name = 'Org') {
  const slug = unique('org')
  const org = (await api(payload).createOrganization!({ body: { name: `${name} ${slug}`, slug }, headers: actor.headers })) as {
    id: string
    name: string
    slug: string
  } | null
  if (!org) throw new Error('createOrganization returned null')
  return org
}

/** The user document as Payload stores it, with the tenants array the multi-tenant plugin reads. */
export async function userDoc(payload: TestPayload, actor: Actor) {
  const { toPayloadId } = await import('@/lib/ids')
  return payload.findByID({ collection: 'users', id: toPayloadId(payload, actor.id), depth: 0, overrideAccess: true }) as Promise<{
    id: string | number
    tenants?: Array<{ tenant: string | number; role?: string | null }>
    role?: string[]
    onboardedAt?: string | null
  }>
}

export function tenantIds(doc: { tenants?: Array<{ tenant: string | number }> }): string[] {
  return (doc.tenants ?? []).map((t) => String(t.tenant)).sort()
}

/** Records every email Payload would send; returns the captured list and a restore function. */
export function captureEmails(payload: Payload) {
  const sent: Array<{ to: string; subject: string; html: string; text: string }> = []
  const spy = vi.spyOn(payload, 'sendEmail').mockImplementation(async (message) => {
    sent.push(message as never)
    return undefined as never
  })
  return { sent, restore: () => spy.mockRestore() }
}

/** Extracts the first http(s) URL from an email body. */
export function firstUrl(text: string): string {
  const match = /https?:\/\/[^\s"<>]+/.exec(text)
  if (!match) throw new Error(`no url in: ${text.slice(0, 200)}`)
  return match[0]
}

export async function expectApiError(promise: Promise<unknown>, pattern: RegExp | number) {
  try {
    await promise
  } catch (error) {
    const e = error as { status?: number | string; statusCode?: number; message?: string; body?: { code?: string; message?: string } }
    const status = e.statusCode ?? (typeof e.status === 'number' ? e.status : undefined)
    const message = `${e.body?.code ?? ''} ${e.body?.message ?? ''} ${e.message ?? ''} ${e.status ?? ''}`
    if (typeof pattern === 'number') {
      if (status !== pattern) throw new Error(`expected status ${pattern}, got ${status}: ${message}`)
    } else if (!pattern.test(message)) {
      throw new Error(`expected error matching ${pattern}, got: ${message}`)
    }
    return e
  }
  throw new Error('expected the call to fail')
}
