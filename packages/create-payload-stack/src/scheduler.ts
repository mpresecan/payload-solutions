import { cp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

import { variantPath } from './variants'

/**
 * The optional Payload Action Scheduler step.
 *
 * Like consent, the seam is a module and not a set of markers: `src/scheduler` exports the same
 * three names in both branches — `schedulerPlugins`, `schedulerJobs`, and the pair of Better Auth
 * wrappers `withStripeEvents` / `withTrialCallbacks` — so `payload.config.ts` and
 * `src/lib/auth/options.ts` are byte-identical whichever answer was given. Without the plugin the
 * array is empty, the jobs config is undefined and the wrappers return their argument.
 *
 * With it, `variants/scheduler-plugin` moves into place: the ledger and its admin screen, the
 * action catalogue in `src/scheduler/actions` (feature-gated the same way the rest of the template
 * is), the recurring series, and a run endpoint locked to a cron secret.
 *
 * The runner is a second question, because "what can be scheduled" and "what actually runs it" are
 * different decisions and only the second one depends on where the project is deployed.
 */

export const SCHEDULER_PACKAGE = '@payload-solutions/plugin-action-scheduler'
/** Pinned, like every other dependency the CLI writes. Bump with the plugin. */
export const SCHEDULER_VERSION = '0.2.0'

const VARIANT_SCHEDULER = variantPath('scheduler-plugin')

/** The seam, swapped whole. Every name here is exported by both branches. */
const SEAM_FILES = ['plugin.ts', 'jobs.ts', 'hooks.ts']

/** What can be scheduled. Only the plugged branch has any of it. */
const ACTION_DIR = 'actions'

export const RUNNER_KEYS = ['clock', 'vercel', 'server', 'later'] as const
export type RunnerKey = (typeof RUNNER_KEYS)[number]

export type RunnerChoice = {
  /** Written into .env so the endpoint accepts the clock that will call it. */
  cronSecret: boolean
  hint: string
  label: string
  /** Lines added to the CLI's closing note. */
  next: () => string[]
  /** Runs the queue inside the Next process. Only ever right on a long-lived server. */
  inProcess: boolean
}

const DOCS = 'https://payload.solutions/docs/payload-stack/scheduling'

/**
 * The alternatives, printed whichever one was picked — a runner is the easiest part of this to
 * change later, and the one most likely to change when the project moves host.
 */
const ALTERNATIVES = [
  '#   - Payload Clock: https://payloadclock.com (free; retries and alerts, works on any host)',
  '#   - Vercel cron: a "crons" entry in vercel.json hitting the same path',
  '#   - Long-lived server: RUN_JOBS_IN_PROCESS=true (never on serverless)',
  '#   - Any cron you already have: curl the endpoint with the CRON_SECRET bearer token',
  '#   - By hand: Scheduled Actions -> Run queue, in the admin',
  `#   ${DOCS}`,
]

export const RUNNER_CHOICES: Record<RunnerKey, RunnerChoice> = {
  clock: {
    label: 'Payload Clock',
    hint: 'free hosted clock, retries and alerts, any host',
    cronSecret: true,
    inProcess: false,
    next: () => [
      '# scheduled actions need a clock. Sign up at https://payloadclock.com (free), point it at',
      '#   POST/GET /api/payload-jobs/run?allQueues=true  with the CRON_SECRET in .env',
      '# or use one of the others:',
      ...ALTERNATIVES.slice(1),
    ],
  },
  vercel: {
    label: 'Vercel cron',
    hint: 'vercel.json; once a minute on Pro, once a day on Hobby',
    cronSecret: true,
    inProcess: false,
    next: () => [
      '# vercel.json runs the queue every minute (Hobby plans get one run a day, which is coarse',
      '#   for a scheduler: https://payloadclock.com is free and runs every minute on any plan)',
      '# add CRON_SECRET from .env to the Vercel project: Vercel sends it as the bearer token',
      ...ALTERNATIVES,
    ],
  },
  server: {
    label: 'This server',
    hint: 'RUN_JOBS_IN_PROCESS=true; docker, Fly, Railway, a VM',
    cronSecret: true,
    inProcess: true,
    next: () => [
      '# RUN_JOBS_IN_PROCESS=true in .env runs the queue in this process, every minute.',
      '#   Never set it on Vercel or another serverless host, and run one instance with it.',
      ...ALTERNATIVES,
    ],
  },
  later: {
    label: 'Decide later',
    hint: 'nothing runs the queue; the admin Run queue button still does',
    cronSecret: false,
    inProcess: false,
    next: () => [
      '# nothing runs the queue yet, so scheduled actions wait. Pick one when you deploy:',
      ...ALTERNATIVES,
    ],
  },
}

/**
 * Dependencies follow the branch. Running this with the other answer replaces the previous one, so
 * the choice is never half-applied.
 *
 * The template carries the plugin as a devDependency purely so `variants/` typechecks inside the
 * monorepo; a scaffolded project either depends on it for real or does not have it at all.
 */
export function swapSchedulerPackages(packageJson: Record<string, unknown>, enabled: boolean) {
  const deps = { ...(packageJson.dependencies as Record<string, string>) }
  const devDeps = { ...(packageJson.devDependencies as Record<string, string>) }

  delete devDeps[SCHEDULER_PACKAGE]
  if (enabled) deps[SCHEDULER_PACKAGE] = SCHEDULER_VERSION
  else delete deps[SCHEDULER_PACKAGE]

  return { ...packageJson, dependencies: sortKeys(deps), devDependencies: sortKeys(devDeps) }
}

function sortKeys<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))) as T
}

/** Moves the chosen branch into `src/scheduler`. The un-plugged branch owns no files elsewhere. */
export async function applySchedulerChoice(directory: string, enabled: boolean) {
  if (!enabled) return

  const variant = path.join(directory, VARIANT_SCHEDULER)
  if (!existsSync(variant)) {
    throw new Error(`The template is missing ${VARIANT_SCHEDULER}; it cannot scaffold with the scheduler.`)
  }

  for (const name of SEAM_FILES) {
    await cp(path.join(variant, name), path.join(directory, 'src/scheduler', name))
  }
  await cp(path.join(variant, ACTION_DIR), path.join(directory, 'src/scheduler', ACTION_DIR), { recursive: true })
  await cp(path.join(variant, 'tests/scheduler.spec.ts'), path.join(directory, 'tests/unit/scheduler.spec.ts'))
}

/**
 * Vercel's cron entry. One call runs the due actions and the maintenance tick, so the schedule is
 * the resolution of the whole scheduler — a minute on Pro, a day on Hobby, which the note explains.
 */
export function renderVercelJson(): string {
  return `${JSON.stringify(
    {
      $schema: 'https://openapi.vercel.sh/vercel.json',
      crons: [{ path: '/api/payload-jobs/run?allQueues=true', schedule: '* * * * *' }],
    },
    null,
    2,
  )}\n`
}
