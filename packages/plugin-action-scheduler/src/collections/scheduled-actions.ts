import type { CollectionConfig, Field } from 'payload'

import { APIError } from 'payload'

import type { SanitizedActionSchedulerOptions } from '../types.js'

import { COMPONENT_PREFIX } from '../types.js'

export const INTERNAL_CONTEXT = 'plugin-action-scheduler'

/** True when the write comes from the plugin itself (API, engine, maintenance) rather than the admin or host code. */
export function isInternal(context: Record<string, unknown> | undefined): boolean {
  return Boolean(context && context[INTERNAL_CONTEXT])
}

const sidebar = { position: 'sidebar' as const }
const readOnly = { readOnly: true }

/**
 * Hooks that run when a document is created or edited from the admin (or by host code through
 * `payload.create`) are attached by the plugin (`plugin.ts`) once the API exists; this file only
 * describes the schema.
 */
export function createScheduledActionsCollection(options: SanitizedActionSchedulerOptions): CollectionConfig {
  const hooks = [...options.definitions.keys()].sort()
  const client = (name: string) => `${COMPONENT_PREFIX}/client#${name}`
  const TERMINAL = new Set(['complete', 'failed', 'canceled'])

  const fields: Field[] = [
    {
      name: 'timeline',
      type: 'ui',
      admin: {
        components: { Field: client('ActionTimelineField') },
        disableListColumn: true,
      },
    },
    {
      name: 'hook',
      type: 'text',
      admin: {
        components: { Cell: client('ActionCell') },
        description: hooks.length ? `Registered actions: ${hooks.join(', ')}` : 'No actions are registered in code yet.',
      },
      index: true,
      label: 'Action',
      required: true,
      validate: (value: null | string | undefined) => {
        if (!value) {
          return 'Pick an action'
        }
        return options.definitions.has(value) || `"${value}" is not registered in code`
      },
    },
    {
      name: 'status',
      type: 'select',
      admin: { ...sidebar, components: { Cell: client('StatusCell') } },
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Running', value: 'running' },
        { label: 'Completed', value: 'complete' },
        { label: 'Failed', value: 'failed' },
        { label: 'Canceled', value: 'canceled' },
      ],
      required: true,
    },
    {
      name: 'repeat',
      type: 'select',
      admin: { components: { Cell: client('ScheduleCell') } },
      defaultValue: 'once',
      index: true,
      label: 'Schedule',
      options: [
        { label: 'Once', value: 'once' },
        { label: 'Every interval', value: 'interval' },
        { label: 'Cron', value: 'cron' },
      ],
      required: true,
    },
    {
      name: 'interval',
      type: 'number',
      admin: {
        condition: (data) => data?.repeat === 'interval',
        description: 'Seconds between occurrences.',
        disableListColumn: true,
      },
      min: 1,
    },
    {
      name: 'cron',
      type: 'text',
      admin: {
        condition: (data) => data?.repeat === 'cron',
        components: { Field: client('CronField') },
        description: 'Five fields: minute hour day-of-month month day-of-week.',
        disableListColumn: true,
      },
    },
    {
      name: 'tz',
      type: 'text',
      admin: {
        condition: (data) => data?.repeat === 'cron',
        description: `IANA time zone the cron expression is evaluated in. Default ${options.defaultTimezone}.`,
        disableListColumn: true,
      },
      label: 'Time zone',
    },
    {
      name: 'scheduleAt',
      type: 'date',
      admin: {
        components: { Cell: client('WhenCell') },
        date: { pickerAppearance: 'dayAndTime' },
        description: 'When the next occurrence is due. Leave empty to run as soon as possible.',
      },
      index: true,
      label: 'Next / When',
    },
    {
      name: 'args',
      type: 'json',
      admin: {
        components: { Cell: client('ArgsCell') },
        description: `Plain JSON, at most ${options.maxArgsBytes} bytes. Pass ids, not documents.`,
      },
      label: 'Arguments',
    },
    {
      name: 'attempts',
      type: 'number',
      admin: { ...readOnly, components: { Cell: client('AttemptsCell') } },
      defaultValue: 0,
    },
    {
      name: 'lastOutcome',
      type: 'select',
      admin: { ...readOnly, components: { Cell: client('LastResultCell') } },
      label: 'Last result',
      options: ['completed', 'failed', 'timeout', 'lost', 'skipped'],
    },
    {
      name: 'actions',
      type: 'ui',
      admin: {
        components: { Cell: client('RowActionsCell'), Field: client('DocumentActionsField') },
      },
      label: ' ',
    },
    { name: 'group', type: 'text', admin: sidebar, defaultValue: 'default', index: true },
    {
      name: 'priority',
      type: 'number',
      admin: { ...sidebar, description: '0–255, lower runs first.' },
      defaultValue: 10,
      max: 255,
      min: 0,
    },
    { name: 'queue', type: 'text', admin: { ...sidebar, description: 'Payload job queue.' }, defaultValue: 'default' },
    {
      name: 'unique',
      type: 'checkbox',
      admin: { ...sidebar, description: 'Skip when an identical pending or running action exists.' },
      defaultValue: false,
    },
    { name: 'argsHash', type: 'text', admin: { ...readOnly, hidden: true }, index: true },
    { name: 'uniqueKey', type: 'text', admin: { ...readOnly, hidden: true }, unique: true },
    { name: 'seriesKey', type: 'text', admin: { ...readOnly, ...sidebar, condition: (data) => Boolean(data?.seriesKey) }, index: true, label: 'Code series' },
    { name: 'maxAttempts', type: 'number', admin: { ...readOnly, ...sidebar }, defaultValue: options.defaultRetries + 1 },
    { name: 'runCount', type: 'number', admin: { ...readOnly, ...sidebar, condition: (data) => data?.repeat !== 'once' }, defaultValue: 0, label: 'Runs' },
    { name: 'consecutiveFailures', type: 'number', admin: { ...readOnly, hidden: true }, defaultValue: 0 },
    { name: 'lastAttemptAt', type: 'date', admin: { ...readOnly, ...sidebar }, index: true },
    { name: 'completedAt', type: 'date', admin: { ...readOnly, ...sidebar }, index: true },
    { name: 'lastDurationMs', type: 'number', admin: { ...readOnly, ...sidebar }, label: 'Last duration (ms)' },
    {
      name: 'failureReason',
      type: 'select',
      admin: { ...readOnly, ...sidebar, condition: (data) => data?.status === 'failed' },
      options: ['error', 'timeout', 'lost', 'permanent', 'handler-missing', 'args-invalid'],
    },
    { name: 'errorMessage', type: 'text', admin: { ...readOnly, condition: (data) => Boolean(data?.errorMessage) }, label: 'Last error' },
    { name: 'errorStack', type: 'textarea', admin: { ...readOnly, condition: (data) => Boolean(data?.errorStack) }, label: 'Stack' },
    { name: 'note', type: 'text', admin: { ...readOnly, condition: (data) => Boolean(data?.note) } },
    { name: 'claimToken', type: 'text', admin: { ...readOnly, hidden: true } },
    { name: 'claimedUntil', type: 'date', admin: { ...readOnly, hidden: true }, index: true },
    { name: 'jobId', type: 'text', admin: { ...readOnly, hidden: true } },
    { name: 'stopAfterCurrent', type: 'checkbox', admin: { ...readOnly, hidden: true }, defaultValue: false },
    {
      name: 'source',
      type: 'select',
      admin: { ...readOnly, ...sidebar },
      defaultValue: 'code',
      options: ['code', 'admin', 'series'],
    },
    { name: 'createdBy', type: 'text', admin: { ...readOnly, ...sidebar, condition: (data) => Boolean(data?.createdBy) } },
  ]

  if (options.logs) {
    fields.push({
      name: 'logs',
      type: 'join',
      admin: { disableListColumn: true, hidden: true },
      collection: options.logs.slug as never,
      on: 'action',
    })
  }

  return {
    slug: options.collectionSlug,
    access: {
      create: options.access.create,
      delete: async (args) => {
        const allowed = await options.access.manage(args)
        if (!allowed) {
          return false
        }
        // Deleting a pending or running row would orphan its transport job; the admin removes those through Cancel.
        return { status: { in: ['complete', 'failed', 'canceled'] } }
      },
      read: options.access.read,
      update: options.access.manage,
    },
    admin: {
      components: {
        beforeListTable: [`${COMPONENT_PREFIX}/rsc#ListHeader`],
        listMenuItems: [`${COMPONENT_PREFIX}/client#BulkActions`],
      },
      defaultColumns: ['hook', 'status', 'repeat', 'scheduleAt', 'attempts', 'lastOutcome', 'args', 'actions'],
      description: 'Deferred and recurring work, executed by the Payload job queue.',
      group: options.admin.group,
      hidden: options.admin.hidden,
      listSearchableFields: ['hook', 'group'],
      pagination: { defaultLimit: 25 },
      useAsTitle: 'hook',
    },
    defaultSort: '-updatedAt',
    disableBulkEdit: true,
    fields,
    hooks: {
      beforeChange: [
        ({ context, data, operation, originalDoc }) => {
          if (isInternal(context) || operation !== 'update') {
            return data
          }
          if (originalDoc && TERMINAL.has(originalDoc.status)) {
            throw new APIError('Finished actions are read-only. Duplicate it to schedule it again.', 400)
          }
          if (originalDoc && originalDoc.status === 'running') {
            throw new APIError('This action is running; wait for it to finish.', 400)
          }
          return data
        },
      ],
    },
    indexes: [
      { fields: ['status', 'scheduleAt'] },
      { fields: ['hook', 'argsHash', 'status'] },
      { fields: ['group', 'status'] },
      { fields: ['status', 'claimedUntil'] },
    ],
    lockDocuments: false,
    timestamps: true,
  }
}
