// database-adapter-import
import { postgresAdapter } from '@payloadcms/db-postgres'
import { resendAdapter } from '@payloadcms/email-resend'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { sentryPlugin } from '@payloadcms/plugin-sentry'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import * as Sentry from '@sentry/nextjs'
// storage-adapter-import
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
import { silenceKnownPayloadAuthWarnings } from '@/lib/auth/payload-auth-workarounds'
import { env, sentryReady } from '@/lib/env'
import { seedLegalPages } from '@/seed/legal'
import stack from '@/stack.config'
import { TENANT_SCOPED_COLLECTIONS, withTenantCleanup } from '@/tenancy/cleanup'
import { withMembershipSync } from '@/tenancy/sync-memberships'
import { validateTenantMembership } from '@/tenancy/validate-tenant'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// payload-auth 3.0.0 logs a harmless adapter error on every session lookup; see the module for details.
silenceKnownPayloadAuthWarnings()

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
          return {
            ...field,
            defaultValue: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          }
        }
        return field
      }),
    }),
  },
  pluginCollectionOverrides: stack.features.organizations
    ? {
        members: withMembershipSync,
        organizations: ({ collection }) =>
          withTenantCleanup({
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
      // Keep in step with TENANT_SCOPED_COLLECTIONS (src/tenancy/cleanup.ts).
      collections: Object.fromEntries(TENANT_SCOPED_COLLECTIONS.map((slug) => [slug, {}])),
      userHasAccessToAllTenants: (user) => isAdmin(user),
      // API callers may only file documents under organizations they belong to (admins: any).
      tenantField: { validate: validateTenantMembership },
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

// 3. Error monitoring. The official Payload plugin reports admin and API failures (500s by
// default) through the same SDK instance the rest of the app uses, so Payload's errors and the
// app's arrive in one project with one trail of breadcrumbs. Skipped entirely without a DSN.
if (sentryReady) {
  plugins.push(
    sentryPlugin({
      Sentry,
      options: {
        // 404s and permission denials are normal traffic, not incidents: 500s only by default.
        // Add codes here (e.g. [401, 403]) if you want them tracked.
        captureErrors: [],
        context: ({ defaultContext }) => ({
          ...defaultContext,
          tags: { ...defaultContext.tags, source: 'payload' },
        }),
      },
    }),
  )
}

// 4. Media storage (the CLI writes your choice here; keep the markers so it can be swapped again).
// storage-adapter-config-start
// Local disk (./media): fine for development, lost on redeploy on Vercel and other ephemeral hosts.
// Move uploads to Vercel Blob, S3, R2, Azure, GCS or Uploadthing: https://payload.solutions/docs/payload-stack/storage
// storage-adapter-config-end

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: {
      titleSuffix: ` | ${stack.name}`,
    },
  },
  collections: [
    Users,
    ...(stack.features.organizations ? [Organizations] : []),
    Projects,
    Media,
    LegalPages,
  ],
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
