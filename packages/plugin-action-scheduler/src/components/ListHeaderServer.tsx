import type { BeforeListTableServerProps } from 'payload'

import React from 'react'

import type { CountsPayload, StatusPayload } from '../endpoints/index.js'

import { ListHeader } from './ListHeader.js'

/**
 * Server component in the `beforeListTable` slot: reads status and counts straight from Payload so
 * the first paint already has them, then hands over to the client component that polls.
 */
export const ListHeaderServer = async (props: BeforeListTableServerProps & { statusSlug?: string; tickEnabled?: boolean }) => {
  const { collectionConfig, payload, statusSlug = 'scheduler-status', tickEnabled = true, user } = props
  const slug = collectionConfig.slug
  const now = new Date()
  const count = (where?: Record<string, unknown>) => payload.db.count({ collection: slug, where: where as never }).then((r) => r.totalDocs)
  const pastDueCutoff = new Date(now.getTime() - 60_000).toISOString()
  const [all, pending, running, pastdue, failed, complete, canceled, nextDue, status] = await Promise.all([
    count(),
    count({ status: { equals: 'pending' } }),
    count({ status: { equals: 'running' } }),
    count({ and: [{ status: { equals: 'pending' } }, { scheduleAt: { less_than: pastDueCutoff } }] }),
    count({ status: { equals: 'failed' } }),
    count({ status: { equals: 'complete' } }),
    count({ status: { equals: 'canceled' } }),
    payload.db.find({ collection: slug, limit: 1, pagination: false, sort: 'scheduleAt', where: { and: [{ status: { equals: 'pending' } }, { scheduleAt: { greater_than: now.toISOString() } }] } }),
    payload.findGlobal({ slug: statusSlug as never, depth: 0, overrideAccess: true }) as Promise<Record<string, unknown>>,
  ])
  const counts: CountsPayload = { all, canceled, complete, failed, pastdue, pending, running }
  const lastTickAt = (status.lastTickAt as null | string | undefined) ?? null
  const warnAfterMs = 5 * 60_000
  const health: StatusPayload['health'] = !tickEnabled ? 'unknown' : !lastTickAt ? 'never' : now.getTime() - new Date(lastTickAt).getTime() > warnAfterMs ? 'stale' : 'healthy'
  const lockUntil = status.runLockUntil as null | string | undefined
  const initialStatus: StatusPayload = {
    health,
    lastRun: (status.lastRun as StatusPayload['lastRun']) ?? null,
    lastTickAt,
    nextDue: (nextDue.docs[0] as { scheduleAt?: string } | undefined)?.scheduleAt ?? null,
    now: now.toISOString(),
    pastDue: pastdue,
    runLock: status.runLockToken && lockUntil && new Date(lockUntil) > now ? { since: '', until: lockUntil, user: (status.runLockUser as null | string) ?? null } : null,
    warnAfterMs,
  }
  void user
  return <ListHeader collectionSlug={slug} initial={{ counts, status: initialStatus }} tickEnabled={tickEnabled} />
}
