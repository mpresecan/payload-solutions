/**
 * Server actions: src/app/(frontend)/(app)/dashboard/projects/actions.ts and
 * src/app/(frontend)/(app)/onboarding/actions.ts. Validation, tenant scoping of writes, and the
 * paths they revalidate. Session, Payload and Next's cache are faked.
 */
import { describe, expect, it, vi } from 'vitest'

import { paths } from '@/lib/paths'
import { presets } from '../helpers/stack-fixtures'
import { loadWithStack } from '../helpers/with-stack'

const revalidatePath = vi.fn()
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }))

class RedirectError extends Error {
  constructor(public readonly to: string) {
    super(`REDIRECT:${to}`)
  }
}

function fakePayload() {
  return {
    db: { defaultIDType: 'number' },
    create: vi.fn(async (args: { collection: string; data: Record<string, unknown>; overrideAccess?: boolean }) => ({ id: 1, ...args.data })),
    delete: vi.fn(async (_args: { collection: string; where: Record<string, unknown>; overrideAccess?: boolean }) => ({ docs: [], errors: [] })),
    update: vi.fn(async (_args: { collection: string; id: unknown; data: Record<string, unknown>; overrideAccess?: boolean }) => ({})),
  }
}

async function loadProjectActions(opts: { session: { user: { id: string } } | null; scope?: Record<string, unknown>; data?: Record<string, unknown> }) {
  const payload = fakePayload()
  vi.doMock('@/lib/payload', () => ({ getPayloadClient: async () => payload }))
  vi.doMock('@/lib/auth/session', () => ({
    requireSession: async (returnTo?: string) => {
      if (!opts.session) throw new RedirectError(`${paths.auth.signIn}?redirectTo=${encodeURIComponent(returnTo ?? '')}`)
      return opts.session
    },
  }))
  vi.doMock('@/lib/tenancy', () => ({
    tenantScope: async () => opts.scope ?? { tenant: { equals: 42 } },
    tenantData: async () => opts.data ?? { owner: 7, tenant: 42 },
  }))
  const mod = await loadWithStack(presets.defaults, () => import('@/app/(frontend)/(app)/dashboard/projects/actions'))
  vi.doUnmock('@/lib/payload')
  vi.doUnmock('@/lib/auth/session')
  vi.doUnmock('@/lib/tenancy')
  revalidatePath.mockClear()
  return { ...mod, payload }
}

