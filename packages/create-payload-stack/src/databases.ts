/**
 * Databases the CLI offers. Mirrors create-payload-app's list, minus Cloudflare D1 (the template
 * runs Next.js on Node, not Workers).
 */
export type DbKey = 'postgres' | 'mongodb' | 'sqlite' | 'vercel-postgres'

export interface DbChoice {
  key: DbKey
  label: string
  hint?: string
  /** npm package of the Payload adapter. */
  packageName: string
  /** Named export of the adapter factory. */
  importName: string
  /** Default connection string: `${prefix}${projectSlug}${suffix}`. */
  connectionPrefix: string
  connectionSuffix: string
  /** Renders the `db:` property for payload.config.ts. */
  config: string
}

export const DB_CHOICES: Record<DbKey, DbChoice> = {
  postgres: {
    key: 'postgres',
    label: 'PostgreSQL',
    hint: 'recommended',
    packageName: '@payloadcms/db-postgres',
    importName: 'postgresAdapter',
    connectionPrefix: 'postgres://postgres:<password>@127.0.0.1:5432/',
    connectionSuffix: '',
    config: `db: postgresAdapter({
    pool: {
      connectionString: env.DATABASE_URL,
    },
  }),`,
  },
  mongodb: {
    key: 'mongodb',
    label: 'MongoDB',
    packageName: '@payloadcms/db-mongodb',
    importName: 'mongooseAdapter',
    connectionPrefix: 'mongodb://127.0.0.1/',
    connectionSuffix: '',
    config: `db: mongooseAdapter({
    url: env.DATABASE_URL,
  }),`,
  },
  sqlite: {
    key: 'sqlite',
    label: 'SQLite',
    hint: 'zero setup, single file',
    packageName: '@payloadcms/db-sqlite',
    importName: 'sqliteAdapter',
    connectionPrefix: 'file:./',
    connectionSuffix: '.db',
    config: `db: sqliteAdapter({
    client: {
      url: env.DATABASE_URL,
    },
  }),`,
  },
  'vercel-postgres': {
    key: 'vercel-postgres',
    label: 'Vercel Postgres',
    packageName: '@payloadcms/db-vercel-postgres',
    importName: 'vercelPostgresAdapter',
    connectionPrefix: 'postgres://postgres:<password>@127.0.0.1:5432/',
    connectionSuffix: '',
    config: `db: vercelPostgresAdapter({
    pool: {
      connectionString: env.DATABASE_URL,
    },
  }),`,
  },
}

export const DB_KEYS = Object.keys(DB_CHOICES) as DbKey[]

export function defaultConnectionString(db: DbChoice, projectSlug: string) {
  return `${db.connectionPrefix}${projectSlug}${db.connectionSuffix}`
}
