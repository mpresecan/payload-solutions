'use client'

import { useCallback, useEffect, useId, useRef, useState, type PointerEvent } from 'react'
import { brands, type BrandId } from './brands'
import { useReducedMotionSafe } from './reduced-motion'

/* -------------------------------------------------------------------------------------------------
   Oversized footer lockup: the mark and the brand word cut out of a plate the colour of the page,
   with a soft light that follows the pointer through the letterforms. The glyphs are filled with
   the plate colour itself, so at rest the word is a void; the light is what reveals it.

   The plate FOLLOWS THE THEME (--wordmark-ink is --bg) and the light inverts with it
   (--wordmark-reveal is white on dark, ink on light). Do not pin this block to one theme: it is
   the last thing on the page, and a black slab under a light footer reads as a broken section.

   The lockup itself is one inline SVG, with a single grain tile laid over the band. The wordmark
   is live text (same as the Logo component) rather than outlined paths, so it stays crisp, needs
   no asset per brand, and picks up Geist automatically.
   The coordinate space has a fixed height and a width that grows with the brand word, so the lockup
   always spans the container edge to edge whatever the word is.
   ------------------------------------------------------------------------------------------------- */

/** Height of the coordinate space. The giant baseline sits exactly on the bottom edge. */
const H = 440
/** Font size of the brand word, in user units. */
const GIANT = 430
/** Geist cap height as a fraction of the font size. */
const CAP = 0.72
/** Tracking of the giant word, in em. Matches the Logo wordmark. */
const TRACKING = -0.035

/**
 * The colour that reveals the letterforms. `var()` is not allowed in an SVG presentation
 * attribute (`stopColor="var(...)"` silently falls back), so every reveal stop takes it as a
 * style instead.
 */
const REVEAL = { stopColor: 'var(--wordmark-reveal, #fff)' } as const

const KICKER_SIZE = 40
const KICKER_BASELINE = 72
const KICKER_TRACKING = 0.18

/** Cap line of the giant word. */
const CAP_TOP = H - CAP * GIANT
/** Optical gap between the mark and the word. */
const GAP = 70

/** The mark is drawn in a 20 x 26 box; its ink spans x 0.713..18 and y 3.5..25.2. */
const MARK_INK = { x: 0.713, y: 3.5, w: 17.287, h: 21.7 }

/**
 * The mark is sized to the *visible* band rather than the full cap height, so the crop never
 * eats the notch that gives the mark its shape: letters stay legible from their tops, a
 * geometric glyph does not.
 */
function markGeometry(crop: number) {
  const available = H * (1 - crop) - CAP_TOP
  const scale = (available * 0.92) / MARK_INK.h
  return {
    scale,
    width: MARK_INK.w * scale,
    tx: -MARK_INK.x * scale,
    ty: CAP_TOP + available * 0.04 - MARK_INK.y * scale,
  }
}

/**
 * Advance widths for Geist SemiBold, in em. Used only for the server-rendered estimate; the real
 * width is measured with getComputedTextLength once the font is ready.
 */
const ADVANCE: Record<string, number> = {
  a: 0.56,
  b: 0.6,
  c: 0.53,
  d: 0.6,
  e: 0.57,
  f: 0.34,
  g: 0.6,
  h: 0.58,
  i: 0.26,
  j: 0.26,
  k: 0.55,
  l: 0.26,
  m: 0.88,
  n: 0.58,
  o: 0.6,
  p: 0.6,
  q: 0.6,
  r: 0.38,
  s: 0.52,
  t: 0.37,
  u: 0.58,
  v: 0.52,
  w: 0.79,
  x: 0.52,
  y: 0.52,
  z: 0.49,
  A: 0.68,
  B: 0.66,
  C: 0.68,
  D: 0.7,
  E: 0.6,
  F: 0.58,
  G: 0.72,
  H: 0.72,
  I: 0.28,
  J: 0.52,
  K: 0.66,
  L: 0.56,
  M: 0.88,
  N: 0.74,
  O: 0.76,
  P: 0.64,
  Q: 0.76,
  R: 0.66,
  S: 0.63,
  T: 0.62,
  U: 0.72,
  V: 0.68,
  W: 0.98,
  X: 0.66,
  Y: 0.64,
  Z: 0.6,
}

function estimateWidth(word: string): number {
  let em = 0
  for (const ch of word) em += (ADVANCE[ch] ?? 0.58) + TRACKING
  return Math.max(em, 0.5) * GIANT
}

export interface FooterWordmarkProps {
  brand: BrandId
  /**
   * Fraction of the lockup that bleeds off the bottom of the page. This is the detail that makes
   * the lockup read as oversized rather than merely large. 0 keeps it fully visible.
   */
  crop?: number
  /** Small mono kicker above the word. Set to null to show the brand word alone. */
  kicker?: string | null
  className?: string
}

