/**
 * src/payload.config.ts and src/collections/*: the Payload configuration built under each preset.
 * `buildConfig` sanitises the config without connecting to the database, so this checks which
 * collections and plugins exist per option, plugin order, the multi-tenant wiring, access rules
 * and the email adapter choice. Database-backed behaviour lives in tests/int.
 */
import type { Field, SanitizedConfig } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { defineStack, type StackInput } from '@/lib/stack'
import { base, presetEntries, presets, socialEnv } from '../helpers/stack-fixtures'
import { loadWithEnv, loadWithStack } from '../helpers/with-stack'

async function buildFor(input: StackInput, env: Record<string, string | undefined> = {}): Promise<SanitizedConfig> {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const mod = await loadWithEnv({ ...socialEnv(input), ...env }, () => loadWithStack(input, () => import('@/payload.config')))
  return mod.default
}

const slugs = (config: SanitizedConfig): string[] => config.collections.map((c) => c.slug as string)
const collection = (config: SanitizedConfig, slug: string) => config.collections.find((c) => (c.slug as string) === slug)!
/**
 * Rows, collapsibles and tabs are layout, not data: flatten them so a field lookup does not depend
 * on how a collection happens to be arranged in the admin. Named containers (groups, arrays) are
 * left alone, because their own name is the thing being asserted.
 */
const flatFields = (fields: Field[]): Field[] =>
  fields.flatMap((f) =>
    f.type === 'row' || f.type === 'collapsible'
      ? flatFields(f.fields)
      : f.type === 'tabs'
        ? flatFields(f.tabs.flatMap((t) => t.fields))
        : [f],
  )
const fieldNames = (c: { fields: Field[] }) => flatFields(c.fields).map((f) => ('name' in f ? f.name : f.type))

describe('collections per preset', () => {
  it.each(presetEntries)('preset %s: collection set follows organizations', async (_name, input) => {
    const stack = defineStack(input)
    const config = await buildFor(input)
    const list = slugs(config)

    // Better Auth core collections, always.
    for (const slug of ['users', 'sessions', 'accounts', 'verifications', 'projects', 'media', 'legal-pages']) expect(list).toContain(slug)
    // Organization plugin collections only with organizations.
    for (const slug of ['organizations', 'members', 'invitations']) expect(list.includes(slug)).toBe(stack.features.organizations)
    expect(list.includes('teams')).toBe(stack.features.teams)
    // Two-factor and passkey storage follow their methods.
    expect(list.includes('twoFactors')).toBe(stack.features.twoFactor)
    expect(list.includes('passkeys')).toBe(stack.features.passkeys)
    expect(list).toContain('apiKeys')
    // Subscriptions exist only when the Stripe plugin is actually registered (keys present).
    expect(list.includes('subscriptions')).toBe(false)
  })

  it('adds the subscriptions collection once Stripe keys are present', async () => {
    const config = await buildFor(presets['billing-org'], { STRIPE_SECRET_KEY: 'sk_test_1', STRIPE_WEBHOOK_SECRET: 'whsec_1' })
    expect(slugs(config)).toContain('subscriptions')
  })
})

describe('users', () => {
  it('is the admin user collection with Better Auth fields merged around onboardedAt', async () => {
    const config = await buildFor(base)
    expect(config.admin.user).toBe('users')
    const users = collection(config, 'users')
    const names = fieldNames(users)
    for (const name of ['email', 'name', 'image', 'role', 'banned', 'onboardedAt']) expect(names).toContain(name)
    expect(users.admin.useAsTitle).toBe('email')
  })

  it('gets the tenants array from the multi-tenant plugin only with organizations', async () => {
    const withOrgs = collection(await buildFor(base), 'users')
    const tenants = withOrgs.fields.find((f) => 'name' in f && f.name === 'tenants') as Extract<Field, { type: 'array' }> | undefined
    expect(tenants?.type).toBe('array')
    const rowFields = tenants!.fields.map((f) => ('name' in f ? f.name : f.type))
    expect(rowFields).toEqual(expect.arrayContaining(['tenant', 'role']))

    const without = collection(await buildFor(presets['orgs-off']), 'users')
    expect(fieldNames(without)).not.toContain('tenants')
  })
})

