import type { CollectionSlug, Payload, PayloadRequest, Where } from 'payload'

import type {
  ChangeOperation,
  DeploymentRecord,
  PendingChange,
  SanitizedTarget,
  SanitizedVercelPluginOptions,
  TargetStateRecord,
} from './types.js'

import { changeKey } from './collections/changes.js'
import { VercelClient } from './vercel/client.js'

/** Everything the server-side modules need; built once in onInit. */
export type Ctx = {
  clients: Map<string, VercelClient>
  fetchImpl?: typeof fetch
  options: SanitizedVercelPluginOptions
  payload: Payload
}

export function createCtx(payload: Payload, options: SanitizedVercelPluginOptions, fetchImpl?: typeof fetch): Ctx {
  const clients = new Map<string, VercelClient>()
  for (const target of options.targets) {
    clients.set(target.slug, VercelClient.forTarget(target, options.apiBase, fetchImpl))
  }
  return { clients, fetchImpl, options, payload }
}

export function clientFor(ctx: Ctx, slug: string): VercelClient {
  const client = ctx.clients.get(slug)
  if (!client) {
    throw new Error(`[plugin-vercel] Unknown target "${slug}".`)
  }
  return client
}

export function targetFor(ctx: Ctx, slug?: string): SanitizedTarget {
  if (!slug) {
    if (ctx.options.targets.length === 1) {
      return ctx.options.targets[0]!
    }
    throw new Error('[plugin-vercel] Several targets are configured; pass `target`.')
  }
  const target = ctx.options.targets.find((t) => t.slug === slug)
  if (!target) {
    throw new Error(`[plugin-vercel] Unknown target "${slug}".`)
  }
  return target
}

export function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; data?: unknown; message?: string; name?: string } | undefined
  const message = String(e?.message ?? '')
  return (
    e?.code === '23505' ||
    e?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    e?.code === 'SQLITE_CONSTRAINT' ||
    /unique|duplicate key|E11000/i.test(message) ||
    /unique/i.test(JSON.stringify(e?.data ?? ''))
  )
}

const slugs = (ctx: Ctx) => ({
  changes: ctx.options.slugs.changes as CollectionSlug,
  deployments: ctx.options.slugs.deployments as CollectionSlug,
  targets: ctx.options.slugs.targets as CollectionSlug,
})

/* ------------------------------------------------------------------ */
/* Target state                                                        */
/* ------------------------------------------------------------------ */

export async function getTargetState(ctx: Ctx, slug: string, req?: PayloadRequest): Promise<TargetStateRecord> {
  const { docs } = await ctx.payload.find({
    collection: slugs(ctx).targets,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where: { slug: { equals: slug } },
  })
  if (docs[0]) {
    return docs[0] as unknown as TargetStateRecord
  }
  try {
    return (await ctx.payload.create({
      collection: slugs(ctx).targets,
      data: { slug, paused: false },
      depth: 0,
      overrideAccess: true,
      req,
    })) as unknown as TargetStateRecord
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error
    }
    return getTargetState(ctx, slug, req)
  }
}

export async function patchTargetState(
  ctx: Ctx,
  slug: string,
  patch: Partial<Omit<TargetStateRecord, 'id' | 'slug'>>,
  req?: PayloadRequest,
): Promise<TargetStateRecord> {
  const current = await getTargetState(ctx, slug, req)
  return (await ctx.payload.update({
    id: current.id,
    collection: slugs(ctx).targets,
    data: patch as never,
    depth: 0,
    overrideAccess: true,
    req,
  })) as unknown as TargetStateRecord
}

/* ------------------------------------------------------------------ */
/* Pending changes                                                     */
/* ------------------------------------------------------------------ */

export async function listPending(ctx: Ctx, target: string, limit = 1000, req?: PayloadRequest): Promise<PendingChange[]> {
  const { docs } = await ctx.payload.find({
    collection: slugs(ctx).changes,
    depth: 0,
    limit,
    overrideAccess: true,
    pagination: false,
    req,
    sort: 'changedAt',
    where: { target: { equals: target } },
  })
  return docs as unknown as PendingChange[]
}

export async function countPending(ctx: Ctx, target: string, req?: PayloadRequest): Promise<number> {
  const { totalDocs } = await ctx.payload.count({
    collection: slugs(ctx).changes,
    overrideAccess: true,
    req,
    where: { target: { equals: target } },
  })
  return totalDocs
}

export async function findPending(
  ctx: Ctx,
  target: string,
  entity: { collection?: null | string; docId?: null | string; global?: null | string },
  req?: PayloadRequest,
): Promise<null | PendingChange> {
  const { docs } = await ctx.payload.find({
    collection: slugs(ctx).changes,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where: { key: { equals: changeKey(target, entity) } },
  })
  return (docs[0] as unknown as PendingChange | undefined) ?? null
}

export type UpsertChangeArgs = {
  collection?: null | string
  docId?: null | string
  global?: null | string
  operation: ChangeOperation
  target: string
  title: string
  user?: null | number | string
}

