import { describe, expect, it } from 'vitest'

import { availableActions, isPastDue, lastResult, scheduleWords, shortError } from './shared.js'

describe('availableActions (spec §12.6)', () => {
  const keys = (row: Parameters<typeof availableActions>[0]) => availableActions(row).map((a) => a.key)
  it('offers the right verbs per status', () => {
    expect(keys({ id: 1, status: 'pending' })).toEqual(['run-now', 'reschedule', 'cancel', 'duplicate'])
    expect(keys({ id: 1, repeat: 'once', status: 'running' })).toEqual(['duplicate'])
    expect(keys({ id: 1, repeat: 'cron', status: 'running' })).toEqual(['stop-after-current', 'duplicate'])
    expect(keys({ id: 1, status: 'failed' })).toEqual(['retry', 'duplicate', 'delete'])
    expect(keys({ id: 1, status: 'complete' })).toEqual(['duplicate', 'delete'])
    expect(keys({ id: 1, status: 'canceled' })).toEqual(['duplicate', 'delete'])
  })
  it('renames Cancel to Pause series for code-declared series', () => {
    expect(availableActions({ id: 1, source: 'series', status: 'pending' }).find((a) => a.key === 'cancel')?.label).toBe('Pause series')
  })
})

describe('row helpers', () => {
  it('detects past due with a one-minute grace', () => {
    const now = Date.parse('2026-09-11T09:00:00Z')
    expect(isPastDue({ scheduleAt: '2026-09-11T08:58:00Z', status: 'pending' }, now)).toBe(true)
    expect(isPastDue({ scheduleAt: '2026-09-11T08:59:30Z', status: 'pending' }, now)).toBe(false)
    expect(isPastDue({ scheduleAt: '2026-09-11T08:00:00Z', status: 'complete' }, now)).toBe(false)
  })
  it('describes schedules and results', () => {
    expect(scheduleWords({ repeat: 'once' }).words).toBe('Once')
    expect(scheduleWords({ interval: 3600, repeat: 'interval' }).words).toBe('Every hour')
    expect(scheduleWords({ cron: '0 9 * * 1', repeat: 'cron', tz: 'UTC' }).raw).toBe('0 9 * * 1')
    expect(lastResult({ id: 1, lastDurationMs: 842, lastOutcome: 'completed', status: 'complete' })!.text).toBe('Completed · 842 ms')
    expect(lastResult({ id: 1, lastOutcome: 'skipped', note: 'already paid', status: 'complete' })!.text).toBe('Skipped · already paid')
    expect(lastResult({ id: 1, lastDurationMs: 120_000, lastOutcome: 'timeout', status: 'failed' })).toEqual({ error: true, text: 'Timed out after 2 min' })
    expect(lastResult({ id: 1, status: 'pending' })).toBeNull()
  })
  it('shortens errors to the code or the first clause', () => {
    expect(shortError('connect ECONNRESET 203.0.113.24:443')).toBe('ECONNRESET')
    expect(shortError('Endpoint returned 410 Gone; subscription removed')).toBe('410 Gone')
    expect(shortError('Card declined by processor (insufficient_funds)')).toBe('Card declined by processor')
  })
})
