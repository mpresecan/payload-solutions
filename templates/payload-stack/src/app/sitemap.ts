import type { MetadataRoute } from 'next'

import { env } from '@/lib/env'
import { getPayloadClient } from '@/lib/payload'
import { paths } from '@/lib/paths'
import stack from '@/stack.config'

/**
 * /sitemap.xml: the public pages only. The homepage, the pricing page when billing is on, and every
 * legal page a visitor can read. The dashboard, onboarding, auth screens and /admin stay out; see
 * robots.ts for the matching disallow list.
 *
 * Legal pages live in the database, so the sitemap is rendered per request rather than at build
 * time (a build has no seeded pages to list).
 */
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  const entries: MetadataRoute.Sitemap = [{ url: `${base}${paths.home}`, changeFrequency: 'weekly', priority: 1 }]

  if (stack.billing.provider === 'stripe') {
    entries.push({ url: `${base}${paths.pricing}`, changeFrequency: 'monthly', priority: 0.8 })
  }

  try {
    const payload = await getPayloadClient()
    const pages = await payload.find({
      collection: 'legal-pages',
      select: { slug: true, updatedAt: true },
      limit: 50,
      overrideAccess: false,
    })
    for (const page of pages.docs) {
      entries.push({
        url: `${base}${paths.legal(page.slug)}`,
        lastModified: page.updatedAt ? new Date(page.updatedAt) : undefined,
        changeFrequency: 'yearly',
        priority: 0.3,
      })
    }
  } catch {
    // No database yet (first build, preview without DATABASE_URL): list the static pages only.
  }

  return entries
}
