import type { Metadata } from 'next'
import { NPX_COMMAND, brands } from '@payload-solutions/brand'
import { CrtGrain } from '@payload-solutions/brand/crt-grain'
import { GridCross } from '@payload-solutions/brand/crosshairs'
import { GridColumns } from '@payload-solutions/brand/grid-columns'
import { ActionRow, Eyebrow, SectionHead } from '@payload-solutions/brand/lattice'
import { SplitLoad } from '@payload-solutions/brand/split-load'
import { ThemeBand } from '@payload-solutions/brand/theme-band'

import { Reveal } from '@/components/reveal'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { StatusChip } from '@/components/status-chip'
import { PRO_VERTICALS } from '@/lib/pro'
import { WaitlistForm } from '@/sections/pro/waitlist-form'

const stack = brands.stack

export const metadata: Metadata = {
  title: 'Payload Stack Pro: complete SaaS verticals on Payload CMS',
  description:
    'Payload Stack Pro scaffolds whole products on top of the free Payload Stack: AI chat, a digital goods marketplace, online courses and a feedback board. Join the waitlist.',
  alternates: { canonical: '/pro' },
}

const FREE = [
  'Better Auth sign-in, organizations and roles',
  'Stripe plans and the customer portal',
  'A shadcn dashboard, account and settings pages',
  'Transactional emails, scheduled jobs, cookie consent',
  'Tests across every stack.config.ts option',
]

const STEPS = [
  {
    title: 'Get a licence on payload.solutions',
    body: 'One account here holds your Pro licence, the same place the documentation already lives.',
  },
  {
    title: 'Pick a vertical when you scaffold',
    body: 'The create-payload-stack command you already know offers the verticals as one more step, next to the database and the plugins.',
  },
  {
    title: 'Own every line',
    body: 'The vertical lands in your repository as ordinary Payload collections and Next.js pages, documented like the rest. No runtime dependency on us.',
  },
]

const FAQ = [
  {
    q: 'Will Payload Stack stay free?',
    a: 'Yes. Payload Stack is MIT and keeps getting features. Pro is an extra layer of finished products on top of it, not a fence around what is free today.',
  },
  {
    q: 'When does Pro open?',
    a: 'When the first vertical is ready to ship. The waitlist hears first, and the votes on this page decide which vertical that is.',
  },
  {
    q: 'What will it cost?',
    a: 'Pricing is not set yet. People on the waitlist get it before it is published.',
  },
  {
    q: 'I need a vertical that is not on the list.',
    a: 'Write it in the form, it counts as a vote. If you need it built now rather than later, we take on client projects on Payload Stack.',
  },
]

/**
 * Payload Stack Pro: the waitlist page. It lives on payload.solutions rather than
 * payloadstack.com because the licence will be bought through an account here; payloadstack.com
 * links in. The whole page carries the Stack accent (data-brand="stack"), so it reads as a
 * Payload Stack product on the umbrella site, as the Stack docs do.
 */
