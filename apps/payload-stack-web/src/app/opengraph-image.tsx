import { NPX_COMMAND, brands } from '@payload-solutions/brand'

import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from './og-card'

export const alt = `${brands.stack.name}: ${brands.stack.tagline}`
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

/** The hero's own headline over the launch film's poster, with the one command to run. */
export default async function OpenGraphImage() {
  return renderOgCard({
    eyebrow: 'Agentic SaaS boilerplate',
    title: 'Payload CMS, ready for SaaS.',
    description:
      'Auth, organizations, billing and an admin dashboard already wired in, so your coding agents start on the product.',
    action: { prompt: '$', text: NPX_COMMAND },
  })
}
