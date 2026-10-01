import type { Payload, PayloadRequest } from 'payload'

import type { ResendClient } from './resend/client.js'
import type { ResendBroadcastsAPI, ResyncResult, SanitizedOptions, SyncRunDoc } from './types.js'

import {
  cancelCampaign,
  loadCampaign,
  refreshCampaign,
  renderFor,
  sendCampaign,
} from './campaigns.js'
import { createResendClient } from './resend/client.js'
import { findSource } from './sources/subscriber.js'
import { waitForCommit } from './sync/commit.js'
import { syncDocument } from './sync/document.js'
import { resync } from './sync/resync.js'

/**
 * State shared by the plugin's hooks, endpoints and `payload.resendBroadcasts`: one throttled
 * Resend client per config, and the set of background jobs still running (so tests and scripts can
 * wait for them with `idle()`).
 */
export type Runtime = {
  api: (payload: Payload) => ResendBroadcastsAPI
  client: () => ResendClient
  /** Resolves once every background sync and resync started so far has finished. */
  idle: () => Promise<void>
  options: SanitizedOptions
  /** Run in the background; errors are logged, never thrown into the request that started it. */
  runInBackground: (payload: Payload, label: string, fn: () => Promise<unknown>) => void
  /** Record a sync run and start it in the background. Returns the run document's id. */
  startResync: (args: {
    force?: boolean
    lists?: Array<number | string>
    payload: Payload
    /** The request that asked for it. The run starts once its transaction has committed. */
    req?: PayloadRequest
    trigger: string
  }) => Promise<number | string>
}

export function createRuntime(options: SanitizedOptions): Runtime {
  let client: ResendClient | undefined
  const pending = new Set<Promise<unknown>>()

  const getClient = () => {
    client ??=
      options.resend.client ??
      createResendClient({
        apiKey: options.apiKey,
        baseUrl: options.resend.baseUrl,
        requestsPerSecond: options.resend.requestsPerSecond,
      })
    return client
  }

  const runInBackground: Runtime['runInBackground'] = (payload, label, fn) => {
    const promise = (async () => {
      try {
        await fn()
      } catch (error) {
        payload.logger.error({ err: error, msg: `[plugin-resend-broadcasts] ${label} failed.` })
      }
    })()
    pending.add(promise)
    void promise.finally(() => pending.delete(promise))
  }

  const startResync: Runtime['startResync'] = async ({ force, lists, payload, req, trigger }) => {
    const run = (await payload.create({
      collection: options.slugs.syncRuns as never,
      data: {
        lists: lists?.map(String) ?? [],
        scope: lists ? 'list' : 'all',
        startedAt: new Date().toISOString(),
        status: 'running',
        trigger,
      } as never,
      overrideAccess: true,
      req,
    })) as unknown as SyncRunDoc

    const write = (data: Record<string, unknown>) =>
      payload.update({
        id: run.id,
        collection: options.slugs.syncRuns as never,
        data: data as never,
        overrideAccess: true,
      })

    runInBackground(payload, `Resync ${run.id}`, async () => {
      if (req) {
        await waitForCommit(req)
      }
      try {
        const stats = await resync(
          { client: getClient(), options, payload },
          {
            force,
            lists,
            onProgress: (s: ResyncResult) =>
              write({ stats: { ...s, errors: s.errors.length } }).then(() => undefined),
          },
        )
        await write({
          errors: stats.errors,
          finishedAt: new Date().toISOString(),
          stats: { ...stats, errors: stats.errors.length },
          status: stats.errors.length ? 'failed' : 'finished',
        })
      } catch (error) {
        await write({
          errors: [error instanceof Error ? error.message : String(error)],
          finishedAt: new Date().toISOString(),
          status: 'failed',
        })
        throw error
      }
    })
    return run.id
  }

  const idle = async () => {
    while (pending.size) {
      await Promise.allSettled([...pending])
    }
  }

  const api = (payload: Payload): ResendBroadcastsAPI => {
    const ctx = (req?: PayloadRequest) => ({ client: getClient(), options, payload, req })
    return {
      cancel: (id) => cancelCampaign(ctx(), id),
      get client() {
        return getClient()
      },
      idle,
      options,
      refreshStatus: (id) => refreshCampaign(ctx(), id),
      render: async ({ campaign, mode = 'preview', subscriber }) => {
        const doc = typeof campaign === 'object' ? campaign : await loadCampaign(ctx(), campaign)
        return renderFor(ctx(), doc, { mode, subscriber })
      },
      resync: (args) => resync(ctx(args?.req), { force: args?.force, lists: args?.lists }),
      send: (id, args) => sendCampaign(ctx(), id, args),
      syncDocument: async ({ collection, doc, req }) => {
        const source = findSource(options, collection)
        if (!source) {
          throw new Error(`[plugin-resend-broadcasts] "${collection}" is not a subscriber source.`)
        }
        await syncDocument(ctx(req), source, doc)
      },
    }
  }

  return { api, client: getClient, idle, options, runInBackground, startResync }
}
