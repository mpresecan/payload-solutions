/**
 * src/lib/tenancy.ts and src/tenancy/sync-memberships.ts: how server code scopes data to the
 * active organization (or to the owner when organizations are off) and how Better Auth
 * memberships are mirrored into `users.tenants`. Session and Payload are faked here; the same
 * behaviour is exercised against a real database in tests/int/organizations.int.spec.ts.
 */
import type { CollectionConfig, Payload, PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import type { StackInput } from '@/lib/stack'
import { presets } from '../helpers/stack-fixtures'
import { loadWithStack } from '../helpers/with-stack'

type FakeSession = { user: { id: string }; session: { activeOrganizationId?: string | null } } | null

function fakePayload(overrides: Partial<Record<'find' | 'findByID' | 'update', unknown>> = {}) {
  return {
    db: { defaultIDType: 'number' },
    find: vi.fn(async () => ({ docs: [] })),
    findByID: vi.fn(async ({ id }: { id: number }) => ({ id, name: 'Org' })),
    update: vi.fn(async () => ({})),
    logger: { error: vi.fn() },
    ...overrides,
  }
}

async function loadTenancy(input: StackInput, session: FakeSession, payload = fakePayload()) {
  vi.doMock('@/lib/auth/session', () => ({ getSession: async () => session }))
  vi.doMock('@/lib/payload', () => ({ getPayloadClient: async () => payload }))
  const mod = await loadWithStack(input, () => import('@/lib/tenancy'))
  vi.doUnmock('@/lib/auth/session')
  vi.doUnmock('@/lib/payload')
  return { ...mod, payload }
}

const signedIn = (activeOrganizationId?: string | null): FakeSession => ({ user: { id: '7' }, session: { activeOrganizationId } })

describe('tenantScope', () => {
  it('matches nothing for anonymous callers, with or without organizations', async () => {
    const anon = { id: { exists: false } }
    expect(await (await loadTenancy(presets.defaults, null)).tenantScope()).toEqual(anon)
    expect(await (await loadTenancy(presets['orgs-off'], null)).tenantScope()).toEqual(anon)
  })

  it('scopes to the active organization (normalised to the database id type)', async () => {
    const { tenantScope } = await loadTenancy(presets.defaults, signedIn('42'))
    expect(await tenantScope()).toEqual({ tenant: { equals: 42 } })
  })

  it('matches nothing when organizations are on but none is active', async () => {
    const { tenantScope } = await loadTenancy(presets.defaults, signedIn(null))
    expect(await tenantScope()).toEqual({ id: { exists: false } })
    const { tenantScope: noField } = await loadTenancy(presets.defaults, signedIn(undefined))
    expect(await noField()).toEqual({ id: { exists: false } })
  })

  it('scopes to the owner when organizations are off, ignoring any active organization', async () => {
    const { tenantScope } = await loadTenancy(presets['orgs-off'], signedIn('42'))
    expect(await tenantScope()).toEqual({ owner: { equals: 7 } })
  })

  it('keeps string ids on string-id databases', async () => {
    const payload = fakePayload()
    payload.db.defaultIDType = 'text'
    const { tenantScope } = await loadTenancy(presets.defaults, { user: { id: 'u_abc' }, session: { activeOrganizationId: 'org_xyz' } }, payload)
    expect(await tenantScope()).toEqual({ tenant: { equals: 'org_xyz' } })
  })
})

describe('tenantData', () => {
  it('sets owner and tenant with organizations', async () => {
    const { tenantData } = await loadTenancy(presets.defaults, signedIn('42'))
    expect(await tenantData()).toEqual({ owner: 7, tenant: 42 })
  })

  it('sets only owner when organizations are off or none is active', async () => {
    expect(await (await loadTenancy(presets['orgs-off'], signedIn('42'))).tenantData()).toEqual({ owner: 7 })
    expect(await (await loadTenancy(presets.defaults, signedIn(null))).tenantData()).toEqual({ owner: 7 })
  })

  it('has a null owner for anonymous callers so actions can refuse', async () => {
    expect(await (await loadTenancy(presets.defaults, null)).tenantData()).toEqual({ owner: null })
  })
})

describe('getActiveOrganization / getActiveOrganizationId / getCurrentUserId', () => {
  it('returns null without organizations, without a session, or without an active organization', async () => {
    expect(await (await loadTenancy(presets['orgs-off'], signedIn('42'))).getActiveOrganizationId()).toBeNull()
    expect(await (await loadTenancy(presets.defaults, null)).getActiveOrganizationId()).toBeNull()
    expect(await (await loadTenancy(presets.defaults, signedIn(null))).getActiveOrganization()).toBeNull()
    expect(await (await loadTenancy(presets.defaults, null)).getCurrentUserId()).toBeNull()
  })

  it('loads the active organization document with access overridden', async () => {
    const { getActiveOrganization, payload } = await loadTenancy(presets.defaults, signedIn('42'))
    expect(await getActiveOrganization()).toEqual({ id: 42, name: 'Org' })
    expect(payload.findByID).toHaveBeenCalledWith({ collection: 'organizations', id: 42, depth: 0, overrideAccess: true })
  })

  it('returns null instead of throwing when the active organization no longer exists', async () => {
    const payload = fakePayload({ findByID: vi.fn(async () => { throw new Error('not found') }) })
    const { getActiveOrganization } = await loadTenancy(presets.defaults, signedIn('42'), payload)
    expect(await getActiveOrganization()).toBeNull()
  })

  it('normalises the current user id', async () => {
    const { getCurrentUserId } = await loadTenancy(presets.defaults, signedIn())
    expect(await getCurrentUserId()).toBe(7)
  })
})

describe('listUserOrganizations', () => {
  it('returns the populated organization of each membership, skipping unpopulated ones', async () => {
    const payload = fakePayload({
      find: vi.fn(async () => ({
        docs: [
          { organization: { id: 1, name: 'A' } },
          { organization: 2 },
          { organization: { id: 3, name: 'C' } },
        ],
      })),
    })
    const { listUserOrganizations } = await loadTenancy(presets.defaults, signedIn(), payload)
    expect(await listUserOrganizations()).toEqual([
      { id: 1, name: 'A' },
      { id: 3, name: 'C' },
    ])
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'members', where: { user: { equals: 7 } }, depth: 1, overrideAccess: true }),
    )
  })

  it('is empty without organizations or without a session', async () => {
    const { listUserOrganizations, payload } = await loadTenancy(presets['orgs-off'], signedIn())
    expect(await listUserOrganizations()).toEqual([])
    expect(payload.find).not.toHaveBeenCalled()
    expect(await (await loadTenancy(presets.defaults, null)).listUserOrganizations()).toEqual([])
  })
})

