import type { PayloadRequest } from 'payload'

import type { Ctx } from '../store.js'
import type { DeploymentRecord, DeploymentState, SanitizedTarget } from '../types.js'
import type { VercelDeployment } from '../vercel/types.js'

import { reinstate } from '../changes/fold.js'
import {
  clientFor,
  createDeployment,
  findDeploymentByVercelId,
  findDeployments,
  getTargetState,
  patchDeployment,
  patchTargetState,
} from '../store.js'
import { VercelApiError } from '../vercel/client.js'
import { deploymentId } from '../vercel/types.js'
import { MATCH_GIVE_UP_MS, matchDeployment, unclaimedDeployments } from './match.js'
import { canTransition, IN_FLIGHT_STATES, isInFlight, patchFromVercel } from './state.js'
import { safeHook } from './trigger.js'

/** Minimum gap between two Vercel reads for the same row. */
export const ROW_REFRESH_INTERVAL_MS = 10_000
/** External-deployment scans per target. */
export const EXTERNAL_SCAN_INTERVAL_MS = 60_000
/** A triggered row with no match after this long becomes `unknown`; without a token, `unknown` after 15 min. */
export const NO_TOKEN_UNKNOWN_MS = 15 * 60_000

export async function inFlightRows(ctx: Ctx, target: string, req?: PayloadRequest): Promise<DeploymentRecord[]> {
  return findDeployments(ctx, { limit: 20, sort: 'createdAt', where: { and: [{ target: { equals: target } }, { state: { in: IN_FLIGHT_STATES } }] } }, req)
}

async function claimedIds(ctx: Ctx, target: string, req?: PayloadRequest): Promise<Set<string>> {
  const rows = await findDeployments(ctx, { limit: 100, where: { and: [{ target: { equals: target } }, { deploymentId: { exists: true } }] } }, req)
  return new Set(rows.map((r) => r.deploymentId).filter((id): id is string => Boolean(id)))
}

/**
 * Apply a Vercel deployment object to a ledger row: state transition, timestamps, supersede logic,
 * re-instatement, hooks. Idempotent — applying the same object twice changes nothing the second time.
 */
export async function applyVercelDeployment(
  ctx: Ctx,
  record: DeploymentRecord,
  deployment: VercelDeployment,
  req?: PayloadRequest,
): Promise<DeploymentRecord> {
  const patch = patchFromVercel(deployment)
  const nextState = patch.state ?? record.state
  const previousState = record.state
  const moving = canTransition(previousState, nextState)
  if (!moving) {
    delete patch.state
  }
  let updated = await patchDeployment(ctx, record.id, patch, req)
  if (!moving) {
    return updated
  }

  if (nextState === 'canceled') {
    // Vercel cancels the older build when a newer hook call arrives: that row is superseded, not failed.
    const newer = await findDeployments(
      ctx,
      {
        limit: 1,
        sort: 'createdAt',
        where: {
          and: [
            { target: { equals: record.target } },
            { id: { not_equals: record.id } },
            { createdAt: { greater_than: record.createdAt } },
            { state: { not_in: ['canceled', 'error'] } },
          ],
        },
      },
      req,
    )
    if (newer[0]) {
      updated = await patchDeployment(ctx, record.id, { supersededBy: newer[0].id }, req)
    } else {
      await reinstate(ctx, updated, req)
    }
  } else if (nextState === 'error') {
    await reinstate(ctx, updated, req)
  }

  if (nextState === 'ready' && updated.environment === 'production') {
    await patchTargetState(
      ctx,
      record.target,
      { currentDeploymentId: updated.deploymentId ?? null, currentState: 'ready', currentUrl: updated.deploymentUrl ?? null, lastError: null },
      req,
    )
  } else if (isInFlight(nextState)) {
    await patchTargetState(ctx, record.target, { currentState: nextState }, req)
  } else if (nextState === 'error') {
    await patchTargetState(ctx, record.target, { currentState: 'error' }, req)
  }

  await safeHook(ctx, () => ctx.options.hooks.onStateChange?.({ previousState, record: updated }))
  if (nextState === 'ready') {
    await safeHook(ctx, () => ctx.options.hooks.onReady?.({ record: updated }))
  } else if (nextState === 'error') {
    await safeHook(ctx, () => ctx.options.hooks.onError?.({ record: updated }))
  }
  return updated
}

export async function markUnknown(ctx: Ctx, record: DeploymentRecord, why: string, req?: PayloadRequest): Promise<DeploymentRecord> {
  const updated = await patchDeployment(ctx, record.id, { errorMessage: why.slice(0, 500), lastCheckedAt: new Date().toISOString(), state: 'unknown' }, req)
  await safeHook(ctx, () => ctx.options.hooks.onStateChange?.({ previousState: record.state, record: updated }))
  return updated
}