export default function ProPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1" data-brand="stack">
        <ThemeBand theme="dark" as="div" className="relative -mt-header pt-header">
          <GridColumns fadeTop />
          <section className="container-content col-grid gap-y-12 py-16 sm:py-20 lg:py-28" aria-labelledby="pro-heading">
            <div className="reveal-load-group lg:col-span-2 lg:pr-12">
              <Eyebrow className="mb-7">Payload Stack Pro · Waitlist</Eyebrow>
              <SplitLoad as="h1" id="pro-heading" className="display-xl text-balance">
                Start from the product, not the boilerplate.
              </SplitLoad>
              <p className="lead mt-7 max-w-[36rem] text-pretty">
                Payload Stack gives you sign-in, organizations and billing in one command. Pro adds
                the product on top: an AI chat app, a marketplace, a course platform or a feedback
                board, scaffolded into your repository and documented like the rest.
              </p>
              <div className="mt-11 border-t border-border">
                <ActionRow href="#verticals">See the verticals</ActionRow>
                <ActionRow href={stack.url} meta="free, MIT">
                  What is in Payload Stack
                </ActionRow>
              </div>
            </div>
            <div id="waitlist" className="scroll-mt-header min-w-0 lg:col-span-2">
              <WaitlistForm id="hero" source="pro:hero" />
            </div>
          </section>
        </ThemeBand>

        <div className="relative z-10 bg-bg">
          <CrtGrain />
          <GridColumns />

          {/* The verticals: the vote the form asks for, explained. */}
          <section id="verticals" className="scroll-mt-header relative hairline-t py-section" aria-labelledby="verticals-heading">
            <GridCross line={2} />
            <div className="container-content">
              <Reveal>
                <SectionHead
                  id="verticals-heading"
                  eyebrow="The verticals"
                  title="Whole products, one scaffolding step away."
                  lead="Each vertical is weeks of work you would otherwise write on top of the boilerplate. The waitlist votes decide the order."
                />
              </Reveal>
              <ul className="list-grid mt-14 col-grid">
                {PRO_VERTICALS.map((v, i) => (
                  <Reveal as="li" key={v.value} index={i} className="list-cell lg:col-span-2">
                    <div className="flex items-start justify-between gap-6">
                      <h3 className="display-sm">{v.label}</h3>
                      <StatusChip status="planned" />
                    </div>
                    <p className="mt-3 max-w-[48ch] text-pretty leading-relaxed text-fg-muted">{v.summary}</p>
                  </Reveal>
                ))}
              </ul>
            </div>
          </section>

          {/* Free vs Pro: answer "why would I pay" before it is asked. */}
          <section className="relative hairline-t py-section" aria-labelledby="layers-heading">
            <GridCross line={4} />
            <div className="container-content col-grid gap-y-12">
              <Reveal className="lg:col-span-2 lg:pr-12">
                <SectionHead
                  id="layers-heading"
                  eyebrow="Two layers"
                  title="The foundation stays free. Pro is the floor above it."
                  lead="Every SaaS needs the same foundation, so that part is open source. What differs between products is the product itself, and that is what Pro scaffolds."
                />
              </Reveal>
              <Reveal className="min-w-0 lg:col-span-2 lg:pt-2">
                <p className="label-mono">Payload Stack · free, MIT</p>
                <ul className="mt-4 border-t border-border">
                  {FREE.map((item) => (
                    <li key={item} className="border-b border-border py-3.5 text-[0.9375rem]">
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="label-mono mt-10">Payload Stack Pro · licence</p>
                <ul className="mt-4 border-t border-border">
                  {PRO_VERTICALS.map((v) => (
                    <li key={v.value} className="border-b border-border py-3.5 text-[0.9375rem]">
                      {v.label}
                    </li>
                  ))}
                  <li className="border-b border-border py-3.5 text-[0.9375rem] text-fg-muted">
                    More, in the order you vote for them
                  </li>
                </ul>
                <p className="mt-6 font-mono text-sm text-fg-muted">{NPX_COMMAND}</p>
              </Reveal>
            </div>
          </section>

          {/* How it will work. */}
          <section className="relative hairline-t py-section" aria-labelledby="how-heading">
            <GridCross line={1} />
            <div className="container-content">
              <Reveal>
                <SectionHead id="how-heading" eyebrow="How it will work" title="One licence, the command you already use." />
              </Reveal>
              <ol className="list-grid mt-14 col-grid">
                {STEPS.map((step, i) => (
                  <Reveal as="li" key={step.title} index={i} className={`list-cell ${i === 0 ? 'lg:col-span-2' : ''}`}>
                    <p className="label-mono">0{i + 1}</p>
                    <h3 className="display-sm mt-4">{step.title}</h3>
                    <p className="mt-3 max-w-[42ch] text-pretty leading-relaxed text-fg-muted">{step.body}</p>
                  </Reveal>
                ))}
              </ol>
            </div>
          </section>

          {/* Questions, then the second chance to sign up. */}
          <section className="relative hairline-t py-section" aria-labelledby="faq-heading">
            <GridCross line={4} />
            <div className="container-content col-grid gap-y-12">
              <div className="lg:col-span-2 lg:pr-12">
                <Reveal>
                  <SectionHead id="faq-heading" eyebrow="Questions" title="Before you join." />
                </Reveal>
                <dl className="mt-12">
                  {FAQ.map((item, i) => (
                    <Reveal key={item.q} index={i} className="border-t border-border py-6">
                      <dt className="display-sm">{item.q}</dt>
                      <dd className="mt-1.5 max-w-[46ch] text-pretty text-[0.9375rem] leading-relaxed text-fg-muted">
                        {item.a}
                      </dd>
                    </Reveal>
                  ))}
                </dl>
                <Reveal className="border-t border-border">
                  <ActionRow href="/#contact">Need it built now? Start a project</ActionRow>
                </Reveal>
              </div>
              <Reveal className="min-w-0 lg:col-span-2">
                <WaitlistForm id="closer" source="pro:closer" />
              </Reveal>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