export function FooterWordmark({
  brand,
  crop = 0.18,
  kicker = 'Payload',
  className,
}: FooterWordmarkProps) {
  const b = brands[brand]
  const uid = useId().replace(/[:]/g, '')
  const maskId = `fw-mask-${uid}`
  const glowId = `fw-glow-${uid}`
  const sheenId = `fw-sheen-${uid}`

  const svgRef = useRef<SVGSVGElement | null>(null)
  const textRef = useRef<SVGTextElement | null>(null)
  const glowRef = useRef<SVGCircleElement | null>(null)
  const frameRef = useRef<number | null>(null)

  const reduced = useReducedMotionSafe()
  const [textW, setTextW] = useState(() => estimateWidth(b.word))
  const [lit, setLit] = useState(false)

  const mark = markGeometry(crop)
  const TEXT_X = mark.width + GAP
  const W = TEXT_X + textW

  // Replace the estimate with the real advance width once Geist has loaded. Vertical metrics are
  // fixed above, so only the width (and therefore the aspect ratio) ever changes.
  useEffect(() => {
    const el = textRef.current
    if (!el) return
    let alive = true
    const measure = () => {
      if (!alive) return
      try {
        const w = el.getComputedTextLength()
        if (w > 0) setTextW((prev) => (Math.abs(prev - w) > 0.5 ? w : prev))
      } catch {
        /* not rendered yet */
      }
    }
    measure()
    document.fonts?.ready.then(measure).catch(() => {})
    return () => {
      alive = false
    }
  }, [b.word])

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    },
    [],
  )

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (reduced || e.pointerType === 'touch') return
      const { clientX, clientY } = e
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = requestAnimationFrame(() => {
        const svg = svgRef.current
        const glow = glowRef.current
        if (!svg || !glow) return
        const rect = svg.getBoundingClientRect()
        if (!rect.width) return
        const unitsPerPx = svg.viewBox.baseVal.width / rect.width
        glow.setAttribute('cx', String((clientX - rect.left) * unitsPerPx))
        glow.setAttribute('cy', String((clientY - rect.top) * unitsPerPx))
      })
    },
    [reduced],
  )

  const onPointerEnter = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (reduced || e.pointerType === 'touch') return
      setLit(true)
    },
    [reduced],
  )

  return (
    <div
      className={`relative isolate overflow-hidden bg-bg ${className ?? ''}`}
      onPointerMove={onPointerMove}
      onPointerEnter={onPointerEnter}
      onPointerLeave={() => setLit(false)}
    >
      <div className="container-content">
        <div
          className="pt-10 md:pt-16"
          style={{ marginBottom: `${-(crop * (H / W) * 100).toFixed(3)}%` }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W.toFixed(2)} ${H}`}
            preserveAspectRatio="xMidYMax meet"
            role="img"
            aria-label={b.name}
            style={{ display: 'block', width: '100%', height: 'auto' }}
          >
            {/* No <title>: on an element this large the browser's native tooltip follows the
                pointer across the whole footer. role="img" + aria-label names it for assistive
                technology without one. */}
            <defs>
              <mask id={maskId}>
                <rect width={W} height={H} fill="#000" />
                <g fill="#fff">
                  <g
                    transform={`translate(${mark.tx.toFixed(2)} ${mark.ty.toFixed(2)}) scale(${mark.scale.toFixed(4)})`}
                  >
                    <path d="M10.5 3.49976L0.713097 8.15257V20.4896L8.2737 25.1999V12.8629L18 7.99976L10.5 3.49976Z" />
                    <path d="M11 23.5V15L18 19.5L11 23.5Z" />
                  </g>
                  {kicker ? (
                    <text
                      x={0}
                      y={KICKER_BASELINE}
                      fontFamily="var(--font-mono)"
                      fontSize={KICKER_SIZE}
                      fontWeight={500}
                      letterSpacing={`${KICKER_TRACKING}em`}
                      style={{ textTransform: 'uppercase' }}
                    >
                      {kicker.toUpperCase()}
                    </text>
                  ) : null}
                  <text
                    ref={textRef}
                    x={TEXT_X}
                    y={H}
                    fontFamily="var(--font-sans)"
                    fontSize={GIANT}
                    fontWeight={600}
                    letterSpacing={`${TRACKING}em`}
                  >
                    {b.word}
                  </text>
                </g>
              </mask>

              {/* The light itself. Soft enough that no blur filter is needed. */}
              <radialGradient id={glowId}>
                <stop offset="0%" style={REVEAL} stopOpacity="0.42" />
                <stop offset="32%" style={REVEAL} stopOpacity="0.17" />
                <stop offset="66%" style={REVEAL} stopOpacity="0.04" />
                <stop offset="100%" style={REVEAL} stopOpacity="0" />
              </radialGradient>

              {/* Resting state: a quiet top-down sheen so the word is discoverable without a pointer
                  (and on touch, where there is none). */}
              <linearGradient id={sheenId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={REVEAL} stopOpacity="0.09" />
                <stop offset="100%" style={REVEAL} stopOpacity="0.015" />
              </linearGradient>
            </defs>

            <g mask={`url(#${maskId})`}>
              <rect width={W} height={H} style={{ fill: 'var(--wordmark-ink, #000)' }} />
              {/* Both reveal layers share one strength knob: ink on white carries further than
                  white on black, so the light theme runs them below full. */}
              <g style={{ opacity: 'var(--wordmark-reveal-opacity, 1)' }}>
                <rect width={W} height={H} fill={`url(#${sheenId})`} />
                <circle
                  ref={glowRef}
                  r={W * 0.36}
                  cx={W * 0.5}
                  cy={H * 0.3}
                  fill={`url(#${glowId})`}
                  style={{
                    opacity: lit ? 1 : 0,
                    transition: 'opacity 700ms var(--ease-out, cubic-bezier(0.165,0.84,0.44,1))',
                  }}
                />
              </g>
            </g>
          </svg>
        </div>
      </div>

      {/*
        Film grain, from the tile in each app's public/ folder, tiled at its own pixel size the
        way payloadcms.com does. The file is black speckle on alpha, so on the black plate it
        paints nothing and the only thing it touches is the light inside the letterforms — which
        is exactly where grain belongs. Painting it over the band rather than inside the mask
        keeps the tile at native resolution at every viewport, with no measurement.

        Optional by construction, like the `crt` layer: set --wordmark-grain to `none`, or leave
        the file out of public/, and this layer simply is not painted.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "var(--wordmark-grain, url('/noise.png'))",
          backgroundRepeat: 'repeat',
          backgroundSize: 'auto',
          opacity: 'var(--wordmark-grain-opacity, 0.6)',
        }}
      />
    </div>
  )
}
