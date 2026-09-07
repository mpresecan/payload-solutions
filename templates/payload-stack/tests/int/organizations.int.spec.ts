/**
 * Organizations end to end: Better Auth's organization plugin (create, active organization,
 * invitations, roles, removal, leaving, deletion) and the bridge into Payload's multi-tenant
 * plugin (`users.tenants` mirrors `members`, and deleting an organization cleans up its data).
 */
import { beforeAll, describe, expect, it } from 'vitest'

import stack from '@/stack.config'
import { toPayloadId } from '@/lib/ids'
import {
  api,
  type AuthApi,
  captureEmails,
  createOrganization,
  expectApiError,
  firstUrl,
  getTestPayload,
  signUp,
  tenantIds,
  unique,
  userDoc,
  type Actor,
  type TestPayload,
} from '../helpers/int'

let payload: TestPayload
let auth: AuthApi

beforeAll(async () => {
  payload = await getTestPayload()
  auth = api(payload)
})

async function membersOf(orgId: string | number) {
  const result = await payload.find({
    collection: 'members',
    where: { organization: { equals: toPayloadId(payload, orgId) } },
    depth: 0,
    limit: 100,
    overrideAccess: true,
  })
  return result.docs as Array<{ user: string | number; role: string }>
}

async function invite(owner: Actor, orgId: string, email: string, role: 'member' | 'admin' | 'owner' = 'member') {
  const { sent, restore } = captureEmails(payload)
  try {
    const invitation = await auth.createInvitation({
      body: { email, role, organizationId: orgId },
      headers: owner.headers,
    })
    return { invitation, email: sent[0] }
  } finally {
    restore()
  }
}

