import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, GlobalAfterChangeHook, PayloadRequest } from 'payload'

import type { Ctx } from '../store.js'
import type { ChangeOperation } from '../types.js'

import { nextWindow } from '../deploy/schedule.js'
import { getTargetState, patchTargetState, upsertChange } from '../store.js'
import { classifyChange, resolveTitle } from './summary.js'

export type MarkChangedArgs = {
  collection?: string
  global?: string
  id?: number | string
  operation?: ChangeOperation
  req?: PayloadRequest
  target?: string
  title?: string
}

/** Skip recording when application code sets `req.context.vercelSkip = true` (imports, migrations). */
export function shouldSkip(req: PayloadRequest | undefined): boolean {
  return Boolean(req?.context && (req.context as Record<string, unknown>).vercelSkip)
}

/**
 * Record a change for the given targets and open/extend their debounce windows. Never throws: a failure
 * here must not fail the editor's save.
 */
export async function markChanged(ctx: Ctx, args: MarkChangedArgs): Promise<void> {
  const { options, payload } = ctx
  const targets = args.target
    ? [args.target]
    : args.collection
      ? (options.collections[args.collection]?.targets ?? options.targets.map((t) => t.slug))
      : args.global
        ? (options.globals[args.global]?.targets ?? options.targets.map((t) => t.slug))
        : options.targets.map((t) => t.slug)
  const userId = args.req?.user?.id ?? null
  const title = args.title ?? (args.global ? args.global : `#${String(args.id ?? '')}`)
  const operation = args.operation ?? 'update'
  for (const slug of targets) {
    const target = options.targets.find((t) => t.slug === slug)
    if (!target) {
      payload.logger.warn(`[plugin-vercel] markChanged: unknown target "${slug}"`)
      continue
    }
    try {
      await upsertChange(
        ctx,
        {
          collection: args.collection ?? null,
          docId: args.id === undefined || args.id === null ? null : String(args.id),
          global: args.global ?? null,
          operation,
          target: slug,
          title,
          user: userId as never,
        },
        args.req,
      )
      await extendWindow(ctx, slug, args.req)
    } catch (error) {
      payload.logger.error({ err: error, msg: `[plugin-vercel] Failed to record a change for target "${slug}"` })
    }
  }
}

/** Open or push out the automatic-deploy window for a target. */
export async function extendWindow(ctx: Ctx, slug: string, req?: PayloadRequest): Promise<void> {
  const { options } = ctx
  if (!options.autoDeploy) {
    return
  }
  const target = options.targets.find((t) => t.slug === slug)
  if (!target?.configured) {
    return
  }
  const state = await getTargetState(ctx, slug, req)
  if (state.paused) {
    return
  }
  const now = new Date()
  const next = nextWindow(
    {
      dueAt: state.dueAt ? new Date(state.dueAt) : null,
      pendingSince: state.pendingSince ? new Date(state.pendingSince) : null,
    },
    now,
    options.autoDeploy.quietPeriodMs,
    options.autoDeploy.maxWaitMs,
  )
  await patchTargetState(
    ctx,
    slug,
    { dueAt: next.dueAt?.toISOString() ?? null, pendingSince: next.pendingSince?.toISOString() ?? null },
    req,
  )
}

/* ------------------------------------------------------------------ */
/* Hooks injected into host collections and globals                    */
/* ------------------------------------------------------------------ */

type GetCtx = () => Ctx | undefined

export function collectionAfterChange(getCtx: GetCtx, slug: string, hasDrafts: boolean, useAsTitle?: string): CollectionAfterChangeHook {
  return async ({ doc, operation, previousDoc, req }) => {
    const ctx = getCtx()
    if (!ctx || shouldSkip(req)) {
      return doc
    }
    const tracked = ctx.options.collections[slug]
    if (!tracked) {
      return doc
    }
    const change = classifyChange({ doc, hasDrafts, on: tracked.on, operation, previousDoc })
    if (!change) {
      return doc
    }
    if (ctx.options.hooks.shouldTrack) {
      try {
        if (!(await ctx.options.hooks.shouldTrack({ collection: slug, doc, operation: change, previousDoc, req }))) {
          return doc
        }
      } catch (error) {
        ctx.payload.logger.error({ err: error, msg: '[plugin-vercel] hooks.shouldTrack threw; change recorded anyway' })
      }
    }
    await markChanged(ctx, {
      collection: slug,
      id: doc.id,
      operation: change,
      req,
      title: resolveTitle(doc, useAsTitle, doc.id),
    })
    return doc
  }
}

export function collectionAfterDelete(getCtx: GetCtx, slug: string, useAsTitle?: string): CollectionAfterDeleteHook {
  return async ({ doc, id, req }) => {
    const ctx = getCtx()
    if (!ctx || shouldSkip(req) || !ctx.options.collections[slug]) {
      return doc
    }
    if (ctx.options.hooks.shouldTrack) {
      try {
        if (!(await ctx.options.hooks.shouldTrack({ collection: slug, doc: doc ?? {}, operation: 'delete', req }))) {
          return doc
        }
      } catch {
        // recorded anyway
      }
    }
    await markChanged(ctx, {
      collection: slug,
      id,
      operation: 'delete',
      req,
      title: resolveTitle(doc ?? {}, useAsTitle, id),
    })
    return doc
  }
}

export function globalAfterChange(getCtx: GetCtx, slug: string, label: string): GlobalAfterChangeHook {
  return async ({ doc, req }) => {
    const ctx = getCtx()
    if (!ctx || shouldSkip(req) || !ctx.options.globals[slug]) {
      return doc
    }
    if (ctx.options.hooks.shouldTrack) {
      try {
        if (!(await ctx.options.hooks.shouldTrack({ doc, global: slug, operation: 'update', req }))) {
          return doc
        }
      } catch {
        // recorded anyway
      }
    }
    await markChanged(ctx, { global: slug, operation: 'update', req, title: label })
    return doc
  }
}
