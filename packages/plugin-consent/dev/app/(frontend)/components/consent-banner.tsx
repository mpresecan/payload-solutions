'use client'

import { useCategory, useConsent } from '@payload-solutions/consent-react'
import { useEffect, useRef, useState } from 'react'

/**
 * Plain-CSS banner + preferences dialog for the dev app, in the same shape as the shadcn registry
 * block (`npx shadcn@latest add https://payload.solutions/r/consent-banner.json`): a card with a
 * header, body and button footer, never a full-width bar. Only depends on the hooks, so the dev
 * app stays dependency-free.
 */
export function ConsentBanner() {
  const { ready, state, config, acceptAll, rejectAll, open, dismiss } = useConsent()
  if (!ready || !state || !config) {
    return null
  }
  const { banner } = config
  const optIn = state.model === 'opt-in'
  const showReject = optIn || banner.showRejectAll
  const reason = reasonText(state.repromptReason)

  return (
    <>
      {state.ui === 'banner' ? (
        <section
          aria-label={banner.title}
          className={`consent-banner consent-banner--${banner.position}`}
          data-consent-banner=""
          role="region"
        >
          <header>
            <h2>{banner.title}</h2>
            <CookieIcon />
          </header>
          <div className="body">
            {reason ? <p className="reason">{reason}</p> : null}
            <p>{banner.description}</p>
            {banner.links.cookies || banner.links.privacy ? (
              <p className="links">
                {banner.links.cookies ? <a href={banner.links.cookies}>Cookie policy</a> : null}
                {banner.links.privacy ? <a href={banner.links.privacy}>Privacy policy</a> : null}
              </p>
            ) : null}
          </div>
          <footer>
            <div className={showReject ? 'row two' : 'row one'}>
              {showReject ? (
                <button className="secondary" onClick={rejectAll} type="button">
                  {banner.labels.rejectAll}
                </button>
              ) : null}
              <button className="primary" onClick={acceptAll} type="button">
                {banner.labels.acceptAll}
              </button>
            </div>
            <div className={optIn ? 'row one' : 'row two'}>
              <button className="ghost" onClick={() => open('preferences')} type="button">
                {banner.labels.customize}
              </button>
              {!optIn ? (
                <button className="ghost" onClick={dismiss} type="button">
                  {banner.labels.close}
                </button>
              ) : null}
            </div>
          </footer>
        </section>
      ) : null}
      <PreferencesDialog />
    </>
  )
}

function reasonText(reason: NonNullable<ReturnType<typeof useConsent>['state']>['repromptReason']): null | string {
  switch (reason) {
    case 'categories':
    case 'trackers':
      return 'We have changed the services we use.'
    case 'documents':
      return 'Our privacy documents have been updated.'
    case 'expired':
      return 'It has been a while — please confirm your choices.'
    default:
      return null
  }
}

/** A plain cookie glyph so the dev app needs no icon package. */
function CookieIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" width="18">
      <path d="M21.5 12a9.5 9.5 0 1 1-9.5-9.5 3.8 3.8 0 0 0 5 5 3.8 3.8 0 0 0 4.5 4.5Z" strokeLinejoin="round" />
      <circle cx="8.5" cy="8.5" fill="currentColor" r="1" stroke="none" />
      <circle cx="15.5" cy="15" fill="currentColor" r="1" stroke="none" />
      <circle cx="11.5" cy="12.5" fill="currentColor" r="1" stroke="none" />
      <circle cx="7.5" cy="14.5" fill="currentColor" r="1" stroke="none" />
    </svg>
  )
}

function PreferencesDialog() {
  const { close, config, open, save, state } = useConsent()
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
  // Closing without deciding goes back to the banner rather than leaving the visitor with nothing.
  const dismissDialog = () => (state.status === 'undecided' ? open('banner') : close())

  return (
    <dialog className="consent-preferences" data-consent-preferences="" onClose={dismissDialog} ref={ref}>
      <header>
        <div>
          <h2>{config.banner.title}</h2>
          <p>{config.banner.description}</p>
        </div>
        <CookieIcon />
      </header>
      <div className="body">
        {config.categories.map((category) => (
          <CategoryRow categoryKey={category.key} key={category.key} />
        ))}
        {state.needsReload ? (
          <p className="reload" role="status">
            {config.banner.labels.reloadNotice}{' '}
            <button className="link" onClick={() => window.location.reload()} type="button">
              Reload
            </button>
          </p>
        ) : null}
      </div>
      <footer>
        <div className="row">
          <button className="ghost" onClick={dismissDialog} type="button">
            {config.banner.labels.close}
          </button>
        </div>
        <button className="primary" onClick={save} type="button">
          {config.banner.labels.save}
        </button>
      </footer>
    </dialog>
  )
}

function CategoryRow({ categoryKey }: { categoryKey: string }) {
  const { category, draft, required, toggle } = useCategory(categoryKey)
  const { config } = useConsent()
  const [expanded, setExpanded] = useState(false)
  if (!category) {
    return null
  }
  const trackers = config?.trackers.filter((t) => t.categoryKey === categoryKey) ?? []
  const id = `consent-${category.key}`

  return (
    <div className="category" data-consent-category={category.key}>
      <div className="head">
        <div>
          <label htmlFor={id}>
            {category.label}
            {required ? <span className="badge">{config?.banner.labels.requiredBadge}</span> : null}
          </label>
          <small>{category.description}</small>
        </div>
        <input
          checked={required ? true : draft}
          disabled={required}
          id={id}
          onChange={(e) => toggle(e.target.checked)}
          type="checkbox"
        />
      </div>
      {trackers.length > 0 ? (
        <div className="services">
          <button aria-expanded={expanded} className="link" onClick={() => setExpanded((v) => !v)} type="button">
            {trackers.length} {trackers.length === 1 ? 'service' : 'services'}
          </button>
          {expanded ? (
            <ul>
              {trackers.map((t) => (
                <li key={t.id}>
                  <strong>{t.name}</strong>
                  {t.vendor ? <span> · {t.vendor}</span> : null}
                  {t.purpose ? <p>{t.purpose}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
