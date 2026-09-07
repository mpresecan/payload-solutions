import type { GlobalConfig } from 'payload'

import type { ResolvedConsentPluginOptions } from '../types.js'

type Tab = NonNullable<GlobalConfig['fields'][number] & { type: 'tabs' }>['tabs'][number]

/**
 * The controller's own compliance profile.
 *
 * `jurisdiction` above describes the *visitor's* law — which model to show whom. This tab
 * describes *your* obligations: who you are, on what basis you process, how long you keep
 * things. The audit's checklists are selected by these answers, and the agent is forbidden
 * from inventing any of them: it asks in the terminal and the answer lands here with the date
 * it was given, so the next run does not ask again and a reviewer can see where it came from.
 */
export function complianceTab(options: ResolvedConsentPluginOptions): Tab {
  return {
    label: 'Compliance profile',
    fields: [
      {
        name: 'compliance',
        type: 'group',
        label: false,
        admin: {
          description:
            'Facts about your organisation that the legal documents depend on. `payload-consent` will not draft a document that relies on an answer nobody has given — it asks instead.',
        },
        fields: [
          {
            type: 'row',
            fields: [
              {
                name: 'legalName',
                type: 'text',
                admin: { width: '50%', description: 'The entity that decides how personal data is used. Art. 13(1)(a).' },
              },
              { name: 'tradingName', type: 'text', admin: { width: '50%', description: 'The name customers know you by, if different.' } },
            ],
          },
          { name: 'address', type: 'textarea', admin: { description: 'Registered postal address. An email address alone does not satisfy Art. 13(1)(a).' } },
          {
            type: 'row',
            fields: [
              { name: 'contactEmail', type: 'text', admin: { width: '34%', description: 'Published privacy contact.' } },
              { name: 'dsrEmail', label: 'Data subject requests', type: 'text', admin: { width: '33%' } },
              { name: 'websiteUrl', type: 'text', admin: { width: '33%' } },
            ],
          },
          {
            type: 'row',
            fields: [
              {
                name: 'establishmentCountry',
                type: 'text',
                admin: { width: '25%', description: 'ISO code. Decides your lead authority.' },
              },
              { name: 'supervisoryAuthority', type: 'text', admin: { width: '35%', description: 'Where a complaint would go. Art. 13(2)(d).' } },
              { name: 'governingLaw', type: 'text', admin: { width: '40%', description: 'Governing law of the terms.' } },
            ],
          },
          {
            name: 'dpo',
            type: 'group',
            label: 'Data Protection Officer',
            admin: { description: 'If one is appointed, the contact details are mandatory. Art. 13(1)(b).' },
            fields: [
              {
                type: 'row',
                fields: [
                  {
                    name: 'required',
                    type: 'select',
                    defaultValue: 'unknown',
                    options: [
                      { label: 'Appointed', value: 'yes' },
                      { label: 'Not appointed', value: 'no' },
                      { label: 'Not decided', value: 'unknown' },
                    ],
                    admin: { width: '34%' },
                  },
                  { name: 'name', type: 'text', admin: { width: '33%', condition: (_, sibling) => sibling?.required === 'yes' } },
                  { name: 'email', type: 'text', admin: { width: '33%', condition: (_, sibling) => sibling?.required === 'yes' } },
                ],
              },
            ],
          },
          {
            type: 'row',
            fields: [
              {
                name: 'audience',
                type: 'select',
                options: [
                  { label: 'Businesses (B2B)', value: 'b2b' },
                  { label: 'Consumers (B2C)', value: 'b2c' },
                  { label: 'Both', value: 'both' },
                ],
                admin: { width: '34%', description: 'Decides whether a DPA and sub-processor notices apply to you.' },
              },
              {
                name: 'role',
                type: 'select',
                options: [
                  { label: 'Controller', value: 'controller' },
                  { label: 'Processor', value: 'processor' },
                  { label: 'Both', value: 'both' },
                ],
                admin: { width: '33%', description: 'For your customers’ data.' },
              },
              {
                name: 'automatedDecisions',
                type: 'select',
                options: [
                  { label: 'None', value: 'none' },
                  { label: 'Profiling', value: 'profiling' },
                  { label: 'Automated decisions with legal effect', value: 'adm' },
                ],
                admin: { width: '33%', description: 'Art. 13(2)(f), Art. 22.' },
              },
            ],
          },
          {
            type: 'row',
            fields: [
              { name: 'offersToEEA', label: 'Offers goods or services in the EEA', type: 'checkbox', defaultValue: true, admin: { width: '30%' } },
              { name: 'offersToUK', type: 'checkbox', defaultValue: false, admin: { width: '30%' } },
              { name: 'usStates', type: 'text', admin: { width: '40%', description: 'US states whose privacy laws you are in scope for, e.g. CA, CO, VA.' } },
            ],
          },
          {
            name: 'legalBases',
            type: 'array',
            labels: { singular: 'Legal basis', plural: 'Legal bases' },
            admin: { description: 'One per purpose. Art. 13(1)(c). Where legitimate interests are relied on, say what the interest is.' },
            fields: [
              {
                type: 'row',
                fields: [
                  { name: 'purpose', type: 'text', admin: { width: '40%' } },
                  {
                    name: 'basis',
                    type: 'select',
                    options: [
                      { label: 'Consent — Art. 6(1)(a)', value: 'consent' },
                      { label: 'Contract — Art. 6(1)(b)', value: 'contract' },
                      { label: 'Legal obligation — Art. 6(1)(c)', value: 'legal-obligation' },
                      { label: 'Vital interests — Art. 6(1)(d)', value: 'vital-interests' },
                      { label: 'Public task — Art. 6(1)(e)', value: 'public-task' },
                      { label: 'Legitimate interests — Art. 6(1)(f)', value: 'legitimate-interests' },
                    ],
                    admin: { width: '30%' },
                  },
                  { name: 'notes', type: 'text', admin: { width: '30%', description: 'The interest relied on, where relevant.' } },
                ],
              },
            ],
          },
          {
            name: 'retention',
            type: 'array',
            admin: { description: 'A period, or the criteria that decide it. Art. 13(2)(a). "As long as necessary" alone does not qualify.' },
            fields: [
              {
                type: 'row',
                fields: [
                  { name: 'purpose', type: 'text', admin: { width: '50%' } },
                  { name: 'period', type: 'text', admin: { width: '50%', placeholder: '24 months after the account closes' } },
                ],
              },
            ],
          },
          {
            name: 'answers',
            type: 'array',
            labels: { singular: 'Recorded answer', plural: 'Recorded answers' },
            admin: {
              description: 'Answers given in the terminal, with who said it and when. The agent reads these instead of asking again.',
              initCollapsed: true,
            },
            fields: [
              {
                type: 'row',
                fields: [
                  { name: 'key', type: 'text', required: true, admin: { width: '30%' } },
                  { name: 'answeredAt', type: 'date', admin: { width: '35%' } },
                  ...(options.usersSlug
                    ? ([{ name: 'answeredByUser', type: 'relationship', relationTo: options.usersSlug, admin: { width: '35%' } }] as Tab['fields'])
                    : []),
                ],
              },
              { name: 'question', type: 'textarea', admin: { readOnly: true } },
              { name: 'answer', type: 'textarea', required: true },
              { name: 'answeredBy', type: 'text', admin: { description: 'Free-text attribution when the answer did not come from a logged-in user.' } },
            ],
          },
          { name: 'confirmedAt', type: 'date', admin: { readOnly: true, description: 'Last time any answer was recorded.' } },
        ],
      },
    ],
  }
}
