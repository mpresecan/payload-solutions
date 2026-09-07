/**
 * Browser startup hook. Runs before the app hydrates.
 *
 * Nothing is imported statically, so a project with no NEXT_PUBLIC_SENTRY_DSN never downloads the
 * SDK: the provider arrives in its own chunk, requested only when a DSN is configured.
 *
 * Error monitoring here carries no personal data and sets no cookies while
 * `observability.sendPII` is false, which is why it is not gated behind the consent banner. Turn
 * sendPII on and that changes — say so in your privacy policy and gate it accordingly.
 */
export async function register(): Promise<void> {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return

  const [{ setObservabilityAdapter }, { createSentryAdapter }, Sentry] = await Promise.all([
    import('@/lib/observability/registry'),
    import('@/lib/observability/adapters/sentry'),
    import('@sentry/nextjs'),
  ])

  const { default: stack } = await import('@/stack.config')

  Sentry.init({
    dsn,
    environment: stack.observability.environment ?? process.env.NODE_ENV,
    tracesSampleRate: stack.observability.tracesSampleRate,
    sendDefaultPii: stack.observability.sendPII,
  })

  setObservabilityAdapter(createSentryAdapter(Sentry))
}

void register()
