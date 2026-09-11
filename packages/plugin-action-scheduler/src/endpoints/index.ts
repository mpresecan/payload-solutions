import type { Access, Endpoint, PayloadRequest } from 'payload'

import type { InternalAPI } from '../api/index.js'
import type { Store } from '../engine/store.js'
import type { SanitizedActionSchedulerOptions, ScheduledAction, ScheduledActionLog, SchedulerStatus } from '../types.js'

import { toDate } from '../utils/duration.js'
import { nextCronRun } from '../utils/recurrence.js'

export type StatusPayload = {
  health: 'healthy' | 'never' | 'stale' | 'unknown'
  lastRun: null | SchedulerStatus['lastRun']
  lastTickAt: null | string
  nextDue: null | string
  now: string
  pastDue: number
  runLock: null | { since: string; until: string; user: null | string }
  warnAfterMs: number
}

export type CountsPayload = Record<'all' | 'canceled' | 'complete' | 'failed' | 'pastdue' | 'pending' | 'running', number>

async function allowed(access: Access, req: PayloadRequest): Promise<boolean> {
  try {
    return Boolean(await access({ req }))
  } catch {
    return false
  }
}

const json = (body: unknown, status = 200) => Response.json(body, { status })
const userLabel = (req: PayloadRequest): null | string => {
  const user = req.user as { email?: string; id?: number | string } | null | undefined
  return user ? (user.email ?? String(user.id)) : null
}

async function readBody<T>(req: PayloadRequest): Promise<T> {
  try {
    return ((await req.json?.()) ?? {}) as T
  } catch {
    return {} as T
  }
}

