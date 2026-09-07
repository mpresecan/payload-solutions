'use client'

import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { useReducedMotionSafe } from './reduced-motion'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

/**
 * The brand's signature illustration: an isometric stack of slabs with one pillar running
 * through every layer. payloadstack.com uses it for the SaaS stack (database at the bottom),
 * payload.solutions for the product family (Payload CMS at the bottom).
 *
 * Motion is transform/opacity only: slabs assemble bottom-up on mount, hover lifts a label to
 * full contrast, and a layer with `cycle` becomes a SWAPPABLE MODULE — its slab and label slide
 * out to the left while the replacement slides in from the right, along a pillar that stays put.
 * It can be dragged, clicked or stepped through with the tick marks under its label. Static under
 * reduced motion (the swap still works, it just cuts instead of sliding).
 *
 * Geometry: 30 degree isometric projection, sx = (x - y) cos30, sy = (x + y) sin30 - z.
 */

export interface IsoLayer {
  id: string
  name: string
  detail: string
  /** Alternative names this layer swaps between (e.g. database choices). Makes the layer swappable. */
  cycle?: string[]
  /** Draw this layer with the accent color. */
  accent?: boolean
}

export interface IsoStackProps {
  layers: IsoLayer[]
  className?: string
  caption: string
  cycleIntervalMs?: number
}

const COS30 = Math.cos(Math.PI / 6)
const W = 170
const T = 16
const GAP = 30
const STEP = T + GAP
const LABEL_X = W * COS30 + 26

/** How far the swapping module travels, in user units. Opacity reaches 0 at this distance. */
const SWAP_X = 62
/** Drag past this (user units) and the swap commits instead of springing back. */
const COMMIT_X = 20
const TICK_W = 14
const TICK_GAP = 6

function topFace(z: number) {
  const a = [0, -z]
  const b = [W * COS30, W * 0.5 - z]
  const c = [0, W - z]
  const d = [-W * COS30, W * 0.5 - z]
  return { a, b, c, d, points: [a, b, c, d].map((p) => p.join(',')).join(' ') }
}
function rightFace(z: number) {
  const { b, c } = topFace(z)
  return [b, c, [c[0], c[1]! + T], [b[0], b[1]! + T]].map((p) => p.join(',')).join(' ')
}
function leftFace(z: number) {
  const { c, d } = topFace(z)
  return [d, c, [c[0], c[1]! + T], [d[0], d[1]! + T]].map((p) => p.join(',')).join(' ')
}
/**
 * The part of a slab a pointer can actually reach: its silhouette with the slab above punched
 * out of the top, since that one is painted later and takes the events itself. Used as the drag
 * target, so the empty gaps between slabs stay inert.
 */
function grabOutline(z: number, hasLayerAbove: boolean) {
  const { a, b, c, d } = topFace(z)
  const base = [
    [d[0], d[1]! + T],
    [c[0], c[1]! + T],
    [b[0], b[1]! + T],
  ]
  const top = hasLayerAbove
    ? (() => {
        const above = topFace(z + STEP)
        return [
          [above.b[0], above.b[1]! + T],
          [above.c[0], above.c[1]! + T],
          [above.d[0], above.d[1]! + T],
        ]
      })()
    : [b, a, d]
  return [...base, ...top].map((p) => p.join(',')).join(' ')
}
const topOf = (i: number) => W * 0.5 - i * STEP

