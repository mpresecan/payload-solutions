import type { Payload } from 'payload'

/**
 * Compare-and-set updates.
 *
 * Payload's `db.updateOne({ where })` selects the row id first and then updates by id, so two
 * runners can both "win" a claim. The plugin therefore claims and records outcomes with one
 * conditional statement per adapter: raw `UPDATE … WHERE … RETURNING` on Postgres and SQLite
 * (through the adapter's own `execute`) and `findOneAndUpdate` on MongoDB. Anything else falls
 * back to read-then-write with a warning at init (`casSupport`).
 */
export type CasValue = boolean | Date | null | number | string

export type CasClause =
  | { field: string; op: '<' | '<=' | '=' | '>' | '>='; value: CasValue }
  | { field: string; op: 'isNull' }
  | { field: string; op: 'notNull' }
  | { or: CasClause[] }

export type CasTarget = { global: string } | { collection: string; id: number | string }

export type CasArgs = {
  set: Record<string, CasValue>
  target: CasTarget
  where: CasClause[]
}

type DrizzleLike = {
  drizzle: unknown
  execute: (args: { drizzle: unknown; raw: string }) => Promise<unknown> | unknown
  name: string
  schemaName?: string
  tableNameMap: Map<string, string>
}

type MongooseLike = {
  collections: Record<string, { findOneAndUpdate: (filter: unknown, update: unknown, opts: unknown) => Promise<unknown> }>
  globals: { findOneAndUpdate: (filter: unknown, update: unknown, opts: unknown) => Promise<unknown> }
  name: string
}

export type CasSupport = 'custom' | 'drizzle' | 'fallback' | 'mongoose'

export function casSupport(payload: Payload): CasSupport {
  if (typeof (payload.db as { casUpdate?: unknown }).casUpdate === 'function') {
    return 'custom'
  }
  const name = (payload.db as { name?: string }).name
  if (name === 'postgres' || name === 'sqlite' || name === 'vercel-postgres') {
    return 'drizzle'
  }
  if (name === 'mongoose') {
    return 'mongoose'
  }
  return 'fallback'
}

export function toSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase()
}

function sqlLiteral(value: CasValue, dialect: 'postgres' | 'sqlite'): string {
  if (value === null) {
    return 'NULL'
  }
  if (value instanceof Date) {
    return `'${value.toISOString()}'`
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Non-finite number in CAS')
    }
    return String(value)
  }
  if (typeof value === 'boolean') {
    return dialect === 'sqlite' ? (value ? '1' : '0') : value ? 'true' : 'false'
  }
  return `'${String(value).replace(/'/g, "''").replace(/\0/g, '')}'`
}

function sqlClause(clause: CasClause, dialect: 'postgres' | 'sqlite'): string {
  if ('or' in clause) {
    return `(${clause.or.map((c) => sqlClause(c, dialect)).join(' OR ')})`
  }
  const column = `"${toSnakeCase(clause.field)}"`
  if (clause.op === 'isNull') {
    return `${column} IS NULL`
  }
  if (clause.op === 'notNull') {
    return `${column} IS NOT NULL`
  }
  if (clause.value === null) {
    return clause.op === '=' ? `${column} IS NULL` : `${column} IS NOT NULL`
  }
  return `${column} ${clause.op} ${sqlLiteral(clause.value, dialect)}`
}

function rowsOf(result: unknown): number {
  if (!result || typeof result !== 'object') {
    return 0
  }
  const r = result as { rowCount?: number; rows?: unknown[]; rowsAffected?: number }
  if (Array.isArray(r.rows)) {
    return r.rows.length
  }
  if (typeof r.rowsAffected === 'number') {
    return r.rowsAffected
  }
  if (typeof r.rowCount === 'number') {
    return r.rowCount
  }
  return 0
}

