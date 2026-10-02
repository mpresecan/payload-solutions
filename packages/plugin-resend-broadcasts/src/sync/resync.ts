import type { ListDoc, ResyncResult, SanitizedSource, Subscriber } from '../types.js'
import type { RemoteContact } from './contacts.js'
import type { SyncContext } from './document.js'

import { INTERNAL_WRITE, SKIP_SYNC } from '../constants.js'
import { isNotFound } from '../resend/client.js'
import { findSource, setByPath, toSubscriber } from '../sources/subscriber.js'
import {
  addToSegment,
  ensureContactProperties,
  listContacts,
  removeFromSegment,
  upsertContactEnsuringProperties,
} from './contacts.js'
import { withListFilter } from './document.js'

const PAGE = 100

export type ResyncArgs = {
  /** Update every existing contact, not only those whose name or subscription differs. */
  force?: boolean
  /** Limit the run to these lists (and the subscribers in them). Omit for everything. */
  lists?: Array<number | string>
  onProgress?: (stats: ResyncResult) => Promise<void> | void
}

/**
 * Reconcile Resend with Payload. Payload is the source of truth for who exists, their names and
 * list membership; Resend is the source of truth for unsubscribes — a contact that unsubscribed in
 * Resend is switched off in Payload, never re-subscribed.
 *
 * 1. Make sure the contact properties exist.
 * 2. For every subscriber in scope: create the contact if they are subscribed and missing, update
 *    it if the name or subscription drifted, pull unsubscribes back.
 * 3. For every list in scope: make sure its segment exists, then add and remove members until the
 *    segment holds exactly the documents its filter matches.
 */
export async function resync(ctx: SyncContext, args: ResyncArgs = {}): Promise<ResyncResult> {
  const stats: ResyncResult = {
    contactsCreated: 0,
    contactsUpdated: 0,
    errors: [],
    pulledUnsubscribes: 0,
    segmentAdds: 0,
    segmentRemovals: 0,
  }
  const note = (error: unknown, what: string) => {
    const message = `${what}: ${error instanceof Error ? error.message : String(error)}`
    stats.errors.push(message)
    ctx.payload.logger.error({ err: error, msg: `[plugin-resend-broadcasts] ${message}` })
  }

  await ensureContactProperties(ctx.client, ctx.options)
  const lists = await loadLists(ctx, args.lists)
  const remote = new Map((await listContacts(ctx.client)).map((c) => [c.email, c]))

  // Step 2: contacts. A full run walks every source; a list run only the documents in those lists.
  const scopes: Array<{ list?: ListDoc; source: SanitizedSource }> = args.lists
    ? lists.flatMap((list) => {
        const source = findSource(ctx.options, list.source)
        return source ? [{ list, source }] : []
      })
    : ctx.options.sources.map((source) => ({ source }))

  for (const { list, source } of scopes) {
    const pulls: Array<number | string> = []
    await eachSubscriber(ctx, source, list, async (subscriber) => {
      try {
        const known = remote.get(subscriber.email)
        if (known?.unsubscribed && subscriber.subscribed) {
          // Applied after the walk: changing documents mid-pagination would shift the pages.
          pulls.push(subscriber.id)
          return
        }
        if (known && !args.force && !drifted(known, subscriber)) {
          return
        }
        if (!known && !subscriber.subscribed) {
          return
        }
        const outcome = await upsertContactEnsuringProperties(ctx.client, ctx.options, subscriber, {
          known: known ?? null,
        })
        if (outcome === 'created') {
          stats.contactsCreated++
          remote.set(subscriber.email, {
            id: '',
            email: subscriber.email,
            first_name: subscriber.firstName,
            last_name: subscriber.lastName,
            unsubscribed: false,
          })
        } else if (outcome === 'updated') {
          stats.contactsUpdated++
          if (!known) {
            // The contact appeared after the snapshot above — typically created by a resync of another list
            // running at the same time. Without this it would be left out of every segment in step 3.
            remote.set(subscriber.email, {
              id: '',
              email: subscriber.email,
              first_name: subscriber.firstName,
              last_name: subscriber.lastName,
              unsubscribed: !subscriber.subscribed,
            })
          }
        }
      } catch (error) {
        note(error, `contact ${subscriber.email}`)
      }
    })
    for (const id of pulls) {
      try {
        await ctx.payload.update({
          id,
          collection: source.collection,
          context: { [SKIP_SYNC]: true },
          data: setByPath(source.fields.subscribed, false),
          overrideAccess: true,
          req: ctx.req,
        })
        stats.pulledUnsubscribes++
      } catch (error) {
        note(error, `unsubscribe ${source.collection} ${id}`)
      }
    }
    await args.onProgress?.(stats)
  }

  // Step 3: segment membership.
  for (const list of lists) {
    const source = findSource(ctx.options, list.source)
    if (!source) {
      await markList(ctx, list, { syncError: `Source "${list.source}" is no longer configured.` })
      continue
    }
    try {
      const segmentId = await ensureSegment(ctx, list)
      const desired = new Set<string>()
      await eachSubscriber(ctx, source, list, (subscriber) => {
        if (remote.has(subscriber.email)) {
          desired.add(subscriber.email)
        }
      })
      const current = new Set((await listContacts(ctx.client, segmentId)).map((c) => c.email))
      for (const email of desired) {
        if (!current.has(email)) {
          try {
            await addToSegment(ctx.client, email, segmentId)
            stats.segmentAdds++
          } catch (error) {
            note(error, `add ${email} to "${list.name}"`)
          }
        }
      }
      for (const email of current) {
        if (!desired.has(email)) {
          try {
            await removeFromSegment(ctx.client, email, segmentId)
            stats.segmentRemovals++
          } catch (error) {
            note(error, `remove ${email} from "${list.name}"`)
          }
        }
      }
      const subscribed = [...desired].filter(
        (email) => remote.get(email)?.unsubscribed === false,
      ).length
      await markList(ctx, list, {
        lastSyncedAt: new Date().toISOString(),
        memberCount: subscribed,
        syncError: null,
      })
    } catch (error) {
      note(error, `list "${list.name}"`)
      await markList(ctx, list, {
        syncError: error instanceof Error ? error.message : String(error),
      })
    }
    await args.onProgress?.(stats)
  }

  return stats
}

