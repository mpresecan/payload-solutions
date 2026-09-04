'use client'

import { motion, useScroll, useTransform } from 'motion/react'
import { useReducedMotionSafe } from './reduced-motion'
import { useEffect, useRef, useState } from 'react'

/**
 * The hero's ambient layer: an isometric floor, a warm light that drifts on a long loop,
 * a sheen crossing it, and film grain. It is pinned to the viewport behind the hero, so the
 * sections that follow slide over it like a curtain while it fades out, the same device
 * payloadcms.com uses with its background video. Everything is CSS gradients on transform
 * and opacity; there is no image or video to load.
 *
 * Place it as the first child of a ThemeBand (which isolates the stacking context, so the
 * layer's negative z-index keeps it under the band's content). Sections after the band must
 * be opaque and positioned above it (`relative z-10 bg-bg`). Under reduced motion the layer
 * is absolute and static, scrolling away with the hero.
 */
export function AmbientBackdrop({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotionSafe()
  const { scrollY } = useScroll()
  // Fade out over the last stretch of the band: fully lit until the band's bottom edge
  // reaches the viewport bottom, gone when it is 40% of the way up.
  const [fade, setFade] = useState<[number, number]>([0, 640])
  useEffect(() => {
    const band = ref.current?.parentElement
    if (!band) return
    const measure = () => {
      const vh = window.innerHeight
      const start = Math.max(0, band.offsetHeight - vh)
      setFade([start, start + vh * 0.4])
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(band)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])
  const opacity = useTransform(scrollY, fade, [1, 0])

  return (
    <motion.div
      ref={ref}
      aria-hidden
      className={`ambient-sticky pointer-events-none fixed inset-x-0 top-0 z-[-2] h-dvh overflow-hidden ${className ?? ''}`}
      style={reduce ? undefined : { opacity }}
    >
      {/* Isometric floor, strongest behind the visual on the right, fading toward the copy. */}
      <div
        className="iso-floor absolute inset-0"
        style={{
          maskImage:
            'radial-gradient(120% 90% at 78% 60%, black 20%, rgba(0,0,0,0.45) 55%, transparent 80%)',
          WebkitMaskImage:
            'radial-gradient(120% 90% at 78% 60%, black 20%, rgba(0,0,0,0.45) 55%, transparent 80%)',
        }}
      />

      {/* Warm light, low and to the right, where the stack stands. */}
      <div
        className="ambient-glow absolute -right-[10%] top-[10%] h-[90vmin] w-[90vmin] rounded-full"
        style={{
          background: 'radial-gradient(closest-side, var(--ambient-glow), transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Cool counter-light, upper left, so the page is not lit from one side only. */}
      <div
        className="absolute -left-[15%] -top-[20%] h-[70vmin] w-[70vmin] rounded-full"
        style={{
          background: 'radial-gradient(closest-side, var(--ambient-cool), transparent 70%)',
          filter: 'blur(30px)',
        }}
      />

      {/* A sheen that crosses the floor at the isometric angle. */}
      <div
        className="ambient-sheen absolute inset-y-[-40%] left-1/2 w-[28vw] -translate-x-1/2"
        style={{
          background: 'linear-gradient(90deg, transparent, var(--ambient-sheen), transparent)',
          filter: 'blur(28px)',
          opacity: 0.6,
        }}
      />

      <div className="noise absolute inset-0" />

      {/* Ground the floor into the page colour at the bottom edge. */}
      <div
        className="absolute inset-x-0 bottom-0 h-48"
        style={{ background: 'linear-gradient(to bottom, transparent, var(--bg))' }}
      />
    </motion.div>
  )
}
