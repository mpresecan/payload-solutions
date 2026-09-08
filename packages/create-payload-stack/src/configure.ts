import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { DB_CHOICES, type DbChoice } from './databases'
import { addEmailsPlugin, applyEmailsChoice, swapEmailsPackages } from './emails'
import type { ProjectOptions } from './options'
import { LOCAL_STORAGE_CONFIG, STORAGE_CHOICES, STORAGE_PACKAGES, type StorageChoice, type StorageKey } from './storage'
import { generateSecret } from './utils'

/**
 * Turns the downloaded template into the user's project:
 *   1. src/stack.config.ts written from their answers
 *   2. database adapter swapped in payload.config.ts and package.json
 *   3. media storage adapter written into payload.config.ts and package.json (or left on local disk)
 *   4. transactional emails wired to the Payload Emails plugin, or left as React Email components
 *   5. .env generated from .env.example
 *   6. package.json renamed
 * Every function is pure over file contents so it can be unit-tested without a filesystem.
 */

export function renderStackConfig(o: Pick<ProjectOptions, 'name' | 'authMethods' | 'social' | 'organizations' | 'billing'>) {
  const list = (items: readonly string[]) => `[${items.map((i) => `'${i}'`).join(', ')}]`
  const billingBlock =
    o.billing === 'none'
      ? `  billing: { provider: 'none' },`
      : `  billing: {
    provider: 'stripe',
    attachedTo: '${o.billing}', // or '${o.billing === 'organization' ? 'user' : 'organization'}'
    plans: [
      {
        id: 'starter',
        name: 'Starter',
        description: 'For small teams getting started.',
        prices: [
          { id: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_MONTHLY ?? 'price_starter_monthly', amount: 2900, currency: 'usd', interval: 'month' },
          { id: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_YEARLY ?? 'price_starter_yearly', amount: 29000, currency: 'usd', interval: 'year' },
        ],
        features: ['Up to 3 members', '10 projects', 'Email support'],${o.billing === 'organization' ? '\n        seats: 3,' : ''}
        limits: { projects: 10 },
      },
      {
        id: 'team',
        name: 'Team',
        description: 'For growing teams that need room.',
        prices: [
          { id: process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY ?? 'price_team_monthly', amount: 9900, currency: 'usd', interval: 'month' },
          { id: process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_YEARLY ?? 'price_team_yearly', amount: 99000, currency: 'usd', interval: 'year' },
        ],
        features: ['Up to 25 members', 'Unlimited projects', 'Priority support', '14-day free trial'],
        highlighted: true,${o.billing === 'organization' ? '\n        seats: 25,' : ''}
        trialDays: 14,
        limits: { projects: -1 },
      },
    ],
  },`

  return `import { defineStack } from '@/lib/stack'

/**
 * Your whole product, described in one file.
 *
 * Pricing page, checkout, entitlements, sign-in screens, navigation, legal pages and emails all
 * read from here. Secrets never go in this file: they stay in .env and are read in src/lib/env.ts.
 * Stripe price ids are public identifiers, so they may come from NEXT_PUBLIC_* variables.
 *
 * The object is typed (StackInput in src/lib/stack.ts): your editor suggests every key and value,
 * pnpm typecheck fails on typos or unknown keys, and the schema rejects them again at boot.
 */
export default defineStack({
  name: '${o.name.replace(/'/g, "\\'")}',
  tagline: 'A new SaaS, built on Payload CMS.',
  description:
    'Authentication, organizations, subscriptions and an admin panel, wired together on Payload CMS and Next.js.',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  support: { email: 'support@example.com' },

  auth: {
    methods: ${list(o.authMethods)},
    social: ${list(o.social)},
    twoFactor: ${o.authMethods.includes('email-password')},
    requireEmailVerification: false,
    allowSignUp: true,
  },

  organizations: {
    enabled: ${o.organizations},
    allowUserToCreate: true,
    creatorRole: 'owner',
    teams: false,
  },

${billingBlock}

  observability: {
    tracesSampleRate: 0.1,
    sendPII: false,
  },

  legal: {
    company: '${o.name.replace(/'/g, "\\'")} Ltd',
    jurisdiction: 'Ireland',
  },

  nav: [${o.billing !== 'none' ? "{ label: 'Pricing', href: '/pricing' }, " : ''}{ label: 'Docs', href: 'https://payload.solutions/docs/payload-stack' }],

  social: {},
})
`
}

