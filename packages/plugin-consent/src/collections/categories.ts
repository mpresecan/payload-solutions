import type { CollectionConfig } from 'payload'

import { ALL_CONSENT_MODE_SIGNALS } from '@payload-solutions/consent-core'

import { localize, validateKey } from '../fields.js'
import type { ResolvedConsentPluginOptions } from '../types.js'
import { versionHooks } from '../versions.js'

export function createCategoriesCollection(options: ResolvedConsentPluginOptions, localized: boolean): CollectionConfig {
  const { slugs, access, admin } = options
  return {
    slug: slugs.categories,
    labels: { singular: 'Cookie category', plural: 'Cookie categories' },
    admin: {
      group: admin.group,
      useAsTitle: 'label',
      defaultColumns: ['label', 'key', 'required', 'order'],
      description: 'The choices visitors see in the banner. Every tracker belongs to exactly one category.',
    },
    defaultSort: 'order',
    access: { read: () => true, create: access.manage, update: access.manage, delete: access.manage },
    hooks: {
      ...versionHooks(options),
      beforeDelete: [
        async ({ id, req }) => {
          const inUse = await req.payload.count({
            collection: slugs.trackers,
            where: { category: { equals: id } },
            req,
            overrideAccess: true,
          })
          if (inUse.totalDocs > 0) {
            throw new Error(`This category is used by ${inUse.totalDocs} tracker(s). Re-assign them before deleting it.`)
          }
        },
      ],
    },
    fields: localize(
      [
        {
          type: 'row',
          fields: [
            {
              name: 'key',
              type: 'text',
              required: true,
              unique: true,
              index: true,
              validate: validateKey,
              custom: { noLocalize: true },
              admin: { width: '50%', description: 'Stable id used in the cookie and in code, e.g. analytics.' },
            },
            { name: 'order', type: 'number', defaultValue: 0, admin: { width: '50%' } },
          ],
        },
        { name: 'label', type: 'text', required: true },
        { name: 'description', type: 'textarea', required: true },
        {
          type: 'row',
          fields: [
            {
              name: 'required',
              type: 'checkbox',
              defaultValue: false,
              admin: { width: '33%', description: 'Always on; cannot be refused. Typically only "necessary".' },
            },
            {
              name: 'respectGPC',
              type: 'checkbox',
              defaultValue: true,
              admin: { width: '33%', description: 'Under opt-out law, a Global Privacy Control signal switches this category off.' },
            },
            {
              name: 'defaultInOptOut',
              type: 'checkbox',
              defaultValue: true,
              admin: { width: '33%', description: 'Granted by default for opt-out jurisdictions.' },
            },
          ],
        },
        {
          name: 'consentModeSignals',
          type: 'select',
          hasMany: true,
          options: ALL_CONSENT_MODE_SIGNALS.map((s) => ({ label: s, value: s })),
          admin: { description: 'Google Consent Mode v2 signals granted when this category is granted.' },
        },
      ],
      localized,
    ),
  }
}
