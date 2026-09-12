import type { Config } from 'payload'

/**
 * Job queue configuration — the branch without the Action Scheduler plugin.
 *
 * Nothing in this project queues Payload jobs yet, so `buildConfig` keeps its defaults: the
 * `payload-jobs` collection exists, but no runner is wired and `/api/payload-jobs/run` follows
 * Payload's own rule that any logged-in user may run jobs.
 *
 * Scaffolding with `create-payload-stack --scheduler` replaces this file with the version that
 * locks that endpoint to a cron secret so an external clock can call it, and optionally runs the
 * queue in process. See https://payload.solutions/docs/payload-stack/scheduling.
 */
export const schedulerJobs: Config['jobs'] = undefined
