import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

import { layronCaseStudy } from '../seed/case-studies/layron'

/**
 * Publishes the first case study on databases that already exist. The seed only fills empty
 * collections on first boot, so production would otherwise get the table and no content.
 * Skipped if an entry with this slug is already there, so an edited copy is never replaced.
 */
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const existing = await payload.find({
    collection: 'case-studies',
    where: { slug: { equals: layronCaseStudy.slug } },
    limit: 1,
    draft: true,
    overrideAccess: true,
    req,
  })
  if (existing.totalDocs > 0) return

  await payload.create({
    collection: 'case-studies',
    data: { ...layronCaseStudy, _status: 'published' } as never,
    draft: false,
    overrideAccess: true,
    req,
  })
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.delete({
    collection: 'case-studies',
    where: { slug: { equals: layronCaseStudy.slug } },
    overrideAccess: true,
    req,
  })
}
