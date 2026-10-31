'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

interface LogosCarouselProps {
  /** `groups[g][i]` is the logo shown in cell `i` while group `g` is up. Groups must be equal length. */
  groups: ReactNode[][]
  className?: string
  cellClassName?: string
  /** Seconds between one cell starting its swap and the next. */
  stagger?: number
  /** Milliseconds one logo takes to leave or arrive. */
  duration?: number
  /** Milliseconds between group changes. */
  interval?: number
  /** Milliseconds after the row scrolls into view before the first change. */
  initialDelay?: number
}

/**
 * A row of cells that rotates through whole groups of logos, the way spell.sh's logos carousel
 * does: every cell swaps on the same beat, staggered left to right, the outgoing logo lifting
 * away through a blur as the next one rises in beneath it. Keyframes live in globals.css.
 *
 * The first group is server-rendered at rest, so the row reads correctly before hydration and
 * is all a reduced-motion visitor ever sees. The timer only runs while the row is on screen
 * and the tab is visible. Groups not showing are `inert`, so focus never lands on a hidden link.
 */
export function LogosCarousel({
  groups,
  className,
  cellClassName,
  stagger = 0.14,
  duration = 600,
  interval = 2500,
  initialDelay = 500,
}: LogosCarouselProps) {
  const ref = useRef<HTMLUListElement>(null)
  const [{ active, previous }, setShown] = useState<{ active: number; previous: number | null }>({
    active: 0,
    previous: null,
  })
  const cells = groups[0]?.length ?? 0

  useEffect(() => {
    const el = ref.current
    if (!el || groups.length < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let inView = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const advance = () => {
      setShown(({ active: a }) => ({ active: (a + 1) % groups.length, previous: a }))
      timer = setTimeout(advance, interval)
    }
    const sync = () => {
      clearTimeout(timer)
      timer = undefined
      if (inView && document.visibilityState === 'visible') timer = setTimeout(advance, initialDelay)
    }
    const io = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? false
      sync()
    })
    io.observe(el)
    document.addEventListener('visibilitychange', sync)
    return () => {
      clearTimeout(timer)
      io.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [groups.length, interval, initialDelay])

  return (
    <ul ref={ref} className={className}>
      {Array.from({ length: cells }, (_, cell) => (
        <li key={cell} className={cellClassName}>
          {groups.map((group, g) => {
            const state =
              g === active ? (previous === null ? 'rest' : 'enter') : g === previous ? 'exit' : 'off'
            return (
              <div
                key={g}
                className="logos-carousel-item absolute inset-0"
                data-state={state}
                inert={g !== active}
                style={{
                  animationDuration: `${duration}ms`,
                  animationDelay: `${(cell * stagger).toFixed(2)}s`,
                }}
              >
                {group[cell]}
              </div>
            )
          })}
        </li>
      ))}
    </ul>
  )
}
