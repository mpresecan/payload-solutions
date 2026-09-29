'use client'

import { useCategory, useConsent } from '@payload-solutions/consent-react'
import { CaretDown, Cookie } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

/**
 * Preferences: one card per category with its switch, the services inside it one click away.
 * Changes are a draft until "Save", so nothing is recorded while the visitor is still deciding.
 *
 * A native modal `<dialog>` gives focus trapping, Escape and the backdrop without a dialog library.
 */
export function ConsentPreferencesDialog() {
  const { ready, state, config, acceptAll, rejectAll, save, close, open } = useConsent()
  const ref = useRef<HTMLDialogElement>(null)
  const isOpen = ready && state?.ui === 'preferences'

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (isOpen && !dialog.open) dialog.showModal()
    if (!isOpen && dialog.open) dialog.close()
  }, [isOpen])

  if (!ready || !state || !config) return null
  const { banner } = config
  // Closing without deciding goes back to the banner rather than leaving the visitor with nothing.
  const dismiss = () => (state.status === 'undecided' ? open('banner') : close())

  return (
    <dialog
      ref={ref}
      aria-labelledby="consent-preferences-title"
      className="m-auto w-[calc(100vw-2rem)] max-w-lg border border-border-strong bg-surface p-0 text-fg shadow-2xl backdrop:bg-black/60"
      data-consent-preferences=""
      onCancel={(event) => {
        event.preventDefault()
        dismiss()
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === event.currentTarget) dismiss()
      }}
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5">
        <div className="space-y-1">
          <h2 id="consent-preferences-title" className="text-base font-medium">
            {banner.title}
          </h2>
          <p className="text-sm text-fg-muted">{banner.description}</p>
        </div>
        <Cookie aria-hidden size={18} className="mt-0.5 shrink-0 text-fg-subtle" />
      </header>

      <div className="max-h-[55vh] space-y-2 overflow-y-auto p-4">
        {config.categories.map((category) => (
          <CategoryCard categoryKey={category.key} key={category.key} requiredLabel={banner.labels.requiredBadge} />
        ))}

        {state.needsReload ? (
          <p className="border border-dashed border-border-strong p-3 text-sm text-fg-muted" role="status">
            {banner.labels.reloadNotice}{' '}
            <button className="underline underline-offset-4 hover:text-fg" onClick={() => window.location.reload()} type="button">
              Reload
            </button>
          </p>
        ) : null}
      </div>

      <footer className="grid grid-cols-2 gap-2 border-t border-border p-4 sm:flex sm:justify-between">
        <div className="col-span-2 grid grid-cols-2 gap-2 sm:flex">
          <Button className="h-9 text-sm" onClick={rejectAll} variant="ghost">
            {banner.labels.rejectAll}
          </Button>
          <Button className="h-9 text-sm" onClick={acceptAll} variant="ghost">
            {banner.labels.acceptAll}
          </Button>
        </div>
        <Button className="col-span-2 w-full sm:w-auto" onClick={save}>
          {banner.labels.save}
        </Button>
      </footer>
    </dialog>
  )
}

function CategoryCard({ categoryKey, requiredLabel }: { categoryKey: string; requiredLabel: string }) {
  const { category, draft, required, toggle } = useCategory(categoryKey)
  const { config } = useConsent()
  const [expanded, setExpanded] = useState(false)
  if (!category) return null

  const trackers = config?.trackers.filter((t) => t.categoryKey === categoryKey) ?? []
  const switchId = `consent-${category.key}`
  const checked = required ? true : draft

  return (
    <div className="border border-border" data-consent-category={category.key}>
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium" htmlFor={switchId}>
              {category.label}
            </label>
            {required ? (
              <span className="bg-surface-2 px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-fg-muted">
                {requiredLabel}
              </span>
            ) : null}
          </div>
          <p className="text-[0.8125rem] text-fg-muted" id={`${switchId}-desc`}>
            {category.description}
          </p>
        </div>
        <button
          aria-checked={checked}
          aria-describedby={`${switchId}-desc`}
          className={cn(
            'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            checked ? 'bg-accent' : 'bg-border-strong',
          )}
          disabled={required}
          id={switchId}
          onClick={() => toggle(!draft)}
          role="switch"
          type="button"
        >
          <span
            aria-hidden
            className={cn(
              'inline-block size-4 rounded-full bg-white shadow transition-transform',
              checked ? 'translate-x-[1.125rem]' : 'translate-x-0.5',
            )}
          />
        </button>
      </div>

      {trackers.length > 0 ? (
        <div className="border-t border-border">
          <button
            aria-expanded={expanded}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-[0.8125rem] text-fg-muted hover:text-fg"
            onClick={() => setExpanded((v) => !v)}
            type="button"
          >
            {trackers.length} {trackers.length === 1 ? 'service' : 'services'}
            <CaretDown aria-hidden size={14} className={cn('transition-transform', expanded && 'rotate-180')} />
          </button>
          {expanded ? (
            <ul className="space-y-2 px-3 pb-3 text-[0.8125rem]">
              {trackers.map((t) => (
                <li key={t.id}>
                  <span className="font-medium">{t.name}</span>
                  {t.vendor ? <span className="text-fg-muted"> · {t.vendor}</span> : null}
                  {t.purpose ? <p className="text-fg-muted">{t.purpose}</p> : null}
                  {t.vendorPrivacyUrl ? (
                    <a
                      className="text-fg-muted underline underline-offset-4 hover:text-fg"
                      href={t.vendorPrivacyUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Privacy policy
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
