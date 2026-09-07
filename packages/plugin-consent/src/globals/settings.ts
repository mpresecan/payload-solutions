import type { GlobalConfig } from 'payload'

import { DEFAULT_BANNER } from '@payload-solutions/consent-core'

import { localize } from '../fields.js'
import type { ResolvedConsentPluginOptions } from '../types.js'
import { invalidateConfigCache } from '../config-cache.js'

export const MODEL_OPTIONS = [
  { label: 'Opt-in (GDPR style: nothing non-essential until accepted)', value: 'opt-in' },
  { label: 'Opt-out (US style: on by default, "Do not sell or share", GPC honoured)', value: 'opt-out' },
  { label: 'Notice only (informational banner, everything on)', value: 'notice' },
  { label: 'None (no banner, everything on)', value: 'none' },
]

/** The sub-processor notice settings tab, added only when the processor register is on. */
const processorsTab: NonNullable<GlobalConfig['fields'][number] & { type: 'tabs' }>['tabs'][number] = {
  label: 'Processors',
  fields: [
    {
      name: 'processors',
      type: 'group',
      label: false,
      admin: {
        description:
          'Settings for the public sub-processor list. Changing your sub-processors is a notice obligation to your own customers, not a consent event — it never re-prompts visitors.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'noticeDays',
              label: 'Advance notice (days)',
              type: 'number',
              min: 0,
              max: 180,
              defaultValue: 30,
              admin: { width: '30%', description: 'How long before a new sub-processor starts. 30 is the market norm.' },
            },
            {
              name: 'noticeEmail',
              label: 'Objection contact',
              type: 'text',
              admin: { width: '35%', description: 'Where customers object to a new sub-processor.' },
            },
            {
              name: 'subscribeUrl',
              label: 'Change notifications URL',
              type: 'text',
              admin: { width: '35%', description: 'Where customers subscribe to changes, if you offer that.' },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'subprocessorsVersion', type: 'text', admin: { readOnly: true, width: '50%' } },
            { name: 'changedAt', type: 'date', admin: { readOnly: true, width: '50%' } },
          ],
        },
      ],
    },
  ],
}

