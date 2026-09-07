/**
 * Unit tests never touch the developer's .env: the minimum `src/lib/env.ts` needs is set here so
 * server modules import cleanly, and every other variable starts unset. Tests that depend on a
 * variable stub it explicitly with `vi.stubEnv` (see tests/helpers/env.ts).
 */
import { afterEach, vi } from 'vitest'

for (const key of Object.keys(process.env)) {
  if (
    key.startsWith('STRIPE_') ||
    key.startsWith('NEXT_PUBLIC_STRIPE_') ||
    key.startsWith('RESEND_') ||
    key.startsWith('EMAIL_') ||
    /^(GOOGLE|GITHUB|MICROSOFT|APPLE|DISCORD)_CLIENT_(ID|SECRET)$/.test(key)
  ) {
    delete process.env[key]
  }
}

vi.stubEnv('NODE_ENV', 'test')
process.env.DATABASE_URL ??= 'postgres://postgres:postgres@127.0.0.1:5432/payload-stack-unit'
process.env.PAYLOAD_SECRET ??= 'unit-test-payload-secret'
process.env.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

// Browser APIs jsdom does not implement but shadcn / next-themes / Radix touch on mount.
if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList
  }
  if (!('ResizeObserver' in window)) {
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.assign(window, { ResizeObserver })
  }
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
}
