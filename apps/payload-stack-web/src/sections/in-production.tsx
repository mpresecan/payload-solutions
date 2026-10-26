import { SOLUTIONS_URL } from '@payload-solutions/brand'
import { GridCross } from '@payload-solutions/brand/crosshairs'
import { ActionRow, SectionHead } from '@payload-solutions/brand/lattice'
import { Reveal } from '@/components/reveal'

/**
 * Proof that the stack holds up outside a demo: the featured case study, which lives on
 * payload.solutions (the agency site owns client work; this site is static and has no
 * database to read it from). Kept to the headline and four figures; the full story and
 * the contact form are one click away. Update CASE when a newer study takes the spot.
 */
const CASE = {
  href: `${SOLUTIONS_URL}/case-studies/layron`,
  client: 'Layer Finance · Layron',
  title: 'Six months on extraction. Three weeks to a product that beat it.',
  summary:
    'An AI workspace for real estate deals had spent six months on document extraction. Rebuilt on the foundation that became Payload Stack, the prototype beat the existing pipeline in three weeks, and the whole product moved onto the stack.',
  outcomes: [
    { value: '3 weeks', label: 'To a prototype running the full extraction pipeline' },
    { value: '6 months', label: 'Of in-house work it outperformed' },
    { value: '1 stack', label: 'The entire product pivoted onto Payload Stack' },
    { value: '80%', label: 'Time saved during deal onboarding, as measured by Layer Finance' },
  ],
}

export function InProduction() {
  return (
    <section id="in-production" className="scroll-mt-header relative hairline-t py-section" aria-labelledby="production-heading">
      <GridCross line={2} />
      <div className="container-content">
        <Reveal>
          <SectionHead
            id="production-heading"
            eyebrow="In production"
            title="What a team builds when the plumbing is done."
            lead="Payload Stack started as the foundation we used for client work. Here is what it bought one of them."
          />
        </Reveal>
        <div className="col-grid mt-16 gap-y-12">
          <Reveal className="lg:col-span-2 lg:pr-12">
            <p className="label-mono">Case study · {CASE.client}</p>
            <h3 className="display-md mt-4 text-balance">
              <a href={CASE.href} className="transition-colors hover:text-accent">
                {CASE.title}
              </a>
            </h3>
            <p className="mt-5 max-w-[52ch] text-pretty leading-relaxed text-fg-muted">{CASE.summary}</p>
            <div className="mt-10 border-t border-border">
              <ActionRow href={CASE.href}>Read the case study</ActionRow>
              <ActionRow href={`${SOLUTIONS_URL}/case-studies`}>All case studies</ActionRow>
            </div>
          </Reveal>
          <Reveal className="min-w-0 lg:col-span-2">
            <dl className="list-grid grid-cols-1 sm:grid-cols-2">
              {CASE.outcomes.map((o) => (
                <div key={o.value} className="list-cell">
                  <dt className="sr-only">{o.label}</dt>
                  <dd className="display-lg tabular-nums">{o.value}</dd>
                  <dd className="mt-3 flex gap-3 text-[0.9375rem] leading-snug text-fg-muted">
                    <span aria-hidden className="mt-2.5 h-px w-4 shrink-0 bg-accent" />
                    <span>{o.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
