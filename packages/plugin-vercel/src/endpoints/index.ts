import type { Endpoint, PayloadRequest } from 'payload'

import type { Ctx } from '../store.js'
import type { SanitizedVercelPluginOptions } from '../types.js'

import { targetStatus } from '../api.js'
import { cancel, rollback, rollbackCandidates } from '../deploy/actions.js'
import { inFlightRows } from '../deploy/refresh.js'
import { windowDedupeKey } from '../deploy/schedule.js'
import { tick } from '../deploy/tick.js'
import { TargetNotConfiguredError, trigger, triggerWithOutcome } from '../deploy/trigger.js'
import { extendWindow } from '../changes/track.js'
import { countPending, findDeployments, findPending, getTargetState, listPending, patchTargetState, targetFor } from '../store.js'
import { VercelApiError } from '../vercel/client.js'
import { allowed, ENDPOINT_BASE, error, json, publicTargets, queryParam, readJson } from './helpers.js'
import { createWebhookEndpoint } from './webhook.js'

type GetCtx = () => Ctx | undefined

function withCtx(getCtx: GetCtx, handler: (ctx: Ctx, req: PayloadRequest) => Promise<Response>): Endpoint['handler'] {
  return async (req) => {
    const ctx = getCtx()
    if (!ctx) {
      return error('Vercel plugin is not initialised', 503)
    }
    try {
      return await handler(ctx, req)
    } catch (err) {
      if (err instanceof TargetNotConfiguredError) {
        return error(err.message, 409)
      }
      if (err instanceof VercelApiError) {
        return error(err.message, 502)
      }
      const message = err instanceof Error ? err.message : String(err)
      ctx.payload.logger.error({ err, msg: `[plugin-vercel] ${req.method} ${req.url} failed` })
      return error(message, 500)
    }
  }
}

function resolveTarget(ctx: Ctx, req: PayloadRequest, body?: { target?: string }) {
  return targetFor(ctx, body?.target ?? queryParam(req, 'target'))
}

export { ENDPOINT_BASE }

