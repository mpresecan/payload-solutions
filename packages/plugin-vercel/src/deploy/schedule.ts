/**
 * Debounce arithmetic for automatic deployments. Pure functions so they can be tested without Payload.
 *
 * A target's window opens with the first change (`pendingSince`) and fires at `dueAt`. Every further
 * change pushes `dueAt` out by the quiet period, but never past `pendingSince + maxWait`.
 */
export type WindowState = { dueAt: Date | null; pendingSince: Date | null }

export function nextWindow(
  current: WindowState,
  now: Date,
  quietPeriodMs: number,
  maxWaitMs: number,
): WindowState {
  const pendingSince = current.pendingSince ?? now
  const quietDue = now.getTime() + quietPeriodMs
  const hardDue = pendingSince.getTime() + maxWaitMs
  return { dueAt: new Date(Math.min(quietDue, hardDue)), pendingSince }
}

export function isDue(state: { dueAt?: Date | null | string }, now: Date): boolean {
  if (!state.dueAt) {
    return false
  }
  const due = typeof state.dueAt === 'string' ? new Date(state.dueAt) : state.dueAt
  return due.getTime() <= now.getTime()
}

/** Dedupe key for the automatic trigger of a given window, shared by every tick that observes it. */
export function windowDedupeKey(target: string, dueAt: Date | string): string {
  const ms = typeof dueAt === 'string' ? new Date(dueAt).getTime() : dueAt.getTime()
  return `${target}:auto:${ms}`
}

/** Keep only timestamps from the last hour; append `now` when given. */
export function rollingHour(times: (Date | string)[] | null | undefined, now: Date, append = false): string[] {
  const cutoff = now.getTime() - 3_600_000
  const kept = (times ?? [])
    .map((t) => (typeof t === 'string' ? t : t.toISOString()))
    .filter((t) => new Date(t).getTime() > cutoff)
  if (append) {
    kept.push(now.toISOString())
  }
  return kept.slice(-120)
}

export const VERCEL_HOOKS_PER_HOUR = 60
