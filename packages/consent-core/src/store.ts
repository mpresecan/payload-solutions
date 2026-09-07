import { encodeConsentCookie, modelToShort, sourceToShort } from './codec.js'
import { evaluateExpr } from './expr.js'
import { fallbackUuid, nonRequiredKeys, resolveConsent } from './resolve.js'
import { cookieStorage, setCookieStorageName } from './storage.js'
import type {
  ConsentConfig,
  ConsentExpr,
  ConsentRecordInput,
  ConsentSource,
  ConsentState,
  ConsentStore,
  ConsentStoreOptions,
} from './types.js'

const detectGPC = (): boolean =>
  typeof navigator !== 'undefined' && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true

function defaultRecorder(config: ConsentConfig) {
  return (input: ConsentRecordInput) => {
    if (!config.recording.enabled || typeof fetch !== 'function') return
    try {
      void fetch(config.recording.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
        keepalive: true,
        credentials: 'same-origin',
      }).catch(() => undefined)
    } catch {
      /* recording is best-effort */
    }
  }
}

function initialUi(state: Pick<ConsentState, 'status' | 'model'>): ConsentState['ui'] {
  if (state.status === 'decided') return 'closed'
  if (state.model === 'none') return 'closed'
  return 'banner'
}

/**
 * Creates the consent store. Framework-agnostic; `subscribe` is compatible with React's
 * `useSyncExternalStore`. All mutations are synchronous; side effects (cookie, record, events) run
 * after the state is updated.
 */
export function createConsentStore(options: ConsentStoreOptions): ConsentStore {
  const { config } = options
  const storage = options.storage ?? cookieStorage()
  setCookieStorageName(config.cookie.name)
  const now = options.now ?? (() => Math.floor(Date.now() / 1000))
  const uuid = options.uuid ?? (() => globalThis.crypto?.randomUUID?.() ?? fallbackUuid())
  const record = options.record ?? defaultRecorder(config)
  const gpc = options.gpc ?? detectGPC()

  const listeners = new Set<(state: ConsentState) => void>()
  const changeListeners = new Set<(decisions: Record<string, boolean>, previous: Record<string, boolean>) => void>()
  const requiredKeys = new Set(config.categories.filter((c) => c.required).map((c) => c.key))

  const readInitial = (raw: string | null | undefined): ConsentState => {
    const resolved = resolveConsent(raw, config, { gpc, now: now(), uuid })
    return {
      status: resolved.status,
      model: resolved.model,
      decisions: resolved.decisions,
      draft: { ...resolved.decisions },
      ui: initialUi(resolved),
      repromptReason: resolved.repromptReason,
      gpc,
      needsReload: false,
      consentId: resolved.consentId,
      decidedAt: resolved.decidedAt,
      source: resolved.source,
    }
  }

  let state = readInitial(options.initialCookie !== undefined ? options.initialCookie : storage.read())

  const emit = () => listeners.forEach((l) => l(state))
  const set = (patch: Partial<ConsentState>) => {
    state = { ...state, ...patch }
    emit()
  }
  const granted = (key: string) => requiredKeys.has(key) || state.decisions[key] === true

  const persist = () => {
    storage.write(
      encodeConsentCookie({
        v: 1,
        id: state.consentId,
        d: Object.fromEntries(Object.entries(state.decisions).map(([k, v]) => [k, v ? 1 : 0])) as Record<string, 0 | 1>,
        t: state.decidedAt ?? now(),
        pv: config.versions.policyVersion,
        cv: config.versions.categoriesVersion,
        tv: config.versions.trackersVersion,
        dv: config.versions.documentsVersion,
        j: modelToShort(state.model),
        s: sourceToShort(state.source ?? 'banner'),
      }),
      { maxAgeDays: config.cookie.maxAgeDays, domain: config.cookie.domain, sameSite: config.cookie.sameSite, name: config.cookie.name },
    )
  }

  const commit = (decisions: Record<string, boolean>, source: ConsentSource) => {
    const previous = state.decisions
    const revoked = Object.keys(previous).some((k) => previous[k] === true && decisions[k] !== true)
    const needsReload = state.needsReload || (state.status !== 'undecided' && revoked)
    set({
      status: 'decided',
      decisions,
      draft: { ...decisions },
      ui: 'closed',
      repromptReason: null,
      decidedAt: now(),
      source,
      needsReload,
    })
    persist()
    if (source !== 'implicit' || config.recording.enabled) {
      record({
        consentId: state.consentId,
        decisions,
        versions: config.versions,
        source,
        locale: config.locale,
      })
    }
    changeListeners.forEach((l) => l(decisions, previous))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('consentchange', { detail: { decisions, previous, source } }))
    }
  }

  const allTo = (value: boolean) => Object.fromEntries(nonRequiredKeys(config).map((k) => [k, value]))

  const onStorage = (event: StorageEvent) => {
    if (event.key === `${config.cookie.name}:sync`) store.refresh()
  }
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)

  const store: ConsentStore = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    onChange(listener) {
      changeListeners.add(listener)
      return () => changeListeners.delete(listener)
    },
    has: (expr: ConsentExpr) => evaluateExpr(expr, granted),
    isRequired: (key) => requiredKeys.has(key),
    acceptAll: () => commit(allTo(true), 'banner'),
    rejectAll: () => commit(allTo(false), 'banner'),
    withdraw() {
      set({ consentId: uuid() })
      commit(allTo(false), 'withdraw')
    },
    toggle(key, value) {
      if (requiredKeys.has(key) || !(key in state.draft)) return
      set({ draft: { ...state.draft, [key]: value ?? !state.draft[key] } })
    },
    save: () => commit({ ...state.draft }, 'preferences'),
    dismiss() {
      // Closing the banner without a choice: under notice/none the defaults stand and are stored as implicit;
      // under opt-in/opt-out nothing is stored, the banner simply hides for this page view.
      if (state.model === 'notice' || state.model === 'none') commit({ ...state.decisions }, 'implicit')
      else set({ ui: 'closed' })
    },
    open(ui) {
      set({ ui, draft: { ...state.decisions } })
    },
    close: () => set({ ui: 'closed', draft: { ...state.decisions } }),
    refresh() {
      const next = readInitial(storage.read())
      const previous = state.decisions
      state = { ...next, needsReload: state.needsReload, ui: state.ui === 'preferences' ? 'preferences' : next.ui }
      emit()
      if (JSON.stringify(previous) !== JSON.stringify(state.decisions)) changeListeners.forEach((l) => l(state.decisions, previous))
    },
    destroy() {
      if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
      listeners.clear()
      changeListeners.clear()
    },
  }
  return store
}