describe('withMembershipSync', () => {
  const collection: CollectionConfig = {
    slug: 'members',
    fields: [],
    hooks: { afterChange: [vi.fn()], afterDelete: [] },
  }

  it('appends afterChange and afterDelete hooks without dropping existing ones', async () => {
    const { withMembershipSync } = await import('@/tenancy/sync-memberships')
    const out = withMembershipSync({ collection })
    expect(out.slug).toBe('members')
    expect(out.hooks?.afterChange).toHaveLength(2)
    expect(out.hooks?.afterChange?.[0]).toBe(collection.hooks!.afterChange![0])
    expect(out.hooks?.afterDelete).toHaveLength(1)
  })

  async function runAfterChange(memberships: Array<{ organization: unknown; role?: string | null }>, doc: Record<string, unknown>) {
    const { withMembershipSync } = await import('@/tenancy/sync-memberships')
    const out = withMembershipSync({ collection: { slug: 'members', fields: [] } })
    const payload = fakePayload({ find: vi.fn(async () => ({ docs: memberships })) })
    const req = { payload, user: null } as unknown as PayloadRequest
    const hook = out.hooks!.afterChange![0]!
    await hook({ doc, req, previousDoc: {}, operation: 'create', collection: out, context: {} } as never)
    return payload
  }

  it('rebuilds users.tenants from every membership of the user, inside the same request/transaction', async () => {
    const payload = await runAfterChange(
      [
        { organization: 10, role: 'owner' },
        { organization: { id: 11 }, role: null },
      ],
      { id: 1, user: 7, organization: 10, role: 'owner' },
    )
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'members', where: { user: { equals: 7 } }, depth: 0, overrideAccess: true, req: expect.anything() }),
    )
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        id: 7,
        data: {
          tenants: [
            { tenant: 10, role: 'owner' },
            { tenant: 11, role: 'member' },
          ],
        },
        overrideAccess: true,
        context: { skipTenantSync: true },
        req: expect.anything(),
      }),
    )
  })

  it('accepts a populated user relationship on the member document', async () => {
    const payload = await runAfterChange([], { id: 1, user: { id: 9 }, organization: 10 })
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({ id: 9, data: { tenants: [] } }))
  })

  it('logs and returns the document instead of failing the Better Auth operation when the sync throws', async () => {
    const { withMembershipSync } = await import('@/tenancy/sync-memberships')
    const out = withMembershipSync({ collection: { slug: 'members', fields: [] } })
    const payload = fakePayload({ find: vi.fn(async () => { throw new Error('db down') }) })
    const req = { payload } as unknown as PayloadRequest
    const doc = { id: 1, user: 7, organization: 10 }
    const result = await out.hooks!.afterDelete![0]!({ doc, req, id: 1, collection: out, context: {} } as never)
    expect(result).toBe(doc)
    expect(payload.logger.error).toHaveBeenCalledWith(expect.objectContaining({ msg: 'Failed to remove membership from users.tenants' }))
  })
})

