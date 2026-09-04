'use client'

import { useSession } from '@better-auth-ui/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { authClient } from '@/lib/auth/auth-client'

/**
 * Keeps server components in step with the active organization.
 *
 * Switching organizations happens on the client (the sidebar switcher, the Organizations settings
 * tab, creating or leaving an organization). Better Auth UI refreshes its own query caches, but
 * pages rendered on the server from the session (`tenantScope()`, `getActiveOrganization()`) would
 * keep showing the previous organization until a full reload. This component watches the session's
 * `activeOrganizationId` and asks Next.js to re-render the server tree when it changes.
 */
export function ActiveOrganizationSync() {
  const router = useRouter()
  const { data: session } = useSession(authClient)
  const activeOrganizationId =
    (session?.session as { activeOrganizationId?: string | null } | undefined)
      ?.activeOrganizationId ?? null
  const previous = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    // Wait for the first resolved session so the initial render never triggers a refresh.
    if (session === undefined) return
    if (previous.current === undefined) {
      previous.current = activeOrganizationId
      return
    }
    if (previous.current !== activeOrganizationId) {
      previous.current = activeOrganizationId
      router.refresh()
    }
  }, [session, activeOrganizationId, router])

  return null
}
