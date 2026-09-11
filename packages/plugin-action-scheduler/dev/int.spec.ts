import type { Payload } from 'payload'

import config from '@payload-config'
import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'
import { fileURLToPath } from 'url'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'

import { executions } from './actions.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

let payload: Payload

const ACTIONS = 'scheduled-actions' as const
const LOGS = 'scheduled-action-logs' as const

async function row(id: number | string) {
  return payload.findByID({ collection: ACTIONS, id, depth: 0, overrideAccess: true })
}
async function jobs() {
  return payload.db.find({ collection: 'payload-jobs', pagination: false, where: { taskSlug: { equals: 'scheduler:run' } } })
}
async function runAll() {
  await payload.jobs.run({ allQueues: true, limit: 100, overrideAccess: true, silent: true })
}
async function clear() {
  // Keep the code-declared series (reconciled once at init); everything else is per-test state.
  const rows = await payload.db.find({ collection: ACTIONS, pagination: false, select: { id: true }, where: { seriesKey: { exists: false } } })
  const ids = rows.docs.map((d) => d.id)
  if (ids.length) {
    await payload.db.deleteMany({ collection: LOGS, where: { action: { in: ids } } })
    await payload.db.deleteMany({ collection: ACTIONS, where: { id: { in: ids } } })
  }
  await payload.db.deleteMany({ collection: 'payload-jobs', where: {} })
  executions.length = 0
}

beforeAll(async () => {
  for (const f of ['test.db', 'test.db-journal']) {
    fs.rmSync(path.resolve(dirname, f), { force: true })
  }
  payload = await getPayload({ config })
})

afterAll(async () => {
  await payload.destroy()
})

beforeEach(clear)

describe('schedule and run', () => {
  test('a due action runs once through the job queue and its transport job is deleted', async () => {
    const ref = await payload.scheduler.enqueue('orders.remind', { orderId: 'ord_1' })
    expect(ref.created).toBe(true)
    expect((await jobs()).docs).toHaveLength(1)
    expect((await jobs()).docs[0]).toMatchObject({ input: { actionId: String(ref.id) } })

    await runAll()

    const doc = await row(ref.id)
    expect(doc.status).toBe('complete')
    expect(doc.attempts).toBe(1)
    expect(doc.lastOutcome).toBe('completed')
    expect(doc.note).toBe('reminded ord_1')
    expect(doc.claimToken).toBeNull()
    expect(executions).toHaveLength(1)
    // The size rule: Payload deleted the successful transport job, and nothing stored the handler's output.
    expect((await jobs()).docs).toHaveLength(0)
    const logs = await payload.find({ collection: LOGS, overrideAccess: true, sort: '-createdAt', where: { action: { equals: ref.id } } })
    expect(logs.docs.map((l) => l.event)).toEqual(expect.arrayContaining(['scheduled', 'started', 'note', 'completed']))
    expect(logs.docs.every((l) => l.message.length <= 500)).toBe(true)
  })

  test('future actions wait; scheduleAt is mirrored to the job', async () => {
    const at = new Date(Date.now() + 60_000)
    const ref = await payload.scheduler.schedule('orders.remind', { orderId: 'later' }, { scheduleAt: at })
    await runAll()
    expect((await row(ref.id)).status).toBe('pending')
    const job = (await jobs()).docs[0] as { waitUntil?: string }
    expect(new Date(job.waitUntil!).getTime()).toBe(at.getTime())
  })

  test('retries with backoff, then completes; only the latest error is kept', async () => {
    const ref = await payload.scheduler.enqueue('webhooks.deliver', { endpointId: 'wh_1', succeedOn: 3 })
    await runAll()
    let doc = await row(ref.id)
    expect(doc.status).toBe('pending')
    expect(doc.attempts).toBe(1)
    expect(doc.errorMessage).toContain('ECONNRESET (attempt 1)')
    await new Promise((r) => setTimeout(r, 1100))
    await runAll()
    await new Promise((r) => setTimeout(r, 1100))
    await runAll()
    doc = await row(ref.id)
    expect(doc.status).toBe('complete')
    expect(doc.attempts).toBe(3)
    expect(doc.errorMessage).toBeNull()
    expect(executions.map((e) => e.attempt)).toEqual([1, 2, 3])
    expect((await jobs()).docs).toHaveLength(0)
  })

  test('PermanentError does not retry; timeouts are recorded as a failure reason', async () => {
    const perm = await payload.scheduler.enqueue('webhooks.deliver', { endpointId: 'wh_2', permanent: true })
    const slow = await payload.scheduler.enqueue('media.optimize', { ms: 2000 })
    await runAll()
    expect(await row(perm.id)).toMatchObject({ failureReason: 'permanent', status: 'failed' })
    // retries: 1 → the first timeout schedules one retry
    expect(await row(slow.id)).toMatchObject({ lastOutcome: 'timeout', status: 'pending' })
  })

  test('unique: 20 concurrent schedule calls create one row', async () => {
    const refs = await Promise.all(Array.from({ length: 20 }, () => payload.scheduler.schedule('orders.remind', { orderId: 'same' }, { unique: true })))
    expect(refs.filter((r) => r.created)).toHaveLength(1)
    expect(new Set(refs.map((r) => String(r.id))).size).toBe(1)
    const { totalDocs } = await payload.count({ collection: ACTIONS, overrideAccess: true, where: { hook: { equals: 'orders.remind' } } })
    expect(totalDocs).toBe(1)
  })

  test('exactly once: running the same transport job twice in parallel invokes the handler once', async () => {
    const ref = await payload.scheduler.enqueue('orders.remind', { orderId: 'once' })
    const job = (await jobs()).docs[0] as { id: number | string }
    // Payload's own runner may claim the same job twice (3.x has no lease); the second run must not
    // reach the handler. Whether Payload's bookkeeping for the losing run throws is Payload's business.
    await Promise.allSettled([
      payload.jobs.runByID({ id: job.id, overrideAccess: true, silent: true }),
      payload.jobs.runByID({ id: job.id, overrideAccess: true, silent: true }),
    ])
    expect(executions.filter((e) => e.args.orderId === 'once')).toHaveLength(1)
    expect((await row(ref.id)).status).toBe('complete')
  })

  test('cancel, next and has', async () => {
    await payload.scheduler.schedule('orders.remind', { orderId: 'c' }, { scheduleAt: new Date(Date.now() + 3600_000) })
    expect(await payload.scheduler.has('orders.remind', { args: { orderId: 'c' } })).toBe(true)
    expect(await payload.scheduler.next('orders.remind')).toBeInstanceOf(Date)
    expect(await payload.scheduler.cancel('orders.remind', { args: { orderId: 'c' } })).toBe(1)
    expect(await payload.scheduler.has('orders.remind', { args: { orderId: 'c' } })).toBe(false)
    expect((await jobs()).docs).toHaveLength(0)
  })
})

