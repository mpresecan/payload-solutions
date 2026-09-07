import type { ObservabilityAdapter } from '../types'

/** Production default when no provider is configured: costs nothing and never throws. */
export const noopAdapter: ObservabilityAdapter = {
  name: 'none',
  captureError() {},
  captureMessage() {},
  identify() {},
  async flush() {},
}
