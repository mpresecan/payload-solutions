import type { Payload } from 'payload'

import { DEFAULT_CATEGORIES } from '@payload-solutions/consent-core'

import type { AnyDoc, ResolvedConsentPluginOptions, SeedOptions, TrackerPresetOptions } from '../types.js'
import { recomputeVersions } from '../versions.js'
import { seedLegalPages } from './legal.js'
import { TRACKER_PRESETS, substituteVars } from './presets.js'

export async function runSeeds(payload: Payload, options: ResolvedConsentPluginOptions) {
  if (options.seed === false) return
  const seed = options.seed
  const { slugs } = options
  let changed = false

  if (seed.categories !== false) {
    const count = await payload.count({ collection: slugs.categories, overrideAccess: true })
    if (count.totalDocs === 0) {
      let order = 0
      for (const category of DEFAULT_CATEGORIES) {
        await payload.create({ collection: slugs.categories, data: { ...category, order: order++ } as never, overrideAccess: true })
      }
      changed = true
    }
  }

  if (seed.trackers?.length) {
    const count = await payload.count({ collection: slugs.trackers, overrideAccess: true })
    if (count.totalDocs === 0) {
      await seedTrackers(payload, options, seed.trackers)
      changed = true
    }
  }

  if (options.legalPages && seed.legalPages !== false && seed.company) {
    const count = await payload.count({ collection: slugs.legalPages, overrideAccess: true })
    if (count.totalDocs === 0) {
      await seedLegalPages(payload, options, seed as SeedOptions & { company: NonNullable<SeedOptions['company']> })
      changed = true
    }
  }

  if (changed) await recomputeVersions(payload, options)
}

export async function seedTrackers(
  payload: Payload,
  options: ResolvedConsentPluginOptions,
  entries: NonNullable<SeedOptions['trackers']>,
) {
  const { slugs } = options
  const categories = (await payload.find({ collection: slugs.categories, limit: 100, pagination: false, depth: 0, overrideAccess: true })) as unknown as { docs: AnyDoc[] }
  const idByKey = new Map(categories.docs.map((c) => [String(c.key), c.id]))

  for (const entry of entries) {
    const preset: TrackerPresetOptions = typeof entry === 'string' ? { key: entry } : entry
    const definition = TRACKER_PRESETS[preset.key]
    if (!definition) {
      payload.logger.warn(`[plugin-consent] unknown tracker preset "${preset.key}"`)
      continue
    }
    const categoryId = idByKey.get(definition.categoryKey)
    if (!categoryId) {
      payload.logger.warn(`[plugin-consent] preset "${preset.key}" needs category "${definition.categoryKey}", which does not exist`)
      continue
    }
    const vars = preset.vars ?? {}
    const missing = (definition.vars ?? []).filter((v) => !vars[v])
    if (missing.length) payload.logger.warn(`[plugin-consent] preset "${preset.key}": fill in ${missing.join(', ')} in the admin`)
    const data = substituteVars(
      {
        name: definition.name,
        vendor: definition.vendor,
        vendorPrivacyUrl: definition.vendorPrivacyUrl,
        category: categoryId,
        kind: definition.kind,
        purpose: definition.purpose,
        cookies: definition.cookies.map((c) => ({ storage: 'cookie', ...c })),
        loader: definition.loader
          ? {
              src: definition.loader.src,
              inlineCode: definition.loader.inlineCode,
              strategy: definition.loader.strategy ?? 'afterDecision',
              consentModeManaged: Boolean(definition.loader.consentModeManaged),
              attributes: definition.loader.attributes,
            }
          : undefined,
        enabled: preset.enabled ?? true,
        environments: ['development', 'production'],
        presetKey: definition.key,
      },
      vars,
    )
    await payload.create({ collection: slugs.trackers, data: data as never, overrideAccess: true })
  }
}
