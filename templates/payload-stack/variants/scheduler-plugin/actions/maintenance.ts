import { defineAction, SkipAction } from '@payload-solutions/plugin-action-scheduler'
import type { Payload, Where } from 'payload'

/**
 * Housekeeping actions: the sweeps every long-running SaaS eventually needs, with a ledger row and
 * a log for each run instead of a cron script nobody can see.
 *
 * Two of them are armed by the recurring series in `src/scheduler/plugin.ts`. The third —
 * `accounts.purge-unverified` — deletes user records, so it ships registered but unscheduled: run
 * it by hand from Scheduled Actions, or give it a series once you have decided your own policy.
 */

/** Rows deleted per run. A cap keeps one sweep from holding a transaction open for minutes. */
const BATCH = 500

export const pruneAuthRecords = defineAction<Record<string, never>>({
  slug: 'maintenance.prune-auth-records',
  label: 'Prune expired auth records',
  description: 'Deletes expired sessions and spent verification tokens.',
  group: 'maintenance',
  retries: 1,
  timeout: '5m',
  inputSchema: [],
  handler: async ({ log, payload }) => {
    const now = new Date().toISOString()
    const expired: Where = { expiresAt: { less_than: now } }

    const sessions = await deleteWhere(payload, 'sessions', expired)
    const verifications = await deleteWhere(payload, 'verifications', expired)

    log(`Deleted ${sessions} expired sessions and ${verifications} spent verification tokens`)
    if (sessions === 0 && verifications === 0) {
      return { note: 'Nothing expired' }
    }
    return { note: `${sessions} sessions, ${verifications} verifications` }
  },
})

export const expireInvitations = defineAction<Record<string, never>>({
  slug: 'organizations.expire-invitations',
  label: 'Expire stale invitations',
  description: 'Marks pending organization invitations as expired once their deadline passes.',
  group: 'organizations',
  retries: 1,
  timeout: '5m',
  inputSchema: [],
  handler: async ({ log, payload }) => {
    const { docs } = await payload.find({
      collection: 'invitations',
      depth: 0,
      limit: BATCH,
      overrideAccess: true,
      pagination: false,
      where: { and: [{ status: { equals: 'pending' } }, { expiresAt: { less_than: new Date().toISOString() } }] },
    })
    if (docs.length === 0) {
      return { note: 'No invitation has run out' }
    }
    // Better Auth refuses an expired invitation on its own; changing the status is what makes the
    // admin and the member list agree with it, so nobody chases an invitation that cannot be used.
    for (const invitation of docs) {
      await payload.update({
        id: invitation.id,
        collection: 'invitations',
        data: { status: 'expired' },
        overrideAccess: true,
      })
    }
    log(`Expired ${docs.length} invitation${docs.length === 1 ? '' : 's'}`)
    return { note: `${docs.length} expired` }
  },
})

export type PurgeUnverifiedArgs = { olderThanDays: number }

export const purgeUnverified = defineAction<PurgeUnverifiedArgs>({
  slug: 'accounts.purge-unverified',
  label: 'Purge unverified accounts',
  description: 'Deletes accounts that never verified their email address. Destructive: read the note before arming it.',
  group: 'accounts',
  // No retries: a half-finished purge should be inspected, not repeated.
  retries: 0,
  timeout: '5m',
  inputSchema: [
    {
      name: 'olderThanDays',
      type: 'number',
      required: true,
      admin: { description: 'Only accounts created at least this many days ago are deleted.' },
    },
  ],
  handler: async ({ args, log, payload }) => {
    const days = Math.max(1, Math.trunc(args.olderThanDays))
    const before = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const { docs } = await payload.find({
      collection: 'users',
      depth: 0,
      limit: BATCH,
      overrideAccess: true,
      pagination: false,
      // Never an administrator, however old the account: locking yourself out of /admin is not
      // housekeeping. Sign-ups through a social provider arrive verified, so they are never here.
      where: {
        and: [
          { emailVerified: { equals: false } },
          { createdAt: { less_than: before } },
          { or: [{ role: { not_in: ['admin'] } }, { role: { exists: false } }] },
        ],
      },
    })
    if (docs.length === 0) {
      throw new SkipAction(`No unverified account is older than ${days} days`)
    }
    for (const user of docs) {
      await payload.delete({ id: user.id, collection: 'users', overrideAccess: true })
    }
    log(`Deleted ${docs.length} unverified account${docs.length === 1 ? '' : 's'} created before ${before}`, 'warn')
    return { note: `${docs.length} deleted (unverified for ${days}+ days)` }
  },
})

/** Deletes up to `BATCH` matching rows and reports how many went. */
async function deleteWhere(payload: Payload, collection: 'sessions' | 'verifications', where: Where): Promise<number> {
  const { docs } = await payload.find({
    collection,
    depth: 0,
    limit: BATCH,
    overrideAccess: true,
    pagination: false,
    where,
  })
  for (const doc of docs) {
    await payload.delete({ id: doc.id, collection, overrideAccess: true })
  }
  return docs.length
}
