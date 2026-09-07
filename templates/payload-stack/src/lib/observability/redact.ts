/**
 * Scrubbing happens here, in the facade, not in the adapters — so every provider inherits the same
 * guarantee and a new adapter cannot leak by omission. Under GDPR this is the difference between
 * error monitoring you can run on legitimate interest and a processor you have to ask consent for.
 */
import type { ErrorContext, ObservedUser } from './types'

/** Anything whose key matches is replaced with [redacted], at any depth. */
const SECRET_KEY = /(pass(word)?|secret|token|api[-_]?key|authorization|cookie|session|credit|card|cvc|iban|ssn|dsn)/i

/** Request headers that may travel. Everything else is dropped. */
const HEADER_ALLOW_LIST = new Set([
  'accept-language',
  'content-type',
  'referer',
  'user-agent',
  'x-request-id',
  'x-vercel-id',
])

const MAX_DEPTH = 4
const MAX_STRING = 2_000

export const REDACTED = '[redacted]'

function scrubValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (depth >= MAX_DEPTH) return '[truncated]'
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => scrubValue(item, depth + 1))
  if (value instanceof Error) return { name: value.name, message: value.message }
  if (typeof value === 'object') return scrubRecord(value as Record<string, unknown>, depth + 1)
  return String(value)
}

function scrubRecord(input: Record<string, unknown>, depth: number): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    out[key] = SECRET_KEY.test(key) ? REDACTED : scrubValue(value, depth)
  }
  return out
}

function scrubUser(user: ObservedUser | null | undefined, sendPII: boolean): ObservedUser | null | undefined {
  if (!user) return user
  if (sendPII) return user
  const { id, orgId, plan } = user
  return { id, ...(orgId ? { orgId } : {}), ...(plan ? { plan } : {}) }
}

/**
 * Returns a copy of the context safe to hand to any provider. `sendPII` comes from
 * `observability.sendPII` in stack.config.ts and defaults to false.
 */
export function redactContext(context: ErrorContext | undefined, sendPII: boolean): ErrorContext | undefined {
  if (!context) return context

  const headers = context.request?.headers
  const safeHeaders = headers
    ? Object.fromEntries(
        Object.entries(headers).filter(([key]) => HEADER_ALLOW_LIST.has(key.toLowerCase())),
      )
    : undefined

  return {
    ...context,
    user: scrubUser(context.user, sendPII),
    tags: context.tags ? (scrubRecord(context.tags, 0) as ErrorContext['tags']) : undefined,
    extra: context.extra ? scrubRecord(context.extra, 0) : undefined,
    request: context.request ? { ...context.request, headers: safeHeaders } : undefined,
  }
}
