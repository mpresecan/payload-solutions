/**
 * src/consent.ts: the optional Payload Consent step.
 *
 * The step has no markers to check, because the seam is a module: both branches of `src/consent`
 * export the same names, so payload.config.ts, the frontend layout, the footer, the /legal route
 * and the homepage are the template's own files in either project. What is checked here is that
 * the two branches really do line up, and that the dependency swap is total in both directions.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { CONSENT_PACKAGE, CONSENT_PACKAGES, CONSENT_REACT_PACKAGE, CONSENT_VERSION, swapConsentPackages } from '../src/consent'
import { stripWorkspaceDependencies } from '../src/configure'
import { VARIANT_DIR } from '../src/variants'

const templateDir = path.resolve(__dirname, '../../../templates/payload-stack')
const variantDir = path.join(templateDir, VARIANT_DIR, 'consent-plugin')
const packageJson = JSON.parse(readFileSync(path.join(templateDir, 'package.json'), 'utf8')) as Record<string, unknown>

/** Every file the seam is made of, by the name it has in both branches. */
const SEAM = ['plugin.ts', 'collections.ts', 'seed.ts', 'consent-root.tsx', 'consent-settings-link.tsx', 'legal-page.tsx', 'legal-setup-notice.tsx']

const exportedNames = (source: string) =>
  [...source.matchAll(/export (?:const|function|async function) (\w+)/g)].map((m) => m[1]).sort()

describe('the template ships both branches', () => {
  it('keeps the un-plugged seam in src/consent and the plugin branch in variants', () => {
    for (const file of SEAM) {
      expect(existsSync(path.join(templateDir, 'src/consent', file)), file).toBe(true)
      expect(existsSync(path.join(variantDir, file)), `variant ${file}`).toBe(true)
    }
    // The banner is copied into the project rather than imported, so it can be restyled freely.
    for (const file of ['consent-banner.tsx', 'consent-preferences-dialog.tsx', 'tests/consent.spec.ts']) {
      expect(existsSync(path.join(variantDir, file)), `variant ${file}`).toBe(true)
    }
    // The branch the plugin replaces.
    for (const file of ['src/collections/LegalPages.ts', 'src/seed/legal.ts']) {
      expect(existsSync(path.join(templateDir, file)), file).toBe(true)
    }
  })

  it.each(SEAM)('%s exports the same names in both branches, so the call sites never change', (file) => {
    expect(exportedNames(readFileSync(path.join(templateDir, 'src/consent', file), 'utf8'))).toEqual(
      exportedNames(readFileSync(path.join(variantDir, file), 'utf8')),
    )
  })

  it('carries both packages as devDependencies only, so variants/ typechecks in the monorepo', () => {
    const devDeps = packageJson.devDependencies as Record<string, string>
    const deps = packageJson.dependencies as Record<string, string>
    for (const pkg of Object.keys(CONSENT_PACKAGES)) {
      expect(devDeps[pkg], pkg).toBe('workspace:*')
      expect(deps[pkg], pkg).toBeUndefined()
    }
  })
})

describe('swapConsentPackages', () => {
  it('adds both packages as real dependencies when consent is on', () => {
    const result = swapConsentPackages(packageJson, true) as { dependencies: Record<string, string>; devDependencies: Record<string, string> }
    expect(result.dependencies[CONSENT_PACKAGE]).toBe(CONSENT_VERSION)
    expect(result.dependencies[CONSENT_REACT_PACKAGE]).toBe(CONSENT_VERSION)
    // Never both: a workspace protocol resolves nowhere outside this repo.
    expect(result.devDependencies[CONSENT_PACKAGE]).toBeUndefined()
    expect(result.devDependencies[CONSENT_REACT_PACKAGE]).toBeUndefined()
    expect(Object.keys(result.dependencies)).toEqual([...Object.keys(result.dependencies)].sort())
  })

  it('removes every trace when consent is off', () => {
    const result = swapConsentPackages(packageJson, false) as { dependencies: Record<string, string>; devDependencies: Record<string, string> }
    for (const pkg of Object.keys(CONSENT_PACKAGES)) {
      expect(result.dependencies[pkg]).toBeUndefined()
      expect(result.devDependencies[pkg]).toBeUndefined()
    }
  })

  it('is total: applying either answer to either result gives the same thing', () => {
    const on = swapConsentPackages(packageJson, true)
    const off = swapConsentPackages(packageJson, false)
    expect(swapConsentPackages(off, true)).toEqual(on)
    expect(swapConsentPackages(on, false)).toEqual(off)
    // Idempotent, so a re-run never doubles a dependency or drops one.
    expect(swapConsentPackages(on, true)).toEqual(on)
    expect(swapConsentPackages(off, false)).toEqual(off)
  })

  it('leaves nothing with a workspace protocol behind either answer', () => {
    for (const enabled of [true, false]) {
      const result = stripWorkspaceDependencies(swapConsentPackages(packageJson, enabled)) as {
        dependencies: Record<string, string>
        devDependencies: Record<string, string>
      }
      for (const version of Object.values({ ...result.dependencies, ...result.devDependencies })) {
        expect(version.startsWith('workspace:')).toBe(false)
      }
      // Stripping must not take the pinned versions with it.
      expect(Object.keys(result.dependencies).includes(CONSENT_PACKAGE)).toBe(enabled)
    }
  })
})
