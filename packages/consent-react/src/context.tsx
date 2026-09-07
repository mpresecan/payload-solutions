'use client'
import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'

import {
  attachLoader,
  consentModeStateFrom,
  createConsentStore,
  emitConsentModeUpdate,
  type ConsentConfig,
  type ConsentExpr,
  type ConsentState,
  type ConsentStore,
  type ConsentStoreOptions,
} from '@payload-solutions/consent-core'

type ConsentContextValue = { store: ConsentStore; config: ConsentConfig; nonce?: string }

const ConsentContext = createContext<ConsentContextValue | null>(null)

export type ConsentProviderProps = {
  /** Config from `getConsentConfig()` (server) or fetched from `/api/consent/config`. */
  config?: ConsentConfig
  /** Fetch the config from this URL when `config` is not given (non-Next React apps). */
  configUrl?: string
  /** Cookie value read on the server so the first client render matches SSR. */
  initialCookie?: string | null
  /** CSP nonce applied to injected scripts. */
  nonce?: string
  /** Disable the built-in script loader (when you inject trackers yourself). */
  loadScripts?: boolean
  storeOptions?: Omit<ConsentStoreOptions, 'config' | 'initialCookie'>
  children: ReactNode
}

/**
 * Provides the consent store. Client component; place it in the root layout and pass the
 * server-read cookie to avoid a flash of the banner.
 */
export function ConsentProvider({ config: configProp, configUrl, initialCookie, nonce, loadScripts = true, storeOptions, children }: ConsentProviderProps) {
  const [fetched, setFetched] = useState<ConsentConfig | null>(null)
  const config = configProp ?? fetched

  useEffect(() => {
    if (configProp || !configUrl) return
    let cancelled = false
    fetch(configUrl, { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data: ConsentConfig) => {
        if (!cancelled) setFetched(data)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [configProp, configUrl])

  const storeRef = useRef<ConsentStore | null>(null)
  const store = useMemo(() => {
    storeRef.current?.destroy()
    if (!config) return null
    const created = createConsentStore({ config, initialCookie, ...storeOptions })
    storeRef.current = created
    return created
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config])

  useEffect(() => () => storeRef.current?.destroy(), [])

  // Script loader + Consent Mode updates live for the lifetime of the store.
  useEffect(() => {
    if (!store || !config) return
    const detachers: Array<() => void> = []
    if (loadScripts) detachers.push(attachLoader(store, config.trackers, { nonce }))
    if (config.consentMode.enabled) {
      detachers.push(store.onChange(() => emitConsentModeUpdate(consentModeStateFrom(config.categories, (k) => store.has(k)))))
    }
    return () => detachers.forEach((d) => d())
  }, [store, config, loadScripts, nonce])

  const value = useMemo(() => (store && config ? { store, config, nonce } : null), [store, config, nonce])
  if (!value || !config?.enabled) return <>{children}</>
  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
}

export function useConsentContext(): ConsentContextValue | null {
  return useContext(ConsentContext)
}

function useStoreState(store: ConsentStore | null): ConsentState | null {
  return useSyncExternalStore(
    (cb) => (store ? store.subscribe(cb) : () => undefined),
    () => (store ? store.getState() : null),
    () => (store ? store.getState() : null),
  )
}

export type UseConsentResult = {
  ready: boolean
  config: ConsentConfig | null
  state: ConsentState | null
  has: (expr: ConsentExpr) => boolean
  acceptAll: () => void
  rejectAll: () => void
  withdraw: () => void
  toggle: (key: string, value?: boolean) => void
  save: () => void
  dismiss: () => void
  open: (ui: 'banner' | 'preferences') => void
  close: () => void
}

const noop = () => undefined

/** State and actions of the consent store. Outside a provider (consent disabled) everything is granted-as-required and actions are no-ops. */
export function useConsent(): UseConsentResult {
  const ctx = useConsentContext()
  const state = useStoreState(ctx?.store ?? null)
  if (!ctx || !state) {
    return { ready: false, config: null, state: null, has: () => false, acceptAll: noop, rejectAll: noop, withdraw: noop, toggle: noop, save: noop, dismiss: noop, open: noop, close: noop }
  }
  const { store, config } = ctx
  return {
    ready: true,
    config,
    state,
    has: store.has,
    acceptAll: store.acceptAll,
    rejectAll: store.rejectAll,
    withdraw: store.withdraw,
    toggle: store.toggle,
    save: store.save,
    dismiss: store.dismiss,
    open: store.open,
    close: store.close,
  }
}

/** One category: is it granted, is it required, and a draft toggle for preferences UIs. */
export function useCategory(key: string) {
  const { state, has, toggle, config } = useConsent()
  const category = config?.categories.find((c) => c.key === key) ?? null
  return {
    category,
    granted: has(key),
    draft: category?.required ? true : (state?.draft[key] ?? false),
    required: Boolean(category?.required),
    toggle: (value?: boolean) => toggle(key, value),
  }
}

/** Boolean for an expression, re-rendering on change. */
export function useHasConsent(expr: ConsentExpr): boolean {
  return useConsent().has(expr)
}
