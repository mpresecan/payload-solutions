import { getUserTenantIDs } from '@payloadcms/plugin-multi-tenant/utilities'
import type { RelationshipFieldSingleValidation } from 'payload'

import { isAdmin } from '@/access'

/**
 * Server-side check that a document's `tenant` is an organization the acting user belongs to.
 *
 * The multi-tenant plugin narrows the admin UI's tenant picker with `filterOptions`, but it
 * replaces the field's validator with a plain "required" check, so nothing stops an API caller
 * from posting `tenant: <someone else's organization>` with their own session. This validator is
 * passed to the plugin as `tenantField.validate` and therefore guards every tenant-enabled
 * collection (see TENANT_SCOPED_COLLECTIONS in ./cleanup.ts). Site admins may assign any tenant.
 */
export const validateTenantMembership: RelationshipFieldSingleValidation = (value, { req }) => {
  if (value === null || value === undefined) return true // required-ness is the plugin's job
  if (!req.user) return true // anonymous writes are already refused by collection access
  if (isAdmin(req.user)) return true

  const requested = typeof value === 'object' && value !== null ? (value as { value?: unknown; id?: unknown }).value ?? (value as { id?: unknown }).id : value
  const allowed = getUserTenantIDs(req.user as Parameters<typeof getUserTenantIDs>[0]).map(String)
  return allowed.includes(String(requested)) || 'You are not a member of this organization.'
}
