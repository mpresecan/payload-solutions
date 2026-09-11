import type { Access, Config } from 'payload'

import type {
  SanitizedTarget,
  SanitizedTrackedCollection,
  SanitizedTrackedGlobal,
  SanitizedVercelPluginOptions,
  VercelPluginOptions,
} from './types.js'

import { DEFAULT_VIEW_PATH } from './constants.js'
import { parseDuration } from './utils/duration.js'

export const DEFAULT_API_BASE = 'https://api.vercel.com'
export const DEFAULT_QUIET_PERIOD_MS = 60_000
export const DEFAULT_MAX_WAIT_MS = 10 * 60_000
export const DEFAULT_TICK_QUEUE = 'vercel'
export const DEFAULT_TICK_CRON = '* * * * *'
export const TICK_TASK_SLUG = 'vercel:tick'

const HOOK_URL = /^https?:\/\/[^/]+\/v1\/integrations\/deploy\/([^/?#]+)\/([^/?#]+)/i

/** Parse `{ projectId, hookId }` out of a deploy hook URL, or null when it is not one. */
export function parseHookUrl(url: string | undefined): null | { hookId: string; projectId: string } {
  if (!url) {
    return null
  }
  const match = HOOK_URL.exec(url.trim())
  if (!match) {
    return null
  }
  return { hookId: match[2]!, projectId: match[1]! }
}

const anyAdminUser: Access = ({ req }) => Boolean(req.user)

function sanitizeTarget(raw: VercelPluginOptions['targets'][number], options: VercelPluginOptions): SanitizedTarget {
  if (!raw.slug || !/^[a-z0-9][a-z0-9-_]*$/i.test(raw.slug)) {
    throw new Error(`[plugin-vercel] Target slug "${raw.slug}" is invalid. Use letters, digits, - and _.`)
  }
  const hook = raw.hook?.trim() || undefined
  const parsed = parseHookUrl(hook)
  if (hook && !parsed) {
    throw new Error(
      `[plugin-vercel] Target "${raw.slug}": hook must be a Vercel deploy hook URL (https://api.vercel.com/v1/integrations/deploy/<projectId>/<hookId>).`,
    )
  }
  return {
    buildCache: raw.buildCache ?? true,
    configured: Boolean(hook),
    hook,
    label: raw.label ?? raw.slug,
    projectId: raw.projectId ?? parsed?.projectId,
    slug: raw.slug,
    teamId: raw.teamId ?? options.teamId,
    token: raw.token ?? options.token,
    url: raw.url,
  }
}

export function sanitizeOptions(options: VercelPluginOptions, config?: Config): SanitizedVercelPluginOptions {
  if (!Array.isArray(options.targets) || options.targets.length === 0) {
    throw new Error('[plugin-vercel] At least one target is required.')
  }
  const targets = options.targets.map((t) => sanitizeTarget(t, options))
  const slugs = new Set<string>()
  for (const t of targets) {
    if (slugs.has(t.slug)) {
      throw new Error(`[plugin-vercel] Duplicate target slug "${t.slug}".`)
    }
    slugs.add(t.slug)
  }
  const allTargets = targets.map((t) => t.slug)
  const assertTargets = (list: string[] | undefined, where: string): string[] => {
    if (!list) {
      return allTargets
    }
    for (const slug of list) {
      if (!slugs.has(slug)) {
        throw new Error(`[plugin-vercel] ${where} references unknown target "${slug}".`)
      }
    }
    return list
  }

  const collections: Record<string, SanitizedTrackedCollection> = {}
  for (const [slug, value] of Object.entries(options.collections ?? {})) {
    if (!value) {
      continue
    }
    const collection = config?.collections?.find((c) => c.slug === slug)
    if (config && !collection) {
      throw new Error(`[plugin-vercel] collections.${slug}: no collection with that slug exists.`)
    }
    const raw = value === true ? {} : value
    const hasDrafts = Boolean(collection?.versions && typeof collection.versions === 'object' && collection.versions.drafts)
    collections[slug] = {
      on: raw.on ?? (hasDrafts ? 'publish' : 'change'),
      targets: assertTargets(raw.targets, `collections.${slug}`),
    }
  }

  const globals: Record<string, SanitizedTrackedGlobal> = {}
  for (const [slug, value] of Object.entries(options.globals ?? {})) {
    if (!value) {
      continue
    }
    if (config && !config.globals?.some((g) => g.slug === slug)) {
      throw new Error(`[plugin-vercel] globals.${slug}: no global with that slug exists.`)
    }
    const raw = value === true ? {} : value
    globals[slug] = { targets: assertTargets(raw.targets, `globals.${slug}`) }
  }

  const autoDeploy =
    options.autoDeploy === false
      ? (false as const)
      : {
          maxWaitMs: parseDuration(options.autoDeploy?.maxWait, DEFAULT_MAX_WAIT_MS),
          quietPeriodMs: parseDuration(options.autoDeploy?.quietPeriod, DEFAULT_QUIET_PERIOD_MS),
        }
  if (autoDeploy && autoDeploy.maxWaitMs < autoDeploy.quietPeriodMs) {
    throw new Error('[plugin-vercel] autoDeploy.maxWait must be at least autoDeploy.quietPeriod.')
  }

  const job = options.tick?.job
  const view = options.admin?.view
  return {
    access: {
      deploy: options.access?.deploy ?? anyAdminUser,
      read: options.access?.read ?? anyAdminUser,
      rollback: options.access?.rollback ?? anyAdminUser,
    },
    admin: {
      documentPill: options.admin?.documentPill ?? true,
      group: options.admin?.group ?? 'Vercel',
      header: options.admin?.header ?? true,
      view: view === false ? false : { path: (typeof view === 'object' && view.path) || DEFAULT_VIEW_PATH },
    },
    apiBase: (options.apiBase ?? DEFAULT_API_BASE).replace(/\/+$/, ''),
    autoDeploy,
    collections,
    disabled: Boolean(options.disabled),
    globals,
    hooks: options.hooks ?? {},
    recordExternalDeployments: options.recordExternalDeployments ?? true,
    retention: { days: options.retention?.days ?? 90, keep: options.retention?.keep ?? 200 },
    slugs: {
      changes: options.slugs?.changes ?? 'vercel-changes',
      deployments: options.slugs?.deployments ?? 'vercel-deployments',
      targets: options.slugs?.targets ?? 'vercel-targets',
    },
    targets,
    teamId: options.teamId,
    tick: {
      adminHeartbeat: options.tick?.adminHeartbeat ?? true,
      beacon: options.tick?.beacon ?? true,
      job:
        job === false
          ? false
          : {
              cron: (typeof job === 'object' && job.cron) || DEFAULT_TICK_CRON,
              queue: (typeof job === 'object' && job.queue) || DEFAULT_TICK_QUEUE,
            },
      secret: options.tick?.secret,
    },
    token: options.token,
    webhookSecret: options.webhookSecret,
  }
}
