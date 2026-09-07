/**
 * src/utils.ts (slugs, secrets, directory checks, package manager detection and commands) and
 * src/template.ts (tarball download with a mocked fetch, local template copy).
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import * as tar from 'tar'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { REPO, TEMPLATE_PATH, copyLocalTemplate, downloadTemplate } from '../src/template'
import { detectPackageManager, generateSecret, installCommand, isDirectoryEmpty, runCommand, slugify } from '../src/utils'

describe('slugify', () => {
  it.each([
    ['Ridgeline', 'ridgeline'],
    ['Ridge Line', 'ridge-line'],
    ["Ridge's Line", 'ridges-line'],
    ['  padded  ', 'padded'],
    ['Ünïcödé Näme', 'uenicoede-naeme'], // @sindresorhus/slugify transliterates (German-style umlauts)
    ['--leading-and-trailing--', 'leading-and-trailing'],
    ['UPPER_snake_case', 'upper-snake-case'],
    ['already-a-slug', 'already-a-slug'],
  ])('%j → %j', (input, expected) => {
    expect(slugify(input)).toBe(expected)
  })

  it('falls back to my-saas when nothing usable is left', () => {
    expect(slugify('')).toBe('my-saas')
    expect(slugify('   ')).toBe('my-saas')
    expect(slugify('---')).toBe('my-saas')
  })
})

describe('generateSecret', () => {
  it('produces url-safe base64 of the requested entropy, different every time', () => {
    const a = generateSecret()
    const b = generateSecret()
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(a).not.toBe(b)
    expect(generateSecret(24).length).toBe(32)
    expect(generateSecret(32).length).toBe(43)
  })
})

describe('isDirectoryEmpty', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'cps-utils-'))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('is true for a missing or empty directory and one holding only .git / .DS_Store', () => {
    expect(isDirectoryEmpty(path.join(dir, 'missing'))).toBe(true)
    expect(isDirectoryEmpty(dir)).toBe(true)
    mkdirSync(path.join(dir, '.git'))
    writeFileSync(path.join(dir, '.DS_Store'), '')
    expect(isDirectoryEmpty(dir)).toBe(true)
  })

  it('is false once any other entry exists', () => {
    writeFileSync(path.join(dir, 'README.md'), '')
    expect(isDirectoryEmpty(dir)).toBe(false)
  })
})

describe('package manager commands', () => {
  it('installCommand', () => {
    expect(installCommand('pnpm')).toBe('pnpm install')
    expect(installCommand('npm')).toBe('npm install')
    expect(installCommand('yarn')).toBe('yarn')
    expect(installCommand('bun')).toBe('bun install')
  })

  it('runCommand', () => {
    expect(runCommand('pnpm', 'dev')).toBe('pnpm dev')
    expect(runCommand('npm', 'dev')).toBe('npm run dev')
    expect(runCommand('yarn', 'dev')).toBe('yarn dev')
    expect(runCommand('bun', 'dev')).toBe('bun dev')
  })

  it('detectPackageManager trusts the launching agent for pnpm, yarn and bun', async () => {
    for (const [agent, expected] of [
      ['pnpm/10.0.0 npm/? node/v22', 'pnpm'],
      ['yarn/4.0.0 npm/? node/v22', 'yarn'],
      ['bun/1.1.0 npm/? node/v22', 'bun'],
    ] as const) {
      vi.stubEnv('npm_config_user_agent', agent)
      expect(await detectPackageManager()).toBe(expected)
    }
    vi.unstubAllEnvs()
  })

  it('detectPackageManager prefers pnpm when npx launched it and pnpm is installed, npm otherwise', async () => {
    vi.stubEnv('npm_config_user_agent', 'npm/10.0.0 node/v22')
    const detected = await detectPackageManager()
    expect(['pnpm', 'npm']).toContain(detected)
    vi.unstubAllEnvs()
  })
})

/** Builds a gzipped tarball in memory with the given files (paths relative to the archive root). */
async function tarball(files: Record<string, string>): Promise<Buffer> {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'cps-tar-'))
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    writeFileSync(path.join(dir, rel), content)
  }
  const out = path.join(dir, 'archive.tgz')
  await tar.c({ gzip: true, cwd: dir, file: out }, Object.keys(files).map((f) => f.split('/')[0]!).filter((v, i, a) => a.indexOf(v) === i))
  const buffer = readFileSync(out)
  rmSync(dir, { recursive: true, force: true })
  return buffer
}