function drifted(remote: RemoteContact, subscriber: Subscriber): boolean {
  return (
    (remote.first_name ?? '') !== subscriber.firstName ||
    (remote.last_name ?? '') !== subscriber.lastName ||
    remote.unsubscribed !== !subscriber.subscribed
  )
}

async function loadLists(ctx: SyncContext, ids?: Array<number | string>): Promise<ListDoc[]> {
  const { docs } = await ctx.payload.find({
    collection: ctx.options.slugs.lists as never,
    depth: 0,
    limit: 0,
    overrideAccess: true,
    pagination: false,
    req: ctx.req,
    ...(ids ? { where: { id: { in: ids } } } : {}),
  })
  return docs as unknown as ListDoc[]
}

async function eachSubscriber(
  ctx: SyncContext,
  source: SanitizedSource,
  list: ListDoc | undefined,
  fn: (subscriber: Subscriber) => Promise<void> | void,
): Promise<void> {
  for (let page = 1; ; page++) {
    const result = await ctx.payload.find({
      collection: source.collection,
      depth: 0,
      limit: PAGE,
      overrideAccess: true,
      page,
      req: ctx.req,
      sort: 'id',
      where: list ? withListFilter(list) : {},
    })
    for (const doc of result.docs) {
      const subscriber = toSubscriber(source, doc as unknown as Record<string, unknown>)
      if (subscriber.email) {
        await fn(subscriber)
      }
    }
    if (!result.hasNextPage) {
      return
    }
  }
}

/** The list's segment id, creating the segment when it is missing or was deleted in Resend. */
export async function ensureSegment(ctx: SyncContext, list: ListDoc): Promise<string> {
  if (list.segmentId) {
    try {
      await ctx.client.call('get segment', (r) => r.segments.get(list.segmentId!))
      return list.segmentId
    } catch (error) {
      if (!isNotFound(error)) {
        throw error
      }
    }
  }
  const created = await ctx.client.call('create segment', (r) =>
    r.segments.create({ name: list.name }),
  )
  await markList(ctx, list, { segmentId: created.id })
  list.segmentId = created.id
  return created.id
}

async function markList(ctx: SyncContext, list: ListDoc, data: Partial<ListDoc>): Promise<void> {
  await ctx.payload.update({
    id: list.id,
    collection: ctx.options.slugs.lists as never,
    context: { [INTERNAL_WRITE]: true },
    data: data as never,
    overrideAccess: true,
    req: ctx.req,
  })
}
