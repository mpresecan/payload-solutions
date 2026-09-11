import type { Payload, PayloadRequest, Where } from 'payload'

import type {
  ActionArgs,
  ActionSlug,
  CronOptions,
  FindActionsArgs,
  Match,
  RecurringOptions,
  RunQueueArgs,
  RunQueueResult,
  RunSummary,
  SanitizedActionSchedulerOptions,
  ScheduledAction,
  ScheduledActionRef,
  ScheduleOptions,
  SchedulerAPI,
} from '../types.js'

import { casUpdate } from '../db/cas.js'
import { dispatch } from '../engine/dispatch.js'
import type { Store } from '../engine/store.js'
import { ActionArgsTooLarge, ActionNotDefined, SchedulerDisabled } from '../errors.js'
import { durationToSeconds, toDate } from '../utils/duration.js'
import { hashArgs, newToken, serializeArgs, uniqueKeyFor } from '../utils/hash.js'
import { nextCronRun, validateCron } from '../utils/recurrence.js'

type CreateInput = {
  cron?: null | string
  group?: string
  interval?: null | number
  priority?: number
  queue?: string
  repeat: 'cron' | 'interval' | 'once'
  req?: PayloadRequest
  scheduleAt: Date
  seriesKey?: null | string
  source?: 'admin' | 'code' | 'series'
  tz?: null | string
  unique?: boolean
  user?: null | string
}

const isDuplicateKeyError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  return /unique|duplicate|E11000/i.test(message)
}

export type Maintenance = {
  promote: () => Promise<number>
  sweep: () => Promise<{ lost: number; orphans: number; stuckJobs: number }>
}

