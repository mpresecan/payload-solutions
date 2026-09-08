import type { CollectionConfig } from 'payload'

import { onUserCreated, onUserEmailChanged } from '@/emails/hooks'

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
  hooks: {
    /**
     * Account-lifecycle emails. Better Auth has no callback for "a user now exists" or "the address
     * on this account changed", but Payload does — every route into the database passes through
     * here, including the admin panel and the local API.
     *
     * Both calls are no-ops unless the emails plugin is installed (src/emails/hooks.ts), and neither
     * throws: a failed notice must not undo the write that triggered it.
     */
    afterChange: [
      async ({ doc, operation, previousDoc, req }) => {
        if (operation === 'create') {
          await onUserCreated({ id: doc.id }, req.payload)
          return
        }
        const previousEmail = (previousDoc as { email?: string } | undefined)?.email
        const newEmail = (doc as { email?: string }).email
        if (previousEmail && newEmail && previousEmail !== newEmail) {
          await onUserEmailChanged({ newEmail, previousEmail }, req.payload)
        }
      },
    ],
  },
}
