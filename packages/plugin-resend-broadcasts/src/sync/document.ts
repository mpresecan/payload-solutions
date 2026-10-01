import type { Payload, PayloadRequest, Where } from 'payload'

import type { ResendClient } from '../resend/client.js'
import type { ListDoc, SanitizedOptions, SanitizedSource } from '../types.js'

import { getByPath, normalizeEmail, toSubscriber } from '../sources/subscriber.js'
import {
  addToSegment,
  deleteContact,
  removeFromSegment,
  upsertContactEnsuringProperties,
} from './contacts.js'

export type SyncContext = {
  client: ResendClient
  options: SanitizedOptions
  payload: Payload
  req?: PayloadRequest
}

export async function listsForSource(ctx: SyncContext, collection: string): Promise<ListDoc[]> {
  const { docs } = await ctx.payload.find({
    collection: ctx.options.slugs.lists as never,
    depth: 0,
    limit: 0,
    overrideAccess: true,
    pagination: false,
    req: ctx.req,
    where: { source: { equals: collection } },
  })
  return docs as unknown as ListDoc[]
}

/** A list's filter combined with an extra condition. An empty filter matches the whole collection. */
export function withListFilter(list: Pick<ListDoc, 'filter'>, extra?: Where): Where {
  const filter =
    list.filter && typeof list.filter === 'object' && Object.keys(list.filter).length
      ? (list.filter as Where)
      : null
  const parts = [filter, extra].filter(Boolean) as Where[]
  if (!parts.length) {
    return {}
  }
  return parts.length === 1 ? parts[0] : { and: parts }
}

export async function matchesList(
  ctx: SyncContext,
  list: ListDoc,
  id: number | string,
): Promise<boolean> {
  const { totalDocs } = await ctx.payload.count({
    collection: list.source as never,
    overrideAccess: true,
    req: ctx.req,
    where: withListFilter(list, { id: { equals: id } }),
  })
  return totalDocs > 0
}

/**
 * Bring Resend in line with one saved subscriber document: move the contact if the email changed,
 * create/update it, then add it to or remove it from the segment of every list over its collection.
 */
export async function syncDocument(
  ctx: SyncContext,
  source: SanitizedSource,
  doc: Record<string, unknown>,
  previousDoc?: null | Record<string, unknown>,
): Promise<void> {
  const subscriber = toSubscriber(source, doc)
  const previousEmail = previousDoc
    ? normalizeEmail(getByPath(previousDoc, source.fields.email))
    : ''

  if (previousEmail && previousEmail !== subscriber.email) {
    await removeDocument(
      ctx,
      source,
      { ...previousDoc, id: doc.id },
      { excludeId: doc.id as number | string },
    )
  }
  if (!subscriber.email) {
    return
  }

  // A brand-new document most likely has no contact yet, so skip the update-then-404 round trip.
  const isNew = !previousDoc || !previousEmail
  const outcome = await upsertContactEnsuringProperties(
    ctx.client,
    ctx.options,
    subscriber,
    isNew ? { known: null } : {},
  )
  if (outcome === 'missing') {
    return
  }

  for (const list of await listsForSource(ctx, source.collection)) {
    if (!list.segmentId) {
      continue
    }
    if (await matchesList(ctx, list, subscriber.id)) {
      await addToSegment(ctx.client, subscriber.email, list.segmentId)
    } else {
      await removeFromSegment(ctx.client, subscriber.email, list.segmentId)
    }
  }
}

/**
 * A subscriber document is gone (or its email changed): take the address out of this collection's
 * segments, and delete the contact when no other subscriber document anywhere still uses it.
 */
export async function removeDocument(
  ctx: SyncContext,
  source: SanitizedSource,
  doc: Record<string, unknown>,
  { excludeId }: { excludeId?: number | string } = {},
): Promise<void> {
  const email = normalizeEmail(getByPath(doc, source.fields.email))
  if (!email) {
    return
  }
  for (const list of await listsForSource(ctx, source.collection)) {
    if (list.segmentId) {
      await removeFromSegment(ctx.client, email, list.segmentId)
    }
  }
  if (!ctx.options.deleteContacts) {
    return
  }
  for (const other of ctx.options.sources) {
    const where: Where = { [other.fields.email]: { equals: email } }
    const { totalDocs } = await ctx.payload.count({
      collection: other.collection,
      overrideAccess: true,
      req: ctx.req,
      where:
        other.collection === source.collection && excludeId !== undefined
          ? { and: [where, { id: { not_equals: excludeId } }] }
          : where,
    })
    if (totalDocs > 0) {
      return
    }
  }
  await deleteContact(ctx.client, email)
}
