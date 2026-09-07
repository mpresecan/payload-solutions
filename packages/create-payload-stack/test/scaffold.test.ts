/**
 * End to end: the built CLI (dist/index.js) scaffolds a project from the local template into a
 * temp directory for every database and storage choice, and the result is a project the template's
 * own code accepts: stack.config.ts parses with `defineStack`, payload.config.ts carries the
 * chosen adapters, package.json lists them, .env has fresh secrets, nothing that must not ship
 * (node_modules, .env from the checkout, CLAUDE.md) came along.
 *
 * Dependencies are not installed (`--no-install`) and git is skipped (`--no-git`), so a run takes
 * a few seconds per combination.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { DB_CHOICES, DB_KEYS } from '../src/databases'
import { STORAGE_CHOICES, STORAGE_KEYS } from '../src/storage'
import { defineStack } from '../../../templates/payload-stack/src/lib/stack'

const packageDir = path.resolve(__dirname, '..')
const templateDir = path.resolve(packageDir, '../../templates/payload-stack')
const bin = path.join(packageDir, 'dist/index.js')

let root: string

beforeAll(() => {
  // The test script builds first (see package.json "test"); guard against a stale checkout.
  if (!existsSync(bin)) execFileSync('pnpm', ['build'], { cwd: packageDir, stdio: 'ignore' })
  root = mkdtempSync(path.join(os.tmpdir(), 'cps-scaffold-'))
})

afterAll(() => rmSync(root, { recursive: true, force: true }))

/**
 * Strips ANSI sequences and @clack/prompts' frame (unicode box drawing on a TTY, ASCII `| + -` in
 * CI) and joins wrapped lines, so long hints can be matched as one sentence.
 */
function plain(text: string): string {
  return text
    .replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '')
    .replace(/[│┌┐└┘├┤─┬┴┼╭╮╰╯◆◇▲■□●○◐◑◒◓◔◕◻◼⚠✔✘✓]/g, ' ')
    .replace(/^\s*[|+]\s?/gm, ' ')
    // clack's ASCII step symbol (`◇` on a TTY) sits at column 0 followed by two spaces. Anchor it
    // there: a loose `o` in the class above ate the `o` of `open http://localhost:3000/admin`,
    // whose bar had already become a space.
    .replace(/^o {2}/gm, ' ')
    .replace(/\s[|+]\s*$/gm, ' ')
    .replace(/-{3,}/g, ' ')
    .replace(/\s+/g, ' ')
}

function scaffold(name: string, args: string[]) {
  const result = spawnSync(process.execPath, [bin, name, '--local-template', templateDir, '--no-install', '--no-git', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, CI: 'true', FORCE_COLOR: '0' },
  })
  const output = plain(`${result.stdout}\n${result.stderr}`)
  if (result.status !== 0) throw new Error(`create-payload-stack exited with ${result.status}: ${output}`)
  return { dir: path.join(root, name), output }
}

function evaluateStackConfig(source: string) {
  const start = source.indexOf('export default defineStack(')
  const literal = source.slice(start + 'export default defineStack('.length, source.lastIndexOf(')'))
  return defineStack(new Function('process', `return (${literal})`)({ env: {} }))
}

