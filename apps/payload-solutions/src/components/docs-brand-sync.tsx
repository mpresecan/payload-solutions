'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { accentForSlug } from '@payload-solutions/brand'

/**
 * Gives a documentation page the accent of the thing it documents: Payload Stack docs are
 * platinum, Payload Clock brass, Payload Consent emerald, Payload Emails rose, Action
 * Scheduler teal, Vercel Integration orchid, and the overview stays on the umbrella cobalt.
 *
 * The attribute goes on <html> rather than on a wrapper because Fumadocs renders the sidebar,
 * the table of contents and the page from different places in the tree, and all three should
 * agree. accentForSlug matches on the whole path, so `/docs/plugins/payload-consent` and
 * `/docs/payload-stack/billing` both land on the right family without a lookup table.
 */
export function DocsBrandSync() {
  const pathname = usePathname()
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-brand', accentForSlug(pathname))
    return () => root.setAttribute('data-brand', 'solutions')
  }, [pathname])
  return null
}
