import type { Payload, TaskConfig } from 'payload'

import type { AnyDoc, ResolvedConsentPluginOptions } from './types.js'

export const PURGE_TASK_SLUG = 'consentPurgeRecords'

/** Deletes consent records past their `expiresAt` plus the configured retention. */
export async function purgeExpiredRecords(payload: Payload, options: ResolvedConsentPluginOptions, now = new Date()) {
  const settings = (await payload.findGlobal({ slug: options.slugs.settings, depth: 0, overrideAccess: true })) as AnyDoc
  const months = Number((settings.recording as { retentionMonths?: number } | undefined)?.retentionMonths ?? options.recording.retentionMonths)
  const cutoff = new Date(now.getTime() - months * 30.4375 * 86_400_000).toISOString()
  const result = await payload.delete({
    collection: options.slugs.records,
    where: { createdAt: { less_than: cutoff } },
    overrideAccess: true,
  })
  return { deleted: result.docs.length, cutoff }
}

export function createPurgeTask(options: ResolvedConsentPluginOptions): TaskConfig {
  return {
    slug: PURGE_TASK_SLUG,
    label: 'Purge expired consent records',
    retries: 1,
    outputSchema: [
      { name: 'deleted', type: 'number' },
      { name: 'cutoff', type: 'text' },
    ],
    handler: async ({ req }) => {
      const output = await purgeExpiredRecords(req.payload, options)
      return { output }
    },
  } as TaskConfig
}
