import type { ConsentStore, ConsentTracker } from './types.js'

const ATTR = 'data-consent-tracker'

export type LoaderOptions = {
  nonce?: string
  /** Where to append scripts. Defaults to `document.head`. */
  target?: HTMLElement
  document?: Document
}

/** Injects one tracker's script if it has not been injected yet. Returns true when a script was added. */
export function injectTracker(tracker: ConsentTracker, options: LoaderOptions = {}): boolean {
  const doc = options.document ?? (typeof document !== 'undefined' ? document : undefined)
  if (!doc || !tracker.loader) return false
  if (tracker.kind !== 'script' && tracker.kind !== 'pixel') return false
  if (doc.querySelector(`script[${ATTR}="${tracker.id}"]`)) return false
  const { src, inline, attributes } = tracker.loader
  if (!src && !inline) return false

  const script = doc.createElement('script')
  script.setAttribute(ATTR, tracker.id)
  if (options.nonce) script.setAttribute('nonce', options.nonce)
  if (attributes) for (const [k, v] of Object.entries(attributes)) script.setAttribute(k, v)
  if (src) {
    script.src = src
    script.async = true
  } else if (inline) {
    script.textContent = inline
  }
  ;(options.target ?? doc.head).appendChild(script)
  return true
}

/**
 * Keeps the DOM in sync with the store: loads trackers whose category is granted (or that are
 * Consent-Mode-managed) and re-runs on every decision. Scripts cannot be unloaded; revocation sets
 * `needsReload` in the store, which the UI surfaces.
 */
export function attachLoader(store: ConsentStore, trackers: ConsentTracker[], options: LoaderOptions = {}): () => void {
  const run = () => {
    for (const tracker of trackers) {
      if (!tracker.loader) continue
      const allowed = tracker.loader.consentModeManaged || store.has(tracker.categoryKey)
      if (!allowed) continue
      if (tracker.loader.strategy === 'lazy' && typeof requestIdleCallback === 'function') {
        requestIdleCallback(() => injectTracker(tracker, options))
      } else {
        injectTracker(tracker, options)
      }
    }
  }
  run()
  const unsubscribe = store.onChange(run)
  return unsubscribe
}