export function createSettingsGlobal(options: ResolvedConsentPluginOptions, localized: boolean): GlobalConfig {
  const { slugs, access, admin } = options
  return {
    slug: slugs.settings,
    label: 'Consent settings',
    admin: {
      group: admin.group,
      description:
        'Banner behaviour, jurisdictions and recording. Cookie categories and the scripts they gate are managed in their own collections.',
    },
    access: { read: () => true, update: access.manage },
    hooks: {
      afterChange: [
        () => {
          invalidateConfigCache()
        },
      ],
    },
    fields: [
      {
        type: 'tabs',
        tabs: [
          {
            label: 'General',
            fields: [
              {
                name: 'enabled',
                type: 'checkbox',
                defaultValue: true,
                admin: { description: 'Master switch. When off, no banner is shown and only required categories load.' },
              },
              {
                type: 'row',
                fields: [
                  {
                    name: 'reconsentOn',
                    label: 'Ask again when these change',
                    type: 'select',
                    hasMany: true,
                    defaultValue: ['documents', 'categories'],
                    options: [
                      { label: 'Legal documents (new effective date)', value: 'documents' },
                      { label: 'Categories added or changed', value: 'categories' },
                      { label: 'Trackers added or re-categorised', value: 'trackers' },
                    ],
                    admin: { width: '60%' },
                  },
                  {
                    name: 'expiresAfterMonths',
                    label: 'Consent valid for (months)',
                    type: 'number',
                    min: 1,
                    max: 24,
                    defaultValue: 6,
                    admin: { width: '40%', description: 'CNIL recommends 6; most EU regulators accept up to 12–13.' },
                  },
                ],
              },
              {
                name: 'recording',
                type: 'group',
                fields: [
                  {
                    name: 'mode',
                    type: 'select',
                    defaultValue: options.recording.mode,
                    options: [
                      { label: 'None – do not store decisions', value: 'none' },
                      { label: 'Anonymous – random consent id only', value: 'anonymous' },
                      { label: 'Linked – also link to the logged-in user', value: 'linked' },
                    ],
                  },
                  {
                    name: 'retentionMonths',
                    type: 'number',
                    min: 1,
                    defaultValue: options.recording.retentionMonths,
                    admin: { description: 'Records older than this are purged by the consent-purge-records job.' },
                  },
                ],
              },
            ],
          },
          {
            label: 'Jurisdictions',
            fields: [
              {
                name: 'jurisdiction',
                type: 'group',
                fields: [
                  {
                    name: 'resolution',
                    type: 'select',
                    defaultValue: 'header',
                    options: [
                      { label: 'From CDN / host country headers (Cloudflare, Vercel, CloudFront…)', value: 'header' },
                      { label: 'Fixed region for every visitor', value: 'manual' },
                      { label: 'Do not detect – always use the fallback model', value: 'none' },
                    ],
                  },
                  {
                    name: 'fixed',
                    label: 'Fixed country code',
                    type: 'text',
                    admin: { condition: (_, siblingData) => siblingData?.resolution === 'manual', description: 'ISO 3166-1 alpha-2, e.g. DE, or EEA.' },
                  },
                  {
                    name: 'fallback',
                    label: 'Model when the country is unknown',
                    type: 'select',
                    defaultValue: options.jurisdiction.fallback,
                    options: MODEL_OPTIONS,
                  },
                  {
                    name: 'overrides',
                    type: 'array',
                    admin: {
                      description:
                        'Region → model. Regions: country code (DE), EEA, or US-CA style state. Built-in defaults: EEA/GB/CH/BR/CA opt-in, US opt-out.',
                    },
                    fields: [
                      { type: 'row', fields: [
                        { name: 'region', type: 'text', required: true, admin: { width: '40%' } },
                        { name: 'model', type: 'select', required: true, options: MODEL_OPTIONS, admin: { width: '60%' } },
                      ] },
                    ],
                  },
                ],
              },
            ],
          },
          {
            label: 'Banner',
            fields: [
              {
                name: 'banner',
                type: 'group',
                fields: localize(
                  [
                    { name: 'title', type: 'text', defaultValue: DEFAULT_BANNER.title },
                    { name: 'description', type: 'textarea', defaultValue: DEFAULT_BANNER.description },
                    {
                      name: 'position',
                      type: 'select',
                      defaultValue: DEFAULT_BANNER.position,
                      options: ['bottom', 'bottom-left', 'bottom-right', 'center'].map((v) => ({ label: v, value: v })),
                      custom: { noLocalize: true },
                    },
                    {
                      name: 'showRejectAll',
                      type: 'checkbox',
                      defaultValue: true,
                      admin: {
                        description:
                          'Keep on. Under opt-in law, refusing must be as easy as accepting (EDPB Guidelines 05/2020); the banner enforces this for opt-in visitors regardless.',
                      },
                    },
                    {
                      name: 'labels',
                      type: 'group',
                      fields: [
                        { type: 'row', fields: [
                          { name: 'acceptAll', type: 'text', defaultValue: DEFAULT_BANNER.labels.acceptAll },
                          { name: 'rejectAll', type: 'text', defaultValue: DEFAULT_BANNER.labels.rejectAll },
                          { name: 'customize', type: 'text', defaultValue: DEFAULT_BANNER.labels.customize },
                        ] },
                        { type: 'row', fields: [
                          { name: 'save', type: 'text', defaultValue: DEFAULT_BANNER.labels.save },
                          { name: 'close', type: 'text', defaultValue: DEFAULT_BANNER.labels.close },
                          { name: 'manage', type: 'text', defaultValue: DEFAULT_BANNER.labels.manage },
                        ] },
                        { name: 'requiredBadge', type: 'text', defaultValue: DEFAULT_BANNER.labels.requiredBadge },
                        { name: 'reloadNotice', type: 'text', defaultValue: DEFAULT_BANNER.labels.reloadNotice },
                      ],
                    },
                    ...(options.legalPages
                      ? ([
                          { type: 'row', fields: [
                            { name: 'privacyPage', type: 'relationship', relationTo: slugs.legalPages, admin: { width: '50%' } },
                            { name: 'cookiePage', type: 'relationship', relationTo: slugs.legalPages, admin: { width: '50%' } },
                          ] },
                        ] as GlobalConfig['fields'])
                      : ([
                          { type: 'row', fields: [
                            { name: 'privacyUrl', type: 'text', admin: { width: '50%' }, custom: { noLocalize: true } },
                            { name: 'cookieUrl', type: 'text', admin: { width: '50%' }, custom: { noLocalize: true } },
                          ] },
                        ] as GlobalConfig['fields'])),
                  ],
                  localized,
                ),
              },
            ],
          },
          {
            label: 'Google Consent Mode',
            fields: [
              {
                name: 'consentMode',
                type: 'group',
                fields: [
                  {
                    name: 'enabled',
                    type: 'select',
                    defaultValue: 'auto',
                    options: [
                      { label: 'Auto – on when a Consent-Mode-managed tracker exists', value: 'auto' },
                      { label: 'On', value: 'on' },
                      { label: 'Off', value: 'off' },
                    ],
                  },
                  { type: 'row', fields: [
                    { name: 'adsDataRedaction', type: 'checkbox', defaultValue: true, admin: { width: '33%' } },
                    { name: 'urlPassthrough', type: 'checkbox', defaultValue: false, admin: { width: '33%' } },
                    { name: 'waitForUpdateMs', type: 'number', defaultValue: 500, admin: { width: '33%' } },
                  ] },
                ],
              },
            ],
          },
          ...(options.processors ? [processorsTab] : []),
          {
            label: 'Versions',
            fields: [
              {
                name: 'versions',
                type: 'group',
                admin: { description: 'Maintained automatically. A change here re-prompts visitors according to "Ask again when these change".' },
                fields: [
                  { type: 'row', fields: [
                    { name: 'policyVersion', type: 'text', admin: { readOnly: true, width: '25%' } },
                    { name: 'categoriesVersion', type: 'text', admin: { readOnly: true, width: '25%' } },
                    { name: 'trackersVersion', type: 'text', admin: { readOnly: true, width: '25%' } },
                    { name: 'documentsVersion', type: 'text', admin: { readOnly: true, width: '25%' } },
                  ] },
                  { name: 'bumpedAt', type: 'date', admin: { readOnly: true } },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
}
