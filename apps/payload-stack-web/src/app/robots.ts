import type { MetadataRoute } from 'next'
import { brands } from '@payload-solutions/brand'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${brands.stack.url}/sitemap.xml`,
  }
}
