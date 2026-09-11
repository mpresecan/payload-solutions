import { describe, expect, it } from 'vitest'

import { nextCronRun, nextCronRuns, nextOccurrence, validateCron } from './recurrence.js'

describe('validateCron', () => {
  it('accepts five fields and rejects everything else', () => {
    expect(() => validateCron('0 9 * * 1', 'Europe/Warsaw')).not.toThrow()
    expect(() => validateCron('every monday')).toThrow(/expected 5 fields/)
    expect(() => validateCron('0 25 * * *')).toThrow(/Invalid cron/)
    expect(() => validateCron('0 9 * * 1', 'Mars/Olympus')).toThrow(/time zone/)
  })
})

describe('nextCronRun', () => {
  it('evaluates in the given zone', () => {
    // 09:00 Warsaw in September is 07:00 UTC (CEST).
    const next = nextCronRun('0 9 * * 1', 'Europe/Warsaw', new Date('2026-09-11T09:00:00Z'))
    expect(next.toISOString()).toBe('2026-09-14T07:00:00.000Z')
  })
  it('crosses the DST change in Warsaw without drifting the wall-clock time', () => {
    // Clocks go back on 2026-10-25 in the EU. 03:00 local stays 03:00 local: 01:00 UTC before, 02:00 UTC after.
    const runs = nextCronRuns('0 3 * * *', 'Europe/Warsaw', 3, new Date('2026-10-23T12:00:00Z'))
    expect(runs.map((d) => d.toISOString())).toEqual(['2026-10-24T01:00:00.000Z', '2026-10-25T02:00:00.000Z', '2026-10-26T02:00:00.000Z'])
  })
})

describe('nextOccurrence', () => {
  it('re-arms an interval from the previous scheduleAt, skipping missed occurrences', () => {
    const next = nextOccurrence({ cron: null, interval: 3600, repeat: 'interval', scheduleAt: '2026-09-11T08:00:00.000Z', tz: null }, new Date('2026-09-11T08:00:05.000Z'))
    expect(next!.toISOString()).toBe('2026-09-11T09:00:00.000Z')
    const late = nextOccurrence({ cron: null, interval: 3600, repeat: 'interval', scheduleAt: '2026-09-11T01:00:00.000Z', tz: null }, new Date('2026-09-11T08:00:05.000Z'))
    expect(late!.getTime()).toBe(new Date('2026-09-11T08:00:05.001Z').getTime())
  })
  it('uses the cron expression and returns null for once', () => {
    const next = nextOccurrence({ cron: '*/15 * * * *', interval: null, repeat: 'cron', scheduleAt: '2026-09-11T08:00:00.000Z', tz: 'UTC' }, new Date('2026-09-11T08:07:00Z'))
    expect(next!.toISOString()).toBe('2026-09-11T08:15:00.000Z')
    expect(nextOccurrence({ cron: null, interval: null, repeat: 'once', scheduleAt: '2026-09-11T08:00:00.000Z', tz: null })).toBeNull()
  })
})
