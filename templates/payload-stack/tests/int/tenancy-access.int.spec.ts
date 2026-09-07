/**
 * Data isolation and access control through Payload's local API with `overrideAccess: false`, the
 * same path the REST/GraphQL API and the admin panel take:
 *   - projects (tenant-scoped): members see and change only their organization's documents
 *   - media: public read, authenticated upload, admin-only delete, image sizes generated
 *   - legal pages: public read, admin-only writes, seeded once
 *   - organizations and users: what a regular user may read
 * Plus the server-side helpers in src/lib/tenancy.ts against real sessions.
 */
import sharp from 'sharp'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { toPayloadId } from '@/lib/ids'
import { seedLegalPages } from '@/seed/legal'
import {
  api,
  type Actor,
  type AuthApi,
  captureEmails,
  createOrganization,
  getTestPayload,
  makeAdmin,
  signUp,
  type TestPayload,
} from '../helpers/int'

let payload: TestPayload
let auth: AuthApi

beforeAll(async () => {
  payload = await getTestPayload()
  auth = api(payload)
})

type PayloadUser = NonNullable<Parameters<TestPayload['find']>[0]['user']>

/** The Payload user document for an actor, the shape `req.user` has in access functions. */
async function asUser(actor: Actor): Promise<PayloadUser> {
  const doc = await payload.findByID({ collection: 'users', id: toPayloadId(payload, actor.id), depth: 0, overrideAccess: true })
  return { ...doc, collection: 'users' } as unknown as PayloadUser
}

async function twoOrganizations() {
  const alice = await signUp(payload, { name: 'Alice' })
  const orgA = await createOrganization(payload, alice, 'A')
  const bob = await signUp(payload, { name: 'Bob' })
  const orgB = await createOrganization(payload, bob, 'B')
  const project = await payload.create({
    collection: 'projects',
    data: { name: 'Alice project', owner: toPayloadId(payload, alice.id), tenant: toPayloadId(payload, orgA.id) } as never,
    overrideAccess: true,
  })
  return { alice, orgA, bob, orgB, project }
}

async function addMember(owner: Actor, orgId: string, member: Actor, role: 'member' | 'admin' = 'member') {
  const { restore } = captureEmails(payload)
  try {
    const invitation = await auth.createInvitation({ body: { email: member.email, role, organizationId: orgId }, headers: owner.headers })
    await auth.acceptInvitation({ body: { invitationId: invitation.id }, headers: member.headers })
  } finally {
    restore()
  }
}

