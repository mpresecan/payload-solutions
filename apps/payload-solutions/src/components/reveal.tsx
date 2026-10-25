'use client'

import { useAuth } from '@payloadcms/ui'
import posthog from 'posthog-js'
import { useEffect, useRef, type ReactNode } from 'react'

/** The shared enter-on-scroll motion lives in the brand package so every site moves alike. */
export { Reveal } from '@payload-solutions/brand/reveal'
export type { RevealProps, RevealVariant } from '@payload-solutions/brand/reveal'

type AdminUser = {
  email: string
  id: number
  name?: string | null
}

export function PostHogIdentify({ children }: { children?: ReactNode }) {
  const { user } = useAuth<AdminUser>()
  const identifiedUserId = useRef<string | null>(null)

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || !process.env.NEXT_PUBLIC_POSTHOG_HOST) return

    if (!user) {
      if (identifiedUserId.current) {
        posthog.reset()
        identifiedUserId.current = null
      }
      return
    }

    const userId = String(user.id)

    if (identifiedUserId.current === userId) return

    if (identifiedUserId.current) posthog.reset()

    posthog.identify(userId, {
      email: user.email,
      name: user.name ?? undefined,
    })
    identifiedUserId.current = userId
  }, [user])

  return children
}
