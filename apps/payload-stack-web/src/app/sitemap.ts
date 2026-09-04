import type { MetadataRoute } from 'next'
import { brands } from '@payload-solutions/brand'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return [
    { url: brands.stack.url, lastModified, changeFrequency: 'weekly', priority: 1 },
    {
      url: `${brands.stack.url}/when-to-choose`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ]
}
