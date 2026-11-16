import type { MetadataRoute } from 'next'
import { brands } from '@payload-solutions/brand'

/*
  lastModified is the date the page's content last changed, not the build time: a sitemap that
  re-dates every URL on each deploy teaches Google to ignore its dates. Bump a date when you edit
  that page. changeFrequency and priority are left out because Google ignores them.
*/
const PAGES: { path: string; lastModified: string }[] = [
  { path: '', lastModified: '2026-11-16' },
  { path: '/when-to-choose', lastModified: '2026-11-16' },
  { path: '/legal/privacy', lastModified: '2026-10-25' },
  { path: '/legal/cookies', lastModified: '2026-10-25' },
  { path: '/legal/terms', lastModified: '2026-10-25' },
]

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(({ path, lastModified }) => ({ url: `${brands.stack.url}${path}`, lastModified }))
}
