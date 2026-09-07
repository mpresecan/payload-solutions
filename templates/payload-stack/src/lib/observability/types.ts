/**
 * The observability port.
 *
 * Everything in the template reports through this interface, never through a vendor SDK directly,
 * so the provider is one file swap: implement `ObservabilityAdapter` and register it from
 * `src/instrumentation.ts` (server) or `src/instrumentation-client.ts` (browser).
 *
 * Attribute names follow OpenTelemetry semantic conventions (`http.request.method`, `url.path`,
 * `user.id`) rather than a vocabulary of our own, so an OTLP, Sentry, PostHog or self-hosted
 * backend all receive something they already understand.
 */

/** Severity, ordered the way every backend orders it. */
export type Level = 'fatal' | 'error' | 'warning' | 'info' | 'debug'

/** Low-cardinality values only: backends index these. */
export type Attributes = Record<string, string | number | boolean | null | undefined>

export type Runtime = 'nodejs' | 'edge' | 'browser'

export interface ObservedUser {
  id: string
  /** Active organization, when organizations are enabled. */
  orgId?: string
  /** Active plan id, useful for grouping incidents by tier. */
  plan?: string
  /** Dropped by the facade unless observability.sendPII is true in stack.config.ts. */
  email?: string
  /** Dropped by the facade unless observability.sendPII is true in stack.config.ts. */
  name?: string
}

export interface RequestContext {
  /** http.request.method */
  method?: string
  /** url.path */
  path?: string
  /** Next.js router that produced the error: 'Pages Router' | 'App Router'. */
  routerKind?: string
  /** Matched route, e.g. /dashboard/projects/[id]. */
  routePath?: string
  /** 'render' | 'route' | 'action' | 'middleware'. */
  routeType?: string
  /** Scrubbed by the facade before it reaches the adapter. */
  headers?: Record<string, string>
}

export interface ErrorContext {
  /** Free-form origin label, e.g. 'stripe-webhook', 'server-action', 'react-error-boundary'. */
  source?: string
  level?: Level
  user?: ObservedUser | null
  /** Indexed labels. Keep the value set small: plan ids yes, user ids no. */
  tags?: Attributes
  /** Anything else worth attaching to the event body. Scrubbed, never indexed. */
  extra?: Record<string, unknown>
  request?: RequestContext
  /** Overrides the backend's automatic grouping. Use sparingly. */
  fingerprint?: string[]
}

/**
 * A provider implementation. Only `name` and `captureError` are required; the facade degrades
 * gracefully when the rest are missing, so a five-line adapter is a legitimate adapter.
 */
export interface ObservabilityAdapter {
  /** Shown in logs and in the health endpoint so you can see which provider is live. */
  name: string
  captureError(error: unknown, context?: ErrorContext): void
  captureMessage?(message: string, level: Level, context?: ErrorContext): void
  /** Called after sign-in and on sign-out (`null`). */
  identify?(user: ObservedUser | null): void
  /** Wrap a unit of work in a span. Implement only if the provider does tracing. */
  startSpan?<T>(name: string, run: () => Promise<T>, attributes?: Attributes): Promise<T>
  /**
   * Deliver buffered events. Serverless runtimes freeze the isolate as soon as the response is
   * sent, so anything not flushed is lost: the facade awaits this before a request finishes.
   */
  flush?(timeoutMs?: number): Promise<void>
}
