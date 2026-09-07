'use client'
import type { ReactNode } from 'react'

import { consentModeDefaultScript, consentModeStateFrom, resolveConsent, type ConsentConfig, type ConsentExpr } from '@payload-solutions/consent-core'

import { useConsent, useConsentContext } from './context.js'

export type ConsentGateProps = {
  /** Category key or expression that must be granted. */
  category: ConsentExpr
  /** Rendered while not granted; receives nothing — use `useConsent().open('preferences')` inside to offer a way in. */
  fallback?: ReactNode
  children: ReactNode
}

/** Renders children only when the expression is granted. No DOM wrapper. */
export function ConsentGate({ category, fallback = null, children }: ConsentGateProps) {
  const { ready, has } = useConsent()
  if (!ready) return <>{children}</>
  return <>{has(category) ? children : fallback}</>
}

/**
 * Inline `gtag('consent','default', …)` computed from the resolved initial state. Render it in
 * `<head>` before any Google tag. Works as a Server Component: pass `config` and the cookie value.
 */
export function ConsentModeScript({ config, cookie, nonce, gpc = false }: { config: ConsentConfig; cookie?: string | null; nonce?: string; gpc?: boolean }) {
  if (!config.enabled || !config.consentMode.enabled) return null
  const resolved = resolveConsent(cookie, config, { gpc })
  const required = new Set(config.categories.filter((c) => c.required).map((c) => c.key))
  const state = consentModeStateFrom(config.categories, (k) => required.has(k) || resolved.decisions[k] === true)
  return <script nonce={nonce} data-consent-mode="" dangerouslySetInnerHTML={{ __html: consentModeDefaultScript(state, config.consentMode) }} />
}

/** Footer link/button that reopens the preferences dialog. Unstyled; pass `className`. */
export function ManageConsentButton({ className, children }: { className?: string; children?: ReactNode }) {
  const { ready, open, config } = useConsent()
  if (!ready) return null
  return (
    <button type="button" className={className} onClick={() => open('preferences')} data-consent-manage="">
      {children ?? config?.banner.labels.manage}
    </button>
  )
}

/** Mounts nothing; exists so the provider's loader can be disabled and re-enabled per subtree if needed. */
export function ConsentScripts() {
  useConsentContext()
  return null
}
