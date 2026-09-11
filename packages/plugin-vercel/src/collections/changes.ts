import type { CollectionConfig, CollectionSlug } from 'payload'

import type { SanitizedVercelPluginOptions } from '../types.js'

import { TITLE_MAX } from '../changes/summary.js'

/**
 * The pending set: one row per (target, document). A document saved twenty times is still one row.
 * Hidden from the admin; read through `GET /api/vercel/changes`.
 */
export function createChangesCollection(
  options: SanitizedVercelPluginOptions,
  ctx: { userSlug: string },
): CollectionConfig {
  return {
    slug: options.slugs.changes as CollectionSlug,
    access: {
      create: () => false,
      delete: () => false,
      read: options.access.read,
      update: () => false,
    },
    admin: { hidden: true },
    fields: [
      { name: 'target', type: 'text', index: true, required: true },
      { name: 'collection', type: 'text', index: true },
      { name: 'global', type: 'text' },
      { name: 'docId', type: 'text' },
      /** `${target}|${collection or global:slug}|${docId}` — the compound uniqueness key. */
      { name: 'key', type: 'text', required: true, unique: true },
      { name: 'title', type: 'text', maxLength: TITLE_MAX, required: true },
      {
        name: 'operation',
        type: 'select',
        options: ['create', 'update', 'publish', 'unpublish', 'delete'].map((v) => ({ label: v, value: v })),
        required: true,
      },
      { name: 'user', type: 'relationship', relationTo: ctx.userSlug as CollectionSlug },
      { name: 'changedAt', type: 'date', index: true, required: true },
      { name: 'saves', type: 'number', defaultValue: 1, required: true },
    ],
    timestamps: true,
  }
}

export function changeKey(target: string, entity: { collection?: null | string; docId?: null | string; global?: null | string }): string {
  if (entity.global) {
    return `${target}|global:${entity.global}|`
  }
  return `${target}|${entity.collection ?? ''}|${entity.docId ?? ''}`
}
