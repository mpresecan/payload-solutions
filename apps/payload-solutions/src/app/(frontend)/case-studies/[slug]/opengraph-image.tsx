import { brands } from '@payload-solutions/brand'

import { getCaseStudy } from '@/lib/case-studies'

import { OG_CONTENT_TYPE, OG_SIZE, clampOgText, renderOgCard } from '../../og-card'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Case study on payload.solutions'

/** The case study's own card: client as the eyebrow, the outcome headline as the title. */
export default async function CaseStudyOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const study = await getCaseStudy(slug)
  return renderOgCard({
    eyebrow: study ? `Case study · ${study.client}` : 'Case study',
    title: study?.title ?? 'Case studies',
    description: study ? clampOgText(study.summary) : undefined,
    footer: `${brands.solutions.domain}/case-studies/${slug}`,
  })
}
