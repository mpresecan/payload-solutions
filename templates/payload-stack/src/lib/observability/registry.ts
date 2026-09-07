/**
 * Which adapter is live, per runtime.
 *
 * Nothing imports a vendor SDK at module scope: `src/instrumentation.ts` and
 * `src/instrumentation-client.ts` import their provider dynamically and register it here, so a
 * project with no provider configured never downloads or parses the SDK at all.
 */
import { consoleAdapter } from './adapters/console'
import { noopAdapter } from './adapters/noop'
import type { ObservabilityAdapter, Runtime } from './types'

let current: ObservabilityAdapter | null = null

export function setObservabilityAdapter(adapter: ObservabilityAdapter | null): void {
  current = adapter
}

export function currentRuntime(): Runtime {
  if (typeof window !== 'undefined') return 'browser'
  return process.env.NEXT_RUNTIME === 'edge' ? 'edge' : 'nodejs'
}

/**
 * The registered adapter, or a fallback: errors are printed in development so a missing provider
 * never means a silent failure, and dropped in production so no one pays for a provider they did
 * not configure.
 */
export function getObservabilityAdapter(): ObservabilityAdapter {
  if (current) return current
  return process.env.NODE_ENV === 'production' ? noopAdapter : consoleAdapter
}

/** The provider's name, for the health endpoint and for tests. */
export function observabilityProvider(): string {
  return getObservabilityAdapter().name
}