/** Refresh every in-flight row of a target. Returns how many rows were touched. */
export async function refreshTarget(ctx: Ctx, target: SanitizedTarget, opts: { force?: boolean; req?: PayloadRequest } = {}): Promise<number> {
  const rows = await inFlightRows(ctx, target.slug, opts.req)
  if (rows.length === 0) {
    return 0
  }
  const client = clientFor(ctx, target.slug)
  const now = Date.now()
  let touched = 0

  if (!client.hasToken || !target.projectId) {
    for (const row of rows) {
      const since = row.hookCalledAt ? new Date(row.hookCalledAt).getTime() : new Date(row.createdAt).getTime()
      if (now - since > NO_TOKEN_UNKNOWN_MS) {
        await markUnknown(ctx, row, 'No Vercel token: deployment status cannot be read.', opts.req)
        touched++
      }
    }
    return touched
  }

  let listCache: null | VercelDeployment[] = null
  const listSince = async (sinceMs: number): Promise<VercelDeployment[]> => {
    if (listCache) {
      return listCache
    }
    listCache = await client.listDeployments({ limit: 20, projectId: target.projectId!, since: sinceMs })
    return listCache
  }

  try {
    let claimed: null | Set<string> = null
    for (const row of rows) {
      const lastChecked = row.lastCheckedAt ? new Date(row.lastCheckedAt).getTime() : 0
      if (!opts.force && now - lastChecked < ROW_REFRESH_INTERVAL_MS) {
        continue
      }
      if (!row.deploymentId) {
        const hookCalledAt = new Date(row.hookCalledAt ?? row.createdAt)
        if (now - hookCalledAt.getTime() < 3_000) {
          continue
        }
        claimed = claimed ?? (await claimedIds(ctx, target.slug, opts.req))
        const candidates = await listSince(hookCalledAt.getTime() - 60_000)
        const match = matchDeployment({ claimed, deployments: candidates, hookCalledAt })
        if (match) {
          claimed.add(deploymentId(match))
          await applyVercelDeployment(ctx, row, match, opts.req)
          touched++
        } else if (now - hookCalledAt.getTime() > MATCH_GIVE_UP_MS) {
          await markUnknown(ctx, row, 'No deployment appeared on Vercel for this hook call within 10 minutes.', opts.req)
          touched++
        } else {
          await patchDeployment(ctx, row.id, { lastCheckedAt: new Date(now).toISOString() }, opts.req)
        }
        continue
      }
      const deployment = await client.getDeployment(row.deploymentId)
      await applyVercelDeployment(ctx, row, deployment, opts.req)
      touched++
    }
    await patchTargetState(ctx, target.slug, { lastError: null, lastResolvedAt: new Date(now).toISOString() }, opts.req)
  } catch (error) {
    const message = error instanceof VercelApiError ? error.message : error instanceof Error ? error.message : String(error)
    ctx.payload.logger.warn(`[plugin-vercel] Refresh failed for target "${target.slug}": ${message}`)
    await patchTargetState(ctx, target.slug, { lastError: message.slice(0, 300) }, opts.req)
  }
  return touched
}

/** Record deployments on Vercel that no ledger row claims (git pushes, redeploys, other hooks). */
export async function scanExternal(ctx: Ctx, target: SanitizedTarget, opts: { force?: boolean; req?: PayloadRequest } = {}): Promise<number> {
  const client = clientFor(ctx, target.slug)
  if (!ctx.options.recordExternalDeployments || !client.hasToken || !target.projectId) {
    return 0
  }
  const state = await getTargetState(ctx, target.slug, opts.req)
  const now = Date.now()
  const last = state.lastExternalScanAt ? new Date(state.lastExternalScanAt).getTime() : 0
  if (!opts.force && now - last < EXTERNAL_SCAN_INTERVAL_MS) {
    return 0
  }
  let recorded = 0
  try {
    const since = last ? last - 5 * 60_000 : now - 24 * 3_600_000
    const deployments = await client.listDeployments({ limit: 20, projectId: target.projectId, since })
    const claimed = await claimedIds(ctx, target.slug, opts.req)
    // Leave hook deployments younger than the give-up window to the matcher.
    const others = unclaimedDeployments(deployments, claimed).filter(
      (d) => d.source !== 'git-deploy-hook' || now - (d.created ?? d.createdAt ?? now) > MATCH_GIVE_UP_MS,
    )
    for (const d of others) {
      const id = deploymentId(d)
      if (!id || (await findDeploymentByVercelId(ctx, id, opts.req))) {
        continue
      }
      const inserted = await createDeployment(
        ctx,
        { cause: 'external', dedupeKey: `${target.slug}:external:${id}`, state: 'queued', target: target.slug, ...patchFromVercel(d), deploymentId: id },
        opts.req,
      )
      if (inserted.created) {
        recorded++
        const st = inserted.record.state
        if (st === 'ready' && inserted.record.environment === 'production') {
          const current = await getTargetState(ctx, target.slug, opts.req)
          const currentRow = current.currentDeploymentId ? await findDeploymentByVercelId(ctx, current.currentDeploymentId, opts.req) : null
          const newerThanCurrent = !currentRow?.readyAt || (inserted.record.readyAt ?? '') > currentRow.readyAt
          if (newerThanCurrent) {
            await patchTargetState(ctx, target.slug, { currentDeploymentId: id, currentState: 'ready', currentUrl: inserted.record.deploymentUrl ?? null }, opts.req)
          }
        }
      }
    }
    await patchTargetState(ctx, target.slug, { lastExternalScanAt: new Date(now).toISOString() }, opts.req)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ctx.payload.logger.warn(`[plugin-vercel] External scan failed for target "${target.slug}": ${message}`)
    await patchTargetState(ctx, target.slug, { lastError: message.slice(0, 300), lastExternalScanAt: new Date(now).toISOString() }, opts.req)
  }
  return recorded
}

export function describeState(state: DeploymentState): string {
  switch (state) {
    case 'building':
      return 'Building'
    case 'canceled':
      return 'Canceled'
    case 'error':
      return 'Failed'
    case 'queued':
      return 'Queued'
    case 'ready':
      return 'Ready'
    case 'triggered':
      return 'Triggered'
    default:
      return 'Unknown'
  }
}
