import type { CollectionConfig, CollectionSlug } from 'payload'

import type { ResolvedConsentPluginOptions } from '../types.js'

export function createRecordsCollection(options: ResolvedConsentPluginOptions): CollectionConfig {
  const { slugs, access, admin, usersSlug } = options
  return {
    slug: slugs.records,
    labels: { singular: 'Consent record', plural: 'Consent records' },
    admin: {
      group: admin.group,
      useAsTitle: 'consentId',
      defaultColumns: ['createdAt', 'source', 'country', 'grantedCategories', 'consentId'],
      description: 'Immutable proof of each consent decision. Created only through the consent endpoint; purged after the retention period.',
      hideAPIURL: true,
    },
    // Created by the endpoint with overrideAccess; never editable.
    access: { read: access.manage, create: () => false, update: () => false, delete: () => false },
    timestamps: true,
    fields: [
      { name: 'consentId', type: 'text', required: true, index: true },
      ...(usersSlug
        ? ([{ name: 'user', type: 'relationship', relationTo: usersSlug as CollectionSlug, index: true }] as CollectionConfig['fields'])
        : []),
      { name: 'decisions', type: 'json', required: true },
      { name: 'grantedCategories', type: 'text', hasMany: true, index: true },
      {
        type: 'row',
        fields: [
          { name: 'source', type: 'select', required: true, options: ['banner', 'preferences', 'api', 'gpc', 'withdraw', 'implicit'].map((v) => ({ label: v, value: v })) },
          { name: 'country', type: 'text' },
          { name: 'model', type: 'select', options: ['opt-in', 'opt-out', 'notice', 'none'].map((v) => ({ label: v, value: v })) },
          { name: 'locale', type: 'text' },
        ],
      },
      {
        name: 'versions',
        type: 'group',
        fields: [
          { type: 'row', fields: [
            { name: 'policyVersion', type: 'text' },
            { name: 'categoriesVersion', type: 'text' },
            { name: 'trackersVersion', type: 'text' },
            { name: 'documentsVersion', type: 'text' },
          ] },
        ],
      },
      { name: 'userAgentFamily', type: 'text' },
      { name: 'expiresAt', type: 'date', index: true },
    ],
  }
}
