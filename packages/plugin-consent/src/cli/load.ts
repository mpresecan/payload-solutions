import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Payload, SanitizedConfig } from 'payload'
import { getPayload } from 'payload'
import { findConfig, loadEnv } from 'payload/node'

import { getPluginOptions } from '../index.js'
import type { ResolvedConsentPluginOptions } from '../types.js'

export type Project = {
  payload: Payload
  options: ResolvedConsentPluginOptions
  root: string
  configPath: string
}

let cached: Project | null = null

/**
 * Boots the host project's Payload instance.
 *
 * The scan reads the database directly rather than talking to a running server: the most
 * valuable moment to run this is before launch, when nothing is deployed and half the pages
 * are still drafts.
 */
export async function loadProject(opts: { root?: string; config?: string } = {}): Promise<Project> {
  if (cached) return cached
  const root = path.resolve(opts.root ?? process.cwd())
  loadEnv()
  const configPath = opts.config ? path.resolve(root, opts.config) : findConfig()
  const imported = (await import(pathToFileURL(configPath).href)) as { default: Promise<SanitizedConfig> | SanitizedConfig }
  const config = await imported.default
  const payload = await getPayload({ config })
  const options = getPluginOptions(payload)
  cached = { payload, options, root, configPath }
  return cached
}

export async function closeProject(): Promise<void> {
  if (!cached) return
  try {
    await cached.payload.destroy()
  } catch {
    /* the process is ending anyway */
  }
  cached = null
}

export function toolVersion(): string {
  return process.env.PAYLOAD_CONSENT_VERSION ?? '0.1.0'
}
