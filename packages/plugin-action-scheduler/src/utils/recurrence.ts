import { Cron } from 'croner'

import type { ScheduledAction } from '../types.js'

export function validateCron(expression: string, tz?: null | string): void {
  const fields = String(expression).trim().split(/\s+/)
  if (fields.length !== 5 && fields.length !== 6) {
    throw new Error(`Invalid cron expression "${expression}": expected 5 fields (minute hour day-of-month month day-of-week)`)
  }
  try {
    new Cron(expression, { timezone: tz || undefined })
  } catch (error) {
    throw new Error(`Invalid cron expression "${expression}": ${error instanceof Error ? error.message : String(error)}`)
  }
  if (tz) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz })
    } catch {
      throw new Error(`Unknown time zone "${tz}"`)
    }
  }
}

export function nextCronRun(expression: string, tz: null | string | undefined, after: Date = new Date()): Date {
  const next = new Cron(expression, { timezone: tz || undefined }).nextRun(after)
  if (!next) {
    throw new Error(`Cron expression "${expression}" has no future occurrence`)
  }
  return next
}

export function nextCronRuns(expression: string, tz: null | string | undefined, n: number, after: Date = new Date()): Date[] {
  return new Cron(expression, { timezone: tz || undefined }).nextRuns(n, after)
}

/**
 * The next occurrence of a recurring action once the current one has ended.
 * Missed occurrences are skipped, never replayed in a burst.
 */
export function nextOccurrence(
  action: Pick<ScheduledAction, 'cron' | 'interval' | 'repeat' | 'scheduleAt' | 'tz'>,
  now: Date = new Date(),
): Date | null {
  if (action.repeat === 'interval') {
    const intervalMs = Math.max(1, Number(action.interval ?? 0)) * 1000
    const previous = new Date(action.scheduleAt).getTime()
    const fromPrevious = previous + intervalMs
    return new Date(Math.max(fromPrevious, now.getTime() + 1))
  }
  if (action.repeat === 'cron' && action.cron) {
    return nextCronRun(action.cron, action.tz, now)
  }
  return null
}
