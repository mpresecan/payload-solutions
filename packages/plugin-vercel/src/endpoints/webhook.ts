import type { Endpoint } from 'payload'

import type { Ctx } from '../store.js'
import type { VercelWebhookDeploymentEvent } from '../vercel/types.js'

import { matchDeployment } from '../deploy/match.js'
import { applyVercelDeployment, inFlightRows } from '../deploy/refresh.js'
import { patchFromVercel } from '../deploy/state.js'
import { createDeployment, findDeploymentByVercelId, patchDeployment, patchTargetState } from '../store.js'
import { verifyVercelSignature } from '../utils/hmac.js'
import { ENDPOINT_BASE, error, json } from './helpers.js'

const MAX_BODY = 256 * 1024
const SEEN_TTL = 24 * 3_600_000

/** Event ids seen by this process, for idempotent delivery. Bounded; a restart just re-applies idempotent updates. */
const seen = new Map<string, number>()

function remember(id: string): boolean {
  const now = Date.now()
  if (seen.size > 5000) {
    for (const [k, t] of seen) {
      if (now - t > SEEN_TTL) {
        seen.delete(k)
      }
    }
  }
  if (seen.has(id)) {
    return false
  }
  seen.set(id, now)
  return true
}

const STATE_BY_EVENT: Record<string, 'BUILDING' | 'CANCELED' | 'ERROR' | 'READY'> = {
  'deployment.canceled': 'CANCELED',
  'deployment.created': 'BUILDING',
  'deployment.error': 'ERROR',
  'deployment.promoted': 'READY',
  'deployment.ready': 'READY',
  'deployment.succeeded': 'READY',
}

/**
 * `POST /api/vercel/webhook` — Vercel account webhooks (Pro/Enterprise). Verifies the HMAC-SHA1 signature over
 * the raw body, then folds the event into the ledger. Always answers quickly; unknown projects get a 200.
 */
export function createWebhookEndpoint(getCtx: () => Ctx | undefined): Endpoint {
  return {
    handler: async (req) => {
      const ctx = getCtx()
      if (!ctx?.options.webhookSecret) {
        return error('Webhook is not configured', 404)
      }
      const length = Number(req.headers.get('content-length') ?? 0)
      if (length > MAX_BODY) {
        return error('Payload too large', 413)
      }
      let raw: string
      try {
        if (typeof req.text !== 'function') {
          return error('Unreadable body', 400)
        }
        raw = await req.text()
      } catch {
        return error('Unreadable body', 400)
      }
      if (raw.length > MAX_BODY) {
        return error('Payload too large', 413)
      }
      if (!verifyVercelSignature(raw, req.headers.get('x-vercel-signature'), ctx.options.webhookSecret)) {
        return error('Invalid signature', 403)
      }
      let event: VercelWebhookDeploymentEvent
      try {
        event = JSON.parse(raw) as VercelWebhookDeploymentEvent
      } catch {
        return error('Invalid JSON', 400)
      }
      if (!event?.id || !event.type) {
        return json({ ignored: 'malformed' })
      }
      if (!remember(event.id)) {
        return json({ ignored: 'duplicate' })
      }
      try {
        await handleEvent(ctx, event)
      } catch (err) {
        ctx.payload.logger.error({ err, msg: `[plugin-vercel] Webhook ${event.type} failed` })
        return json({ ok: false }, 200)
      }
      return json({ ok: true })
    },
    method: 'post',
    path: `${ENDPOINT_BASE}/webhook`,
  }
}

async function handleEvent(ctx: Ctx, event: VercelWebhookDeploymentEvent): Promise<void> {
  if (event.type === 'deployment.rollback') {
    return
  }
  const projectId = event.payload?.project?.id
  const target = ctx.options.targets.find((t) => t.projectId === projectId)
  if (!target || !event.payload?.deployment?.id) {
    return
  }
  const readyState = STATE_BY_EVENT[event.type]
  if (!readyState) {
    return
  }
  const deployment = {
    created: event.createdAt,
    id: event.payload.deployment.id,
    inspectorUrl: event.payload.links?.deployment ?? null,
    meta: event.payload.deployment.meta,
    name: event.payload.deployment.name ?? '',
    readyState: readyState === 'BUILDING' ? ('QUEUED' as const) : readyState,
    target: event.payload.target ?? null,
    uid: event.payload.deployment.id,
    url: event.payload.deployment.url ?? null,
    ...(readyState === 'READY' ? { ready: event.createdAt } : {}),
  }

  let row = await findDeploymentByVercelId(ctx, deployment.id, undefined)
  if (!row) {
    // Attach to the oldest unmatched trigger whose hook call precedes the deployment.
    const inFlight = (await inFlightRows(ctx, target.slug)).filter((r) => !r.deploymentId)
    const candidateRow = inFlight.find((r) => {
      const called = new Date(r.hookCalledAt ?? r.createdAt)
      return matchDeployment({ claimed: new Set(), deployments: [{ ...deployment, source: 'git-deploy-hook' }], hookCalledAt: called }) !== null
    })
    if (candidateRow) {
      row = await patchDeployment(ctx, candidateRow.id, { deploymentId: deployment.id })
    }
  }
  if (!row && ctx.options.recordExternalDeployments) {
    const inserted = await createDeployment(ctx, {
      cause: 'external',
      dedupeKey: `${target.slug}:external:${deployment.id}`,
      state: 'queued',
      target: target.slug,
      ...patchFromVercel({ ...deployment, readyState: 'QUEUED' }),
      deploymentId: deployment.id,
    })
    row = inserted.record
  }
  if (!row) {
    return
  }
  // `created` events carry no build timing; a plain patch keeps the ordering guarantee of the state machine.
  const patch = readyState === 'BUILDING' ? { ...deployment, readyState: 'QUEUED' as const } : deployment
  const updated = await applyVercelDeployment(ctx, row, patch)
  if (event.type === 'deployment.promoted' && updated.deploymentId) {
    await patchTargetState(ctx, target.slug, { currentDeploymentId: updated.deploymentId, currentState: 'ready', currentUrl: updated.deploymentUrl ?? null })
  }
}
