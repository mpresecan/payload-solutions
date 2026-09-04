import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Admin } from '@/components/auth/admin/admin'
import { getSession, isSiteAdmin } from '@/lib/auth/session'

/**
 * Lightweight in-app user administration (list, ban, impersonate) for site admins.
 * The Payload admin at /admin remains the full back office.
 */
const PATHS = new Set(['users'])

type Params = { params: Promise<{ path: string }> }

export const metadata: Metadata = { title: 'Admin' }

export default async function AdminPage({ params }: Params) {
  const { path } = await params
  const session = await getSession()
  if (!PATHS.has(path) || !isSiteAdmin(session)) notFound()

  return (
    <div className="mx-auto w-full max-w-6xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Users</h1>
      <Admin path={path} />
    </div>
  )
}
