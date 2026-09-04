// database-adapter-import
import { postgresAdapter } from '@payloadcms/db-postgres'
import { resendAdapter } from '@payloadcms/email-resend'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig, type Field, type Plugin } from 'payload'
import { betterAuthPlugin, type PayloadAuthOptions } from 'payload-auth/better-auth'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { isAdmin } from '@/access'
import { LegalPages } from '@/collections/LegalPages'
import { Media } from '@/collections/Media'
import { Organizations } from '@/collections/Organizations'
import { Projects } from '@/collections/Projects'
import { Users } from '@/collections/Users'
import { ADMIN_ROLES, ROLES, betterAuthOptions } from '@/lib/auth/options'
import { env } from '@/lib/env'
import { seedLegalPages } from '@/seed/legal'
import stack from '@/stack.config'
import { withMembershipSync } from '@/tenancy/sync-memberships'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Better Auth via payload-auth. Exported so `payload.betterAuth` can be typed from these options
 * (see src/lib/payload.ts).
 */
export const payloadAuthOptions = {
  users: {
    roles: [...ROLES],
    adminRoles: [...ADMIN_ROLES],
    defaultRole: 'user',
    defaultAdminRole: 'admin',
    allowedFields: ['name', 'image', 'onboardedAt'],
  },
  collectionAdminGroup: 'Auth',
  hidePluginCollections: false,
  betterAuthOptions,
  adminInvitations: {
    sendInviteEmail: async ({ payload, email, url }) => {
      const { emails } = await import('@/emails')
      await emails.adminInvite(payload, email, url)
      return { success: true }
    },
    // payload-auth 3.0.0 creates the first-admin invitation without `expiresAt` although the field
    // is required, which breaks the /admin bootstrap. Default it to 7 days. Remove once fixed upstream.
    collectionOverrides: ({ collection }) => ({
      ...collection,
      fields: collection.fields.map((field): Field => {
        if (field.type === 'date' && field.name === 'expiresAt') {
          return { ...field, defaultValue: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() }
        }
        return field
      }),
    }),
  },
  pluginCollectionOverrides: stack.features.organizations
    ? {
        members: withMembershipSync,
        organizations: ({ collection }) => ({
          ...collection,
          admin: { ...collection.admin, group: 'App' },
          access: {
            ...collection.access,
            // payload-auth makes organizations admin-only. Members must be able to read their own
            // organizations (the multi-tenant plugin narrows this to `id in user.tenants`), otherwise
            // the admin's tenant selector throws for any non-admin visitor.
            read: ({ req }) => Boolean(req.user),
          },
        }),
      }
    : undefined,
} satisfies PayloadAuthOptions

const plugins: Plugin[] = [
  // 1. Better Auth first: it creates users, sessions, accounts, organizations, members, subscriptions.
  betterAuthPlugin(payloadAuthOptions),
]

if (stack.features.organizations) {
  // 2. Then the multi-tenant plugin, pointed at the Better Auth organizations collection.
  plugins.push(
    multiTenantPlugin({
      tenantsSlug: 'organizations',
      collections: {
        projects: {},
        media: {},
      },
      userHasAccessToAllTenants: (user) => isAdmin(user),
      tenantsArrayField: {
        includeDefaultField: true,
        arrayFieldName: 'tenants',
        arrayTenantFieldName: 'tenant',
        rowFields: [
          {
            name: 'role',
            type: 'text',
            admin: { readOnly: true, description: 'Mirrors the Better Auth membership role.' },
          },
        ],
        // Memberships are managed by Better Auth; the array is derived (see src/tenancy).
        arrayFieldAccess: {
          create: ({ req }) => isAdmin(req.user),
          update: ({ req }) => isAdmin(req.user),
        },
      },
      useTenantsCollectionAccess: true,
      cleanupAfterTenantDelete: true,
    }),
  )
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: {
      titleSuffix: ` | ${stack.name}`,
    },
  },
  collections: [Users, ...(stack.features.organizations ? [Organizations] : []), Projects, Media, LegalPages],
  editor: lexicalEditor(),
  secret: env.PAYLOAD_SECRET,
  serverURL: stack.url,
  cors: [stack.url],
  csrf: [stack.url],
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  // database-adapter-config-start
  db: postgresAdapter({
    pool: {
      connectionString: env.DATABASE_URL,
    },
  }),
  // database-adapter-config-end
  email: env.RESEND_API_KEY
    ? resendAdapter({
        apiKey: env.RESEND_API_KEY,
        defaultFromAddress: env.EMAIL_FROM,
        defaultFromName: env.EMAIL_FROM_NAME ?? stack.name,
      })
    : undefined,
  sharp,
  plugins,
  onInit: async (payload) => {
    await seedLegalPages(payload)
  },
})
