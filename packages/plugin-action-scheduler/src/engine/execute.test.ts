import { describe, expect, it } from 'vitest'

import { defineAction } from '../define.js'
import { PermanentError, SkipAction } from '../errors.js'
import { createHarness } from './test-harness.js'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function fixtures() {
  const calls: { attempt: number; hook: string }[] = []
  const ok = defineAction({
    slug: 'ok',
    handler: async ({ action, log }) => {
      calls.push({ attempt: action.attempt, hook: 'ok' })
      log('did the thing')
      return { note: 'done' }
    },
  })
  const flaky = defineAction({
    slug: 'flaky',
    handler: async ({ action, args }) => {
      calls.push({ attempt: action.attempt, hook: 'flaky' })
      if (action.attempt < Number(args.succeedOn ?? 99)) {
        throw new Error(`boom ${action.attempt}`)
      }
    },
    retries: 2,
  })
  const permanent = defineAction({ slug: 'permanent', handler: async () => { throw new PermanentError('410 Gone') } })
  const skip = defineAction({ slug: 'skip', handler: async () => { throw new SkipAction('already paid') } })
  const slow = defineAction({ slug: 'slow', handler: async () => { await wait(200) }, retries: 0, timeout: 0.05 })
  const big = defineAction({ slug: 'big', handler: async () => ({ note: 'x'.repeat(1000) }) })
  return { big, calls, flaky, ok, permanent, skip, slow }
}

describe('scheduling', () => {
  it('stores args once, hashes them, and queues a transport job carrying only the id', async () => {
    const f = fixtures()
    const h = createHarness([f.ok])
    const ref = await h.api.schedule('ok', { orderId: 'a1' }, { scheduleAt: new Date(Date.now() + 60_000) })
    expect(ref.created).toBe(true)
    const row = h.actionsTable()[0]!
    expect(row.args).toEqual({ orderId: 'a1' })
    expect(row.status).toBe('pending')
    expect(row.maxAttempts).toBe(4)
    expect(h.jobs.queued).toHaveLength(1)
    expect(h.jobs.queued[0]!.input).toEqual({ actionId: String(row.id) })
    expect(row.jobId).toBe(String(h.jobs.queued[0]!.id))
    expect(h.logsFor(row.id).map((l) => l.event)).toEqual(['scheduled'])
  })
  it('rejects unknown hooks and oversized arguments before writing', async () => {
    const f = fixtures()
    const h = createHarness([f.ok], { maxArgsBytes: 64 })
    await expect(h.api.schedule('nope' as never, {} as never)).rejects.toThrow(/not registered/)
    await expect(h.api.schedule('ok', { blob: 'x'.repeat(100) })).rejects.toThrow(/limit is 64/)
    expect(h.actionsTable()).toHaveLength(0)
  })
  it('does not queue a job for actions beyond the dispatch horizon; the tick promotes them', async () => {
    const f = fixtures()
    const h = createHarness([f.ok], { dispatchHorizon: '1m' })
    await h.api.schedule('ok', {}, { scheduleAt: new Date(Date.now() + 3_600_000) })
    expect(h.jobs.queued).toHaveLength(0)
    expect(await h.maintenance.promote()).toBe(0)
    h.actionsTable()[0]!.scheduleAt = new Date(Date.now() + 30_000).toISOString()
    expect(await h.maintenance.promote()).toBe(1)
    expect(h.jobs.queued).toHaveLength(1)
  })
  it('unique: returns the existing pending action instead of creating a second one', async () => {
    const f = fixtures()
    const h = createHarness([f.ok])
    const a = await h.api.schedule('ok', { b: 2, a: 1 }, { unique: true })
    const b = await h.api.schedule('ok', { a: 1, b: 2 }, { unique: true })
    expect(b.created).toBe(false)
    expect(b.id).toBe(a.id)
    expect(await h.api.has('ok', { args: { a: 1, b: 2 } })).toBe(true)
    expect(await h.api.has('ok', { args: { a: 2 } })).toBe(false)
    expect(await h.api.next('ok')).toBeInstanceOf(Date)
  })
  it('cancel removes the transport job and clears the unique key', async () => {
    const f = fixtures()
    const h = createHarness([f.ok])
    const ref = await h.api.schedule('ok', { a: 1 }, { unique: true, scheduleAt: new Date(Date.now() + 60_000) })
    expect(await h.api.cancel('ok', { args: { a: 1 } })).toBe(1)
    const row = h.actionsTable()[0]!
    expect(row.status).toBe('canceled')
    expect(row.uniqueKey).toBeNull()
    expect(h.jobs.deleted).toHaveLength(1)
    expect(await h.api.next('ok')).toBeNull()
    const again = await h.api.schedule('ok', { a: 1 }, { unique: true })
    expect(again.created).toBe(true)
    expect(again.id).not.toBe(ref.id)
  })
})

