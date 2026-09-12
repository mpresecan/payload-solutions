'use client'

import createGlobe, { type Globe as CobeGlobe } from 'cobe'
import { useEffect, useRef } from 'react'
import { useReducedMotionSafe } from '@payload-solutions/brand/reduced-motion'
import { cn } from '@/lib/cn'

/*
  The old site's cobe globe, kept, re-coloured and given something true to say.

  It earns its place because it states something a list cannot: the clock runs in one place
  and the deployments it calls do not. The markers are the regions Payload apps actually
  deploy to, and the arcs run from the clock to each of them.

  Two things to know before changing it:

  1. cobe 2 dropped the `onRender` option that 0.6 had. The rotation is our own rAF loop
     calling `update()`, which is also where the canvas is kept in step with its box.
  2. It has to be built twice, because it is not a CSS surface. WebGL knows nothing about
     `data-theme`, so the first version of this file was a black ball sitting on the white
     page in light mode. The palette is chosen per theme and the globe is destroyed and
     rebuilt when the theme changes — cheap, because it only ever happens on a click.

  The light palette uses the DARKENED brass twin (#8a6100), the same one tokens.css resolves
  for `--accent` in light mode: the dark #f0b84d is invisible on a pale sphere.
*/

/** Where Payload apps get deployed, roughly: Vercel region centroids. */
const REGIONS: Array<[number, number]> = [
  [38.9, -77.0], // iad1
  [37.8, -122.4], // sfo1
  [50.1, 8.7], // fra1
  [51.5, -0.13], // lhr1
  [1.35, 103.8], // sin1
  [35.7, 139.7], // hnd1
  [-33.87, 151.2], // syd1
  [-23.55, -46.63], // gru1
  [19.08, 72.88], // bom1
]

/** Where the clock itself is. Every arc starts here. */
const HUB: [number, number] = [52.23, 21.0]

type Triple = [number, number, number]

const PALETTE: Record<
  'dark' | 'light',
  { dark: number; base: Triple; marker: Triple; glow: Triple; brightness: number }
> = {
  dark: {
    dark: 1,
    base: [0.17, 0.17, 0.17],
    marker: [0.94, 0.72, 0.3], // #f0b84d
    glow: [0.22, 0.18, 0.12],
    brightness: 3.4,
  },
  light: {
    dark: 0,
    base: [0.88, 0.88, 0.88],
    marker: [0.54, 0.38, 0.0], // #8a6100, the light-mode accent twin
    glow: [1, 0.99, 0.97],
    brightness: 1.5,
  },
}

function currentTheme(): 'dark' | 'light' {
  const forced = document.documentElement.getAttribute('data-theme')
  if (forced === 'light' || forced === 'dark') return forced
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function Globe({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotionSafe()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || reduce) return

    let phi = 0
    let raf = 0
    let globe: CobeGlobe | undefined
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const size = () => Math.max(1, canvas.offsetWidth) * 2

    const build = () => {
      globe?.destroy()
      globe = undefined
      const p = PALETTE[currentTheme()]
      try {
        globe = createGlobe(canvas, {
          devicePixelRatio: dpr,
          width: size(),
          height: size(),
          phi,
          theta: 0.26,
          dark: p.dark,
          diffuse: 1.1,
          mapSamples: 14000,
          mapBrightness: p.brightness,
          baseColor: p.base,
          markerColor: p.marker,
          glowColor: p.glow,
          arcColor: p.marker,
          arcWidth: 0.4,
          arcHeight: 0.35,
          markers: REGIONS.map((location) => ({ location, size: 0.055 })),
          arcs: REGIONS.map((to) => ({ from: HUB, to })),
        })
      } catch {
        // No WebGL (older browser, a blocked context, a headless screenshotter): the section
        // reads without it, so fail quiet rather than throwing out of an effect.
        globe = undefined
      }
    }

    build()
    if (!globe) return

    const observer = new MutationObserver(build)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    const tick = () => {
      phi += 0.0026
      globe?.update({ phi, width: size(), height: size() })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      globe?.destroy()
    }
  }, [reduce])

  if (reduce) return null

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn('aspect-square w-full max-w-full', className)}
      style={{ contain: 'layout paint size' }}
    />
  )
}
