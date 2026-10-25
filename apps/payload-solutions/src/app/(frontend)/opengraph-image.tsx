import { brands } from '@payload-solutions/brand'

import { OG_CONTENT_TYPE, OG_SIZE, OgConfigPanel, renderOgCard } from './og-card'

const brand = brands.solutions

export const alt = `${brand.name}: ${brand.tagline}`
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

/**
 * The site-wide card: the hero's own line over the hero film's poster, with the still of
 * ConfigHero beside it — every feature one line of payload.config.ts. Docs pages replace it
 * per page with the card from docs-og/[...slug]; see that route and the docs page's
 * generateMetadata.
 */
export default async function OpenGraphImage() {
  return renderOgCard({
    eyebrow: 'Open source · MIT',
    title: 'The SaaS layer for Payload CMS.',
    description: 'Boilerplate, plugins and the engineers who build them.',
    aside: <OgConfigPanel />,
  })
}
