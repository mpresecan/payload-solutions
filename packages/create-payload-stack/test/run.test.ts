/**
 * src/cli.ts `run()`: how flags, `--defaults` and prompts resolve into ProjectOptions, and every
 * validation that stops the CLI before it writes anything. Prompts are replaced with a scripted
 * @clack/prompts, `process.exit` throws, and `--dry-run` keeps the filesystem untouched.
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CliFlags, ProjectOptions } from '../src/options'

/** What a scripted prompt returns, keyed by the prompt message. */
let answers: Record<string, unknown> = {}
const notes: Array<{ message: string; title?: string }> = []
const cancels: string[] = []
const warns: string[] = []
const promptsShown: string[] = []

vi.mock('@clack/prompts', () => {
  const CANCEL = Symbol('cancel')
  const answer = (opts: { message: string }) => {
    promptsShown.push(opts.message)
    if (!(opts.message in answers)) throw new Error(`unexpected prompt: ${opts.message}`)
    return answers[opts.message]
  }
  return {
    intro: vi.fn(),
    outro: vi.fn(),
    note: vi.fn((message: string, title?: string) => notes.push({ message, title })),
    cancel: vi.fn((message: string) => cancels.push(message)),
    isCancel: (v: unknown) => v === CANCEL,
    log: { warn: vi.fn((m: string) => warns.push(m)), info: vi.fn(), error: vi.fn() },
    spinner: () => ({ start: vi.fn(), stop: vi.fn() }),
    text: vi.fn(async (opts: { message: string }) => answer(opts)),
    select: vi.fn(async (opts: { message: string }) => answer(opts)),
    multiselect: vi.fn(async (opts: { message: string }) => answer(opts)),
    confirm: vi.fn(async (opts: { message: string }) => answer(opts)),
    __CANCEL: CANCEL,
  }
})

vi.mock('../src/utils', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/utils')>()
  return { ...original, detectPackageManager: async () => 'pnpm' as const }
})

class ExitError extends Error {
  constructor(public readonly code: number) {
    super(`process.exit(${code})`)
  }
}

const baseFlags = (overrides: Partial<CliFlags> = {}): CliFlags => ({
  install: true,
  git: true,
  defaults: false,
  branch: 'main',
  dryRun: true,
  help: false,
  version: false,
  ...overrides,
})

let cwd: string

beforeEach(() => {
  cwd = mkdtempSync(path.join(os.tmpdir(), 'cps-run-'))
  vi.spyOn(process, 'cwd').mockReturnValue(cwd)
  vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new ExitError(code ?? 0)
  }) as never)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.clearAllMocks()
  answers = {}
  notes.length = 0
  cancels.length = 0
  warns.length = 0
  promptsShown.length = 0
})

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(cwd, { recursive: true, force: true })
})

async function run(flags: CliFlags, positional?: string): Promise<ProjectOptions> {
  const { run } = await import('../src/cli')
  notes.length = 0
  await run(flags, positional)
  const note = notes.find((n) => n.title?.startsWith('Dry run'))
  if (!note) throw new Error('run() did not print the dry-run note')
  return JSON.parse(note.message) as ProjectOptions
}

async function expectBail(flags: CliFlags, pattern: RegExp, positional?: string) {
  const { run } = await import('../src/cli')
  await expect(run(flags, positional)).rejects.toThrow(ExitError)
  expect(cancels.join('\n')).toMatch(pattern)
}

describe('--defaults', () => {
  it('resolves every option without a single prompt', async () => {
    const options = await run(baseFlags({ defaults: true }))
    expect(promptsShown).toEqual([])
    expect(options).toEqual({
      name: 'my-saas',
      slug: 'my-saas',
      directory: path.join(cwd, 'my-saas'),
      db: 'postgres',
      connectionString: 'postgres://postgres:<password>@127.0.0.1:5432/my-saas',
      authMethods: ['email-password', 'magic-link', 'passkey'],
      social: [],
      organizations: true,
      billing: 'organization',
      storage: 'none',
      emails: true,
      consent: true,
      packageManager: 'pnpm',
      install: true,
      git: true,
    })
  })

  it('keeps flags that were given and defaults the rest', async () => {
    const options = await run(baseFlags({ defaults: true, db: 'sqlite', organizations: false, storage: 's3', install: false, git: false }), 'Ridge Line')
    expect(options).toMatchObject({
      name: 'Ridge Line',
      slug: 'ridge-line',
      directory: path.join(cwd, 'ridge-line'),
      db: 'sqlite',
      connectionString: 'file:./ridge-line.db',
      organizations: false,
      // Per-organization billing is impossible without organizations; defaults fall back to per user.
      billing: 'user',
      storage: 's3',
      install: false,
      git: false,
    })
  })

  it('writes nothing on a dry run', async () => {
    await run(baseFlags({ defaults: true }), 'dry')
    expect(existsSync(path.join(cwd, 'dry'))).toBe(false)
  })
})

