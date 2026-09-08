import { cp, rm, rmdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

import { variantPath } from './variants'

/**
 * The optional Payload Consent step.
 *
 * The template ships both branches behind one seam, `src/consent`. By default that directory
 * registers the template's own `LegalPages` collection, seeds three plain documents on first boot,
 * and renders no banner. Choosing consent swaps in the branch under `variants/consent-plugin`:
 * the same exports, backed by `@payload-solutions/plugin-consent` — the cookie banner and Consent
 * Mode defaults, consent records, a processor register, generated cookie and sub-processor tables
 * inside the legal pages, and the `payload-consent` CLI that audits them.
 *
 * Because the seam is a module and not a set of markers, the files that use it — payload.config.ts,
 * the frontend layout, the footer, the /legal route and the homepage — are byte-identical in both
 * projects. Nothing here rewrites application logic; it moves files and rewrites dependencies.
 */

export const CONSENT_PACKAGE = '@payload-solutions/plugin-consent'
export const CONSENT_REACT_PACKAGE = '@payload-solutions/consent-react'
/** Pinned, like every other dependency the CLI writes. Bump with the plugin. */
export const CONSENT_VERSION = '0.1.0'

/** Both packages the plugged branch imports. `consent-core` arrives as a dependency of the React one. */
export const CONSENT_PACKAGES: Record<string, string> = {
  [CONSENT_PACKAGE]: CONSENT_VERSION,
  [CONSENT_REACT_PACKAGE]: CONSENT_VERSION,
}

const VARIANT_CONSENT = variantPath('consent-plugin')

/** The seam, swapped whole. Every name here is exported by both branches. */
const SEAM_FILES = [
  'plugin.ts',
  'collections.ts',
  'seed.ts',
  'consent-root.tsx',
  'consent-settings-link.tsx',
  'legal-page.tsx',
  'legal-setup-notice.tsx',
]

/** Banner components, copied into the project rather than imported, so they can be restyled freely. */
const BANNER_FILES = ['consent-banner.tsx', 'consent-preferences-dialog.tsx']

/**
 * Files the un-plugged branch owns and the plugin replaces: its `legal-pages` collection (the
 * plugin registers the same slug, with drafts and a document kind), the seeder the plugin does
 * itself, and the unit test for that seeder.
 */
const TEMPLATE_LEGAL_FILES = ['src/collections/LegalPages.ts', 'src/seed/legal.ts', 'tests/unit/seed-legal.spec.ts']

/**
 * Dependencies follow the branch. Running this with the other answer replaces the previous one, so
 * the choice is never half-applied.
 *
 * The template carries both packages as devDependencies purely so `variants/` typechecks inside the
 * monorepo; a scaffolded project either depends on them for real or does not have them at all.
 */
export function swapConsentPackages(packageJson: Record<string, unknown>, enabled: boolean) {
  const deps = { ...(packageJson.dependencies as Record<string, string>) }
  const devDeps = { ...(packageJson.devDependencies as Record<string, string>) }

  for (const pkg of Object.keys(CONSENT_PACKAGES)) {
    delete devDeps[pkg]
    if (enabled) deps[pkg] = CONSENT_PACKAGES[pkg]!
    else delete deps[pkg]
  }

  return { ...packageJson, dependencies: sortKeys(deps), devDependencies: sortKeys(devDeps) }
}

function sortKeys<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))) as T
}

/** Moves the chosen branch into `src/consent` and removes what the other branch owned. */
export async function applyConsentChoice(directory: string, enabled: boolean) {
  if (!enabled) return

  const variant = path.join(directory, VARIANT_CONSENT)
  if (!existsSync(variant)) {
    throw new Error(`The template is missing ${VARIANT_CONSENT}; it cannot scaffold with consent.`)
  }

  for (const name of [...SEAM_FILES, ...BANNER_FILES]) {
    await cp(path.join(variant, name), path.join(directory, 'src/consent', name), { recursive: true })
  }
  await cp(path.join(variant, 'tests/consent.spec.ts'), path.join(directory, 'tests/unit/consent.spec.ts'))

  for (const name of TEMPLATE_LEGAL_FILES) {
    await rm(path.join(directory, name), { force: true, recursive: true })
  }
  // src/seed held nothing but the legal seeder; leave no empty directory behind, but do not
  // presume to delete one the template has since put something else in.
  await rmdir(path.join(directory, 'src/seed')).catch(() => {})
}
