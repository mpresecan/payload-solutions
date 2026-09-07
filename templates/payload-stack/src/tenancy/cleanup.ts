import type { CollectionBeforeDeleteHook, CollectionConfig } from 'payload'

/**
 * Deletes an organization's tenant-scoped documents before the organization row goes.
 *
 * The multi-tenant plugin cleans up in an `afterDelete` hook, but on SQL databases the
 * `tenant` relationship is a foreign key with ON DELETE SET NULL: by the time that hook runs the
 * documents no longer point at the tenant and survive as orphans (`tenant: null`). Running the
 * same cleanup in `beforeDelete`, inside the same transaction, removes them while the reference
 * still exists. Better Auth's `deleteOrganization` removes members and invitations first, so
 * `users.tenants` is already in sync when this runs (see sync-memberships.ts).
 */
export const TENANT_SCOPED_COLLECTIONS = ['projects', 'media'] as const

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
