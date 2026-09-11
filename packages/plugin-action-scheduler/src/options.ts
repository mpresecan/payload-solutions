import type { ActionSchedulerOptions, Duration, SanitizedActionSchedulerOptions } from './types.js'

import { validateDefinition } from './define.js'
import { durationToMs } from './utils/duration.js'
import { validateCron } from './utils/recurrence.js'

const authenticated = ({ req }: { req: { user?: unknown } }) => Boolean(req.user)

function retention(value: Duration | false | undefined, fallback: Duration): false | number {
  if (value === false) {
    return false
  }
  return durationToMs(value ?? fallback, 'retention')
}

export function sanitizeOptions(options: ActionSchedulerOptions): SanitizedActionSchedulerOptions {
  if (!options || !Array.isArray(options.actions)) {
    throw new Error('actionScheduler({ actions }) requires an array of defineAction() results')
  }
  const definitions = new Map<string, ActionSchedulerOptions['actions'][number]>()
  for (const definition of options.actions) {
    validateDefinition(definition)
    if (definitions.has(definition.slug)) {
      throw new Error(`Action "${definition.slug}" is registered twice`)
    }
    definitions.set(definition.slug, definition)
  }
  const recurring = options.recurring ?? []
  const keys = new Set<string>()
  for (const series of recurring) {
    if (!series.key || keys.has(series.key)) {
      throw new Error(`Recurring series need a unique key (duplicate or missing: "${series.key}")`)
    }
    keys.add(series.key)
    if (!definitions.has(series.hook)) {
      throw new Error(`Recurring series "${series.key}" refers to unknown action "${series.hook}"`)
    }
    if (!series.cron && series.every === undefined) {
      throw new Error(`Recurring series "${series.key}" needs either "every" or "cron"`)
    }
    if (series.cron) {
      validateCron(series.cron, series.tz ?? options.defaultTimezone ?? 'UTC')
    } else {
      durationToMs(series.every!, `"every" of series "${series.key}"`)
    }
  }
  const logsSlug = options.logs === false ? null : (options.logs?.slug ?? 'scheduled-action-logs')
  return {
    access: {
      create: options.access?.create ?? options.access?.manage ?? authenticated,
      manage: options.access?.manage ?? authenticated,
      read: options.access?.read ?? authenticated,
      runQueue: options.access?.runQueue ?? options.access?.manage ?? authenticated,
    },
    admin: {
      dashboardWidget: options.admin?.dashboardWidget ?? false,
      group: options.admin?.group ?? 'System',
      hidden: options.admin?.hidden ?? false,
    },
    collectionSlug: options.collectionSlug ?? 'scheduled-actions',
    defaultBackoff: options.defaultBackoff ?? { type: 'exponential', base: '30s', max: '1h' },
    defaultRetries: options.defaultRetries ?? 3,
    defaultTimeoutMs: durationToMs(options.defaultTimeout ?? '5m', 'defaultTimeout'),
    defaultTimezone: options.defaultTimezone ?? 'UTC',
    definitions,
    disabled: options.disabled ?? false,
    dispatchHorizonMs: options.tick === false ? Number.POSITIVE_INFINITY : durationToMs(options.dispatchHorizon ?? '15m', 'dispatchHorizon'),
    logs: logsSlug ? { perAction: (options.logs && options.logs.perAction) || 50, slug: logsSlug } : false,
    logsSlug,
    maxArgsBytes: options.maxArgsBytes ?? 8192,
    recurring,
    redactError: options.redactError,
    retentionMs: {
      canceled: retention(options.retention?.canceled, '7d'),
      complete: retention(options.retention?.complete, '7d'),
      failed: retention(options.retention?.failed, '90d'),
    },
    runner: {
      runQueueLimit: options.runner?.runQueueLimit ?? 25,
      runQueueMaxDurationMs: durationToMs(options.runner?.runQueueMaxDuration ?? '20s', 'runQueueMaxDuration'),
      warnAfterMs: durationToMs(options.runner?.warnAfter ?? '5m', 'runner.warnAfter'),
    },
    statusSlug: options.statusSlug ?? 'scheduler-status',
    tick: options.tick === false ? false : { cron: options.tick?.cron ?? '* * * * *', queue: options.tick?.queue ?? 'default' },
  }
}
