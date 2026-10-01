import type { PayloadRequest } from 'payload'

import { APIError } from 'payload'

import type { Runtime } from '../runtime.js'
import type { RequestAccess, Subscriber } from '../types.js'

import { ResendApiError } from '../resend/client.js'
import { findSource, toSubscriber } from '../sources/subscriber.js'

export async function readJson<T extends object>(req: PayloadRequest): Promise<Partial<T>> {
  try {
    return ((await req.json?.()) ?? {}) as Partial<T>
  } catch {
    return {}
  }
}

/** Wrap a handler: require a user who passes `access`, and turn thrown errors into JSON responses. */
export function guarded(
  access: RequestAccess,
  handler: (req: PayloadRequest) => Promise<Response>,
): (req: PayloadRequest) => Promise<Response> {
  return async (req) => {
    if (!req.user || !(await access({ req }))) {
      return Response.json({ message: 'You are not allowed to do that.' }, { status: 403 })
    }
    try {
      return await handler(req)
    } catch (error) {
      if (error instanceof APIError) {
        return Response.json({ message: error.message }, { status: error.status })
      }
      if (error instanceof ResendApiError) {
        return Response.json({ code: error.code, message: error.message }, { status: 502 })
      }
      req.payload.logger.error({ err: error, msg: '[plugin-resend-broadcasts] Endpoint failed.' })
      return Response.json(
        { message: error instanceof Error ? error.message : 'Something went wrong.' },
        { status: 500 },
      )
    }
  }
}

export function routeId(req: PayloadRequest): string {
  const id = req.routeParams?.id
  if (id === undefined || id === null || id === '') {
    throw new APIError('Missing id.', 400, undefined, true)
  }
  return String(id)
}

export type SubscriberRef = { collection: string; id: number | string }

/**
 * Load one subscriber with the requesting user's own access, so the preview never shows a document
 * the editor could not open in the admin.
 */
export async function loadSubscriber(
  runtime: Runtime,
  req: PayloadRequest,
  ref?: null | SubscriberRef,
): Promise<Subscriber | undefined> {
  if (!ref?.collection || ref.id === undefined || ref.id === null || ref.id === '') {
    return undefined
  }
  const source = findSource(runtime.options, ref.collection)
  if (!source) {
    throw new APIError(`"${ref.collection}" is not a subscriber source.`, 400, undefined, true)
  }
  const doc = await req.payload.findByID({
    id: ref.id,
    collection: source.collection,
    depth: 0,
    overrideAccess: false,
    req,
    user: req.user,
  })
  return toSubscriber(source, doc as unknown as Record<string, unknown>)
}