export function IsoStack({ layers, className, caption, cycleIntervalMs = 3400 }: IsoStackProps) {
  const reduce = useReducedMotionSafe()
  const svgRef = useRef<SVGSVGElement>(null)

  const swapLayerId = layers.find((l) => l.cycle && l.cycle.length > 1)?.id
  const options = layers.find((l) => l.id === swapLayerId)?.cycle ?? []
  const count = options.length

  const [index, setIndex] = useState(0)
  const indexRef = useRef(0)
  indexRef.current = index

  const x = useMotionValue(0)
  const swapOpacity = useTransform(x, [-SWAP_X, 0, SWAP_X], [0, 1, 0])
  const busy = useRef(false)
  const [paused, setPaused] = useState(false)
  const [dragging, setDragging] = useState(false)

  /** Timestamp of the last manual swap, so the timer never yanks the layer out from under a hand. */
  const touchedAt = useRef(0)

  const swapTo = useCallback(
    async (target: number, dir: 1 | -1) => {
      if (busy.current || count < 2 || target === indexRef.current) return
      busy.current = true
      if (reduce) {
        setIndex(target)
        busy.current = false
        return
      }
      // Out the way it was pushed, then the replacement enters from the opposite side.
      await animate(x, -dir * SWAP_X, { duration: 0.22, ease: [0.4, 0, 1, 1] }).finished
      setIndex(target)
      indexRef.current = target
      x.set(dir * SWAP_X)
      await animate(x, 0, { duration: 0.4, ease: [0.16, 1, 0.3, 1] }).finished
      busy.current = false
    },
    [count, reduce, x],
  )

  const stepBy = useCallback(
    (dir: 1 | -1) => swapTo((indexRef.current + dir + count) % count, dir),
    [count, swapTo],
  )

  // The interval reads through a ref so a swap never restarts the clock.
  const autoRef = useRef(() => {})
  autoRef.current = () => {
    if (paused || dragging || busy.current) return
    if (Date.now() - touchedAt.current < cycleIntervalMs) return
    void stepBy(1)
  }
  useEffect(() => {
    if (reduce || count < 2) return
    const id = setInterval(() => autoRef.current(), cycleIntervalMs)
    return () => clearInterval(id)
  }, [reduce, count, cycleIntervalMs])

  const drag = useRef<{ startX: number; scale: number; moved: boolean } | null>(null)
  const sceneW = W * COS30 * 2 + 24

  const onPointerDown = (e: ReactPointerEvent<SVGElement>) => {
    if (count < 2 || busy.current) return
    const rect = svgRef.current?.getBoundingClientRect()
    drag.current = {
      startX: e.clientX,
      scale: rect && rect.width ? sceneW / rect.width : 1,
      moved: false,
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDragging(true)
  }
  const onPointerMove = (e: ReactPointerEvent<SVGElement>) => {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.startX) * d.scale
    if (Math.abs(dx) > 2) d.moved = true
    if (!reduce) x.set(Math.max(-SWAP_X, Math.min(SWAP_X, dx * 0.85)))
  }
  const endDrag = (e: ReactPointerEvent<SVGElement>) => {
    const d = drag.current
    drag.current = null
    setDragging(false)
    if (!d) return
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    const dx = x.get()
    touchedAt.current = Date.now()
    if (!d.moved) {
      void stepBy(1) // a plain click steps forward
      return
    }
    if (dx <= -COMMIT_X) void stepBy(1)
    else if (dx >= COMMIT_X) void stepBy(-1)
    else animate(x, 0, { duration: 0.3, ease: [0.16, 1, 0.3, 1] })
  }

  const grabHandlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onPointerEnter: () => setPaused(true),
    onPointerLeave: () => setPaused(false),
  }

  const lastIndex = layers.length - 1
  const pillarTop = -lastIndex * STEP - 34
  const pillarBottom = topOf(0)
  const vbX = -W * COS30 - 12
  const vbY = pillarTop - 14
  const vbH = W + T + Math.abs(vbY) + 12
  // The viewBox holds only the slabs. The labels (md and up) overflow to the right into padding
  // reserved on the wrapper, so on small screens, where they are hidden, the stack fills its
  // width instead of sitting in the left half of an otherwise empty box.
  const labelsW = 268
  const labelPad = `${((labelsW / (sceneW + labelsW)) * 100).toFixed(2)}%`
  const captionId = `iso-stack-caption-${layers.map((l) => l.id).join('-')}`

  const labelFor = (layer: IsoLayer) => {
    if (layer.id !== swapLayerId || !options.length) return layer.name
    return options[index % options.length]!
  }

  return (
    <figure className={className} aria-labelledby={captionId}>
      <div
        className="md:pr-(--iso-label-pad)"
        style={{ '--iso-label-pad': labelPad } as CSSProperties}
      >
        <svg
          ref={svgRef}
          viewBox={`${vbX} ${vbY} ${sceneW} ${vbH}`}
          className="h-auto w-full overflow-visible"
          role="img"
          aria-describedby={captionId}
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          <defs>
            <style>{`
            .iso-layer .iso-name { fill: var(--fg-muted); transition: fill var(--dur-fast) var(--ease-standard); }
            .iso-layer .iso-detail { fill: var(--fg-subtle); }
            .iso-layer .iso-top { transition: stroke var(--dur-fast) var(--ease-standard); }
            @media (hover: hover) {
              .iso-layer:hover .iso-name { fill: var(--fg); }
              .iso-layer:hover .iso-top { stroke: var(--fg); }
            }
            .iso-layer.is-accent .iso-name { fill: var(--accent); }
            .iso-grab { cursor: grab; touch-action: pan-y; }
            .iso-grab.is-dragging { cursor: grabbing; }
            .iso-tick { fill: var(--border-strong); transition: fill var(--dur-fast) var(--ease-standard); cursor: pointer; }
            .iso-tick.is-on { fill: var(--accent); }
            .iso-tick-hit { cursor: pointer; }
            @media (hover: hover) {
              .iso-tick-hit:hover .iso-tick { fill: var(--fg); }
              .iso-hint { opacity: 0; transition: opacity var(--dur-fast) var(--ease-standard); }
              .iso-layer:hover .iso-hint { opacity: 1; }
            }
            .iso-tick-hit:focus-visible { outline: 1px solid var(--fg); outline-offset: 3px; }
          `}</style>
          </defs>

          <line
            x1={0}
            y1={pillarTop}
            x2={0}
            y2={pillarBottom}
            stroke="var(--border-strong)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />

          {layers.map((layer, i) => {
            const z = i * STEP
            const tf = topFace(z)
            const labelY = W * 0.5 - z + T / 2
            const label = labelFor(layer)
            const isSwap = layer.id === swapLayerId && count > 1

            // The module: everything that slides. The pillar, the joints and the controls below
            // stay put, so the slab reads as a part being pulled off a fixed spine.
            const module = (
              <>
                <polygon
                  points={leftFace(z)}
                  fill="var(--slab-side-b)"
                  stroke="var(--border-strong)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                />
                <polygon
                  points={rightFace(z)}
                  fill="var(--slab-side-a)"
                  stroke="var(--border-strong)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                />
                <polygon
                  className="iso-top"
                  points={tf.points}
                  fill={layer.accent ? 'var(--accent-soft)' : 'var(--slab-top)'}
                  stroke={layer.accent ? 'var(--accent)' : 'var(--border-strong)'}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                />
                <g className="hidden md:block">
                  <line
                    x1={tf.b[0]! + 6}
                    y1={labelY}
                    x2={LABEL_X - 8}
                    y2={labelY}
                    stroke="var(--border)"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={LABEL_X}
                    y={labelY - 4}
                    className="iso-name"
                    fontSize={11.5}
                    letterSpacing={1.4}
                    style={{ textTransform: 'uppercase' }}
                  >
                    {label.toUpperCase()}
                  </text>
                  <text x={LABEL_X} y={labelY + 12} className="iso-detail" fontSize={10.5}>
                    {isSwap && reduce ? options.join(', ') : layer.detail}
                  </text>
                </g>
              </>
            )

            return (
              <motion.g
                key={layer.id}
                className={`iso-layer ${layer.accent ? 'is-accent' : ''}`}
                initial={reduce ? false : { opacity: 0, y: 26 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.15 + i * 0.09, ease: [0.16, 1, 0.3, 1] }}
              >
                {isSwap ? (
                  <motion.g style={{ x, opacity: swapOpacity }}>{module}</motion.g>
                ) : (
                  module
                )}

                {isSwap ? (
                  <>
                    <polygon
                      className={`iso-grab ${dragging ? 'is-dragging' : ''}`}
                      points={grabOutline(z, i < lastIndex)}
                      fill="transparent"
                      {...grabHandlers}
                    />
                    <rect
                      className={`iso-grab hidden md:block ${dragging ? 'is-dragging' : ''}`}
                      x={tf.b[0]! + 6}
                      y={labelY - 16}
                      width={LABEL_X + 250 - (tf.b[0]! + 6)}
                      height={32}
                      fill="transparent"
                      {...grabHandlers}
                    />
                    <g className="hidden md:block">
                      {options.map((option, j) => (
                        <g
                          key={option}
                          className="iso-tick-hit"
                          role="button"
                          tabIndex={0}
                          aria-label={`Show ${option}`}
                          aria-pressed={j === index}
                          onClick={() => {
                            touchedAt.current = Date.now()
                            void swapTo(j, j > index ? 1 : -1)
                          }}
                          onKeyDown={(e: ReactKeyboardEvent<SVGGElement>) => {
                            touchedAt.current = Date.now()
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              void swapTo(j, j > index ? 1 : -1)
                            }
                            if (e.key === 'ArrowRight') void stepBy(1)
                            if (e.key === 'ArrowLeft') void stepBy(-1)
                          }}
                          onPointerEnter={() => setPaused(true)}
                          onPointerLeave={() => setPaused(false)}
                        >
                          <rect
                            x={LABEL_X + j * (TICK_W + TICK_GAP) - 2}
                            y={labelY + 20}
                            width={TICK_W + 4}
                            height={12}
                            fill="transparent"
                          />
                          <rect
                            className={`iso-tick ${j === index ? 'is-on' : ''}`}
                            x={LABEL_X + j * (TICK_W + TICK_GAP)}
                            y={labelY + 25}
                            width={TICK_W}
                            height={2}
                          />
                        </g>
                      ))}
                      <text
                        className="iso-hint iso-detail"
                        x={LABEL_X + count * (TICK_W + TICK_GAP) + 6}
                        y={labelY + 29}
                        fontSize={9}
                        letterSpacing={1.1}
                        style={{ textTransform: 'uppercase' }}
                      >
                        drag to swap
                      </text>
                    </g>
                  </>
                ) : null}

                {i < lastIndex ? (
                  <line
                    x1={0}
                    y1={topOf(i)}
                    x2={0}
                    y2={topOf(i) - GAP}
                    stroke="var(--border-strong)"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                ) : (
                  <>
                    <line
                      x1={0}
                      y1={topOf(i)}
                      x2={0}
                      y2={topOf(i) - 34}
                      stroke="var(--border-strong)"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                    <circle
                      cx={0}
                      cy={topOf(i) - 34}
                      r={3.5}
                      fill="var(--bg)"
                      stroke="var(--fg)"
                      strokeWidth={1.5}
                      vectorEffect="non-scaling-stroke"
                    />
                  </>
                )}
                <circle
                  cx={0}
                  cy={topOf(i)}
                  r={3}
                  fill={layer.accent ? 'var(--accent)' : 'var(--fg)'}
                />
              </motion.g>
            )
          })}
        </svg>
      </div>

      <ol className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-fg-muted md:hidden">
        {[...layers].reverse().map((l) => (
          <li key={l.id} className={l.accent ? 'text-accent' : undefined}>
            {labelFor(l)}
          </li>
        ))}
      </ol>

      <figcaption id={captionId} className="sr-only">
        {caption}
      </figcaption>
    </figure>
  )
}
