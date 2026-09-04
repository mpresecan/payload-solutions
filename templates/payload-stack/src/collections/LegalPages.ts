import type { CollectionConfig } from 'payload'

import { adminOnly, anyone } from '@/access'

/**
 * Privacy policy, terms of service, cookie policy and any other legal document.
 * Rendered at /legal/[slug]. Seeded on first boot from src/seed/legal.ts using the company details
 * in stack.config.ts, then editable in the admin like any other content.
 */
export const LegalPages: CollectionConfig = {
  slug: 'legal-pages',
  labels: { singular: 'Legal page', plural: 'Legal pages' },
  access: {
    read: anyone,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  admin: {
    group: 'Content',
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'effectiveDate', 'updatedAt'],
  },
  versions: { drafts: true },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { position: 'sidebar', description: 'URL segment, e.g. privacy' },
    },
    {
      name: 'effectiveDate',
      type: 'date',
      required: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'showInFooter',
      type: 'checkbox',
      defaultValue: true,
      admin: { position: 'sidebar' },
    },
    { name: 'content', type: 'richText', required: true },
  ],
}
