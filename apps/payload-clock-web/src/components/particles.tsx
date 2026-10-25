'use client'

import { useEffect, useRef } from 'react'
import { useReducedMotionSafe } from '@payload-solutions/brand/reduced-motion'
import { cn } from '@/lib/cn'

/*
  The old site's MagicUI particle field, kept and cut down.

  What changed: the original drew white dots at a fixed opacity over whatever was behind
  them, which on true black reads as dust on the screen. These drift slowly upward and
  twinkle, they are painted in the brand accent resolved from the live token, and the field
  fades out towards the edges so it never collides with the edge shadow of the hero video.

  What stayed: the drift, the parallax nudge towards the pointer, and the fact that it is one
  canvas rather than n DOM nodes.

  The accent has to be READ, not interpolated: `getPropertyValue('--accent')` returns the
  literal `light-dark(...)` token on this design system, never a colour (see the gotcha in
  packages/brand/css/tokens.css). Painting it onto a real colour property and reading that
  back is the only way to resolve it — the same trick LiquidMark uses.
*/

interface Particle {
  x: number
  y: number
  r: number
  drift: number
  phase: number
  speed: number
}

function resolveAccent(el: HTMLElement): [number, number, number] {
  const probe = document.createElement('span')
  probe.style.color = 'var(--accent)'
  probe.style.display = 'none'
  el.appendChild(probe)
  const resolved = getComputedStyle(probe).color
  probe.remove()
  const m = resolved.match(/-?\d+\.?\d*/g)
  if (!m || m.length < 3) return [240, 184, 77]
  return [Number(m[0]), Number(m[1]), Number(m[2])]
}

export function Particles({ className, quantity = 44 }: { className?: string; quantity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotionSafe()

  useEffect(() => {
    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    if (!canvas || !parent || reduce) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    let raf = 0
    let last = 0
    let isVisible = true
    // The field's position in page coordinates, so a pointer event needs no layout read.
    const origin = { left: 0, top: 0 }
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let particles: Particle[] = []
    const pointer = { x: 0, y: 0 }
    let [pr, pg, pb] = resolveAccent(parent)

    const seed = () => {
      particles = Array.from({ length: quantity }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.4 + Math.random() * 1.1,
        drift: (Math.random() - 0.5) * 0.06,
        phase: Math.random() * Math.PI * 2,
        speed: 0.05 + Math.random() * 0.12,
      }))
    }

    const resize = () => {
      width = parent.clientWidth
      height = parent.clientHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      seed()
    }

    // Steps are tuned per 60 Hz frame; scale by elapsed time so a 120 Hz screen does not run
    // the field at double speed, and a long gap (tab switch) does not jump it.
    const draw = (now: number) => {
      const step = last ? Math.min((now - last) / (1000 / 60), 3) : 1
      last = now
      ctx.clearRect(0, 0, width, height)
      for (const p of particles) {
        p.y -= p.speed * step
        p.x += p.drift * step
        p.phase += 0.012 * step
        if (p.y < -4) {
          p.y = height + 4
          p.x = Math.random() * width
        }
        if (p.x < -4) p.x = width + 4
        if (p.x > width + 4) p.x = -4

        // Twinkle, plus a soft fade towards every edge so the field has no border.
        const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(p.phase))
        const edge =
          Math.min(1, p.x / 120, (width - p.x) / 120) * Math.min(1, p.y / 140, (height - p.y) / 140)
        const alpha = twinkle * Math.max(0, edge) * 0.5
        if (alpha <= 0.003) continue

        // A nudge away from the pointer: enough to feel responsive, not enough to notice.
        const dx = (p.x - pointer.x) * 0.012
        const dy = (p.y - pointer.y) * 0.012

        ctx.beginPath()
        ctx.arc(p.x + dx, p.y + dy, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${pr}, ${pg}, ${pb}, ${alpha.toFixed(3)})`
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }

    // Measured on resize and when the field comes back into view, not on every pointermove:
    // a layout read per move while the canvas and the video are both painting is avoidable.
    const measureRect = () => {
      const rect = parent.getBoundingClientRect()
      origin.left = rect.left + window.scrollX
      origin.top = rect.top + window.scrollY
    }

    const onPointer = (e: PointerEvent) => {
      pointer.x = e.pageX - origin.left
      pointer.y = e.pageY - origin.top
    }

    // The accent changes with the theme, and the theme is an attribute on <html>.
    const themeObserver = new MutationObserver(() => {
      ;[pr, pg, pb] = resolveAccent(parent)
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    // The field only lives in the hero: stop drawing once it is scrolled away, instead of
    // clearing and repainting an invisible full-band canvas every frame.
    const io = new IntersectionObserver(([entry]) => {
      const next = entry?.isIntersecting ?? false
      if (next === isVisible) return
      isVisible = next
      cancelAnimationFrame(raf)
      if (isVisible) {
        last = 0
        measureRect()
        raf = requestAnimationFrame(draw)
      }
    })

    resize()
    measureRect()
    const ro = new ResizeObserver(() => {
      resize()
      measureRect()
    })
    ro.observe(parent)
    io.observe(parent)
    window.addEventListener('pointermove', onPointer, { passive: true })
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      themeObserver.disconnect()
      window.removeEventListener('pointermove', onPointer)
    }
  }, [quantity, reduce])

  if (reduce) return null

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 z-[-1]', className)}
    />
  )
}
