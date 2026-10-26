import Link from 'next/link'
import { GridCross } from '@payload-solutions/brand/crosshairs'
import { ActionRow, SectionHead } from '@payload-solutions/brand/lattice'

import { CaseStudyOutcomes } from '@/components/case-study-outcomes'
import { Reveal } from '@/components/reveal'
import type { CaseStudy } from '@/payload-types'

/**
 * Proof, placed directly above the contact form: the featured case study's headline and
 * numbers, so "Need it built?" lands on a reader who has just seen it done. Renders nothing
 * until a case study is published.
 */
export function CaseStudies({ studies }: { studies: CaseStudy[] }) {
  const study = studies.find((s) => s.featured) ?? studies[0]
  if (!study) return null

  return (
    <section id="work" className="scroll-mt-header relative hairline-t py-section" aria-labelledby="work-heading">
      <GridCross line={2} />
      <div className="container-content">
        <Reveal>
          <SectionHead id="work-heading" eyebrow="Case study" title="Built on Payload. Shipped for clients." />
        </Reveal>
        <div className="col-grid mt-16 gap-y-12">
          <Reveal className="lg:col-span-2 lg:pr-12">
            <p className="label-mono">{study.client}</p>
            <h3 className="display-md mt-4 text-balance">
              <Link href={`/case-studies/${study.slug}`} className="transition-colors hover:text-accent">
                {study.title}
              </Link>
            </h3>
            <p className="mt-5 max-w-[52ch] text-pretty leading-relaxed text-fg-muted">{study.summary}</p>
            <div className="mt-10 border-t border-border">
              <ActionRow href={`/case-studies/${study.slug}`}>Read the case study</ActionRow>
              {studies.length > 1 ? <ActionRow href="/case-studies">All case studies</ActionRow> : null}
              <ActionRow href="#contact">Start a project with us</ActionRow>
            </div>
          </Reveal>
          {study.outcomes?.length ? (
            <Reveal className="min-w-0 lg:col-span-2">
              <CaseStudyOutcomes outcomes={study.outcomes} compact />
            </Reveal>
          ) : null}
        </div>
      </div>
    </section>
  )
}
