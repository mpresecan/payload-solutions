import type { ReactNode } from 'react'

/**
 * Where the consent layer would go.
 *
 * Without Payload Consent there is no banner, no Google Consent Mode default, and no third-party
 * script waiting on a category, so both components are pass-throughs and the frontend layout reads
 * the same in both projects.
 */

/** Rendered inside `<head>`, before any third-party tag. */
export function ConsentHead() {
  return null
}

/** Wraps the whole frontend: the consent store, the injected scripts and the banner. */
export function ConsentRoot({ children }: { children: ReactNode }) {
  return <>{children}</>
}
