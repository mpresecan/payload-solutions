import type { Payload, TaskConfig } from 'payload'

import type { Engine } from '../engine/execute.js'
import type { Store } from '../engine/store.js'
import type { RecurringSeries, RunSummary, SanitizedActionSchedulerOptions, ScheduledAction } from '../types.js'

import type { InternalAPI } from '../api/index.js'
import { dispatch } from '../engine/dispatch.js'
import { CLAIM_GRACE_MS } from '../engine/execute.js'
import { RUN_TASK_SLUG, TICK_TASK_SLUG } from '../types.js'
import { durationToMs } from '../utils/duration.js'
import { hashArgs } from '../utils/hash.js'
import { nextCronRun } from '../utils/recurrence.js'

const BATCH = 500

export function createMaintenance(
  payload: Payload,
  options: SanitizedActionSchedulerOptions,
  store: Store,
  engine: Engine,
  api: () => InternalAPI,
) {
  const slug = options.collectionSlug as never
  const statusSlug = options.statusSlug

  /** Payload 4 leases transport jobs itself; on 3.x the plugin has to unstick them. */
  function jobsHaveLeases(): boolean {
    const fields = payload.collections['payload-jobs']?.config.fields ?? []
    return fields.some((f) => 'name' in f && f.name === 'processingUntil')
  }

  function longestTimeoutMs(): number {
    let max = options.defaultTimeoutMs
    for (const definition of options.definitions.values()) {
      if (definition.timeout !== undefined) {
        max = Math.max(max, durationToMs(definition.timeout))
      }
    }
    return max
  }

  /** Dispatches pending actions due within the horizon that have no transport job yet. */
  async function promote(): Promise<number> {
    if (!Number.isFinite(options.dispatchHorizonMs)) {
      return 0
    }
    const until = new Date(Date.now() + options.dispatchHorizonMs).toISOString()
    const found = await payload.db.find({
      collection: slug,
      limit: BATCH,
      pagination: false,
      sort: ['priority', 'scheduleAt'],
      where: { and: [{ status: { equals: 'pending' } }, { scheduleAt: { less_than_equal: until } }, { jobId: { exists: false } }] },
    })
    let count = 0
    for (const action of found.docs as ScheduledAction[]) {
      if (await dispatch(payload, options, store, action)) {
        count += 1
      }
    }
    return count
  }

  async function sweep(): Promise<{ lost: number; orphans: number; stuckJobs: number }> {
    const now = new Date()
    const result = { lost: 0, orphans: 0, stuckJobs: 0 }

    // 1. Lost attempts: running past the lease.
    const lost = await payload.db.find({
      collection: slug,
      limit: BATCH,
      pagination: false,
      where: { and: [{ status: { equals: 'running' } }, { claimedUntil: { less_than: now.toISOString() } }] },
    })
    for (const action of lost.docs as ScheduledAction[]) {
      if (!action.claimToken) {
        continue
      }
      await engine.record(
        action,
        options.definitions.get(action.hook),
        action.claimToken,
        { durationMs: Math.max(0, now.getTime() - new Date(action.lastAttemptAt ?? action.scheduleAt).getTime()), error: new Error('Worker stopped responding'), kind: 'failed', reason: 'lost' },
        [],
      )
      result.lost += 1
    }

    // 2. Orphans: pending, due, with a job that no longer exists or errored.
    const due = await payload.db.find({
      collection: slug,
      limit: BATCH,
      pagination: false,
      where: { and: [{ status: { equals: 'pending' } }, { scheduleAt: { less_than_equal: now.toISOString() } }, { jobId: { exists: true } }] },
    })
    for (const action of due.docs as ScheduledAction[]) {
      const job = await store.findJob(action.jobId)
      if (!job || job.hasError) {
        if (job?.hasError) {
          await store.deleteJob(action.jobId)
        }
        await dispatch(payload, options, store, action, { force: true })
        result.orphans += 1
      }
    }

    // 3. Stuck transport jobs (3.x): processing forever after a runner died. They would block native
    //    scheduling of the tick task for that queue.
    if (!jobsHaveLeases()) {
      const cutoff = new Date(now.getTime() - longestTimeoutMs() - CLAIM_GRACE_MS - 5 * 60_000).toISOString()
      const stuck = await payload.db.find({
        collection: 'payload-jobs' as never,
        limit: BATCH,
        pagination: false,
        select: { id: true },
        where: { and: [{ taskSlug: { in: [RUN_TASK_SLUG, TICK_TASK_SLUG] } }, { processing: { equals: true } }, { updatedAt: { less_than: cutoff } }] },
      })
      for (const job of stuck.docs as { id: number | string }[]) {
        await store.deleteJob(String(job.id))
        result.stuckJobs += 1
      }
    }
    await payload.db.updateGlobal({ slug: statusSlug, data: { lastSweepAt: now.toISOString() } })
    return result
  }

  async function purge(): Promise<number> {
    const now = Date.now()
    let removed = 0
    for (const [status, retention] of Object.entries(options.retentionMs) as ['canceled' | 'complete' | 'failed', false | number][]) {
      if (retention === false) {
        continue
      }
      const cutoff = new Date(now - retention).toISOString()
      for (let round = 0; round < 20; round += 1) {
        const stale = await payload.db.find({
          collection: slug,
          limit: 1000,
          pagination: false,
          select: { id: true },
          where: { and: [{ status: { equals: status } }, { updatedAt: { less_than: cutoff } }] },
        })
        const ids = stale.docs.map((d) => (d as { id: number | string }).id)
        if (!ids.length) {
          break
        }
        await store.deleteLogs(ids)
        await payload.db.deleteMany({ collection: slug, where: { id: { in: ids } } })
        removed += ids.length
      }
    }
    if (options.logs) {
      // Log lines whose action is gone (deleted from the admin, or by `retain: false`).
      const longest = Math.max(...Object.values(options.retentionMs).map((v) => (v === false ? 0 : v)), 7 * 86_400_000)
      await payload.db.deleteMany({
        collection: options.logs.slug as never,
        where: { and: [{ action: { exists: false } }, { createdAt: { less_than: new Date(now - longest).toISOString() } }] },
      })
    }
    await payload.db.updateGlobal({ slug: statusSlug, data: { lastPurgeAt: new Date(now).toISOString() } })
    return removed
  }

  /** Summarizes what external runners executed since the previous tick (§10.1). */
  async function summarizeExternalRuns(previousTickAt: null | string, now: Date): Promise<null | RunSummary> {
    if (!previousTickAt) {
      return null
    }
    const ran = await payload.db.find({
      collection: slug,
      limit: 200,
      pagination: false,
      select: { id: true, lastDurationMs: true, lastOutcome: true, status: true } as never,
      where: { and: [{ lastAttemptAt: { greater_than: previousTickAt } }, { lastAttemptAt: { less_than_equal: now.toISOString() } }] },
    })
    if (!ran.docs.length) {
      return null
    }
    const docs = ran.docs as unknown as Pick<ScheduledAction, 'lastDurationMs' | 'lastOutcome' | 'status'>[]
    const failed = docs.filter((d) => d.lastOutcome && d.lastOutcome !== 'completed' && d.lastOutcome !== 'skipped').length
    return {
      completed: docs.length - failed,
      durationMs: docs.reduce((sum, d) => sum + (d.lastDurationMs ?? 0), 0),
      failed,
      ran: docs.length,
      retried: docs.filter((d) => d.status === 'pending' && d.lastOutcome && d.lastOutcome !== 'completed').length,
      startedAt: previousTickAt,
      trigger: 'runner',
    }
  }

  async function tick(): Promise<void> {
    const now = new Date()
    const status = (await payload.findGlobal({ slug: statusSlug as never, depth: 0 })) as { lastPurgeAt?: null | string; lastRun?: null | RunSummary; lastTickAt?: null | string }
    const external = await summarizeExternalRuns(status.lastTickAt ?? null, now)
    const data: Record<string, unknown> = { lastTickAt: now.toISOString() }
    if (external && !(status.lastRun?.trigger === 'manual' && new Date(status.lastRun.startedAt) > new Date(status.lastTickAt ?? 0))) {
      data.lastRun = external
    }
    await payload.db.updateGlobal({ slug: statusSlug, data })
    await promote()
    await sweep()
    const lastPurge = status.lastPurgeAt ? new Date(status.lastPurgeAt).getTime() : 0
    if (now.getTime() - lastPurge > 3_600_000) {
      await purge()
    }
  }

  const tickTask: TaskConfig<any> | null = options.tick
    ? {
        slug: TICK_TASK_SLUG,
        handler: async () => {
          await tick()
          return { output: {} }
        },
        label: 'Scheduler maintenance',
        retries: 0,
        schedule: [{ cron: options.tick.cron, queue: options.tick.queue }],
      }
    : null

  /**
   * Declarative series from `options.recurring`: created if missing, updated if the schedule changed,
   * canceled if removed from the list. Runs at init.
   */
  async function reconcileSeries(): Promise<void> {
    const wanted = new Map<string, RecurringSeries>(options.recurring.map((s) => [s.key, s]))
    const existing = await payload.db.find({
      collection: slug,
      limit: 1000,
      pagination: false,
      where: { and: [{ seriesKey: { exists: true } }, { status: { in: ['pending', 'running'] } }] },
    })
    const seen = new Set<string>()
    for (const action of existing.docs as ScheduledAction[]) {
      const key = action.seriesKey!
      const series = wanted.get(key)
      const same =
        series &&
        series.hook === action.hook &&
        hashArgs(series.args ?? {}) === action.argsHash &&
        (series.cron ? action.repeat === 'cron' && action.cron === series.cron && (action.tz ?? null) === (series.tz ?? options.defaultTimezone) : action.repeat === 'interval' && action.interval === Math.round(durationToMs(series.every!) / 1000)) &&
        (series.group ?? options.definitions.get(series.hook)?.group ?? 'default') === action.group &&
        (series.priority ?? options.definitions.get(series.hook)?.priority ?? 10) === action.priority
      if (same) {
        seen.add(key)
        continue
      }
      if (action.status === 'pending') {
        await api()._internal.cancelOne(action, 'code')
      } else {
        await api().stopAfterCurrent(action.id)
      }
    }
    for (const [key, series] of wanted) {
      if (seen.has(key)) {
        continue
      }
      const tz = series.tz ?? options.defaultTimezone
      const interval = series.cron ? null : Math.round(durationToMs(series.every!) / 1000)
      await api()._internal.create(series.hook, series.args ?? {}, {
        cron: series.cron ?? null,
        group: series.group,
        interval,
        priority: series.priority,
        repeat: series.cron ? 'cron' : 'interval',
        scheduleAt: series.cron ? nextCronRun(series.cron, tz) : new Date(Date.now() + (interval ?? 60) * 1000),
        seriesKey: key,
        source: 'series',
        tz: series.cron ? tz : null,
        unique: true,
      })
    }
  }

  return { jobsHaveLeases, promote, purge, reconcileSeries, sweep, tick, tickTask }
}
