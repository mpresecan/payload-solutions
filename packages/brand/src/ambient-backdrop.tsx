'use client'

import { motion, useScroll, useTransform } from 'motion/react'
import { useReducedMotionSafe } from './reduced-motion'
import { useEffect, useRef, useState } from 'react'

export type AmbientVariant = 'sheen' | 'floor'

/**
 * The hero's ambient layer. It is pinned to the viewport behind the hero, so the sections
 * that follow slide over it like a curtain while it fades out, the same device
 * payloadcms.com uses with its background video. Everything is CSS gradients on transform
 * and opacity; there is no image or video to load.
 *
 * Two variants:
 *
 * - `sheen` (default) is the premium treatment: true black, no drawn grid, two long
 *   diagonal light streaks — one in the brand accent, one neutral — at very low alpha,
 *   plus a vignette that pulls the corners down to black. It reads as light falling
 *   across the frame rather than as a decorated surface, and it leaves an illustration
 *   standing in front of it (the IsoStack, the LiquidMark) completely unobstructed. That
 *   is the whole point: the previous isometric floor competed with the stack drawn on
 *   top of it.
 * - `floor` keeps the isometric grid for pages that want a drawn surface underfoot.
 *
 * Place it as the first child of a ThemeBand (which isolates the stacking context, so the
 * layer's negative z-index keeps it under the band's content). Sections after the band must
 * be opaque and positioned above it (`relative z-10 bg-bg`). Under reduced motion the layer
 * is absolute and static, scrolling away with the hero.
 */
export function AmbientBackdrop({
  className,
  variant = 'sheen',
}: {
  className?: string
  variant?: AmbientVariant
}) {
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
      {variant === 'floor' ? (
        <div
          className="iso-floor absolute inset-0"
          style={{
            maskImage:
              'radial-gradient(120% 90% at 78% 60%, black 20%, rgba(0,0,0,0.45) 55%, transparent 80%)',
            WebkitMaskImage:
              'radial-gradient(120% 90% at 78% 60%, black 20%, rgba(0,0,0,0.45) 55%, transparent 80%)',
          }}
        />
      ) : null}

      {/*
        Primary streak: a long, soft shaft of accent light raking across the frame.

        It starts below the fold rather than above it. At top:-15% the shaft's brightest part
        sat behind the header and the headline, which is what made the top of the hero read as
        a lit blue haze instead of as black — and it is the copy, not the light, that is meant
        to be the brightest thing up there. Pushed down and blurred wider, the same light
        lands under the mark and the frame opens from black at the top to light at the bottom
        right. --ambient-glow-strength then sets how far it burns.
      */}
      <div
        className="ambient-glow absolute -right-[20%] top-[4%] h-[150vmin] w-[80vmin] origin-center"
        style={{
          transform: 'rotate(-28deg)',
          opacity: 'var(--ambient-glow-strength)',
          background:
            'radial-gradient(closest-side, var(--accent-glow), color-mix(in oklab, var(--accent-glow) 40%, transparent) 45%, transparent 75%)',
          filter: 'blur(90px)',
        }}
      />

      {/* Counter-light, upper left, neutral: keeps the frame from being lit from one side only. */}
      <div
        className="absolute -left-[18%] -top-[25%] h-[95vmin] w-[70vmin]"
        style={{
          transform: 'rotate(-24deg)',
          background: 'radial-gradient(closest-side, var(--ambient-cool), transparent 72%)',
          filter: 'blur(60px)',
        }}
      />

      {/* A narrow sheen that travels across the frame at the same rake angle. */}
      <div
        className="ambient-sheen absolute inset-y-[-45%] left-1/2 w-[22vw] -translate-x-1/2"
        style={{
          background: 'linear-gradient(90deg, transparent, var(--ambient-sheen), transparent)',
          filter: 'blur(36px)',
          opacity: 0.5,
        }}
      />

      {/* Vignette: pulls every edge back down to --bg so the black stays the deepest thing
          on the page and the light reads as a single source rather than a wash. Centred on
          the shaft and closing earlier than it used to (transparent only to 12%, fully --bg
          by 88%), which is what keeps the lit area to the one corner it belongs in. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(105% 78% at 66% 50%, transparent 12%, color-mix(in oklab, var(--bg) 70%, transparent) 52%, var(--bg) 88%)',
        }}
      />

      <div className="noise absolute inset-0" />

      {/* CRT tile, over the noise and the vignette both. `noise` is blended with overlay, so
          it dies wherever the frame is genuinely black — which after the vignette is most of
          the edge. This one screens, so it is the layer that keeps the black alive out to
          the corners. Absent file or reduced motion: not painted, and the frame is simply
          what it was before. */}
      <div className="crt absolute inset-0" />

      {/*
        Header scrim. The header is only 88% --bg over a blur, so whatever the ambient layer
        puts behind it shows through — and with the shaft, the grain and the CRT tile all
        lifting the top of the frame, the header sat on a band several levels lighter than
        itself and drew a hard horizontal seam across the page at exactly the header's
        bottom edge. This runs the top back down to solid --bg and releases it over 15rem,
        so the header dissolves into the hero instead of sitting on it.

        It is deliberately the last of the light layers: after the grain and the CRT tile,
        so neither of them can put the seam back. GridColumns paints above it (z-[-1] over
        this layer's z-[-2]), so the structural hairlines still run to the top of the page.
      */}
      <div
        className="absolute inset-x-0 top-0 h-60"
        style={{ background: 'linear-gradient(to bottom, var(--bg), transparent)' }}
      />

      {/* Ground the frame into the page colour at the bottom edge. */}
      <div
        className="absolute inset-x-0 bottom-0 h-56"
        style={{ background: 'linear-gradient(to bottom, transparent, var(--bg))' }}
      />
    </motion.div>
  )
}
