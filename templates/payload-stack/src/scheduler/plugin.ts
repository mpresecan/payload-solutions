import type { Plugin } from 'payload'

/**
 * Optional scheduled actions — the branch without the Action Scheduler plugin.
 *
 * `src/payload.config.ts` spreads this array into `plugins`. Here it is empty, so this project has
 * no scheduled-actions ledger, no maintenance tick and no admin view for them: anything that must
 * happen later is up to your own code.
 *
 * Scaffolding with `create-payload-stack --scheduler` replaces this file with the version that
 * registers `@payload-solutions/plugin-action-scheduler` and the actions in `src/scheduler/actions`
 * — trial reminders, dunning follow-ups, invitation expiry and record pruning, each one visible,
 * cancelable and retried from the Payload admin.
 * See https://payload.solutions/docs/plugins/payload-action-scheduler.
 */
export const schedulerPlugins: Plugin[] = []
