import type { Node } from 'fumadocs-core/page-tree'
import { accentForSlug, brands } from '@payload-solutions/brand'

import { clampOgText, renderOgCard } from '../../og-card'
import { source } from '@/lib/source'

const brand = brands.solutions

/**
 * The docs Open Graph images, one per page: /docs-og/<page slug>/image.png, linked from each
 * page's `openGraph.images` in docs/[[...slug]]/page.tsx.
 *
 * It has to be a route rather than an `opengraph-image` file in the docs segment: that file
 * would resolve to /docs/<slug>/opengraph-image, which appends a static segment after a
 * catch-all, and Turbopack rejects the route tree outright ("catch all segment must be the
 * last segment modifying the path"). The trailing `image.png` is what keeps this route's own
 * catch-all last, and gives the URL a sane extension for the crawlers.
 */

/**
 * The product or plugin a page belongs to, taken from the page tree rather than parsed out
 * of the slug: every product and plugin folder is a Fumadocs root folder, and its `name` is
 * the title from that folder's meta.json ("Payload Stack", "Payload Consent"). A page that
 * sits outside any root folder — /docs itself, and each section's own index page — has no
 * section above it and falls back to the label below.
 *
 * `null` means "not in this branch"; `{ label: undefined }` means "found, no section". The
 * two have to stay distinct or the search returns the first branch it walks.
 */
function findSection(nodes: Node[], url: string, current?: string): { label?: string } | null {
  for (const node of nodes) {
    if (node.type === 'page' && node.url === url) return { label: current }
    if (node.type !== 'folder') continue
    if (node.index?.url === url) return { label: current }

    const name = typeof node.name === 'string' ? node.name : undefined
    const found = findSection(node.children, url, node.root && name ? name : current)
    if (found) return found
  }
  return null
}

export function generateStaticParams() {
  return source.generateParams().map((params) => ({ ...params, slug: [...params.slug, 'image.png'] }))
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  // Drop the trailing `image.png` to get back to the page this card is for.
  const page = source.getPage(slug.slice(0, -1))
  if (!page) return new Response('Not found', { status: 404 })

  return renderOgCard({
    eyebrow: findSection(source.pageTree.children, page.url)?.label ?? 'Documentation',
    title: page.data.title,
    description: clampOgText(page.data.description),
    footer: `${brand.domain}${page.url}`,
    // The same function DocsBrandSync uses for the live page, so the card cannot drift from
    // the accent a visitor sees when they follow the link.
    accent: accentForSlug(page.url),
  })
}
