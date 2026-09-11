import type { Payload, PayloadRequest } from 'payload'

import type { LogEvent, LogLevel, SanitizedActionSchedulerOptions, ScheduledAction } from '../types.js'

import { truncate } from '../utils/hash.js'

export type LogLine = { attempt?: number; durationMs?: number; event: LogEvent; level?: LogLevel; message: string }

export type Store = ReturnType<typeof createStore>

/** Raw data access for the engine: no hooks, no access control, no versions. */
export function createStore(payload: Payload, options: SanitizedActionSchedulerOptions) {
  const collection = options.collectionSlug
  const logsSlug = options.logsSlug

  const parseId = (id: number | string): number | string => {
    if (typeof id === 'number') {
      return id
    }
    return payload.db.defaultIDType === 'number' && /^\d+$/.test(id) ? Number(id) : id
  }

  async function get(id: number | string, req?: PayloadRequest): Promise<null | ScheduledAction> {
    const doc = await payload.db.findOne({ collection, req, where: { id: { equals: parseId(id) } } })
    return (doc as null | ScheduledAction) ?? null
  }

  async function update(id: number | string, data: Partial<ScheduledAction>, req?: PayloadRequest): Promise<void> {
    await payload.db.updateOne({ id: parseId(id), collection, data, req, returning: false })
  }

  async function remove(id: number | string, req?: PayloadRequest): Promise<void> {
    await deleteLogs([id], req)
    await payload.db.deleteOne({ collection, req, where: { id: { equals: parseId(id) } } })
  }

  async function deleteLogs(actionIds: (number | string)[], req?: PayloadRequest): Promise<void> {
    if (!logsSlug || !actionIds.length) {
      return
    }
    await payload.db.deleteMany({ collection: logsSlug, req, where: { action: { in: actionIds.map(parseId) } } })
  }

  async function log(actionId: number | string, lines: LogLine[], req?: PayloadRequest): Promise<void> {
    if (!options.logs || !lines.length) {
      return
    }
    const id = parseId(actionId)
    for (const line of lines) {
      await payload.db.create({
        collection: options.logs.slug,
        data: {
          action: id,
          attempt: line.attempt ?? null,
          durationMs: line.durationMs ?? null,
          event: line.event,
          level: line.level ?? (line.event === 'failed' || line.event === 'timeout' || line.event === 'lost' ? 'error' : 'info'),
          message: truncate(line.message, 500) ?? '',
        },
        req,
      })
    }
    await trimLogs(id, req)
  }

  /** Keeps the newest `perAction` lines. */
  async function trimLogs(actionId: number | string, req?: PayloadRequest): Promise<void> {
    if (!options.logs) {
      return
    }
    const keep = options.logs.perAction
    const { totalDocs } = await payload.db.count({ collection: options.logs.slug, req, where: { action: { equals: actionId } } })
    if (totalDocs <= keep) {
      return
    }
    const stale = await payload.db.find({
      collection: options.logs.slug,
      limit: totalDocs - keep,
      pagination: false,
      req,
      select: { id: true },
      sort: 'createdAt',
      where: { action: { equals: actionId } },
    })
    const ids = stale.docs.map((d) => (d as { id: number | string }).id)
    if (ids.length) {
      await payload.db.deleteMany({ collection: options.logs.slug, req, where: { id: { in: ids } } })
    }
  }

  async function findJob(jobId: null | string | undefined): Promise<null | { hasError?: boolean; id: number | string; processing?: boolean }> {
    if (!jobId) {
      return null
    }
    const id = payload.db.defaultIDType === 'number' && /^\d+$/.test(jobId) ? Number(jobId) : jobId
    const doc = await payload.db.findOne({ collection: 'payload-jobs', where: { id: { equals: id } } })
    return (doc as null | { hasError?: boolean; id: number | string; processing?: boolean }) ?? null
  }

  async function deleteJob(jobId: null | string | undefined): Promise<void> {
    if (!jobId) {
      return
    }
    const id = payload.db.defaultIDType === 'number' && /^\d+$/.test(jobId) ? Number(jobId) : jobId
    try {
      await payload.db.deleteOne({ collection: 'payload-jobs', where: { id: { equals: id } } })
    } catch (error) {
      payload.logger.warn({ err: error, jobId }, '[action-scheduler] could not delete transport job')
    }
  }

  return { collection, deleteJob, deleteLogs, findJob, get, log, logsSlug, parseId, remove, trimLogs, update }
}