describe('flags', () => {
  it('--name wins over the positional name', async () => {
    const options = await run(baseFlags({ defaults: true, name: 'flagged' }), 'positional')
    expect(options.name).toBe('flagged')
  })

  it('parses --auth and --social lists; giving one leaves the other empty or default', async () => {
    const both = await run(baseFlags({ defaults: true, auth: 'email-password, passkey', social: 'github,google' }))
    expect(both.authMethods).toEqual(['email-password', 'passkey'])
    expect(both.social).toEqual(['github', 'google'])

    const onlyAuth = await run(baseFlags({ defaults: true, auth: 'magic-link' }))
    expect(onlyAuth.authMethods).toEqual(['magic-link'])
    expect(onlyAuth.social).toEqual([])

    const onlySocial = await run(baseFlags({ defaults: true, social: 'google' }))
    expect(onlySocial.authMethods).toEqual(['email-password', 'magic-link', 'passkey'])
    expect(onlySocial.social).toEqual(['google'])
  })

  it('accepts every billing mode with organizations and only user/none without', async () => {
    for (const billing of ['organization', 'user', 'none'] as const) {
      expect((await run(baseFlags({ defaults: true, billing }))).billing).toBe(billing)
    }
    for (const billing of ['user', 'none'] as const) {
      expect((await run(baseFlags({ defaults: true, organizations: false, billing }))).billing).toBe(billing)
    }
  })

  it('accepts every storage adapter', async () => {
    const { STORAGE_KEYS } = await import('../src/storage')
    for (const storage of STORAGE_KEYS) {
      expect((await run(baseFlags({ defaults: true, storage }))).storage).toBe(storage)
    }
  })

  it('uses the connection string flag verbatim', async () => {
    const options = await run(baseFlags({ defaults: true, db: 'mongodb', connectionString: 'mongodb+srv://u:p@cluster/db' }))
    expect(options.connectionString).toBe('mongodb+srv://u:p@cluster/db')
  })

  it('takes the package manager from the flag', async () => {
    expect((await run(baseFlags({ defaults: true, packageManager: 'bun' }))).packageManager).toBe('bun')
  })
})

describe('validation', () => {
  it('refuses a non-empty target directory', async () => {
    mkdirSync(path.join(cwd, 'taken'))
    writeFileSync(path.join(cwd, 'taken', 'file.txt'), 'x')
    await expectBail(baseFlags({ defaults: true }), /Directory \.\/taken already exists and is not empty/, 'taken')
  })

  it('allows a directory that only holds .git or .DS_Store', async () => {
    mkdirSync(path.join(cwd, 'fresh', '.git'), { recursive: true })
    writeFileSync(path.join(cwd, 'fresh', '.DS_Store'), '')
    expect((await run(baseFlags({ defaults: true }), 'fresh')).slug).toBe('fresh')
  })

  it('rejects an unknown database', async () => {
    await expectBail(baseFlags({ defaults: true, db: 'oracle' }), /Unknown database "oracle"\. Allowed: postgres, mongodb, sqlite, vercel-postgres/)
  })

  it('rejects unknown auth methods and social providers', async () => {
    await expectBail(baseFlags({ defaults: true, auth: 'email-password,sms' }), /Unknown value "sms" for --auth\. Allowed: email-password, magic-link, passkey/)
    await expectBail(baseFlags({ defaults: true, social: 'facebook' }), /Unknown value "facebook" for --social\. Allowed: google, github/)
  })

  it('rejects an unknown billing mode and organization billing without organizations', async () => {
    await expectBail(baseFlags({ defaults: true, billing: 'paddle' }), /Unknown value "paddle" for --billing\. Allowed: organization, user, none/)
    await expectBail(baseFlags({ defaults: true, organizations: false, billing: 'organization' }), /--billing organization requires organizations/)
  })

  it('rejects an unknown storage adapter', async () => {
    await expectBail(baseFlags({ defaults: true, storage: 'dropbox' }), /Unknown value "dropbox" for --storage\. Allowed: none, vercel-blob, s3, r2, azure, gcs, uploadthing/)
  })
})

