/**
 * An in-memory stand-in for the slice of `payload` the engine touches, so the state machine can be
 * unit-tested without a database. Claims go through the CAS fallback path (read-then-write), which is
 * fine single-threaded. Integration tests against real adapters live in dev/int.spec.ts.
 *
 * `adapter: 'mongoose'` imitates MongoDB instead: compare-and-set runs through the plugin's real
 * Mongo path (`findOneAndUpdate` with `$set`/`$unset`), and the unique `uniqueKey` index follows
 * Mongo's sparse-index rule, where a document whose field is an explicit null is indexed (two nulls
 * collide) and only a document without the field is skipped. The dev app runs on SQLite, where
 * NULLs never collide, so this is the only place that rule is exercised.
 */
import type { Payload } from 'payload'

import type { ActionDefinition, ActionSchedulerOptions } from '../types.js'

import { createSchedulerAPI, type InternalAPI } from '../api/index.js'
import type { CasArgs, CasClause } from '../db/cas.js'
import { createMaintenance } from '../maintenance/index.js'
import { sanitizeOptions } from '../options.js'
import { createEngine } from './execute.js'
import { createStore } from './store.js'

type Doc = Record<string, unknown> & { id: number }

function matches(doc: Doc, where: unknown): boolean {
  if (!where || typeof where !== 'object') {
    return true
  }
  const w = where as Record<string, unknown>
  if (Array.isArray(w.and)) {
    return w.and.every((c) => matches(doc, c))
  }
  if (Array.isArray(w.or)) {
    return w.or.some((c) => matches(doc, c))
  }
  return Object.entries(w).every(([field, cond]) => {
    const value = doc[field]
    const c = cond as Record<string, unknown>
    if ('equals' in c) {
      return value === c.equals || (value == null && c.equals == null)
    }
    if ('in' in c) {
      return (c.in as unknown[]).includes(value)
    }
    if ('exists' in c) {
      return c.exists ? value !== null && value !== undefined : value === null || value === undefined
    }
    const asTime = (v: unknown) => (typeof v === 'string' && /^\d{4}-/.test(v) ? new Date(v).getTime() : (v as number))
    if ('less_than' in c) {
      return asTime(value) < asTime(c.less_than)
    }
    if ('less_than_equal' in c) {
      return asTime(value) <= asTime(c.less_than_equal)
    }
    if ('greater_than' in c) {
      return asTime(value) > asTime(c.greater_than)
    }
    return true
  })
}

function sortDocs(docs: Doc[], sort: string | string[] | undefined): Doc[] {
  const keys = (Array.isArray(sort) ? sort : sort ? [sort] : []).map((k) => (k.startsWith('-') ? { desc: true, key: k.slice(1) } : { desc: false, key: k }))
  return [...docs].sort((a, b) => {
    for (const { desc, key } of keys) {
      const x = a[key] as never
      const y = b[key] as never
      if (x === y) {
        continue
      }
      return (x < y ? -1 : 1) * (desc ? -1 : 1)
    }
    return 0
  })
}

type MongoFilter = Record<string, unknown>

/** Evaluates the filters the plugin's Mongo compare-and-set builds (see mongoClause in db/cas.ts). */
function mongoMatches(doc: Doc, filter: MongoFilter): boolean {
  return Object.entries(filter).every(([key, cond]) => {
    if (key === '$and') {
      return (cond as MongoFilter[]).every((c) => mongoMatches(doc, c))
    }
    if (key === '$or') {
      return (cond as MongoFilter[]).some((c) => mongoMatches(doc, c))
    }
    const value = key === '_id' ? doc.id : doc[key]
    if (cond === null) {
      return value === null || value === undefined
    }
    if (typeof cond !== 'object' || cond instanceof Date) {
      return value === cond
    }
    const norm = (v: unknown) => (v instanceof Date ? v.getTime() : typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v).getTime() : v)
    return Object.entries(cond as Record<string, unknown>).every(([op, operand]) => {
      const a = norm(value) as number
      const b = norm(operand) as number
      switch (op) {
        case '$eq':
          return operand === null ? value === null || value === undefined : a === b
        case '$ne':
          return operand === null ? value !== null && value !== undefined : a !== b
        case '$lt':
          return a < b
        case '$lte':
          return a <= b
        case '$gt':
          return a > b
        case '$gte':
          return a >= b
        default:
          throw new Error(`mongo harness: unsupported operator ${op}`)
      }
    })
  })
}