const IMPORT_MARKER = '// database-adapter-import'
const CONFIG_START = '// database-adapter-config-start'
const CONFIG_END = '// database-adapter-config-end'

export function swapDatabaseAdapter(payloadConfigSource: string, db: DbChoice) {
  const importLine = `${IMPORT_MARKER}\nimport { ${db.importName} } from '${db.packageName}'`
  const withImport = payloadConfigSource.replace(
    new RegExp(`${escapeRegExp(IMPORT_MARKER)}\\nimport [^\\n]+\\n`),
    `${importLine}\n`,
  )
  if (withImport === payloadConfigSource && !payloadConfigSource.includes(importLine)) {
    throw new Error(`payload.config.ts is missing the "${IMPORT_MARKER}" marker`)
  }
  const start = withImport.indexOf(CONFIG_START)
  const end = withImport.indexOf(CONFIG_END)
  if (start === -1 || end === -1) throw new Error(`payload.config.ts is missing the database adapter markers`)
  return `${withImport.slice(0, start)}${CONFIG_START}\n  ${db.config}\n  ${withImport.slice(end)}`
}

const STORAGE_IMPORT_MARKER = '// storage-adapter-import'
const STORAGE_CONFIG_START = '// storage-adapter-config-start'
const STORAGE_CONFIG_END = '// storage-adapter-config-end'
const ENV_IMPORT = /^import \{ ([^}]*) \} from '@\/lib\/env'$/m

/**
 * Writes the storage adapter (or the local-disk comment for `null`) between the storage markers of
 * payload.config.ts, adds or removes the adapter import, and imports `requireEnv` when the adapter
 * needs it. Repeatable: running it again with another choice replaces the previous one.
 */
export function swapStorageAdapter(payloadConfigSource: string, storage: StorageChoice | null) {
  const importPattern = new RegExp(
    `${escapeRegExp(STORAGE_IMPORT_MARKER)}\n(?:import \\{ \\w+ \\} from '@payloadcms\\/storage-[a-z0-9-]+'\n)?`,
  )
  if (!importPattern.test(payloadConfigSource)) {
    throw new Error(`payload.config.ts is missing the "${STORAGE_IMPORT_MARKER}" marker`)
  }
  const importLines = storage
    ? `${STORAGE_IMPORT_MARKER}\nimport { ${storage.importName} } from '${storage.packageName}'\n`
    : `${STORAGE_IMPORT_MARKER}\n`
  let out = payloadConfigSource.replace(importPattern, importLines)

  const envImport = ENV_IMPORT.exec(out)
  if (!envImport) throw new Error(`payload.config.ts is missing the "@/lib/env" import`)
  // Keep whatever else the template imports from @/lib/env; only requireEnv is ours to add or drop.
  const names = envImport[1]!
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name && name !== 'requireEnv')
  if (storage?.usesRequireEnv) {
    const at = names.findIndex((name) => name > 'requireEnv')
    names.splice(at === -1 ? names.length : at, 0, 'requireEnv')
  }
  out = out.replace(ENV_IMPORT, `import { ${names.join(', ')} } from '@/lib/env'`)

  const start = out.indexOf(STORAGE_CONFIG_START)
  const end = out.indexOf(STORAGE_CONFIG_END)
  if (start === -1 || end === -1 || end < start) throw new Error(`payload.config.ts is missing the storage adapter markers`)
  const body = storage ? storage.config : LOCAL_STORAGE_CONFIG
  return `${out.slice(0, start)}${STORAGE_CONFIG_START}\n${body}\n${out.slice(end)}`
}