export function createEndpoints(options: SanitizedVercelPluginOptions, getCtx: GetCtx): Endpoint[] {
  const base = ENDPOINT_BASE
  const endpoints: Endpoint[] = [
    {
      // Status for every target; runs a heartbeat tick when enabled.
      handler: withCtx(getCtx, async (ctx, req) => {
        if (!(await allowed(ctx.options.access.read, req))) {
          return error('Unauthorized', 401)
        }
        if (ctx.options.tick.adminHeartbeat && queryParam(req, 'tick') !== '0') {
          await tick(ctx, 'heartbeat', { req })
        }
        const only = queryParam(req, 'target')
        const targets = only ? [targetFor(ctx, only)] : ctx.options.targets
        const statuses = await Promise.all(targets.map((t) => targetStatus(ctx, t.slug, req)))
        const [canDeploy, canRollback] = await Promise.all([allowed(ctx.options.access.deploy, req), allowed(ctx.options.access.rollback, req)])
        return json({
          autoDeploy: ctx.options.autoDeploy ? { maxWaitMs: ctx.options.autoDeploy.maxWaitMs, quietPeriodMs: ctx.options.autoDeploy.quietPeriodMs } : false,
          beacon: ctx.options.tick.beacon,
          now: new Date().toISOString(),
          permissions: { deploy: canDeploy, rollback: canRollback },
          targets: statuses,
          viewPath: ctx.options.admin.view ? ctx.options.admin.view.path : null,
        })
      }),
      method: 'get',
      path: `${base}/status`,
    },
    {
      handler: withCtx(getCtx, async (ctx, req) => {
        if (!(await allowed(ctx.options.access.read, req))) {
          return error('Unauthorized', 401)
        }
        const target = resolveTarget(ctx, req)
        const limit = Math.min(Number(queryParam(req, 'limit') ?? 100) || 100, 1000)
        return json({ changes: await listPending(ctx, target.slug, limit, req), total: await countPending(ctx, target.slug, req) })
      }),
      method: 'get',
      path: `${base}/changes`,
    },
    {
      handler: withCtx(getCtx, async (ctx, req) => {
        if (!(await allowed(ctx.options.access.read, req))) {
          return error('Unauthorized', 401)
        }
        const target = resolveTarget(ctx, req)
        const limit = Math.min(Number(queryParam(req, 'limit') ?? 20) || 20, 200)
        return json({ deployments: await findDeployments(ctx, { depth: 1, limit, where: { target: { equals: target.slug } } }, req) })
      }),
      method: 'get',
      path: `${base}/history`,
    },
    {
      // Per-document state for the edit-view pill.
      handler: withCtx(getCtx, async (ctx, req) => {
        if (!(await allowed(ctx.options.access.read, req))) {
          return error('Unauthorized', 401)
        }
        const collection = queryParam(req, 'collection')
        const global = queryParam(req, 'global')
        const id = queryParam(req, 'id')
        const targets = collection
          ? (ctx.options.collections[collection]?.targets ?? [])
          : global
            ? (ctx.options.globals[global]?.targets ?? [])
            : []
        const out: Record<string, 'deploying' | 'failed' | 'live' | 'pending'> = {}
        for (const slug of targets) {
          const pending = await findPending(ctx, slug, { collection: collection ?? null, docId: id ?? null, global: global ?? null }, req)
          if (pending) {
            const state = await getTargetState(ctx, slug, req)
            out[slug] = state.currentState === 'error' ? 'failed' : 'pending'
            continue
          }
          const inFlight = await inFlightRows(ctx, slug, req)
          const carried = inFlight.some((row) =>
            (row.changes?.items ?? []).some((item) => (global ? item.g === global : item.c === collection && item.id === id)),
          )
          out[slug] = carried ? 'deploying' : 'live'
        }
        return json({ targets: out, tracked: targets.length > 0 })
      }),
      method: 'get',
      path: `${base}/document`,
    },
    {
      handler: withCtx(getCtx, async (ctx, req) => {
        if (!(await allowed(ctx.options.access.deploy, req))) {
          return error('Unauthorized', 401)
        }
        const body = await readJson<{ buildCache?: boolean; reason?: string; target?: string }>(req)
        const target = resolveTarget(ctx, req, body)
        const record = await trigger(ctx, target.slug, {
          buildCache: body.buildCache,
          cause: 'manual',
          reason: typeof body.reason === 'string' ? body.reason : undefined,
          req,
        })
        return json({ deployment: record }, record.state === 'error' ? 502 : 200)
      }),
      method: 'post',
      path: `${base}/deploy`,
    },
    {
      // sendBeacon from a closing admin tab: fire whatever is pending, now.
      handler: withCtx(getCtx, async (ctx, req) => {
        if (!ctx.options.tick.beacon) {
          return error('Beacon flush is disabled', 404)
        }
        if (!(await allowed(ctx.options.access.deploy, req))) {
          return error('Unauthorized', 401)
        }
        const fired: string[] = []
        for (const target of ctx.options.targets) {
          if (!target.configured) {
            continue
          }
          const state = await getTargetState(ctx, target.slug, req)
          if (state.paused || !state.dueAt) {
            continue
          }
          const last = state.lastTriggerAt ? new Date(state.lastTriggerAt).getTime() : 0
          if (Date.now() - last < 10_000) {
            continue
          }
          const outcome = await triggerWithOutcome(ctx, target.slug, {
            cause: 'auto',
            dedupeKey: windowDedupeKey(target.slug, state.dueAt),
            reason: 'Flushed when the admin tab closed',
            req,
          })
          if (outcome.fired && outcome.record.state !== 'error') {
            fired.push(target.slug)
          }
        }
        return json({ fired })
      }),
      method: 'post',
      path: `${base}/flush`,
    },
    {
      handler: withCtx(getCtx, async (ctx, req) => {
        const secret = ctx.options.tick.secret
        const header = req.headers.get('x-vercel-plugin-secret')
        const bySecret = Boolean(secret && header && header === secret)
        if (!bySecret && !(await allowed(ctx.options.access.deploy, req))) {
          return error('Unauthorized', 401)
        }
        return json(await tick(ctx, 'endpoint', { req }))
      }),
      method: 'post',
      path: `${base}/tick`,
    },
    {
      handler: withCtx(getCtx, async (ctx, req) => {
        if (!(await allowed(ctx.options.access.deploy, req))) {
          return error('Unauthorized', 401)
        }
        const body = await readJson<{ paused?: boolean; target?: string }>(req)
        const target = resolveTarget(ctx, req, body)
        const paused = Boolean(body.paused)
        await patchTargetState(ctx, target.slug, paused ? { dueAt: null, paused: true } : { paused: false }, req)
        if (!paused && ctx.options.autoDeploy && (await countPending(ctx, target.slug, req)) > 0) {
          await extendWindow(ctx, target.slug, req)
        }
        return json({ paused, target: target.slug })
      }),
      method: 'patch',
      path: `${base}/pause`,
    },
    {
      handler: withCtx(getCtx, async (ctx, req) => {
        if (!(await allowed(ctx.options.access.rollback, req))) {
          return error('Unauthorized', 401)
        }
        const body = await readJson<{ deploymentId?: string }>(req)
        if (!body.deploymentId) {
          return error('deploymentId is required', 400)
        }
        return json({ deployment: await cancel(ctx, body.deploymentId, { req }) })
      }),
      method: 'post',
      path: `${base}/cancel`,
    },
    {
      handler: withCtx(getCtx, async (ctx, req) => {
        if (!(await allowed(ctx.options.access.rollback, req))) {
          return error('Unauthorized', 401)
        }
        const body = await readJson<{ target?: string; toDeploymentId?: string }>(req)
        const target = resolveTarget(ctx, req, body)
        if (!body.toDeploymentId) {
          return error('toDeploymentId is required', 400)
        }
        return json({ deployment: await rollback(ctx, { req, target: target.slug, toDeploymentId: body.toDeploymentId }) })
      }),
      method: 'post',
      path: `${base}/rollback`,
    },
    {
      handler: withCtx(getCtx, async (ctx, req) => {
        if (!(await allowed(ctx.options.access.rollback, req))) {
          return error('Unauthorized', 401)
        }
        const target = resolveTarget(ctx, req)
        return json({ candidates: await rollbackCandidates(ctx, target.slug) })
      }),
      method: 'get',
      path: `${base}/rollback-candidates`,
    },
    {
      handler: withCtx(getCtx, async (ctx, req) => {
        if (!(await allowed(ctx.options.access.read, req))) {
          return error('Unauthorized', 401)
        }
        return json({ targets: publicTargets(ctx) })
      }),
      method: 'get',
      path: `${base}/targets`,
    },
  ]
  if (options.webhookSecret) {
    endpoints.push(createWebhookEndpoint(getCtx))
  }
  return endpoints
}
