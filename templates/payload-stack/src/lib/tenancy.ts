import 'server-only'

import type { Where } from 'payload'

import { getSession } from '@/lib/auth/session'
import { toPayloadId } from '@/lib/ids'
import { getPayloadClient } from '@/lib/payload'
import stack from '@/stack.config'

/**
 * Helpers for tenant-scoped data access from server code.
 *
 * With organizations enabled, the active organization comes from the Better Auth session
 * (`session.activeOrganizationId`). Documents are scoped by the `tenant` field the multi-tenant
 * plugin adds. Without organizations, scoping falls back to the `owner` field.
 */

export async function getActiveOrganizationId(): Promise<string | number | null> {
  if (!stack.features.organizations) return null
  const session = await getSession()
  const id = (session?.session as { activeOrganizationId?: string | null } | undefined)?.activeOrganizationId
  if (!id) return null
  const payload = await getPayloadClient()
  return toPayloadId(payload, id)
}

/** The current user's id in the form Payload expects. */
export async function getCurrentUserId(): Promise<string | number | null> {
  const session = await getSession()
  if (!session) return null
  const payload = await getPayloadClient()
  return toPayloadId(payload, session.user.id)
}

/** The active organization document, or null. */
export async function getActiveOrganization() {
  const id = await getActiveOrganizationId()
  if (!id) return null
  const payload = await getPayloadClient()
  try {
    return await payload.findByID({ collection: 'organizations', id, depth: 0, overrideAccess: true })
  } catch {
    return null
  }
}

/** Organizations the current user belongs to. */
export async function listUserOrganizations() {
  if (!stack.features.organizations) return []
  const session = await getSession()
  if (!session) return []
  const payload = await getPayloadClient()
  const memberships = await payload.find({
    collection: 'members',
    where: { user: { equals: toPayloadId(payload, session.user.id) } },
    depth: 1,
    limit: 100,
    overrideAccess: true,
  })
  return memberships.docs
    .map((m) => (typeof m.organization === 'object' ? m.organization : null))
    .filter((o): o is NonNullable<typeof o> => o !== null)
}

/**
 * A `where` clause that limits a tenant-enabled collection to the active organization (or, without
 * organizations, to documents the user owns). Combine with your own filters using `and`.
 */
export async function tenantScope(): Promise<Where> {
  const userId = await getCurrentUserId()
  if (!userId) return { id: { exists: false } }
  if (stack.features.organizations) {
    const orgId = await getActiveOrganizationId()
    if (!orgId) return { id: { exists: false } }
    return { tenant: { equals: orgId } }
  }
  return { owner: { equals: userId } }
}

/** Data to spread into `payload.create` so a new document lands in the active tenant. */
export async function tenantData(): Promise<Record<string, unknown>> {
  const userId = await getCurrentUserId()
  const data: Record<string, unknown> = { owner: userId }
  if (stack.features.organizations) {
    const orgId = await getActiveOrganizationId()
    if (orgId) data.tenant = orgId
  }
  return data
}
