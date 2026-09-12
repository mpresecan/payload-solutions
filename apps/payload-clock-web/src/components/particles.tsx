'use client'

import { useEffect, useRef } from 'react'
import { useReducedMotionSafe } from '@payload-solutions/brand/reduced-motion'
import { cn } from '@/lib/cn'

/*
  The old site's MagicUI particle field, kept and cut down.

  What changed: the original drew white dots at a fixed opacity over whatever was behind
  them, which on true black reads as dust on the screen. These drift slowly upward and
  twinkle, they are painted in the brand accent resolved from the live token, and the field
  fades out towards the edges so it never collides with the vignette in AmbientBackdrop.

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

export function Particles({
  className,
  quantity = 44,
}: {
  className?: string
  quantity?: number
}) {
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

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      for (const p of particles) {
        p.y -= p.speed
        p.x += p.drift
        p.phase += 0.012
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

    const onPointer = (e: PointerEvent) => {
      const rect = parent.getBoundingClientRect()
      pointer.x = e.clientX - rect.left
      pointer.y = e.clientY - rect.top
    }

    // The accent changes with the theme, and the theme is an attribute on <html>.
    const themeObserver = new MutationObserver(() => {
      ;[pr, pg, pb] = resolveAccent(parent)
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(parent)
    window.addEventListener('pointermove', onPointer, { passive: true })
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
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
