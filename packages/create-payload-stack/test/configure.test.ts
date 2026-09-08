/**
 * src/configure.ts: the pure transformations that turn the template into a project.
 *
 * The rendered stack.config.ts is not only string-matched: every combination of the CLI's
 * choices is evaluated with the template's own `defineStack`, so a rendering that the app would
 * reject at boot fails here first. Database and storage swaps are checked for every adapter and
 * for repeatability (swapping twice must be a no-op).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  renameProject,
  renderEnv,
  renderStackConfig,
  storageChoice,
  swapDatabaseAdapter,
  swapDatabasePackage,
  swapStorageAdapter,
  swapStoragePackage,
} from '../src/configure'
import { DB_CHOICES, DB_KEYS, defaultConnectionString } from '../src/databases'
import { AUTH_METHODS, SOCIAL_PROVIDERS, type AuthMethod, type BillingMode, type SocialProvider } from '../src/options'
import { LOCAL_STORAGE_CONFIG, STORAGE_ADAPTER_KEYS, STORAGE_CHOICES, STORAGE_KEYS, STORAGE_PACKAGES } from '../src/storage'
import { defineStack } from '../../../templates/payload-stack/src/lib/stack'

const templateDir = path.resolve(__dirname, '../../../templates/payload-stack')
const payloadConfig = readFileSync(path.join(templateDir, 'src/payload.config.ts'), 'utf8')
const packageJson = JSON.parse(readFileSync(path.join(templateDir, 'package.json'), 'utf8')) as Record<string, unknown>
const envExample = readFileSync(path.join(templateDir, '.env.example'), 'utf8')

/**
 * Evaluates a rendered stack.config.ts the way the app would: strips the import and the
 * `defineStack(` wrapper, evaluates the object literal with the given process.env, and hands it
 * to the template's schema.
 */
function evaluateStackConfig(source: string, env: Record<string, string> = {}) {
  expect(source.startsWith("import { defineStack } from '@/lib/stack'")).toBe(true)
  const start = source.indexOf('export default defineStack(')
  expect(start).toBeGreaterThan(0)
  const literal = source.slice(start + 'export default defineStack('.length, source.lastIndexOf(')'))
  const object = new Function('process', `return (${literal})`)({ env }) as Parameters<typeof defineStack>[0]
  return defineStack(object)
}

function subsets<T>(items: readonly T[]): T[][] {
  const out: T[][] = []
  for (let mask = 0; mask < 1 << items.length; mask++) out.push(items.filter((_, i) => mask & (1 << i)))
  return out
}

