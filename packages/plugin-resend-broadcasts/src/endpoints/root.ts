import type { Endpoint, PayloadRequest } from 'payload'

import type { Runtime } from '../runtime.js'
import type { SanitizedOptions } from '../types.js'

import { ENDPOINT_BASE, SKIP_SYNC } from '../constants.js'
import { getByPath, normalizeEmail, setByPath } from '../sources/subscriber.js'
import { guarded, readJson } from './helpers.js'

type ContactEvent = {
  data?: { email?: string; unsubscribed?: boolean }
  type?: string
}

const header = (req: PayloadRequest, ...names: string[]) => {
  for (const name of names) {
    const value = req.headers.get(name)
    if (value) {
      return value
    }
  }
  return ''
}

/**
 * `POST /api/resend-broadcasts/webhook` — point a Resend webhook here with the `contact.updated`
 * and `contact.created` events. When someone unsubscribes through Resend's link, the matching
 * documents in every source collection get their subscribed checkbox switched off.
 *
 * `POST /api/resend-broadcasts/resync` — start a full reconciliation in the background.
 */
export function createRootEndpoints(options: SanitizedOptions, runtime: Runtime): Endpoint[] {
  return [
    {
      handler: async (req) => {
        if (!options.webhookSecret) {
          return Response.json(
            { message: 'Webhook secret is not configured (RESEND_WEBHOOK_SECRET).' },
            { status: 503 },
          )
        }
        const raw = (await req.text?.()) ?? ''
        let event: ContactEvent
        try {
          event = runtime.client().resend.webhooks.verify({
            headers: {
              id: header(req, 'svix-id', 'webhook-id'),
              signature: header(req, 'svix-signature', 'webhook-signature'),
              timestamp: header(req, 'svix-timestamp', 'webhook-timestamp'),
            },
            payload: raw,
            webhookSecret: options.webhookSecret,
          }) as ContactEvent
        } catch {
          return Response.json({ message: 'Invalid signature.' }, { status: 401 })
        }

        if (event.type !== 'contact.updated' && event.type !== 'contact.created') {
          return Response.json({ ignored: event.type ?? 'unknown', received: true })
        }
        const email = normalizeEmail(event.data?.email)
        if (!email || typeof event.data?.unsubscribed !== 'boolean') {
          return Response.json({ ignored: 'no email or subscription state', received: true })
        }
        const subscribed = !event.data.unsubscribed

        let updated = 0
        for (const source of options.sources) {
          const { docs } = await req.payload.find({
            collection: source.collection,
            depth: 0,
            limit: 0,
            overrideAccess: true,
            pagination: false,
            req,
            where: { [source.fields.email]: { equals: email } },
          })
          for (const doc of docs) {
            if (
              (getByPath(doc as unknown as Record<string, unknown>, source.fields.subscribed) ===
                true) ===
              subscribed
            ) {
              continue
            }
            await req.payload.update({
              id: doc.id,
              collection: source.collection,
              // The change came from Resend; pushing it straight back would be an echo.
              context: { [SKIP_SYNC]: true },
              data: setByPath(source.fields.subscribed, subscribed),
              overrideAccess: true,
              req,
            })
            updated++
          }
        }
        return Response.json({ received: true, updated })
      },
      method: 'post',
      path: `${ENDPOINT_BASE}/webhook`,
    },
    {
      handler: guarded(options.access.send, async (req) => {
        const body = await readJson<{ force: boolean }>(req)
        const runId = await runtime.startResync({
          force: body.force === true,
          payload: req.payload,
          trigger: `manual (${(req.user as { email?: string } | null)?.email ?? 'user'})`,
        })
        return Response.json({ runId })
      }),
      method: 'post',
      path: `${ENDPOINT_BASE}/resync`,
    },
  ]
}
