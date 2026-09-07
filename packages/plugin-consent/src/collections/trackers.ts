import type { CollectionConfig } from 'payload'

import { localize } from '../fields.js'
import type { ResolvedConsentPluginOptions } from '../types.js'
import { versionHooks } from '../versions.js'

export function createTrackersCollection(options: ResolvedConsentPluginOptions, localized: boolean): CollectionConfig {
  const { slugs, access, admin } = options
  return {
    slug: slugs.trackers,
    labels: { singular: 'Cookie / script', plural: 'Cookies & scripts' },
    admin: {
      group: admin.group,
      useAsTitle: 'name',
      defaultColumns: ['name', 'category', 'kind', 'enabled', 'updatedAt'],
      description:
        'Every third-party script, pixel, embed or cookie the site uses. Drives the banner, the script gating and the cookie table in your cookie policy.',
    },
    access: { read: () => true, create: access.manage, update: access.manage, delete: access.manage },
    hooks: versionHooks(options),
    fields: [
      ...localize(
        [
          {
            type: 'row',
            fields: [
              { name: 'name', type: 'text', required: true, admin: { width: '50%' } },
              { name: 'vendor', type: 'text', admin: { width: '50%' }, custom: { noLocalize: true } },
            ],
          },
          {
            type: 'row',
            fields: [
              {
                name: 'category',
                type: 'relationship',
                relationTo: slugs.categories,
                required: true,
                admin: { width: '50%' },
              },
              {
                name: 'kind',
                type: 'select',
                required: true,
                defaultValue: 'script',
                options: [
                  { label: 'Script (loaded by the plugin after consent)', value: 'script' },
                  { label: 'Pixel (image/script loaded after consent)', value: 'pixel' },
                  { label: 'Embed / iframe (gated in the page with ConsentGate)', value: 'iframe' },
                  { label: 'SDK (initialised by your own code; asks the store)', value: 'sdk' },
                  { label: 'Cookie only (disclosure, nothing to load)', value: 'cookie-only' },
                ],
                admin: { width: '50%' },
              },
            ],
          },
          { name: 'purpose', type: 'textarea', admin: { description: 'Shown in the preferences dialog and the cookie policy.' } },
          { name: 'vendorPrivacyUrl', type: 'text', custom: { noLocalize: true } },
        ],
        localized,
      ),
      {
        name: 'cookies',
        type: 'array',
        labels: { singular: 'Cookie / storage item', plural: 'Cookies / storage items' },
        admin: { description: 'Disclosure rows for the cookie table.' },
        fields: localize(
          [
            {
              type: 'row',
              fields: [
                { name: 'name', type: 'text', required: true, admin: { width: '40%' }, custom: { noLocalize: true } },
                { name: 'domain', type: 'text', admin: { width: '30%' }, custom: { noLocalize: true } },
                {
                  name: 'storage',
                  type: 'select',
                  defaultValue: 'cookie',
                  options: ['cookie', 'localStorage', 'sessionStorage', 'indexedDB'].map((v) => ({ label: v, value: v })),
                  admin: { width: '30%' },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'durationText', label: 'Duration', type: 'text', admin: { width: '30%', placeholder: '13 months' } },
                { name: 'description', type: 'text', admin: { width: '70%' } },
              ],
            },
          ],
          localized,
        ),
      },
      {
        name: 'loader',
        type: 'group',
        admin: {
          condition: (data) => data?.kind === 'script' || data?.kind === 'pixel',
          description: 'How the plugin loads this tracker once its category is granted.',
        },
        fields: [
          { name: 'src', type: 'text', admin: { description: 'Script URL. Leave empty when using inline code.' } },
          { name: 'inlineCode', type: 'code', admin: { language: 'javascript', description: 'Inline snippet. Executes on your site: admin write access is the trust boundary.' } },
          {
            type: 'row',
            fields: [
              {
                name: 'strategy',
                type: 'select',
                defaultValue: 'afterDecision',
                options: [
                  { label: 'As soon as allowed', value: 'afterDecision' },
                  { label: 'When the browser is idle', value: 'lazy' },
                ],
                admin: { width: '50%' },
              },
              {
                name: 'consentModeManaged',
                type: 'checkbox',
                defaultValue: false,
                admin: {
                  width: '50%',
                  description: 'Google tags only: load immediately and let Consent Mode gate the data instead of withholding the script.',
                },
              },
            ],
          },
          { name: 'attributes', type: 'json', admin: { description: 'Extra script attributes as a JSON object, e.g. {"data-domain":"example.com"}.' } },
        ],
      },
      {
        type: 'row',
        fields: [
          { name: 'enabled', type: 'checkbox', defaultValue: true, admin: { width: '50%' } },
          {
            name: 'environments',
            type: 'select',
            hasMany: true,
            defaultValue: ['development', 'production'],
            options: [
              { label: 'Development', value: 'development' },
              { label: 'Production', value: 'production' },
            ],
            admin: { width: '50%' },
          },
        ],
      },
      { name: 'presetKey', type: 'text', admin: { hidden: true }, index: true },
      ...options.trackerFields,
    ],
  }
}
