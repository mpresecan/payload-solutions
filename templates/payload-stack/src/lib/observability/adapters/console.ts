import type { ErrorContext, Level, ObservabilityAdapter } from '../types'

/**
 * Development default. Prints what a real provider would have received, so you can see the shape of
 * an event — tags, request, scrubbed user — before wiring a vendor up.
 */
export const consoleAdapter: ObservabilityAdapter = {
  name: 'console',
  captureError(error: unknown, context?: ErrorContext) {
    console.error('[observability]', error, context ?? {})
  },
  captureMessage(message: string, level: Level, context?: ErrorContext) {
    const log = level === 'error' || level === 'fatal' ? console.error : console.warn
    log(`[observability] ${level}: ${message}`, context ?? {})
  },
  identify(user) {
    console.debug('[observability] identify', user)
  },
  async flush() {},
}
