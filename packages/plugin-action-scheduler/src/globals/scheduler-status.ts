import type { GlobalConfig } from 'payload'

import type { SanitizedActionSchedulerOptions } from '../types.js'

export function createStatusGlobal(options: SanitizedActionSchedulerOptions): GlobalConfig {
  return {
    slug: options.statusSlug,
    access: { read: options.access.read, update: () => false },
    admin: { group: options.admin.group, hidden: true },
    fields: [
      { name: 'lastTickAt', type: 'date' },
      { name: 'lastSweepAt', type: 'date' },
      { name: 'lastPurgeAt', type: 'date' },
      { name: 'lastRun', type: 'json' },
      { name: 'runLockToken', type: 'text' },
      { name: 'runLockUntil', type: 'date' },
      { name: 'runLockUser', type: 'text' },
    ],
    lockDocuments: false,
  }
}
