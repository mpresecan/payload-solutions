import type { Endpoint, Where } from 'payload'

import { APIError } from 'payload'

import type { Runtime } from '../runtime.js'
import type { ListDoc, SanitizedOptions } from '../types.js'

import { findSource, toSubscriber } from '../sources/subscriber.js'
import { withListFilter } from '../sync/document.js'
import { guarded, routeId } from './helpers.js'

/**
 * `/api/<lists>/:id/subscribers?search=&page=&limit=&subscribed=` — the documents a list's filter
 * matches, read with the requesting user's access. Feeds the subscriber picker on Preview & send.
 *
 * `/api/<lists>/:id/resync` — rebuild this list's segment in the background.
 */
export function createListEndpoints(options: SanitizedOptions, runtime: Runtime): Endpoint[] {
  return [
    {
      handler: guarded(options.access.manage, async (req) => {
        const list = (await req.payload.findByID({
          id: routeId(req),
          collection: options.slugs.lists as never,
          depth: 0,
          overrideAccess: false,
          req,
          user: req.user,
        })) as unknown as ListDoc
        const source = findSource(options, list.source)
        if (!source) {
          throw new APIError(
            `Source "${list.source}" is no longer configured.`,
            400,
            undefined,
            true,
          )
        }
        const url = new URL(req.url ?? 'http://localhost')
        const search = url.searchParams.get('search')?.trim()
        const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
        const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 10))
        const onlySubscribed = url.searchParams.get('subscribed') === 'true'

        const conditions: Where[] = []
        if (search) {
          const paths = [
            source.fields.email,
            source.fields.name,
            source.fields.firstName,
            source.fields.lastName,
          ].filter(Boolean) as string[]
          conditions.push({ or: paths.map((path) => ({ [path]: { like: search } })) })
        }
        if (onlySubscribed) {
          conditions.push({ [source.fields.subscribed]: { equals: true } })
        }
        const result = await req.payload.find({
          collection: source.collection,
          depth: 0,
          limit,
          overrideAccess: false,
          page,
          req,
          sort: source.fields.email,
          user: req.user,
          where: withListFilter(list, conditions.length ? { and: conditions } : undefined),
        })
        return Response.json({
          docs: result.docs.map((doc) =>
            toSubscriber(source, doc as unknown as Record<string, unknown>),
          ),
          page: result.page,
          totalDocs: result.totalDocs,
          totalPages: result.totalPages,
        })
      }),
      method: 'get',
      path: '/:id/subscribers',
    },
    {
      handler: guarded(options.access.send, async (req) => {
        const id = routeId(req)
        const runId = await runtime.startResync({
          lists: [id],
          payload: req.payload,
          trigger: `manual (${req.user?.email ?? 'user'})`,
        })
        return Response.json({ runId })
      }),
      method: 'post',
      path: '/:id/resync',
    },
  ]
}
