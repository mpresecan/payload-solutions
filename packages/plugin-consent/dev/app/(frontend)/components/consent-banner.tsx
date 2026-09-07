'use client'

import { useCategory, useConsent } from '@payload-solutions/consent-react'
import { useEffect, useRef } from 'react'

/**
 * Plain-CSS banner + preferences dialog for the dev app. Real projects install the shadcn registry
 * block (`npx shadcn@latest add https://payload.solutions/r/consent-banner.json`); this one only
 * depends on the hooks so the dev app stays dependency-free.
 */
export function ConsentBanner() {
  const { ready, state, config, acceptAll, rejectAll, open, dismiss } = useConsent()
  if (!ready || !state || !config) {
    return null
  }
  const { banner } = config
  const optIn = state.model === 'opt-in'

  return (
    <>
      {state.ui === 'banner' ? (
        <section aria-label={banner.title} className="consent-banner" data-consent-banner="" role="region">
          <div>
            <strong>{banner.title}</strong>
            <p>
              {state.repromptReason ? `(${state.repromptReason}) ` : null}
              {banner.description}{' '}
              {banner.links.cookies ? <a href={banner.links.cookies}>Cookie policy</a> : null}
            </p>
          </div>
          <div className="actions">
            <button onClick={() => open('preferences')} type="button">
              {banner.labels.customize}
            </button>
            {optIn || banner.showRejectAll ? (
              <button className="primary" onClick={rejectAll} type="button">
                {banner.labels.rejectAll}
              </button>
            ) : null}
            <button className="primary" onClick={acceptAll} type="button">
              {banner.labels.acceptAll}
            </button>
            {!optIn ? (
              <button className="link" onClick={dismiss} type="button">
                {banner.labels.close}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
      <PreferencesDialog />
    </>
  )
}

function PreferencesDialog() {
  const { state, config, save, close, acceptAll, rejectAll } = useConsent()
  const ref = useRef<HTMLDialogElement>(null)
  const isOpen = state?.ui === 'preferences'

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) {
      return
    }
    if (isOpen && !dialog.open) {
      dialog.showModal()
    }
    if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  if (!state || !config) {
    return null
  }

  return (
    <dialog className="consent-preferences" data-consent-preferences="" onClose={close} ref={ref}>
      <h2>{config.banner.title}</h2>
      <p>{config.banner.description}</p>
      {config.categories.map((category) => (
        <CategoryRow categoryKey={category.key} key={category.key} />
      ))}
      {state.needsReload ? (
        <p role="status">
          {config.banner.labels.reloadNotice}{' '}
          <button className="link" onClick={() => window.location.reload()} type="button">
            Reload
          </button>
        </p>
      ) : null}
      <div className="actions" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', marginTop: '1rem' }}>
        <span style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={rejectAll} type="button">
            {config.banner.labels.rejectAll}
          </button>
          <button onClick={acceptAll} type="button">
            {config.banner.labels.acceptAll}
          </button>
        </span>
        <button className="primary" onClick={save} type="button">
          {config.banner.labels.save}
        </button>
      </div>
    </dialog>
  )
}

function CategoryRow({ categoryKey }: { categoryKey: string }) {
  const { category, draft, required, toggle } = useCategory(categoryKey)
  const { config } = useConsent()
  if (!category) {
    return null
  }
  const trackers = config?.trackers.filter((t) => t.categoryKey === categoryKey) ?? []
  const id = `consent-${category.key}`
  return (
    <div className="category">
      <label htmlFor={id}>
        <strong>{category.label}</strong>
        {required ? <em> ({config?.banner.labels.requiredBadge})</em> : null}
      </label>
      <input
        checked={required ? true : draft}
        disabled={required}
        id={id}
        onChange={(e) => toggle(e.target.checked)}
        type="checkbox"
      />
      <small>
        {category.description}
        {trackers.length > 0 ? ` — ${trackers.map((t) => t.name).join(', ')}` : ''}
      </small>
    </div>
  )
}