describe('type sanity', () => {
  it('Payload type is satisfied by the fake used above', () => {
    const p = fakePayload() as unknown as Payload
    expect(p).toBeTruthy()
  })
})

describe('withTenantCleanup (src/tenancy/cleanup.ts)', () => {
  it('deletes every tenant-scoped collection for the organization before the row goes, inside the request', async () => {
    const { withTenantCleanup, TENANT_SCOPED_COLLECTIONS } = await import('@/tenancy/cleanup')
    const existing = vi.fn()
    const out = withTenantCleanup({ slug: 'organizations', fields: [], hooks: { beforeDelete: [existing] } })
    expect(out.hooks?.beforeDelete).toHaveLength(2)
    expect(out.hooks?.beforeDelete?.[0]).toBe(existing)

    const payload = { delete: vi.fn(async () => ({ docs: [], errors: [] })) }
    const req = { payload } as unknown as PayloadRequest
    await out.hooks!.beforeDelete![1]!({ id: 42, req, collection: out, context: {} } as never)
    expect(payload.delete).toHaveBeenCalledTimes(TENANT_SCOPED_COLLECTIONS.length)
    for (const slug of TENANT_SCOPED_COLLECTIONS) {
      expect(payload.delete).toHaveBeenCalledWith({ collection: slug, where: { tenant: { equals: 42 } }, depth: 0, overrideAccess: true, req })
    }
  })

  it('covers exactly the collections the multi-tenant plugin manages', async () => {
    const { TENANT_SCOPED_COLLECTIONS } = await import('@/tenancy/cleanup')
    expect([...TENANT_SCOPED_COLLECTIONS]).toEqual(['projects', 'media'])
  })
})

describe('validateTenantMembership (src/tenancy/validate-tenant.ts)', () => {
  const run = async (value: unknown, user: unknown) => {
    const { validateTenantMembership } = await import('@/tenancy/validate-tenant')
    return validateTenantMembership(value as never, { req: { user } } as never)
  }
  const member = { id: 1, role: ['user'], tenants: [{ tenant: 10 }, { tenant: { id: 11 } }] }

  it('accepts organizations the user belongs to, as ids, strings or populated docs', async () => {
    expect(await run(10, member)).toBe(true)
    expect(await run('11', member)).toBe(true)
    expect(await run({ id: 10 }, member)).toBe(true)
    expect(await run({ value: 11, relationTo: 'organizations' }, member)).toBe(true)
  })

  it('rejects organizations the user does not belong to, with a readable message', async () => {
    expect(await run(12, member)).toBe('You are not a member of this organization.')
    expect(await run(10, { id: 2, role: ['user'], tenants: [] })).toBe('You are not a member of this organization.')
  })

  it('lets site admins assign any organization and leaves empty values to the required check', async () => {
    expect(await run(999, { id: 3, role: ['admin'], tenants: [] })).toBe(true)
    expect(await run(null, member)).toBe(true)
    expect(await run(undefined, member)).toBe(true)
    expect(await run(12, null)).toBe(true)
  })
})
