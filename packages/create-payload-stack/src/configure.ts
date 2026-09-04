import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { DB_CHOICES, type DbChoice } from './databases'
import type { ProjectOptions } from './options'
import { generateSecret } from './utils'

/**
 * Turns the downloaded template into the user's project:
 *   1. src/stack.config.ts written from their answers
 *   2. database adapter swapped in payload.config.ts and package.json
 *   3. .env generated from .env.example
 *   4. package.json renamed
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

export function swapDatabasePackage(packageJson: Record<string, unknown>, db: DbChoice) {
  const deps = { ...(packageJson.dependencies as Record<string, string>) }
  const payloadVersion = deps.payload ?? 'latest'
  for (const other of Object.values(DB_CHOICES)) {
    if (other.packageName !== db.packageName) delete deps[other.packageName]
  }
  deps[db.packageName] = payloadVersion
  return { ...packageJson, dependencies: sortKeys(deps) }
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

  const payloadConfig = await read('src/payload.config.ts')
  await write('src/payload.config.ts', swapDatabaseAdapter(payloadConfig, db))

  const pkg = JSON.parse(await read('package.json')) as Record<string, unknown>
  await write('package.json', JSON.stringify(renameProject(swapDatabasePackage(pkg, db), o.slug), null, 2) + '\n')

  const example = await read('.env.example')
  await write('.env', renderEnv(example, { connectionString: o.connectionString }))
}
