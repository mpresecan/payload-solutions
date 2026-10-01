import type { CollectionConfig, Config } from 'payload'

import type { ResendBroadcastsPluginOptions } from './types.js'

import { createCampaignsCollection } from './collections/campaigns.js'
import { createListsCollection } from './collections/lists.js'
import { createSettingsGlobal, createSyncRunsCollection } from './collections/sync-runs.js'
import { createRootEndpoints } from './endpoints/root.js'
import { sanitizeOptions } from './options.js'
import { createRuntime } from './runtime.js'
import { createSourceHooks } from './sources/hooks.js'
import { addSourceFields } from './sources/subscriber.js'

/**
 * Newsletters on Resend Broadcasts.
 *
 * - `sources` are collections whose documents are subscribers; missing email/name/subscribed fields
 *   are added, and every save keeps the matching Resend contact current.
 * - Lists (admin) are Resend segments over one source, optionally filtered.
 * - Campaigns (admin) are written in Lexical, previewed as any subscriber, tested, then sent or
 *   scheduled as a Resend broadcast to a list's segment.
 */
export const resendBroadcastsPlugin =
  (pluginOptions: ResendBroadcastsPluginOptions) =>
  (incoming: Config): Config => {
    const options = sanitizeOptions(pluginOptions)
    const runtime = createRuntime(options)
    const config: Config = { ...incoming }

    config.collections = (config.collections ?? []).map((collection): CollectionConfig => {
      const source = options.sources.find((s) => s.collection === collection.slug)
      if (!source) {
        return collection
      }
      const withFields = addSourceFields(collection, source)
      if (options.disabled) {
        return withFields
      }
      const hooks = createSourceHooks(runtime, source)
      return {
        ...withFields,
        hooks: {
          ...withFields.hooks,
          afterChange: [...(withFields.hooks?.afterChange ?? []), hooks.afterChange],
          afterDelete: [...(withFields.hooks?.afterDelete ?? []), hooks.afterDelete],
        },
      }
    })

    const missing = options.sources.filter(
      (s) => !config.collections!.some((c) => c.slug === s.collection),
    )
    if (missing.length) {
      throw new Error(
        `[plugin-resend-broadcasts] Source collection${missing.length > 1 ? 's' : ''} not found: ${missing.map((s) => s.collection).join(', ')}. Add the plugin after the collections it reads.`,
      )
    }

    if (options.media) {
      const media = config.collections.find((c) => c.slug === options.media!.collection)
      if (!media?.upload) {
        throw new Error(
          `[plugin-resend-broadcasts] media.collection "${options.media.collection}" ${media ? 'is not an upload collection' : 'does not exist'}.`,
        )
      }
    }

    config.collections.push(
      createListsCollection(options, runtime),
      createCampaignsCollection(options, runtime),
      createSyncRunsCollection(options),
    )
    config.globals = [...(config.globals ?? []), createSettingsGlobal(options)]

    if (options.disabled) {
      return config
    }

    config.endpoints = [...(config.endpoints ?? []), ...createRootEndpoints(options, runtime)]

    const incomingOnInit = config.onInit
    config.onInit = async (payload) => {
      // Attach before the host's onInit, whose seed may already save subscribers.
      ;(payload as unknown as { resendBroadcasts: unknown }).resendBroadcasts = runtime.api(payload)
      if (incomingOnInit) {
        await incomingOnInit(payload)
      }
    }

    return config
  }
