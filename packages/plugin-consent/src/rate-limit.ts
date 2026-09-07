/**
 * Best-effort in-memory token bucket keyed by client IP. On serverless each instance has its own
 * bucket; pair with platform rate limiting for hard guarantees.
 */
type Bucket = { tokens: number; updated: number }

const buckets = new Map<string, Bucket>()
const MAX_KEYS = 10_000

export function clientIp(headers: { get(name: string): string | null }, trustProxy: boolean): string {
  if (trustProxy) {
    const xff = headers.get('x-forwarded-for')
    if (xff) return xff.split(',')[0]!.trim()
    const real = headers.get('x-real-ip')
    if (real) return real.trim()
  }
  return 'unknown'
}

export function allowRequest(key: string, perMinute: number, now = Date.now()): boolean {
  if (perMinute <= 0) return true
  if (buckets.size > MAX_KEYS) buckets.clear()
  const bucket = buckets.get(key) ?? { tokens: perMinute, updated: now }
  const refill = ((now - bucket.updated) / 60_000) * perMinute
  bucket.tokens = Math.min(perMinute, bucket.tokens + refill)
  bucket.updated = now
  if (bucket.tokens < 1) {
    buckets.set(key, bucket)
    return false
  }
  bucket.tokens -= 1
  buckets.set(key, bucket)
  return true
}

export function resetRateLimits() {
  buckets.clear()
}
