import * as p from '@clack/prompts'
import { execa } from 'execa'
import { existsSync } from 'node:fs'
import path from 'node:path'
import pc from 'picocolors'

import { configureProject } from './configure'
import { DB_CHOICES, DB_KEYS, defaultConnectionString, type DbKey } from './databases'
import {
  AUTH_METHODS,
  SOCIAL_PROVIDERS,
  type AuthMethod,
  type BillingMode,
  type CliFlags,
  type ProjectOptions,
  type SocialProvider,
} from './options'
import { STORAGE_ADAPTER_KEYS, STORAGE_CHOICES, STORAGE_KEYS, type StorageKey } from './storage'
import { copyLocalTemplate, downloadTemplate } from './template'
import { detectPackageManager, installCommand, isDirectoryEmpty, runCommand, slugify } from './utils'

const DOCS = 'https://payload.solutions/docs/payload-stack'

function bail(message = 'Cancelled.'): never {
  p.cancel(message)
  process.exit(1)
}

function guard<T>(value: T | symbol): T {
  if (p.isCancel(value)) bail()
  return value as T
}

function parseList<T extends string>(raw: string | undefined, allowed: readonly T[], flag: string): T[] | undefined {
  if (raw === undefined) return undefined
  const items = raw.split(',').map((s) => s.trim()).filter(Boolean) as T[]
  for (const item of items) {
    if (!allowed.includes(item)) bail(`Unknown value "${item}" for ${flag}. Allowed: ${allowed.join(', ')}`)
  }
  return items
}

function listWords(items: readonly string[]) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

