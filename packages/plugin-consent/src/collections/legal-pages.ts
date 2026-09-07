import { BlocksFeature, EXPERIMENTAL_TableFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import type { CollectionConfig } from 'payload'

import { CookieTableBlock, PolicyVersionBlock, ProcessorTableBlock } from '../blocks.js'
import { localize } from '../fields.js'
import type { ResolvedConsentPluginOptions } from '../types.js'
import { versionHooks } from '../versions.js'

export const LEGAL_PAGE_KINDS = [
  { label: 'Privacy policy', value: 'privacy' },
  { label: 'Terms of service', value: 'terms' },
  { label: 'Cookie policy', value: 'cookies' },
  { label: 'Sub-processors', value: 'subprocessors' },
  { label: 'Data processing agreement', value: 'dpa' },
  { label: 'Other', value: 'other' },
]

/**
 * Lexical editor for legal pages: the default features plus tables and the
 * cookie-table, processor-table and policy-version blocks.
 *
 * Tables are not in Payload's default feature set, but legal documents are full
 * of them (what we collect, retention periods, sub-processors), and the seeded
 * templates ship GFM pipe tables that would otherwise land as literal text.
 * `EXPERIMENTAL_TableFeature` registers the markdown transformer that turns
 * those into real table nodes, and `@payloadcms/richtext-lexical/react`'s
 * default JSX converters already render them, so hosts get tables for free.
 */
export const legalPagesEditor = (): ReturnType<typeof lexicalEditor> =>
  lexicalEditor({
    features: ({ defaultFeatures }) => [
      ...defaultFeatures,
      EXPERIMENTAL_TableFeature(),
      BlocksFeature({ blocks: [CookieTableBlock, ProcessorTableBlock, PolicyVersionBlock] }),
    ],
  })

export function createLegalPagesCollection(options: ResolvedConsentPluginOptions, localized: boolean): CollectionConfig {
  const { slugs, access, admin } = options
  return {
    slug: slugs.legalPages,
    labels: { singular: 'Legal page', plural: 'Legal pages' },
    admin: {
      group: admin.group,
      useAsTitle: 'title',
      defaultColumns: ['title', 'kind', 'slug', 'effectiveDate', '_status'],
      description:
        'Privacy policy, terms, cookie policy. Publishing a privacy or cookie policy with a new effective date can re-prompt visitors (see Consent settings). Not legal advice: have these reviewed for your jurisdiction.',
    },
    versions: { drafts: true },
    access: { read: () => true, create: access.manage, update: access.manage, delete: access.manage },
    hooks: versionHooks(options),
    fields: [
      ...localize(
        [
          { name: 'title', type: 'text', required: true },
          {
            type: 'row',
            fields: [
              {
                name: 'slug',
                type: 'text',
                required: true,
                unique: true,
                index: true,
                custom: { noLocalize: true },
                admin: { width: '34%', description: 'URL segment, e.g. privacy' },
              },
              { name: 'kind', type: 'select', required: true, defaultValue: 'other', options: LEGAL_PAGE_KINDS, admin: { width: '33%' } },
              { name: 'effectiveDate', type: 'date', required: true, admin: { width: '33%' } },
            ],
          },
          { name: 'showInFooter', type: 'checkbox', defaultValue: true },
          { name: 'content', type: 'richText', required: true, editor: legalPagesEditor() },
        ],
        localized,
      ),
      ...options.legalPageFields,
    ],
  }
}
