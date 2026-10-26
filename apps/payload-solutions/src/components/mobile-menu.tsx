'use client'

import { type CSSProperties, useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { siGithub, siX } from 'simple-icons'
import { ArrowGlyph, SlideFaces } from '@payload-solutions/brand/lattice'

import { BrandIcon } from '@/components/brand-icon'

export interface MobileMenuItem {
  href: string
  label: string
}

export interface MobileMenuProps {
  items: MobileMenuItem[]
  cta: MobileMenuItem
  github: string
  x: string
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * The primary navigation below `lg`: a two-line toggle in the header and a full-height sheet
 * under it.
 *
 * - The sheet is portalled to <body>. The header carries a backdrop-filter, which makes it the
 *   containing block for any `position: fixed` child, so a sheet rendered inside it could only
 *   ever be as tall as the header. `--menu-top` is measured off the header on open, so the
 *   family bar (when it is open above the header) is respected.
 * - It copies the header's `data-theme` (set by HeaderThemeSync from the band underneath), so
 *   over the dark hero the sheet is dark even for a light-theme visitor and there is no seam.
 * - Always mounted after hydration and hidden with `visibility` + `inert`, so the closing
 *   animation can run; it is ~20 nodes and costs nothing while closed. No animation library:
 *   transform and opacity only, static under prefers-reduced-motion (see .mobile-menu CSS).
 * - Scroll is locked while open; Escape and a breakpoint change close it; focus moves into
 *   the sheet, is trapped between the toggle and the sheet, and returns to the toggle.
 */
export function MobileMenu({ items, cta, github, x }: MobileMenuProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [theme, setTheme] = useState<string | null>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const sheetId = useId()
  const pathname = usePathname()

  useEffect(() => setMounted(true), [])

  // Unlock synchronously, not in an effect: an in-page link (/#plugins) scrolls during the
  // navigation that follows the click, and it cannot scroll a locked document.
  const close = useCallback((restoreFocus = false) => {
    document.documentElement.removeAttribute('data-menu-open')
    setOpen(false)
    if (restoreFocus) toggleRef.current?.focus()
  }, [])

  const openMenu = () => {
    const header = toggleRef.current?.closest('header')
    if (header) {
      const bottom = Math.max(0, Math.round(header.getBoundingClientRect().bottom))
      document.documentElement.style.setProperty('--menu-top', `${bottom}px`)
      setTheme(header.getAttribute('data-theme'))
    }
    document.documentElement.setAttribute('data-menu-open', '')
    setOpen(true)
  }

  // A route change (case study → home, say) closes the sheet.
  useEffect(() => {
    close()
  }, [pathname, close])

  useEffect(() => {
    if (!open) return
    const sheet = sheetRef.current
    // Focus the first link once the sheet is visible (visibility flips on the same frame).
    const raf = requestAnimationFrame(() => sheet?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true }))

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close(true)
        return
      }
      if (e.key !== 'Tab' || !sheet || !toggleRef.current) return
      const ring = [toggleRef.current, ...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)]
      const i = ring.indexOf(document.activeElement as HTMLElement)
      const next = e.shiftKey ? (i <= 0 ? ring.length - 1 : i - 1) : i === ring.length - 1 || i === -1 ? 0 : i + 1
      e.preventDefault()
      ring[next]?.focus()
    }
    const mq = window.matchMedia('(min-width: 64rem)')
    const onBreakpoint = () => mq.matches && close()

    document.addEventListener('keydown', onKey)
    mq.addEventListener('change', onBreakpoint)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onBreakpoint)
    }
  }, [open, close])

  // Never leave the page locked if the header unmounts with the sheet open.
  useEffect(() => () => document.documentElement.removeAttribute('data-menu-open'), [])

  const isCurrent = (href: string) =>
    !href.includes('#') && (pathname === href || pathname.startsWith(`${href}/`))

  const sheet = (
    <div
      ref={sheetRef}
      id={sheetId}
      className="mobile-menu lg:hidden"
      data-state={open ? 'open' : 'closed'}
      {...(theme ? { 'data-theme': theme } : {})}
      inert={!open}
    >
      <div className="mobile-menu__scroll">
        <nav aria-label="Primary" className="container-content">
          <ul className="mobile-menu__list">
            {items.map((item, i) => {
              const current = isCurrent(item.href)
              return (
                <li key={item.href} className="mobile-menu__item" style={{ '--i': i } as CSSProperties}>
                  <Link
                    href={item.href}
                    onClick={() => close()}
                    aria-current={current ? 'page' : undefined}
                    className="mobile-menu__link"
                  >
                    <span className="mobile-menu__index" aria-hidden>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="mobile-menu__label">{item.label}</span>
                    <ArrowGlyph size={18} className="mobile-menu__arrow" />
                  </Link>
                </li>
              )
            })}
          </ul>

          <div className="mobile-menu__foot" style={{ '--i': items.length } as CSSProperties}>
            {/* SlideFaces on a Next Link rather than ActionRow (a plain <a>), so going to the
                contact section from a case study is a client navigation, not a reload. */}
            <Link href={cta.href} onClick={() => close()} className="slide-btn mobile-menu__cta w-full">
              <SlideFaces>{cta.label}</SlideFaces>
            </Link>
            <div className="mobile-menu__social">
              <a href={github} target="_blank" rel="noreferrer noopener" className="mobile-menu__social-link">
                <span aria-hidden className="contents">
                  <BrandIcon icon={siGithub} size={16} />
                </span>
                GitHub
              </a>
              <a href={x} target="_blank" rel="noreferrer noopener" className="mobile-menu__social-link">
                <span aria-hidden className="contents">
                  <BrandIcon icon={siX} size={14} />
                </span>
                X
              </a>
            </div>
          </div>
        </nav>
      </div>
    </div>
  )

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        onClick={() => (open ? close() : openMenu())}
        aria-expanded={open}
        aria-controls={sheetId}
        aria-label={open ? 'Close menu' : 'Open menu'}
        data-state={open ? 'open' : 'closed'}
        className="menu-toggle lg:hidden"
      >
        <span className="menu-toggle__bar" aria-hidden />
        <span className="menu-toggle__bar" aria-hidden />
      </button>
      {mounted ? createPortal(sheet, document.body) : null}
    </>
  )
}
