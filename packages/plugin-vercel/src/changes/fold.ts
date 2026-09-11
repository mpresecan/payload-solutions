import type { PayloadRequest } from 'payload'

import type { Ctx } from '../store.js'
import type { ChangeSummary, DeploymentRecord } from '../types.js'

import { deleteChanges, listPending, upsertChange } from '../store.js'
import { summarize } from './summary.js'

/**
 * Move a target's pending rows into a deployment's summary and delete them. Only the rows that were read
 * are deleted, so a change landing in between stays pending for the next window.
 */
export async function foldPendingInto(ctx: Ctx, target: string, req?: PayloadRequest): Promise<{ count: number; summary: ChangeSummary }> {
  const rows = await listPending(ctx, target, 5000, req)
  const summary = summarize(rows)
  await deleteChanges(
    ctx,
    rows.map((r) => r.id),
    req,
  )
  return { count: rows.length, summary }
}

/**
 * Put a deployment's changes back into the pending set: a failed or canceled build did not ship them,
 * a rollback un-shipped everything newer. Items past the summary cap are lost, which the caller shows as a
 * count (spec §8).
 */
export async function reinstate(ctx: Ctx, record: DeploymentRecord, req?: PayloadRequest): Promise<number> {
  const items = record.changes?.items ?? []
  let count = 0
  for (const item of items) {
    try {
      await upsertChange(
        ctx,
        {
          collection: item.g ? null : item.c || null,
          docId: item.id ?? null,
          global: item.g ?? null,
          operation: item.op,
          target: record.target,
          title: item.t,
          user: null,
        },
        req,
      )
      count++
    } catch (error) {
      ctx.payload.logger.warn({ err: error, msg: `[plugin-vercel] Could not re-instate change "${item.t}"` })
    }
  }
  return count
}
