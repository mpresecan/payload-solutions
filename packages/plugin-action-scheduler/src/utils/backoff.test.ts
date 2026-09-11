import { describe, expect, it } from 'vitest'

import { nextAttemptAt } from './backoff.js'

const now = new Date('2026-09-11T09:00:00.000Z')

describe('nextAttemptAt', () => {
  it('doubles from the base with ±20 % jitter and caps at max', () => {
    const noJitter = () => 0.5
    expect(nextAttemptAt({ type: 'exponential', base: '30s', max: '1h' }, 1, null, now, noJitter)!.getTime() - now.getTime()).toBe(30_000)
    expect(nextAttemptAt({ type: 'exponential', base: '30s', max: '1h' }, 2, null, now, noJitter)!.getTime() - now.getTime()).toBe(60_000)
    expect(nextAttemptAt({ type: 'exponential', base: '30s', max: '1h' }, 3, null, now, noJitter)!.getTime() - now.getTime()).toBe(120_000)
    expect(nextAttemptAt({ type: 'exponential', base: '30s', max: '1h' }, 20, null, now, noJitter)!.getTime() - now.getTime()).toBe(3_600_000)
  })
  it('keeps jitter inside the window', () => {
    const lo = nextAttemptAt({ type: 'exponential', base: '10s' }, 1, null, now, () => 0)!.getTime() - now.getTime()
    const hi = nextAttemptAt({ type: 'exponential', base: '10s' }, 1, null, now, () => 1)!.getTime() - now.getTime()
    expect(lo).toBe(8_000)
    expect(hi).toBe(12_000)
  })
  it('supports fixed delays and custom functions', () => {
    expect(nextAttemptAt({ type: 'fixed', delay: '5m' }, 3, null, now)!.getTime() - now.getTime()).toBe(300_000)
    expect(nextAttemptAt(() => null, 1, null, now)).toBeNull()
    const custom = new Date(now.getTime() + 42)
    expect(nextAttemptAt(() => custom, 1, null, now)).toBe(custom)
  })
})