/** Adds the chosen storage package pinned to the payload version, and drops any other storage package. */
export function swapStoragePackage(packageJson: Record<string, unknown>, storage: StorageChoice | null) {
  const deps = { ...(packageJson.dependencies as Record<string, string>) }
  const payloadVersion = deps.payload ?? 'latest'
  for (const pkg of STORAGE_PACKAGES) {
    if (pkg !== storage?.packageName) delete deps[pkg]
  }
  if (storage) deps[storage.packageName] = payloadVersion
  return { ...packageJson, dependencies: sortKeys(deps) }
}

export function storageChoice(key: StorageKey): StorageChoice | null {
  return key === 'none' ? null : STORAGE_CHOICES[key]
}

export function swapDatabasePackage(packageJson: Record<string, unknown>, db: DbChoice) {
  const deps = { ...(packageJson.dependencies as Record<string, string>) }
  const payloadVersion = deps.payload ?? 'latest'
  for (const other of Object.values(DB_CHOICES)) {
    if (other.packageName !== db.packageName) delete deps[other.packageName]
  }
  deps[db.packageName] = payloadVersion
  return { ...packageJson, dependencies: sortKeys(deps) }
}

/**
 * A workspace protocol version (`workspace:*`) resolves only inside the monorepo the template lives
 * in. Nothing should reach a scaffolded project with one; if it does, drop the dependency rather
 * than hand the user a package.json that no install can resolve.
 */
export function stripWorkspaceDependencies(packageJson: Record<string, unknown>) {
  const next = { ...packageJson }
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
    const deps = next[field] as Record<string, string> | undefined
    if (!deps) continue
    next[field] = Object.fromEntries(Object.entries(deps).filter(([, version]) => !version.startsWith('workspace:')))
  }
  return next
}

export function renameProject(packageJson: Record<string, unknown>, slug: string) {
  const next: Record<string, unknown> = { ...packageJson, name: slug, version: '0.1.0', private: true }
  delete next.homepage
  delete next.repository
  delete next.description
  return next
}

export function renderEnv(example: string, o: { connectionString: string; appUrl?: string }) {
  const values: Record<string, string> = {
    DATABASE_URL: o.connectionString,
    PAYLOAD_SECRET: generateSecret(24),
    BETTER_AUTH_SECRET: generateSecret(32),
    NEXT_PUBLIC_APP_URL: o.appUrl ?? 'http://localhost:3000',
  }
  const lines = example.split('\n').map((line) => {
    const m = /^#?\s?([A-Z0-9_]+)=(.*)$/.exec(line)
    if (!m) return line
    const key = m[1]!
    if (key in values) return `${key}=${values[key]}`
    return line
  })
  return lines.join('\n')
}

function sortKeys<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))) as T
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Applies every transformation to the scaffolded directory. */
export async function configureProject(o: ProjectOptions) {
  const db = DB_CHOICES[o.db]
  const read = (rel: string) => readFile(path.join(o.directory, rel), 'utf8')
  const write = (rel: string, content: string) => writeFile(path.join(o.directory, rel), content)

  await write('src/stack.config.ts', renderStackConfig(o))

  const storage = storageChoice(o.storage)
  const payloadConfig = await read('src/payload.config.ts')
  const withAdapters = swapStorageAdapter(swapDatabaseAdapter(payloadConfig, db), storage)
  await write('src/payload.config.ts', o.emails ? addEmailsPlugin(withAdapters) : withAdapters)

  await applyEmailsChoice(o.directory, o.emails)

  const pkg = JSON.parse(await read('package.json')) as Record<string, unknown>
  const configured = swapEmailsPackages(swapStoragePackage(swapDatabasePackage(pkg, db), storage), o.emails)
  await write(
    'package.json',
    JSON.stringify(renameProject(stripWorkspaceDependencies(configured), o.slug), null, 2) + '\n',
  )

  const example = await read('.env.example')
  await write('.env', renderEnv(example, { connectionString: o.connectionString }))
}
