import type { Duration } from '../types.js'

const UNIT_MS: Record<string, number> = { d: 86_400_000, h: 3_600_000, m: 60_000, s: 1_000 }

/** `'30s' | '15m' | '2h' | '7d'` or seconds as a number → milliseconds. */
export function durationToMs(value: Duration, what = 'duration'): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid ${what}: ${value}`)
    }
    return Math.round(value * 1000)
  }
  const match = /^(\d+(?:\.\d+)?)\s*(s|m|h|d)$/i.exec(String(value).trim())
  if (!match) {
    throw new Error(`Invalid ${what} "${value}": use a number of seconds or "30s", "15m", "2h", "7d"`)
  }
  return Math.round(Number(match[1]) * UNIT_MS[match[2]!.toLowerCase()]!)
}

export function durationToSeconds(value: Duration, what?: string): number {
  return Math.round(durationToMs(value, what) / 1000)
}

/** Human sentence for a fixed interval in seconds: "Every 15 minutes". */
export function describeInterval(seconds: number): string {
  const units: [number, string][] = [
    [86_400, 'day'],
    [3_600, 'hour'],
    [60, 'minute'],
    [1, 'second'],
  ]
  for (const [size, name] of units) {
    if (seconds % size === 0) {
      const n = seconds / size
      return n === 1 ? `Every ${name}` : `Every ${n} ${name}s`
    }
  }
  return `Every ${seconds} seconds`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)} ms`
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)} s`
  }
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return seconds ? `${minutes} min ${seconds} s` : `${minutes} min`
}

export function toDate(value: Date | null | number | string | undefined, fallback = new Date()): Date {
  if (value === undefined || value === null || value === '') {
    return fallback
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${String(value)}`)
  }
  return date
}
