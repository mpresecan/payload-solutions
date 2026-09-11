import type { CollectionConfig, CollectionSlug } from 'payload'

import type { SanitizedVercelPluginOptions } from '../types.js'

/**
 * Runtime state per target, one row per configured slug (created in onInit). A collection rather than a
 * global so concurrent requests can patch single fields (`dueAt`, `lastTickAt`) without clobbering each other.
 */
export function createTargetsCollection(options: SanitizedVercelPluginOptions): CollectionConfig {
  const states = ['triggered', 'queued', 'building', 'ready', 'error', 'canceled', 'unknown']
  return {
    slug: options.slugs.targets as CollectionSlug,
    access: {
      create: () => false,
      delete: () => false,
      read: options.access.read,
      update: () => false,
    },
    admin: { hidden: true },
    fields: [
      { name: 'slug', type: 'text', required: true, unique: true },
      { name: 'paused', type: 'checkbox', defaultValue: false, required: true },
      { name: 'pendingSince', type: 'date' },
      { name: 'dueAt', type: 'date', index: true },
      { name: 'lastTriggerAt', type: 'date' },
      { name: 'lastTickAt', type: 'date' },
      {
        name: 'lastTickSource',
        type: 'select',
        options: ['heartbeat', 'beacon', 'job', 'endpoint', 'local'].map((v) => ({ label: v, value: v })),
      },
      { name: 'triggerTimes', type: 'json' },
      { name: 'currentDeploymentId', type: 'text' },
      { name: 'currentState', type: 'select', options: states.map((v) => ({ label: v, value: v })) },
      { name: 'currentUrl', type: 'text' },
      { name: 'lastResolvedAt', type: 'date' },
      { name: 'lastExternalScanAt', type: 'date' },
      { name: 'lastRetentionAt', type: 'date' },
      { name: 'lastError', type: 'text', maxLength: 300 },
    ],
    timestamps: true,
  }
}
