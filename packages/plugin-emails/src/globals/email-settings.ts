import type { GlobalConfig } from 'payload'

import { COMPONENT_PREFIX } from '../collections/transactional-emails.js'
import type { SanitizedEmailsPluginOptions } from '../types.js'

const isAdmin = ({ req }: { req: { user?: unknown } }) => Boolean(req.user)

export function createEmailSettingsGlobal(
  options: SanitizedEmailsPluginOptions,
  { localized }: { localized: boolean },
): GlobalConfig {
  return {
    slug: options.settingsSlug,
    access: { read: options.access?.read ?? isAdmin, update: options.access?.update ?? isAdmin },
    admin: {
      description: 'Applies to every automated email. The design itself comes from the template.',
      group: 'Emails',
    },
    fields: [
      {
        type: 'tabs',
        tabs: [
          {
            description: 'How every automated email is addressed.',
            fields: [
              {
                name: 'from',
                type: 'group',
                admin: { description: 'Defaults to the address configured on the email adapter.' },
                fields: [
                  { name: 'name', type: 'text', label: 'From name' },
                  { name: 'address', type: 'email', label: 'From address' },
                ],
                label: 'Sender',
              },
              { name: 'replyTo', type: 'email', label: 'Reply-to' },
              {
                name: 'adminRecipients',
                type: 'array',
                admin: { description: 'Who receives emails addressed to administrators.' },
                fields: [{ name: 'email', type: 'email', required: true }],
                label: 'Admin recipients',
              },
              {
                name: 'testRecipient',
                type: 'email',
                admin: { description: 'Prefilled in the "Send test" field of every email.' },
                label: 'Test recipient',
              },
            ],
            label: 'Sending',
          },
          {
            description: 'Text that appears in every email. Variables such as {{site.name}} are allowed.',
            fields: [
              {
                name: 'siteName',
                type: 'text',
                admin: { description: 'Available in every email as {{site.name}}.' },
                localized,
              },
              {
                name: 'siteUrl',
                type: 'text',
                admin: { description: 'Available in every email as {{site.url}}. Defaults to the server URL.' },
                label: 'Site URL',
              },
              {
                name: 'footer',
                type: 'richText',
                admin: {
                  description:
                    'Shown under the body of every email — company address, an unsubscribe note, a legal line.',
                },
                editor: options.editor,
                localized,
              },
            ],
            label: 'Content',
          },
          {
            fields: [
              {
                name: 'templatePreview',
                type: 'ui',
                admin: { components: { Field: `${COMPONENT_PREFIX}/client#TemplatePreview` } },
                label: 'Template',
              },
            ],
            label: 'Template',
          },
        ],
      },
    ],
    label: 'Email Settings',
  }
}