async function casDrizzle(payload: Payload, args: CasArgs): Promise<boolean> {
  const db = payload.db as unknown as DrizzleLike
  const dialect = db.name === 'sqlite' ? 'sqlite' : 'postgres'
  const slug = 'global' in args.target ? args.target.global : args.target.collection
  const tableName = db.tableNameMap.get(toSnakeCase(slug))
  if (!tableName) {
    throw new Error(`No table for "${slug}"`)
  }
  const table = dialect === 'postgres' && db.schemaName ? `"${db.schemaName}"."${tableName}"` : `"${tableName}"`
  const sets = Object.entries({ ...args.set, updatedAt: new Date() })
    .map(([field, value]) => `"${toSnakeCase(field)}" = ${sqlLiteral(value, dialect)}`)
    .join(', ')
  const where = [...args.where]
  if ('collection' in args.target) {
    where.unshift({ field: 'id', op: '=', value: args.target.id })
  }
  const conditions = where.map((c) => sqlClause(c, dialect)).join(' AND ')
  const raw = `UPDATE ${table} SET ${sets} WHERE ${conditions} RETURNING "id"`
  const result = await db.execute({ drizzle: db.drizzle, raw })
  return rowsOf(result) > 0
}

function mongoValue(value: CasValue): unknown {
  return value
}

function mongoClause(clause: CasClause): Record<string, unknown> {
  if ('or' in clause) {
    return { $or: clause.or.map(mongoClause) }
  }
  if (clause.op === 'isNull') {
    return { [clause.field]: null }
  }
  if (clause.op === 'notNull') {
    return { [clause.field]: { $ne: null } }
  }
  const ops: Record<string, string> = { '<': '$lt', '<=': '$lte', '=': '$eq', '>': '$gt', '>=': '$gte' }
  return { [clause.field]: { [ops[clause.op]!]: mongoValue(clause.value) } }
}

async function casMongoose(payload: Payload, args: CasArgs): Promise<boolean> {
  const db = payload.db as unknown as MongooseLike
  const filter: Record<string, unknown> = { $and: args.where.map(mongoClause) }
  let model: MongooseLike['collections'][string]
  if ('global' in args.target) {
    model = db.globals
    filter.globalType = args.target.global
  } else {
    model = db.collections[args.target.collection]!
    filter._id = args.target.id
  }
  if ((filter.$and as unknown[]).length === 0) {
    delete filter.$and
  }
  const result = await model.findOneAndUpdate(filter, { $set: { ...args.set, updatedAt: new Date() } }, { lean: true, new: true })
  return Boolean(result)
}

/** Read-then-write for adapters without a native path. Not atomic; see `casSupport`. */
async function casFallback(payload: Payload, args: CasArgs): Promise<boolean> {
  const matches = (doc: Record<string, unknown>, clause: CasClause): boolean => {
    if ('or' in clause) {
      return clause.or.some((c) => matches(doc, c))
    }
    const current = doc[clause.field]
    if (clause.op === 'isNull') {
      return current === null || current === undefined
    }
    if (clause.op === 'notNull') {
      return current !== null && current !== undefined
    }
    const a = current instanceof Date ? current.getTime() : typeof current === 'string' && clause.value instanceof Date ? new Date(current).getTime() : current
    const b = clause.value instanceof Date ? clause.value.getTime() : clause.value
    switch (clause.op) {
      case '<':
        return (a as number) < (b as number)
      case '<=':
        return (a as number) <= (b as number)
      case '=':
        return a === b || (a == null && b === null)
      case '>':
        return (a as number) > (b as number)
      case '>=':
        return (a as number) >= (b as number)
    }
  }
  const data = Object.fromEntries(Object.entries(args.set).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]))
  if ('global' in args.target) {
    const doc = (await payload.findGlobal({ slug: args.target.global as never, depth: 0 })) as Record<string, unknown>
    if (!args.where.every((c) => matches(doc, c))) {
      return false
    }
    await payload.db.updateGlobal({ slug: args.target.global, data: { ...doc, ...data } })
    return true
  }
  const doc = (await payload.db.findOne({ collection: args.target.collection, where: { id: { equals: args.target.id } } })) as null | Record<string, unknown>
  if (!doc || !args.where.every((c) => matches(doc, c))) {
    return false
  }
  await payload.db.updateOne({ id: args.target.id, collection: args.target.collection, data, returning: false })
  return true
}

/**
 * A database adapter (or a test double) can provide its own atomic implementation as
 * `payload.db.casUpdate(args)`; it takes precedence over the built-in paths.
 */
export async function casUpdate(payload: Payload, args: CasArgs): Promise<boolean> {
  switch (casSupport(payload)) {
    case 'custom':
      return (payload.db as unknown as { casUpdate: (a: CasArgs) => Promise<boolean> }).casUpdate(args)
    case 'drizzle':
      return casDrizzle(payload, args)
    case 'mongoose':
      return casMongoose(payload, args)
    default:
      return casFallback(payload, args)
  }
}
