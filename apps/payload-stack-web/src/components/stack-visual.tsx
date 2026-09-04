'use client'

import { IsoStack, type IsoLayer } from '@payload-solutions/brand/iso-stack'

const LAYERS: IsoLayer[] = [
  {
    id: 'db',
    name: 'Database',
    detail: 'Chosen when you scaffold',
    cycle: ['PostgreSQL', 'MongoDB', 'SQLite', 'Vercel Postgres'],
    accent: true,
  },
  { id: 'payload', name: 'Payload CMS', detail: 'Collections, access control, jobs, admin' },
  { id: 'auth', name: 'Better Auth', detail: 'Sessions, passkeys, 2FA, social sign-in' },
  { id: 'orgs', name: 'Organizations', detail: 'Multi-tenant scoping, roles, invitations' },
  { id: 'billing', name: 'Stripe billing', detail: 'Plans, seats, trials, customer portal' },
  { id: 'ui', name: 'Next.js + shadcn/ui', detail: 'Dashboard, account, marketing pages' },
]

/** The Payload Stack, bottom to top. The database layer cycles through the adapters the CLI offers. */
export function StackVisual({ className }: { className?: string }) {
  return (
    <IsoStack
      className={className}
      layers={LAYERS}
      caption="The Payload Stack: a database of your choice (PostgreSQL, MongoDB, SQLite or Vercel Postgres), Payload CMS, Better Auth, organizations, Stripe billing, and a Next.js front end with shadcn/ui, connected by one configuration."
    />
  )
}