/** Insert the pending row or bump the existing one. Returns true when the row is new. */
export async function upsertChange(ctx: Ctx, args: UpsertChangeArgs, req?: PayloadRequest): Promise<boolean> {
  const key = changeKey(args.target, args)
  const now = new Date().toISOString()
  const existing = await findPending(ctx, args.target, args, req)
  if (existing) {
    await ctx.payload.update({
      id: existing.id,
      collection: slugs(ctx).changes,
      data: {
        changedAt: now,
        operation: args.operation === 'delete' ? 'delete' : existing.operation === 'create' ? 'create' : args.operation,
        saves: (existing.saves ?? 1) + 1,
        title: args.title,
        user: args.user ?? null,
      } as never,
      depth: 0,
      overrideAccess: true,
      req,
    })
    return false
  }
  try {
    await ctx.payload.create({
      collection: slugs(ctx).changes,
      data: {
        changedAt: now,
        collection: args.collection ?? null,
        docId: args.docId ?? null,
        global: args.global ?? null,
        key,
        operation: args.operation,
        saves: 1,
        target: args.target,
        title: args.title,
        user: args.user ?? null,
      } as never,
      depth: 0,
      overrideAccess: true,
      req,
    })
    return true
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error
    }
    // Lost a race with a concurrent save of the same document: bump instead.
    return upsertChange(ctx, args, req)
  }
}

export async function deleteChanges(ctx: Ctx, ids: (number | string)[], req?: PayloadRequest): Promise<void> {
  if (ids.length === 0) {
    return
  }
  await ctx.payload.delete({
    collection: slugs(ctx).changes,
    depth: 0,
    overrideAccess: true,
    req,
    where: { id: { in: ids } },
  })
}

/* ------------------------------------------------------------------ */
/* Deployments                                                         */
/* ------------------------------------------------------------------ */

export type CreateDeploymentResult = { created: boolean; record: DeploymentRecord }

/**
 * Insert a ledger row. `dedupeKey` is unique: a second insert with the same key returns the existing row
 * with `created: false`, which is how two ticks that observe the same window produce one trigger.
 */
export async function createDeployment(
  ctx: Ctx,
  data: Partial<DeploymentRecord> & Pick<DeploymentRecord, 'cause' | 'dedupeKey' | 'state' | 'target'>,
  req?: PayloadRequest,
): Promise<CreateDeploymentResult> {
  try {
    const record = (await ctx.payload.create({
      collection: slugs(ctx).deployments,
      data: { changeCount: 0, ...data } as never,
      depth: 0,
      overrideAccess: true,
      req,
    })) as unknown as DeploymentRecord
    return { created: true, record }
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error
    }
    const existing = await findDeploymentByKey(ctx, data.dedupeKey, req)
    if (!existing) {
      throw error
    }
    return { created: false, record: existing }
  }
}

export async function findDeploymentByKey(ctx: Ctx, dedupeKey: string, req?: PayloadRequest): Promise<null | DeploymentRecord> {
  const { docs } = await ctx.payload.find({
    collection: slugs(ctx).deployments,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where: { dedupeKey: { equals: dedupeKey } },
  })
  return (docs[0] as unknown as DeploymentRecord | undefined) ?? null
}

export async function getDeployment(ctx: Ctx, id: number | string, req?: PayloadRequest): Promise<DeploymentRecord> {
  return (await ctx.payload.findByID({
    id,
    collection: slugs(ctx).deployments,
    depth: 0,
    overrideAccess: true,
    req,
  })) as unknown as DeploymentRecord
}

export async function patchDeployment(
  ctx: Ctx,
  id: number | string,
  patch: Partial<DeploymentRecord>,
  req?: PayloadRequest,
): Promise<DeploymentRecord> {
  return (await ctx.payload.update({
    id,
    collection: slugs(ctx).deployments,
    data: patch as never,
    depth: 0,
    overrideAccess: true,
    req,
  })) as unknown as DeploymentRecord
}

export async function findDeployments(
  ctx: Ctx,
  args: { depth?: number; limit?: number; sort?: string; where: Where },
  req?: PayloadRequest,
): Promise<DeploymentRecord[]> {
  const { docs } = await ctx.payload.find({
    collection: slugs(ctx).deployments,
    depth: args.depth ?? 0,
    limit: args.limit ?? 50,
    overrideAccess: true,
    pagination: false,
    req,
    sort: args.sort ?? '-createdAt',
    where: args.where,
  })
  return docs as unknown as DeploymentRecord[]
}

export async function findDeploymentByVercelId(ctx: Ctx, deploymentId: string, req?: PayloadRequest): Promise<null | DeploymentRecord> {
  const docs = await findDeployments(ctx, { limit: 1, where: { deploymentId: { equals: deploymentId } } }, req)
  return docs[0] ?? null
}

export async function deleteDeployments(ctx: Ctx, ids: (number | string)[], req?: PayloadRequest): Promise<void> {
  if (ids.length === 0) {
    return
  }
  await ctx.payload.delete({
    collection: slugs(ctx).deployments,
    depth: 0,
    overrideAccess: true,
    req,
    where: { id: { in: ids } },
  })
}

export function relId(value: DeploymentRecord['triggeredBy']): null | number | string {
  if (value === null || value === undefined) {
    return null
  }
  return typeof value === 'object' ? value.id : value
}
