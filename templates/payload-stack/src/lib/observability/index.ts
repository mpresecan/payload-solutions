/**
 * Report errors from here, never from a vendor SDK.
 *
 * `import { captureError } from '@/lib/observability'` works in server components, route handlers,
 * server actions, Payload hooks and client components alike. Which provider receives the event is
 * decided once, in src/instrumentation.ts and src/instrumentation-client.ts.
 *
 * Guarantees this layer makes, so callers never have to think about them:
 *   - it never throws — a broken provider must not turn a 200 into a 500;
 *   - it scrubs secrets and (unless observability.sendPII is on) personal data before the adapter
 *     sees them;
 *   - it applies observability.sampleRate, so cost control does not depend on the provider.
 */
import stack from '@/stack.config'

import { redactContext } from './redact'
import { getObservabilityAdapter } from './registry'
import type { Attributes, ErrorContext, Level, ObservedUser } from './types'

export * from './types'
export { setObservabilityAdapter, observabilityProvider, currentRuntime } from './registry'

const policy = stack.observability

/**
 * observability.sampleRate throttles the noisy levels only. Errors and fatals always go through:
 * sampling the thing you are paged for is how an incident stays invisible.
 */
function sampled(level: Level | undefined): boolean {
  if (level === undefined || level === 'error' || level === 'fatal') return true
  return policy.sampleRate >= 1 || Math.random() < policy.sampleRate
}

/** Report an error. Safe to call anywhere, including inside a catch that must not fail. */
export function captureError(error: unknown, context?: ErrorContext): void {
  try {
    if (!sampled(context?.level)) return
    getObservabilityAdapter().captureError(error, redactContext(context, policy.sendPII))
  } catch {
    // An observability failure is never worth an application failure.
  }
}

/** Report something noteworthy that is not an exception (a webhook signature mismatch, say). */
export function captureMessage(message: string, level: Level = 'info', context?: ErrorContext): void {
  try {
    if (!sampled(level)) return
    const adapter = getObservabilityAdapter()
    adapter.captureMessage?.(message, level, redactContext(context, policy.sendPII))
  } catch {
    /* ignore */
  }
}

/** Attach the signed-in user to subsequent events. Call with null on sign-out. */
export function identifyUser(user: ObservedUser | null): void {
  try {
    getObservabilityAdapter().identify?.(user ? (redactContext({ user }, policy.sendPII)?.user ?? null) : null)
  } catch {
    /* ignore */
  }
}

/**
 * Deliver buffered events. Serverless runtimes freeze as soon as the response is written, so call
 * this before returning from anything that reported an error — `withErrorReporting` does it for you.
 */
export async function flushObservability(timeoutMs = 2_000): Promise<void> {
  try {
    await getObservabilityAdapter().flush?.(timeoutMs)
  } catch {
    /* ignore */
  }
}

/** Trace a unit of work when the provider supports spans; otherwise just runs it. */
export async function withSpan<T>(name: string, run: () => Promise<T>, attributes?: Attributes): Promise<T> {
  const adapter = getObservabilityAdapter()
  if (!adapter.startSpan) return run()
  return adapter.startSpan(name, run, attributes)
}

/**
 * Wrap a server action, route handler or webhook: the error is reported with `source`, flushed, and
 * then rethrown so your own error handling is unchanged.
 *
 *   export const POST = withErrorReporting('stripe-webhook', async (req) => { ... })
 */
export function withErrorReporting<Args extends unknown[], Result>(
  source: string,
  handler: (...args: Args) => Promise<Result>,
  context?: Omit<ErrorContext, 'source'>,
): (...args: Args) => Promise<Result> {
  return async (...args: Args) => {
    try {
      return await handler(...args)
    } catch (error) {
      captureError(error, { ...context, source })
      await flushObservability()
      throw error
    }
  }
}
