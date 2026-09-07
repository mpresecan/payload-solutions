/**
 * Tiny process-local cache for the assembled config (minus the per-request jurisdiction).
 * Hooks call `invalidateConfigCache()` after every relevant change. On serverless the cache is
 * per instance and short-lived; the TTL keeps stale instances honest.
 */
type Entry<T> = { value: T; expires: number; generation: number }

let generation = 0
const entries = new Map<string, Entry<unknown>>()

export function invalidateConfigCache() {
  generation += 1
  entries.clear()
}

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = entries.get(key) as Entry<T> | undefined
  const now = Date.now()
  if (hit && hit.generation === generation && hit.expires > now) return hit.value
  const value = await load()
  entries.set(key, { value, expires: now + ttlMs, generation })
  return value
}
