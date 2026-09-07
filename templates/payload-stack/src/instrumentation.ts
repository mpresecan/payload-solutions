/**
 * Server startup hook (Next.js runs this once per runtime, before anything else).
 *
 * Two jobs: choose the observability provider for this runtime, and funnel every server-side error
 * Next.js catches — server components, route handlers, server actions, middleware — through the
 * facade.
 *
 * process.env is read directly instead of `@/lib/env`: this module is also bundled for the edge
 * runtime, where the full environment schema (DATABASE_URL and friends) is neither present nor
 * needed to decide whether to report errors.
 */
import type { Instrumentation } from 'next'

export async function register(): Promise<void> {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  const [{ setObservabilityAdapter }, { createSentryAdapter }, Sentry] = await Promise.all([
    import('@/lib/observability/registry'),
    import('@/lib/observability/adapters/sentry'),
    import('@sentry/nextjs'),
  ])

  const { default: stack } = await import('@/stack.config')

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? stack.observability.environment ?? process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: stack.observability.tracesSampleRate,
    // The facade decides what personal data an event may carry; the SDK must not add its own.
    sendDefaultPii: stack.observability.sendPII,
  })

  setObservabilityAdapter(createSentryAdapter(Sentry))
}

/**
 * Every uncaught server error passes through here. Report it once, centrally, instead of dotting
 * try/catch through the app.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { captureError, flushObservability } = await import('@/lib/observability')

  captureError(error, {
    source: 'next-request',
    level: 'error',
    request: {
      method: request.method,
      path: request.path,
      headers: request.headers as Record<string, string>,
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
    },
  })

  await flushObservability()
}
