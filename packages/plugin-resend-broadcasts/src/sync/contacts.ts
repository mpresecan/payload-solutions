import type { ResendClient } from '../resend/client.js'
import type { SanitizedOptions, Subscriber } from '../types.js'

import { FULL_NAME_PROPERTY } from '../constants.js'
import { isNotFound, ResendApiError } from '../resend/client.js'

export type RemoteContact = {
  email: string
  first_name?: null | string
  id: string
  last_name?: null | string
  unsubscribed: boolean
}

function contactProperties(subscriber: Subscriber): Record<string, null | number | string> {
  return { [FULL_NAME_PROPERTY]: subscriber.name || null, ...subscriber.properties }
}

/**
 * Create or update the Resend contact for a subscriber. An unsubscribed subscriber updates an
 * existing contact (so Resend stops mailing them) but never creates one — nobody is added to
 * Resend before they opt in. Returns whether a contact exists afterwards.
 */
export async function upsertContact(
  client: ResendClient,
  subscriber: Subscriber,
  { known }: { known?: null | RemoteContact } = {},
): Promise<'created' | 'missing' | 'updated'> {
  const update = async () => {
    await client.call('update contact', (r) =>
      r.contacts.update({
        email: subscriber.email,
        firstName: subscriber.firstName || null,
        lastName: subscriber.lastName || null,
        properties: contactProperties(subscriber),
        unsubscribed: !subscriber.subscribed,
      }),
    )
    return 'updated' as const
  }
  const create = async () => {
    await client.call('create contact', (r) =>
      r.contacts.create({
        email: subscriber.email,
        firstName: subscriber.firstName || undefined,
        lastName: subscriber.lastName || undefined,
        properties: withoutNulls(contactProperties(subscriber)),
        unsubscribed: false,
      }),
    )
    return 'created' as const
  }

  // Believed new (`known: null`): create first, and fall back to an update if the address turns out
  // to exist already — another source may have created it.
  if (known === null) {
    if (!subscriber.subscribed) {
      return 'missing'
    }
    try {
      return await create()
    } catch (error) {
      try {
        return await update()
      } catch {
        throw error
      }
    }
  }
  try {
    return await update()
  } catch (error) {
    if (!isNotFound(error)) {
      throw error
    }
  }
  return subscriber.subscribed ? create() : 'missing'
}

export async function deleteContact(client: ResendClient, email: string): Promise<void> {
  try {
    await client.call('delete contact', (r) => r.contacts.remove({ email }))
  } catch (error) {
    if (!isNotFound(error)) {
      throw error
    }
  }
}

export async function addToSegment(
  client: ResendClient,
  email: string,
  segmentId: string,
): Promise<void> {
  await client.call('add contact to segment', (r) => r.contacts.segments.add({ email, segmentId }))
}

export async function removeFromSegment(
  client: ResendClient,
  email: string,
  segmentId: string,
): Promise<void> {
  try {
    await client.call('remove contact from segment', (r) =>
      r.contacts.segments.remove({ email, segmentId }),
    )
  } catch (error) {
    if (!isNotFound(error)) {
      throw error
    }
  }
}

/** Every contact on the team, or in one segment, following Resend's cursor pagination. */
export async function listContacts(
  client: ResendClient,
  segmentId?: string,
): Promise<RemoteContact[]> {
  const out: RemoteContact[] = []
  let after: string | undefined
  for (;;) {
    const page = await client.call('list contacts', (r) =>
      r.contacts.list({
        limit: 100,
        ...(after ? { after } : {}),
        ...(segmentId ? { segmentId } : {}),
      } as never),
    )
    const data = (page?.data ?? []) as RemoteContact[]
    out.push(...data.map((c) => ({ ...c, email: c.email.toLowerCase() })))
    if (!page?.has_more || !data.length) {
      return out
    }
    after = data[data.length - 1].id
  }
}

const ensured = new WeakMap<ResendClient, Promise<void>>()

/**
 * `upsertContact`, recovering once when Resend rejects a property that does not exist — which
 * happens when someone deletes it in the dashboard after this process already ensured it.
 */
export async function upsertContactEnsuringProperties(
  client: ResendClient,
  options: SanitizedOptions,
  subscriber: Subscriber,
  args: { known?: null | RemoteContact } = {},
): ReturnType<typeof upsertContact> {
  await ensureContactProperties(client, options)
  try {
    return await upsertContact(client, subscriber, args)
  } catch (error) {
    if (!(error instanceof ResendApiError) || !/propert/i.test(error.message)) {
      throw error
    }
    ensured.delete(client)
    await ensureContactProperties(client, options)
    return upsertContact(client, subscriber, args)
  }
}

/**
 * Contact properties must exist in Resend before a contact can carry them. Creates the ones the
 * plugin uses (`full_name` plus every source's `properties`) once per process.
 */
export function ensureContactProperties(
  client: ResendClient,
  options: SanitizedOptions,
): Promise<void> {
  let promise = ensured.get(client)
  if (!promise) {
    promise = (async () => {
      const wanted: Record<string, { fallback?: number | string; type: 'number' | 'string' }> = {
        [FULL_NAME_PROPERTY]: { type: 'string' },
        ...options.properties,
      }
      const existing = await client.call('list contact properties', (r) =>
        r.contactProperties.list(),
      )
      const have = new Set(
        ((existing as { data?: Array<{ key: string }> })?.data ?? []).map((p) => p.key),
      )
      for (const [key, spec] of Object.entries(wanted)) {
        if (have.has(key)) {
          continue
        }
        await client.call(`create contact property "${key}"`, (r) =>
          r.contactProperties.create(
            spec.type === 'number'
              ? {
                  type: 'number',
                  fallbackValue: typeof spec.fallback === 'number' ? spec.fallback : null,
                  key,
                }
              : {
                  type: 'string',
                  fallbackValue: spec.fallback === undefined ? null : String(spec.fallback),
                  key,
                },
          ),
        )
      }
    })()
    promise.catch(() => ensured.delete(client))
    ensured.set(client, promise)
  }
  return promise
}

function withoutNulls<T extends Record<string, unknown>>(
  value: T,
): Record<string, number | string> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== null && v !== undefined),
  ) as Record<string, number | string>
}