describe('organizations and members', () => {
  it('members carry the membership sync hooks', async () => {
    const config = await buildFor(base)
    const members = collection(config, 'members')
    expect(members.hooks.afterChange.length).toBeGreaterThanOrEqual(1)
    expect(members.hooks.afterDelete.length).toBeGreaterThanOrEqual(1)
  })

  it('organizations delete their tenant-scoped documents before the row goes (src/tenancy/cleanup.ts)', async () => {
    const config = await buildFor(base)
    const organizations = collection(config, 'organizations')
    expect(organizations.hooks.beforeDelete.length).toBeGreaterThanOrEqual(1)
  })

  it('organizations are readable by any signed-in user (the tenant selector needs it) and grouped under App', async () => {
    const config = await buildFor(base)
    const organizations = collection(config, 'organizations')
    expect(organizations.admin.group).toBe('App')
    const read = organizations.access.read as (args: { req: { user: unknown } }) => unknown
    expect(await read({ req: { user: { id: 1 } } })).toBe(true)
    expect(await read({ req: { user: null } })).toBe(false)
    expect(fieldNames(organizations)).toEqual(expect.arrayContaining(['name', 'slug', 'logo', 'onboardedAt']))
  })
})

describe('projects (the tenant-scoped example)', () => {
  it('gets a tenant relationship with organizations and stays owner-scoped without', async () => {
    const withOrgs = collection(await buildFor(base), 'projects')
    const tenant = withOrgs.fields.find((f) => 'name' in f && f.name === 'tenant') as Extract<Field, { type: 'relationship' }> | undefined
    expect(tenant?.type).toBe('relationship')
    expect(tenant?.relationTo).toBe('organizations')

    const without = collection(await buildFor(presets['orgs-off']), 'projects')
    expect(fieldNames(without)).not.toContain('tenant')
  })

  it('declares name, status with three options defaulting to active, and a required owner', async () => {
    const projects = collection(await buildFor(base), 'projects')
    const status = projects.fields.find((f) => 'name' in f && f.name === 'status') as Extract<Field, { type: 'select' }>
    expect(status.defaultValue).toBe('active')
    expect(status.options.map((o) => (typeof o === 'string' ? o : o.value))).toEqual(['active', 'paused', 'archived'])
    const owner = projects.fields.find((f) => 'name' in f && f.name === 'owner') as Extract<Field, { type: 'relationship' }>
    expect(owner.relationTo).toBe('users')
    expect(owner.required).toBe(true)
    const name = projects.fields.find((f) => 'name' in f && f.name === 'name') as Extract<Field, { type: 'text' }>
    expect(name.required).toBe(true)
  })

  it('fills owner from the request user on create only', async () => {
    const { Projects } = await import('@/collections/Projects')
    const owner = Projects.fields.find((f) => 'name' in f && f.name === 'owner') as Extract<Field, { type: 'relationship' }>
    const hook = owner.hooks!.beforeChange![0]!
    const run = (operation: 'create' | 'update', value: unknown, user: unknown) =>
      hook({ req: { user }, value, operation, data: {}, siblingData: {}, field: owner, collection: Projects } as never)
    expect(await run('create', undefined, { id: 5 })).toBe(5)
    expect(await run('create', 3, { id: 5 })).toBe(3)
    expect(await run('update', undefined, { id: 5 })).toBeUndefined()
    expect(await run('create', undefined, null)).toBeUndefined()
  })

  it('uses authenticated access with organizations (the plugin adds the tenant constraint)', async () => {
    const { Projects } = await loadWithStack(presets.defaults, () => import('@/collections/Projects'))
    const access = Projects.access as Record<string, (args: { req: { user: unknown } }) => unknown>
    for (const op of ['read', 'create', 'update', 'delete']) {
      expect(access[op]!({ req: { user: { id: 1 } } })).toBe(true)
      expect(access[op]!({ req: { user: null } })).toBe(false)
    }
  })

  it('uses owner access without organizations', async () => {
    const { Projects } = await loadWithStack(presets['orgs-off'], () => import('@/collections/Projects'))
    const access = Projects.access as Record<string, (args: { req: { user: unknown } }) => unknown>
    const user = { id: 1, role: ['user'] }
    expect(access.read!({ req: { user } })).toEqual({ owner: { equals: 1 } })
    expect(access.update!({ req: { user } })).toEqual({ owner: { equals: 1 } })
    expect(access.delete!({ req: { user } })).toEqual({ owner: { equals: 1 } })
    expect(access.create!({ req: { user } })).toBe(true)
    expect(access.read!({ req: { user: { id: 2, role: ['admin'] } } })).toBe(true)
    expect(access.read!({ req: { user: null } })).toBe(false)
  })
})