describe('downloadTemplate', () => {
  let dest: string
  beforeEach(() => {
    dest = path.join(mkdtempSync(path.join(os.tmpdir(), 'cps-dl-')), 'project')
  })
  afterEach(() => {
    vi.restoreAllMocks()
    rmSync(path.dirname(dest), { recursive: true, force: true })
  })

  it('fetches the repo tarball for the branch and extracts only the template directory', async () => {
    const archive = await tarball({
      'payload-solutions-main/README.md': 'repo readme',
      'payload-solutions-main/packages/create-payload-stack/package.json': '{}',
      [`payload-solutions-main/${TEMPLATE_PATH}/package.json`]: '{"name":"payload-stack"}',
      [`payload-solutions-main/${TEMPLATE_PATH}/src/stack.config.ts`]: 'export default {}',
      [`payload-solutions-main/${TEMPLATE_PATH}/src/nested/deep/file.ts`]: 'deep',
    })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(archive, { status: 200 }))

    await downloadTemplate({ dest, branch: 'main' })

    expect(fetchMock).toHaveBeenCalledWith(`https://codeload.github.com/${REPO}/tar.gz/main`, expect.objectContaining({ headers: { 'User-Agent': 'create-payload-stack' } }))
    expect(readFileSync(path.join(dest, 'package.json'), 'utf8')).toBe('{"name":"payload-stack"}')
    expect(readFileSync(path.join(dest, 'src/stack.config.ts'), 'utf8')).toBe('export default {}')
    expect(readFileSync(path.join(dest, 'src/nested/deep/file.ts'), 'utf8')).toBe('deep')
    expect(existsSync(path.join(dest, 'README.md'))).toBe(false)
    expect(existsSync(path.join(dest, 'packages'))).toBe(false)
    expect(existsSync(path.join(dest, 'templates'))).toBe(false)
  })

  it('encodes the branch or tag in the url', async () => {
    const archive = await tarball({ [`payload-solutions-v1.2.3/${TEMPLATE_PATH}/package.json`]: '{}' })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(archive, { status: 200 }))
    await downloadTemplate({ dest, branch: 'feat/next' })
    expect(fetchMock.mock.calls[0]![0]).toBe(`https://codeload.github.com/${REPO}/tar.gz/feat%2Fnext`)
  })

  it('explains a failed download and suggests --local-template', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not found', { status: 404, statusText: 'Not Found' }))
    await expect(downloadTemplate({ dest, branch: 'main' })).rejects.toThrow(/Could not download the template \(404 Not Found\)[\s\S]*--local-template/)
  })

  it('fails when the archive does not contain the template', async () => {
    const archive = await tarball({ 'payload-solutions-main/README.md': 'only a readme' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(archive, { status: 200 }))
    await expect(downloadTemplate({ dest, branch: 'main' })).rejects.toThrow(new RegExp(`did not contain ${TEMPLATE_PATH.replace('/', '\\/')}/package.json`))
  })
})

describe('copyLocalTemplate', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), 'cps-copy-'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('copies the checkout without build output, secrets, test results or agent files', async () => {
    const source = path.join(root, 'source')
    for (const rel of [
      'package.json',
      'src/stack.config.ts',
      'src/app/(frontend)/page.tsx',
      'tests/e2e/a.spec.ts',
      'node_modules/dep/index.js',
      '.next/cache/x',
      '.turbo/x',
      '.env',
      '.env.example',
      'test-results/x',
      'playwright-report/x',
      'next-env.d.ts',
      'tsconfig.tsbuildinfo',
      'CLAUDE.md',
      'AGENTS.md',
    ]) {
      mkdirSync(path.dirname(path.join(source, rel)), { recursive: true })
      writeFileSync(path.join(source, rel), rel)
    }
    const dest = path.join(root, 'dest')
    await copyLocalTemplate({ from: source, dest })

    for (const kept of ['package.json', 'src/stack.config.ts', 'src/app/(frontend)/page.tsx', 'tests/e2e/a.spec.ts', '.env.example', 'AGENTS.md']) {
      expect(existsSync(path.join(dest, kept)), kept).toBe(true)
    }
    for (const dropped of ['node_modules', '.next', '.turbo', '.env', 'test-results', 'playwright-report', 'next-env.d.ts', 'tsconfig.tsbuildinfo', 'CLAUDE.md']) {
      expect(existsSync(path.join(dest, dropped)), dropped).toBe(false)
    }
  })

  it('refuses a directory without package.json', async () => {
    const source = path.join(root, 'empty')
    mkdirSync(source)
    await expect(copyLocalTemplate({ from: source, dest: path.join(root, 'dest') })).rejects.toThrow(/--local-template must point at a directory containing package.json/)
  })
})
