import type { MetadataRoute } from 'next'
import { brands } from '@payload-solutions/brand'

import { source } from '@/lib/source'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = brands.solutions.url
  const docs = source.getPages().map((page) => ({
    url: `${base}${page.url}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))
  return [{ url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 }, ...docs]
}
