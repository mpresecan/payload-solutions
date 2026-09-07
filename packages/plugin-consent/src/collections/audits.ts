import type { CollectionConfig } from 'payload'

import { SEVERITIES } from '../audit/types.js'
import type { ResolvedConsentPluginOptions } from '../types.js'

/**
 * Stored legal audits.
 *
 * The developer reads the report in a terminal; the person who actually fixes "the privacy
 * policy never states a retention period" is usually an editor or a founder who will not open
 * one. So the run is stored here too, and acceptance lives on the finding rather than in a
 * repo file: one source of truth, owned by the person making the decision, and a dated record
 * of accepted risk that is worth more than an ignore list nobody can see.
 *
 * Read access is `manage`, deliberately unlike legal pages, which are public. An audit
 * enumerates what is wrong with your compliance posture; it is not a public document.
 */
export function createAuditsCollection(options: ResolvedConsentPluginOptions): CollectionConfig {
  const { slugs, access, admin } = options
  return {
    slug: slugs.audits,
    labels: { singular: 'Legal audit', plural: 'Legal audits' },
    admin: {
      group: admin.group,
      useAsTitle: 'label',
      defaultColumns: ['label', 'runAt', 'blockers', 'warnings', 'agent'],
      description:
        'Runs of `payload-consent scan` and the agent review that follows it. Findings can be accepted with a reason, which carries forward to later runs.',
      hidden: !options.audits,
    },
    defaultSort: '-runAt',
    // Never public: unlike legal pages, an audit is an inventory of your own gaps.
    access: { read: access.manage, create: access.manage, update: access.manage, delete: access.manage },
    fields: [
      {
        type: 'row',
        fields: [
          { name: 'label', type: 'text', required: true, admin: { width: '50%', description: 'e.g. "scan 2026-09-07"' } },
          { name: 'runAt', type: 'date', required: true, admin: { width: '50%', date: { pickerAppearance: 'dayAndTime' } } },
        ],
      },
      {
        type: 'row',
        fields: [
          {
            name: 'agent',
            type: 'text',
            admin: { width: '34%', description: 'Which agent produced the review, when one did.' },
          },
          { name: 'model', type: 'text', admin: { width: '33%', description: 'Model the agent was running.' } },
          { name: 'toolVersion', type: 'text', admin: { width: '33%', readOnly: true } },
        ],
      },
      {
        type: 'row',
        fields: [
          { name: 'blockers', type: 'number', defaultValue: 0, admin: { width: '25%', readOnly: true } },
          { name: 'warnings', type: 'number', defaultValue: 0, admin: { width: '25%', readOnly: true } },
          { name: 'notices', type: 'number', defaultValue: 0, admin: { width: '25%', readOnly: true } },
          { name: 'accepted', type: 'number', defaultValue: 0, admin: { width: '25%', readOnly: true } },
        ],
      },
      {
        name: 'findings',
        type: 'array',
        labels: { singular: 'Finding', plural: 'Findings' },
        admin: {
          description:
            'Accepting a finding requires a reason. That record is the audit trail: it says who decided this was acceptable, and why.',
          initCollapsed: true,
        },
        fields: [
          {
            type: 'row',
            fields: [
              { name: 'findingId', type: 'text', required: true, index: true, admin: { width: '40%', readOnly: true } },
              { name: 'code', type: 'text', required: true, admin: { width: '35%', readOnly: true } },
              {
                name: 'severity',
                type: 'select',
                required: true,
                options: SEVERITIES.map((value) => ({ label: value, value })),
                admin: { width: '25%', readOnly: true },
              },
            ],
          },
          {
            type: 'row',
            fields: [
              {
                name: 'source',
                type: 'select',
                required: true,
                defaultValue: 'deterministic',
                options: [
                  { label: 'Checked by code', value: 'deterministic' },
                  { label: 'Judged by a model', value: 'inferred' },
                ],
                admin: {
                  width: '40%',
                  readOnly: true,
                  description: 'A model-judged finding always quotes the text it is about.',
                },
              },
              { name: 'locale', type: 'text', admin: { width: '25%', readOnly: true } },
              { name: 'confidence', type: 'number', admin: { width: '35%', readOnly: true } },
            ],
          },
          { name: 'title', type: 'text', required: true, admin: { readOnly: true } },
          { name: 'detail', type: 'textarea', admin: { readOnly: true } },
          { name: 'quote', type: 'textarea', admin: { readOnly: true, description: 'The text the finding is about.' } },
          { name: 'evidence', type: 'textarea', admin: { readOnly: true } },
          { name: 'fix', type: 'textarea', admin: { readOnly: true } },
          ...(options.legalPages
            ? ([{ name: 'page', type: 'relationship', relationTo: slugs.legalPages, admin: { readOnly: true } }] as CollectionConfig['fields'])
            : []),
          {
            type: 'row',
            fields: [
              {
                name: 'status',
                type: 'select',
                required: true,
                defaultValue: 'open',
                options: [
                  { label: 'Open', value: 'open' },
                  { label: 'Accepted — we are living with this', value: 'accepted' },
                  { label: 'Fixed', value: 'fixed' },
                ],
                admin: { width: '40%' },
              },
              { name: 'decidedAt', type: 'date', admin: { width: '30%' } },
              ...(options.usersSlug
                ? ([{ name: 'decidedBy', type: 'relationship', relationTo: options.usersSlug, admin: { width: '30%' } }] as CollectionConfig['fields'])
                : []),
            ],
          },
          {
            name: 'reason',
            type: 'textarea',
            admin: {
              condition: (_, siblingData) => siblingData?.status === 'accepted',
              description: 'Required to accept. This is the record of why the risk was taken.',
            },
            validate: (value: unknown, { siblingData }: { siblingData?: { status?: string } }) => {
              if (siblingData?.status === 'accepted' && !(typeof value === 'string' && value.trim())) {
                return 'Give a reason before accepting a finding — the reason is the point of accepting it here.'
              }
              return true
            },
          },
        ],
      },
      {
        name: 'scope',
        type: 'json',
        admin: { readOnly: true, description: 'What the run looked at: locales, pages, detected vendors, data map.' },
      },
    ],
  }
}
