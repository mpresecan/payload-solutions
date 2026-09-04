import type { CollectionConfig } from 'payload'

import { adminOrOwner, authenticated } from '@/access'
import stack from '@/stack.config'

/**
 * An example of a tenant-scoped collection. Rename or delete it; it exists to show the pattern.
 *
 * With organizations enabled, the multi-tenant plugin adds a required `tenant` relationship to
 * `organizations` and scopes every read/write to the organizations the user belongs to. Without
 * organizations, documents are scoped to their owner.
 */
export const Projects: CollectionConfig = {
  slug: 'projects',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'status', 'owner', 'updatedAt'],
    group: 'App',
  },
  access: stack.features.organizations
    ? {
        // The multi-tenant plugin combines these with the tenant constraint.
        read: authenticated,
        create: authenticated,
        update: authenticated,
        delete: authenticated,
      }
    : {
        read: adminOrOwner(),
        create: authenticated,
        update: adminOrOwner(),
        delete: adminOrOwner(),
      },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Paused', value: 'paused' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: { position: 'sidebar' },
      hooks: {
        beforeChange: [
          ({ req, value, operation }) => {
            if (operation === 'create' && !value && req.user) return req.user.id
            return value
          },
        ],
      },
    },
  ],
  timestamps: true,
}
