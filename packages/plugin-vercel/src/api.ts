import type { PayloadRequest } from 'payload'

import type { Ctx } from './store.js'
import type { DeploymentRecord, TargetStatus, VercelAPI } from './types.js'

import { extendWindow, markChanged } from './changes/track.js'
import { cancel, rollback, rollbackCandidates } from './deploy/actions.js'
import { inFlightRows, refreshTarget } from './deploy/refresh.js'
import { rollingHour, windowDedupeKey } from './deploy/schedule.js'
import { tick } from './deploy/tick.js'
import { trigger } from './deploy/trigger.js'
import { countPending, findDeploymentByVercelId, findDeployments, getTargetState, listPending, patchTargetState, targetFor } from './store.js'

export async function targetStatus(ctx: Ctx, slug: string, req?: PayloadRequest): Promise<TargetStatus> {
  const target = targetFor(ctx, slug)
  const [state, pendingCount, inFlight] = await Promise.all([
    getTargetState(ctx, target.slug, req),
    countPending(ctx, target.slug, req),
    inFlightRows(ctx, target.slug, req),
  ])
  let current: DeploymentRecord | null = null
  if (state.currentDeploymentId) {
    current = await findDeploymentByVercelId(ctx, state.currentDeploymentId, req)
  }
  if (!current) {
    const latest = await findDeployments(ctx, { limit: 1, where: { and: [{ target: { equals: target.slug } }, { state: { not_in: ['triggered', 'queued', 'building'] } }] } }, req)
    current = latest[0] ?? null
  }
  const now = new Date()
  return {
    configured: target.configured,
    current,
    dueAt: state.dueAt ?? null,
    inFlight: inFlight.at(-1) ?? null,
    label: target.label,
    lastError: state.lastError ?? null,
    lastTickAt: state.lastTickAt ?? null,
    lastTickSource: state.lastTickSource ?? null,
    lastTriggerAt: state.lastTriggerAt ?? null,
    missing: target.configured ? undefined : 'Deploy hook URL is not set',
    paused: Boolean(state.paused),
    pendingCount,
    pendingSince: state.pendingSince ?? null,
    projectId: target.projectId,
    slug: target.slug,
    tokenConfigured: Boolean(target.token),
    triggersLastHour: rollingHour(state.triggerTimes, now).length,
    url: target.url,
  }
}

export function createVercelAPI(ctx: Ctx): VercelAPI {
  const api: VercelAPI = {
    cancel: (deploymentId, opts) => cancel(ctx, deploymentId, opts),

    deploy: async (args = {}) => {
      const target = targetFor(ctx, args.target)
      return trigger(ctx, target.slug, { buildCache: args.buildCache, cause: 'api', reason: args.reason, req: args.req })
    },

    deployAll: async (args = {}) => {
      const out: DeploymentRecord[] = []
      for (const target of ctx.options.targets) {
        if (target.configured) {
          out.push(await trigger(ctx, target.slug, { cause: 'api', reason: args.reason, req: args.req }))
        }
      }
      return out
    },

    flush: async (opts = {}) => {
      const out: DeploymentRecord[] = []
      for (const target of ctx.options.targets) {
        if (!target.configured || (opts.targets && !opts.targets.includes(target.slug))) {
          continue
        }
        const state = await getTargetState(ctx, target.slug, opts.req)
        if (state.paused) {
          continue
        }
        const pending = await countPending(ctx, target.slug, opts.req)
        if (pending === 0 && !state.dueAt) {
          continue
        }
        const dedupeKey = state.dueAt ? windowDedupeKey(target.slug, state.dueAt) : undefined
        out.push(await trigger(ctx, target.slug, { cause: 'auto', dedupeKey, reason: 'Flushed pending changes', req: opts.req }))
      }
      return out
    },

    history: (target, opts = {}) => findDeployments(ctx, { depth: 1, limit: opts.limit ?? 20, where: { target: { equals: target } } }),

    markChanged: (args) => markChanged(ctx, args),

    options: ctx.options,

    pause: async (target, paused) => {
      targetFor(ctx, target)
      await patchTargetState(ctx, target, paused ? { dueAt: null, paused: true } : { paused: false })
      if (!paused && ctx.options.autoDeploy && (await countPending(ctx, target)) > 0) {
        await extendWindow(ctx, target)
      }
    },

    pending: (target, opts = {}) => listPending(ctx, target, opts.limit ?? 100),

    refresh: async (target) => {
      const targets = target ? [targetFor(ctx, target)] : ctx.options.targets
      for (const t of targets) {
        await refreshTarget(ctx, t, { force: true })
      }
    },

    rollback: (args) => rollback(ctx, args),

    rollbackCandidates: (target) => rollbackCandidates(ctx, target),

    status: (async (target?: string) => {
      if (target) {
        return targetStatus(ctx, target)
      }
      return Promise.all(ctx.options.targets.map((t) => targetStatus(ctx, t.slug)))
    }) as VercelAPI['status'],

    target: (slug) => targetFor(ctx, slug),

    tick: (source) => tick(ctx, source ?? 'local'),
  }
  return api
}
