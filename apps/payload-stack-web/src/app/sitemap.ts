import type { MetadataRoute } from 'next'
import { brands } from '@payload-solutions/brand'

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: brands.stack.url, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 }]
}
