import type { MetadataRoute } from 'next'
import { brands } from '@payload-solutions/brand'

import { listCaseStudies } from '@/lib/case-studies'
import { getPayloadClient } from '@/lib/payload'
import { source } from '@/lib/source'

export const revalidate = 3600

/**
 * Every URL uses the apex host (brands.solutions.url), matching robots.txt and the canonicals.
 * Docs entries carry no lastModified: the build has no reliable per-file date, and stamping
 * every page with the build time teaches Google to ignore the field. Legal pages use the
 * document's own updatedAt.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = brands.solutions.url

  const docs: MetadataRoute.Sitemap = source.getPages().map((page) => ({
    url: `${base}${page.url}`,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  const caseStudies: MetadataRoute.Sitemap = (await listCaseStudies()).map((study) => ({
    url: `${base}/case-studies/${study.slug}`,
    lastModified: study.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  return [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/case-studies`, changeFrequency: 'weekly', priority: 0.8 },
    ...caseStudies,
    ...docs,
    ...(await getLegalEntries({ base })),
  ]
}

async function getLegalEntries({ base }: { base: string }): Promise<MetadataRoute.Sitemap> {
  try {
    const payload = await getPayloadClient()
    const { docs } = await payload.find({
      collection: 'legal-pages',
      limit: 50,
      depth: 0,
      overrideAccess: false,
      select: { slug: true, updatedAt: true },
    })

    return docs.map((doc) => ({
      url: `${base}/legal/${doc.slug}`,
      lastModified: doc.updatedAt,
      changeFrequency: 'yearly',
      priority: 0.2,
    }))
  } catch {
    // A database hiccup must not take the whole sitemap down with it.
    return []
  }
}
