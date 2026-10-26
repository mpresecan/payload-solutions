import type { Access, CollectionConfig } from 'payload'

const anyone: Access = () => true
const authenticated: Access = ({ req }) => Boolean(req.user)

/** Site editors. Payload's native auth is enough for the agency site. */
export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: { useAsTitle: 'email', group: 'Admin' },
  access: { read: authenticated, create: authenticated, update: authenticated, delete: authenticated },
  fields: [{ name: 'name', type: 'text' }],
}

export const Media: CollectionConfig = {
  slug: 'media',
  admin: { group: 'Content' },
  access: { read: anyone, create: authenticated, update: authenticated, delete: authenticated },
  upload: { mimeTypes: ['image/*'] },
  fields: [{ name: 'alt', type: 'text', required: true }],
}

const STATUS_OPTIONS = [
  { label: 'Available', value: 'available' },
  { label: 'In progress', value: 'in-progress' },
  { label: 'Planned', value: 'planned' },
] as const

/** Payload Stack, Payload Clock, and whatever ships next. */
export const Products: CollectionConfig = {
  slug: 'products',
  admin: { useAsTitle: 'name', group: 'Catalogue', defaultColumns: ['name', 'status', 'order'] },
  access: { read: anyone, create: authenticated, update: authenticated, delete: authenticated },
  defaultSort: 'order',
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, admin: { position: 'sidebar' } },
    { name: 'tagline', type: 'text', required: true },
    { name: 'description', type: 'textarea', required: true },
    { name: 'status', type: 'select', options: [...STATUS_OPTIONS], defaultValue: 'planned', required: true, admin: { position: 'sidebar' } },
    { name: 'url', type: 'text', admin: { description: 'Product website' } },
    { name: 'docsPath', type: 'text', admin: { description: 'Path under /docs, e.g. /docs/payload-stack' } },
    { name: 'command', type: 'text', admin: { description: 'Install / scaffold command, if any' } },
    { name: 'order', type: 'number', defaultValue: 0, admin: { position: 'sidebar' } },
    {
      name: 'highlights',
      type: 'array',
      fields: [{ name: 'text', type: 'text', required: true }],
    },
  ],
}

/** Payload plugins built for the community. */
export const Plugins: CollectionConfig = {
  slug: 'plugins',
  admin: { useAsTitle: 'name', group: 'Catalogue', defaultColumns: ['name', 'packageName', 'status', 'order'] },
  access: { read: anyone, create: authenticated, update: authenticated, delete: authenticated },
  defaultSort: 'order',
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, admin: { position: 'sidebar' } },
    { name: 'packageName', type: 'text', admin: { description: 'npm package, e.g. @payload-solutions/plugin-emails' } },
    { name: 'summary', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    { name: 'status', type: 'select', options: [...STATUS_OPTIONS], defaultValue: 'planned', required: true, admin: { position: 'sidebar' } },
    { name: 'docsPath', type: 'text' },
    { name: 'repoUrl', type: 'text' },
    { name: 'order', type: 'number', defaultValue: 0, admin: { position: 'sidebar' } },
  ],
}

/** Public roadmap. */
export const RoadmapItems: CollectionConfig = {
  slug: 'roadmap-items',
  labels: { singular: 'Roadmap item', plural: 'Roadmap' },
  admin: { useAsTitle: 'title', group: 'Catalogue', defaultColumns: ['title', 'stage', 'quarter', 'order'] },
  access: { read: anyone, create: authenticated, update: authenticated, delete: authenticated },
  defaultSort: 'order',
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'description', type: 'textarea', required: true },
    {
      name: 'stage',
      type: 'select',
      required: true,
      defaultValue: 'planned',
      options: [
        { label: 'Shipped', value: 'shipped' },
        { label: 'In progress', value: 'in-progress' },
        { label: 'Planned', value: 'planned' },
        { label: 'Exploring', value: 'exploring' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'quarter', type: 'text', admin: { position: 'sidebar', description: 'e.g. Q4 2026' } },
    { name: 'link', type: 'text', admin: { description: 'Issue, PR or docs link' } },
    { name: 'order', type: 'number', defaultValue: 0, admin: { position: 'sidebar' } },
  ],
}

