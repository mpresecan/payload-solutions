import type { ReactNode } from 'react'
import {
  Buildings,
  CreditCard,
  Fingerprint,
  ShieldCheck,
  SlidersHorizontal,
  SquaresFour,
} from '@phosphor-icons/react/dist/ssr'
import { Reveal } from '@/components/reveal'
import { cn } from '@/lib/cn'

interface Cell {
  id: string
  icon: ReactNode
  title: string
  body: string
  span: 1 | 2
  tint?: boolean
  extra?: ReactNode
}

function Chips({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item}
          className="border border-border px-2.5 py-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-fg-muted"
        >
          {item}
        </li>
      ))}
    </ul>
  )
}

const CELLS: Cell[] = [
  {
    id: 'auth',
    icon: <Fingerprint size={24} />,
    title: 'Authentication that covers the admin too',
    body: 'Better Auth handles sign-in for your app and for the Payload admin. One session, one users collection, no bridging code.',
    span: 2,
    extra: (
      <Chips
        items={['Email + password', 'Magic link', 'Passkeys', 'TOTP 2FA', 'Google', 'GitHub', 'Impersonation']}
      />
    ),
  },
  {
    id: 'orgs',
    icon: <Buildings size={24} />,
    title: 'Organizations',
    body: 'Users create organizations, invite members and switch between them. Every collection is scoped to the active organization, in the app and in the admin.',
    span: 1,
    tint: true,
  },
  {
    id: 'billing',
    icon: <CreditCard size={24} />,
    title: 'Subscriptions',
    body: 'Plans live in config, billed per user or per organization. Seats, trials, the Stripe customer portal and webhooks are already handled.',
    span: 1,
    extra: (
      <pre className="code-block mt-6 whitespace-pre-wrap border border-border bg-surface p-4 text-[0.75rem]">
        <code>
          <span className="tok-p">{'{ '}</span>
          <span className="tok-k">id</span>
          <span className="tok-p">: </span>
          <span className="tok-s">&apos;team&apos;</span>
          <span className="tok-p">, </span>
          <span className="tok-k">seats</span>
          <span className="tok-p">: </span>
          <span className="tok-s">25</span>
          <span className="tok-p">, </span>
          <span className="tok-k">trialDays</span>
          <span className="tok-p">: </span>
          <span className="tok-s">14</span>
          <span className="tok-p">{' }'}</span>
        </code>
      </pre>
    ),
  },
  {
    id: 'admin',
    icon: <ShieldCheck size={24} />,
    title: 'The back office is Payload',
    body: 'Users, organizations, subscriptions, content and support tools live in the Payload admin, with roles and versions. You never build an internal admin.',
    span: 2,
    extra: (
      <Chips items={['Super-admin', 'Tenant switcher', 'Versions', 'Audit log', 'Media library']} />
    ),
  },
  {
    id: 'dashboard',
    icon: <SquaresFour size={24} />,
    title: 'Dashboard and account',
    body: 'A shadcn sidebar layout, account and security settings, sessions, API keys, and onboarding: create an organization, invite people, pick a plan.',
    span: 1,
  },
  {
    id: 'config',
    icon: <SlidersHorizontal size={24} />,
    title: 'Config, email, legal, SEO',
    body: 'One typed config for name, plans, auth methods and feature flags. React Email templates, legal pages as a collection, metadata and sitemap included.',
    span: 2,
  },
]

export function Inside() {
  return (
    <section id="inside" className="scroll-mt-header py-section" aria-labelledby="inside-heading">
      <div className="container-content">
        <Reveal className="max-w-2xl">
          <h2 id="inside-heading" className="text-balance text-3xl font-medium leading-[1.05] tracking-display sm:text-4xl lg:text-5xl">
            Everything a SaaS needs on day one.
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-fg-muted">
            Not a demo app. The pieces every product ships, already connected, with nothing about
            anyone&apos;s particular business baked in.
          </p>
        </Reveal>

        <ul className="mt-14 grid grid-cols-1 gap-px border border-border bg-border md:grid-cols-3" role="list">
          {CELLS.map((cell, i) => (
            <Reveal
              as="li"
              key={cell.id}
              index={i}
              className={cn(
                'flex min-w-0 flex-col p-7 lg:p-9',
                cell.tint ? 'bg-accent-soft' : 'bg-bg',
                cell.span === 2 ? 'md:col-span-2' : '',
              )}
            >
              <div className={cell.tint ? 'text-accent' : 'text-fg'}>{cell.icon}</div>
              <h3 className="mt-6 text-xl font-medium leading-snug tracking-tight">{cell.title}</h3>
              <p className="mt-3 max-w-[50ch] text-pretty text-[0.9375rem] leading-relaxed text-fg-muted">
                {cell.body}
              </p>
              {cell.extra}
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
