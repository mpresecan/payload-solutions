import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Check, X } from '@phosphor-icons/react/dist/ssr'
import { SOLUTIONS_URL, brands } from '@payload-solutions/brand'
import { GridColumns } from '@payload-solutions/brand/grid-columns'
import { ThemeBand } from '@payload-solutions/brand/theme-band'
import { CopyCommand } from '@/components/copy-command'
import { Reveal } from '@/components/reveal'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { Button } from '@/components/ui/button'

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
          ? 'mt-14 grid grid-cols-1 gap-x-12 gap-y-12 md:grid-cols-3'
          : 'mt-14 grid grid-cols-1 gap-x-12 gap-y-12 sm:grid-cols-2'
      }
    >
      {items.map((p, i) => (
        <Reveal key={p.title} index={i} className="border-t border-border pt-6">
          <dt className="text-xl font-medium leading-snug tracking-tight">{p.title}</dt>
          <dd className="mt-3 max-w-[48ch] text-pretty text-[0.9375rem] leading-relaxed text-fg-muted">
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
      <p className="label-mono">Is it a fit?</p>
      <h1
        id="fit-heading"
        className="mt-6 max-w-3xl text-balance text-[2.75rem] font-medium leading-[1.02] tracking-display sm:text-5xl lg:text-6xl"
      >
        When to choose Payload Stack.
      </h1>
      <p className="mt-6 max-w-[38rem] text-pretty text-lg leading-relaxed text-fg-muted">
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
        <Reveal className="max-w-2xl">
          <h2
            id="choose-heading"
            className="text-balance text-3xl font-medium leading-[1.05] tracking-display sm:text-4xl lg:text-5xl"
          >
            Choose it when.
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-fg-muted">
            The stack earns its keep where the hard parts of a SaaS are the parts around the
            product: tenancy, billing, the admin nobody wants to build.
          </p>
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
        <Reveal className="max-w-2xl">
          <h2
            id="elsewhere-heading"
            className="text-balance text-3xl font-medium leading-[1.05] tracking-display sm:text-4xl lg:text-5xl"
          >
            Look elsewhere when.
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-fg-muted">
            Every opinion in the stack is a cost for someone. These are the three that matter.
          </p>
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
        <Reveal className="max-w-2xl">
          <h2
            id="verdict-heading"
            className="text-balance text-3xl font-medium leading-[1.05] tracking-display sm:text-4xl lg:text-5xl"
          >
            The short version.
          </h2>
        </Reveal>

        <Reveal className="mt-12 grid grid-cols-1 border border-border md:grid-cols-2">
          <div className="bg-accent-soft p-7 lg:p-9">
            <h3 className="text-xl font-medium leading-snug tracking-tight">
              Choose Payload Stack if
            </h3>
            <ul className="mt-6 space-y-4" role="list">
              {CHOOSE.map((item) => (
                <li key={item} className="flex gap-3 text-[0.9375rem] leading-relaxed">
                  <Check size={18} weight="bold" className="mt-1 shrink-0 text-accent" aria-hidden />
                  <span className="text-pretty">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-border bg-bg p-7 md:border-l md:border-t-0 lg:p-9">
            <h3 className="text-xl font-medium leading-snug tracking-tight">
              Choose something else if
            </h3>
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
    <section className="hairline-t" aria-labelledby="decide-heading">
      <div className="container-content py-section">
        <Reveal className="grid grid-cols-1 gap-10 border border-border bg-surface p-6 sm:p-8 lg:grid-cols-12 lg:items-end lg:gap-8 lg:p-12">
          <div className="lg:col-span-7">
            <h2
              id="decide-heading"
              className="text-balance text-3xl font-medium leading-[1.05] tracking-display sm:text-4xl"
            >
              Still deciding? Scaffold it.
            </h2>
            <p className="mt-5 max-w-[52ch] text-pretty text-lg leading-relaxed text-fg-muted">
              One command gives you a project you can read end to end. If the fit is wrong, you
              will know in fifteen minutes. If it is right, you are already past the hard part.
            </p>
          </div>
          <div className="flex min-w-0 flex-col items-start gap-3 lg:col-span-5 lg:items-end">
            <CopyCommand size="lg" className="w-full sm:w-auto" />
            <div className="flex flex-wrap gap-3">
              <Button href={brand.docsUrl} variant="secondary" arrow>
                Documentation
              </Button>
              <Button href={`${SOLUTIONS_URL}/#contact`} variant="ghost" arrow>
                Ask us
              </Button>
            </div>
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