describe('recurring', () => {
  test('re-arms one row and re-dispatches; the code series exists after init', async () => {
    const series = await payload.find({ collection: ACTIONS, overrideAccess: true, where: { seriesKey: { equals: 'analytics.hourly' } } })
    expect(series.totalDocs).toBe(1)
    expect(series.docs[0]).toMatchObject({ cron: '0 * * * *', repeat: 'cron', source: 'series', tz: 'Europe/Warsaw' })

    const ref = await payload.scheduler.recurring('orders.remind', { orderId: 'r' }, { every: '1s', startAt: new Date(Date.now() - 10) })
    await runAll()
    let doc = await row(ref.id)
    expect(doc.status).toBe('pending')
    expect(doc.runCount).toBe(1)
    expect(doc.attempts).toBe(0)
    expect((await jobs()).docs).toHaveLength(1)
    await new Promise((r) => setTimeout(r, 1100))
    await runAll()
    doc = await row(ref.id)
    expect(doc.runCount).toBe(2)
    const { totalDocs } = await payload.count({ collection: ACTIONS, overrideAccess: true, where: { hook: { equals: 'orders.remind' } } })
    expect(totalDocs).toBe(1)
  })
})

describe('admin writes', () => {
  test('creating through the Local API validates, hashes and dispatches like the API', async () => {
    const created = await payload.create({ collection: ACTIONS, data: { hook: 'orders.remind', args: { orderId: 'ui' } }, overrideAccess: true })
    expect(created.argsHash).toMatch(/^[0-9a-f]{32}$/)
    expect(created.maxAttempts).toBe(4)
    expect((await jobs()).docs).toHaveLength(1)
    await expect(payload.create({ collection: ACTIONS, data: { hook: 'nope', args: {} }, overrideAccess: true })).rejects.toThrow()
  })

  test('finished actions are read-only', async () => {
    const ref = await payload.scheduler.enqueue('orders.remind', { orderId: 'ro' })
    await runAll()
    await expect(payload.update({ collection: ACTIONS, id: ref.id, data: { priority: 1 }, overrideAccess: true })).rejects.toThrow(/read-only/)
  })
})

describe('runQueue and maintenance', () => {
  test('runQueue executes due actions and records the run on the status global', async () => {
    await payload.scheduler.enqueue('orders.remind', { orderId: 'q1' })
    await payload.scheduler.enqueue('webhooks.deliver', { endpointId: 'q2', permanent: true })
    const summary = await payload.scheduler.runQueue({ user: 'tests' })
    expect(summary).toMatchObject({ completed: 1, failed: 1, ran: 2, trigger: 'manual' })
    const status = await payload.findGlobal({ slug: 'scheduler-status', overrideAccess: true })
    expect(status.lastRun).toMatchObject({ ran: 2 })
    expect(status.runLockToken).toBeNull()
  })

  test('size budget: a large-args action that fails repeatedly stays small and keeps at most 50 log lines', async () => {
    const args = { endpointId: 'x'.repeat(7_000), succeedOn: 99 }
    const ref = await payload.scheduler.enqueue('webhooks.deliver', args)
    for (let i = 0; i < 4; i += 1) {
      await runAll()
      await new Promise((r) => setTimeout(r, 1100))
    }
    const doc = await row(ref.id)
    expect(doc.status).toBe('failed')
    const size = Buffer.byteLength(JSON.stringify(doc))
    expect(size).toBeLessThan(8192 + 4096)
    const { totalDocs } = await payload.count({ collection: LOGS, overrideAccess: true, where: { action: { equals: ref.id } } })
    expect(totalDocs).toBeLessThanOrEqual(50)
  })
})
