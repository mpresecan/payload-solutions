import type { MetadataRoute } from 'next'

import { env } from '@/lib/env'
import { paths } from '@/lib/paths'

/**
 * /robots.txt: crawl the marketing and legal pages, keep out of the app, the auth screens, the
 * Payload admin and the API. Points crawlers at sitemap.ts.
 */
export default function robots(): MetadataRoute.Robots {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [paths.dashboard.home, paths.onboarding, paths.auth.base, paths.payloadAdmin, '/api'],
    },
    sitemap: `${base}/sitemap.xml`,
  }
}
