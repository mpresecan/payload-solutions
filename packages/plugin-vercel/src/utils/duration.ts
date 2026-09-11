/**
 * Parse a duration given as milliseconds or as a short string: `'45s'`, `'2m'`, `'1h'`, `'1d'`, `'250ms'`.
 * Plain numeric strings are seconds, to match the way people write quiet periods.
 */
export function parseDuration(value: number | string | undefined, fallbackMs: number): number {
  if (value === undefined || value === null) {
    return fallbackMs
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`[plugin-vercel] Invalid duration ${value}`)
    }
    return value
  }
  const match = /^\s*(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?\s*$/i.exec(value)
  if (!match) {
    throw new Error(`[plugin-vercel] Invalid duration "${value}". Use a number of milliseconds or e.g. "60s", "2m", "1h".`)
  }
  const amount = Number(match[1])
  const unit = (match[2] ?? 's').toLowerCase()
  const factor = { d: 86_400_000, h: 3_600_000, m: 60_000, ms: 1, s: 1000 }[unit] ?? 1000
  return Math.round(amount * factor)
}

/** `90000` → `"1:30"`, `4000` → `"0:04"`, `3_720_000` → `"1:02:00"`. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mm = hours ? String(minutes).padStart(2, '0') : String(minutes)
  const ss = String(seconds).padStart(2, '0')
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}
