/**
 * Bring your own provider.
 *
 * Fill this in and register it from `src/instrumentation.ts` / `src/instrumentation-client.ts`
 * instead of the Sentry adapter. Anything with an HTTP ingest endpoint works — an OTLP collector,
 * GlitchTip, Highlight, Axiom, a Slack webhook, or a row in your own Payload collection.
 *
 * Rules the facade relies on: never throw, never block the request, and flush before the runtime
 * freezes on serverless.
 */
import type { ErrorContext, ObservabilityAdapter } from '../types'

export function createCustomAdapter(options: { endpoint: string; headers?: Record<string, string> }): ObservabilityAdapter {
  const queue: unknown[] = []

  const send = async () => {
    if (queue.length === 0) return
    const batch = queue.splice(0, queue.length)
    await fetch(options.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...options.headers },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    })
  }

  return {
    name: 'custom',
    captureError(error: unknown, context?: ErrorContext) {
      const err = error instanceof Error ? error : new Error(String(error))
      queue.push({
        timestamp: new Date().toISOString(),
        level: context?.level ?? 'error',
        message: err.message,
        stack: err.stack,
        ...context,
      })
      void send()
    },
    async flush() {
      await send()
    },
  }
}