describe('scaffolded project', () => {
  it('matches the template file for file apart from the configured files', () => {
    const { dir, output } = scaffold('baseline', ['-d', 'postgres', '-y'])
    expect(output).toContain('Project files written')
    expect(output).toContain('cd baseline')
    expect(output).toContain('pnpm install')

    for (const file of ['package.json', 'src/stack.config.ts', 'src/payload.config.ts', '.env', '.env.example', 'AGENTS.md', 'README.md', 'tsconfig.json', 'src/lib/stack.ts', 'tests/unit/setup.ts']) {
      expect(existsSync(path.join(dir, file)), file).toBe(true)
    }
    for (const file of ['node_modules', '.next', 'CLAUDE.md', '.git', 'test-results', 'tsconfig.tsbuildinfo']) {
      expect(existsSync(path.join(dir, file)), file).toBe(false)
    }
    // Untouched files are byte-identical to the template.
    for (const file of ['src/lib/stack.ts', 'src/collections/Projects.ts', 'tsconfig.json', 'README.md']) {
      expect(readFileSync(path.join(dir, file), 'utf8')).toBe(readFileSync(path.join(templateDir, file), 'utf8'))
    }
  })

  it.each(DB_KEYS)('with the %s database', (dbKey) => {
    const db = DB_CHOICES[dbKey]
    const { dir } = scaffold(`db-${dbKey}`, ['-d', dbKey, '-y'])

    const payloadConfig = readFileSync(path.join(dir, 'src/payload.config.ts'), 'utf8')
    expect(payloadConfig).toContain(`import { ${db.importName} } from '${db.packageName}'`)
    expect(payloadConfig).toContain(`db: ${db.importName}(`)
    expect(new Set(payloadConfig.match(/@payloadcms\/db-[a-z-]+/g))).toEqual(new Set([db.packageName]))

    const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as { name: string; private: boolean; dependencies: Record<string, string> }
    expect(pkg.name).toBe(`db-${dbKey}`)
    expect(pkg.private).toBe(true)
    expect(pkg.dependencies[db.packageName]).toBe(pkg.dependencies.payload)
    expect(Object.keys(pkg.dependencies).filter((d) => d.startsWith('@payloadcms/db-'))).toEqual([db.packageName])

    const env = readFileSync(path.join(dir, '.env'), 'utf8')
    expect(env).toMatch(new RegExp(`^DATABASE_URL=${db.connectionPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}db-${dbKey}${db.connectionSuffix}$`, 'm'))
    expect(env).toMatch(/^PAYLOAD_SECRET=[A-Za-z0-9_-]{20,}$/m)
    expect(env).toMatch(/^BETTER_AUTH_SECRET=[A-Za-z0-9_-]{40,}$/m)
  })

  it.each(STORAGE_KEYS)('with %s storage', (storageKey) => {
    const { dir, output } = scaffold(`storage-${storageKey}`, ['--storage', storageKey, '-y'])
    const payloadConfig = readFileSync(path.join(dir, 'src/payload.config.ts'), 'utf8')
    const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as { dependencies: Record<string, string> }
    const storagePackages = Object.keys(pkg.dependencies).filter((d) => d.startsWith('@payloadcms/storage-'))

    if (storageKey === 'none') {
      expect(payloadConfig).toContain('// Local disk (./media)')
      expect(payloadConfig).not.toMatch(/@payloadcms\/storage-/)
      expect(storagePackages).toEqual([])
      expect(output).not.toContain('to store uploads')
    } else {
      const storage = STORAGE_CHOICES[storageKey]
      expect(payloadConfig).toContain(`import { ${storage.importName} } from '${storage.packageName}'`)
      expect(payloadConfig).toContain(`${storage.importName}({`)
      expect(storagePackages).toEqual([storage.packageName])
      expect(pkg.dependencies[storage.packageName]).toBe(pkg.dependencies.payload)
      expect(output).toContain(`to store uploads in ${storage.label}`)
      for (const envVar of storage.envVars) expect(output).toContain(envVar)
    }
  })

  it('writes the answers into a stack.config.ts the template accepts', () => {
    const { dir } = scaffold('answers', ['--auth', 'email-password,passkey', '--social', 'github', '--no-organizations', '--billing', 'user', '-y'])
    const stack = evaluateStackConfig(readFileSync(path.join(dir, 'src/stack.config.ts'), 'utf8'))
    expect(stack.name).toBe('answers')
    expect(stack.auth.methods).toEqual(['email-password', 'passkey'])
    expect(stack.auth.social).toEqual(['github'])
    expect(stack.features.organizations).toBe(false)
    expect(stack.features.billingAttachedTo).toBe('user')
    expect(stack.features.twoFactor).toBe(true)
  })

  it('a magic-link-only product without billing', () => {
    const { dir, output } = scaffold('passwordless', ['--auth', 'magic-link', '--billing', 'none', '-y'])
    const stack = evaluateStackConfig(readFileSync(path.join(dir, 'src/stack.config.ts'), 'utf8'))
    expect(stack.features).toMatchObject({ emailPassword: false, magicLink: true, passkeys: false, twoFactor: false, billing: false })
    expect(stack.nav.map((n) => n.href)).not.toContain('/pricing')
    expect(output).not.toContain('STRIPE_SECRET_KEY')
  })

  it('tells the user which secrets to add for social sign-in and billing', () => {
    const { output } = scaffold('hints', ['--social', 'google,github', '--billing', 'organization', '-y'])
    expect(output).toContain('GOOGLE_CLIENT_ID / _SECRET')
    expect(output).toContain('GITHUB_CLIENT_ID / _SECRET')
    expect(output).toContain('STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and NEXT_PUBLIC_STRIPE_PRICE_*')
    expect(output).toContain('open http://localhost:3000/admin')
  })

  it('refuses to scaffold into a non-empty directory', () => {
    scaffold('occupied', ['-y'])
    expect(() => scaffold('occupied', ['-y'])).toThrow()
  })

  it('--dry-run prints the resolved options and writes nothing', () => {
    const { dir, output } = scaffold('dry', ['-d', 'sqlite', '--storage', 'gcs', '--dry-run', '-y'])
    expect(output).toContain('Dry run: nothing written')
    expect(output).toContain('"db": "sqlite"')
    expect(output).toContain('"storage": "gcs"')
    expect(existsSync(dir)).toBe(false)
  })

  it('--help and --version work without touching the filesystem', () => {
    const help = plain(execFileSync(process.execPath, [bin, '--help'], { encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0' } }))
    expect(help).toContain('--local-template')
    expect(help).toContain('--storage')
    const version = execFileSync(process.execPath, [bin, '--version'], { encoding: 'utf8' }).trim()
    expect(version).toBe((JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8')) as { version: string }).version)
  })

  it('rejects bad flag values with a readable message and exit code 1', () => {
    expect(() => scaffold('bad-db', ['-d', 'oracle', '-y'])).toThrow(/Unknown database "oracle"/)
    expect(() => scaffold('bad-flag', ['--nope'])).toThrow(/Unknown option/)
  })
})
