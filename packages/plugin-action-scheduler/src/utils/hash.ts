import { createHash, randomBytes } from 'crypto'

import { ActionArgsInvalid } from '../errors.js'

/** Stable JSON: keys sorted, `undefined` dropped, dates as ISO strings, no whitespace. */
export function canonicalJSON(value: unknown): string {
  return JSON.stringify(sortValue(value))
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue)
  }
  if (value && typeof value === 'object') {
    if (value instanceof Date) {
      return value.toISOString()
    }
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key]
      if (v !== undefined) {
        out[key] = sortValue(v)
      }
    }
    return out
  }
  return value
}

export function hashArgs(args: unknown): string {
  return createHash('sha256').update(canonicalJSON(args ?? {})).digest('hex').slice(0, 32)
}

export function uniqueKeyFor(hook: string, group: string, argsHash: string): string {
  return createHash('sha256').update(`${hook} ${group} ${argsHash}`).digest('hex').slice(0, 32)
}

export function newToken(): string {
  return randomBytes(12).toString('hex')
}

/**
 * Serializes args for storage: a plain, JSON-serializable object. Documents (objects with an id and
 * timestamps) are rejected with a hint to pass the id. Returns the canonical JSON and its UTF-8 size.
 */
export function serializeArgs(
  hook: string,
  args: unknown,
): { bytes: number; json: string; value: Record<string, unknown> } {
  if (args === undefined || args === null) {
    return { bytes: 2, json: '{}', value: {} }
  }
  if (typeof args !== 'object' || Array.isArray(args)) {
    throw new ActionArgsInvalid(hook, 'args must be a plain object')
  }
  const seen = new WeakSet<object>()
  const check = (v: unknown, path: string): void => {
    if (v === null || v === undefined) {
      return
    }
    const t = typeof v
    if (t === 'function' || t === 'symbol' || t === 'bigint') {
      throw new ActionArgsInvalid(hook, `${path || 'args'} is a ${t}, which cannot be stored`)
    }
    if (t !== 'object') {
      return
    }
    if (seen.has(v as object)) {
      throw new ActionArgsInvalid(hook, `${path || 'args'} is circular`)
    }
    seen.add(v as object)
    if (v instanceof Date) {
      return
    }
    if (Array.isArray(v)) {
      v.forEach((item, i) => check(item, `${path}[${i}]`))
      return
    }
    const proto = Object.getPrototypeOf(v)
    if (proto !== Object.prototype && proto !== null) {
      throw new ActionArgsInvalid(
        hook,
        `${path || 'args'} is a ${(proto as { constructor?: { name?: string } })?.constructor?.name ?? 'class'} instance; pass plain data`,
      )
    }
    const o = v as Record<string, unknown>
    if (path && 'id' in o && ('createdAt' in o || 'updatedAt' in o)) {
      throw new ActionArgsInvalid(hook, `${path} looks like a document; pass its id instead`)
    }
    for (const [k, item] of Object.entries(o)) {
      check(item, path ? `${path}.${k}` : k)
    }
  }
  check(args, '')
  const json = canonicalJSON(args)
  return {
    bytes: Buffer.byteLength(json, 'utf8'),
    json,
    value: JSON.parse(json) as Record<string, unknown>,
  }
}

export function truncate(text: null | string | undefined, max: number): null | string {
  if (text === null || text === undefined) {
    return null
  }
  const s = String(text)
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}
