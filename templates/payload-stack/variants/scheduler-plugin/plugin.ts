import { actionScheduler } from '@payload-solutions/plugin-action-scheduler'
import type { Plugin } from 'payload'

import { adminOnly } from '@/access'

import { actions, recurring } from './actions'

/**
 * Scheduled and recurring actions, with the Payload Action Scheduler.
 *
 * `src/payload.config.ts` spreads this array into `plugins`. The plugin adds the
 * `scheduled-actions` ledger, its log collection and a hidden status global, one Payload job per
 * due action, a maintenance tick every minute, and a Scheduled Actions screen in the admin where
 * every action can be watched, run now, rescheduled, retried or cancelled.
 *
 * What can be scheduled is in `src/scheduler/actions`. What *runs* the due actions is in
 * `src/scheduler/jobs.ts` — the plugin never runs anything by itself.
 * Docs: https://payload.solutions/docs/plugins/payload-action-scheduler
 */
export const schedulerPlugins: Plugin[] = [
  actionScheduler({
    actions,
    recurring,

    // Admins only, all four. Arguments are the arguments of real work — an address, an invoice id,
    // a customer name — so the ledger is read like an audit log, not like product data.
    access: {
      create: adminOnly,
      manage: adminOnly,
      read: adminOnly,
      runQueue: adminOnly,
    },

    admin: { group: 'System' },

    // Crons and the timeline are read in UTC, so a deploy in another region does not silently move
    // a nightly sweep. Set your own zone here if the schedules are meant to follow business hours.
    defaultTimezone: 'UTC',

    // Four attempts in all, backing off from 30 s to an hour. Long enough to ride out a provider
    // outage, short enough that a genuinely broken action surfaces the same day.
    defaultRetries: 3,
    defaultBackoff: { type: 'exponential', base: '30s', max: '1h' },
    defaultTimeout: '5m',

    // Finished rows are history, not state: keep a week of successes and a quarter of failures, so
    // "why did this customer never get the reminder?" is answerable long after the fact.
    retention: { canceled: '7d', complete: '7d', failed: '90d' },
  }),
]