describe('media and legal pages', () => {
  it('media: public read, authenticated write, admin delete, images only, two sizes', async () => {
    const media = collection(await buildFor(base), 'media')
    const access = media.access as unknown as Record<string, (args: { req: { user: unknown } }) => unknown>
    expect(await access.read!({ req: { user: null } })).toBe(true)
    expect(await access.create!({ req: { user: null } })).toBe(false)
    expect(await access.create!({ req: { user: { id: 1, role: ['user'] } } })).toBe(true)
    expect(await access.delete!({ req: { user: { id: 1, role: ['user'] } } })).toBe(false)
    expect(await access.delete!({ req: { user: { id: 1, role: ['admin'] } } })).toBe(true)
    const upload = media.upload as { mimeTypes?: string[]; imageSizes?: Array<{ name: string }> }
    expect(upload.mimeTypes).toEqual(['image/*'])
    expect(upload.imageSizes?.map((s) => s.name)).toEqual(['thumbnail', 'card'])
    // Media is tenant-scoped too.
    expect(fieldNames(media)).toContain('tenant')
  })

  it('legal pages: public read, admin-only writes, drafts, unique slug', async () => {
    const legal = collection(await buildFor(base), 'legal-pages')
    const access = legal.access as unknown as Record<string, (args: { req: { user: unknown } }) => unknown>
    expect(await access.read!({ req: { user: null } })).toBe(true)
    for (const op of ['create', 'update', 'delete']) {
      expect(await access[op]!({ req: { user: { id: 1, role: ['user'] } } })).toBe(false)
      expect(await access[op]!({ req: { user: { id: 1, role: ['admin'] } } })).toBe(true)
    }
    expect(legal.versions?.drafts).toBeTruthy()
    const slug = flatFields(legal.fields).find((f) => 'name' in f && f.name === 'slug') as Extract<Field, { type: 'text' }>
    expect(slug.unique).toBe(true)
    expect(slug.required).toBe(true)
    expect(fieldNames(legal)).toEqual(expect.arrayContaining(['title', 'slug', 'effectiveDate', 'showInFooter', 'content']))
    // Not tenant-scoped: legal pages are global content.
    expect(fieldNames(legal)).not.toContain('tenant')
  })
})