export function createEndpoints(options: SanitizedActionSchedulerOptions, store: Store, api: () => InternalAPI): Endpoint[] {
  const slug = options.collectionSlug as never

  const statusHandler: Endpoint['handler'] = async (req) => {
    if (!(await allowed(options.access.read, req))) {
      return json({ message: 'Unauthorized' }, 401)
    }
    const { payload } = req
    const now = new Date()
    const status = (await payload.findGlobal({ slug: options.statusSlug as never, depth: 0 })) as SchedulerStatus & { id?: unknown }
    const [nextDue, pastDue] = await Promise.all([
      payload.db.find({ collection: slug, limit: 1, pagination: false, select: { scheduleAt: true } as never, sort: 'scheduleAt', where: { and: [{ status: { equals: 'pending' } }, { scheduleAt: { greater_than: now.toISOString() } }] } }),
      payload.db.count({ collection: slug, where: { and: [{ status: { equals: 'pending' } }, { scheduleAt: { less_than: new Date(now.getTime() - 60_000).toISOString() } }] } }),
    ])
    const lastTickAt = status.lastTickAt ?? null
    let health: StatusPayload['health'] = 'unknown'
    if (options.tick) {
      if (!lastTickAt) {
        health = 'never'
      } else if (now.getTime() - new Date(lastTickAt).getTime() > options.runner.warnAfterMs) {
        health = 'stale'
      } else {
        health = 'healthy'
      }
    }
    const lockActive = status.runLockToken && status.runLockUntil && new Date(status.runLockUntil) > now
    const body: StatusPayload = {
      health,
      lastRun: status.lastRun ?? null,
      lastTickAt,
      nextDue: (nextDue.docs[0] as { scheduleAt?: string } | undefined)?.scheduleAt ?? null,
      now: now.toISOString(),
      pastDue: pastDue.totalDocs,
      runLock: lockActive ? { since: '', until: status.runLockUntil!, user: status.runLockUser ?? null } : null,
      warnAfterMs: options.runner.warnAfterMs,
    }
    return json(body)
  }

  const countsHandler: Endpoint['handler'] = async (req) => {
    if (!(await allowed(options.access.read, req))) {
      return json({ message: 'Unauthorized' }, 401)
    }
    const { payload } = req
    const count = (where?: Record<string, unknown>) => payload.db.count({ collection: slug, where: where as never }).then((r) => r.totalDocs)
    const pastDueCutoff = new Date(Date.now() - 60_000).toISOString()
    const [all, pending, running, pastdue, failed, complete, canceled] = await Promise.all([
      count(),
      count({ status: { equals: 'pending' } }),
      count({ status: { equals: 'running' } }),
      count({ and: [{ status: { equals: 'pending' } }, { scheduleAt: { less_than: pastDueCutoff } }] }),
      count({ status: { equals: 'failed' } }),
      count({ status: { equals: 'complete' } }),
      count({ status: { equals: 'canceled' } }),
    ])
    const body: CountsPayload = { all, canceled, complete, failed, pastdue, pending, running }
    return json(body)
  }

  const runQueueHandler: Endpoint['handler'] = async (req) => {
    if (!(await allowed(options.access.runQueue, req))) {
      return json({ message: 'Unauthorized' }, 401)
    }
    const body = await readBody<{ limit?: number; queue?: string }>(req)
    const result = await api().runQueue({ limit: body.limit, trigger: 'manual', user: userLabel(req) })
    if (result.lockedBy) {
      return json({ message: `A run is already in progress${result.lockedBy.user ? ` (started by ${result.lockedBy.user})` : ''}.`, ...result }, 409)
    }
    return json(result)
  }

  const idOf = (req: PayloadRequest) => String(req.routeParams?.id ?? '')

  const rowAction =
    (op: 'cancel' | 'reschedule' | 'retry' | 'run-now' | 'stop-after-current'): Endpoint['handler'] =>
    async (req) => {
      if (!(await allowed(options.access.manage, req))) {
        return json({ message: 'Unauthorized' }, 401)
      }
      const id = idOf(req)
      const action = await store.get(id)
      if (!action) {
        return json({ message: 'Not found' }, 404)
      }
      const user = userLabel(req)
      const body = await readBody<{ execute?: boolean; scheduleAt?: string }>(req)
      let ok = false
      let message = ''
      try {
        switch (op) {
          case 'cancel':
            if (action.status === 'running' && action.repeat === 'once') {
              return json({ message: 'This action is running and cannot be stopped from another process. Wait for it to finish.' }, 409)
            }
            ok = await api()._internal.cancelOne(action, user)
            message = ok ? (action.status === 'running' ? 'The series stops after this run.' : 'Canceled.') : 'Only pending actions can be canceled.'
            break
          case 'reschedule':
            ok = await api()._internal.reschedule(id, toDate(body.scheduleAt), user)
            message = ok ? 'Rescheduled.' : 'Only pending actions can be rescheduled.'
            break
          case 'retry':
            ok = await api()._internal.retry(id, { execute: body.execute !== false, user })
            message = ok ? 'Retried.' : 'Only failed actions can be retried.'
            break
          case 'run-now':
            ok = await api()._internal.runNow(id, { execute: body.execute !== false, user })
            message = ok ? 'Ran.' : 'Only pending or failed actions can run now.'
            break
          case 'stop-after-current':
            ok = await api().stopAfterCurrent(id)
            message = ok ? 'The series stops after this run.' : 'Only a running recurring action can be stopped this way.'
            break
        }
      } catch (error) {
        return json({ message: error instanceof Error ? error.message : String(error) }, 400)
      }
      const after = await store.get(id)
      return json({ action: after, message, ok }, ok ? 200 : 409)
    }

  const logsHandler: Endpoint['handler'] = async (req) => {
    if (!(await allowed(options.access.read, req))) {
      return json({ message: 'Unauthorized' }, 401)
    }
    const id = idOf(req)
    const action = await store.get(id)
    if (!action) {
      return json({ message: 'Not found' }, 404)
    }
    let logs: ScheduledActionLog[] = []
    let trimmed = false
    if (options.logs) {
      const limit = Math.min(Number(req.query?.limit ?? options.logs.perAction) || options.logs.perAction, 200)
      const result = await req.payload.db.find({ collection: options.logs.slug as never, limit, pagination: false, sort: ['-createdAt', '-id'], where: { action: { equals: store.parseId(id) } } })
      logs = result.docs as unknown as ScheduledActionLog[]
      trimmed = logs.length >= options.logs.perAction
    }
    const definition = options.definitions.get(action.hook)
    return json({
      action,
      definition: definition ? { description: definition.description ?? null, label: definition.label ?? null, registered: true } : { description: null, label: null, registered: false },
      logs,
      maxArgsBytes: options.maxArgsBytes,
      trimmed,
    })
  }

  const bulkHandler: Endpoint['handler'] = async (req) => {
    if (!(await allowed(options.access.manage, req))) {
      return json({ message: 'Unauthorized' }, 401)
    }
    const body = await readBody<{ ids?: (number | string)[]; op?: 'cancel' | 'delete' | 'retry' | 'run-now' }>(req)
    const ids = Array.isArray(body.ids) ? body.ids.slice(0, 500) : []
    if (!ids.length || !body.op) {
      return json({ message: 'ids and op are required' }, 400)
    }
    const user = userLabel(req)
    let applied = 0
    for (const id of ids) {
      const action = await store.get(id)
      if (!action) {
        continue
      }
      let ok = false
      switch (body.op) {
        case 'cancel':
          ok = action.status === 'pending' && (await api()._internal.cancelOne(action, user))
          break
        case 'delete':
          if (action.status === 'complete' || action.status === 'failed' || action.status === 'canceled') {
            await store.remove(action.id)
            ok = true
          }
          break
        case 'retry':
          ok = action.status === 'failed' && (await api()._internal.retry(id, { execute: false, user }))
          break
        case 'run-now':
          ok = (action.status === 'pending' || action.status === 'failed') && (await api()._internal.runNow(id, { execute: false, user }))
          break
      }
      if (ok) {
        applied += 1
      }
    }
    return json({ applied, message: applied === ids.length ? `Applied to ${applied}.` : `Applied to ${applied} of ${ids.length} selected; the others are not in a state that allows it.`, selected: ids.length })
  }

  const duplicateHandler: Endpoint['handler'] = async (req) => {
    if (!(await allowed(options.access.create, req))) {
      return json({ message: 'Unauthorized' }, 401)
    }
    const action = await store.get(idOf(req))
    if (!action) {
      return json({ message: 'Not found' }, 404)
    }
    if (!options.definitions.has(action.hook)) {
      return json({ message: `"${action.hook}" is no longer registered in code.` }, 400)
    }
    try {
      const repeat = action.repeat
      const scheduleAt =
        repeat === 'cron' && action.cron
          ? nextCronRun(action.cron, action.tz)
          : repeat === 'interval'
            ? new Date(Date.now() + Number(action.interval ?? 60) * 1000)
            : new Date(Date.now() + 5 * 60_000)
      const ref = await api()._internal.create(action.hook, action.args ?? {}, {
        cron: action.cron ?? null,
        group: action.group,
        interval: action.interval ?? null,
        priority: action.priority,
        queue: action.queue,
        repeat,
        scheduleAt,
        source: 'admin',
        tz: action.tz ?? null,
        unique: Boolean(action.unique),
        user: userLabel(req),
      })
      return json({ ...ref, message: ref.created ? 'Duplicated.' : 'An identical action is already pending; opened it instead.' })
    } catch (error) {
      return json({ message: error instanceof Error ? error.message : String(error) }, 400)
    }
  }

  const registryHandler: Endpoint['handler'] = async (req) => {
    if (!(await allowed(options.access.read, req))) {
      return json({ message: 'Unauthorized' }, 401)
    }
    return json({
      actions: [...options.definitions.values()].map((d) => ({ description: d.description ?? null, group: d.group ?? 'default', label: d.label ?? null, slug: d.slug })),
      defaultTimezone: options.defaultTimezone,
      maxArgsBytes: options.maxArgsBytes,
    })
  }

  return [
    { handler: statusHandler, method: 'get', path: '/scheduler/status' },
    { handler: countsHandler, method: 'get', path: '/scheduler/counts' },
    { handler: registryHandler, method: 'get', path: '/scheduler/registry' },
    { handler: runQueueHandler, method: 'post', path: '/scheduler/run-queue' },
    { handler: bulkHandler, method: 'post', path: '/scheduler/bulk' },
    { handler: logsHandler, method: 'get', path: '/:id/logs' },
    { handler: rowAction('run-now'), method: 'post', path: '/:id/run-now' },
    { handler: rowAction('retry'), method: 'post', path: '/:id/retry' },
    { handler: rowAction('cancel'), method: 'post', path: '/:id/cancel' },
    { handler: rowAction('reschedule'), method: 'post', path: '/:id/reschedule' },
    { handler: rowAction('stop-after-current'), method: 'post', path: '/:id/stop-after-current' },
    { handler: duplicateHandler, method: 'post', path: '/:id/duplicate' },
  ]
}

export type { ScheduledAction }
