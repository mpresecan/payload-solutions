import { createHash } from 'node:crypto'
import type { CollectionConfig, Payload, PayloadRequest } from 'payload'

import type { ConsentVersions } from '@payload-solutions/consent-core'

import type { AnyDoc } from './types.js'

import { invalidateConfigCache } from './config-cache.js'
import type { ResolvedConsentPluginOptions } from './types.js'

const SKIP = 'consentVersionRecompute'

export function shortHash(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 8)
}

const sortBy = <T>(items: T[], key: (item: T) => string) => [...items].sort((a, b) => key(a).localeCompare(key(b)))

/** Reads the three collections and computes the version components. Pure with respect to the settings global. */
export async function computeVersions(
  payload: Payload,
  options: ResolvedConsentPluginOptions,
  req?: PayloadRequest,
): Promise<ConsentVersions> {
  const { slugs } = options
  const common = { depth: 0, limit: 500, pagination: false as const, overrideAccess: true, req }

  const categories = (await payload.find({ collection: slugs.categories, ...common })) as unknown as { docs: AnyDoc[] }
  const categoriesVersion = shortHash(
    sortBy(
      categories.docs.map((d) => ({ key: String(d.key), required: Boolean(d.required) })),
      (c) => c.key,
    ),
  )

  const trackers = (await payload.find({ collection: slugs.trackers, where: { enabled: { equals: true } }, ...common })) as unknown as { docs: AnyDoc[] }
  const trackersVersion = shortHash(
    sortBy(
      trackers.docs.map((d) => ({
        id: String(d.id),
        category: String(typeof d.category === 'object' && d.category ? (d.category as { id: unknown }).id : d.category),
        kind: String(d.kind),
      })),
      (t) => t.id,
    ),
  )

  let documentsVersion = shortHash([])
  if (options.legalPages) {
    const pages = (await payload.find({
      collection: slugs.legalPages,
      where: { and: [{ kind: { in: ['privacy', 'cookies'] } }, { _status: { equals: 'published' } }] },
      ...common,
    })) as unknown as { docs: AnyDoc[] }
    documentsVersion = shortHash(
      sortBy(
        pages.docs.map((d) => ({ kind: String(d.kind), effectiveDate: String(d.effectiveDate).slice(0, 10) })),
        (p) => p.kind,
      ),
    )
  }

  const policyVersion = shortHash([categoriesVersion, trackersVersion, documentsVersion])
  return { policyVersion, categoriesVersion, trackersVersion, documentsVersion }
}

/** Recomputes and stores versions in the settings global when they changed. Returns the current versions. */
export async function recomputeVersions(
  payload: Payload,
  options: ResolvedConsentPluginOptions,
  req?: PayloadRequest,
): Promise<ConsentVersions> {
  const next = await computeVersions(payload, options, req)
  const settings = (await payload.findGlobal({ slug: options.slugs.settings, depth: 0, overrideAccess: true, req })) as AnyDoc
  const current = (settings.versions ?? {}) as Partial<ConsentVersions>
  const changed = (['policyVersion', 'categoriesVersion', 'trackersVersion', 'documentsVersion'] as const).some(
    (k) => current[k] !== next[k],
  )
  if (changed) {
    await payload.updateGlobal({
      slug: options.slugs.settings,
      data: { versions: { ...next, bumpedAt: new Date().toISOString() } } as never,
      overrideAccess: true,
      req,
      context: { [SKIP]: true },
    })
  }
  invalidateConfigCache()
  return next
}

/** afterChange/afterDelete hooks shared by the three version-bearing collections. */
export function versionHooks(options: ResolvedConsentPluginOptions): NonNullable<CollectionConfig['hooks']> {
  const run = async ({ req }: { req: PayloadRequest }) => {
    if (req.context?.[SKIP]) return
    try {
      await recomputeVersions(req.payload, options, req)
    } catch (error) {
      req.payload.logger.warn({ err: error }, '[plugin-consent] could not recompute policy versions')
    }
  }
  return {
    afterChange: [async ({ req }) => run({ req })],
    afterDelete: [async ({ req }) => run({ req })],
  }
}
