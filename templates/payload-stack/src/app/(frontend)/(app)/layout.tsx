import { ensureSessionServer } from '@better-auth-ui/core/server'
import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { paths } from '@/lib/paths'
import { getPayloadClient } from '@/lib/payload'
import { getQueryClient } from '@/lib/query-client'

/**
 * Everything under (app) requires a session. The session is fetched once on the server and
 * hydrated into TanStack Query, so Better Auth UI components render without a loading flash.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient()
  const payload = await getPayloadClient()
  const requestHeaders = await headers()

  const session = await ensureSessionServer(queryClient, payload.betterAuth, { headers: requestHeaders })
  if (!session) {
    const current = requestHeaders.get('x-invoke-path') ?? paths.dashboard.home
    redirect(`${paths.auth.signIn}?redirectTo=${encodeURIComponent(current)}`)
  }

  return <HydrationBoundary state={dehydrate(queryClient)}>{children}</HydrationBoundary>
}
