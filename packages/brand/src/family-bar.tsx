'use client'

import { useEffect, useRef } from 'react'
import { MARK_FACET_COLORS, PAYLOAD_URL, brands, type BrandId } from './brands'
import { Mark } from './logos'

const FAMILY: BrandId[] = ['solutions', 'stack', 'clock']

/** Upward wheel travel, in px, that has to pile up while the page is already at the top. */
const WHEEL_OVERSHOOT = 140
/** How far a finger has to pull down from the top before the bar opens. */
const TOUCH_PULL = 72
/** An overshoot that pauses this long starts again from zero. */
const OVERSHOOT_IDLE_MS = 450
/** Collapse only once scrolling has settled, so the compensation never fights momentum. */
const SCROLL_IDLE_MS = 180

/**
 * The family strip above every site's header: Payload Solutions, Payload Stack, Payload Clock,
 * and — set apart, outlined and labelled — Payload CMS, which we build on but are not part of.
 *
 * It is hidden by default and opens only when the visitor is already at the top and keeps
 * going: trackpad momentum past the top, a deliberate extra scroll up, or a pull-down on touch.
 * It sits in normal flow, so opening it moves the page down rather than covering the header.
 * Once it has scrolled out of view it collapses again, and the scroll position is shifted by
 * its height in the same frame, so nothing on screen moves.
 *
 * Keyboard: the collapsed links stay focusable and are the first stop on the page; focusing
 * one opens the bar.
 */
export function FamilyBar({ current }: { current: BrandId }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const bar = ref.current
    if (!bar) return

    let overshoot = 0
    let overshootTimer: number | undefined
    let scrollTimer: number | undefined
    let touchStartY: number | null = null

    const isOpen = () => bar.dataset.state === 'open'
    const atTop = () => window.scrollY <= 0

    const open = () => {
      if (isOpen()) return
      bar.dataset.state = 'open'
      overshoot = 0
    }

    const collapseOutOfView = () => {
      if (!isOpen()) return
      const height = bar.offsetHeight
      const top = window.scrollY
      if (top < height) return
      bar.classList.add('family-bar--instant')
      bar.dataset.state = 'closed'
      void bar.offsetHeight
      // Absolute, not scrollBy: Chrome and Firefox scroll anchoring may already have
      // compensated, and scrolling to the target is a no-op then. `instant` overrides the
      // site-wide `scroll-behavior: smooth`.
      window.scrollTo({ top: top - height, behavior: 'instant' })
      requestAnimationFrame(() => bar.classList.remove('family-bar--instant'))
    }

    const onWheel = (event: WheelEvent) => {
      if (isOpen()) return
      if (event.deltaY >= 0 || !atTop()) {
        overshoot = 0
        return
      }
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1
      overshoot += -event.deltaY * unit
      window.clearTimeout(overshootTimer)
      overshootTimer = window.setTimeout(() => (overshoot = 0), OVERSHOOT_IDLE_MS)
      if (overshoot >= WHEEL_OVERSHOOT) open()
    }

    const onTouchStart = (event: TouchEvent) => {
      touchStartY = atTop() && !isOpen() ? (event.touches[0]?.clientY ?? null) : null
    }
    const onTouchMove = (event: TouchEvent) => {
      if (touchStartY === null) return
      const y = event.touches[0]?.clientY
      if (y !== undefined && y - touchStartY >= TOUCH_PULL) {
        touchStartY = null
        open()
      }
    }
    const onTouchEnd = () => {
      touchStartY = null
    }

    const onScroll = () => {
      if (!isOpen()) return
      window.clearTimeout(scrollTimer)
      scrollTimer = window.setTimeout(collapseOutOfView, SCROLL_IDLE_MS)
    }

    const onFocusIn = () => open()

    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchEnd, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    bar.addEventListener('focusin', onFocusIn)
    return () => {
      window.clearTimeout(overshootTimer)
      window.clearTimeout(scrollTimer)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
      window.removeEventListener('scroll', onScroll)
      bar.removeEventListener('focusin', onFocusIn)
    }
  }, [])

  return (
    <div ref={ref} className="family-bar" data-state="closed">
      <div className="family-bar__clip">
        <div className="family-bar__row container-content">
          <nav aria-label="Payload Solutions family" className="family-bar__family">
            {FAMILY.map((id) => {
              const brand = brands[id]
              const isCurrent = id === current
              return (
                <a
                  key={id}
                  href={isCurrent ? '/' : brand.url}
                  aria-current={isCurrent ? 'page' : undefined}
                  className="family-bar__link"
                >
                  <Mark size={11} facet={MARK_FACET_COLORS[id]} />
                  <span>
                    <span className="family-bar__prefix">Payload </span>
                    {brand.word}
                  </span>
                </a>
              )
            })}
          </nav>

          <div className="family-bar__external">
            <span className="family-bar__note">Built on</span>
            <a
              href={PAYLOAD_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="family-bar__payload"
              aria-label="Payload CMS (external site; we are not affiliated with or endorsed by Payload CMS)"
              title="Independent project, not affiliated with or endorsed by Payload CMS"
            >
              Payload CMS
              <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true" fill="none">
                <path d="M2 1h5v5M7 1 1 7" stroke="currentColor" strokeWidth="1.1" />
              </svg>
            </a>
            <span className="family-bar__note">not affiliated</span>
          </div>
        </div>
      </div>
    </div>
  )
}
