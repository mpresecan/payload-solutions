import type { Metadata } from 'next'
import { X_HANDLE, brands } from '@payload-solutions/brand'

const brand = brands.stack

/**
 * Metadata for a legal page. `openGraph` and `twitter` REPLACE the layout's objects rather than
 * merging, so without these the page would share the homepage's og:url, title and description.
 */
export function legalMetadata(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: brand.name, title, description, url: `${brand.url}${path}` },
    twitter: { card: 'summary_large_image', site: X_HANDLE, creator: X_HANDLE, title, description },
  }
}
