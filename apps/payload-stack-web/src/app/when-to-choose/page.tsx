import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Check, X } from '@phosphor-icons/react/dist/ssr'
import { SOLUTIONS_URL, brands } from '@payload-solutions/brand'
import { GridColumns } from '@payload-solutions/brand/grid-columns'
import { ActionRow, Eyebrow, SectionHead } from '@payload-solutions/brand/lattice'
import { ThemeBand } from '@payload-solutions/brand/theme-band'
import { CopyCommand } from '@/components/copy-command'
import { Reveal } from '@/components/reveal'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

const brand = brands.stack

const TITLE = 'When to choose Payload Stack'
const DESCRIPTION =
  'Payload Stack makes strong choices: Payload CMS as the backend, organizations as the unit of billing, Next.js and shadcn/ui in front. Which products those choices serve, and which they get in the way of.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/when-to-choose' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${brand.url}/when-to-choose` },
  twitter: { title: TITLE, description: DESCRIPTION },
}

interface Point {
  title: string
  body: ReactNode
}

const FIT: Point[] = [
  {
    title: 'You sell to teams.',
    body: 'Organizations, invitations, roles and seat-based Stripe billing are the parts every B2B product needs and every team rebuilds. Here they are connected on day one, and bridged into Payload’s multi-tenant plugin so each collection is scoped to the active organization in the app and in the admin.',
  },
  {
    title: 'You need a back office and would rather not build one.',
    body: 'Most starters stop at the customer dashboard and leave the internal admin to you. Payload generates it from the same collections: users, organizations, subscriptions, content and support tools, with roles and versions. It cannot drift from your schema because it is your schema.',
  },
  {
    title: 'You would have picked this frontend anyway.',
    body: 'Next.js, Tailwind and shadcn/ui. The components are copied into your repository, so you own them and change them, rather than configuring around a component library you cannot open.',
  },
  {
    title: 'You want to own the code.',
    body: 'MIT licensed and in your repository from the first commit. No licence fee for the boilerplate, no upgrade path that depends on someone else’s business, and a scaffold you can read end to end before you commit to it.',
  },
]

const NOT_FIT: Point[] = [
  {
    title: 'You want to write the backend from scratch.',
    body: 'Payload is opinionated. Data modelling, hooks and access control follow the Payload way, and the payoff comes from staying on it. If you would rather hand-roll routes in Express or Hono and choose every library yourself, the framework will feel like a constraint before it feels like a head start.',
  },
  {
    title: 'Your product has users, not teams.',
    body: (
      <>
        A consumer app where people sign up alone has no use for organizations. You can switch
        them off with <code className="text-fg">organizations.enabled: false</code> in{' '}
        <code className="text-fg">stack.config.ts</code>, and scoping falls back to per-user
        ownership, but a lighter starter may still serve a simple B2C product better.
      </>
    ),
  },
  {
    title: 'You want a managed backend.',
    body: 'Payload Stack runs on a database you own: PostgreSQL, MongoDB or SQLite, chosen at scaffold time. Hosted Postgres from Neon or Vercel makes that a few minutes of work, but it is not the Supabase or Firebase model, and it does not try to be.',
  },
]

const CHOOSE = [
  'Your users work in teams and pay per seat or per organization.',
  'You want a shadcn dashboard for customers and a Payload admin for your own staff, without building either.',
  'You are at home in Next.js and willing to learn Payload’s conventions.',
]

const ELSEWHERE = [
  'You are building a lightweight B2C app or a simple directory.',
  'You prefer Supabase or Firebase as the backend.',
  'You want a hand-built API with no framework in the way.',
]

function Points({ items, columns }: { items: Point[]; columns: 2 | 3 }) {
  return (
    <dl
      className={
        columns === 3
          ? 'list-grid mt-16 grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
          : 'list-grid mt-16 grid-cols-1 sm:grid-cols-2'
      }
    >
      {items.map((p, i) => (
        <Reveal
          key={p.title}
          index={i}
          /* Three items across four columns: the first takes two, so the row still closes
             on the far grid line. */
          className={`list-cell ${columns === 3 && i === 0 ? 'md:col-span-2' : ''}`}
        >
          <dt className="display-sm">{p.title}</dt>
          <dd className="mt-4 max-w-[48ch] text-pretty text-[0.9375rem] leading-relaxed text-fg-muted">
            {p.body}
          </dd>
        </Reveal>
      ))}
    </dl>
  )
}

function Opener() {
  return (
    <section className="container-content py-20 lg:py-28" aria-labelledby="fit-heading">
      <Eyebrow>Is it a fit?</Eyebrow>
      <h1 id="fit-heading" className="display-xl mt-7 max-w-[16ch]">
        When to choose Payload Stack.
      </h1>
      <p className="lead mt-7 max-w-[38rem]">
        It makes strong choices for you: Payload as the backend, organizations as the unit of
        billing, Next.js and shadcn/ui in front. Those choices are a head start for some products
        and dead weight for others. This page is for telling which one yours is.
      </p>
    </section>
  )
}

function Fit() {
  return (
    <section className="py-section" aria-labelledby="choose-heading">
      <div className="container-content">
        <Reveal>
          <SectionHead
            id="choose-heading"
            title="Choose it when."
            lead="The stack earns its keep where the hard parts of a SaaS are the parts around the product: tenancy, billing, the admin nobody wants to build."
          />
        </Reveal>
        <Points items={FIT} columns={2} />
      </div>
    </section>
  )
}

function NotFit() {
  return (
    <section className="hairline-t py-section" aria-labelledby="elsewhere-heading">
      <div className="container-content">
        <Reveal>
          <SectionHead
            id="elsewhere-heading"
            title="Look elsewhere when."
            lead="Every opinion in the stack is a cost for someone. These are the three that matter."
          />
        </Reveal>
        <Points items={NOT_FIT} columns={3} />
      </div>
    </section>
  )
}

function Verdict() {
  return (
    <section className="hairline-t py-section" aria-labelledby="verdict-heading">
      <div className="container-content">
        <Reveal>
          <SectionHead id="verdict-heading" title="The short version." />
        </Reveal>

        <Reveal className="list-grid mt-14 grid-cols-1 md:grid-cols-2">
          <div className="list-cell cell-tint">
            <h3 className="display-sm">Choose Payload Stack if</h3>
            <ul className="mt-6 space-y-4" role="list">
              {CHOOSE.map((item) => (
                <li key={item} className="flex gap-3 text-[0.9375rem] leading-relaxed">
                  <Check size={18} weight="bold" className="mt-1 shrink-0 text-accent" aria-hidden />
                  <span className="text-pretty">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="list-cell">
            <h3 className="display-sm">Choose something else if</h3>
            <ul className="mt-6 space-y-4" role="list">
              {ELSEWHERE.map((item) => (
                <li key={item} className="flex gap-3 text-[0.9375rem] leading-relaxed text-fg-muted">
                  <X size={18} weight="bold" className="mt-1 shrink-0 text-fg-subtle" aria-hidden />
                  <span className="text-pretty">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Decide() {
  return (
    <section className="hairline-t py-section" aria-labelledby="decide-heading">
      <div className="container-content col-grid gap-y-14">
        <Reveal className="lg:col-span-2 lg:pr-12">
          <SectionHead
            id="decide-heading"
            title="Still deciding? Scaffold it."
            lead="One command gives you a project you can read end to end. If the fit is wrong, you will know in fifteen minutes. If it is right, you are already past the hard part."
          />
        </Reveal>
        <Reveal className="min-w-0 lg:col-span-2 lg:pt-2">
          <div className="border-t border-border">
            <CopyCommand variant="row" />
            <ActionRow href={brand.docsUrl}>Documentation</ActionRow>
            <ActionRow href={`${SOLUTIONS_URL}/#contact`}>Ask us a question</ActionRow>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/**
 * The fit page: who the stack is for and who it is not for, in the site's one-band
 * composition. A short dark opener carries the question; the answer follows in the
 * visitor's theme.
 */
export default function WhenToChoosePage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <ThemeBand theme="dark" as="div" className="-mt-header pt-header">
          <GridColumns />
          <Opener />
        </ThemeBand>
        <div className="relative z-10 bg-bg">
          <GridColumns />
          <Fit />
          <NotFit />
          <Verdict />
          <Decide />
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
