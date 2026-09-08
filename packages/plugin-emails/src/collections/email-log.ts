import type { CollectionConfig } from 'payload'

import type { SanitizedEmailsPluginOptions } from '../types.js'

const isAdmin = ({ req }: { req: { user?: unknown } }) => Boolean(req.user)

export function createEmailLogCollection(options: SanitizedEmailsPluginOptions): CollectionConfig {
  const log = options.log ?? { enabled: false }
  return {
    slug: options.logSlug,
    access: {
      create: () => false,
      delete: options.access?.delete ?? isAdmin,
      read: options.access?.read ?? isAdmin,
      update: () => false,
    },
    admin: {
      defaultColumns: ['key', 'to', 'subject', 'status', 'sentAt'],
      description: 'Every send attempt. Rows older than the retention period are purged.',
      group: 'Emails',
      useAsTitle: 'subject',
    },
    defaultSort: '-sentAt',
    fields: [
      { name: 'key', type: 'text', index: true, required: true },
      {
        name: 'status',
        type: 'select',
        index: true,
        options: ['sent', 'failed', 'skipped', 'queued'],
        required: true,
      },
      { name: 'to', type: 'text' },
      { name: 'cc', type: 'text' },
      { name: 'bcc', type: 'text' },
      { name: 'subject', type: 'text' },
      { name: 'reason', type: 'text' },
      { name: 'error', type: 'textarea' },
      { name: 'messageId', type: 'text' },
      { name: 'locale', type: 'text' },
      { name: 'isTest', type: 'checkbox', defaultValue: false },
      { name: 'durationMs', type: 'number' },
      { name: 'sentAt', type: 'date', index: true, required: true },
      ...(log.storeHtml ? [{ name: 'html', type: 'textarea' } as const] : []),
      ...(log.storeVariables ? [{ name: 'variables', type: 'json' } as const] : []),
    ],
    labels: { plural: 'Email Log', singular: 'Email Log Entry' },
  }
}
