import slugifyBase from '@sindresorhus/slugify'
import { randomBytes } from 'node:crypto'
import { existsSync, readdirSync } from 'node:fs'
import { execa } from 'execa'

import type { PackageManager } from './options'

export function slugify(input: string) {
  return slugifyBase(input.trim()).replace(/^-+|-+$/g, '') || 'my-saas'
}

export function generateSecret(bytes = 32) {
  return randomBytes(bytes).toString('base64url')
}

export function isDirectoryEmpty(dir: string) {
  if (!existsSync(dir)) return true
  const entries = readdirSync(dir).filter((e) => !['.git', '.DS_Store'].includes(e))
  return entries.length === 0
}

async function commandExists(cmd: string) {
  try {
    await execa(process.platform === 'win32' ? 'where' : 'which', [cmd])
    return true
  } catch {
    return false
  }
}

/**
 * Detect the package manager, in this order: the one that launched us (npm_config_user_agent),
 * then pnpm if installed, then npm. Mirrors create-payload-app's preference for pnpm.
 */
export async function detectPackageManager(): Promise<PackageManager> {
  const agent = process.env.npm_config_user_agent ?? ''
  if (agent.startsWith('pnpm')) return 'pnpm'
  if (agent.startsWith('yarn')) return 'yarn'
  if (agent.startsWith('bun')) return 'bun'
  if (agent.startsWith('npm')) {
    // `npx create-payload-stack` reports npm even when pnpm is the developer's daily driver.
    if (await commandExists('pnpm')) return 'pnpm'
    return 'npm'
  }
  if (await commandExists('pnpm')) return 'pnpm'
  return 'npm'
}

export function installCommand(pm: PackageManager) {
  return pm === 'yarn' ? 'yarn' : `${pm} install`
}

export function runCommand(pm: PackageManager, script: string) {
  if (pm === 'npm') return `npm run ${script}`
  return `${pm} ${script}`
}
