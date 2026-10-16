import type { CollectionBeforeDeleteHook, CollectionConfig, CollectionSlug, PayloadRequest, Where } from 'payload'

/**
 * Deletes everything that points at an organization before the organization row goes.
 *
 * Tenant-scoped documents: the multi-tenant plugin cleans up in an `afterDelete` hook, but on SQL
 * databases the `tenant` relationship is a foreign key with ON DELETE SET NULL: by the time that
 * hook runs the documents no longer point at the tenant and survive as orphans (`tenant: null`).
 * Running the same cleanup in `beforeDelete`, inside the same transaction, removes them while the
 * reference still exists.
 *
 * Organization records (invitations, team members, teams, members): Better Auth's
 * `deleteOrganization` removes these itself before it deletes the row. Deleting an organization any
 * other way (the Payload admin, the REST API, the local API) does not, and their `organization`
 * column is required, so SET NULL fails with a NOT NULL violation and the delete is rolled back.
 * Removing them here makes every path behave like Better Auth's. Members go through the local API,
 * so the hooks in sync-memberships.ts still rebuild each user's `tenants`.
 */
export const TENANT_SCOPED_COLLECTIONS = ['projects', 'media'] as const

/** payload-auth's default slugs; the ones not enabled (teams) are skipped. Children first. */
const ORGANIZATION_RECORDS: { slug: string; where: (id: string | number, teamIds: (string | number)[]) => Where }[] = [
  { slug: 'invitations', where: (id) => ({ organization: { equals: id } }) },
  { slug: 'teamMembers', where: (_id, teamIds) => ({ team: { in: teamIds } }) },
  { slug: 'teams', where: (id) => ({ organization: { equals: id } }) },
  { slug: 'members', where: (id) => ({ organization: { equals: id } }) },
]

/** Whether a collection is registered (teams only exist with `stack.features.teams`). */
const has = (req: PayloadRequest, slug: string) => Boolean(req.payload.collections?.[slug as CollectionSlug])

async function teamIdsOf(req: PayloadRequest, id: string | number) {
  if (!has(req, 'teams')) return []
  const teams = await req.payload.find({
    collection: 'teams' as CollectionSlug,
    where: { organization: { equals: id } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req,
  })
  return teams.docs.map((t) => t.id)
}

const beforeTenantDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  for (const slug of TENANT_SCOPED_COLLECTIONS) {
    await req.payload.delete({
      collection: slug,
      where: { tenant: { equals: id } },
      depth: 0,
      overrideAccess: true,
      req,
    })
  }

  const teamIds = await teamIdsOf(req, id)
  for (const { slug, where } of ORGANIZATION_RECORDS) {
    if (!has(req, slug)) continue
    if (slug === 'teamMembers' && teamIds.length === 0) continue
    await req.payload.delete({
      collection: slug as CollectionSlug,
      where: where(id, teamIds),
      depth: 0,
      overrideAccess: true,
      req,
    })
  }
}

/** Passed to payload-auth's `pluginCollectionOverrides.organizations`. */
export function withTenantCleanup(collection: CollectionConfig): CollectionConfig {
  return {
    ...collection,
    hooks: {
      ...collection.hooks,
      beforeDelete: [...(collection.hooks?.beforeDelete ?? []), beforeTenantDelete],
    },
  }
}