const form = (fields: Record<string, string>) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe('createProject', () => {
  it('redirects to sign-in with a return url when there is no session', async () => {
    const { createProject } = await loadProjectActions({ session: null })
    await expect(createProject({ ok: false }, form({ name: 'Website' }))).rejects.toThrow(
      `REDIRECT:${paths.auth.signIn}?redirectTo=${encodeURIComponent(paths.dashboard.projects)}`,
    )
  })

  it.each([
    ['empty name', { name: '' }, 'Give the project a name'],
    ['one character', { name: 'a' }, 'Give the project a name'],
    ['whitespace only', { name: '   ' }, 'Give the project a name'],
    ['too long name', { name: 'x'.repeat(81) }, /Too big|80/],
    ['too long description', { name: 'Website', description: 'y'.repeat(501) }, /Too big|500/],
  ])('rejects %s without writing', async (_label, fields, message) => {
    const { createProject, payload } = await loadProjectActions({ session: { user: { id: '7' } } })
    const result = await createProject({ ok: false }, form(fields))
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(message)
    expect(payload.create).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('creates the project in the active tenant with the caller as owner, trimmed, and revalidates', async () => {
    const { createProject, payload } = await loadProjectActions({ session: { user: { id: '7' } } })
    const result = await createProject({ ok: false }, form({ name: '  Website redesign  ', description: '  Q4  ' }))
    expect(result).toEqual({ ok: true })
    expect(payload.create).toHaveBeenCalledWith({
      collection: 'projects',
      data: { name: 'Website redesign', description: 'Q4', status: 'active', owner: 7, tenant: 42 },
      overrideAccess: true,
    })
    expect(revalidatePath).toHaveBeenCalledWith(paths.dashboard.projects)
    expect(revalidatePath).toHaveBeenCalledWith(paths.dashboard.home)
  })

  it('treats an empty description as absent', async () => {
    const { createProject, payload } = await loadProjectActions({ session: { user: { id: '7' } } })
    await createProject({ ok: false }, form({ name: 'Website', description: '' }))
    expect(payload.create.mock.calls[0]![0].data.description).toBeUndefined()
  })

  it('refuses when tenantData has no owner (session lost between checks)', async () => {
    const { createProject, payload } = await loadProjectActions({ session: { user: { id: '7' } }, data: { owner: null } })
    expect(await createProject({ ok: false }, form({ name: 'Website' }))).toEqual({ ok: false, error: 'Not signed in' })
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('writes only the owner when organizations are off', async () => {
    const { createProject, payload } = await loadProjectActions({ session: { user: { id: '7' } }, data: { owner: 7 } })
    await createProject({ ok: false }, form({ name: 'Website' }))
    expect(payload.create.mock.calls[0]![0].data).toEqual({ name: 'Website', status: 'active', owner: 7 })
  })
})

describe('deleteProject', () => {
  it('requires a session', async () => {
    const { deleteProject } = await loadProjectActions({ session: null })
    await expect(deleteProject(1)).rejects.toThrow(/REDIRECT/)
  })

  it('deletes by id AND tenant scope so a foreign id is a no-op, then revalidates', async () => {
    const { deleteProject, payload } = await loadProjectActions({ session: { user: { id: '7' } }, scope: { tenant: { equals: 42 } } })
    expect(await deleteProject(99)).toEqual({ ok: true })
    expect(payload.delete).toHaveBeenCalledWith({
      collection: 'projects',
      where: { and: [{ id: { equals: 99 } }, { tenant: { equals: 42 } }] },
      overrideAccess: true,
    })
    expect(revalidatePath).toHaveBeenCalledWith(paths.dashboard.projects)
    expect(revalidatePath).toHaveBeenCalledWith(paths.dashboard.home)
  })

  it('uses the owner scope when organizations are off', async () => {
    const { deleteProject, payload } = await loadProjectActions({ session: { user: { id: '7' } }, scope: { owner: { equals: 7 } } })
    await deleteProject('5')
    expect(payload.delete.mock.calls[0]![0].where).toEqual({ and: [{ id: { equals: '5' } }, { owner: { equals: 7 } }] })
  })
})

describe('completeOnboarding', () => {
  async function load(session: { user: { id: string } } | null) {
    const payload = fakePayload()
    vi.doMock('@/lib/payload', () => ({ getPayloadClient: async () => payload }))
    vi.doMock('@/lib/auth/session', () => ({
      requireSession: async (returnTo?: string) => {
        if (!session) throw new RedirectError(returnTo ?? '')
        return session
      },
    }))
    vi.resetModules()
    const mod = await import('@/app/(frontend)/(app)/onboarding/actions')
    vi.doUnmock('@/lib/payload')
    vi.doUnmock('@/lib/auth/session')
    return { ...mod, payload }
  }

  it('stamps onboardedAt on the current user', async () => {
    const { completeOnboarding, payload } = await load({ user: { id: '7' } })
    const before = Date.now()
    expect(await completeOnboarding()).toEqual({ ok: true })
    expect(payload.update).toHaveBeenCalledTimes(1)
    const call = payload.update.mock.calls[0]![0] as unknown as { collection: string; id: number; data: { onboardedAt: string }; overrideAccess: boolean }
    expect(call.collection).toBe('users')
    expect(call.id).toBe(7)
    expect(call.overrideAccess).toBe(true)
    expect(Date.parse(call.data.onboardedAt)).toBeGreaterThanOrEqual(before - 1000)
  })

  it('redirects back to onboarding when unauthenticated', async () => {
    const { completeOnboarding, payload } = await load(null)
    await expect(completeOnboarding()).rejects.toThrow(`REDIRECT:${paths.onboarding}`)
    expect(payload.update).not.toHaveBeenCalled()
  })
})
