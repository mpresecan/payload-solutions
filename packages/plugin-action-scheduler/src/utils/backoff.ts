import type { Backoff } from '../types.js'

import { durationToMs } from './duration.js'

/**
 * When the next attempt may start, given the attempt that just failed (1-based).
 * Exponential: min(max, base × 2^(attempt−1)) with ±20 % jitter. Returns null to stop retrying.
 */
export function nextAttemptAt(
  backoff: Backoff,
  attempt: number,
  error: unknown,
  now: Date = new Date(),
  random: () => number = Math.random,
): Date | null {
  if (typeof backoff === 'function') {
    return backoff(attempt, error)
  }
  if (backoff.type === 'fixed') {
    return new Date(now.getTime() + durationToMs(backoff.delay, 'backoff.delay'))
  }
  const base = durationToMs(backoff.base ?? '30s', 'backoff.base')
  const max = durationToMs(backoff.max ?? '1h', 'backoff.max')
  const raw = Math.min(max, base * 2 ** Math.max(0, attempt - 1))
  const jitter = 1 + (random() * 0.4 - 0.2)
  return new Date(now.getTime() + Math.round(raw * jitter))
}