describe('renderStackConfig', () => {
  const combos: Array<{ authMethods: AuthMethod[]; social: SocialProvider[]; organizations: boolean; billing: BillingMode }> = []
  for (const authMethods of subsets(AUTH_METHODS).filter((s) => s.length > 0)) {
    for (const social of subsets(SOCIAL_PROVIDERS)) {
      for (const organizations of [true, false]) {
        for (const billing of ['organization', 'user', 'none'] as const) {
          if (billing === 'organization' && !organizations) continue
          combos.push({ authMethods, social, organizations, billing })
        }
      }
    }
  }

  it('covers every combination the CLI can produce', () => {
    expect(combos).toHaveLength(7 * 4 * 5)
  })

  it.each(combos.map((c) => [`auth=${c.authMethods.join('+')} social=${c.social.join('+') || '-'} orgs=${c.organizations} billing=${c.billing}`, c] as const))(
    '%s renders a config the template accepts and that reflects the answers',
    (_label, c) => {
      const source = renderStackConfig({ name: 'Ridgeline', ...c, consent: false })
      const stack = evaluateStackConfig(source)

      expect(stack.name).toBe('Ridgeline')
      expect(stack.auth.methods).toEqual(c.authMethods)
      expect(stack.auth.social).toEqual(c.social)
      // Two-factor rides on passwords: it is on exactly when email + password is chosen.
      expect(stack.auth.twoFactor).toBe(c.authMethods.includes('email-password'))
      expect(stack.features.twoFactor).toBe(c.authMethods.includes('email-password'))
      expect(stack.organizations.enabled).toBe(c.organizations)
      expect(stack.features.organizations).toBe(c.organizations)
      expect(stack.billing.provider).toBe(c.billing === 'none' ? 'none' : 'stripe')
      expect(stack.features.billingAttachedTo).toBe(c.billing === 'none' ? null : c.billing)

      if (stack.billing.provider === 'stripe') {
        expect(stack.billing.plans.map((p) => p.id)).toEqual(['starter', 'team'])
        // Seats are a per-organization concept.
        expect(stack.billing.plans.every((p) => (c.billing === 'organization' ? p.seats !== undefined : p.seats === undefined))).toBe(true)
        expect(stack.billing.plans[1]!.trialDays).toBe(14)
        expect(stack.billing.plans[1]!.highlighted).toBe(true)
      }
      // The pricing link exists only when there is something to price.
      expect(stack.nav.some((n) => n.href === '/pricing')).toBe(c.billing !== 'none')
      expect(stack.nav.some((n) => n.href.includes('payload.solutions/docs'))).toBe(true)
      expect(stack.legal.company).toBe('Ridgeline Ltd')
    },
  )

  it('reads Stripe price ids from NEXT_PUBLIC_STRIPE_PRICE_* with placeholders as fallback', () => {
    const source = renderStackConfig({ name: 'X', authMethods: ['email-password'], social: [], organizations: true, billing: 'organization', consent: false })
    const placeholders = evaluateStackConfig(source)
    const withEnv = evaluateStackConfig(source, {
      NEXT_PUBLIC_STRIPE_PRICE_STARTER_MONTHLY: 'price_1',
      NEXT_PUBLIC_STRIPE_PRICE_STARTER_YEARLY: 'price_2',
      NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY: 'price_3',
      NEXT_PUBLIC_STRIPE_PRICE_TEAM_YEARLY: 'price_4',
    })
    const ids = (s: typeof placeholders) => (s.billing.provider === 'stripe' ? s.billing.plans.flatMap((p) => p.prices.map((x) => x.id)) : [])
    expect(ids(placeholders)).toEqual(['price_starter_monthly', 'price_starter_yearly', 'price_team_monthly', 'price_team_yearly'])
    expect(ids(withEnv)).toEqual(['price_1', 'price_2', 'price_3', 'price_4'])
  })

  it('reads the app url from NEXT_PUBLIC_APP_URL with localhost as fallback', () => {
    const source = renderStackConfig({ name: 'X', authMethods: ['email-password'], social: [], organizations: true, billing: 'none', consent: false })
    expect(evaluateStackConfig(source).url).toBe('http://localhost:3000')
    expect(evaluateStackConfig(source, { NEXT_PUBLIC_APP_URL: 'https://ridgeline.app' }).url).toBe('https://ridgeline.app')
  })

  it('escapes quotes in the project name', () => {
    const source = renderStackConfig({ name: "Ridge's \"Line\"", authMethods: ['email-password'], social: [], organizations: true, billing: 'none', consent: false })
    expect(evaluateStackConfig(source).name).toBe("Ridge's \"Line\"")
    expect(evaluateStackConfig(source).legal.company).toBe("Ridge's \"Line\" Ltd")
  })

  it('--consent asks for the company details the legal pages are written from', () => {
    const base = { name: 'Ridgeline', authMethods: ['email-password' as const], social: [], organizations: true, billing: 'none' as const }
    const off = renderStackConfig({ ...base, consent: false })
    const on = renderStackConfig({ ...base, consent: true })

    // Both parse, and the shared keys mean the same thing.
    for (const source of [off, on]) {
      expect(evaluateStackConfig(source).legal.company).toBe('Ridgeline Ltd')
      expect(evaluateStackConfig(source).legal.jurisdiction).toBe('Ireland')
    }

    // Without consent the extra keys would be noise: nothing reads them.
    expect(off).not.toContain('legalName')
    expect(off).not.toContain('REGISTERED ADDRESS')

    // With it, the address is a placeholder loud enough for `payload-consent scan` to report.
    const stack = evaluateStackConfig(on)
    expect(stack.legal.legalName).toBe('Ridgeline Ltd')
    expect(stack.legal.address).toMatch(/\[.+\]/)
    expect(on).toContain('payload-consent scan')
  })

  it('renders the same key order and comments as the template config so diffs stay readable', () => {
    const source = renderStackConfig({ name: 'Payload Stack', authMethods: ['email-password', 'magic-link', 'passkey'], social: [], organizations: true, billing: 'organization', consent: false })
    const template = readFileSync(path.join(templateDir, 'src/stack.config.ts'), 'utf8')
    const keys = (s: string) => [...s.matchAll(/^  ([a-zA-Z]+):/gm)].map((m) => m[1])
    expect(keys(source)).toEqual(keys(template))
    expect(source).toContain('Your whole product, described in one file.')
  })
})

