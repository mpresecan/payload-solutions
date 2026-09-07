import type { CollectionConfig } from 'payload'

import { localize } from '../fields.js'
import type { ResolvedConsentPluginOptions } from '../types.js'
import { subprocessorVersionHooks } from '../versions.js'

export const PROCESSOR_ROLES = [
  { label: 'Processor — acts only on our instructions', value: 'processor' },
  { label: 'Sub-processor — a processor we engage to serve our own customers', value: 'sub-processor' },
  { label: 'Independent controller — decides its own purposes (payments, fraud)', value: 'independent-controller' },
  { label: 'Joint controller — we decide purposes together', value: 'joint-controller' },
]

export const TRANSFER_MECHANISMS = [
  { label: 'No transfer — processed inside our own jurisdiction', value: 'none' },
  { label: 'Adequacy decision', value: 'adequacy' },
  { label: 'EU–US Data Privacy Framework', value: 'dpf' },
  { label: 'Standard Contractual Clauses (+ UK Addendum)', value: 'scc' },
  { label: 'Binding Corporate Rules', value: 'bcr' },
  { label: 'Derogation (Art. 49)', value: 'derogation' },
]

export const DATA_CATEGORIES = [
  { label: 'Account data', value: 'account' },
  { label: 'Contact data', value: 'contact' },
  { label: 'Billing data', value: 'billing' },
  { label: 'Customer content', value: 'content' },
  { label: 'Usage data', value: 'usage' },
  { label: 'Technical data', value: 'technical' },
  { label: 'Support conversations', value: 'support' },
  { label: 'Marketing preferences', value: 'marketing' },
  { label: 'Special category data', value: 'special' },
]

export function createProcessorsCollection(options: ResolvedConsentPluginOptions, localized: boolean): CollectionConfig {
  const { slugs, access, admin } = options
  return {
    slug: slugs.processors,
    labels: { singular: 'Processor', plural: 'Processors' },
    admin: {
      group: admin.group,
      useAsTitle: 'name',
      defaultColumns: ['name', 'role', 'country', 'subprocessor', 'verified', 'status'],
      description:
        'Everyone who receives personal data on our behalf. Feeds the recipients and transfers tables in the privacy policy, the public sub-processor list and the DPA annex. Confirm each row against the contract you actually signed — vendors contract through regional entities and the right one depends on you.',
    },
    defaultSort: 'name',
    access: { read: () => true, create: access.manage, update: access.manage, delete: access.manage },
    hooks: subprocessorVersionHooks(options),
    fields: [
      ...localize(
        [
          {
            type: 'row',
            fields: [
              { name: 'name', type: 'text', required: true, custom: { noLocalize: true }, admin: { width: '50%' } },
              {
                name: 'legalName',
                type: 'text',
                custom: { noLocalize: true },
                admin: { width: '50%', description: 'Contracting entity, e.g. Google Ireland Limited.' },
              },
            ],
          },
          {
            type: 'row',
            fields: [
              { name: 'role', type: 'select', required: true, defaultValue: 'processor', options: PROCESSOR_ROLES, admin: { width: '60%' } },
              {
                name: 'country',
                type: 'text',
                required: true,
                custom: { noLocalize: true },
                admin: { width: '40%', description: 'Where processing happens. ISO code (US, DE) or a region (EEA).' },
              },
            ],
          },
          {
            name: 'purpose',
            type: 'textarea',
            required: true,
            admin: { description: 'What they do for us, in a sentence a visitor can follow. This is the text a regulator reads.' },
          },
        ],
        localized,
      ),
      {
        name: 'dataCategories',
        type: 'select',
        hasMany: true,
        required: true,
        options: DATA_CATEGORIES,
        admin: { description: 'Categories of personal data they receive. Needed for the DPA annex.' },
      },
      {
        name: 'transfer',
        type: 'group',
        label: 'International transfer',
        fields: [
          {
            type: 'row',
            fields: [
              { name: 'mechanism', type: 'select', required: true, defaultValue: 'scc', options: TRANSFER_MECHANISMS, admin: { width: '60%' } },
              {
                name: 'fallback',
                type: 'select',
                options: TRANSFER_MECHANISMS.filter((m) => m.value === 'scc' || m.value === 'bcr'),
                admin: {
                  width: '40%',
                  condition: (_, siblingData) => siblingData?.mechanism === 'dpf' || siblingData?.mechanism === 'adequacy',
                  description: 'What you fall back on if the adequacy decision is struck down.',
                },
              },
            ],
          },
          { name: 'notes', type: 'text', admin: { description: 'Additional safeguards, e.g. encryption at rest, EU-only region.' } },
        ],
      },
      {
        type: 'row',
        fields: [
          { name: 'privacyUrl', type: 'text', custom: { noLocalize: true }, admin: { width: '33%' } },
          { name: 'dpaUrl', label: 'DPA URL', type: 'text', custom: { noLocalize: true }, admin: { width: '33%' } },
          { name: 'subprocessorsUrl', type: 'text', custom: { noLocalize: true }, admin: { width: '34%', description: "Their own sub-processor list." } },
        ],
      },
      {
        type: 'row',
        fields: [
          {
            name: 'subprocessor',
            label: 'Publish as a sub-processor',
            type: 'checkbox',
            defaultValue: true,
            admin: { width: '33%', description: 'Show on the public sub-processor page and in the DPA annex.' },
          },
          {
            name: 'showInPrivacyPolicy',
            type: 'checkbox',
            defaultValue: true,
            admin: { width: '33%', description: 'Show in the recipients and transfers tables.' },
          },
          {
            name: 'verified',
            type: 'checkbox',
            defaultValue: false,
            admin: { width: '34%', description: 'Someone has checked this row against the signed contract.' },
          },
        ],
      },
      {
        type: 'row',
        fields: [
          {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'active',
            options: [
              { label: 'Active', value: 'active' },
              { label: 'Removed', value: 'removed' },
            ],
            admin: { width: '34%', description: 'Removed rows stay on record and appear in the change log.' },
          },
          { name: 'addedAt', type: 'date', admin: { width: '33%', description: 'Announced from this date.' } },
          {
            name: 'removedAt',
            type: 'date',
            admin: { width: '33%', condition: (data) => data?.status === 'removed' },
          },
        ],
      },
      {
        name: 'tracker',
        type: 'relationship',
        relationTo: slugs.trackers,
        admin: { description: 'The browser-side script this vendor is behind, if any.' },
      },
      { name: 'presetKey', type: 'text', admin: { hidden: true }, index: true },
      ...options.processorFields,
    ],
  }
}
