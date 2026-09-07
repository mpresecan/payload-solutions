/**
 * Small pure helpers: src/lib/ids.ts, src/access/index.ts, src/lib/auth/session.ts (isSiteAdmin),
 * src/lib/paths.ts, src/lib/utils.ts.
 */
import type { Payload, PayloadRequest, TypedUser } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { adminOnly, adminOnlyField, adminOrOwner, anyone, authenticated, isAdmin } from '@/access'
import { toPayloadId } from '@/lib/ids'
import { paths } from '@/lib/paths'
import { cn } from '@/lib/utils'

vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

const payloadWithIdType = (defaultIDType: 'number' | 'text') => ({ db: { defaultIDType } }) as unknown as Payload

describe('toPayloadId', () => {
  it('converts numeric strings to numbers on databases with numeric ids (Postgres, SQLite)', () => {
    const payload = payloadWithIdType('number')
    expect(toPayloadId(payload, '42')).toBe(42)
    expect(toPayloadId(payload, 42)).toBe(42)
  })

  it('leaves non-numeric strings alone even on numeric databases', () => {
    const payload = payloadWithIdType('number')
    expect(toPayloadId(payload, 'abc123')).toBe('abc123')
    expect(toPayloadId(payload, '12a')).toBe('12a')
    expect(toPayloadId(payload, '')).toBe('')
  })

  it('keeps strings as strings on databases with string ids (MongoDB)', () => {
    const payload = payloadWithIdType('text')
    expect(toPayloadId(payload, '42')).toBe('42')
    expect(toPayloadId(payload, '507f1f77bcf86cd799439011')).toBe('507f1f77bcf86cd799439011')
    expect(toPayloadId(payload, 7)).toBe(7)
  })
})

describe('access helpers', () => {
  const user = (role?: unknown) => ({ id: 1, collection: 'users', email: 'u@x', role }) as unknown as TypedUser
  const req = (u: TypedUser | null) => ({ req: { user: u } as PayloadRequest }) as never

  it('isAdmin only for the admin role inside the roles array', () => {
    expect(isAdmin(user(['admin']))).toBe(true)
    expect(isAdmin(user(['user', 'admin']))).toBe(true)
    expect(isAdmin(user(['user']))).toBe(false)
    expect(isAdmin(user([]))).toBe(false)
    expect(isAdmin(user('admin'))).toBe(false) // roles are arrays; a bare string never matches
    expect(isAdmin(user(undefined))).toBe(false)
    expect(isAdmin(null)).toBe(false)
    expect(isAdmin(undefined)).toBe(false)
  })

  it('adminOnly and adminOnlyField mirror isAdmin', () => {
    expect(adminOnly(req(user(['admin'])))).toBe(true)
    expect(adminOnly(req(user(['user'])))).toBe(false)
    expect(adminOnly(req(null))).toBe(false)
    expect(adminOnlyField(req(user(['admin'])))).toBe(true)
    expect(adminOnlyField(req(null))).toBe(false)
  })

  it('anyone is always true, authenticated needs a user', () => {
    expect(anyone(req(null))).toBe(true)
    expect(authenticated(req(null))).toBe(false)
    expect(authenticated(req(user(['user'])))).toBe(true)
  })

  it('adminOrOwner: admins see everything, users only their own documents, anonymous nothing', () => {
    expect(adminOrOwner()(req(null))).toBe(false)
    expect(adminOrOwner()(req(user(['admin'])))).toBe(true)
    expect(adminOrOwner()(req(user(['user'])))).toEqual({ owner: { equals: 1 } })
    expect(adminOrOwner('author')(req(user(['user'])))).toEqual({ author: { equals: 1 } })
  })
})

describe('isSiteAdmin', () => {
  it('reads the role from the session user as an array or a string', async () => {
    const { isSiteAdmin } = await import('@/lib/auth/session')
    const session = (role: unknown) => ({ user: { role }, session: {} }) as never
    expect(isSiteAdmin(session(['admin']))).toBe(true)
    expect(isSiteAdmin(session('admin'))).toBe(true)
    expect(isSiteAdmin(session(['user']))).toBe(false)
    expect(isSiteAdmin(session('user'))).toBe(false)
    expect(isSiteAdmin(session(null))).toBe(false)
    expect(isSiteAdmin(null)).toBe(false)
  })
})

describe('paths', () => {
  it('keeps every route under its base path', () => {
    for (const value of Object.values(paths.auth)) expect(value.startsWith(paths.auth.base)).toBe(true)
    for (const value of Object.values(paths.dashboard)) expect(value.startsWith(paths.dashboard.home)).toBe(true)
  })

  it('separates the Payload admin from the in-app admin', () => {
    expect(paths.payloadAdmin).toBe('/admin')
    expect(paths.dashboard.admin).toBe('/dashboard/admin')
    expect(Object.values(paths.dashboard)).not.toContain('/admin')
  })

  it('builds legal page urls', () => {
    expect(paths.legal('privacy')).toBe('/legal/privacy')
  })

  it('has no trailing slashes or duplicates', () => {
    const flat = [...Object.values(paths.auth), ...Object.values(paths.dashboard), paths.home, paths.pricing, paths.onboarding, paths.payloadAdmin]
    for (const p of flat) expect(p === '/' || !p.endsWith('/')).toBe(true)
    expect(new Set(flat).size).toBe(flat.length)
  })
})

describe('cn', () => {
  it('merges tailwind classes with the last conflicting one winning', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('text-sm', false && 'hidden', undefined, 'font-bold')).toBe('text-sm font-bold')
  })
})