describe('execution', () => {
  it('runs a due action once, records the outcome without output, and the transport job is gone', async () => {
    const f = fixtures()
    const h = createHarness([f.ok])
    await h.api.enqueue('ok', { orderId: 'a1' })
    await h.runQueued()
    const row = h.actionsTable()[0]!
    expect(f.calls).toEqual([{ attempt: 1, hook: 'ok' }])
    expect(row.status).toBe('complete')
    expect(row.attempts).toBe(1)
    expect(row.lastOutcome).toBe('completed')
    expect(row.note).toBe('done')
    expect(row.claimToken).toBeNull()
    expect(typeof row.lastDurationMs).toBe('number')
    expect(h.table('payload-jobs')).toHaveLength(0)
    expect(h.logsFor(row.id).map((l) => l.event)).toEqual(['completed', 'note', 'started', 'scheduled'])
    expect(Object.keys(row)).not.toContain('output')
  })
  it('retries with backoff, keeps only the latest error, then completes', async () => {
    const f = fixtures()
    const h = createHarness([f.flaky])
    await h.api.enqueue('flaky', { succeedOn: 3 })
    await h.runQueued()
    let row = h.actionsTable()[0]!
    expect(row.status).toBe('pending')
    expect(row.attempts).toBe(1)
    expect(row.errorMessage).toBe('boom 1')
    expect(new Date(row.scheduleAt as string).getTime()).toBeGreaterThan(Date.now() + 500)
    expect(h.jobs.queued).toHaveLength(2)
    await h.runQueued(true)
    await h.runQueued(true)
    row = h.actionsTable()[0]!
    expect(row.status).toBe('complete')
    expect(row.attempts).toBe(3)
    expect(row.errorMessage).toBeNull()
    expect(f.calls.map((c) => c.attempt)).toEqual([1, 2, 3])
    const events = h.logsFor(row.id).map((l) => l.event)
    expect(events.filter((e) => e === 'failed')).toHaveLength(2)
    expect(events[0]).toBe('completed')
  })
  it('gives up after the last attempt with a failure reason', async () => {
    const f = fixtures()
    const h = createHarness([f.flaky])
    await h.api.enqueue('flaky', {})
    for (let i = 0; i < 3; i += 1) {
      await h.runQueued(true)
    }
    const row = h.actionsTable()[0]!
    expect(row.status).toBe('failed')
    expect(row.attempts).toBe(3)
    expect(row.failureReason).toBe('error')
    expect(h.table('payload-jobs')).toHaveLength(0)
    expect(h.logsFor(row.id)[0]!.message).toMatch(/no retries left/)
  })
  it('PermanentError fails immediately; SkipAction completes with a note', async () => {
    const f = fixtures()
    const h = createHarness([f.permanent, f.skip])
    await h.api.enqueue('permanent', {})
    await h.api.enqueue('skip', {})
    await h.runQueued()
    const [p, s] = h.actionsTable()
    expect(p!.status).toBe('failed')
    expect(p!.failureReason).toBe('permanent')
    expect(p!.attempts).toBe(1)
    expect(s!.status).toBe('complete')
    expect(s!.lastOutcome).toBe('skipped')
    expect(s!.note).toBe('already paid')
  })
  it('times out, records the reason, and discards the late result', async () => {
    const f = fixtures()
    const h = createHarness([f.slow])
    await h.api.enqueue('slow', {})
    await h.runQueued()
    const row = h.actionsTable()[0]!
    expect(row.status).toBe('failed')
    expect(row.failureReason).toBe('timeout')
    expect(row.lastOutcome).toBe('timeout')
    await wait(250)
    expect(h.actionsTable()[0]!.status).toBe('failed')
  })
  it('caps the note and never stores handler output', async () => {
    const f = fixtures()
    const h = createHarness([f.big])
    await h.api.enqueue('big', {})
    await h.runQueued()
    const row = h.actionsTable()[0]!
    expect((row.note as string).length).toBe(256)
  })
  it('claims exactly once even when the same job is run twice', async () => {
    const f = fixtures()
    const h = createHarness([f.ok])
    await h.api.enqueue('ok', {})
    const job = h.table('payload-jobs')[0]!
    await Promise.all([h.engine.execute(String(h.actionsTable()[0]!.id), h.req), h.engine.execute(String(h.actionsTable()[0]!.id), h.req)])
    expect(f.calls).toHaveLength(1)
    void job
  })
})

