'use client'

import { useEffect, useRef } from 'react'
import { ACCENT_COLORS } from './brands'

/**
 * The payload.solutions hero field: an isometric floor of the lid-and-base mark, one box per
 * package. Hovering lifts the lids under the pointer and lights them in their product
 * colours; clicking sends a ripple across the floor. With nobody touching it, a soft ripple
 * starts from a random tile every few seconds so the floor is never dead.
 *
 * Canvas 2D on purpose: ~500 small polygons a frame is nothing, and it needs no WebGL
 * fallback path. The canvas sits behind the hero copy and never receives events, so the
 * pointer is read on `window` against a cached rect (same approach as LiquidMark).

 *
 * Colours are literals from ACCENT_COLORS (their dark-theme values): the hero always sits in a
 * dark ThemeBand.
 */
export interface PackageFieldOptions {
  /** Field centre as fractions of the element, used when the element is wider than 1.35:1. */
  origin?: [number, number]
  /** Tile size multiplier. 1 = the shipped size. */
  tile?: number
  /** Overall opacity of the floor, 0-1. Keeps the field behind the copy, not beside it. */
  dim?: number
  /** How far a lifted lid travels toward its product colour, 0-1. */
  color?: number
}

const C30 = 0.8660254
const BOX = 10.3 // side of the mark's box in mark units (viewBox 20 x 26)
const LID: ReadonlyArray<readonly [number, number]> = [
  [10, 3.535],
  [18.92, 8.685],
  [10, 13.835],
  [1.08, 8.685],
]
const BASE: ReadonlyArray<readonly [number, number]> = [
  [1.08, 17.955],
  [10, 23.105],
  [18.92, 17.955],
  [18.92, 20.015],
  [10, 25.165],
  [1.08, 20.015],
]
const MARK_CENTRE: readonly [number, number] = [10, 14.35]
const IDLE_LID: Rgb = [31, 35, 41]
const SPREAD = 11 // tiles in each direction from the centre

type Rgb = [number, number, number]
type Ripple = { i: number; j: number; t0: number; amp: number }

const PALETTE: Rgb[] = Object.values(ACCENT_COLORS).map(({ accent }) => hexToRgb(accent))

