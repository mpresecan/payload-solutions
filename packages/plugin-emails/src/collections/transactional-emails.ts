import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { CollectionConfig, Field, Validate } from 'payload'

import { codeOwnedFields } from '../define.js'
import { extractTokens, findTokenProblems, formatTokenProblems } from '../render/interpolate.js'
import { collectNodeStrings, collectTemplateStrings } from '../render/lexical.js'
import { fullManifest } from '../render/render.js'
import type { SanitizedEmailsPluginOptions, TransactionalEmailDoc } from '../types.js'
import { validateInput } from '../validate-input.js'

export const COMPONENT_PREFIX = '@payload-solutions/plugin-emails'

const isAdmin = ({ req }: { req: { user?: unknown } }) => Boolean(req.user)

export function createTransactionalEmailsCollection(
  options: SanitizedEmailsPluginOptions,
  { localized }: { localized: boolean },
): CollectionConfig {
  const { definitions } = options

  const allowedFor = (data: Partial<TransactionalEmailDoc> | undefined): Set<string> => {
    const def = data?.key ? definitions.get(data.key) : undefined
    if (!def) {
      return new Set()
    }
    return new Set(Object.keys(fullManifest(options, def)))
  }

  const validateText: Validate<string | undefined, TransactionalEmailDoc> = (value, { data }) => {
    if (!value) {
      return true
    }
    const allowed = allowedFor(data)
    if (!allowed.size) {
      return true
    }
    const problems = findTokenProblems(value, allowed)
    return problems.length ? formatTokenProblems(problems, allowed) : true
  }

  const validateBody: Validate<SerializedEditorState | undefined, TransactionalEmailDoc> = (value, { data }) => {
    if (!value) {
      return true
    }
    const allowed = allowedFor(data)
    if (!allowed.size) {
      return true
    }
    const problems = collectTemplateStrings(value).flatMap((s) => findTokenProblems(s, allowed))
    if (problems.length) {
      return formatTokenProblems(problems, allowed)
    }
    // A token whose text is broken up by bold/italic never resolves; catch it on save.
    const whole = new Set(collectNodeStrings(value).flatMap((s) => extractTokens(s)))
    const split = collectTemplateStrings(value)
      .flatMap((s) => extractTokens(s))
      .filter((name) => !whole.has(name))
    if (split.length) {
      return `${split.map((n) => `{{${n}}}`).join(', ')} is split by formatting. Retype it so the whole variable has the same styling.`
    }
    return true
  }

  const readOnly = { readOnly: true }

  const recipientList = (
    name: string,
    label: string,
    description?: string,
    condition?: (data: Partial<TransactionalEmailDoc>) => boolean,
  ): Field => ({
    name,
    type: 'array',
    admin: { condition: condition as never, description },
    fields: [{ name: 'email', type: 'email', required: true }],
    label,
  })

  return {
    slug: options.collectionSlug,
    access: {
      create: () => false,
      delete: options.access?.delete ?? isAdmin,
      read: options.access?.read ?? isAdmin,
      update: options.access?.update ?? isAdmin,
    },
    admin: {
      components: {
        views: {
          edit: {
            preview: {
              Component: `${COMPONENT_PREFIX}/rsc#PreviewView`,
              path: '/preview',
              tab: { href: '/preview', label: 'Preview & test', order: 200 },
            },
          },
        },
      },
      defaultColumns: ['label', 'group', 'audience', 'enabled', 'updatedAt'],
      description: 'Subject and body of every automated email. Variables such as {{user.name}} are filled in when the email is sent.',
      group: 'Emails',
      listSearchableFields: ['key', 'label', 'subject'],
      pagination: { defaultLimit: 50 },
      useAsTitle: 'label',
    },
    defaultSort: 'group',
    fields: [
      {
        type: 'tabs',
        tabs: [
          {
            fields: [
              {
                name: 'subject',
                type: 'text',
                localized,
                required: true,
                validate: validateText,
              },
              {
                name: 'preheader',
                type: 'text',
                admin: { description: 'Preview text shown next to the subject in most inboxes.' },
                localized,
                validate: validateText,
              },
              {
                name: 'body',
                type: 'richText',
                editor: options.editor,
                localized,
                required: true,
                validate: validateBody as never,
              },
            ],
            label: 'Content',
          },
          {
            fields: [
              {
                name: 'recipients',
                type: 'group',
                fields: [
                  recipientList(
                    'to',
                    'To',
                    'Recipients of this email. Leave empty to use the defaults from email settings.',
                    (data) => data?.audience !== 'user',
                  ),
                  recipientList('cc', 'Cc'),
                  recipientList('bcc', 'Bcc'),
                  { name: 'replyTo', type: 'email', label: 'Reply-to' },
                ],
                label: false,
              },
            ],
            label: 'Recipients',
          },
          {
            fields: [
              {
                name: 'sampleInput',
                type: 'json',
                admin: {
                  description: 'Input used by the preview and by test sends. Leave empty to use the sample defined in code.',
                },
                label: 'Sample input',
                validate: ((value, { data }) => {
                  if (!value) {
                    return true
                  }
                  const def = data?.key ? definitions.get(data.key) : undefined
                  const errors = validateInput(def?.inputSchema, value)
                  return errors.length ? errors.join('; ') : true
                }) as Validate<unknown, TransactionalEmailDoc>,
              },
            ],
            label: 'Sample data',
          },
        ],
      },
      // --- sidebar -------------------------------------------------------------------------------
      {
        name: 'enabled',
        type: 'checkbox',
        admin: {
          description: 'Required emails (password reset, verification) are always sent and cannot be disabled.',
          position: 'sidebar',
        },
        defaultValue: true,
      },
      {
        name: 'variableChips',
        type: 'ui',
        admin: {
          components: {
            Field: {
              clientProps: { globalManifest: options.globalVariableManifest ?? null },
              path: `${COMPONENT_PREFIX}/client#VariableChips`,
            },
          },
          position: 'sidebar',
        },
      },
      {
        name: 'emailMeta',
        type: 'ui',
        admin: {
          components: { Field: `${COMPONENT_PREFIX}/client#EmailMeta` },
          position: 'sidebar',
        },
      },
      // --- code-owned, read-only ----------------------------------------------------------------
      { name: 'key', type: 'text', admin: { ...readOnly, position: 'sidebar' }, index: true, required: true, unique: true },
      { name: 'label', type: 'text', admin: { ...readOnly, hidden: true } },
      { name: 'description', type: 'textarea', admin: { ...readOnly, hidden: true } },
      { name: 'trigger', type: 'text', admin: { ...readOnly, hidden: true } },
      { name: 'group', type: 'text', admin: { ...readOnly, hidden: true }, index: true },
      {
        name: 'audience',
        type: 'select',
        admin: { ...readOnly, hidden: true },
        options: ['user', 'admin', 'custom'],
      },
      { name: 'required', type: 'checkbox', admin: { ...readOnly, hidden: true } },
      { name: 'inUse', type: 'checkbox', admin: { ...readOnly, hidden: true }, defaultValue: true, index: true },
      { name: 'variables', type: 'json', admin: { ...readOnly, hidden: true } },
      { name: 'definitionHash', type: 'text', admin: { ...readOnly, hidden: true } },
    ],
    hooks: {
      afterRead: [
        ({ doc }) => {
          const def = definitions.get(doc.key)
          if (def) {
            Object.assign(doc, codeOwnedFields(def))
          } else {
            doc.inUse = false
          }
          return doc
        },
      ],
      beforeValidate: [
        ({ data, operation, originalDoc }) => {
          if (!data) {
            return data
          }
          if (operation === 'update' && originalDoc?.key && data.key && data.key !== originalDoc.key) {
            throw new Error('The key of a transactional email cannot be changed; it is defined in code.')
          }
          const key = data.key ?? originalDoc?.key
          const def = key ? definitions.get(key) : undefined
          if (def) {
            Object.assign(data, codeOwnedFields(def))
            if (def.required) {
              data.enabled = true
            }
          }
          return data
        },
      ],
    },
    labels: { plural: 'Transactional Emails', singular: 'Transactional Email' },
    versions: options.versions
      ? { drafts: options.versions.drafts ? { autosave: false } : false, maxPerDoc: 25 }
      : false,
  }
}
