import { describe, expect, it } from 'vitest'

import { defineAction } from './define.js'
import { sanitizeOptions } from './options.js'

const handler = async () => {}

describe('defineAction', () => {
  it('validates the slug and options', () => {
    expect(() => defineAction({ slug: 'Orders.Remind', handler })).toThrow(/slug/)
    expect(() => defineAction({ slug: 'orders..remind', handler })).toThrow(/slug/)
    expect(() => defineAction({ slug: 'orders.remind', handler: 'x' as never })).toThrow(/handler/)
    expect(() => defineAction({ slug: 'ok', handler, retries: -1 })).toThrow(/retries/)
    expect(() => defineAction({ slug: 'ok', handler, priority: 300 })).toThrow(/priority/)
    expect(() => defineAction({ slug: 'ok', handler, timeout: 'later' as never })).toThrow(/timeout/)
    expect(defineAction({ slug: 'orders.remind-v2_x', handler }).slug).toBe('orders.remind-v2_x')
  })
})

describe('sanitizeOptions', () => {
  it('applies defaults and validates recurring series', () => {
    const options = sanitizeOptions({ actions: [defineAction({ slug: 'a', handler })] })
    expect(options.defaultRetries).toBe(3)
    expect(options.defaultTimeoutMs).toBe(300_000)
    expect(options.dispatchHorizonMs).toBe(900_000)
    expect(options.retentionMs).toEqual({ canceled: 604_800_000, complete: 604_800_000, failed: 7_776_000_000 })
    expect(options.logs).toEqual({ perAction: 50, slug: 'scheduled-action-logs' })
    expect(options.tick).toEqual({ cron: '* * * * *', queue: 'default' })
    expect(() => sanitizeOptions({ actions: [defineAction({ slug: 'a', handler }), defineAction({ slug: 'a', handler })] })).toThrow(/twice/)
    expect(() => sanitizeOptions({ actions: [defineAction({ slug: 'a', handler })], recurring: [{ key: 'k', hook: 'b', every: '1h' }] })).toThrow(/unknown action/)
    expect(() => sanitizeOptions({ actions: [defineAction({ slug: 'a', handler })], recurring: [{ key: 'k', hook: 'a' }] })).toThrow(/every|cron/)
    expect(() => sanitizeOptions({ actions: [defineAction({ slug: 'a', handler })], recurring: [{ key: 'k', hook: 'a', cron: 'nope' }] })).toThrow(/cron/)
  })
  it('turns the horizon off with tick: false and disables logs', () => {
    const options = sanitizeOptions({ actions: [], logs: false, tick: false })
    expect(options.dispatchHorizonMs).toBe(Number.POSITIVE_INFINITY)
    expect(options.logs).toBe(false)
    expect(options.logsSlug).toBeNull()
  })
})
