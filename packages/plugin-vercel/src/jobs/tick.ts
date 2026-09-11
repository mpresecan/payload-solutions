import type { TaskConfig } from 'payload'

import type { Ctx } from '../store.js'
import type { SanitizedVercelPluginOptions } from '../types.js'

import { TICK_TASK_SLUG } from '../options.js'
import { tick } from '../deploy/tick.js'

/**
 * `vercel:tick` — a scheduled task with no input, so any job runner (autoRun, `payload jobs:run`, a cron on
 * `/api/payload-jobs/run`, Payload Clock) becomes a runner for automatic deployments. It is deleted on
 * completion like any other successful job.
 */
export function createTickTask(options: SanitizedVercelPluginOptions, getCtx: () => Ctx | undefined): TaskConfig<any> {
  const job = options.tick.job
  return {
    slug: TICK_TASK_SLUG,
    handler: async () => {
      const ctx = getCtx()
      if (!ctx) {
        return { output: { skipped: true } }
      }
      const result = await tick(ctx, 'job')
      return { output: { errors: result.errors.length, refreshed: result.refreshed, triggered: result.triggered.length } }
    },
    label: 'Vercel: check automatic deployments',
    outputSchema: [
      { name: 'triggered', type: 'number' },
      { name: 'refreshed', type: 'number' },
      { name: 'errors', type: 'number' },
      { name: 'skipped', type: 'checkbox' },
    ],
    retries: 0,
    schedule: job ? [{ cron: job.cron, queue: job.queue }] : undefined,
  }
}
