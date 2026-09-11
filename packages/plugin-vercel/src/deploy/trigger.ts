import { randomUUID } from 'node:crypto'

import type { Ctx } from '../store.js'
import type { DeploymentRecord, TriggerArgs } from '../types.js'

import { foldPendingInto, reinstate } from '../changes/fold.js'
import { extendWindow } from '../changes/track.js'
import { clientFor, createDeployment, getTargetState, patchDeployment, patchTargetState, targetFor } from '../store.js'
import { rollingHour, VERCEL_HOOKS_PER_HOUR } from './schedule.js'

export class TargetNotConfiguredError extends Error {
  constructor(slug: string) {
    super(`[plugin-vercel] Target "${slug}" has no deploy hook configured.`)
    this.name = 'TargetNotConfiguredError'
  }
}

export class HourlyLimitError extends Error {
  constructor(slug: string) {
    super(`[plugin-vercel] Target "${slug}" has used its ${VERCEL_HOOKS_PER_HOUR} deploy-hook triggers for this hour.`)
    this.name = 'HourlyLimitError'
  }
}

/**
 * The one place a deploy hook is called.
 *
 * 1. Insert the ledger row first, under the unique `dedupeKey`; a concurrent trigger for the same window
 *    finds the row already there and returns it without calling Vercel.
 * 2. Fold the target's pending changes into the row.
 * 3. Clear the debounce window, note the trigger time.
 * 4. Call the hook. On failure the row becomes `error` and the changes go back to pending.
 */
export async function trigger(ctx: Ctx, targetSlug: string, args: TriggerArgs): Promise<DeploymentRecord> {
  return (await triggerWithOutcome(ctx, targetSlug, args)).record
}

export type TriggerOutcome = {
  /** False when another caller had already inserted the row for this `dedupeKey`; no hook call was made. */
  fired: boolean
  record: DeploymentRecord
}

export async function triggerWithOutcome(ctx: Ctx, targetSlug: string, args: TriggerArgs): Promise<TriggerOutcome> {
  const { options, payload } = ctx
  const target = targetFor(ctx, targetSlug)
  if (!target.configured || !target.hook) {
    throw new TargetNotConfiguredError(target.slug)
  }
  const now = new Date()
  const state = await getTargetState(ctx, target.slug, args.req)
  const recent = rollingHour(state.triggerTimes, now)
  if (args.cause === 'auto' && recent.length >= VERCEL_HOOKS_PER_HOUR) {
    // Leave the window open; the next tick after the hour rolls over will fire it.
    throw new HourlyLimitError(target.slug)
  }

  const dedupeKey = args.dedupeKey ?? `${target.slug}:${args.cause}:${randomUUID()}`
  const userId = args.user?.id ?? args.req?.user?.id ?? null
  const inserted = await createDeployment(
    ctx,
    {
      cause: args.cause,
      dedupeKey,
      hookCalledAt: now.toISOString(),
      reason: args.reason?.slice(0, 200) || null,
      state: 'triggered',
      target: target.slug,
      triggeredBy: userId as never,
    },
    args.req,
  )
  if (!inserted.created) {
    return { fired: false, record: inserted.record }
  }
  let record = inserted.record

  const folded = await foldPendingInto(ctx, target.slug, args.req)
  record = await patchDeployment(ctx, record.id, { changeCount: folded.count, changes: folded.summary }, args.req)

  await patchTargetState(
    ctx,
    target.slug,
    {
      dueAt: null,
      lastTriggerAt: now.toISOString(),
      pendingSince: null,
      triggerTimes: rollingHour(recent, now, true),
    },
    args.req,
  )

  try {
    const client = clientFor(ctx, target.slug)
    const buildCache = args.buildCache ?? target.buildCache
    const response = await client.triggerHook(target.hook, { buildCache })
    record = await patchDeployment(ctx, record.id, { hookJobId: response.job?.id ?? null, state: 'triggered' }, args.req)
    await patchTargetState(ctx, target.slug, { currentDeploymentId: null, currentState: 'triggered', lastError: null }, args.req)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    payload.logger.error({ err: error, msg: `[plugin-vercel] Deploy hook call failed for target "${target.slug}"` })
    record = await patchDeployment(ctx, record.id, { errorMessage: message.slice(0, 500), state: 'error' }, args.req)
    await reinstate(ctx, record, args.req)
    await extendWindow(ctx, target.slug, args.req)
    await patchTargetState(ctx, target.slug, { currentState: 'error', lastError: message.slice(0, 300) }, args.req)
    await safeHook(ctx, () => options.hooks.onError?.({ record }))
    return { fired: true, record }
  }

  await safeHook(ctx, () => options.hooks.onTriggered?.({ cause: args.cause, record, target }))
  return { fired: true, record }
}

export async function safeHook(ctx: Ctx, fn: () => Promise<void> | undefined | void): Promise<void> {
  try {
    await fn()
  } catch (error) {
    ctx.payload.logger.error({ err: error, msg: '[plugin-vercel] A plugin hook threw' })
  }
}