describe('swapDatabaseAdapter', () => {
  it.each(Object.values(DB_CHOICES))('swaps to $label', (db) => {
    const out = swapDatabaseAdapter(payloadConfig, db)
    expect(out).toContain(`import { ${db.importName} } from '${db.packageName}'`)
    expect(out).toContain(`db: ${db.importName}(`)
    expect(out).toContain('env.DATABASE_URL')
    // exactly one adapter import remains
    const imports = out.match(/@payloadcms\/db-[a-z-]+/g) ?? []
    expect(new Set(imports)).toEqual(new Set([db.packageName]))
    // markers survive so the swap is repeatable, and swapping twice is a no-op
    expect(out).toContain('// database-adapter-config-start')
    expect(out).toContain('// database-adapter-config-end')
    expect(swapDatabaseAdapter(out, db)).toBe(out)
    expect(swapDatabaseAdapter(out, DB_CHOICES.postgres)).toContain("from '@payloadcms/db-postgres'")
    // the rest of the file is untouched
    expect(out.split('// database-adapter-config-end')[1]).toBe(payloadConfig.split('// database-adapter-config-end')[1])
  })

  it('throws when markers are missing', () => {
    expect(() => swapDatabaseAdapter('export default {}', DB_CHOICES.sqlite)).toThrow(/marker/)
    expect(() => swapDatabaseAdapter("// database-adapter-import\nimport { x } from 'y'\n", DB_CHOICES.sqlite)).toThrow(/markers/)
  })

  it('the template ships with PostgreSQL between the markers', () => {
    expect(payloadConfig).toContain("import { postgresAdapter } from '@payloadcms/db-postgres'")
    expect(swapDatabaseAdapter(payloadConfig, DB_CHOICES.postgres)).toBe(payloadConfig)
  })
})

describe('swapDatabasePackage', () => {
  it.each(Object.values(DB_CHOICES))('keeps only $packageName pinned to the payload version', (db) => {
    const out = swapDatabasePackage(packageJson, db)
    const deps = out.dependencies as Record<string, string>
    expect(deps[db.packageName]).toBe(deps.payload)
    for (const other of Object.values(DB_CHOICES)) {
      if (other.packageName !== db.packageName) expect(deps).not.toHaveProperty(other.packageName)
    }
    expect(Object.keys(deps)).toEqual([...Object.keys(deps)].sort((a, b) => a.localeCompare(b)))
    // nothing else changed
    const original = packageJson.dependencies as Record<string, string>
    for (const [name, version] of Object.entries(original)) {
      if (!name.startsWith('@payloadcms/db-')) expect(deps[name]).toBe(version)
    }
  })
})