export async function run(flags: CliFlags, positionalName?: string) {
  console.log()
  p.intro(pc.bgWhite(pc.black(' create-payload-stack ')))

  // 1. Project name
  const providedName = flags.name ?? positionalName
  const name = flags.defaults && !providedName ? 'my-saas' : providedName ?? guard(
    await p.text({
      message: 'Project name',
      placeholder: 'my-saas',
      defaultValue: 'my-saas',
      validate: (v) => (v && v.trim().length < 2 ? 'Use at least 2 characters' : undefined),
    }),
  )
  const slug = slugify(name)
  const directory = path.resolve(process.cwd(), slug)
  if (!isDirectoryEmpty(directory)) {
    bail(`Directory ./${slug} already exists and is not empty.`)
  }

  // 2. Database
  const dbFlag = flags.db as DbKey | undefined
  if (dbFlag && !DB_KEYS.includes(dbFlag)) bail(`Unknown database "${dbFlag}". Allowed: ${DB_KEYS.join(', ')}`)
  const db: DbKey = dbFlag ?? (flags.defaults ? 'postgres' : guard(
    await p.select<DbKey>({
      message: 'Database',
      initialValue: 'postgres',
      options: DB_KEYS.map((key) => ({ value: key, label: DB_CHOICES[key].label, hint: DB_CHOICES[key].hint })),
    }),
  ))
  const dbChoice = DB_CHOICES[db]

  // 3. Connection string
  const suggested = defaultConnectionString(dbChoice, slug)
  const connectionString =
    flags.connectionString ??
    (flags.defaults
      ? suggested
      : guard(
          await p.text({
            message: 'Connection string',
            placeholder: suggested,
            defaultValue: suggested,
            initialValue: suggested,
          }),
        ))

  // 4. Sign-in methods
  const authFlag = parseList<AuthMethod>(flags.auth, AUTH_METHODS, '--auth')
  const socialFlag = parseList<SocialProvider>(flags.social, SOCIAL_PROVIDERS, '--social')
  let authMethods: AuthMethod[]
  let social: SocialProvider[]
  if (authFlag || socialFlag || flags.defaults) {
    authMethods = authFlag ?? ['email-password', 'magic-link', 'passkey']
    social = socialFlag ?? []
  } else {
    const picked = guard(
      await p.multiselect<AuthMethod | SocialProvider>({
        message: 'Sign-in methods',
        required: true,
        initialValues: ['email-password', 'magic-link', 'passkey'],
        options: [
          { value: 'email-password', label: 'Email + password' },
          { value: 'magic-link', label: 'Magic link' },
          { value: 'passkey', label: 'Passkeys' },
          { value: 'google', label: 'Google', hint: 'needs GOOGLE_CLIENT_ID / _SECRET' },
          { value: 'github', label: 'GitHub', hint: 'needs GITHUB_CLIENT_ID / _SECRET' },
        ],
      }),
    )
    authMethods = picked.filter((v): v is AuthMethod => (AUTH_METHODS as readonly string[]).includes(v))
    social = picked.filter((v): v is SocialProvider => (SOCIAL_PROVIDERS as readonly string[]).includes(v))
    if (authMethods.length === 0) {
      p.log.warn('At least one non-social method is required for the Payload admin; adding email + password.')
      authMethods = ['email-password']
    }
  }

  // 5. Organizations
  const organizations =
    flags.organizations ??
    (flags.defaults ? true : guard(await p.confirm({ message: 'Organizations (teams)', initialValue: true })))

  // 6. Billing
  let billing: BillingMode
  if (flags.billing !== undefined) {
    if (!['organization', 'user', 'none'].includes(flags.billing)) bail(`Unknown value "${flags.billing}" for --billing. Allowed: organization, user, none`)
    billing = flags.billing as BillingMode
    if (billing === 'organization' && !organizations) bail('--billing organization requires organizations. Use --billing user or enable organizations.')
  } else if (flags.defaults) {
    billing = organizations ? 'organization' : 'user'
  } else {
    billing = guard(
      await p.select<BillingMode>({
        message: 'Billing',
        initialValue: organizations ? 'organization' : 'user',
        options: [
          ...(organizations ? [{ value: 'organization' as const, label: 'Stripe subscriptions, per organization' }] : []),
          { value: 'user' as const, label: 'Stripe subscriptions, per user' },
          { value: 'none' as const, label: 'No billing yet' },
        ],
      }),
    )
  }

  // 7. Media storage
  const storageFlag = flags.storage as StorageKey | undefined
  if (storageFlag && !STORAGE_KEYS.includes(storageFlag)) bail(`Unknown value "${storageFlag}" for --storage. Allowed: ${STORAGE_KEYS.join(', ')}`)
  const storage: StorageKey = storageFlag ?? (flags.defaults ? 'none' : guard(
    await p.select<StorageKey>({
      message: 'Media storage',
      initialValue: 'none',
      options: [
        { value: 'none', label: 'Skip for now', hint: 'uploads go to ./media on local disk; add an adapter any time' },
        ...STORAGE_ADAPTER_KEYS.map((key) => ({ value: key, label: STORAGE_CHOICES[key].label, hint: STORAGE_CHOICES[key].hint })),
      ],
    }),
  ))

  const packageManager = flags.packageManager ?? (await detectPackageManager())

  const options: ProjectOptions = {
    name,
    slug,
    directory,
    db,
    connectionString,
    authMethods,
    social,
    organizations,
    billing,
    storage,
    packageManager,
    install: flags.install,
    git: flags.git,
  }

  if (flags.dryRun) {
    p.note(JSON.stringify(options, null, 2), 'Dry run: nothing written')
    p.outro('Done.')
    return
  }

  // 7. Template
  const s = p.spinner()
  s.start(flags.localTemplate ? 'Copying local template' : 'Downloading template')
  try {
    if (flags.localTemplate) await copyLocalTemplate({ from: flags.localTemplate, dest: directory })
    else await downloadTemplate({ dest: directory, branch: flags.branch })
    await configureProject(options)
    s.stop('Project files written')
  } catch (error) {
    s.stop('Failed')
    bail(error instanceof Error ? error.message : String(error))
  }

  // 8. Install
  if (options.install) {
    const s2 = p.spinner()
    s2.start(`Installing dependencies with ${packageManager}`)
    try {
      await execa(installCommand(packageManager).split(' ')[0]!, installCommand(packageManager).split(' ').slice(1), {
        cwd: directory,
        env: { ...process.env, CI: 'true' },
      })
      s2.stop(`Installed dependencies with ${packageManager}`)
    } catch (error) {
      s2.stop('Dependency installation failed')
      p.log.warn(`Run ${pc.cyan(installCommand(packageManager))} inside ./${slug} to retry.\n${error instanceof Error ? error.message.split('\n')[0] : ''}`)
    }
  }

  // 9. Git
  if (options.git && !existsSync(path.join(directory, '.git'))) {
    try {
      await execa('git', ['init', '-b', 'main'], { cwd: directory })
      await execa('git', ['add', '-A'], { cwd: directory })
      await execa('git', ['-c', 'user.name=create-payload-stack', '-c', 'user.email=cli@payloadstack.com', 'commit', '-q', '-m', 'feat: initial commit from create-payload-stack'], { cwd: directory })
    } catch {
      p.log.warn('Could not initialize a git repository. Run git init yourself.')
    }
  }

  const steps = [
    `cd ${slug}`,
    ...(options.install ? [] : [installCommand(packageManager)]),
    ...(db === 'sqlite' ? [] : ['# start your database, then check DATABASE_URL in .env']),
    ...(social.length ? [`# add ${social.map((sp) => `${sp.toUpperCase()}_CLIENT_ID / _SECRET`).join(' and ')} to .env`] : []),
    ...(billing !== 'none' ? ['# add STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and NEXT_PUBLIC_STRIPE_PRICE_* to .env when you are ready for billing'] : []),
    ...(storage !== 'none' ? [`# add ${listWords(STORAGE_CHOICES[storage].envVars)} to .env to store uploads in ${STORAGE_CHOICES[storage].label} (local disk until then)`] : []),
    runCommand(packageManager, 'dev'),
    'open http://localhost:3000/admin',
  ]
  p.note(steps.join('\n'), 'Done. Next steps:')
  p.outro(`Docs: ${pc.underline(DOCS)}`)
}