export function createHarness(
  actions: ActionDefinition<any>[],
  overrides: Partial<ActionSchedulerOptions> = {},
  harness: { adapter?: 'memory' | 'mongoose' } = {},
) {
  const mongo = harness.adapter === 'mongoose'
  const options = sanitizeOptions({ actions, defaultBackoff: { type: 'fixed', delay: '1s' }, tick: { cron: '* * * * *' }, ...overrides })
  const tables = new Map<string, Doc[]>()
  const globals = new Map<string, Doc>()
  let seq = 1
  const table = (slug: string) => {
    if (!tables.has(slug)) {
      tables.set(slug, [])
    }
    return tables.get(slug)!
  }
  const serialize = (data: Record<string, unknown>) => Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]))
  const jobs: { deleted: number[]; queued: { id: number; input: Record<string, unknown>; waitUntil?: Date }[] } = { deleted: [], queued: [] }
  const logs: { level: string; msg: string }[] = []

  const evaluate = (doc: Doc, clause: CasClause): boolean => {
    if ('or' in clause) {
      return clause.or.some((c) => evaluate(doc, c))
    }
    const current = doc[clause.field]
    if (clause.op === 'isNull') {
      return current == null
    }
    if (clause.op === 'notNull') {
      return current != null
    }
    const norm = (v: unknown) => (v instanceof Date ? v.getTime() : typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v).getTime() : v)
    const a = norm(current) as number
    const b = norm(clause.value) as number
    switch (clause.op) {
      case '<':
        return a < b
      case '<=':
        return a <= b
      case '=':
        return a === b || (current == null && clause.value === null)
      case '>':
        return a > b
      case '>=':
        return a >= b
    }
  }

  /**
   * The unique `uniqueKey` index. SQL: NULLs never collide. Mongo (unique + sparse): a document
   * that has the field is indexed even when it is null, so an explicit null collides with another.
   */
  const assertUniqueKey = (collection: string, doc: Record<string, unknown>, self?: Doc) => {
    if (collection !== options.collectionSlug) {
      return
    }
    const indexed = (d: Record<string, unknown>) => (mongo ? 'uniqueKey' in d && d.uniqueKey !== undefined : d.uniqueKey != null)
    if (indexed(doc) && table(collection).some((d) => d !== self && indexed(d) && d.uniqueKey === doc.uniqueKey)) {
      throw mongo
        ? new Error(`E11000 duplicate key error collection: ${collection} index: uniqueKey_1 dup key: { uniqueKey: ${JSON.stringify(doc.uniqueKey)} }`)
        : new Error('UNIQUE constraint failed: scheduled_actions.unique_key')
    }
  }

  /** Mongo's findOneAndUpdate for the compare-and-set: `$set` and `$unset`, unique index enforced. */
  const mongoModel = (find: (filter: MongoFilter) => Doc | undefined, collection: null | string) => ({
    findOneAndUpdate: async (filter: MongoFilter, update: { $set?: Record<string, unknown>; $unset?: Record<string, unknown> }) => {
      const doc = find(filter)
      if (!doc) {
        return null
      }
      const next: Record<string, unknown> = { ...doc, ...serialize(update.$set ?? {}) }
      for (const field of Object.keys(update.$unset ?? {})) {
        delete next[field]
      }
      if (collection) {
        assertUniqueKey(collection, next, doc)
      }
      for (const field of Object.keys(doc)) {
        if (!(field in next)) {
          delete doc[field]
        }
      }
      Object.assign(doc, next)
      return structuredClone(doc)
    },
  })

  const db = {
    name: mongo ? 'mongoose' : 'memory',
    defaultIDType: 'number' as const,
    /** Atomic within one tick, like a real conditional UPDATE. Mongo mode uses the plugin's own Mongo path. */
    ...(mongo
      ? {
          collections: new Proxy({} as Record<string, ReturnType<typeof mongoModel>>, {
            get: (_, slug: string) => mongoModel((filter) => table(slug).find((d) => mongoMatches(d, filter)), slug),
          }),
          globals: mongoModel((filter) => {
            const doc = globals.get(String(filter.globalType))
            const { globalType: _globalType, ...rest } = filter
            return doc && mongoMatches(doc, rest) ? doc : undefined
          }, null),
        }
      : {
          casUpdate: async (args: CasArgs) => {
            const t = args.target
            const doc = 'global' in t ? globals.get(t.global) : table(t.collection).find((d) => d.id === t.id)
            if (!doc || !args.where.every((c) => evaluate(doc, c))) {
              return false
            }
            if ('collection' in t) {
              assertUniqueKey(t.collection, { ...doc, ...serialize(args.set as Record<string, unknown>) }, doc)
            }
            Object.assign(doc, serialize(args.set as Record<string, unknown>), { updatedAt: new Date().toISOString() })
            return true
          },
        }),
    count: async ({ collection, where }: { collection: string; where?: unknown }) => ({ totalDocs: table(collection).filter((d) => matches(d, where)).length }),
    create: async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
      const doc = { ...serialize(data), id: seq++, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Doc
      assertUniqueKey(collection, doc)
      table(collection).push(doc)
      return doc
    },
    deleteMany: async ({ collection, where }: { collection: string; where?: unknown }) => {
      const t = table(collection)
      tables.set(collection, t.filter((d) => !matches(d, where)))
    },
    deleteOne: async ({ collection, where }: { collection: string; where?: unknown }) => {
      const t = table(collection)
      const i = t.findIndex((d) => matches(d, where))
      if (i >= 0) {
        if (collection === 'payload-jobs') {
          jobs.deleted.push(t[i]!.id)
        }
        t.splice(i, 1)
      }
    },
    find: async ({ collection, limit, sort, where }: { collection: string; limit?: number; sort?: string | string[]; where?: unknown }) => {
      const docs = sortDocs(table(collection).filter((d) => matches(d, where)), sort).slice(0, limit ?? 10)
      return { docs: structuredClone(docs), totalDocs: docs.length }
    },
    findGlobal: async ({ slug }: { slug: string }) => globals.get(slug) ?? { id: undefined },
    findOne: async ({ collection, where }: { collection: string; where?: unknown }) => structuredClone(table(collection).find((d) => matches(d, where)) ?? null),
    updateGlobal: async ({ data, slug }: { data: Record<string, unknown>; slug: string }) => {
      globals.set(slug, { ...(globals.get(slug) ?? { id: 1 }), ...serialize(data) } as Doc)
      return globals.get(slug)
    },
    updateOne: async ({ collection, data, id }: { collection: string; data: Record<string, unknown>; id: number }) => {
      const doc = table(collection).find((d) => d.id === id)
      if (doc) {
        Object.assign(doc, serialize(data), { updatedAt: new Date().toISOString() })
      }
      return doc ?? null
    },
  }
  const payload = {
    collections: { 'payload-jobs': { config: { fields: [] } } },
    db,
    find: async (args: { collection: string; limit?: number; page?: number; sort?: string; where?: unknown }) => {
      const docs = sortDocs(table(args.collection).filter((d) => matches(d, args.where)), args.sort)
      return { docs, page: 1, totalDocs: docs.length, totalPages: 1 }
    },
    findGlobal: db.findGlobal,
    jobs: {
      queue: async ({ input, waitUntil }: { input: Record<string, unknown>; waitUntil?: Date }) => {
        const job = { id: seq++, input, processing: false, taskSlug: 'scheduler-run', updatedAt: new Date().toISOString(), waitUntil } as Doc
        table('payload-jobs').push(job)
        jobs.queued.push({ id: job.id, input, waitUntil })
        return job
      },
      runByID: async ({ id }: { id: number }) => {
        const job = table('payload-jobs').find((d) => d.id === id)
        if (!job) {
          return
        }
        await engine.execute(String((job.input as { actionId: string }).actionId), req)
        await db.deleteOne({ collection: 'payload-jobs', where: { id: { equals: id } } })
      },
    },
    logger: {
      error: (o: unknown, msg?: string) => logs.push({ level: 'error', msg: msg ?? String(o) }),
      info: (o: unknown, msg?: string) => logs.push({ level: 'info', msg: msg ?? String(o) }),
      warn: (o: unknown, msg?: string) => logs.push({ level: 'warn', msg: msg ?? String(o) }),
    },
  } as unknown as Payload
  const req = { payload } as never
  const store = createStore(payload, options)
  const engine = createEngine(payload, options, store)
  let maintenance!: ReturnType<typeof createMaintenance>
  const api = createSchedulerAPI(payload, options, store, () => maintenance) as InternalAPI
  maintenance = createMaintenance(payload, options, store, engine, () => api)
  payload.scheduler = api
  globals.set(options.statusSlug, { id: 1 })

  /** Runs every queued transport job whose waitUntil has passed (or all, with `force`). */
  const runQueued = async (force = false) => {
    for (const job of [...table('payload-jobs')]) {
      const until = job.waitUntil as Date | undefined
      if (force || !until || until.getTime() <= Date.now()) {
        await payload.jobs.runByID({ id: job.id } as never)
      }
    }
  }
  const actionsTable = () => table(options.collectionSlug)
  const logsFor = (id: number) => sortDocs(table(options.logs ? options.logs.slug : ''), ['-createdAt', '-id']).filter((l) => l.action === id)
  return { actionsTable, api, engine, jobs, logs, logsFor, maintenance, options, payload, req, runQueued, store, table }
}