describe('global settings', () => {
  it('derives serverURL, CORS, CSRF and the admin title suffix from stack.config.ts', async () => {
    const config = await buildFor({ ...base, name: 'Ridgeline', url: 'https://app.ridgeline.test' })
    expect(config.serverURL).toBe('https://app.ridgeline.test')
    expect(config.cors).toEqual(['https://app.ridgeline.test'])
    expect(config.csrf).toContain('https://app.ridgeline.test')
    expect(config.csrf).not.toContain('http://localhost:3000')
    expect(config.admin.meta?.titleSuffix).toBe(' | Ridgeline')
  })

  it('takes the secret from PAYLOAD_SECRET', async () => {
    const config = await buildFor(base, { PAYLOAD_SECRET: 'unit-secret' })
    expect(config.secret).toBe('unit-secret')
  })

  it('uses Resend only when RESEND_API_KEY is set', async () => {
    const without = await buildFor(base, { RESEND_API_KEY: undefined })
    expect(without.email).toBeUndefined()
    const withKey = await buildFor(base, { RESEND_API_KEY: 're_test_1', EMAIL_FROM: 'hello@ridgeline.test', EMAIL_FROM_NAME: undefined })
    // Email adapters are factories that Payload calls with the instance at init.
    const factory = withKey.email as unknown as (args: { payload: unknown }) => { name: string; defaultFromAddress: string; defaultFromName: string }
    const adapter = factory({ payload: { logger: console } })
    expect(adapter.name).toMatch(/resend/i)
    expect(adapter.defaultFromAddress).toBe('hello@ridgeline.test')
    // The from name falls back to the product name.
    expect(adapter.defaultFromName).toBe('Test App')

    const named = await buildFor(base, { RESEND_API_KEY: 're_test_1', EMAIL_FROM_NAME: 'Ridgeline Team' })
    expect((named.email as unknown as typeof factory)({ payload: { logger: console } }).defaultFromName).toBe('Ridgeline Team')
  })

  it('attaches a Better Auth instance to Payload through the plugin', async () => {
    const config = await buildFor(base)
    expect(config.plugins.length).toBeGreaterThanOrEqual(1)
    expect(typeof config.onInit).toBe('function')
  })
})

describe('multi-tenant wiring', () => {
  it('registers the tenant selector in the admin and filters tenant-enabled collections', async () => {
    const config = await buildFor(base)
    const providers = (config.admin.components?.providers ?? []) as Array<{ path: string; clientProps?: Record<string, unknown> }>
    const selector = providers.find((p) => p.path.includes('TenantSelectionProvider'))
    expect(selector?.clientProps).toMatchObject({
      tenantsArrayFieldName: 'tenants',
      tenantsArrayTenantFieldName: 'tenant',
      tenantsCollectionSlug: 'organizations',
      useAsTitle: 'name',
    })
    // Every tenant-enabled collection gets the plugin's list filter and edit-menu trigger.
    const { validateTenantMembership } = await import('@/tenancy/validate-tenant')
    for (const slug of ['projects', 'media']) {
      const c = collection(config, slug)
      expect(c.admin.baseFilter).toBeTypeOf('function')
      expect(JSON.stringify(c.admin.components)).toContain('plugin-multi-tenant')
      const tenantField = c.fields.find((f) => 'name' in f && f.name === 'tenant') as Extract<Field, { type: 'relationship' }>
      expect(tenantField.relationTo).toBe('organizations')
      // The membership validator wraps the plugin's required check (src/tenancy/validate-tenant.ts).
      const validate = tenantField.validate as (value: unknown, opts: unknown) => Promise<true | string> | true | string
      const outsider = { id: 1, role: ['user'], tenants: [] }
      expect(await validate(5, { req: { user: outsider, t: (k: string) => k }, hasMany: false })).toBe('You are not a member of this organization.')
      expect(await validate(5, { req: { user: { id: 1, role: ['user'], tenants: [{ tenant: 5 }] }, t: (k: string) => k }, hasMany: false })).toBe(true)
      expect(validateTenantMembership).toBeTypeOf('function')
    }
    // Global content is left alone.
    expect(collection(config, 'legal-pages').admin.baseFilter).toBeUndefined()

    // No selector without organizations.
    const without = await buildFor(presets['orgs-off'])
    const withoutProviders = (without.admin.components?.providers ?? []) as Array<{ path: string }>
    expect(withoutProviders.some((p) => p.path.includes('TenantSelectionProvider'))).toBe(false)
  })

  it('makes the tenants array read-only for non-admins', async () => {
    const config = await buildFor(base)
    const users = collection(config, 'users')
    const tenants = users.fields.find((f) => 'name' in f && f.name === 'tenants') as Extract<Field, { type: 'array' }>
    const access = tenants.access as unknown as Record<string, (args: { req: { user: unknown } }) => unknown>
    expect(await access.create!({ req: { user: { id: 1, role: ['user'] } } })).toBe(false)
    expect(await access.update!({ req: { user: { id: 1, role: ['admin'] } } })).toBe(true)
  })
})