export function PackageField({
  className,
  origin = [0.66, 0.55],
  tile = 1,
  dim = 0.72,
  color = 0.62,
}: PackageFieldOptions & { className?: string }) {
  const [originX, originY] = origin
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!host || !canvas || !ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let rect = host.getBoundingClientRect()
    let w = 0
    let h = 0
    let dpr = 1
    let s = 1 // mark units -> css px for one tile
    let u = 1 // tile spacing in css px
    let fx = 0
    let fy = 0

    const pointer = { x: 0, y: 0, inside: false }
    const hover = { i: 0, j: 0, a: 0 }
    let ripples: Ripple[] = []
    let t = 0
    let nextIdle = 1.2
    let raf = 0
    let last = 0
    let visible = true

    const layout = () => {
      rect = host.getBoundingClientRect()
      w = rect.width
      h = rect.height
      dpr = Math.min(1.5, window.devicePixelRatio || 1)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      const wide = w / Math.max(h, 1) > 1.35
      const [ox, oy] = wide ? [originX, originY] : [0.5, 0.5]
      fx = w * ox
      fy = h * oy
      s = Math.max(1.1, Math.min(h, wide ? h : w) * 0.0046 * tile)
      u = BOX * 1.4 * s
    }

    const toField = (x: number, y: number): [number, number] => {
      const a = (x - fx) / (C30 * u)
      const b = (y - fy) / (0.5 * u)
      return [(a + b) / 2, (b - a) / 2]
    }

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const target = pointer.inside ? toField(pointer.x, pointer.y) : null
      if (target) {
        hover.i += (target[0] - hover.i) * 0.22
        hover.j += (target[1] - hover.j) * 0.22
      }
      hover.a += ((target ? 1 : 0) - hover.a) * 0.12

      const reach = Math.max(w, h) * 0.55
      for (let sum = -2 * SPREAD; sum <= 2 * SPREAD; sum++) {
        for (let i = -SPREAD; i <= SPREAD; i++) {
          const j = sum - i
          if (j < -SPREAD || j > SPREAD) continue
          const cx = fx + (i - j) * C30 * u
          const cy = fy + (i + j) * 0.5 * u
          if (cx < -u || cx > w + u || cy < -2 * u || cy > h + u) continue

          const fade = Math.min(
            1,
            Math.max(0, 1 - (Math.hypot(cx - fx, (cy - fy) * 1.4) / reach) * 0.95),
          )
          if (fade <= 0.02) continue

          let lift = 0
          if (hover.a > 0.01) {
            lift += 1.5 * hover.a * Math.exp(-((i - hover.i) ** 2 + (j - hover.j) ** 2) / 4)
          }
          for (const r of ripples) {
            const age = t - r.t0
            const d = Math.hypot(i - r.i, j - r.j)
            lift += r.amp * Math.exp(-((d - age * 5) ** 2) / 1.4) * Math.exp(-age * 0.8)
          }
          if (reduceMotion) lift = Math.max(0, 1.4 - Math.hypot(i - 2, j + 1) * 0.35)
          lift = Math.min(lift, 2.2)
          const lit = Math.min(1, lift)

          ctx.globalAlpha = fade * dim
          fillPolygon(ctx, BASE, cx, cy, s, 0, `rgba(130,138,150,${0.22 + 0.28 * lit})`)
          const k = Math.min(1, lift / 1.2) * color
          const accent =
            PALETTE[(((i * 7 + j * 13) % PALETTE.length) + PALETTE.length) % PALETTE.length] ??
            IDLE_LID
          fillPolygon(ctx, LID, cx, cy, s, lift * 3.2, rgb(mixRgb(IDLE_LID, accent, k)))
        }
      }
      ctx.globalAlpha = 1
    }

    const frame = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0
      last = now
      t += dt
      if (!pointer.inside && t > nextIdle) {
        ripples.push({
          i: (Math.random() - 0.5) * 10,
          j: (Math.random() - 0.5) * 10,
          t0: t,
          amp: 1.3,
        })
        nextIdle = t + 2.4
      }
      ripples = ripples.filter((r) => t - r.t0 < 4)
      draw()
      raf = visible ? requestAnimationFrame(frame) : 0
    }

    const start = () => {
      if (reduceMotion || raf) return
      last = 0
      raf = requestAnimationFrame(frame)
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      pointer.x = e.clientX - rect.left
      pointer.y = e.clientY - rect.top
      pointer.inside = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= w && pointer.y <= h
    }
    const onDown = (e: PointerEvent) => {
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      if (x < 0 || y < 0 || x > w || y > h) return
      // Clicks on the hero's links and buttons are theirs, not the field's.
      if (
        (e.target as Element | null)?.closest?.(
          'a, button, input, select, textarea, [role="button"]',
        )
      )
        return
      const [i, j] = toField(x, y)
      ripples.push({ i, j, t0: t, amp: 2 })
      nextIdle = t + 4
    }
    const onLeave = () => {
      pointer.inside = false
    }
    const onScroll = () => {
      rect = host.getBoundingClientRect()
    }

    layout()
    if (reduceMotion) draw()
    else start()

    const resize = new ResizeObserver(() => {
      layout()
      if (reduceMotion) draw()
    })
    resize.observe(host)
    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
      if (visible) start()
    })
    io.observe(host)

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      cancelAnimationFrame(raf)
      raf = 0
      resize.disconnect()
      io.disconnect()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('scroll', onScroll)
    }
  }, [originX, originY, tile, dim, color])

  return (
    <div ref={hostRef} aria-hidden="true" className={className}>
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
    </div>
  )
}

function fillPolygon(
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<readonly [number, number]>,
  cx: number,
  cy: number,
  s: number,
  lift: number,
  fill: string,
) {
  ctx.beginPath()
  points.forEach(([mx, my], n) => {
    const x = cx + (mx - MARK_CENTRE[0]) * s
    const y = cy + (my - lift - MARK_CENTRE[1]) * s
    if (n === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mixRgb(a: Rgb, b: Rgb, k: number): Rgb {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
}

function rgb([r, g, b]: Rgb): string {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
}
