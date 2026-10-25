import { brands } from '@payload-solutions/brand'

import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from '../og-card'

export const alt = 'When to choose Payload Stack'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

/** Its own card, so a shared link reads as the essay rather than as the home page. */
export default async function OpenGraphImage() {
  return renderOgCard({
    eyebrow: '2 min read',
    title: 'When to choose Payload Stack',
    description:
      'Two strong choices, the rest a config file. Which products they serve, and which they get in the way of.',
    footer: `${brands.stack.domain}/when-to-choose`,
  })
}
