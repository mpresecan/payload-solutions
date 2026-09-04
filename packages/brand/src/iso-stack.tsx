'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

/**
 * The brand's signature illustration: an isometric stack of slabs with one pillar running
 * through every layer. payloadstack.com uses it for the SaaS stack (database at the bottom),
 * payload.solutions for the product family (Payload CMS at the bottom).
 *
 * Motion is transform/opacity only: slabs assemble bottom-up on mount, an optional layer cycles
 * through alternative labels, hover lifts a label to full contrast. Static under reduced motion.
 *
 * Geometry: 30 degree isometric projection, sx = (x - y) cos30, sy = (x + y) sin30 - z.
 */

export interface IsoLayer {
  id: string
  name: string
  detail: string
  /** Alternative names that cycle in place of `name` (e.g. database choices). */
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
const topOf = (i: number) => W * 0.5 - i * STEP

export function IsoStack({ layers, className, caption, cycleIntervalMs = 2600 }: IsoStackProps) {
  const reduce = useReducedMotion()
  const [tick, setTick] = useState(0)
  const hasCycle = layers.some((l) => l.cycle && l.cycle.length > 0)

  useEffect(() => {
    if (reduce || !hasCycle) return
    const id = setInterval(() => setTick((t) => t + 1), cycleIntervalMs)
    return () => clearInterval(id)
  }, [reduce, hasCycle, cycleIntervalMs])

  const lastIndex = layers.length - 1
  const pillarTop = -lastIndex * STEP - 34
  const pillarBottom = topOf(0)
  const vbX = -W * COS30 - 12
  const vbY = pillarTop - 14
  const vbW = W * COS30 * 2 + 12 + 280
  const vbH = W + T + Math.abs(vbY) + 12
  const captionId = `iso-stack-caption-${layers.map((l) => l.id).join('-')}`

  const labelFor = (layer: IsoLayer) => {
    if (!layer.cycle?.length) return layer.name
    if (reduce) return layer.name
    return layer.cycle[tick % layer.cycle.length]!
  }

  return (
    <figure className={className} aria-labelledby={captionId}>
      <svg
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
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
          `}</style>
        </defs>

        <line x1={0} y1={pillarTop} x2={0} y2={pillarBottom} stroke="var(--border-strong)" strokeWidth={2} vectorEffect="non-scaling-stroke" />

        {layers.map((layer, i) => {
          const z = i * STEP
          const tf = topFace(z)
          const labelY = W * 0.5 - z + T / 2
          const label = labelFor(layer)
          return (
            <motion.g
              key={layer.id}
              className={`iso-layer ${layer.accent ? 'is-accent' : ''}`}
              initial={reduce ? false : { opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 + i * 0.09, ease: [0.16, 1, 0.3, 1] }}
            >
              <polygon points={leftFace(z)} fill="var(--slab-side-b)" stroke="var(--border-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              <polygon points={rightFace(z)} fill="var(--slab-side-a)" stroke="var(--border-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              <polygon
                className="iso-top"
                points={tf.points}
                fill={layer.accent ? 'var(--accent-soft)' : 'var(--slab-top)'}
                stroke={layer.accent ? 'var(--accent)' : 'var(--border-strong)'}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
              {i < lastIndex ? (
                <line x1={0} y1={topOf(i)} x2={0} y2={topOf(i) - GAP} stroke="var(--border-strong)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              ) : (
                <>
                  <line x1={0} y1={topOf(i)} x2={0} y2={topOf(i) - 34} stroke="var(--border-strong)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                  <circle cx={0} cy={topOf(i) - 34} r={3.5} fill="var(--bg)" stroke="var(--fg)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                </>
              )}
              <circle cx={0} cy={topOf(i)} r={3} fill={layer.accent ? 'var(--accent)' : 'var(--fg)'} />

              <g className="hidden md:block">
                <line x1={tf.b[0]! + 6} y1={labelY} x2={LABEL_X - 8} y2={labelY} stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                <text x={LABEL_X} y={labelY - 4} className="iso-name" fontSize={11.5} letterSpacing={1.4} style={{ textTransform: 'uppercase' }}>
                  {layer.cycle?.length && !reduce ? (
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.tspan key={label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                        {label.toUpperCase()}
                      </motion.tspan>
                    </AnimatePresence>
                  ) : (
                    label.toUpperCase()
                  )}
                </text>
                <text x={LABEL_X} y={labelY + 12} className="iso-detail" fontSize={10.5}>
                  {layer.cycle?.length && reduce ? layer.cycle.join(', ') : layer.detail}
                </text>
              </g>
            </motion.g>
          )
        })}
      </svg>

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
