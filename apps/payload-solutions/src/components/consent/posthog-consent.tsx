'use client'

import { useConsent } from '@payload-solutions/consent-react'
import posthog from 'posthog-js'
import { useEffect } from 'react'

/**
 * Starts and stops PostHog capture with the visitor's analytics choice.
 *
 * instrumentation-client.ts initialises PostHog opted out and in memory only, so nothing is stored
 * or sent before a decision. PostHog remembers the opt-in itself, which is how the admin (outside
 * this provider) keeps capturing for someone who has already agreed.
 */
export function PostHogConsent() {
  const { ready, has } = useConsent()
  const allowed = ready && has('analytics')

  useEffect(() => {
    if (!ready || !posthog.__loaded) return
    if (allowed) {
      posthog.set_config({ persistence: 'localStorage+cookie' })
      posthog.opt_in_capturing()
    } else if (posthog.has_opted_in_capturing()) {
      // Revoked: stop capturing and drop the identifiers PostHog stored while it was allowed.
      posthog.opt_out_capturing()
      posthog.reset()
      posthog.set_config({ persistence: 'memory' })
    }
  }, [ready, allowed])

  return null
}
