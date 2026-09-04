import 'server-only'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'

import { paths } from '@/lib/paths'
import { getPayloadClient } from '@/lib/payload'

/**
 * Current Better Auth session for server components and route handlers, deduplicated per request.
 */
export const getSession = cache(async () => {
  const payload = await getPayloadClient()
  return payload.betterAuth.api.getSession({ headers: await headers() })
})

/** Like getSession, but redirects to sign-in (with a return URL) when there is no session. */
export async function requireSession(returnTo?: string) {
  const session = await getSession()
  if (!session) {
    const target = returnTo ? `${paths.auth.signIn}?redirectTo=${encodeURIComponent(returnTo)}` : paths.auth.signIn
    redirect(target)
  }
  return session
}

export function isSiteAdmin(session: Awaited<ReturnType<typeof getSession>>): boolean {
  const role = (session?.user as { role?: string[] | string | null } | undefined)?.role
  if (Array.isArray(role)) return role.includes('admin')
  return role === 'admin'
}
