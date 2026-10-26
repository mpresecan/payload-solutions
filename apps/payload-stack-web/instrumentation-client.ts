import posthog from 'posthog-js'

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST

if (!projectToken || !posthogHost) {
  if (process.env.NODE_ENV === 'development') {
    const missingVariable = !projectToken
      ? 'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN'
      : 'NEXT_PUBLIC_POSTHOG_HOST'

    throw new Error(
      `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
    )
  }
} else {
  // A visitor who agreed on an earlier visit has to start on real persistence. Starting in memory
  // and switching later makes PostHog save the fresh in-memory identity over the stored one, so
  // every page load counted as a new visitor. The key and value are posthog-js's own opt-in record.
  let optedIn = false
  try {
    optedIn = localStorage.getItem(`__ph_opt_in_out_${projectToken}`) === '1'
  } catch {}

  // Nothing is captured or stored until the visitor grants the analytics category; the
  // opt-in itself is driven by PostHogConsent (src/components/consent/posthog-consent.tsx).
  posthog.init(projectToken, {
    api_host: posthogHost,
    defaults: '2026-01-30',
    capture_exceptions: true,
    debug: process.env.NODE_ENV === 'development',
    opt_out_capturing_by_default: true,
    persistence: optedIn ? 'localStorage+cookie' : 'memory',
    logs: {
      serviceName: 'payload-stack-web',
      environment: process.env.NODE_ENV,
    },
  })
}
