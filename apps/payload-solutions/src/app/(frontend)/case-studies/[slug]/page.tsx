import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { X_HANDLE, brands } from '@payload-solutions/brand'
import { JsonLd, ORGANIZATION_ID } from '@payload-solutions/brand/json-ld'
import { GridColumns } from '@payload-solutions/brand/grid-columns'
import { GridCross } from '@payload-solutions/brand/crosshairs'
import { ActionRow, Eyebrow } from '@payload-solutions/brand/lattice'
import { SplitLoad } from '@payload-solutions/brand/split-load'
import { ThemeBand } from '@payload-solutions/brand/theme-band'

import { CaseStudyOutcomes } from '@/components/case-study-outcomes'
import { Reveal } from '@/components/reveal'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { formatPublished, getCaseStudy, listCaseStudies } from '@/lib/case-studies'
import { Contact } from '@/sections/contact'

export const revalidate = 300

type Params = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return (await listCaseStudies()).map((study) => ({ slug: study.slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const study = await getCaseStudy(slug)
  if (!study) return { title: 'Case study', robots: { index: false } }

  // openGraph and twitter replace the layout's objects rather than merging, so everything
  // they carry is restated (see the docs page). The image is ./opengraph-image.tsx.
  const url = `/case-studies/${study.slug}`
  return {
    // Short enough for search results; the outcome headline is the og:title and the H1.
    title: `${study.client} case study`,
    description: study.summary,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      siteName: brands.solutions.name,
      url,
      title: study.title,
      description: study.summary,
      publishedTime: study.publishedAt,
      authors: study.author ? [study.author] : undefined,
    },
    twitter: { card: 'summary_large_image', site: X_HANDLE, creator: X_HANDLE, title: study.title, description: study.summary },
  }
}

/**
 * One case study, laid out to be read by someone deciding whether to hire us:
 *
 * 1. The dark band answers "what happened" in one screen: client, outcome headline, summary,
 *    and the numbers row.
 * 2. The body runs on the lattice. Column one is the facts a buyer checks against their own
 *    situation (industry, engagement, stack); columns two and three are the story at a
 *    reading measure; column four holds the hand-off, sticky, so "start a project" is one
 *    click from any paragraph.
 * 3. A published quote, when there is one, gets a band of its own.
 * 4. The page ends in the contact form, headed with the case study's own closing prompt and
 *    tagged with its slug, so the inbox shows what the lead read.
 */
export default async function CaseStudyPage({ params }: Params) {
  const { slug } = await params
  const study = await getCaseStudy(slug)
  if (!study) notFound()

  const facts: Array<{ label: string; value?: string | null; href?: string | null }> = [
    { label: 'Client', value: study.client, href: study.clientUrl },
    { label: 'Industry', value: study.industry },
    { label: 'Location', value: study.location },
    { label: 'Engagement', value: study.engagement },
  ]
  const quote = study.quote?.text ? study.quote : null

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: study.title,
          description: study.summary,
          url: `${brands.solutions.url}/case-studies/${study.slug}`,
          datePublished: study.publishedAt,
          dateModified: study.updatedAt,
          ...(study.author && { author: { '@type': 'Person', name: study.author } }),
          publisher: { '@id': ORGANIZATION_ID },
          about: { '@type': 'Organization', name: study.client, ...(study.clientUrl && { url: study.clientUrl }) },
        }}
      />
      <SiteHeader />
      <main id="main" className="flex-1">
        <ThemeBand theme="dark" as="div" className="relative -mt-header pt-header">
          <GridColumns fadeTop />
          <header className="container-content py-16 sm:py-20 lg:py-28">
            <div className="reveal-load-group max-w-[58rem]">
              <Eyebrow className="mb-7">
                {/* One inline run, so a narrow screen wraps it like text rather than as columns. */}
                <span>
                  <Link href="/case-studies" className="transition-colors hover:text-fg">
                    Case study
                  </Link>
                  <span aria-hidden> · </span>
                  {study.client}
                </span>
              </Eyebrow>
              <SplitLoad as="h1" className="display-xl text-balance">
                {study.title}
              </SplitLoad>
              <p className="lead mt-7 max-w-[40rem] text-pretty">{study.summary}</p>
            </div>
            {/* CSS load reveal, not the scroll one: this is above the fold and must not wait
                for hydration. Delayed to land after the summary. */}
            {study.outcomes?.length ? (
              <div className="reveal-load mt-16 [--reveal-i:4] lg:mt-20">
                <CaseStudyOutcomes outcomes={study.outcomes} />
              </div>
            ) : null}
          </header>
        </ThemeBand>

        <div className="relative z-10 bg-bg">
          <GridColumns />
          <section className="relative hairline-t py-section" aria-label="The case study">
            <GridCross line={1} />
            <div className="container-content col-grid gap-y-12">
              {/* Facts: what a buyer compares against their own situation. */}
              <aside className="lg:pr-10">
                <div className="lg:sticky lg:top-[calc(var(--header-height)+2rem)]">
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-6 text-sm lg:grid-cols-1">
                    {facts
                      .filter((f) => f.value)
                      .map((fact) => (
                        <div key={fact.label}>
                          <dt className="label-mono">{fact.label}</dt>
                          <dd className="mt-2 text-fg">
                            {fact.href ? (
                              <a
                                href={fact.href}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="underline decoration-border-strong underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
                              >
                                {fact.value}
                              </a>
                            ) : (
                              fact.value
                            )}
                          </dd>
                        </div>
                      ))}
                    {study.builtWith?.length ? (
                      <div className="col-span-2 lg:col-span-1">
                        <dt className="label-mono">Built with</dt>
                        <dd className="mt-3 flex flex-wrap gap-1.5">
                          {study.builtWith.map((tool) => (
                            <span
                              key={tool.id ?? tool.name}
                              className="border border-border px-2 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-fg-muted"
                            >
                              {tool.name}
                            </span>
                          ))}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  {study.author ? (
                    <p className="mt-10 border-t border-border pt-6 text-sm text-fg-muted">
                      Written by <span className="text-fg">{study.author}</span>
                      <br />
                      {formatPublished(study.publishedAt)}
                    </p>
                  ) : null}
                </div>
              </aside>

              {/* Opaque: the article spans the centre line, and body text read across a hairline
                  looks like a rendering fault. The lattice resumes above and below it. */}
              <article className="case-prose prose relative min-w-0 max-w-none bg-bg lg:col-span-2 lg:px-10">
                <RichText data={study.content} />
              </article>

              {/* The hand-off, one click from any paragraph. */}
              <aside className="lg:pl-10">
                <div className="border border-border bg-surface p-6 lg:sticky lg:top-[calc(var(--header-height)+2rem)]">
                  <p className="label-mono">Work with us</p>
                  <p className="mt-4 text-lg font-medium leading-snug tracking-tight">
                    Want this for your product?
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-fg-muted">
                    We take on a few client projects at a time, starting from Payload Stack so the
                    budget goes into what makes your product different.
                  </p>
                  <div className="mt-6 border-t border-border">
                    <ActionRow href="#contact">Start a project</ActionRow>
                    <ActionRow href={brands.stack.url}>See Payload Stack</ActionRow>
                  </div>
                </div>
              </aside>
            </div>
          </section>

          {quote ? (
            <section className="relative hairline-t py-section" aria-label="In their words">
              <GridCross line={2} />
              <Reveal as="figure" className="container-content col-grid m-0">
                <blockquote className="display-lg text-balance lg:col-span-3 lg:col-start-2 lg:pl-10">
                  <span aria-hidden className="text-fg-subtle">“</span>
                  {quote.text}
                  <span aria-hidden className="text-fg-subtle">”</span>
                </blockquote>
                <figcaption className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted lg:col-span-3 lg:col-start-2 lg:pl-10">
                  <span aria-hidden className="h-px w-7 bg-accent" />
                  <span className="text-fg">{quote.author}</span>
                  {quote.role ? <span>{quote.role}</span> : null}
                  {quote.sourceUrl ? (
                    <a
                      href={quote.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline decoration-border-strong underline-offset-4 transition-colors hover:text-fg"
                    >
                      Source
                    </a>
                  ) : null}
                </figcaption>
              </Reveal>
            </section>
          ) : null}

          <Contact
            eyebrow="Start a project"
            title={study.cta?.title || 'Need it built? We build SaaS on Payload.'}
            lead={study.cta?.body || undefined}
            caseStudiesLink={false}
            source={`case-study:${study.slug}`}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