export function createSchedulerAPI(
  payload: Payload,
  options: SanitizedActionSchedulerOptions,
  store: Store,
  maintenance: () => Maintenance,
): SchedulerAPI {
  const slug = options.collectionSlug as never
  const target = (id: number | string) => ({ collection: options.collectionSlug, id: store.parseId(id) })
  const guard = () => {
    if (options.disabled) {
      throw new SchedulerDisabled()
    }
  }

  async function create(hook: string, rawArgs: unknown, input: CreateInput): Promise<ScheduledActionRef> {
    guard()
    const definition = options.definitions.get(hook)
    if (!definition) {
      throw new ActionNotDefined(hook)
    }
    const { bytes, value: args } = serializeArgs(hook, rawArgs)
    if (bytes > options.maxArgsBytes) {
      throw new ActionArgsTooLarge(hook, bytes, options.maxArgsBytes)
    }
    const group = input.group ?? definition.group ?? 'default'
    const unique = input.unique ?? definition.unique ?? input.repeat !== 'once'
    const argsHash = hashArgs(args)
    const uniqueKey = unique ? uniqueKeyFor(hook, group, argsHash) : null
    const priority = input.priority ?? definition.priority ?? 10
    const queue = input.queue ?? definition.queue ?? 'default'
    const req = input.req

    if (uniqueKey) {
      const existing = await findByUniqueKey(uniqueKey, req)
      if (existing) {
        return { created: false, id: existing.id, scheduleAt: new Date(existing.scheduleAt) }
      }
    }
    const now = new Date()
    const data = {
      args,
      argsHash,
      attempts: 0,
      claimedUntil: null,
      claimToken: null,
      completedAt: null,
      consecutiveFailures: 0,
      createdBy: input.user ?? null,
      cron: input.cron ?? null,
      errorMessage: null,
      errorStack: null,
      failureReason: null,
      group,
      hook,
      interval: input.interval ?? null,
      jobId: null,
      lastAttemptAt: null,
      lastDurationMs: null,
      lastOutcome: null,
      maxAttempts: (definition.retries ?? options.defaultRetries) + 1,
      note: null,
      priority,
      queue,
      repeat: input.repeat,
      runCount: 0,
      scheduleAt: input.scheduleAt.toISOString(),
      seriesKey: input.seriesKey ?? null,
      source: input.source ?? 'code',
      status: 'pending',
      stopAfterCurrent: false,
      tz: input.tz ?? null,
      unique,
      uniqueKey,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }
    let doc: ScheduledAction
    try {
      doc = (await payload.db.create({ collection: slug, data, req })) as ScheduledAction
    } catch (error) {
      if (uniqueKey && isDuplicateKeyError(error)) {
        const existing = await findByUniqueKey(uniqueKey, req)
        if (existing) {
          return { created: false, id: existing.id, scheduleAt: new Date(existing.scheduleAt) }
        }
      }
      throw error
    }
    await store.log(
      doc.id,
      [
        {
          event: 'scheduled',
          message:
            input.repeat === 'once'
              ? input.scheduleAt.getTime() <= now.getTime() + 1000
                ? `Scheduled ASAP${input.user ? ` by ${input.user}` : ''}`
                : `Scheduled for ${input.scheduleAt.toISOString()}${input.user ? ` by ${input.user}` : ''}`
              : `Scheduled ${input.repeat === 'cron' ? `cron "${input.cron}"` : `every ${input.interval} s`}, first run ${input.scheduleAt.toISOString()}`,
        },
      ],
      req,
    )
    await dispatch(payload, options, store, doc, { req })
    return { created: true, id: doc.id, scheduleAt: new Date(doc.scheduleAt) }
  }

  async function findByUniqueKey(uniqueKey: string, req?: PayloadRequest): Promise<null | ScheduledAction> {
    const doc = await payload.db.findOne({
      collection: slug,
      req,
      where: { and: [{ uniqueKey: { equals: uniqueKey } }, { status: { in: ['pending', 'running'] } }] },
    })
    return (doc as null | ScheduledAction) ?? null
  }

  function matchWhere(hook: string, match: Match | undefined, statuses: string[]): Where {
    const and: Where[] = [{ hook: { equals: hook } }, { status: { in: statuses } }]
    if (match?.args !== undefined) {
      and.push({ argsHash: { equals: hashArgs(match.args) } })
    }
    if (match?.group !== undefined) {
      and.push({ group: { equals: match.group } })
    }
    return { and }
  }

  async function cancelOne(action: ScheduledAction, user?: null | string): Promise<boolean> {
    const jobId = action.jobId
    if (action.status === 'pending') {
      const ok = await casUpdate(payload, {
        set: { claimedUntil: null, claimToken: null, completedAt: new Date(), jobId: null, status: 'canceled', uniqueKey: null },
        target: target(action.id),
        where: [{ field: 'status', op: '=', value: 'pending' }],
      })
      if (!ok) {
        return false
      }
      await store.deleteJob(jobId)
      await store.log(action.id, [{ event: 'canceled', message: `Canceled${user ? ` by ${user}` : ''}` }])
      return true
    }
    if (action.status === 'running' && (action.repeat === 'interval' || action.repeat === 'cron')) {
      return stopAfterCurrent(action.id)
    }
    return false
  }

  async function stopAfterCurrent(id: number | string): Promise<boolean> {
    const ok = await casUpdate(payload, {
      set: { stopAfterCurrent: true },
      target: target(id),
      where: [{ field: 'status', op: '=', value: 'running' }],
    })
    if (ok) {
      await store.log(id, [{ event: 'note', message: 'Will stop after the current run' }])
    }
    return ok
  }

  async function reschedule(id: number | string, at: Date | number | string, user?: null | string): Promise<boolean> {
    guard()
    const action = await store.get(id)
    if (!action || action.status !== 'pending') {
      return false
    }
    const scheduleAt = toDate(at)
    const previousJobId = action.jobId
    const ok = await casUpdate(payload, {
      set: { jobId: null, scheduleAt },
      target: target(id),
      where: [{ field: 'status', op: '=', value: 'pending' }],
    })
    if (!ok) {
      return false
    }
    await store.deleteJob(previousJobId)
    await store.log(id, [{ event: 'rescheduled', message: `Rescheduled to ${scheduleAt.toISOString()}${user ? ` by ${user}` : ''}` }])
    await dispatch(payload, options, store, { id, queue: action.queue, scheduleAt: scheduleAt.toISOString() })
    return true
  }

  async function executeNow(id: number | string, action: Pick<ScheduledAction, 'queue'>): Promise<void> {
    const jobId = await dispatch(payload, options, store, { id, queue: action.queue, scheduleAt: new Date(0).toISOString() }, { force: true })
    if (jobId) {
      await payload.jobs.runByID({ id: store.parseId(jobId) as never, overrideAccess: true, silent: true } as never)
    }
  }

  async function retry(id: number | string, opts: { execute?: boolean; runNow?: boolean; user?: null | string } = {}): Promise<boolean> {
    guard()
    const action = await store.get(id)
    if (!action || action.status !== 'failed') {
      return false
    }
    const now = new Date()
    const uniqueKey = action.unique ? uniqueKeyFor(action.hook, action.group, action.argsHash) : null
    try {
      const ok = await casUpdate(payload, {
        set: {
          attempts: 0,
          claimedUntil: null,
          claimToken: null,
          completedAt: null,
          failureReason: null,
          jobId: null,
          scheduleAt: now,
          status: 'pending',
          stopAfterCurrent: false,
          uniqueKey,
        },
        target: target(id),
        where: [{ field: 'status', op: '=', value: 'failed' }],
      })
      if (!ok) {
        return false
      }
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return false
      }
      throw error
    }
    await store.log(id, [{ event: 'retry', message: `Retried${opts.user ? ` by ${opts.user}` : ''}` }])
    if (opts.execute) {
      await executeNow(id, action)
    } else {
      await dispatch(payload, options, store, { id, queue: action.queue, scheduleAt: now.toISOString() })
    }
    return true
  }

  async function runNow(id: number | string, opts: { execute?: boolean; user?: null | string } = {}): Promise<boolean> {
    guard()
    const action = await store.get(id)
    if (!action) {
      return false
    }
    if (action.status === 'failed') {
      return retry(id, { ...opts })
    }
    if (action.status !== 'pending') {
      return false
    }
    const now = new Date()
    const previousJobId = action.jobId
    const ok = await casUpdate(payload, {
      set: { jobId: null, scheduleAt: now },
      target: target(id),
      where: [{ field: 'status', op: '=', value: 'pending' }],
    })
    if (!ok) {
      return false
    }
    await store.deleteJob(previousJobId)
    await store.log(id, [{ event: 'rescheduled', message: `Run now${opts.user ? ` by ${opts.user}` : ''}` }])
    if (opts.execute) {
      await executeNow(id, action)
    } else {
      await dispatch(payload, options, store, { id, queue: action.queue, scheduleAt: now.toISOString() })
    }
    return true
  }

  async function runQueue(args: RunQueueArgs = {}): Promise<RunQueueResult> {
    guard()
    const startedAt = new Date()
    const token = newToken()
    const limit = args.limit ?? options.runner.runQueueLimit
    const maxDurationMs = args.maxDurationMs ?? options.runner.runQueueMaxDurationMs
    const lockUntil = new Date(startedAt.getTime() + maxDurationMs + 60_000)
    const user = args.user ?? null
    const locked = await casUpdate(payload, {
      set: { runLockToken: token, runLockUntil: lockUntil, runLockUser: user },
      target: { global: options.statusSlug },
      where: [{ or: [{ field: 'runLockToken', op: 'isNull' }, { field: 'runLockUntil', op: '<', value: startedAt }] }],
    })
    const summary: RunQueueResult = { completed: 0, durationMs: 0, failed: 0, ran: 0, retried: 0, startedAt: startedAt.toISOString(), trigger: args.trigger ?? 'manual', user }
    if (!locked) {
      const status = (await payload.findGlobal({ slug: options.statusSlug as never, depth: 0 })) as { runLockToken?: null | string; runLockUntil?: null | string; runLockUser?: null | string }
      summary.lockedBy = status.runLockToken ? { token: status.runLockToken, until: status.runLockUntil ?? '', user: status.runLockUser ?? null } : { token: '', until: '', user: null }
      return summary
    }
    try {
      const m = maintenance()
      await m.sweep()
      await m.promote()
      const due = await payload.db.find({
        collection: slug,
        limit,
        pagination: false,
        sort: ['priority', 'scheduleAt'],
        where: { and: [{ status: { equals: 'pending' } }, { scheduleAt: { less_than_equal: new Date().toISOString() } }] },
      })
      for (const raw of due.docs as ScheduledAction[]) {
        if (Date.now() - startedAt.getTime() > maxDurationMs) {
          break
        }
        let jobId = raw.jobId
        const existing = await store.findJob(jobId)
        if (!existing || existing.hasError) {
          jobId = await dispatch(payload, options, store, raw, { force: true })
        }
        if (!jobId) {
          continue
        }
        if (existing?.processing) {
          continue
        }
        await payload.jobs.runByID({ id: store.parseId(jobId) as never, overrideAccess: true, silent: true } as never)
        summary.ran += 1
        const after = await store.get(raw.id)
        if (!after) {
          summary.completed += 1
        } else if (after.status === 'failed') {
          summary.failed += 1
        } else if (after.lastOutcome === 'completed' || after.lastOutcome === 'skipped') {
          summary.completed += 1
        } else if (after.status === 'pending' && after.attempts > 0) {
          summary.retried += 1
          summary.failed += 1
        }
      }
    } finally {
      summary.durationMs = Date.now() - startedAt.getTime()
      const { lockedBy: _lockedBy, ...lastRun } = summary
      await payload.db.updateGlobal({ slug: options.statusSlug, data: { lastRun } })
      await casUpdate(payload, {
        set: { runLockToken: null, runLockUntil: null, runLockUser: null },
        target: { global: options.statusSlug },
        where: [{ field: 'runLockToken', op: '=', value: token }],
      })
    }
    return summary
  }

  const api: SchedulerAPI = {
    cancel: async (hook, match) => {
      guard()
      const found = await payload.db.find({ collection: slug, limit: 1, pagination: false, sort: 'scheduleAt', where: matchWhere(hook, match, ['pending']) })
      const action = found.docs[0] as ScheduledAction | undefined
      return action && (await cancelOne(action)) ? 1 : 0
    },
    cancelAll: async (hook, match) => {
      guard()
      const found = await payload.db.find({ collection: slug, limit: 1000, pagination: false, sort: 'scheduleAt', where: matchWhere(hook, match, ['pending']) })
      let count = 0
      for (const action of found.docs as ScheduledAction[]) {
        if (await cancelOne(action)) {
          count += 1
        }
      }
      return count
    },
    cancelByID: async (id, opts) => {
      guard()
      const action = await store.get(id)
      return action ? cancelOne(action, opts?.user) : false
    },
    cron: (hook, args, opts) => {
      validateCron(opts.cron, opts.tz ?? options.defaultTimezone)
      const tz = opts.tz ?? options.defaultTimezone
      const from = opts.startAt !== undefined ? toDate(opts.startAt) : new Date()
      return create(hook, args, { ...opts, cron: opts.cron, repeat: 'cron', scheduleAt: nextCronRun(opts.cron, tz, from), tz })
    },
    enqueue: (hook, args, opts) => create(hook, args, { ...opts, repeat: 'once', scheduleAt: new Date() }),
    find: async (args: FindActionsArgs = {}) => {
      guard()
      const and: Where[] = []
      if (args.hook) {
        and.push({ hook: { equals: args.hook } })
      }
      if (args.group) {
        and.push({ group: { equals: args.group } })
      }
      if (args.status) {
        and.push({ status: { in: Array.isArray(args.status) ? args.status : [args.status] } })
      }
      if (args.where) {
        and.push(args.where as Where)
      }
      const result = await payload.find({
        collection: slug,
        depth: 0,
        limit: args.limit ?? 25,
        overrideAccess: true,
        page: args.page,
        sort: args.sort ?? 'scheduleAt',
        where: and.length ? { and } : undefined,
      })
      return { docs: result.docs as unknown as ScheduledAction[], page: result.page ?? 1, totalDocs: result.totalDocs, totalPages: result.totalPages }
    },
    has: async (hook, match) => {
      guard()
      const { totalDocs } = await payload.db.count({ collection: slug, where: matchWhere(hook, match, ['pending', 'running']) })
      return totalDocs > 0
    },
    next: async (hook, match) => {
      guard()
      const running = await payload.db.count({ collection: slug, where: matchWhere(hook, match, ['running']) })
      if (running.totalDocs > 0) {
        return 'running'
      }
      const found = await payload.db.find({ collection: slug, limit: 1, pagination: false, sort: 'scheduleAt', where: matchWhere(hook, match, ['pending']) })
      const action = found.docs[0] as ScheduledAction | undefined
      return action ? new Date(action.scheduleAt) : null
    },
    recurring: (hook, args, opts) => {
      const interval = durationToSeconds(opts.every, '"every"')
      if (interval < 1) {
        throw new Error('"every" must be at least one second')
      }
      const scheduleAt = opts.startAt !== undefined ? toDate(opts.startAt) : new Date(Date.now() + interval * 1000)
      return create(hook, args, { ...opts, interval, repeat: 'interval', scheduleAt })
    },
    reschedule: (id, at) => reschedule(id, at),
    retry: (id, opts) => retry(id, opts),
    runNow: (id) => runNow(id),
    runQueue,
    schedule: (hook, args, opts = {}) => create(hook, args, { ...opts, repeat: 'once', scheduleAt: toDate(opts.scheduleAt) }),
    stopAfterCurrent: (id) => {
      guard()
      return stopAfterCurrent(id)
    },
  }

  return Object.assign(api, {
    /** Internal helpers used by endpoints and hooks; not part of the public API. */
    _internal: { cancelOne, create, executeNow, reschedule, retry, runNow },
  })
}

export type InternalAPI = SchedulerAPI & {
  _internal: {
    cancelOne: (action: ScheduledAction, user?: null | string) => Promise<boolean>
    create: (hook: string, args: unknown, input: CreateInput) => Promise<ScheduledActionRef>
    executeNow: (id: number | string, action: Pick<ScheduledAction, 'queue'>) => Promise<void>
    reschedule: (id: number | string, at: Date | number | string, user?: null | string) => Promise<boolean>
    retry: (id: number | string, opts?: { execute?: boolean; user?: null | string }) => Promise<boolean>
    runNow: (id: number | string, opts?: { execute?: boolean; user?: null | string }) => Promise<boolean>
  }
}

export type { CreateInput, RunSummary, ActionArgs, ActionSlug, CronOptions, RecurringOptions, ScheduleOptions }
