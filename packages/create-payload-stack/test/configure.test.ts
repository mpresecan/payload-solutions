import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { renameProject, renderEnv, renderStackConfig, swapDatabaseAdapter, swapDatabasePackage } from '../src/configure'
import { DB_CHOICES, defaultConnectionString } from '../src/databases'

const templateDir = path.resolve(__dirname, '../../../templates/payload-stack')
const payloadConfig = readFileSync(path.join(templateDir, 'src/payload.config.ts'), 'utf8')
const packageJson = JSON.parse(readFileSync(path.join(templateDir, 'package.json'), 'utf8')) as Record<string, unknown>
const envExample = readFileSync(path.join(templateDir, '.env.example'), 'utf8')

describe('swapDatabaseAdapter', () => {
  it.each(Object.values(DB_CHOICES))('swaps to $label', (db) => {
    const out = swapDatabaseAdapter(payloadConfig, db)
    expect(out).toContain(`import { ${db.importName} } from '${db.packageName}'`)
    expect(out).toContain(`db: ${db.importName}(`)
    // exactly one adapter import remains
    const imports = out.match(/@payloadcms\/db-[a-z-]+/g) ?? []
    expect(new Set(imports)).toEqual(new Set([db.packageName]))
    // markers survive so the swap is repeatable
    expect(out).toContain('// database-adapter-config-start')
    expect(out).toContain('// database-adapter-config-end')
    expect(swapDatabaseAdapter(out, DB_CHOICES.postgres)).toContain("from '@payloadcms/db-postgres'")
  })

  it('throws when markers are missing', () => {
    expect(() => swapDatabaseAdapter('export default {}', DB_CHOICES.sqlite)).toThrow(/marker/)
  })
})

describe('swapDatabasePackage', () => {
  it('replaces the adapter dependency and pins it to the payload version', () => {
    const out = swapDatabasePackage(packageJson, DB_CHOICES.mongodb)
    const deps = out.dependencies as Record<string, string>
    expect(deps['@payloadcms/db-mongodb']).toBe(deps.payload)
    expect(deps['@payloadcms/db-postgres']).toBeUndefined()
  })
})

describe('renameProject', () => {
  it('renames and strips repo metadata', () => {
    const out = renameProject(packageJson, 'ridgeline')
    expect(out.name).toBe('ridgeline')
    expect(out.version).toBe('0.1.0')
    expect(out.repository).toBeUndefined()
    expect(out.private).toBe(true)
  })
})

describe('renderEnv', () => {
  it('fills required keys and generates secrets', () => {
    const out = renderEnv(envExample, { connectionString: 'file:./ridgeline.db' })
    expect(out).toMatch(/^DATABASE_URL=file:\.\/ridgeline\.db$/m)
    expect(out).toMatch(/^PAYLOAD_SECRET=[A-Za-z0-9_-]{20,}$/m)
    expect(out).toMatch(/^BETTER_AUTH_SECRET=[A-Za-z0-9_-]{40,}$/m)
    expect(out).toMatch(/^NEXT_PUBLIC_APP_URL=http:\/\/localhost:3000$/m)
    // untouched optional keys stay commented
    expect(out).toMatch(/^# STRIPE_SECRET_KEY=/m)
  })
})

describe('renderStackConfig', () => {
  it('renders a config that reflects the answers', () => {
    const out = renderStackConfig({
      name: "Ridge's Line",
      authMethods: ['email-password', 'passkey'],
      social: ['github'],
      organizations: false,
      billing: 'user',
    })
    expect(out).toContain("name: 'Ridge\\'s Line'")
    expect(out).toContain("methods: ['email-password', 'passkey']")
    expect(out).toContain("social: ['github']")
    expect(out).toContain('enabled: false')
    expect(out).toContain("attachedTo: 'user'")
    expect(out).not.toContain('seats:')
  })

  it('renders billing none without a pricing nav item', () => {
    const out = renderStackConfig({ name: 'X', authMethods: ['magic-link'], social: [], organizations: true, billing: 'none' })
    expect(out).toContain("billing: { provider: 'none' }")
    expect(out).not.toContain("'/pricing'")
    expect(out).toContain('twoFactor: false')
  })
})

describe('defaultConnectionString', () => {
  it('builds per-database defaults', () => {
    expect(defaultConnectionString(DB_CHOICES.sqlite, 'ridgeline')).toBe('file:./ridgeline.db')
    expect(defaultConnectionString(DB_CHOICES.mongodb, 'ridgeline')).toBe('mongodb://127.0.0.1/ridgeline')
  })
})
