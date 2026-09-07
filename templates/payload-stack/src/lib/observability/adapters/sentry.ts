/**
 * Sentry adapter.
 *
 * The Sentry module is passed in rather than imported, for two reasons: the SDK stays out of every
 * bundle that has no DSN configured, and this file compiles whether or not `@sentry/nextjs` is
 * installed. `SentryLike` is the slice of the SDK we use — the same instance is handed to
 * `@payloadcms/plugin-sentry` in payload.config.ts, so Payload's errors and the app's land in one
 * project with one set of breadcrumbs.
 *
 * The DSN alone is enough for error reporting. Source maps and client-side instrumentation
 * additionally need the build-time wrapper in next.config.ts (SENTRY_ORG / SENTRY_PROJECT /
 * SENTRY_AUTH_TOKEN); that part is build-time by nature and cannot be abstracted away.
 *
 * Self-hosting: GlitchTip and a self-hosted Sentry both speak this protocol, so pointing SENTRY_DSN
 * at either works with no code change.
 */
import type { Attributes, ErrorContext, Level, ObservabilityAdapter, ObservedUser } from '../types'

export interface SentryLike {
  captureException(error: unknown, captureContext?: Record<string, unknown>): string
  captureMessage(message: string, captureContext?: Record<string, unknown>): string
  setUser(user: Record<string, unknown> | null): void
  flush(timeout?: number): Promise<boolean>
  startSpan?<T>(options: { name: string; attributes?: Record<string, unknown> }, run: () => T): T
}

/** Our levels are already Sentry's, minus the ones we do not use. */
function toSentryLevel(level: Level | undefined): string {
  return level ?? 'error'
}

function toCaptureContext(context: ErrorContext | undefined): Record<string, unknown> | undefined {
  if (!context) return undefined
  const { user, tags, extra, request, fingerprint, level, source } = context
  return {
    level: toSentryLevel(level),
    ...(user ? { user: { id: user.id, ...(user.email ? { email: user.email } : {}), ...(user.name ? { username: user.name } : {}) } } : {}),
    tags: {
      ...(source ? { source } : {}),
      ...(user?.orgId ? { org_id: user.orgId } : {}),
      ...(user?.plan ? { plan: user.plan } : {}),
      ...(request?.routePath ? { route: request.routePath } : {}),
      ...(request?.routeType ? { route_type: request.routeType } : {}),
      ...tags,
    },
    ...(extra || request ? { contexts: { app: { ...extra }, ...(request ? { request } : {}) } } : {}),
    ...(fingerprint ? { fingerprint } : {}),
  }
}

export function createSentryAdapter(Sentry: SentryLike): ObservabilityAdapter {
  return {
    name: 'sentry',
    captureError(error: unknown, context?: ErrorContext) {
      Sentry.captureException(error, toCaptureContext(context))
    },
    captureMessage(message: string, level: Level, context?: ErrorContext) {
      Sentry.captureMessage(message, toCaptureContext({ ...context, level }))
    },
    identify(user: ObservedUser | null) {
      Sentry.setUser(
        user ? { id: user.id, ...(user.email ? { email: user.email } : {}), ...(user.orgId ? { org_id: user.orgId } : {}) } : null,
      )
    },
    async startSpan<T>(name: string, run: () => Promise<T>, attributes?: Attributes): Promise<T> {
      if (!Sentry.startSpan) return run()
      return Sentry.startSpan({ name, attributes }, run)
    },
    async flush(timeoutMs = 2_000) {
      await Sentry.flush(timeoutMs)
    },
  }
}
