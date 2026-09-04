'use client'

import { useEffect, useId, useState } from 'react'
import { List, X } from '@phosphor-icons/react'
import { ArrowUpRight } from '@phosphor-icons/react/dist/ssr'

export interface MobileNavItem {
  href: string
  label: string
  /** Opens in a new tab and shows the outbound arrow. */
  external?: boolean
}

/**
 * The primary navigation on screens too narrow for the inline links: a toggle in the header
 * and a panel that drops under it. Anchors close the panel on tap; Escape closes it too.
 * Hidden from `lg` up, where SiteHeader renders the inline nav instead.
 */
export function MobileNav({ items }: { items: MobileNavItem[] }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const mq = window.matchMedia('(min-width: 64rem)')
    const onResize = () => {
      if (mq.matches) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    mq.addEventListener('change', onResize)
    return () => {
      window.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onResize)
    }
  }, [open])

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="inline-flex h-9 w-9 items-center justify-center text-fg-muted transition-colors hover:text-fg"
      >
        {open ? <X size={20} /> : <List size={20} />}
      </button>

      <nav
        id={panelId}
        aria-label="Primary"
        hidden={!open}
        className="absolute inset-x-0 top-full bg-bg hairline-b"
      >
        <ul className="container-content flex flex-col py-2">
          {items.map((item) => (
            <li key={item.href} className="hairline-t first:border-t-0">
              <a
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between py-3.5 text-base text-fg-muted transition-colors hover:text-fg"
                {...(item.external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
              >
                {item.label}
                {item.external ? <ArrowUpRight size={16} weight="bold" aria-hidden /> : null}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
