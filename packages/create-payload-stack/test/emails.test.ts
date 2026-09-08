/**
 * src/emails.ts: the optional Payload Emails step.
 *
 * The transformations are pure over file contents, so both answers are checked against the real
 * template: the plugin lands between the markers in payload.config.ts, the dependency set follows
 * the branch, and nothing with a workspace protocol survives into a scaffolded project.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { stripWorkspaceDependencies } from '../src/configure'
import {
  addEmailsPlugin,
  EMAIL_DEV_SCRIPT,
  EMAILS_PACKAGE,
  EMAILS_VERSION,
  REACT_EMAIL_COMPONENTS,
  REACT_EMAIL_ONLY_PACKAGES,
  swapEmailsPackages,
  VARIANT_DIR,
} from '../src/emails'

const templateDir = path.resolve(__dirname, '../../../templates/payload-stack')
const payloadConfig = readFileSync(path.join(templateDir, 'src/payload.config.ts'), 'utf8')
const packageJson = JSON.parse(readFileSync(path.join(templateDir, 'package.json'), 'utf8')) as Record<string, unknown>

describe('the template ships both branches', () => {
  it('keeps the un-plugged emails in src and the plugin branch in variants', () => {
    for (const file of ['src/emails/index.ts', 'src/emails/send.ts', 'src/emails/hooks.ts']) {
      expect(existsSync(path.join(templateDir, file)), file).toBe(true)
    }
    for (const file of ['index.ts', 'hooks.ts', 'template.tsx', 'variables.ts', 'definitions/index.ts', 'tests/emails.spec.ts']) {
      expect(existsSync(path.join(templateDir, VARIANT_DIR, 'emails-plugin', file)), file).toBe(true)
    }
  })

  it('exports the same hook bundles from both branches, so the call sites never change', () => {
    const names = (source: string) => [...source.matchAll(/export (?:const|async function) (\w+)/g)].map((m) => m[1]).sort()
    expect(names(readFileSync(path.join(templateDir, 'src/emails/hooks.ts'), 'utf8'))).toEqual(
      names(readFileSync(path.join(templateDir, VARIANT_DIR, 'emails-plugin/hooks.ts'), 'utf8')),
    )
  })
})

describe('addEmailsPlugin', () => {
  const result = addEmailsPlugin(payloadConfig)

  it('imports the plugin and registers it between the markers', () => {
    expect(result).toContain(`import { emailsPlugin } from '${EMAILS_PACKAGE}'`)
    expect(result).toContain('emailsPlugin({')
    const start = result.indexOf('// emails-plugin-config-start')
    const end = result.indexOf('// emails-plugin-config-end')
    expect(result.slice(start, end)).toContain('plugins.push(')
    // Registered after Better Auth and the multi-tenant plugin, before the config is built.
    expect(start).toBeGreaterThan(result.indexOf('betterAuthPlugin('))
    expect(end).toBeLessThan(result.indexOf('export default buildConfig('))
  })

  it('passes the catalogue, the template and the global variables', () => {
    for (const value of ['emailDefinitions', 'StackEmailTemplate', 'globalVariables', 'globalVariableManifest']) {
      expect(result).toContain(value)
    }
  })

  it('leaves the markers in place so the choice can be re-applied', () => {
    expect(result).toContain('// emails-plugin-import')
    expect(addEmailsPlugin(result)).toContain('emailsPlugin({')
  })

  it('refuses a config without the markers', () => {
    expect(() => addEmailsPlugin('export default {}')).toThrow(/emails-plugin-import/)
  })
})

describe('swapEmailsPackages', () => {
  it('adds the plugin and the React Email primitives, and drops the standalone preview', () => {
    const result = swapEmailsPackages(packageJson, true)
    const deps = result.dependencies as Record<string, string>
    expect(deps[EMAILS_PACKAGE]).toBe(EMAILS_VERSION)
    expect(deps[REACT_EMAIL_COMPONENTS[0]]).toBe(REACT_EMAIL_COMPONENTS[1])
    for (const pkg of Object.keys(REACT_EMAIL_ONLY_PACKAGES)) expect(deps[pkg]).toBeUndefined()
    expect((result.scripts as Record<string, string>)[EMAIL_DEV_SCRIPT[0]]).toBeUndefined()
  })

  it('keeps the React Email branch intact when emails are off', () => {
    const result = swapEmailsPackages(packageJson, false)
    const deps = result.dependencies as Record<string, string>
    expect(deps[EMAILS_PACKAGE]).toBeUndefined()
    expect(deps[REACT_EMAIL_COMPONENTS[0]]).toBeUndefined()
    for (const [pkg, version] of Object.entries(REACT_EMAIL_ONLY_PACKAGES)) expect(deps[pkg]).toBe(version)
    expect((result.scripts as Record<string, string>)[EMAIL_DEV_SCRIPT[0]]).toBe(EMAIL_DEV_SCRIPT[1])
  })

  it('never leaves the template devDependencies behind, either way', () => {
    for (const enabled of [true, false]) {
      const devDeps = swapEmailsPackages(packageJson, enabled).devDependencies as Record<string, string>
      expect(devDeps[EMAILS_PACKAGE]).toBeUndefined()
      expect(devDeps[REACT_EMAIL_COMPONENTS[0]]).toBeUndefined()
    }
  })

  it('is repeatable: applying the other answer replaces the first, in both directions', () => {
    expect(swapEmailsPackages(swapEmailsPackages(packageJson, true), false)).toEqual(
      swapEmailsPackages(packageJson, false),
    )
    expect(swapEmailsPackages(swapEmailsPackages(packageJson, false), true)).toEqual(
      swapEmailsPackages(packageJson, true),
    )
  })

  it('writes back exactly what the un-plugged template ships, so the versions cannot drift', () => {
    const deps = packageJson.dependencies as Record<string, string>
    const scripts = packageJson.scripts as Record<string, string>
    for (const [pkg, version] of Object.entries(REACT_EMAIL_ONLY_PACKAGES)) expect(deps[pkg]).toBe(version)
    expect(scripts[EMAIL_DEV_SCRIPT[0]]).toBe(EMAIL_DEV_SCRIPT[1])
  })
})

describe('stripWorkspaceDependencies', () => {
  it('removes workspace protocol versions and leaves the rest alone', () => {
    const result = stripWorkspaceDependencies({
      dependencies: { payload: '3.88.0', local: 'workspace:*' },
      devDependencies: { typescript: '5.7.3', other: 'workspace:^' },
    })
    expect(result.dependencies).toEqual({ payload: '3.88.0' })
    expect(result.devDependencies).toEqual({ typescript: '5.7.3' })
  })

  it('leaves nothing resolvable only inside the monorepo in the template', () => {
    const stripped = stripWorkspaceDependencies(swapEmailsPackages(packageJson, true))
    const all = Object.values({
      ...(stripped.dependencies as Record<string, string>),
      ...(stripped.devDependencies as Record<string, string>),
    })
    expect(all.some((version) => version.startsWith('workspace:'))).toBe(false)
  })
})
