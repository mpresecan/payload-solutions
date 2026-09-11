import type { PayloadRequest } from 'payload'

import type { Ctx } from '../store.js'
import type { TickResult, TickSource } from '../types.js'

import { countPending, deleteDeployments, findDeployments, getTargetState, patchTargetState } from '../store.js'
import { refreshTarget, scanExternal } from './refresh.js'
import { isDue, nextWindow, windowDedupeKey } from './schedule.js'
import { HourlyLimitError, triggerWithOutcome } from './trigger.js'

/** Ticks from the same process closer together than this only refresh, never re-scan. */
const MIN_TICK_GAP_MS = 2_000
const RETENTION_INTERVAL_MS = 3_600_000

const lastTickByProcess = new Map<string, number>()

/**
 * One tick: fire due targets, refresh in-flight rows, scan for external deployments, apply retention.
 * Any caller can tick — the admin heartbeat, the beacon flush, the scheduled task, an external cron.
 * Concurrent ticks are safe: triggers dedupe on the window key, refreshes are idempotent.
 */
export async function tick(ctx: Ctx, source: TickSource = 'local', opts: { req?: PayloadRequest } = {}): Promise<TickResult> {
  const result: TickResult = { errors: [], refreshed: 0, source, triggered: [] }
  const now = new Date()
  const processKey = ctx.options.slugs.targets
  const last = lastTickByProcess.get(processKey) ?? 0
  const throttled = now.getTime() - last < MIN_TICK_GAP_MS
  lastTickByProcess.set(processKey, now.getTime())

  for (const target of ctx.options.targets) {
    try {
      const state = await getTargetState(ctx, target.slug, opts.req)
      const patch: Parameters<typeof patchTargetState>[2] = { lastTickAt: now.toISOString(), lastTickSource: source }

      if (target.configured && ctx.options.autoDeploy && !state.paused) {
        if (isDue(state, now)) {
          try {
            const outcome = await triggerWithOutcome(ctx, target.slug, {
              cause: 'auto',
              dedupeKey: windowDedupeKey(target.slug, state.dueAt!),
              reason: 'Automatic deployment after content changes',
              req: opts.req,
            })
            if (outcome.fired && outcome.record.state !== 'error') {
              result.triggered.push(target.slug)
            }
          } catch (error) {
            if (!(error instanceof HourlyLimitError)) {
              throw error
            }
            result.errors.push(error.message)
          }
        } else if (!state.dueAt && (await countPending(ctx, target.slug, opts.req)) > 0) {
          // Self-heal: pending rows without a window (a lost update, or autoDeploy enabled after the fact).
          const next = nextWindow({ dueAt: null, pendingSince: state.pendingSince ? new Date(state.pendingSince) : null }, now, ctx.options.autoDeploy.quietPeriodMs, ctx.options.autoDeploy.maxWaitMs)
          patch.dueAt = next.dueAt?.toISOString() ?? null
          patch.pendingSince = next.pendingSince?.toISOString() ?? null
        }
      }

      if (!throttled) {
        result.refreshed += await refreshTarget(ctx, target, { req: opts.req })
        await scanExternal(ctx, target, { req: opts.req })
        const lastRetention = state.lastRetentionAt ? new Date(state.lastRetentionAt).getTime() : 0
        if (now.getTime() - lastRetention > RETENTION_INTERVAL_MS) {
          await applyRetention(ctx, target.slug, opts.req)
          patch.lastRetentionAt = now.toISOString()
        }
      }
      await patchTargetState(ctx, target.slug, patch, opts.req)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      ctx.payload.logger.error({ err: error, msg: `[plugin-vercel] Tick failed for target "${target.slug}"` })
      result.errors.push(`${target.slug}: ${message}`)
    }
  }
  return result
}

/** Delete rows older than `retention.days` and beyond `retention.keep` per target. Never in-flight rows. */
export async function applyRetention(ctx: Ctx, target: string, req?: PayloadRequest): Promise<number> {
  const { days, keep } = ctx.options.retention
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
  const old = await findDeployments(
    ctx,
    { limit: 500, where: { and: [{ target: { equals: target } }, { createdAt: { less_than: cutoff } }, { state: { in: ['ready', 'error', 'canceled', 'unknown'] } }] } },
    req,
  )
  const ids = old.map((r) => r.id)
  const all = await findDeployments(ctx, { limit: keep + 500, sort: '-createdAt', where: { target: { equals: target } } }, req)
  for (const row of all.slice(keep)) {
    if (!ids.includes(row.id) && ['ready', 'error', 'canceled', 'unknown'].includes(row.state)) {
      ids.push(row.id)
    }
  }
  await deleteDeployments(ctx, ids, req)
  return ids.length
}
