import 'server-only'

import { cache } from 'react'

import { getPayloadClient } from '@/lib/payload'
import type { CaseStudy } from '@/payload-types'

/**
 * Published case studies only: the collection's read access already hides drafts from
 * anonymous requests, and `overrideAccess: false` keeps it that way here. Wrapped in
 * `cache` so generateMetadata and the page share one query per request.
 */
export const getCaseStudy = cache(async (slug: string): Promise<CaseStudy | null> => {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'case-studies',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: false,
  })
  return result.docs[0] ?? null
})

export const listCaseStudies = cache(async (): Promise<CaseStudy[]> => {
  try {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'case-studies',
      sort: '-publishedAt',
      limit: 50,
      depth: 0,
      overrideAccess: false,
    })
    return result.docs
  } catch {
    // A database hiccup must not take the home page down with it.
    return []
  }
})

export function formatPublished(date: string) {
  return new Date(date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}
