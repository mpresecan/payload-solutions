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
