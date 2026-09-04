'use client'

import { createElement, useEffect, useRef, type RefObject } from 'react'

/**
 * Makes a sticky header take the theme of the band under it. Every ThemeBand carries
 * `data-band-theme`; an IntersectionObserver watches a one pixel line across the header's
 * vertical centre and sets `data-theme` on the header while a band covers that line. No
 * scroll listener, nothing on the render path. Bands that only follow the page theme are
 * not marked, so the attribute is removed again and the header falls back to the page.
 */
export function useHeaderTheme(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    // The ref may point at the header itself or at anything inside it.
    const header = ref.current?.closest<HTMLElement>('header') ?? ref.current
    if (!header) return
    const bands = Array.from(document.querySelectorAll<HTMLElement>('[data-band-theme]'))
    if (bands.length === 0) return

    let observer: IntersectionObserver | undefined
    const covering = new Set<HTMLElement>()

    const apply = () => {
      // Bands never overlap, so at most one covers the line; at a boundary, prefer the
      // lower band (later in DOM), which is the one scrolling in.
      let current: HTMLElement | undefined
      for (const band of bands) if (covering.has(band)) current = band
      const theme = current?.dataset.bandTheme
      if (theme) header.setAttribute('data-theme', theme)
      else header.removeAttribute('data-theme')
    }

    const build = () => {
      observer?.disconnect()
      covering.clear()
      const mid = Math.round(header.offsetHeight / 2)
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const el = entry.target as HTMLElement
            if (entry.isIntersecting) covering.add(el)
            else covering.delete(el)
          }
          apply()
        },
        { rootMargin: `${-mid}px 0px ${-(window.innerHeight - mid - 1)}px 0px`, threshold: 0 },
      )
      for (const band of bands) observer.observe(band)
    }

    build()
    window.addEventListener('resize', build)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', build)
      header.removeAttribute('data-theme')
    }
  }, [ref])
}

/**
 * Drop-in for a server-rendered header: renders nothing visible and syncs the theme of the
 * nearest `<header>` ancestor. `<header><HeaderThemeSync />...</header>`
 */
export function HeaderThemeSync() {
  const ref = useRef<HTMLSpanElement>(null)
  useHeaderTheme(ref)
  return createElement('span', { ref, hidden: true })
}
