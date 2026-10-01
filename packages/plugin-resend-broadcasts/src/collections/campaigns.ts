import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { CollectionConfig, Field, FieldAccess } from 'payload'

import { APIError, ValidationError } from 'payload'

import type { Runtime } from '../runtime.js'
import type { SanitizedOptions } from '../types.js'

import { LOCKED_STATUSES } from '../campaigns.js'
import { COMPONENT_PREFIX, INTERNAL_WRITE } from '../constants.js'
import { createEmailEditor } from '../editor/features.js'
import { createCampaignEndpoints } from '../endpoints/campaigns.js'
import { extractTokens, findTokenProblems, formatTokenProblems } from '../render/interpolate.js'
import { collectNodeStrings, collectTemplateStrings } from '../render/lexical.js'
import { allowedTokens, getSettings, resolveGlobals } from '../render/render.js'

/** Fields only the plugin writes, as it moves a campaign through Resend. */
const LIFECYCLE_FIELDS = ['status', 'broadcastId', 'scheduledAt', 'sentAt', 'lastError'] as const

/** Copy fields turn read-only in the admin once Resend has the campaign. */
const unlessLocked: FieldAccess = ({ doc }) =>
  !LOCKED_STATUSES.has((doc as { status?: string } | undefined)?.status ?? 'draft')

