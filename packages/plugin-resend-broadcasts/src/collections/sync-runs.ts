import type { CollectionConfig, GlobalConfig } from 'payload'

import type { SanitizedOptions } from '../types.js'

import { createEmailEditor } from '../editor/features.js'

/** One row per resync — what it touched and what went wrong. Written only by the plugin. */
export function createSyncRunsCollection(options: SanitizedOptions): CollectionConfig {
  return {
    slug: options.slugs.syncRuns,
    access: {
      create: () => false,
      delete: ({ req }) => options.access.send({ req }),
      read: ({ req }) => options.access.manage({ req }),
      update: () => false,
    },
    admin: {
      defaultColumns: ['startedAt', 'scope', 'status', 'trigger', 'finishedAt'],
      description:
        'Every reconciliation with Resend: full resyncs, and the ones that fill a list after it is created or refiltered.',
      group: options.adminGroup,
      useAsTitle: 'startedAt',
    },
    fields: [
      {
        name: 'status',
        type: 'select',
        options: ['running', 'finished', 'failed'].map((value) => ({
          label: value[0].toUpperCase() + value.slice(1),
          value,
        })),
        required: true,
      },
      {
        name: 'scope',
        type: 'select',
        options: [
          { label: 'Everything', value: 'all' },
          { label: 'Lists', value: 'list' },
        ],
      },
      { name: 'lists', type: 'text', hasMany: true },
      { name: 'trigger', type: 'text' },
      { name: 'startedAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'finishedAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'stats', type: 'json' },
      { name: 'errors', type: 'json' },
    ],
    labels: { plural: 'Sync runs', singular: 'Sync run' },
  }
}

export function createSettingsGlobal(options: SanitizedOptions): GlobalConfig {
  const canManage = ({
    req,
  }: {
    req: Parameters<SanitizedOptions['access']['manage']>[0]['req']
  }) => options.access.manage({ req })
  return {
    slug: options.slugs.settings,
    access: { read: canManage, update: canManage },
    admin: { group: options.adminGroup },
    fields: [
      {
        type: 'row',
        fields: [
          {
            name: 'from',
            type: 'text',
            admin: {
              description: `"Name <address>" on a domain verified in Resend.${options.from ? ` Empty uses ${options.from}.` : ''}`,
            },
          },
          { name: 'replyTo', type: 'email' },
        ],
      },
      {
        type: 'row',
        fields: [
          {
            name: 'siteName',
            type: 'text',
            admin: {
              description: 'Shown above every campaign by the default template; {{site.name}}.',
            },
          },
          {
            name: 'siteUrl',
            type: 'text',
            admin: { description: '{{site.url}}. Defaults to the server URL.' },
          },
        ],
      },
      {
        name: 'footer',
        type: 'richText',
        admin: {
          description:
            'Under every campaign: who you are and why the reader gets this. The unsubscribe link is added below it automatically.',
        },
        editor: options.editor ?? createEmailEditor({ mediaCollection: options.media?.collection }),
      },
      {
        type: 'row',
        fields: [
          {
            name: 'unsubscribeLabel',
            type: 'text',
            defaultValue: 'Unsubscribe',
            label: 'Unsubscribe link text',
          },
          {
            name: 'testRecipient',
            type: 'email',
            admin: { description: 'Default address for test sends. Empty uses your own.' },
          },
        ],
      },
    ],
    label: 'Newsletter Settings',
  }
}
