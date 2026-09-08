/**
 * src/args.ts: argv → CliFlags. Every flag, alias and negation the help text documents.
 */
import { describe, expect, it } from 'vitest'

import { helpText, parse } from '../src/args'
import { DB_KEYS } from '../src/databases'
import { STORAGE_KEYS } from '../src/storage'

describe('parse', () => {
  it('returns every default when nothing is passed', () => {
    expect(parse([])).toEqual({
      flags: {
        name: undefined,
        db: undefined,
        connectionString: undefined,
        auth: undefined,
        social: undefined,
        organizations: undefined,
        billing: undefined,
        storage: undefined,
        emails: undefined,
        consent: undefined,
        packageManager: undefined,
        install: true,
        git: true,
        defaults: false,
        branch: 'main',
        localTemplate: undefined,
        dryRun: false,
        help: false,
        version: false,
      },
      positional: undefined,
    })
  })

  it('reads the project name from the positional or --name / -n', () => {
    expect(parse(['ridgeline']).positional).toBe('ridgeline')
    expect(parse(['--name', 'ridgeline']).flags.name).toBe('ridgeline')
    expect(parse(['-n', 'ridgeline']).flags.name).toBe('ridgeline')
    const both = parse(['positional', '-n', 'flagged'])
    expect(both.positional).toBe('positional')
    expect(both.flags.name).toBe('flagged')
  })

  it('reads every value flag', () => {
    const { flags } = parse([
      '--db', 'sqlite',
      '--db-connection-string', 'file:./x.db',
      '--auth', 'email-password,passkey',
      '--social', 'github',
      '--billing', 'user',
      '--storage', 's3',
      '--branch', 'v1.0.0',
      '--local-template', '../templates/payload-stack',
    ])
    expect(flags).toMatchObject({
      db: 'sqlite',
      connectionString: 'file:./x.db',
      auth: 'email-password,passkey',
      social: 'github',
      billing: 'user',
      storage: 's3',
      branch: 'v1.0.0',
      localTemplate: '../templates/payload-stack',
    })
    expect(parse(['-d', 'mongodb']).flags.db).toBe('mongodb')
  })

  it('reads boolean flags and their negations', () => {
    expect(parse(['--organizations']).flags.organizations).toBe(true)
    expect(parse(['--no-organizations']).flags.organizations).toBe(false)
    expect(parse(['--no-install']).flags.install).toBe(false)
    expect(parse(['--no-git']).flags.git).toBe(false)
    expect(parse(['--emails']).flags.emails).toBe(true)
    expect(parse(['--no-emails']).flags.emails).toBe(false)
    expect(parse(['--consent']).flags.consent).toBe(true)
    expect(parse(['--no-consent']).flags.consent).toBe(false)
    expect(parse(['--defaults']).flags.defaults).toBe(true)
    expect(parse(['-y']).flags.defaults).toBe(true)
    expect(parse(['--dry-run']).flags.dryRun).toBe(true)
    expect(parse(['--help']).flags.help).toBe(true)
    expect(parse(['-h']).flags.help).toBe(true)
    expect(parse(['--version']).flags.version).toBe(true)
    expect(parse(['-v']).flags.version).toBe(true)
  })

  it('maps the package manager flags, first match wins in the documented order', () => {
    expect(parse(['--use-pnpm']).flags.packageManager).toBe('pnpm')
    expect(parse(['--use-npm']).flags.packageManager).toBe('npm')
    expect(parse(['--use-yarn']).flags.packageManager).toBe('yarn')
    expect(parse(['--use-bun']).flags.packageManager).toBe('bun')
    expect(parse(['--use-bun', '--use-npm']).flags.packageManager).toBe('npm')
    expect(parse(['--use-yarn', '--use-pnpm']).flags.packageManager).toBe('pnpm')
  })

  it('rejects unknown flags and flags without a value', () => {
    expect(() => parse(['--nope'])).toThrow(/Unknown option/)
    expect(() => parse(['--db'])).toThrow(/argument missing|requires/i)
  })

  it('leaves validation of values to the prompts (any string is accepted here)', () => {
    expect(parse(['--db', 'oracle']).flags.db).toBe('oracle')
    expect(parse(['--billing', 'paddle']).flags.billing).toBe('paddle')
  })
})

describe('helpText', () => {
  const help = helpText('9.9.9')

  it('shows the version and documents every flag parse accepts', () => {
    expect(help).toContain('v9.9.9')
    for (const flag of [
      '-n, --name',
      '-d, --db',
      '--db-connection-string',
      '--auth',
      '--social',
      '--organizations',
      '--no-organizations',
      '--billing',
      '--storage',
      '--emails',
      '--no-emails',
      '--consent',
      '--no-consent',
      '--use-pnpm',
      '--use-npm',
      '--use-yarn',
      '--use-bun',
      '--no-install',
      '--no-git',
      '-y, --defaults',
      '--branch',
      '--local-template',
      '--dry-run',
      '-h, --help',
      '-v, --version',
    ]) {
      expect(help, flag).toContain(flag)
    }
  })

  it('lists the real database and storage choices', () => {
    expect(help).toContain(DB_KEYS.join(' | '))
    expect(help).toContain(STORAGE_KEYS.join(' | '))
    expect(help).toContain('organization | user | none')
    expect(help).toContain('email-password, magic-link, passkey')
  })

  it('points at the documentation', () => {
    expect(help).toContain('https://payload.solutions/docs/payload-stack')
  })
})
