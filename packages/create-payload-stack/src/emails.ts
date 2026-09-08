import { cp, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

import { variantPath, VARIANT_DIR } from './variants'

/**
 * The optional Payload Emails step.
 *
 * The template ships both branches. By default `src/emails` sends React Email components straight
 * through Payload's email adapter, and `src/emails/hooks.ts` is a set of empty callbacks. Choosing
 * emails swaps in the branch under `variants/emails-plugin`: the same functions, routed through
 * `@payload-solutions/plugin-emails`, plus a full catalogue of definitions, a project-owned
 * template and the hooks that fire the rest of the messages a SaaS owes its users.
 *
 * Either way the call sites (src/lib/auth/options.ts, src/collections/Users.ts, payload.config.ts)
 * are the files the template already ships — nothing here rewrites application logic.
 */

export const EMAILS_PACKAGE = '@payload-solutions/plugin-emails'
/** Pinned, like every other dependency the CLI writes. Bump with the plugin. */
export const EMAILS_VERSION = '0.1.0'
/** React Email primitives, used directly by src/emails/template.tsx once the plugin is in. */
export const REACT_EMAIL_COMPONENTS = ['@react-email/components', '^1.0.12'] as const
/**
 * Only the un-plugged branch needs these: the preview server and the standalone renderer. Written
 * back when emails are off so the transformation is total — applying either answer to any input
 * produces the same result, exactly like the database and storage swaps.
 * `test/emails.test.ts` checks these versions still match the template.
 */
export const REACT_EMAIL_ONLY_PACKAGES: Record<string, string> = {
  '@react-email/render': '^2.1.0',
  'react-email': '^6.9.3',
}

/** The preview server the un-plugged branch ships. Replaced by Emails → Preview & test. */
export const EMAIL_DEV_SCRIPT = ['email:dev', 'email dev --dir src/components/auth/email --port 3001'] as const

/** Re-exported for the tests that check the template ships both branches. */
export { VARIANT_DIR }
/** Directory inside the template holding the plugin branch. `variants/` is removed either way. */
const VARIANT_EMAILS = variantPath('emails-plugin')

const IMPORT_MARKER = '// emails-plugin-import'
const CONFIG_START = '// emails-plugin-config-start'
const CONFIG_END = '// emails-plugin-config-end'

const IMPORTS = `${IMPORT_MARKER}
import { emailsPlugin } from '${EMAILS_PACKAGE}'
import { emailDefinitions } from '@/emails/definitions'
import { StackEmailTemplate } from '@/emails/template'
import { globalVariableManifest, globalVariables } from '@/emails/variables'`

const REGISTRATION = `plugins.push(
  emailsPlugin({
    // The catalogue, filtered by the features in stack.config.ts (src/emails/definitions).
    emails: emailDefinitions,
    // Branding lives in code; editors own the words (src/emails/template.tsx).
    templates: { default: StackEmailTemplate },
    // {{site.name}}, {{support.email}}, {{url.dashboard}} … in every email (src/emails/variables.ts).
    globalVariables,
    globalVariableManifest,
    // Every send recorded, for 90 days. Set enabled: false to keep no record at all.
    log: { enabled: true, retentionDays: 90 },
    settings: { mediaCollection: 'media' },
  }),
)`

/** Writes the plugin's import and registration into payload.config.ts, between its markers. */
export function addEmailsPlugin(payloadConfigSource: string): string {
  if (!payloadConfigSource.includes(IMPORT_MARKER)) {
    throw new Error(`payload.config.ts is missing the "${IMPORT_MARKER}" marker`)
  }
  const start = payloadConfigSource.indexOf(CONFIG_START)
  const end = payloadConfigSource.indexOf(CONFIG_END)
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`payload.config.ts is missing the emails plugin markers`)
  }
  const withImports = payloadConfigSource.replace(IMPORT_MARKER, IMPORTS)
  const at = withImports.indexOf(CONFIG_START)
  const to = withImports.indexOf(CONFIG_END)
  return `${withImports.slice(0, at)}${CONFIG_START}\n${REGISTRATION}\n${withImports.slice(to)}`
}

/**
 * Dependencies follow the branch: the plugin and the React Email primitives its template uses when
 * emails are on, the standalone renderer and preview server when they are off. Running this with
 * the other answer replaces the previous one, so the choice is never half-applied.
 */
export function swapEmailsPackages(packageJson: Record<string, unknown>, enabled: boolean) {
  const deps = { ...(packageJson.dependencies as Record<string, string>) }
  const devDeps = { ...(packageJson.devDependencies as Record<string, string>) }
  const scripts = { ...(packageJson.scripts as Record<string, string>) }

  // The template keeps both as devDependencies so `variants/` typechecks in the monorepo. A
  // scaffolded project either depends on them for real or does not have them at all.
  delete devDeps[EMAILS_PACKAGE]
  delete devDeps[REACT_EMAIL_COMPONENTS[0]]

  if (enabled) {
    deps[EMAILS_PACKAGE] = EMAILS_VERSION
    deps[REACT_EMAIL_COMPONENTS[0]] = REACT_EMAIL_COMPONENTS[1]
    for (const pkg of Object.keys(REACT_EMAIL_ONLY_PACKAGES)) delete deps[pkg]
    // The preview lives in the Payload admin now (Emails → Preview & test).
    delete scripts[EMAIL_DEV_SCRIPT[0]]
  } else {
    delete deps[EMAILS_PACKAGE]
    delete deps[REACT_EMAIL_COMPONENTS[0]]
    Object.assign(deps, REACT_EMAIL_ONLY_PACKAGES)
    scripts[EMAIL_DEV_SCRIPT[0]] = EMAIL_DEV_SCRIPT[1]
  }

  return { ...packageJson, dependencies: sortKeys(deps), devDependencies: sortKeys(devDeps), scripts: sortKeys(scripts) }
}

function sortKeys<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))) as T
}

/** Files the un-plugged branch owns, and the plugin branch replaces. */
const REACT_EMAIL_FILES = ['src/emails/send.ts', 'src/components/auth/email']

/**
 * Moves the chosen branch into place and removes the other. `variants/` itself is deleted by
 * `removeVariants` once every optional step has been applied.
 */
export async function applyEmailsChoice(directory: string, enabled: boolean) {
  const variant = path.join(directory, VARIANT_EMAILS)

  if (enabled) {
    if (!existsSync(variant)) {
      throw new Error(`The template is missing ${VARIANT_EMAILS}; it cannot scaffold with emails.`)
    }
    for (const name of ['index.ts', 'hooks.ts', 'template.tsx', 'variables.ts', 'definitions']) {
      await cp(path.join(variant, name), path.join(directory, 'src/emails', name), { recursive: true })
    }
    await cp(path.join(variant, 'tests/emails.spec.ts'), path.join(directory, 'tests/unit/emails.spec.ts'))
    for (const name of REACT_EMAIL_FILES) {
      await rm(path.join(directory, name), { force: true, recursive: true })
    }
  }
}
