import type { Config, Plugin } from 'payload'

import { createAuditsCollection } from './collections/audits.js'
import { createCategoriesCollection } from './collections/categories.js'
import { createLegalPagesCollection } from './collections/legal-pages.js'
import { createProcessorsCollection } from './collections/processors.js'
import { createRecordsCollection } from './collections/records.js'
import { createTrackersCollection } from './collections/trackers.js'
import { createEndpoints } from './endpoints.js'
import { createSettingsGlobal } from './globals/settings.js'
import { createPurgeTask, PURGE_TASK_SLUG } from './jobs.js'
import { runSeeds } from './seed/index.js'
import { resolveOptions, type ConsentPluginOptions, type ResolvedConsentPluginOptions } from './types.js'

export type {
  CompanyInfo,
  ConsentPluginOptions,
  ConsentPluginSlugs,
  ProcessorPresetKey,
  ProcessorRole,
  ResolvedConsentPluginOptions,
  SeedOptions,
  TrackerPresetKey,
  TransferMechanism,
} from './types.js'
export { DEFAULT_SLUGS, resolveOptions } from './types.js'
export { CookieTableBlock, PolicyVersionBlock, ProcessorTableBlock } from './blocks.js'
export { TRACKER_PRESETS } from './seed/presets.js'
export { PROCESSOR_PRESETS } from './seed/processor-presets.js'
export { legalPagesEditor } from './collections/legal-pages.js'
export { CHECKLISTS, TERMINOLOGY, checklistFor, terminologyFor } from './audit/checklists.js'
export { FINDING_CODES } from './audit/findings.js'
export { PROFILE_QUESTIONS } from './audit/profile.js'
export type { Finding, ScanResult, Severity } from './audit/types.js'
export { PURGE_TASK_SLUG }

const registry = new WeakMap<object, ResolvedConsentPluginOptions>()
let lastOptions: ResolvedConsentPluginOptions | null = null

/** Options the plugin was initialised with, for server helpers that only receive `payload`. */
export function getPluginOptions(payload?: object): ResolvedConsentPluginOptions {
  const found = (payload && registry.get(payload)) ?? lastOptions
  if (!found) throw new Error('[plugin-consent] consentPlugin() has not been added to the Payload config.')
  return found
}

/**
 * Payload Consent. Adds consent settings, cookie categories, trackers, consent records and
 * (optionally) legal pages, the `/api/consent/*` endpoints, seeds and the retention job.
 */
export const consentPlugin =
  (incoming: ConsentPluginOptions = {}): Plugin =>
  (config: Config): Config => {
    const options = resolveOptions(incoming)
    lastOptions = options
    if (!options.enabled) return config

    const localized = Boolean(config.localization)

    const collections = [
      createCategoriesCollection(options, localized),
      createTrackersCollection(options, localized),
      createRecordsCollection(options),
      ...(options.legalPages ? [createLegalPagesCollection(options, localized)] : []),
      ...(options.processors ? [createProcessorsCollection(options, localized)] : []),
      ...(options.audits ? [createAuditsCollection(options)] : []),
    ]

    const jobs = config.jobs ?? {}
    const tasks = [...(jobs.tasks ?? [])]
    const autoRun = Array.isArray(jobs.autoRun) ? [...jobs.autoRun] : jobs.autoRun
    if (options.jobs.purge !== false) {
      tasks.push(createPurgeTask(options))
    }
    const purgeCron = options.jobs.purge && options.jobs.purge.cron
    const mergedAutoRun =
      purgeCron && Array.isArray(autoRun)
        ? [...autoRun, { cron: purgeCron, queue: options.jobs.purge && options.jobs.purge.queue ? options.jobs.purge.queue : 'default' }]
        : autoRun

    const incomingOnInit = config.onInit
    const withPlugin: Config = {
      ...config,
      collections: [...(config.collections ?? []), ...collections],
      globals: [...(config.globals ?? []), createSettingsGlobal(options, localized)],
      endpoints: [...(config.endpoints ?? []), ...createEndpoints(options)],
      jobs: { ...jobs, tasks, ...(mergedAutoRun ? { autoRun: mergedAutoRun } : {}) } as Config['jobs'],
      admin: {
        ...config.admin,
        components: {
          ...config.admin?.components,
          beforeDashboard: [
            ...(config.admin?.components?.beforeDashboard ?? []),
            ...(options.admin.dashboardWidget ? ['@payload-solutions/plugin-consent/rsc#ConsentOverview'] : []),
          ],
        },
      },
      onInit: async (payload) => {
        registry.set(payload, options)
        if (incomingOnInit) await incomingOnInit(payload)
        try {
          await runSeeds(payload, options)
        } catch (error) {
          payload.logger.error({ err: error }, '[plugin-consent] seeding failed')
        }
      },
    }
    return withPlugin
  }

export default consentPlugin
