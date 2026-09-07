import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { BillingNotConfigured } from '@/components/auth/billing/billing-not-configured'
import { Organization } from '@/components/auth/organization/organization'
import { billingReady } from '@/lib/env'
import stack from '@/stack.config'

/**
 * Active organization management: /dashboard/organization/settings, /people, /billing, /teams.
 */
const PATHS = new Set([
  'settings',
  'people',
  ...(stack.features.teams ? ['teams'] : []),
  ...(stack.features.billingAttachedTo === 'organization' ? ['billing'] : []),
])

type Params = { params: Promise<{ path: string }> }

export function generateStaticParams() {
  if (!stack.features.organizations) return []
  return [...PATHS].map((path) => ({ path }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { path } = await params
  return { title: `Organization ${path}` }
}

export default async function OrganizationPage({ params }: Params) {
  const { path } = await params
  if (!stack.features.organizations || !PATHS.has(path)) notFound()

  return (
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Organization</h1>
      {path === 'billing' && !billingReady ? <BillingNotConfigured /> : <Organization path={path} />}
    </div>
  )
}
