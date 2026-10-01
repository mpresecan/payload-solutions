import type { Endpoint } from 'payload'

import type { Runtime } from '../runtime.js'
import type { SanitizedOptions } from '../types.js'
import type { SubscriberRef } from './helpers.js'

import {
  campaignList,
  imagesReadersCannotLoad,
  cancelCampaign,
  loadCampaign,
  refreshCampaign,
  renderFor,
  sendCampaign,
  sendTest,
} from '../campaigns.js'
import {
  createResolver,
  getSettings,
  resolveGlobals,
  sampleSubscriber,
  variableCatalog,
} from '../render/render.js'
import { guarded, loadSubscriber, readJson, routeId } from './helpers.js'

/**
 * `/api/<campaigns>/:id/…` — what the Preview & send tab talks to:
 * `preview`, `test`, `send`, `cancel`, `refresh`.
 */
export function createCampaignEndpoints(options: SanitizedOptions, runtime: Runtime): Endpoint[] {
  const ctx = (req: Parameters<Endpoint['handler']>[0]) => ({
    client: runtime.client(),
    options,
    payload: req.payload,
    req,
  })

  return [
    {
      handler: guarded(options.access.manage, async (req) => {
        const body = await readJson<{ subscriber: SubscriberRef }>(req)
        const campaign = await loadCampaign(ctx(req), routeId(req))
        const loaded = await loadSubscriber(runtime, req, body.subscriber)
        const subscriber = loaded ?? sampleSubscriber(options)
        const rendered = await renderFor(ctx(req), campaign, { mode: 'preview', subscriber })

        const settings = await getSettings(req.payload, options, req)
        const globals = await resolveGlobals(req.payload, options, settings)
        const { resolve } = createResolver({
          globals,
          mode: 'preview',
          options,
          subscriber,
          unsubscribeUrl: '(unsubscribe link)',
        })
        const variables = variableCatalog(options, globals).map((info) => ({
          ...info,
          used: info.token in rendered.variables,
          value: resolve(info.token, undefined) ?? '',
        }))
        const list = campaignList(campaign)

        return Response.json({
          campaign: {
            broadcastId: campaign.broadcastId ?? null,
            lastError: campaign.lastError ?? null,
            scheduledAt: campaign.scheduledAt ?? null,
            sentAt: campaign.sentAt ?? null,
            status: campaign.status ?? 'draft',
          },
          html: rendered.html,
          isSample: !loaded,
          list: list
            ? {
                id: list.id,
                name: list.name,
                lastSyncedAt: list.lastSyncedAt ?? null,
                memberCount: list.memberCount ?? null,
                segmentId: list.segmentId ?? null,
                source: list.source,
              }
            : null,
          preheader: rendered.preheader,
          // Images a reader's mail client could not load: sending is refused until they are fixed.
          privateImages: imagesReadersCannotLoad(options, rendered),
          subject: rendered.subject,
          subscriber,
          text: rendered.text,
          variables,
        })
      }),
      method: 'post',
      path: '/:id/preview',
    },
    {
      handler: guarded(options.access.manage, async (req) => {
        const body = await readJson<{ subscriber: SubscriberRef; to: string }>(req)
        const campaign = await loadCampaign(ctx(req), routeId(req))
        const subscriber = await loadSubscriber(runtime, req, body.subscriber)
        const result = await sendTest(ctx(req), campaign, {
          subscriber,
          to: String(body.to ?? '').trim(),
        })
        return Response.json({ id: result.id, status: 'sent' })
      }),
      method: 'post',
      path: '/:id/test',
    },
    {
      handler: guarded(options.access.send, async (req) => {
        const body = await readJson<{ scheduledAt: string }>(req)
        const campaign = await sendCampaign(ctx(req), routeId(req), {
          scheduledAt: body.scheduledAt || undefined,
        })
        return Response.json({ campaign })
      }),
      method: 'post',
      path: '/:id/send',
    },
    {
      handler: guarded(options.access.send, async (req) => {
        const campaign = await cancelCampaign(ctx(req), routeId(req))
        return Response.json({ campaign })
      }),
      method: 'post',
      path: '/:id/cancel',
    },
    {
      handler: guarded(options.access.manage, async (req) => {
        const campaign = await refreshCampaign(ctx(req), routeId(req))
        return Response.json({ campaign })
      }),
      method: 'post',
      path: '/:id/refresh',
    },
  ]
}
