import { brands } from '@payload-solutions/brand'

import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from './og-card'

export const alt = `${brands.clock.name}: ${brands.clock.tagline}`
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

/** The hero's own headline over the clock film's poster, with the endpoint it calls. */
export default async function OpenGraphImage() {
  return renderOgCard({
    eyebrow: 'In development · Free',
    title: 'The clock your serverless Payload app doesn’t have.',
    description:
      'Calls your job queue on schedule, drains the backlog, keeps the history and tells you when it stops.',
    action: { prompt: 'GET', text: '/api/payload-jobs/run' },
  })
}
