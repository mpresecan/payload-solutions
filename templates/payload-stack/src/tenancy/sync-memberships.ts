import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, CollectionConfig, Payload, PayloadRequest } from 'payload'

/**
 * Bridge between Better Auth organizations and Payload's multi-tenant plugin.
 *
 * Better Auth stores who belongs to which organization in the `members` collection. The multi-tenant
 * plugin expects that information as a `tenants[]` array on the user document. These hooks keep the
 * array in sync whenever a membership is created, updated or removed, so:
 *   - the Payload admin shows a tenant selector and scopes every tenant-enabled collection
 *   - `getUserTenantIDs(req.user)` works for API and local-API requests
 *
 * Better Auth remains the single source of truth; the array is derived data. Direction is one way,
 * so edit memberships through the app (or the `members` collection), not the array.
 */

type MemberDoc = {
  id: string | number
  user: string | number | { id: string | number }
  organization: string | number | { id: string | number }
  role?: string | null
}

type TenantRow = { tenant: string | number | { id: string | number }; role?: string | null; id?: string | null }

const idOf = (v: string | number | { id: string | number }) => (typeof v === 'object' ? v.id : v)

async function rebuildUserTenants(payload: Payload, req: PayloadRequest, userId: string | number) {
  // `req` is passed so both operations join the transaction Better Auth's adapter opened;
  // without it they wait on locks held by that transaction and time out.
  const memberships = await payload.find({
    collection: 'members',
    where: { user: { equals: userId } },
    depth: 0,
    limit: 500,
    pagination: false,
    overrideAccess: true,
    req,
  })

  const tenants: TenantRow[] = memberships.docs.map((m) => {
    const member = m as unknown as MemberDoc
    return { tenant: idOf(member.organization), role: member.role ?? 'member' }
  })

  await payload.update({
    collection: 'users',
    id: userId,
    data: { tenants } as never,
    depth: 0,
    overrideAccess: true,
    context: { skipTenantSync: true },
    req,
  })
}

const afterMemberChange: CollectionAfterChangeHook = async ({ doc, req }) => {
  const member = doc as unknown as MemberDoc
  try {
    await rebuildUserTenants(req.payload, req, idOf(member.user))
  } catch (error) {
    req.payload.logger.error({ err: error, msg: 'Failed to sync membership to users.tenants' })
  }
  return doc
}

const afterMemberDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const member = doc as unknown as MemberDoc
  try {
    await rebuildUserTenants(req.payload, req, idOf(member.user))
  } catch (error) {
    req.payload.logger.error({ err: error, msg: 'Failed to remove membership from users.tenants' })
  }
  return doc
}

/** Passed to payload-auth's `pluginCollectionOverrides.members`. */
export function withMembershipSync({ collection }: { collection: CollectionConfig }): CollectionConfig {
  return {
    ...collection,
    hooks: {
      ...collection.hooks,
      afterChange: [...(collection.hooks?.afterChange ?? []), afterMemberChange],
      afterDelete: [...(collection.hooks?.afterDelete ?? []), afterMemberDelete],
    },
  }
}