describe('prompts', () => {
  it('asks every question in order and maps the answers', async () => {
    answers = {
      'Project name': 'Prompted App',
      Database: 'sqlite',
      'Connection string': 'file:./custom.db',
      'Sign-in methods': ['email-password', 'github'],
      'Organizations (teams)': true,
      Billing: 'none',
      'Media storage': 'vercel-blob',
      'Transactional emails': true,
      'Cookie consent and legal pages': true,
    }
    const options = await run(baseFlags())
    expect(promptsShown).toEqual(['Project name', 'Database', 'Connection string', 'Sign-in methods', 'Organizations (teams)', 'Billing', 'Media storage', 'Transactional emails', 'Cookie consent and legal pages'])
    expect(options).toMatchObject({
      name: 'Prompted App',
      slug: 'prompted-app',
      db: 'sqlite',
      connectionString: 'file:./custom.db',
      authMethods: ['email-password'],
      social: ['github'],
      organizations: true,
      billing: 'none',
      storage: 'vercel-blob',
    })
  })

  it('skips the prompts whose flags were given', async () => {
    answers = { 'Sign-in methods': ['passkey'], 'Media storage': 'none', 'Transactional emails': true, 'Cookie consent and legal pages': true }
    const options = await run(baseFlags({ db: 'postgres', connectionString: 'postgres://x', organizations: false, billing: 'user' }), 'flagged')
    expect(promptsShown).toEqual(['Sign-in methods', 'Media storage', 'Transactional emails', 'Cookie consent and legal pages'])
    expect(options.authMethods).toEqual(['passkey'])
    expect(options.billing).toBe('user')
  })

  it('adds email + password when only social methods were picked (the Payload admin needs one)', async () => {
    answers = {
      'Project name': 'x',
      Database: 'postgres',
      'Connection string': 'postgres://x',
      'Sign-in methods': ['google'],
      'Organizations (teams)': false,
      Billing: 'none',
      'Media storage': 'none',
      'Transactional emails': true,
      'Cookie consent and legal pages': true,
    }
    const options = await run(baseFlags())
    expect(options.authMethods).toEqual(['email-password'])
    expect(options.social).toEqual(['google'])
    expect(warns.join('\n')).toMatch(/adding email \+ password/)
  })

  it('takes --emails / --no-emails without asking', async () => {
    answers = { 'Sign-in methods': ['passkey'], 'Media storage': 'none', 'Cookie consent and legal pages': true }
    const flags = { db: 'postgres', connectionString: 'postgres://x', organizations: false, billing: 'user' }
    const on = await run(baseFlags({ ...flags, emails: true }), 'with-emails')
    expect(on.emails).toBe(true)
    expect(promptsShown).not.toContain('Transactional emails')
    const off = await run(baseFlags({ ...flags, emails: false }), 'without-emails')
    expect(off.emails).toBe(false)
    expect(promptsShown).not.toContain('Transactional emails')
  })

  it('takes --consent / --no-consent without asking', async () => {
    answers = { 'Sign-in methods': ['passkey'], 'Media storage': 'none', 'Transactional emails': true }
    const flags = { db: 'postgres', connectionString: 'postgres://x', organizations: false, billing: 'user' }
    const on = await run(baseFlags({ ...flags, consent: true }), 'with-consent')
    expect(on.consent).toBe(true)
    expect(promptsShown).not.toContain('Cookie consent and legal pages')
    const off = await run(baseFlags({ ...flags, consent: false }), 'without-consent')
    expect(off.consent).toBe(false)
    expect(promptsShown).not.toContain('Cookie consent and legal pages')
  })

  it('does not offer per-organization billing when organizations are off', async () => {
    const prompts = await import('@clack/prompts')
    answers = {
      'Project name': 'x',
      Database: 'postgres',
      'Connection string': 'postgres://x',
      'Sign-in methods': ['email-password'],
      'Organizations (teams)': false,
      Billing: 'none',
      'Media storage': 'none',
      'Transactional emails': true,
      'Cookie consent and legal pages': true,
    }
    await run(baseFlags())
    const billingPrompt = (prompts.select as unknown as { mock: { calls: Array<[{ message: string; options: Array<{ value: string }> }]> } }).mock.calls.find(
      ([opts]) => opts.message === 'Billing',
    )
    expect(billingPrompt?.[0].options.map((o) => o.value)).toEqual(['user', 'none'])
  })

  it('stops cleanly when a prompt is cancelled', async () => {
    const prompts = (await import('@clack/prompts')) as unknown as { __CANCEL: symbol }
    answers = { 'Project name': prompts.__CANCEL }
    await expectBail(baseFlags(), /Cancelled/)
  })
})