/** Messages from the contact form. Read in the admin; optionally forwarded by email. */
export const ContactSubmissions: CollectionConfig = {
  slug: 'contact-submissions',
  labels: { singular: 'Contact submission', plural: 'Contact submissions' },
  admin: { useAsTitle: 'email', group: 'Inbox', defaultColumns: ['email', 'company', 'topic', 'createdAt'] },
  access: { read: authenticated, create: anyone, update: authenticated, delete: authenticated },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'email', type: 'email', required: true },
    { name: 'company', type: 'text' },
    {
      name: 'topic',
      type: 'select',
      required: true,
      options: [
        { label: 'Build a SaaS on Payload', value: 'saas' },
        { label: 'Payload Stack support', value: 'stack' },
        { label: 'Plugin or integration', value: 'plugin' },
        { label: 'Something else', value: 'other' },
      ],
    },
    { name: 'message', type: 'textarea', required: true },
    { name: 'budget', type: 'text' },
    {
      // Which page the form was sent from (home, a case study), so we can see what converts.
      name: 'source',
      type: 'text',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      // Proof of consent (GDPR Art. 7(1)): when the sender ticked the privacy checkbox, and
      // which version of the privacy policy it pointed to.
      name: 'consentedAt',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'consentPolicyVersion',
      type: 'text',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Replied', value: 'replied' },
        { label: 'Closed', value: 'closed' },
      ],
      admin: { position: 'sidebar' },
      access: { create: () => false },
    },
  ],
}

/**
 * Client work, written up. Published entries render at /case-studies/<slug> and feed the
 * proof section above the contact form on the home page, so every field here exists to move
 * a reader from "who did this" to "start a project": the outcomes row is the scan, the facts
 * column answers "is this like us", the closing prompt is the hand-off to the form.
 *
 * Drafts are on: a write-up can sit unpublished while the client signs it off.
 */
export const CaseStudies: CollectionConfig = {
  slug: 'case-studies',
  labels: { singular: 'Case study', plural: 'Case studies' },
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['title', 'client', 'publishedAt', '_status'],
    preview: (doc) => (doc?.slug ? `/case-studies/${String(doc.slug)}` : null),
  },
  access: {
    read: ({ req }) => (req.user ? true : { _status: { equals: 'published' } }),
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  versions: { drafts: true },
  defaultSort: '-publishedAt',
  fields: [
    { name: 'title', type: 'text', required: true, admin: { description: 'The headline: the outcome, not the client name.' } },
    { name: 'slug', type: 'text', required: true, unique: true, index: true, admin: { position: 'sidebar' } },
    { name: 'client', type: 'text', required: true, admin: { position: 'sidebar' } },
    { name: 'clientUrl', type: 'text', admin: { position: 'sidebar' } },
    { name: 'publishedAt', type: 'date', required: true, admin: { position: 'sidebar' } },
    { name: 'featured', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar', description: 'Shown on the home page above the contact form.' } },
    {
      name: 'summary',
      type: 'textarea',
      required: true,
      admin: { description: 'Two sentences under the headline. Also the meta description and the card text.' },
    },
    {
      type: 'row',
      fields: [
        { name: 'industry', type: 'text', admin: { width: '33%' } },
        { name: 'location', type: 'text', admin: { width: '33%' } },
        { name: 'engagement', type: 'text', admin: { width: '33%', description: 'e.g. Consulting, 3 weeks' } },
      ],
    },
    { name: 'author', type: 'text', defaultValue: 'Michael Presecan' },
    {
      name: 'outcomes',
      type: 'array',
      maxRows: 4,
      admin: { description: 'The numbers a reader scans first. Only figures you can stand behind.' },
      fields: [
        { name: 'value', type: 'text', required: true },
        { name: 'label', type: 'text', required: true },
        { name: 'source', type: 'text', admin: { description: 'Optional: who measured it, shown as a footnote.' } },
      ],
    },
    {
      name: 'builtWith',
      type: 'array',
      fields: [{ name: 'name', type: 'text', required: true }],
    },
    { name: 'content', type: 'richText', required: true },
    {
      name: 'quote',
      type: 'group',
      admin: { description: 'Only a quote the person said or published. Leave empty otherwise.' },
      fields: [
        { name: 'text', type: 'textarea' },
        { name: 'author', type: 'text' },
        { name: 'role', type: 'text' },
        { name: 'sourceUrl', type: 'text' },
      ],
    },
    {
      name: 'cta',
      type: 'group',
      label: 'Closing prompt',
      admin: { description: 'The heading and line above the contact form at the end of the page.' },
      fields: [
        { name: 'title', type: 'text' },
        { name: 'body', type: 'textarea' },
      ],
    },
  ],
}
