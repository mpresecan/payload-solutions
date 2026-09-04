import type { CollectionConfig } from 'payload'

/**
 * Users. payload-auth generates the Better Auth fields (email, name, image, role, banned, ...),
 * the sessions/accounts joins and the auth strategy. Anything declared here is merged in, so this
 * is the place for your own profile fields.
 *
 * When organizations are enabled, the multi-tenant plugin adds a `tenants[]` array that mirrors
 * Better Auth memberships (see src/tenancy/sync-memberships.ts).
 */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'role', 'createdAt'],
  },
  fields: [
    {
      name: 'onboardedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        description: 'Set when the user completes onboarding.',
      },
    },
  ],
}