describe('projects are isolated per organization', () => {
  it('a member reads their organization\'s projects and nothing from other organizations', async () => {
    const { alice, bob, project } = await twoOrganizations()
    const mine = await payload.find({ collection: 'projects', user: await asUser(alice), overrideAccess: false })
    expect(mine.docs.map((d) => d.id)).toContain(project.id)
    const theirs = await payload.find({ collection: 'projects', user: await asUser(bob), overrideAccess: false })
    expect(theirs.docs.map((d) => d.id)).not.toContain(project.id)
    await expect(payload.findByID({ collection: 'projects', id: project.id, user: await asUser(bob), overrideAccess: false })).rejects.toThrow()
  })

  it('anonymous requests and users without any organization are refused outright', async () => {
    const { project } = await twoOrganizations()
    await expect(payload.find({ collection: 'projects', overrideAccess: false })).rejects.toThrow(/not allowed/)
    await expect(payload.findByID({ collection: 'projects', id: project.id, overrideAccess: false })).rejects.toThrow()
    const loner = await signUp(payload)
    await expect(payload.find({ collection: 'projects', user: await asUser(loner), overrideAccess: false })).rejects.toThrow(/not allowed/)
  })

  it('members of another organization cannot update or delete', async () => {
    const { bob, project } = await twoOrganizations()
    await expect(
      payload.update({ collection: 'projects', id: project.id, data: { name: 'Hijacked' }, user: await asUser(bob), overrideAccess: false }),
    ).rejects.toThrow()
    await expect(payload.delete({ collection: 'projects', id: project.id, user: await asUser(bob), overrideAccess: false })).rejects.toThrow()
    const still = await payload.findByID({ collection: 'projects', id: project.id, overrideAccess: true })
    expect(still.name).toBe('Alice project')
  })

  it('a member creating a project can only place it in an organization they belong to (src/tenancy/validate-tenant.ts)', async () => {
    const { bob, orgA, orgB } = await twoOrganizations()
    const user = await asUser(bob)
    await expect(
      payload.create({
        collection: 'projects',
        data: { name: 'Sneaky', owner: toPayloadId(payload, bob.id), tenant: toPayloadId(payload, orgA.id) } as never,
        user,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ name: 'ValidationError', data: { errors: [expect.objectContaining({ message: 'You are not a member of this organization.' })] } })
    const ok = await payload.create({
      collection: 'projects',
      data: { name: 'Legit', owner: toPayloadId(payload, bob.id), tenant: toPayloadId(payload, orgB.id) } as never,
      user,
      overrideAccess: false,
    })
    expect(String((ok as { tenant: unknown }).tenant && (typeof ok.tenant === 'object' ? (ok.tenant as { id: unknown }).id : ok.tenant))).toBe(String(toPayloadId(payload, orgB.id)))
  })

  it('a project needs a tenant when organizations are enabled', async () => {
    const { alice } = await twoOrganizations()
    await expect(
      payload.create({ collection: 'projects', data: { name: 'Nowhere', owner: toPayloadId(payload, alice.id) } as never, overrideAccess: true }),
    ).rejects.toThrow()
  })

  it('new members gain access, removed members lose it', async () => {
    const { alice, orgA, project } = await twoOrganizations()
    const carol = await signUp(payload, { name: 'Carol' })
    const other = await createOrganization(payload, carol, 'Carol org')
    expect((await payload.find({ collection: 'projects', user: await asUser(carol), overrideAccess: false })).docs.map((d) => d.id)).not.toContain(project.id)

    await addMember(alice, orgA.id, carol)
    expect((await payload.find({ collection: 'projects', user: await asUser(carol), overrideAccess: false })).docs.map((d) => d.id)).toContain(project.id)

    await auth.removeMember({ body: { memberIdOrEmail: carol.email, organizationId: orgA.id }, headers: alice.headers })
    const after = await payload.find({ collection: 'projects', user: await asUser(carol), overrideAccess: false })
    expect(after.docs.map((d) => d.id)).not.toContain(project.id)
    expect(other.id).toBeTruthy()
  })

  it('site admins see every organization\'s projects', async () => {
    const { project } = await twoOrganizations()
    const admin = await signUp(payload, { name: 'Admin' })
    await makeAdmin(payload, admin)
    const all = await payload.find({ collection: 'projects', user: await asUser(admin), overrideAccess: false, limit: 500 })
    expect(all.docs.map((d) => d.id)).toContain(project.id)
  })

  it('the owner field defaults to the acting user', async () => {
    const { bob, orgB } = await twoOrganizations()
    const created = await payload.create({
      collection: 'projects',
      data: { name: 'Owned', tenant: toPayloadId(payload, orgB.id) } as never,
      user: await asUser(bob),
      overrideAccess: false,
      depth: 0,
    })
    expect(String(created.owner)).toBe(bob.id)
    expect(created.status).toBe('active')
  })
})

describe('tenancy helpers with real sessions', () => {
  async function helpersFor(actor: Actor) {
    vi.resetModules()
    vi.doMock('@/lib/auth/session', () => ({
      getSession: async () => auth.getSession({ headers: actor.headers }),
    }))
    vi.doMock('@/lib/payload', () => ({ getPayloadClient: async () => payload }))
    const mod = await import('@/lib/tenancy')
    vi.doUnmock('@/lib/auth/session')
    vi.doUnmock('@/lib/payload')
    return mod
  }

  it('tenantScope follows the active organization and lists the user\'s organizations', async () => {
    const { alice, orgA, project } = await twoOrganizations()
    const helpers = await helpersFor(alice)
    expect(await helpers.tenantScope()).toEqual({ tenant: { equals: toPayloadId(payload, orgA.id) } })
    expect(await helpers.getActiveOrganizationId()).toBe(toPayloadId(payload, orgA.id))
    expect((await helpers.getActiveOrganization())?.name).toBe(orgA.name)
    expect((await helpers.listUserOrganizations()).map((o) => String(o.id))).toEqual([String(orgA.id)])
    expect(await helpers.tenantData()).toEqual({ owner: toPayloadId(payload, alice.id), tenant: toPayloadId(payload, orgA.id) })

    const scoped = await payload.find({ collection: 'projects', where: await helpers.tenantScope(), overrideAccess: true })
    expect(scoped.docs.map((d) => d.id)).toEqual([project.id])
  })

  it('switching the active organization changes the scope', async () => {
    const alice = await signUp(payload)
    const first = await createOrganization(payload, alice, 'First')
    const second = await createOrganization(payload, alice, 'Second')
    const helpers = await helpersFor(alice)
    expect(await helpers.getActiveOrganizationId()).toBe(toPayloadId(payload, second.id))
    await auth.setActiveOrganization({ body: { organizationId: first.id }, headers: alice.headers })
    expect(await helpers.getActiveOrganizationId()).toBe(toPayloadId(payload, first.id))
  })
})

describe('media', () => {
  let png: Buffer
  beforeAll(async () => {
    // Larger than both configured image sizes so Payload generates them (it never enlarges).
    png = await sharp({ create: { width: 900, height: 1100, channels: 3, background: '#f26522' } }).png().toBuffer()
  })

  async function upload(user: PayloadUser | undefined, tenant: string) {
    return payload.create({
      collection: 'media',
      data: { alt: 'An orange rectangle', tenant: toPayloadId(payload, tenant) } as never,
      file: { data: png, mimetype: 'image/png', name: `orange-${Date.now()}.png`, size: png.byteLength },
      user,
      overrideAccess: false,
    })
  }

  it('authenticated members upload into their organization with generated sizes; anonymous visitors cannot', async () => {
    const { alice, orgA } = await twoOrganizations()
    const doc = await upload(await asUser(alice), orgA.id)
    expect(doc.mimeType).toBe('image/png')
    expect(doc.width).toBe(900)
    expect(doc.sizes?.thumbnail).toMatchObject({ width: 400, height: 300 })
    expect(doc.sizes?.card).toMatchObject({ width: 768, height: 1024 })
    expect(doc.url).toMatch(/\/api\/media\/file\//)
    await expect(upload(undefined, orgA.id)).rejects.toThrow()
  })

  it('members cannot upload into another organization', async () => {
    const { bob, orgA } = await twoOrganizations()
    await expect(upload(await asUser(bob), orgA.id)).rejects.toMatchObject({ name: 'ValidationError' })
  })

  it('rejects non-image uploads', async () => {
    const { alice, orgA } = await twoOrganizations()
    await expect(
      payload.create({
        collection: 'media',
        data: { alt: 'text', tenant: toPayloadId(payload, orgA.id) } as never,
        file: { data: Buffer.from('hello'), mimetype: 'text/plain', name: 'hello.txt', size: 5 },
        user: await asUser(alice),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('is publicly readable but only admins may delete', async () => {
    const { alice, orgA, bob } = await twoOrganizations()
    const doc = await upload(await asUser(alice), orgA.id)
    const anon = await payload.findByID({ collection: 'media', id: doc.id, overrideAccess: false })
    expect(anon.id).toBe(doc.id)
    await expect(payload.delete({ collection: 'media', id: doc.id, user: await asUser(alice), overrideAccess: false })).rejects.toThrow()
    await expect(payload.delete({ collection: 'media', id: doc.id, user: await asUser(bob), overrideAccess: false })).rejects.toThrow()
    const admin = await signUp(payload)
    await makeAdmin(payload, admin)
    await payload.delete({ collection: 'media', id: doc.id, user: await asUser(admin), overrideAccess: false })
    await expect(payload.findByID({ collection: 'media', id: doc.id, overrideAccess: true })).rejects.toThrow()
  })
})

describe('legal pages', () => {
  it('are seeded exactly once and stay put on later boots', async () => {
    const before = await payload.count({ collection: 'legal-pages', overrideAccess: true })
    expect(before.totalDocs).toBeGreaterThanOrEqual(3)
    await seedLegalPages(payload)
    await seedLegalPages(payload)
    const after = await payload.count({ collection: 'legal-pages', overrideAccess: true })
    expect(after.totalDocs).toBe(before.totalDocs)
  })

  it('are published and readable without a session', async () => {
    const pages = await payload.find({ collection: 'legal-pages', overrideAccess: false })
    const slugs = pages.docs.map((p) => p.slug)
    expect(slugs).toEqual(expect.arrayContaining(['privacy', 'terms', 'cookies']))
    for (const page of pages.docs) {
      expect(page._status).toBe('published')
      expect(page.showInFooter).toBe(true)
    }
  })

  it('cannot be written by regular users, can by admins', async () => {
    const user = await signUp(payload)
    await expect(
      payload.create({
        collection: 'legal-pages',
        data: { title: 'Rogue', slug: `rogue-${Date.now()}`, effectiveDate: new Date().toISOString(), content: { root: { type: 'root', children: [] } } } as never,
        user: await asUser(user),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    const privacy = (await payload.find({ collection: 'legal-pages', where: { slug: { equals: 'privacy' } }, overrideAccess: true })).docs[0]!
    await expect(
      payload.update({ collection: 'legal-pages', id: privacy.id, data: { title: 'Hacked' }, user: await asUser(user), overrideAccess: false }),
    ).rejects.toThrow()

    const admin = await signUp(payload)
    await makeAdmin(payload, admin)
    const updated = await payload.update({ collection: 'legal-pages', id: privacy.id, data: { title: 'Privacy Policy' }, user: await asUser(admin), overrideAccess: false })
    expect(updated.title).toBe('Privacy Policy')
  })

  it('enforces unique slugs', async () => {
    await expect(
      payload.create({
        collection: 'legal-pages',
        data: { title: 'Dup', slug: 'privacy', effectiveDate: new Date().toISOString(), content: { root: { type: 'root', children: [] } } } as never,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })
})

describe('organizations and users through Payload', () => {
  it('a user reads only the organizations they belong to', async () => {
    const { alice, orgA, orgB } = await twoOrganizations()
    const visible = await payload.find({ collection: 'organizations', user: await asUser(alice), overrideAccess: false, limit: 500 })
    const ids = visible.docs.map((d) => String(d.id))
    expect(ids).toContain(String(toPayloadId(payload, orgA.id)))
    expect(ids).not.toContain(String(toPayloadId(payload, orgB.id)))
  })

  it('anonymous visitors cannot read organizations', async () => {
    await twoOrganizations()
    await expect(payload.find({ collection: 'organizations', overrideAccess: false })).rejects.toThrow(/not allowed/)
  })

  it('a regular user cannot promote themselves through Payload', async () => {
    const user = await signUp(payload)
    await expect(
      payload.update({ collection: 'users', id: toPayloadId(payload, user.id), data: { role: ['admin'] } as never, user: await asUser(user), overrideAccess: false }),
    ).rejects.toThrow()
    const doc = await payload.findByID({ collection: 'users', id: toPayloadId(payload, user.id), depth: 0, overrideAccess: true })
    expect(doc.role).toEqual(['user'])
  })

  it('a regular user cannot edit their tenants array directly', async () => {
    const { alice, orgB } = await twoOrganizations()
    await expect(
      payload.update({
        collection: 'users',
        id: toPayloadId(payload, alice.id),
        data: { tenants: [{ tenant: toPayloadId(payload, orgB.id), role: 'owner' }] } as never,
        user: await asUser(alice),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })
})