export function createCampaignsCollection(
  options: SanitizedOptions,
  runtime: Runtime,
): CollectionConfig {
  const canManage: NonNullable<CollectionConfig['access']>['read'] = ({ req }) =>
    options.access.manage({ req })
  const templateNames = Object.keys(options.templates)

  return {
    slug: options.slugs.campaigns,
    access: { create: canManage, delete: canManage, read: canManage, update: canManage },
    admin: {
      components: {
        views: {
          edit: {
            preview: {
              Component: `${COMPONENT_PREFIX}/rsc#CampaignPreviewView`,
              path: '/preview',
              tab: { href: '/preview', label: 'Preview & send', order: 200 },
            },
          },
        },
      },
      defaultColumns: ['name', 'subject', 'list', 'status', 'updatedAt'],
      description:
        'Newsletters sent through Resend Broadcasts. Write the copy here, then open Preview & send to see it as any subscriber, send a test, and send or schedule it.',
      group: options.adminGroup,
      useAsTitle: 'name',
    },
    endpoints: options.disabled ? [] : createCampaignEndpoints(options, runtime),
    fields: lockCopyFields([
      {
        name: 'name',
        type: 'text',
        admin: { description: 'Internal name, also shown on the broadcast in Resend.' },
        required: true,
      },
      {
        name: 'list',
        type: 'relationship',
        admin: {
          description: 'Who receives it: every subscribed contact in this list’s Resend segment.',
        },
        relationTo: options.slugs.lists as never,
        required: true,
      },
      {
        name: 'subject',
        type: 'text',
        admin: {
          description:
            'Values the same for everyone, like {{site.name}}, can be used here. Per-subscriber ones cannot.',
        },
        required: true,
      },
      {
        name: 'previewText',
        type: 'text',
        admin: { description: 'The line inbox lists show after the subject.' },
      },
      {
        name: 'body',
        type: 'richText',
        admin: {
          description:
            'Use {{firstName}}, {{name|there}} and the other variables listed on Preview & send. A fallback after | is used when a subscriber has no value.',
        },
        editor: options.editor ?? createEmailEditor({ mediaCollection: options.media?.collection }),
        required: true,
      },
      ...(templateNames.length > 1
        ? [
            {
              name: 'template',
              type: 'select' as const,
              defaultValue: 'default',
              options: templateNames.map((name) => ({ label: name, value: name })),
            },
          ]
        : []),
      {
        name: 'status',
        type: 'select',
        // Rendered as a status panel with the way to Preview & send; the stored value feeds the list column.
        admin: {
          components: { Field: `${COMPONENT_PREFIX}/client#CampaignStatus` },
          position: 'sidebar',
          readOnly: true,
        },
        defaultValue: 'draft',
        hooks: { beforeDuplicate: [() => 'draft'] },
        index: true,
        options: [
          { label: 'Draft', value: 'draft' },
          { label: 'Scheduled', value: 'scheduled' },
          { label: 'Sending', value: 'sending' },
          { label: 'Sent', value: 'sent' },
          { label: 'Failed', value: 'failed' },
        ],
      },
      {
        name: 'from',
        type: 'text',
        admin: {
          description:
            'Overrides Newsletter Settings, e.g. "Ada from Acme <news@acme.com>". Must be on a domain verified in Resend.',
          position: 'sidebar',
        },
      },
      { name: 'replyTo', type: 'email', admin: { position: 'sidebar' } },
      {
        name: 'scheduledAt',
        type: 'date',
        admin: {
          condition: (data) => Boolean(data?.scheduledAt),
          date: { pickerAppearance: 'dayAndTime' },
          position: 'sidebar',
          readOnly: true,
        },
        hooks: { beforeDuplicate: [() => null] },
      },
      {
        name: 'sentAt',
        type: 'date',
        admin: {
          condition: (data) => Boolean(data?.sentAt),
          date: { pickerAppearance: 'dayAndTime' },
          position: 'sidebar',
          readOnly: true,
        },
        hooks: { beforeDuplicate: [() => null] },
      },
      {
        name: 'broadcastId',
        type: 'text',
        admin: {
          condition: (data) => Boolean(data?.broadcastId),
          position: 'sidebar',
          readOnly: true,
        },
        hooks: { beforeDuplicate: [() => null] },
        label: 'Resend broadcast',
      },
      {
        name: 'lastError',
        type: 'textarea',
        admin: {
          condition: (data) => Boolean(data?.lastError),
          position: 'sidebar',
          readOnly: true,
        },
        hooks: { beforeDuplicate: [() => null] },
      },
    ]),
    hooks: {
      beforeChange: [
        async ({ context, data, operation, originalDoc, req }) => {
          if (context[INTERNAL_WRITE]) {
            return data
          }
          for (const key of LIFECYCLE_FIELDS) {
            if (operation === 'update') {
              data[key] = originalDoc?.[key]
            } else {
              data[key] = key === 'status' ? 'draft' : null
            }
          }
          if (operation === 'update' && LOCKED_STATUSES.has(originalDoc?.status)) {
            throw new APIError(
              originalDoc?.status === 'scheduled'
                ? 'This campaign is scheduled. Cancel the send on Preview & send before editing it.'
                : 'This campaign has already been sent. Duplicate it to reuse the copy.',
              409,
              undefined,
              true,
            )
          }

          const settings = await getSettings(req.payload, options, req)
          const globals = await resolveGlobals(req.payload, options, settings)
          const allowed = allowedTokens(options, globals)
          const errors: Array<{ message: string; path: string }> = []
          for (const path of ['subject', 'previewText'] as const) {
            const problems = findTokenProblems(String(data[path] ?? ''), allowed.everyone)
            if (problems.length) {
              errors.push({ message: formatTokenProblems(problems, allowed.everyone), path })
            }
          }
          const body = data.body as SerializedEditorState | undefined
          const joined = collectTemplateStrings(body).join('\n')
          const bodyProblems = findTokenProblems(joined, allowed.body)
          const runTokens = extractTokens(collectNodeStrings(body).join('\n'))
          const split = [...extractTokens(joined).keys()].some((name) => !runTokens.has(name))
          if (bodyProblems.length || split) {
            errors.push({
              message: split
                ? 'A variable is split by formatting (part of it bold or linked). Select the whole {{ … }} and format it as one piece.'
                : formatTokenProblems(bodyProblems, allowed.body),
              path: 'body',
            })
          }
          if (errors.length) {
            throw new ValidationError({ collection: options.slugs.campaigns, errors, req })
          }
          return data
        },
      ],
    },
    labels: { plural: 'Campaigns', singular: 'Campaign' },
  }
}

const COPY_FIELDS = new Set([
  'body',
  'from',
  'list',
  'name',
  'previewText',
  'replyTo',
  'subject',
  'template',
])

function lockCopyFields(fields: Field[]): Field[] {
  return fields.map((field) =>
    'name' in field && COPY_FIELDS.has(field.name) && field.type !== 'ui'
      ? ({ ...field, access: { ...field.access, update: unlessLocked } } as Field)
      : field,
  )
}
