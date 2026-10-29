import { describe, expect, it, vi } from 'vitest'

import { casUpdate } from '../db/cas.js'
import { defineAction } from '../define.js'
import { createHarness } from './test-harness.js'

/**
 * MongoDB: the `uniqueKey` index is unique and sparse, and a sparse index still indexes an explicit
 * null. When finishing or canceling an action stored `uniqueKey: null`, the second such write hit a
 * duplicate key: the result was discarded, the row stayed `running`, and the sweeper marked it lost
 * and ran the handler again (an email sent on every retry). Scheduling a non-unique action stored
 * the same null and failed outright once one existed.
 */
describe('on MongoDB', () => {
  function fixtures() {
    const sent: string[] = []
    const remind = defineAction<{ bookingId: string }>({
      slug: 'booking.remind',
      handler: async ({ args }) => {
        sent.push(args.bookingId)
        return { note: `sent ${args.bookingId}` }
      },
      retries: 3,
    })
    const email = defineAction<{ to: string }>({
      slug: 'emails.send',
      handler: async () => ({ note: 'sent' }),
    })
    return { email, remind, sent }
  }

  it('records the result of a unique action that finishes after another was canceled, and runs it once', async () => {
    const f = fixtures()
    const h = createHarness([f.remind, f.email], {}, { adapter: 'mongoose' })

    // A reminder, canceled when the call was rescheduled (this writes the first "no unique key").
    await h.api.schedule(
      'booking.remind',
      { bookingId: 'b1' },
      { group: 'booking:b1', scheduleAt: new Date(Date.now() + 3_600_000), unique: true },
    )
    expect(await h.api.cancelAll('booking.remind', { group: 'booking:b1' })).toBe(1)

    // Its replacement, run now.
    const ref = await h.api.schedule('booking.remind', { bookingId: 'b1', moved: true } as never, {
      group: 'booking:b1',
      unique: true,
    })
    expect(await h.api.runNow(ref.id)).toBe(true)
    await h.runQueued(true)

    const row = h.actionsTable().find((d) => d.id === ref.id)!
    expect(row.status).toBe('complete')
    expect(row.note).toBe('sent b1')
    expect(f.sent).toEqual(['b1'])

    // Neither finished row keeps a uniqueKey field, so the next one cannot collide either.
    for (const done of h.actionsTable()) {
      expect('uniqueKey' in done).toBe(false)
    }
    const again = await h.api.schedule(
      'booking.remind',
      { bookingId: 'b2' },
      { group: 'booking:b2', unique: true },
    )
    await h.runQueued(true)
    expect(h.actionsTable().find((d) => d.id === again.id)!.status).toBe('complete')
  })

  it('schedules and finishes any number of non-unique actions', async () => {
    const f = fixtures()
    const h = createHarness([f.remind, f.email], {}, { adapter: 'mongoose' })
    const refs = []
    for (const to of ['a@x.dev', 'b@x.dev', 'c@x.dev']) {
      refs.push(await h.api.schedule('emails.send', { to }, { unique: false }))
    }
    await h.runQueued(true)
    expect(refs.map((r) => h.actionsTable().find((d) => d.id === r.id)!.status)).toEqual([
      'complete',
      'complete',
      'complete',
    ])
  })

  it('still finds a pending unique action by its key, so a duplicate schedule is not created', async () => {
    const f = fixtures()
    const h = createHarness([f.remind, f.email], {}, { adapter: 'mongoose' })
    const at = new Date(Date.now() + 3_600_000)
    const first = await h.api.schedule(
      'booking.remind',
      { bookingId: 'b1' },
      { group: 'booking:b1', scheduleAt: at, unique: true },
    )
    const second = await h.api.schedule(
      'booking.remind',
      { bookingId: 'b1' },
      { group: 'booking:b1', scheduleAt: at, unique: true },
    )
    expect(second).toMatchObject({ created: false, id: first.id })
  })
})

describe('Mongo compare-and-set', () => {
  it('removes null fields with $unset instead of storing null', async () => {
    const findOneAndUpdate = vi.fn(async () => ({ _id: 'a1' }))
    const payload = {
      db: { name: 'mongoose', collections: { 'scheduled-actions': { findOneAndUpdate } } },
    } as never
    await casUpdate(payload, {
      set: { claimToken: null, note: 'sent', status: 'complete', uniqueKey: null },
      target: { collection: 'scheduled-actions', id: 'a1' },
      where: [{ field: 'status', op: '=', value: 'running' }],
    })
    const [filter, update] = findOneAndUpdate.mock.calls[0] as unknown as [
      Record<string, unknown>,
      Record<string, Record<string, unknown>>,
    ]
    expect(filter).toMatchObject({ _id: 'a1', $and: [{ status: { $eq: 'running' } }] })
    expect(update.$set).toMatchObject({ note: 'sent', status: 'complete' })
    expect(update.$set).not.toHaveProperty('uniqueKey')
    expect(update.$unset).toEqual({ claimToken: '', uniqueKey: '' })

    findOneAndUpdate.mockClear()
    await casUpdate(payload, {
      set: { status: 'running' },
      target: { collection: 'scheduled-actions', id: 'a1' },
      where: [],
    })
    expect(
      (findOneAndUpdate.mock.calls[0] as unknown as [unknown, Record<string, unknown>])[1],
    ).not.toHaveProperty('$unset')
  })
})
