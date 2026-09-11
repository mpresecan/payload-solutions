import type { PayloadRequest, TypedUser } from 'payload'

import type { Ctx } from '../store.js'
import type { DeploymentRecord } from '../types.js'
import type { VercelDeployment } from '../vercel/types.js'

import { reinstate } from '../changes/fold.js'
import { clientFor, createDeployment, findDeploymentByVercelId, findDeployments, getTargetState, patchTargetState, targetFor } from '../store.js'
import { applyVercelDeployment } from './refresh.js'
import { isInFlight } from './state.js'
import { safeHook } from './trigger.js'

export async function cancel(ctx: Ctx, deploymentId: string, opts: { req?: PayloadRequest } = {}): Promise<DeploymentRecord> {
  const row = await findDeploymentByVercelId(ctx, deploymentId, opts.req)
  if (!row) {
    throw new Error(`[plugin-vercel] No deployment row for Vercel deployment "${deploymentId}".`)
  }
  if (!isInFlight(row.state)) {
    return row
  }
  const client = clientFor(ctx, row.target)
  const deployment = await client.cancelDeployment(deploymentId)
  return applyVercelDeployment(ctx, row, { ...deployment, readyState: deployment.readyState ?? 'CANCELED' }, opts.req)
}

/** Previous `READY` production deployments Vercel accepts as rollback targets, newest first (max 10). */
export async function rollbackCandidates(ctx: Ctx, targetSlug: string): Promise<VercelDeployment[]> {
  const target = targetFor(ctx, targetSlug)
  const client = clientFor(ctx, target.slug)
  if (!client.hasToken || !target.projectId) {
    return []
  }
  const state = await getTargetState(ctx, target.slug)
  const list = await client.listDeployments({ limit: 20, projectId: target.projectId, state: 'READY', target: 'production' })
  return list
    .filter((d) => d.readyState === 'READY' && d.target === 'production')
    .filter((d) => (d.uid ?? d.id) !== state.currentDeploymentId)
    .filter((d) => d.isRollbackCandidate !== false)
    .sort((a, b) => (b.created ?? b.createdAt ?? 0) - (a.created ?? a.createdAt ?? 0))
    .slice(0, 10)
}

/**
 * Instant rollback: `POST /v1/projects/{id}/rollback/{deploymentId}`. Records a `rollback` row and puts the
 * changes of every ledger row newer than the restored deployment back into pending.
 */
export async function rollback(
  ctx: Ctx,
  args: { req?: PayloadRequest; target: string; toDeploymentId: string; user?: null | TypedUser },
): Promise<DeploymentRecord> {
  const target = targetFor(ctx, args.target)
  const client = clientFor(ctx, target.slug)
  if (!client.hasToken || !target.projectId) {
    throw new Error(`[plugin-vercel] Rollback needs a Vercel token and project id for target "${target.slug}".`)
  }
  const state = await getTargetState(ctx, target.slug, args.req)
  const from = state.currentDeploymentId ?? null
  await client.rollback(target.projectId, args.toDeploymentId)
  const restored = await client.getDeployment(args.toDeploymentId).catch(() => null)
  const restoredRow = await findDeploymentByVercelId(ctx, args.toDeploymentId, args.req)
  const restoredCreatedAt = restoredRow?.vercelCreatedAt ?? (restored?.created ? new Date(restored.created).toISOString() : null)
  const userId = args.user?.id ?? args.req?.user?.id ?? null
  const now = new Date().toISOString()

  const { record } = await createDeployment(
    ctx,
    {
      cause: 'rollback',
      dedupeKey: `${target.slug}:rollback:${now}`,
      deploymentId: null,
      deploymentUrl: restored?.url ? (restored.url.startsWith('http') ? restored.url : `https://${restored.url}`) : (restoredRow?.deploymentUrl ?? null),
      environment: 'production',
      inspectorUrl: restored?.inspectorUrl ?? restoredRow?.inspectorUrl ?? null,
      readyAt: now,
      reason: `Rolled back to ${args.toDeploymentId}`,
      rollbackOf: from,
      rollbackTo: args.toDeploymentId,
      state: 'ready',
      target: target.slug,
      triggeredBy: userId as never,
      vercelCreatedAt: now,
    },
    args.req,
  )

  // Everything that shipped after the restored deployment is no longer live.
  if (restoredCreatedAt) {
    const newer = await findDeployments(
      ctx,
      {
        limit: 200,
        sort: 'createdAt',
        where: {
          and: [
            { target: { equals: target.slug } },
            { state: { equals: 'ready' } },
            { cause: { not_equals: 'rollback' } },
            { vercelCreatedAt: { greater_than: restoredCreatedAt } },
          ],
        },
      },
      args.req,
    )
    for (const row of newer) {
      await reinstate(ctx, row, args.req)
    }
  }

  await patchTargetState(
    ctx,
    target.slug,
    { currentDeploymentId: args.toDeploymentId, currentState: 'ready', currentUrl: record.deploymentUrl ?? null, lastError: null },
    args.req,
  )
  await safeHook(ctx, () => ctx.options.hooks.onTriggered?.({ cause: 'rollback', record, target }))
  return record
}
