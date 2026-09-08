import type { DbKey } from './databases'
import type { StorageKey } from './storage'

export const AUTH_METHODS = ['email-password', 'magic-link', 'passkey'] as const
export type AuthMethod = (typeof AUTH_METHODS)[number]

export const SOCIAL_PROVIDERS = ['google', 'github'] as const
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number]

export type BillingMode = 'organization' | 'user' | 'none'

export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun'

/** Everything the prompts (or flags) decide. Passed to the configure step. */
export interface ProjectOptions {
  name: string
  slug: string
  directory: string
  db: DbKey
  connectionString: string
  authMethods: AuthMethod[]
  social: SocialProvider[]
  organizations: boolean
  billing: BillingMode
  /** Media storage adapter, or 'none' for local disk. */
  storage: StorageKey
  /** Manage transactional email copy in the Payload admin with the Payload Emails plugin. */
  emails: boolean
  /** Cookie banner, consent records and audited legal pages with the Payload Consent plugin. */
  consent: boolean
  packageManager: PackageManager
  install: boolean
  git: boolean
}

/** Raw CLI flags after parsing. */
export interface CliFlags {
  name?: string
  db?: string
  connectionString?: string
  auth?: string
  social?: string
  organizations?: boolean
  billing?: string
  storage?: string
  emails?: boolean
  consent?: boolean
  packageManager?: PackageManager
  install: boolean
  git: boolean
  defaults: boolean
  branch: string
  localTemplate?: string
  dryRun: boolean
  help: boolean
  version: boolean
}
