import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Settings } from '@/components/auth/settings/settings'
import stack from '@/stack.config'

/**
 * Account settings: /dashboard/settings/account, /security, /organizations, /billing.
 * Tabs come from the Better Auth UI plugins enabled in components/providers.tsx.
 */
const PATHS = new Set(['account', 'security', ...(stack.features.organizations ? ['organizations'] : []), ...(stack.features.billingAttachedTo === 'user' ? ['billing'] : [])])

type Params = { params: Promise<{ path: string }> }

export function generateStaticParams() {
  return [...PATHS].map((path) => ({ path }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { path } = await params
  return { title: `${path.charAt(0).toUpperCase()}${path.slice(1)} settings` }
}

export default async function SettingsPage({ params }: Params) {
  const { path } = await params
  if (!PATHS.has(path)) notFound()

  return (
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Settings</h1>
      <Settings path={path} />
    </div>
  )
}