describe('swapStorageAdapter', () => {
  /** Keys declared (set or commented out) in the template's .env.example. */
  const envExampleKeys = new Set([...envExample.matchAll(/^#?\s?([A-Z0-9_]+)=/gm)].map((m) => m[1]))

  /** The names the source imports from '@/lib/env', in order. */
  const envImportNames = (source: string) =>
    /^import \{ ([^}]*) \} from '@\/lib\/env'$/m
      .exec(source)![1]!
      .split(',')
      .map((name) => name.trim())
  /** What the template itself imports from '@/lib/env' — the swap must not disturb these. */
  const templateEnvNames = envImportNames(payloadConfig)

  it.each(STORAGE_ADAPTER_KEYS)('writes the %s adapter behind its env guard and imports it', (key) => {
    const storage = STORAGE_CHOICES[key]
    const out = swapStorageAdapter(payloadConfig, storage)
    expect(out).toContain(`// storage-adapter-import\nimport { ${storage.importName} } from '${storage.packageName}'`)
    expect(out).toContain(`if (env.${storage.envVars[0]!.split(' ')[0]})`)
    expect(out).toContain(`${storage.importName}({`)
    expect(out).toContain('plugins.push(')
    expect(out).toMatch(/collections: \{\s*media/)
    // requireEnv is added only when the adapter needs it; every other template import survives.
    const envNames = envImportNames(out)
    expect(envNames.includes('requireEnv')).toBe(storage.usesRequireEnv)
    expect(envNames.filter((name) => name !== 'requireEnv')).toEqual(templateEnvNames)
    expect(out.includes('requireEnv(')).toBe(storage.usesRequireEnv)
    // The local-disk comment is gone and exactly one storage package is imported.
    expect(out).not.toContain(LOCAL_STORAGE_CONFIG)
    expect(new Set(out.match(/@payloadcms\/storage-[a-z0-9-]+/g))).toEqual(new Set([storage.packageName]))
    // Every variable the adapter reads is declared in .env.example, so `pnpm dev` can be configured from the file alone.
    for (const envKey of out.match(/env\.([A-Z0-9_]+)/g)?.map((m) => m.slice(4)) ?? []) {
      expect(envExampleKeys, `${envKey} missing from .env.example`).toContain(envKey)
    }
    for (const envKey of out.match(/requireEnv\('([A-Z0-9_]+)'/g)?.map((m) => m.slice(12, -1)) ?? []) {
      expect(envExampleKeys, `${envKey} missing from .env.example`).toContain(envKey)
    }
    // The adapter block sits before the config export so `plugins` exists.
    expect(out.indexOf('// storage-adapter-config-start')).toBeLessThan(out.indexOf('export default buildConfig'))
    expect(out.indexOf('// storage-adapter-config-start')).toBeGreaterThan(out.indexOf('const plugins: Plugin[]'))
    // Markers survive, so the swap is repeatable: same adapter again is a no-op, back to local disk restores the template.
    expect(out).toContain('// storage-adapter-config-start')
    expect(out).toContain('// storage-adapter-config-end')
    expect(swapStorageAdapter(out, storage)).toBe(out)
    expect(swapStorageAdapter(out, null)).toBe(payloadConfig)
    // The database swap still works on top, and the storage block survives it.
    const withSqlite = swapDatabaseAdapter(out, DB_CHOICES.sqlite)
    expect(withSqlite).toContain("from '@payloadcms/db-sqlite'")
    expect(withSqlite).toContain(`${storage.importName}({`)
  })

  it('swapping between adapters never leaves two imports behind', () => {
    let out = payloadConfig
    for (const key of STORAGE_ADAPTER_KEYS) out = swapStorageAdapter(out, STORAGE_CHOICES[key])
    const imports = out.match(/@payloadcms\/storage-[a-z0-9-]+/g) ?? []
    expect(new Set(imports)).toEqual(new Set([STORAGE_CHOICES.uploadthing.packageName]))

    const s3 = swapStorageAdapter(payloadConfig, STORAGE_CHOICES.s3)
    const azure = swapStorageAdapter(s3, STORAGE_CHOICES.azure)
    expect(azure).not.toContain('@payloadcms/storage-s3')
    expect(azure).not.toContain('s3Storage')
    expect(envImportNames(azure)).toContain('requireEnv')
    expect(swapStorageAdapter(azure, null)).toBe(payloadConfig)
  })

  it('leaves the template alone for local disk', () => {
    const local = swapStorageAdapter(payloadConfig, null)
    expect(local).toBe(payloadConfig)
    expect(local).toContain(LOCAL_STORAGE_CONFIG)
    expect(storageChoice('none')).toBeNull()
    expect(storageChoice('s3')).toBe(STORAGE_CHOICES.s3)
  })

  it('renders the R2 adapter through the S3 package with a public file url', () => {
    const out = swapStorageAdapter(payloadConfig, STORAGE_CHOICES.r2)
    expect(out).toContain('`${env.R2_PUBLIC_URL}/${prefix ? `${prefix}/${filename}` : filename}`')
    expect(out).toContain("region: 'auto'")
    expect(out).toContain('forcePathStyle: true')
  })

  it('throws when the markers or the env import are missing', () => {
    expect(() => swapStorageAdapter('export default {}', STORAGE_CHOICES.s3)).toThrow(/marker/)
    expect(() => swapStorageAdapter('// storage-adapter-import\n', STORAGE_CHOICES.s3)).toThrow(/@\/lib\/env/)
    expect(() => swapStorageAdapter("// storage-adapter-import\nimport { env } from '@/lib/env'\n", STORAGE_CHOICES.s3)).toThrow(/storage adapter markers/)
    const noConfigMarkers = payloadConfig.replace('// storage-adapter-config-start', '').replace('// storage-adapter-config-end', '')
    expect(() => swapStorageAdapter(noConfigMarkers, STORAGE_CHOICES.s3)).toThrow(/marker/)
  })
})

describe('swapStoragePackage', () => {
  it.each(STORAGE_ADAPTER_KEYS)('adds only the %s package, pinned to the payload version', (key) => {
    const storage = STORAGE_CHOICES[key]
    const withOther = swapStoragePackage(packageJson, STORAGE_CHOICES[key === 's3' ? 'azure' : 's3'])
    const out = swapStoragePackage(withOther, storage)
    const deps = out.dependencies as Record<string, string>
    expect(deps[storage.packageName]).toBe(deps.payload)
    for (const pkg of STORAGE_PACKAGES) if (pkg !== storage.packageName) expect(deps).not.toHaveProperty(pkg)
  })

  it('removes every storage package for local disk and leaves the rest alone', () => {
    const withS3 = swapStoragePackage(packageJson, STORAGE_CHOICES.s3)
    const deps = swapStoragePackage(withS3, null).dependencies as Record<string, string>
    for (const pkg of STORAGE_PACKAGES) expect(deps).not.toHaveProperty(pkg)
    expect(deps.payload).toBe((packageJson.dependencies as Record<string, string>).payload)
  })

  it('lists local disk first among the CLI values', () => {
    expect(STORAGE_KEYS[0]).toBe('none')
    expect(STORAGE_KEYS).toHaveLength(STORAGE_ADAPTER_KEYS.length + 1)
  })

  it('the template ships without a storage package', () => {
    const deps = packageJson.dependencies as Record<string, string>
    for (const pkg of STORAGE_PACKAGES) expect(deps).not.toHaveProperty(pkg)
  })
})

describe('renameProject', () => {
  it('renames, resets the version, marks private and strips repo metadata', () => {
    const out = renameProject(packageJson, 'ridgeline')
    expect(out.name).toBe('ridgeline')
    expect(out.version).toBe('0.1.0')
    expect(out.private).toBe(true)
    expect(out.repository).toBeUndefined()
    expect(out.homepage).toBeUndefined()
    expect(out.description).toBeUndefined()
    expect(out.scripts).toEqual(packageJson.scripts)
    expect(out.dependencies).toEqual(packageJson.dependencies)
    expect(out.license).toBe(packageJson.license)
  })
})

describe('renderEnv', () => {
  it('fills required keys and generates fresh secrets each time', () => {
    const out = renderEnv(envExample, { connectionString: 'file:./ridgeline.db' })
    expect(out).toMatch(/^DATABASE_URL=file:\.\/ridgeline\.db$/m)
    expect(out).toMatch(/^PAYLOAD_SECRET=[A-Za-z0-9_-]{20,}$/m)
    expect(out).toMatch(/^BETTER_AUTH_SECRET=[A-Za-z0-9_-]{40,}$/m)
    expect(out).toMatch(/^NEXT_PUBLIC_APP_URL=http:\/\/localhost:3000$/m)
    const again = renderEnv(envExample, { connectionString: 'file:./ridgeline.db' })
    expect(/PAYLOAD_SECRET=(.*)/.exec(again)![1]).not.toBe(/PAYLOAD_SECRET=(.*)/.exec(out)![1])
  })

  it('accepts a custom app url', () => {
    expect(renderEnv(envExample, { connectionString: 'x', appUrl: 'https://ridgeline.app' })).toMatch(/^NEXT_PUBLIC_APP_URL=https:\/\/ridgeline\.app$/m)
  })

  it('keeps every optional key commented out and the comments intact', () => {
    const out = renderEnv(envExample, { connectionString: 'x' })
    for (const key of ['RESEND_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'GOOGLE_CLIENT_ID', 'GITHUB_CLIENT_ID', 'BLOB_READ_WRITE_TOKEN', 'S3_BUCKET']) {
      expect(out, key).toMatch(new RegExp(`^# ${key}=`, 'm'))
    }
    expect(out.split('\n').length).toBe(envExample.split('\n').length)
    expect(out).toContain('# ---- Required')
  })

  it('never leaves the placeholders from .env.example behind', () => {
    const out = renderEnv(envExample, { connectionString: 'postgres://postgres:secret@127.0.0.1:5432/app' })
    expect(out).not.toContain('YOUR_SECRET_HERE')
    expect(out).not.toMatch(/^DATABASE_URL=.*<password>/m)
  })
})

describe('defaultConnectionString', () => {
  it.each([
    ['postgres', 'postgres://postgres:<password>@127.0.0.1:5432/ridgeline'],
    ['mongodb', 'mongodb://127.0.0.1/ridgeline'],
    ['sqlite', 'file:./ridgeline.db'],
    ['vercel-postgres', 'postgres://postgres:<password>@127.0.0.1:5432/ridgeline'],
  ] as const)('%s → %s', (db, expected) => {
    expect(defaultConnectionString(DB_CHOICES[db], 'ridgeline')).toBe(expected)
  })
})

describe('choice tables', () => {
  it('every database choice is complete and references env.DATABASE_URL', () => {
    expect(DB_KEYS).toEqual(['postgres', 'mongodb', 'sqlite', 'vercel-postgres'])
    for (const db of Object.values(DB_CHOICES)) {
      expect(db.packageName).toMatch(/^@payloadcms\/db-/)
      expect(db.importName).toMatch(/Adapter$/)
      expect(db.config.startsWith(`db: ${db.importName}(`)).toBe(true)
      expect(db.config).toContain('env.DATABASE_URL')
      expect(db.label.length).toBeGreaterThan(0)
    }
  })

  it('every storage choice is complete and its first env var is the guard', () => {
    expect(STORAGE_KEYS).toEqual(['none', 'vercel-blob', 's3', 'r2', 'azure', 'gcs', 'uploadthing'])
    for (const storage of Object.values(STORAGE_CHOICES)) {
      expect(storage.packageName).toMatch(/^@payloadcms\/storage-/)
      expect(storage.importName).toMatch(/Storage$/)
      expect(storage.envVars.length).toBeGreaterThan(0)
      expect(storage.config).toContain(`if (env.${storage.envVars[0]!.split(' ')[0]})`)
      expect(storage.config).toContain('plugins.push(')
      expect(storage.config.includes('requireEnv(')).toBe(storage.usesRequireEnv)
    }
    // R2 goes through the S3 package on purpose.
    expect(STORAGE_CHOICES.r2.packageName).toBe(STORAGE_CHOICES.s3.packageName)
    expect(STORAGE_PACKAGES).toHaveLength(5)
  })
})