describe('recurring', () => {
  it('re-arms in place: one row, runCount grows, next occurrence dispatched', async () => {
    const f = fixtures()
    const h = createHarness([f.ok])
    await h.api.recurring('ok', {}, { every: '1h', startAt: new Date(Date.now() - 1000) })
    await h.runQueued()
    const row = h.actionsTable()[0]!
    expect(h.actionsTable()).toHaveLength(1)
    expect(row.status).toBe('pending')
    expect(row.runCount).toBe(1)
    expect(row.attempts).toBe(0)
    expect(new Date(row.scheduleAt as string).getTime()).toBeGreaterThan(Date.now() + 3_500_000)
    expect(row.uniqueKey).not.toBeNull()
    expect(h.logsFor(row.id).map((l) => l.event).slice(0, 2)).toEqual(['rearmed', 'completed'])
    // Within a 15 min horizon the hourly job is not queued yet.
    expect(h.table('payload-jobs')).toHaveLength(0)
  })
  it('stopAfterCurrent cancels after the running occurrence', async () => {
    const f = fixtures()
    const h = createHarness([f.ok])
    await h.api.recurring('ok', {}, { every: '1h', startAt: new Date(Date.now() - 1000) })
    const row = h.actionsTable()[0]!
    row.stopAfterCurrent = true
    await h.runQueued()
    expect(h.actionsTable()[0]!.status).toBe('canceled')
  })
  it('stops a series after N failed runs in a row', async () => {
    const f = fixtures()
    const fail = defineAction({ slug: 'fail', handler: async () => { throw new Error('x') }, retries: 0, stopAfterFailures: 2 })
    const h = createHarness([fail], { dispatchHorizon: '2h' })
    await h.api.recurring('fail', {}, { every: '1h', startAt: new Date(Date.now() - 1000) })
    await h.runQueued()
    let row = h.actionsTable()[0]!
    expect(row.status).toBe('pending')
    expect(row.consecutiveFailures).toBe(1)
    row.scheduleAt = new Date(Date.now() - 1000).toISOString()
    await h.runQueued(true)
    row = h.actionsTable()[0]!
    expect(row.status).toBe('failed')
    expect(row.consecutiveFailures).toBe(2)
    void f
  })
  it('reconciles code-declared series: create, keep, cancel', async () => {
    const f = fixtures()
    const h = createHarness([f.ok], { recurring: [{ key: 's1', hook: 'ok', every: '1h' }] })
    await h.maintenance.reconcileSeries()
    expect(h.actionsTable()).toHaveLength(1)
    expect(h.actionsTable()[0]!.seriesKey).toBe('s1')
    await h.maintenance.reconcileSeries()
    expect(h.actionsTable()).toHaveLength(1)
    h.options.recurring.length = 0
    await h.maintenance.reconcileSeries()
    expect(h.actionsTable()[0]!.status).toBe('canceled')
  })
})

describe('maintenance', () => {
  it('sweeper recovers a lost attempt and retries it', async () => {
    const f = fixtures()
    const h = createHarness([f.flaky])
    await h.api.enqueue('flaky', {})
    const row = h.actionsTable()[0]!
    Object.assign(row, { attempts: 1, claimToken: 'dead', claimedUntil: new Date(Date.now() - 1000).toISOString(), lastAttemptAt: new Date(Date.now() - 5000).toISOString(), status: 'running' })
    const result = await h.maintenance.sweep()
    expect(result.lost).toBe(1)
    expect(row.status).toBe('pending')
    expect(row.lastOutcome).toBe('lost')
    expect(h.logsFor(row.id)[0]!.event).toBe('lost')
  })
  it('purge removes finished rows past retention with their logs', async () => {
    const f = fixtures()
    const h = createHarness([f.ok], { retention: { complete: '1s' } })
    await h.api.enqueue('ok', {})
    await h.runQueued()
    const row = h.actionsTable()[0]!
    row.updatedAt = new Date(Date.now() - 5000).toISOString()
    expect(await h.maintenance.purge()).toBe(1)
    expect(h.actionsTable()).toHaveLength(0)
    expect(h.logsFor(row.id)).toHaveLength(0)
  })
  it('runQueue executes due actions in priority order and reports a summary', async () => {
    const f = fixtures()
    const h = createHarness([f.ok, f.permanent])
    await h.api.enqueue('ok', { n: 1 }, { priority: 20 })
    await h.api.enqueue('permanent', {}, { priority: 1 })
    await h.api.schedule('ok', { n: 2 }, { scheduleAt: new Date(Date.now() + 60_000) })
    const summary = await h.api.runQueue({ user: 'tests' })
    expect(summary.ran).toBe(2)
    expect(summary.completed).toBe(1)
    expect(summary.failed).toBe(1)
    expect(summary.lockedBy).toBeUndefined()
    expect(h.actionsTable().map((r) => r.status)).toEqual(['complete', 'failed', 'pending'])
    const status = await h.payload.findGlobal({ slug: 'scheduler-status' as never })
    expect((status as { lastRun: { trigger: string } }).lastRun.trigger).toBe('manual')
    expect((status as { runLockToken: unknown }).runLockToken).toBeNull()
  })
})
