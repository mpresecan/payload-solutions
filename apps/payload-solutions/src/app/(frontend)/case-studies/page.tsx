import Link from 'next/link'
import type { Metadata } from 'next'
import { GridColumns } from '@payload-solutions/brand/grid-columns'
import { GridCross } from '@payload-solutions/brand/crosshairs'
import { ArrowGlyph, Eyebrow } from '@payload-solutions/brand/lattice'
import { SplitLoad } from '@payload-solutions/brand/split-load'
import { ThemeBand } from '@payload-solutions/brand/theme-band'

import { Reveal } from '@/components/reveal'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { formatPublished, listCaseStudies } from '@/lib/case-studies'
import { Contact } from '@/sections/contact'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Case studies',
  description:
    'Products we built on Payload CMS for clients: what was stuck, what we shipped and how long it took.',
  alternates: { canonical: '/case-studies' },
}

/**
 * The index. Each entry is one full-width row of the lattice: who and what on the left, the
 * headline and summary in the middle, the lead number on the right. The page closes on the
 * contact form, because anyone who reads to the end of a list of client work is shopping.
 */
export default async function CaseStudiesPage() {
  const studies = await listCaseStudies()

  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <ThemeBand theme="dark" as="div" className="relative -mt-header pt-header">
          <GridColumns fadeTop />
          <header className="container-content py-16 sm:py-20 lg:py-28">
            <div className="reveal-load-group max-w-[52rem]">
              <Eyebrow className="mb-7">Case studies</Eyebrow>
              <SplitLoad as="h1" className="display-xl text-balance">
                Built on Payload. Shipped for clients.
              </SplitLoad>
              <p className="lead mt-7 max-w-[40rem] text-pretty">
                What was stuck, what we built and how long it took. Every project here started
                from Payload Stack, so the time went into the part only that product has.
              </p>
            </div>
          </header>
        </ThemeBand>

        <div className="relative z-10 bg-bg">
          <GridColumns />
          <section className="relative hairline-t" aria-label="All case studies">
            <GridCross line={1} />
            <ul className="container-content">
              {studies.map((study, i) => {
                const lead = study.outcomes?.[0]
                return (
                  <Reveal as="li" key={study.id} index={i} className="border-b border-border">
                    <Link
                      href={`/case-studies/${study.slug}`}
                      className="group col-grid gap-y-5 py-12 lg:py-16"
                    >
                      <div className="lg:pr-10">
                        <p className="label-mono">{study.client}</p>
                        <p className="mt-2 text-sm text-fg-muted">
                          {[study.industry, formatPublished(study.publishedAt)].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {/* Opaque for the same reason as the article body: text across the centre line. */}
                      <div className="relative bg-bg lg:col-span-2 lg:px-10">
                        <h2 className="display-md text-balance transition-colors group-hover:text-accent">
                          {study.title}
                        </h2>
                        <p className="mt-4 max-w-[52ch] text-pretty leading-relaxed text-fg-muted">{study.summary}</p>
                        <span className="mt-6 inline-flex items-center gap-2 text-sm text-fg underline decoration-border-strong underline-offset-4 group-hover:decoration-accent">
                          Read the case study <ArrowGlyph size={14} />
                        </span>
                      </div>
                      {lead ? (
                        <div className="lg:pl-10">
                          <p className="display-lg tabular-nums">{lead.value}</p>
                          <p className="mt-2 max-w-[24ch] text-sm leading-snug text-fg-muted">{lead.label}</p>
                        </div>
                      ) : null}
                    </Link>
                  </Reveal>
                )
              })}
              {studies.length === 0 ? (
                <li className="py-16 text-fg-muted">The first write-up is on its way.</li>
              ) : null}
            </ul>
          </section>

          <Contact
            eyebrow="Start a project"
            title="Your product could be the next one here."
            lead="Tell us what you are building and where it is stuck. We reply within two working days."
            source="case-studies"
          />
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
