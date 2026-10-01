import type { CollectionConfig, Field } from 'payload'

import type { SanitizedOptions, SanitizedSource, Subscriber } from '../types.js'

/** Read a dotted path (`profile.email`) from a document. */
export function getByPath(doc: null | Record<string, unknown> | undefined, path: string): unknown {
  let value: unknown = doc
  for (const key of path.split('.')) {
    if (value === null || value === undefined || typeof value !== 'object') {
      return undefined
    }
    value = (value as Record<string, unknown>)[key]
  }
  return value
}

/** `{ a: { b: value } }` for `a.b`, for update payloads. */
export function setByPath(path: string, value: unknown): Record<string, unknown> {
  return path
    .split('.')
    .reverse()
    .reduce<unknown>((acc, key) => ({ [key]: acc }), value) as Record<string, unknown>
}

export const normalizeEmail = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : value == null ? '' : String(value)

/** Resend inserts contact values into HTML unescaped (`{{{…}}}`), so markup never leaves Payload. */
export const stripMarkup = (value: string): string => value.replace(/[<>]/g, '')

export function findSource(
  options: SanitizedOptions,
  collection: string,
): SanitizedSource | undefined {
  return options.sources.find((s) => s.collection === collection)
}

/** One subscriber document → the plugin's collection-independent view of it. */
export function toSubscriber(source: SanitizedSource, doc: Record<string, unknown>): Subscriber {
  const { fields } = source
  let firstName = fields.firstName ? text(getByPath(doc, fields.firstName)) : ''
  let lastName = fields.lastName ? text(getByPath(doc, fields.lastName)) : ''
  let name = fields.name ? text(getByPath(doc, fields.name)) : ''
  if (!fields.firstName && !fields.lastName && name) {
    const space = name.indexOf(' ')
    firstName = space === -1 ? name : name.slice(0, space)
    lastName = space === -1 ? '' : name.slice(space + 1).trim()
  }
  if (!name) {
    name = [firstName, lastName].filter(Boolean).join(' ')
  }

  const properties: Subscriber['properties'] = {}
  for (const [key, definition] of Object.entries(source.properties)) {
    let value: unknown
    try {
      value = definition.value({ doc })
    } catch {
      value = null
    }
    if (value === null || value === undefined || value === '') {
      properties[key] = null
    } else if (definition.type === 'number') {
      const num = typeof value === 'number' ? value : Number(value)
      properties[key] = Number.isFinite(num) ? num : null
    } else {
      properties[key] = stripMarkup(String(value))
    }
  }

  return {
    id: doc.id as number | string,
    name: stripMarkup(name),
    collection: source.collection,
    email: normalizeEmail(getByPath(doc, fields.email)),
    firstName: stripMarkup(firstName),
    lastName: stripMarkup(lastName),
    properties,
    subscribed: getByPath(doc, fields.subscribed) === true,
  }
}

const topLevelNames = (fields: Field[]): Set<string> => {
  const names = new Set<string>()
  const walk = (list: Field[]) => {
    for (const field of list) {
      if ('name' in field && field.name) {
        names.add(field.name)
      } else if (field.type === 'row' || field.type === 'collapsible') {
        walk(field.fields)
      } else if (field.type === 'tabs') {
        for (const tab of field.tabs) {
          if (!('name' in tab) || !tab.name) {
            walk(tab.fields)
          } else {
            names.add(tab.name)
          }
        }
      }
    }
  }
  walk(fields)
  return names
}

/**
 * Give a source collection the fields the plugin reads, when it does not define them. Only top-level
 * paths are added — a nested path (`profile.email`) must exist already. Auth collections get their
 * `email` from Payload itself, later in sanitization, so it is never added to them.
 */
export function addSourceFields(
  collection: CollectionConfig,
  source: SanitizedSource,
): CollectionConfig {
  if (!source.addFields) {
    return collection
  }
  const existing = topLevelNames(collection.fields)
  const leading: Field[] = []
  const trailing: Field[] = []
  const isTopLevel = (path?: string): path is string => Boolean(path && !path.includes('.'))

  if (isTopLevel(source.fields.email) && !existing.has(source.fields.email) && !collection.auth) {
    leading.push({ name: source.fields.email, type: 'email', index: true, required: true })
  }
  if (isTopLevel(source.fields.name) && !existing.has(source.fields.name)) {
    leading.push({ name: source.fields.name, type: 'text' })
  }
  if (isTopLevel(source.fields.subscribed) && !existing.has(source.fields.subscribed)) {
    trailing.push({
      name: source.fields.subscribed,
      type: 'checkbox',
      admin: {
        description:
          'Receives newsletters. Unsubscribing from an email turns this off automatically.',
        position: 'sidebar',
      },
      defaultValue: source.defaultSubscribed,
      index: true,
      label: 'Subscribed to newsletters',
    })
  }
  // Email and name lead the document, as they would in a hand-written subscribers collection.
  return leading.length || trailing.length
    ? { ...collection, fields: [...leading, ...collection.fields, ...trailing] }
    : collection
}
