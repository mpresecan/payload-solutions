#!/usr/bin/env node
/**
 * Launcher for the payload-consent CLI.
 *
 * The host project's `payload.config.ts` is TypeScript, so the CLI is started through tsx the
 * same way Payload starts its own bin — including the `registerHooks` workaround Payload
 * carries for tsx on Node ≥ 23.5, which otherwise leaks a query string onto `node:` specifiers.
 *
 * Finding tsx takes a little care. It ships as a dependency of `payload`, so under pnpm it is
 * not in the host project's node_modules at all and a bare `import('tsx/esm/api')` fails. So:
 * try the bare import, then resolve it the way Payload itself would, from wherever `payload`
 * actually lives — first next to this package, then from the project being audited.
 */
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const entry = existsSync(path.join(dirname, 'dist', 'cli', 'index.js')) ? './dist/cli/index.js' : './src/cli/index.ts'
const base = pathToFileURL(dirname).toString() + '/'
const isTypeScript = entry.endsWith('.ts')

const localRequire = createRequire(import.meta.url)
const cwdRequire = createRequire(path.join(process.cwd(), 'noop.js'))

function resolveFrom(requirer, specifier) {
  try {
    return requirer.resolve(specifier)
  } catch {
    return null
  }
}

async function loadTsImport() {
  try {
    return (await import('tsx/esm/api')).tsImport
  } catch {
    /* not hoisted; look for it where payload keeps it */
  }
  for (const requirer of [localRequire, cwdRequire]) {
    const payloadEntry = resolveFrom(requirer, 'payload')
    if (!payloadEntry) continue
    const fromPayload = createRequire(payloadEntry)
    const api = resolveFrom(fromPayload, 'tsx/esm/api') ?? resolveFrom(fromPayload, 'tsx/dist/esm/api/index.mjs')
    if (!api) continue
    try {
      return (await import(pathToFileURL(api).href)).tsImport
    } catch {
      /* try the next one */
    }
  }
  return null
}

const start = async () => {
  const nodeModule = await import('node:module')
  if (typeof nodeModule.default.registerHooks === 'function') {
    nodeModule.default.registerHooks = undefined
  }

  const tsImport = await loadTsImport()
  if (tsImport) {
    await tsImport(entry, base)
    return
  }
  if (!isTypeScript) {
    // The CLI itself is compiled; only the project's config needs transpiling. Give it a go —
    // a JavaScript payload.config.js will load fine without tsx.
    await import(new URL(entry, base).href)
    return
  }
  console.error(
    'payload-consent could not start: it needs `tsx` (a dependency of `payload`) to load your TypeScript config.\n' +
      'Run it from your project root, or use `npx payload run node_modules/@payload-solutions/plugin-consent/dist/cli/index.js scan`.',
  )
  process.exit(1)
}

void start()
