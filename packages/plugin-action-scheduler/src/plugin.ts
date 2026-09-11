import type { CollectionConfig, Config, Payload } from 'payload'

import type { InternalAPI } from './api/index.js'
import type { ActionSchedulerOptions, ScheduledAction } from './types.js'

import { createSchedulerAPI } from './api/index.js'
import { createLogsCollection } from './collections/scheduled-action-logs.js'
import { createScheduledActionsCollection, isInternal } from './collections/scheduled-actions.js'
import { casSupport } from './db/cas.js'
import { dispatch } from './engine/dispatch.js'
import { createEngine } from './engine/execute.js'
import { createStore } from './engine/store.js'
import { createEndpoints } from './endpoints/index.js'
import { createStatusGlobal } from './globals/scheduler-status.js'
import { createMaintenance } from './maintenance/index.js'
import { sanitizeOptions } from './options.js'
import { createSchedulerTypeScriptSchema } from './typescript/schema.js'
import { hashArgs, serializeArgs, uniqueKeyFor } from './utils/hash.js'
import { nextCronRun, validateCron } from './utils/recurrence.js'
import { toDate } from './utils/duration.js'

export const actionScheduler =
  (incoming: ActionSchedulerOptions) =>
  (config: Config): Config => {
    const options = sanitizeOptions(incoming)

    // One runtime per Payload instance; config-time code only builds the schema.
    type Runtime = { api: InternalAPI; engine: ReturnType<typeof createEngine>; maintenance: ReturnType<typeof createMaintenance>; store: ReturnType<typeof createStore> }
    const runtimes = new WeakMap<Payload, Runtime>()
    const getRuntime = (payload: Payload): Runtime => {
      let runtime = runtimes.get(payload)
      if (!runtime) {
        const store = createStore(payload, options)
        const engine = createEngine(payload, options, store)
        let maintenance!: ReturnType<typeof createMaintenance>
        const api = createSchedulerAPI(payload, options, store, () => maintenance) as InternalAPI
        maintenance = createMaintenance(payload, options, store, engine, () => api)
        runtime = { api, engine, maintenance, store }
        runtimes.set(payload, runtime)
      }
      return runtime
    }

    const actions = createScheduledActionsCollection(options)
    attachHooks(actions)

    config.collections = [...(config.collections ?? []), actions, ...(options.logs ? [createLogsCollection(options)] : [])]
    config.globals = [...(config.globals ?? []), createStatusGlobal(options)]
    config.typescript = config.typescript ?? {}
    config.typescript.schema = [...(config.typescript.schema ?? []), createSchedulerTypeScriptSchema(options)]

    if (!options.disabled) {
      config.jobs = config.jobs ?? { tasks: [] }
      const runTask = {
        slug: 'scheduler:run',
        handler: async ({ input, req }: { input: { actionId?: string }; req: { payload: Payload } }) => {
          const actionId = String(input?.actionId ?? '')
          if (actionId) {
            await getRuntime(req.payload).engine.execute(actionId, req as never)
          }
          return { output: {} }
        },
        inputSchema: [{ name: 'actionId', type: 'text' as const, required: true }],
        label: 'Scheduled action',
        retries: 0,
      }
      const tasks = [runTask]
      if (options.tick) {
        tasks.push({
          slug: 'scheduler:tick',
          handler: async ({ req }: { input: { actionId?: string }; req: { payload: Payload } }) => {
            await getRuntime(req.payload).maintenance.tick()
            return { output: {} }
          },
          inputSchema: [],
          label: 'Scheduler maintenance',
          retries: 0,
          schedule: [{ cron: options.tick.cron, queue: options.tick.queue }],
        } as never)
      }
      config.jobs.tasks = [...(config.jobs.tasks ?? []), ...(tasks as never[])]
    }

    const incomingOnInit = config.onInit
    config.onInit = async (payload) => {
      const { api, maintenance, store } = getRuntime(payload)
      payload.scheduler = api
      if (!options.disabled) {
        if (casSupport(payload) === 'fallback') {
          payload.logger.warn('[action-scheduler] claims are not atomic on this database adapter; run a single job runner')
        }
        // The status global must exist as a row for the run-lock compare-and-set to have something to update.
        const status = (await payload.findGlobal({ slug: options.statusSlug as never, depth: 0 })) as { id?: unknown }
        if (!status.id) {
          await payload.db.updateGlobal({ slug: options.statusSlug, data: {} })
        }
        try {
          await maintenance.reconcileSeries()
        } catch (error) {
          payload.logger.error({ err: error }, '[action-scheduler] could not reconcile recurring series')
        }
      }
      void store
      if (incomingOnInit) {
        await incomingOnInit(payload)
      }
    }

    return config

    /** Admin and host-code writes through the Local API go through the same rules as the API. */
    function attachHooks(collection: CollectionConfig): void {
      collection.hooks = collection.hooks ?? {}
      collection.hooks.beforeValidate = [
        ...(collection.hooks.beforeValidate ?? []),
        ({ context, data, operation, originalDoc, req }) => {
          if (isInternal(context) || !data) {
            return data
          }
          const hook = String(data.hook ?? originalDoc?.hook ?? '')
          const definition = options.definitions.get(hook)
          if (!definition) {
            return data
          }
          const { bytes, value } = serializeArgs(hook, data.args ?? originalDoc?.args ?? {})
          if (bytes > options.maxArgsBytes) {
            throw new Error(`Arguments are ${bytes} bytes; the limit is ${options.maxArgsBytes}. Pass ids, not documents.`)
          }
          data.args = value
          data.argsHash = hashArgs(value)
          const repeat = (data.repeat ?? originalDoc?.repeat ?? 'once') as ScheduledAction['repeat']
          if (repeat === 'cron') {
            const cron = String(data.cron ?? originalDoc?.cron ?? '')
            const tz = (data.tz ?? originalDoc?.tz ?? options.defaultTimezone) as string
            validateCron(cron, tz)
            data.tz = tz
            if (!data.scheduleAt || operation === 'create') {
              data.scheduleAt = nextCronRun(cron, tz).toISOString()
            }
          } else if (repeat === 'interval') {
            const interval = Number(data.interval ?? originalDoc?.interval ?? 0)
            if (!interval || interval < 1) {
              throw new Error('Interval must be at least one second')
            }
            if (!data.scheduleAt && operation === 'create') {
              data.scheduleAt = new Date(Date.now() + interval * 1000).toISOString()
            }
          } else if (!data.scheduleAt && operation === 'create') {
            data.scheduleAt = new Date().toISOString()
          }
          if (operation === 'create') {
            const group = String(data.group ?? definition.group ?? 'default')
            data.group = group
            data.status = 'pending'
            data.attempts = 0
            data.runCount = 0
            data.consecutiveFailures = 0
            data.maxAttempts = (definition.retries ?? options.defaultRetries) + 1
            data.priority = data.priority ?? definition.priority ?? 10
            data.queue = data.queue ?? definition.queue ?? 'default'
            data.source = data.source ?? (req.user ? 'admin' : 'code')
            data.createdBy = data.createdBy ?? ((req.user as { email?: string } | null)?.email ?? null)
            const unique = Boolean(data.unique ?? definition.unique ?? repeat !== 'once')
            data.unique = unique
            data.uniqueKey = unique ? uniqueKeyFor(hook, group, data.argsHash as string) : null
            data.scheduleAt = toDate(data.scheduleAt as string).toISOString()
          }
          return data
        },
      ]
      collection.hooks.afterChange = [
        ...(collection.hooks.afterChange ?? []),
        async ({ context, doc, operation, previousDoc, req }) => {
          if (isInternal(context) || options.disabled) {
            return doc
          }
          const { store } = getRuntime(req.payload)
          if (operation === 'create') {
            await store.log(doc.id, [{ event: 'scheduled', message: `Scheduled for ${doc.scheduleAt}${doc.createdBy ? ` by ${doc.createdBy}` : ''}` }])
            await dispatch(req.payload, options, store, doc as ScheduledAction)
          } else if (doc.status === 'pending' && previousDoc && previousDoc.scheduleAt !== doc.scheduleAt) {
            await store.deleteJob(previousDoc.jobId)
            await store.update(doc.id, { jobId: null })
            await store.log(doc.id, [{ event: 'rescheduled', message: `Rescheduled to ${doc.scheduleAt}` }])
            await dispatch(req.payload, options, store, doc as ScheduledAction)
          }
          return doc
        },
      ]
      collection.hooks.afterDelete = [
        ...(collection.hooks.afterDelete ?? []),
        async ({ doc, req }) => {
          const { store } = getRuntime(req.payload)
          await store.deleteJob((doc as ScheduledAction).jobId)
          await store.deleteLogs([doc.id])
          return doc
        },
      ]
    }
  }