describe('creating an organization', () => {
  it('makes the creator a member with the configured creatorRole, mirrored into users.tenants, and activates it', async () => {
    const owner = await signUp(payload)
    const org = await createOrganization(payload, owner, 'Acme')

    const members = await membersOf(org.id)
    expect(members).toHaveLength(1)
    expect(String(members[0]!.user)).toBe(owner.id)
    expect(members[0]!.role).toBe(stack.organizations.creatorRole)

    const doc = await userDoc(payload, owner)
    expect(tenantIds(doc)).toEqual([String(org.id)])
    expect(doc.tenants?.[0]?.role).toBe(stack.organizations.creatorRole)

    const session = await auth.getSession({ headers: owner.headers })
    expect(String((session?.session as { activeOrganizationId?: string }).activeOrganizationId)).toBe(String(org.id))
  })

  it('stores the organization in Payload with the extra onboardedAt field', async () => {
    const owner = await signUp(payload)
    const org = await createOrganization(payload, owner)
    const doc = (await payload.findByID({ collection: 'organizations', id: toPayloadId(payload, org.id), depth: 0, overrideAccess: true })) as { name: string; slug: string; onboardedAt?: string | null }
    expect(doc.name).toBe(org.name)
    expect(doc.slug).toBe(org.slug)
    expect(doc.onboardedAt).toBeNull()
  })

  it('refuses a taken slug and reports availability', async () => {
    const owner = await signUp(payload)
    const org = await createOrganization(payload, owner)
    await expectApiError(
      auth.createOrganization({ body: { name: 'Dup', slug: org.slug }, headers: owner.headers }),
      /ORGANIZATION_ALREADY_EXISTS|already|taken|slug/i,
    )
    const free = await auth.checkOrganizationSlug({ body: { slug: unique('free') }, headers: owner.headers })
    expect(free.status).toBe(true)
    await expectApiError(auth.checkOrganizationSlug({ body: { slug: org.slug }, headers: owner.headers }), /.*/)
  })

  it('requires a session', async () => {
    await expectApiError(auth.createOrganization({ body: { name: 'Nope', slug: unique('nope') }, headers: new Headers({ 'user-agent': 'vitest' }) }), /401|UNAUTHORIZED|session/i)
  })

  it('a user can belong to several organizations and switch the active one', async () => {
    const owner = await signUp(payload)
    const first = await createOrganization(payload, owner, 'First')
    const second = await createOrganization(payload, owner, 'Second')
    expect(tenantIds(await userDoc(payload, owner))).toEqual([String(first.id), String(second.id)].sort())

    const list = await auth.listOrganizations({ headers: owner.headers })
    expect(list.map((o: { id: string }) => String(o.id)).sort()).toEqual([String(first.id), String(second.id)].sort())

    await auth.setActiveOrganization({ body: { organizationId: first.id }, headers: owner.headers })
    let session = await auth.getSession({ headers: owner.headers })
    expect(String((session?.session as { activeOrganizationId?: string }).activeOrganizationId)).toBe(String(first.id))

    await auth.setActiveOrganization({ body: { organizationSlug: second.slug }, headers: owner.headers })
    session = await auth.getSession({ headers: owner.headers })
    expect(String((session?.session as { activeOrganizationId?: string }).activeOrganizationId)).toBe(String(second.id))

    await auth.setActiveOrganization({ body: { organizationId: null }, headers: owner.headers })
    session = await auth.getSession({ headers: owner.headers })
    expect((session?.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null).toBeNull()
  })

  it('cannot activate an organization the user does not belong to', async () => {
    const owner = await signUp(payload)
    const org = await createOrganization(payload, owner)
    const outsider = await signUp(payload)
    await expectApiError(auth.setActiveOrganization({ body: { organizationId: org.id }, headers: outsider.headers }), /.*/)
  })
})

describe('invitations', () => {
  it('emails the invitee a link with the invitation id, expiring in 48 hours', async () => {
    const owner = await signUp(payload, { name: 'Mira Lindqvist' })
    const org = await createOrganization(payload, owner, 'Acme')
    const email = `invitee-${unique()}@example.test`
    const { invitation, email: message } = await invite(owner, org.id, email)

    expect(invitation.status).toBe('pending')
    expect(invitation.role).toBe('member')
    expect(new Date(invitation.expiresAt).getTime() - Date.now()).toBeGreaterThan(47 * 60 * 60 * 1000)

    expect(message?.to).toBe(email)
    expect(message?.subject).toBe(`Mira Lindqvist invited you to ${org.name} on ${stack.name}`)
    const url = firstUrl(message!.text)
    expect(url).toBe(`${stack.url}/auth/accept-invitation?invitationId=${invitation.id}`)
    expect(message!.html).toContain('48 hours')
  })

  it('accepting adds the invitee as a member with the invited role and syncs their tenants', async () => {
    const owner = await signUp(payload)
    const org = await createOrganization(payload, owner)
    const invitee = await signUp(payload)
    const { invitation } = await invite(owner, org.id, invitee.email, 'admin')

    // Better Auth only lists invitations for verified emails; before that the invitee must use the link.
    await expectApiError(auth.listUserInvitations({ headers: invitee.headers }), /verification required/i)
    await payload.update({ collection: 'users', id: toPayloadId(payload, invitee.id), data: { emailVerified: true } as never, overrideAccess: true })
    const mine = await auth.listUserInvitations({ headers: invitee.headers })
    expect(mine.map((i: { id: string }) => i.id)).toContain(invitation.id)
    // The invitation itself is readable through its id from the emailed link.
    const byId = await auth.getInvitation({ query: { id: invitation.id }, headers: invitee.headers })
    expect(byId.organizationName).toBe(org.name)
    expect(byId.role).toBe('admin')

    const accepted = await auth.acceptInvitation({ body: { invitationId: invitation.id }, headers: invitee.headers })
    expect(accepted?.invitation.status).toBe('accepted')
    expect(accepted?.member.role).toBe('admin')

    const members = await membersOf(org.id)
    expect(members.map((m) => String(m.user)).sort()).toEqual([owner.id, invitee.id].sort())
    const doc = await userDoc(payload, invitee)
    expect(tenantIds(doc)).toEqual([String(org.id)])
    expect(doc.tenants?.[0]?.role).toBe('admin')

    // Accepting activates the organization for the invitee.
    const session = await auth.getSession({ headers: invitee.headers })
    expect(String((session?.session as { activeOrganizationId?: string }).activeOrganizationId)).toBe(String(org.id))
  })

  it('only the invited email can accept, and an invitation is single-use', async () => {
    const owner = await signUp(payload)
    const org = await createOrganization(payload, owner)
    const invitee = await signUp(payload)
    const stranger = await signUp(payload)
    const { invitation } = await invite(owner, org.id, invitee.email)

    await expectApiError(auth.acceptInvitation({ body: { invitationId: invitation.id }, headers: stranger.headers }), /.*/)
    await auth.acceptInvitation({ body: { invitationId: invitation.id }, headers: invitee.headers })
    await expectApiError(auth.acceptInvitation({ body: { invitationId: invitation.id }, headers: invitee.headers }), /.*/)
    expect((await membersOf(org.id)).map((m) => String(m.user)).sort()).toEqual([owner.id, invitee.id].sort())
  })

  it('can be rejected by the invitee or cancelled by the inviter', async () => {
    const owner = await signUp(payload)
    const org = await createOrganization(payload, owner)
    const a = await signUp(payload)
    const b = await signUp(payload)
    const { invitation: forA } = await invite(owner, org.id, a.email)
    const { invitation: forB } = await invite(owner, org.id, b.email)

    const rejected = await auth.rejectInvitation({ body: { invitationId: forA.id }, headers: a.headers })
    expect(rejected?.invitation.status).toBe('rejected')
    const cancelled = await auth.cancelInvitation({ body: { invitationId: forB.id }, headers: owner.headers })
    expect(cancelled?.status).toBe('canceled')

    expect(await membersOf(org.id)).toHaveLength(1)
    expect(tenantIds(await userDoc(payload, a))).toEqual([])
  })

  it('re-inviting the same email cancels the earlier pending invitation', async () => {
    const owner = await signUp(payload)
    const org = await createOrganization(payload, owner)
    const email = `twice-${unique()}@example.test`
    const { invitation: first } = await invite(owner, org.id, email)
    const { invitation: second } = await invite(owner, org.id, email, 'admin')
    const list = await auth.listInvitations({ query: { organizationId: org.id }, headers: owner.headers })
    const byId = Object.fromEntries(list.map((i: { id: string; status: string }) => [i.id, i.status]))
    expect(byId[first.id]).toBe('canceled')
    expect(byId[second.id]).toBe('pending')
  })

  it('plain members cannot invite, admins and owners can', async () => {
    const owner = await signUp(payload)
    const org = await createOrganization(payload, owner)
    const member = await signUp(payload)
    const admin = await signUp(payload)
    await auth.acceptInvitation({ body: { invitationId: (await invite(owner, org.id, member.email, 'member')).invitation.id }, headers: member.headers })
    await auth.acceptInvitation({ body: { invitationId: (await invite(owner, org.id, admin.email, 'admin')).invitation.id }, headers: admin.headers })

    await expectApiError(
      auth.createInvitation({ body: { email: `x-${unique()}@example.test`, role: 'member', organizationId: org.id }, headers: member.headers }),
      /.*/,
    )
    const byAdmin = await auth.createInvitation({ body: { email: `y-${unique()}@example.test`, role: 'member', organizationId: org.id }, headers: admin.headers })
    expect(byAdmin.status).toBe('pending')

    const memberCan = await auth.hasPermission({ body: { organizationId: org.id, permissions: { invitation: ['create'] } }, headers: member.headers })
    expect(memberCan.success).toBe(false)
    const adminCan = await auth.hasPermission({ body: { organizationId: org.id, permissions: { invitation: ['create'] } }, headers: admin.headers })
    expect(adminCan.success).toBe(true)
  })
})

describe('membership changes', () => {
  async function orgWithMember() {
    const owner = await signUp(payload)
    const org = await createOrganization(payload, owner)
    const member = await signUp(payload)
    const { invitation } = await invite(owner, org.id, member.email)
    await auth.acceptInvitation({ body: { invitationId: invitation.id }, headers: member.headers })
    const memberRow = (await membersOf(org.id)).find((m) => String(m.user) === member.id)!
    return { owner, org, member, memberRow }
  }

  it('changing a role updates the member row and the mirrored tenants role', async () => {
    const { owner, org, member } = await orgWithMember()
    const members = await auth.listMembers({ query: { organizationId: org.id }, headers: owner.headers })
    const memberId = members.members.find((m: { userId: string }) => String(m.userId) === member.id)!.id
    await auth.updateMemberRole({ body: { memberId, role: 'admin', organizationId: org.id }, headers: owner.headers })
    expect((await membersOf(org.id)).find((m) => String(m.user) === member.id)!.role).toBe('admin')
    expect((await userDoc(payload, member)).tenants?.[0]?.role).toBe('admin')
  })

  it('members cannot change roles', async () => {
    const { owner, org, member } = await orgWithMember()
    const members = await auth.listMembers({ query: { organizationId: org.id }, headers: owner.headers })
    const ownerMemberId = members.members.find((m: { userId: string }) => String(m.userId) === owner.id)!.id
    await expectApiError(auth.updateMemberRole({ body: { memberId: ownerMemberId, role: 'member', organizationId: org.id }, headers: member.headers }), /.*/)
  })

  it('removing a member deletes the row and clears the tenant from the user', async () => {
    const { owner, org, member } = await orgWithMember()
    await auth.removeMember({ body: { memberIdOrEmail: member.email, organizationId: org.id }, headers: owner.headers })
    expect((await membersOf(org.id)).map((m) => String(m.user))).toEqual([owner.id])
    expect(tenantIds(await userDoc(payload, member))).toEqual([])
  })

  it('leaving an organization has the same effect; the last owner cannot leave', async () => {
    const { owner, org, member } = await orgWithMember()
    await auth.leaveOrganization({ body: { organizationId: org.id }, headers: member.headers })
    expect(tenantIds(await userDoc(payload, member))).toEqual([])
    await expectApiError(auth.leaveOrganization({ body: { organizationId: org.id }, headers: owner.headers }), /.*/)
    expect((await membersOf(org.id)).map((m) => String(m.user))).toEqual([owner.id])
  })

  it('getFullOrganization lists members with their users for members only', async () => {
    const { owner, org, member } = await orgWithMember()
    const full = await auth.getFullOrganization({ query: { organizationId: org.id }, headers: member.headers })
    expect(full?.members.map((m: { userId: string }) => String(m.userId)).sort()).toEqual([owner.id, member.id].sort())
    const outsider = await signUp(payload)
    await expectApiError(auth.getFullOrganization({ query: { organizationId: org.id }, headers: outsider.headers }), /.*/)
  })
})

describe('deleting an organization', () => {
  it('removes members, clears tenants and cascades to tenant-scoped documents', async () => {
    const owner = await signUp(payload)
    const org = await createOrganization(payload, owner)
    const member = await signUp(payload)
    const { invitation } = await invite(owner, org.id, member.email)
    await auth.acceptInvitation({ body: { invitationId: invitation.id }, headers: member.headers })

    const project = await payload.create({
      collection: 'projects',
      data: { name: 'Doomed', owner: toPayloadId(payload, owner.id), tenant: toPayloadId(payload, org.id) } as never,
      overrideAccess: true,
    })

    await auth.deleteOrganization({ body: { organizationId: org.id }, headers: owner.headers })

    expect(await membersOf(org.id)).toHaveLength(0)
    expect(tenantIds(await userDoc(payload, owner))).toEqual([])
    expect(tenantIds(await userDoc(payload, member))).toEqual([])
    const orgs = await payload.find({ collection: 'organizations', where: { id: { equals: toPayloadId(payload, org.id) } }, overrideAccess: true })
    expect(orgs.totalDocs).toBe(0)
    const projects = await payload.find({ collection: 'projects', where: { id: { equals: project.id } }, overrideAccess: true })
    expect(projects.totalDocs).toBe(0)
  })

  it('only owners may delete', async () => {
    const owner = await signUp(payload)
    const org = await createOrganization(payload, owner)
    const admin = await signUp(payload)
    const { invitation } = await invite(owner, org.id, admin.email, 'admin')
    await auth.acceptInvitation({ body: { invitationId: invitation.id }, headers: admin.headers })
    await expectApiError(auth.deleteOrganization({ body: { organizationId: org.id }, headers: admin.headers }), /.*/)
    const orgs = await payload.find({ collection: 'organizations', where: { id: { equals: toPayloadId(payload, org.id) } }, overrideAccess: true })
    expect(orgs.totalDocs).toBe(1)
  })
})

describe('updating an organization', () => {
  it('owners can rename; members cannot', async () => {
    const owner = await signUp(payload)
    const org = await createOrganization(payload, owner)
    const member = await signUp(payload)
    const { invitation } = await invite(owner, org.id, member.email)
    await auth.acceptInvitation({ body: { invitationId: invitation.id }, headers: member.headers })

    const renamed = await auth.updateOrganization({ body: { organizationId: org.id, data: { name: 'Renamed Org' } }, headers: owner.headers })
    expect(renamed?.name).toBe('Renamed Org')
    await expectApiError(auth.updateOrganization({ body: { organizationId: org.id, data: { name: 'Hijacked' } }, headers: member.headers }), /.*/)
    const doc = (await payload.findByID({ collection: 'organizations', id: toPayloadId(payload, org.id), depth: 0, overrideAccess: true })) as { name: string }
    expect(doc.name).toBe('Renamed Org')
  })
})
