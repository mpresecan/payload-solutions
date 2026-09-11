import type { CollectionConfig, Config, GlobalConfig } from 'payload'

import type { Ctx } from './store.js'
import type { VercelPluginOptions } from './types.js'

import { createVercelAPI } from './api.js'
import { collectionAfterChange, collectionAfterDelete, globalAfterChange } from './changes/track.js'
import { createChangesCollection } from './collections/changes.js'
import { createDeploymentsCollection } from './collections/deployments.js'
import { COMPONENT_PREFIX, PLUGIN_SLUG } from './constants.js'
import { createTargetsCollection } from './collections/targets.js'
import { createEndpoints } from './endpoints/index.js'
import { createTickTask } from './jobs/tick.js'
import { sanitizeOptions } from './options.js'
import { createCtx, getTargetState } from './store.js'

function labelOf(entity: { label?: unknown; slug: string }): string {
  const label = entity.label
  if (typeof label === 'string') {
    return label
  }
  if (label && typeof label === 'object') {
    const first = Object.values(label as Record<string, unknown>).find((v) => typeof v === 'string')
    if (typeof first === 'string') {
      return first
    }
  }
  return entity.slug
}

export const vercelPlugin =
  (rawOptions: VercelPluginOptions) =>
  (config: Config): Config => {
    const options = sanitizeOptions(rawOptions, config)
    const userSlug = config.admin?.user ?? config.collections?.find((c) => c.auth)?.slug ?? 'users'

    // A single mutable slot: hooks and endpoints close over it; onInit fills it.
    let ctx: Ctx | undefined
    const getCtx = () => ctx

    config.collections = config.collections ?? []
    config.globals = config.globals ?? []
    config.collections.push(
      createDeploymentsCollection(options, { userSlug }),
      createChangesCollection(options, { userSlug }),
      createTargetsCollection(options),
    )

    // Keep schema additions even when disabled so migrations stay consistent.
    if (options.disabled) {
      return config
    }

    for (const slug of Object.keys(options.collections)) {
      const collection = config.collections.find((c) => c.slug === slug) as CollectionConfig | undefined
      if (!collection) {
        continue
      }
      const hasDrafts = Boolean(collection.versions && typeof collection.versions === 'object' && collection.versions.drafts)
      const useAsTitle = collection.admin?.useAsTitle
      collection.hooks = collection.hooks ?? {}
      collection.hooks.afterChange = [...(collection.hooks.afterChange ?? []), collectionAfterChange(getCtx, slug, hasDrafts, useAsTitle)]
      collection.hooks.afterDelete = [...(collection.hooks.afterDelete ?? []), collectionAfterDelete(getCtx, slug, useAsTitle)]
      if (options.admin.documentPill) {
        collection.admin = collection.admin ?? {}
        collection.admin.components = collection.admin.components ?? {}
        collection.admin.components.edit = collection.admin.components.edit ?? {}
        collection.admin.components.edit.beforeDocumentControls = [
          ...(collection.admin.components.edit.beforeDocumentControls ?? []),
          `${COMPONENT_PREFIX}/client#DocumentPill`,
        ]
      }
    }

    for (const slug of Object.keys(options.globals)) {
      const global = config.globals.find((g) => g.slug === slug) as GlobalConfig | undefined
      if (!global) {
        continue
      }
      global.hooks = global.hooks ?? {}
      global.hooks.afterChange = [...(global.hooks.afterChange ?? []), globalAfterChange(getCtx, slug, labelOf(global))]
      if (options.admin.documentPill) {
        global.admin = global.admin ?? {}
        global.admin.components = global.admin.components ?? {}
        global.admin.components.elements = global.admin.components.elements ?? {}
        global.admin.components.elements.beforeDocumentControls = [
          ...(global.admin.components.elements.beforeDocumentControls ?? []),
          `${COMPONENT_PREFIX}/client#DocumentPill`,
        ]
      }
    }

    config.endpoints = [...(config.endpoints ?? []), ...createEndpoints(options, getCtx)]

    if (options.tick.job) {
      config.jobs = config.jobs ?? { tasks: [] }
      config.jobs.tasks = [...(config.jobs.tasks ?? []), createTickTask(options, getCtx)]
    }

    config.admin = config.admin ?? {}
    config.admin.components = config.admin.components ?? {}
    if (options.admin.header) {
      config.admin.components.actions = [...(config.admin.components.actions ?? []), `${COMPONENT_PREFIX}/client#HeaderWidget`]
    }
    if (options.admin.view) {
      config.admin.components.views = {
        ...(config.admin.components.views ?? {}),
        vercelDeployments: { Component: `${COMPONENT_PREFIX}/rsc#DeploymentsView`, exact: true, path: options.admin.view.path },
      }
      config.admin.components.afterNavLinks = [...(config.admin.components.afterNavLinks ?? []), `${COMPONENT_PREFIX}/client#NavLink`]
    }
    config.custom = { ...(config.custom ?? {}), [PLUGIN_SLUG]: { viewPath: options.admin.view ? options.admin.view.path : null } }

    const incomingOnInit = config.onInit
    config.onInit = async (payload) => {
      ctx = createCtx(payload, options)
      payload.vercel = createVercelAPI(ctx)
      for (const target of options.targets) {
        try {
          await getTargetState(ctx, target.slug)
        } catch (error) {
          payload.logger.error({ err: error, msg: `[plugin-vercel] Could not initialise state for target "${target.slug}"` })
        }
        if (!target.configured) {
          payload.logger.warn(`[plugin-vercel] Target "${target.slug}" has no deploy hook URL; it will show as not configured.`)
        }
      }
      if (!options.targets.some((t) => t.token)) {
        payload.logger.info('[plugin-vercel] No Vercel token configured: deployments are triggered but their status cannot be read.')
      }
      if (incomingOnInit) {
        await incomingOnInit(payload)
      }
    }

    return config
  }
