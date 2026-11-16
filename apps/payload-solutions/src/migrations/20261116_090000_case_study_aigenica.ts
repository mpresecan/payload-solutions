import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

import { aigenicaCaseStudy } from '../seed/case-studies/aigenica'

/**
 * Publishes the AIgenica case study on databases that already exist (the seed only fills an
 * empty collection). Skipped if an entry with this slug is already there, so an edited copy is
 * never replaced.
 */
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const existing = await payload.find({
    collection: 'case-studies',
    where: { slug: { equals: aigenicaCaseStudy.slug } },
    limit: 1,
    draft: true,
    overrideAccess: true,
    req,
  })
  if (existing.totalDocs > 0) return

  await payload.create({
    collection: 'case-studies',
    data: { ...aigenicaCaseStudy, _status: 'published' } as never,
    draft: false,
    overrideAccess: true,
    req,
  })
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.delete({
    collection: 'case-studies',
    where: { slug: { equals: aigenicaCaseStudy.slug } },
    overrideAccess: true,
    req,
  })
}
