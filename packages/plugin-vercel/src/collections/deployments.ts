import type { CollectionConfig, CollectionSlug } from 'payload'

import type { SanitizedVercelPluginOptions } from '../types.js'

import { COMPONENT_PREFIX } from '../constants.js'

const readOnly = { readOnly: true } as const

/** The ledger: one row per trigger (or per deployment seen on Vercel). Written only by the plugin. */
export function createDeploymentsCollection(
  options: SanitizedVercelPluginOptions,
  ctx: { userSlug: string },
): CollectionConfig {
  const targetOptions = options.targets.map((t) => ({ label: t.label, value: t.slug }))
  return {
    slug: options.slugs.deployments as CollectionSlug,
    access: {
      create: () => false,
      delete: options.access.rollback,
      read: options.access.read,
      update: () => false,
    },
    admin: {
      defaultColumns: ['target', 'createdAt', 'cause', 'triggeredBy', 'state', 'durationMs', 'changeCount', 'deploymentUrl'],
      description: 'Every deployment the plugin triggered or saw on Vercel. Rows are written by the plugin only.',
      group: options.admin.group,
      hidden: false,
      listSearchableFields: ['reason', 'deploymentId', 'deploymentUrl'],
      pagination: { defaultLimit: 25 },
      useAsTitle: 'deploymentId',
    },
    fields: [
      {
        name: 'target',
        type: 'select',
        admin: readOnly,
        index: true,
        options: targetOptions,
        required: true,
      },
      {
        name: 'cause',
        type: 'select',
        admin: readOnly,
        index: true,
        options: [
          { label: 'Manual', value: 'manual' },
          { label: 'Automatic', value: 'auto' },
          { label: 'API', value: 'api' },
          { label: 'Rollback', value: 'rollback' },
          { label: 'External', value: 'external' },
        ],
        required: true,
      },
      {
        name: 'state',
        type: 'select',
        admin: { ...readOnly, components: { Cell: `${COMPONENT_PREFIX}/client#StateCell` } },
        index: true,
        options: [
          { label: 'Triggered', value: 'triggered' },
          { label: 'Queued', value: 'queued' },
          { label: 'Building', value: 'building' },
          { label: 'Ready', value: 'ready' },
          { label: 'Error', value: 'error' },
          { label: 'Canceled', value: 'canceled' },
          { label: 'Unknown', value: 'unknown' },
        ],
        required: true,
      },
      {
        name: 'triggeredBy',
        type: 'relationship',
        admin: readOnly,
        relationTo: ctx.userSlug as CollectionSlug,
      },
      { name: 'reason', type: 'text', admin: readOnly, maxLength: 200 },
      { name: 'dedupeKey', type: 'text', admin: { ...readOnly, hidden: true }, required: true, unique: true },
      { name: 'hookJobId', type: 'text', admin: { ...readOnly, hidden: true } },
      { name: 'hookCalledAt', type: 'date', admin: { ...readOnly, hidden: true } },
      { name: 'deploymentId', type: 'text', admin: readOnly, index: true },
      { name: 'deploymentUrl', type: 'text', admin: readOnly },
      { name: 'inspectorUrl', type: 'text', admin: readOnly },
      {
        name: 'environment',
        type: 'select',
        admin: readOnly,
        options: [
          { label: 'Production', value: 'production' },
          { label: 'Preview', value: 'preview' },
        ],
      },
      { name: 'readySubstate', type: 'text', admin: { ...readOnly, hidden: true } },
      { name: 'errorCode', type: 'text', admin: readOnly, maxLength: 64 },
      { name: 'errorMessage', type: 'text', admin: readOnly, maxLength: 500 },
      { name: 'vercelCreatedAt', type: 'date', admin: readOnly },
      { name: 'buildingAt', type: 'date', admin: { ...readOnly, hidden: true } },
      { name: 'readyAt', type: 'date', admin: readOnly },
      { name: 'lastCheckedAt', type: 'date', admin: { ...readOnly, hidden: true } },
      { name: 'durationMs', type: 'number', admin: { ...readOnly, components: { Cell: `${COMPONENT_PREFIX}/client#DurationCell` } } },
      { name: 'changeCount', type: 'number', admin: readOnly, defaultValue: 0 },
      { name: 'changes', type: 'json', admin: readOnly },
      {
        name: 'supersededBy',
        type: 'relationship',
        admin: { ...readOnly, hidden: true },
        relationTo: options.slugs.deployments as CollectionSlug,
      },
      { name: 'rollbackOf', type: 'text', admin: { ...readOnly, hidden: true } },
      { name: 'rollbackTo', type: 'text', admin: { ...readOnly, hidden: true } },
    ],
    indexes: [{ fields: ['target', 'createdAt'] }, { fields: ['target', 'state'] }],
    labels: { plural: 'Deployments', singular: 'Deployment' },
    timestamps: true,
  }
}
