import type { CollectionConfig } from 'payload'

import type { SanitizedActionSchedulerOptions } from '../types.js'

export function createLogsCollection(options: SanitizedActionSchedulerOptions): CollectionConfig {
  if (!options.logs) {
    throw new Error('logs are disabled')
  }
  return {
    slug: options.logs.slug,
    access: {
      create: () => false,
      delete: options.access.manage,
      read: options.access.read,
      update: () => false,
    },
    admin: { group: options.admin.group, hidden: true },
    defaultSort: '-createdAt',
    fields: [
      { name: 'action', type: 'relationship', index: true, relationTo: options.collectionSlug as never, required: true },
      {
        name: 'event',
        type: 'select',
        options: ['scheduled', 'dispatched', 'started', 'completed', 'skipped', 'failed', 'retry', 'timeout', 'lost', 'canceled', 'rescheduled', 'rearmed', 'note'],
        required: true,
      },
      { name: 'level', type: 'select', defaultValue: 'info', options: ['info', 'warn', 'error'], required: true },
      { name: 'message', type: 'text', maxLength: 500, required: true },
      { name: 'attempt', type: 'number' },
      { name: 'durationMs', type: 'number' },
    ],
    lockDocuments: false,
    timestamps: true,
  }
}
