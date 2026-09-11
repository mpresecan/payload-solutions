import { describe, expect, it } from 'vitest'

import { describeInterval, durationToMs, durationToSeconds, formatDuration, toDate } from './duration.js'

describe('durationToMs', () => {
  it('parses units and numbers of seconds', () => {
    expect(durationToMs('30s')).toBe(30_000)
    expect(durationToMs('15m')).toBe(900_000)
    expect(durationToMs('2h')).toBe(7_200_000)
    expect(durationToMs('7d')).toBe(604_800_000)
    expect(durationToMs(0.3)).toBe(300)
    expect(durationToSeconds('1h')).toBe(3600)
  })
  it('rejects garbage', () => {
    expect(() => durationToMs('soon' as never)).toThrow(/Invalid duration/)
    expect(() => durationToMs(-1)).toThrow()
  })
})

describe('describeInterval', () => {
  it('uses the largest unit that divides evenly', () => {
    expect(describeInterval(60)).toBe('Every minute')
    expect(describeInterval(900)).toBe('Every 15 minutes')
    expect(describeInterval(3600)).toBe('Every hour')
    expect(describeInterval(7200)).toBe('Every 2 hours')
    expect(describeInterval(86400)).toBe('Every day')
    expect(describeInterval(90)).toBe('Every 90 seconds')
  })
})

describe('formatDuration', () => {
  it('scales units', () => {
    expect(formatDuration(842)).toBe('842 ms')
    expect(formatDuration(1410)).toBe('1.4 s')
    expect(formatDuration(120_000)).toBe('2 min')
    expect(formatDuration(125_000)).toBe('2 min 5 s')
  })
})

describe('toDate', () => {
  it('accepts Date, number, string and falls back', () => {
    expect(toDate('2026-09-11T09:00:00Z').toISOString()).toBe('2026-09-11T09:00:00.000Z')
    expect(toDate(0).getTime()).toBe(0)
    const fb = new Date(5)
    expect(toDate(undefined, fb)).toBe(fb)
    expect(() => toDate('nope')).toThrow(/Invalid date/)
  })
})
