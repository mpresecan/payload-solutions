'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

/**
 * The Payload Stack, drawn as an isometric stack of slabs with one pillar running through
 * every layer. Bottom layer is the database and cycles through the adapters the CLI offers.
 *
 * Motion (all transform/opacity):
 *  - on mount the slabs assemble from the bottom up (storytelling: the stack is built for you)
 *  - the database label crossfades every 2.6s (state: the choice is yours)
 *  - hovering a layer lifts its label to full contrast (feedback)
 * Under prefers-reduced-motion everything renders static and the database line lists the options.
 *
 * Geometry: 30 degree isometric projection. Plan coordinates (x, y) and height z map to
 *   sx = (x - y) * cos(30deg),  sy = (x + y) * sin(30deg) - z
 */

const COS30 = Math.cos(Math.PI / 6)
const W = 170 // slab footprint (square)
const T = 16 // slab thickness
const GAP = 30 // clear space between slabs, where the pillar shows
const STEP = T + GAP

const DATABASES = ['PostgreSQL', 'MongoDB', 'SQLite', 'Vercel Postgres']

interface Layer {
  id: string
  name: string
  detail: string
}

const LAYERS: Layer[] = [
  { id: 'db', name: 'Database', detail: 'Chosen when you scaffold' },
  { id: 'payload', name: 'Payload CMS', detail: 'Collections, access control, jobs, admin' },
  { id: 'auth', name: 'Better Auth', detail: 'Sessions, passkeys, 2FA, social sign-in' },
  { id: 'orgs', name: 'Organizations', detail: 'Multi-tenant scoping, roles, invitations' },
  { id: 'billing', name: 'Stripe billing', detail: 'Plans, seats, trials, customer portal' },
  { id: 'ui', name: 'Next.js + shadcn/ui', detail: 'Dashboard, account, marketing pages' },
]

// Projected top-face rhombus for a slab whose top sits at height z.
function topFace(z: number) {
  const a = [0, -z] // back corner
  const b = [W * COS30, W * 0.5 - z] // right
  const c = [0, W - z] // front
  const d = [-W * COS30, W * 0.5 - z] // left
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

const topOf = (i: number) => W * 0.5 - i * STEP // sy of a slab's top-face centre
const LABEL_X = W * COS30 + 26

export function StackVisual({ className }: { className?: string }) {
  const reduce = useReducedMotion()
  const [dbIndex, setDbIndex] = useState(0)

  useEffect(() => {
    if (reduce) return
    const id = setInterval(() => setDbIndex((i) => (i + 1) % DATABASES.length), 2600)
    return () => clearInterval(id)
  }, [reduce])

  const lastIndex = LAYERS.length - 1
  const pillarTop = -lastIndex * STEP - 34
  const pillarBottom = topOf(0)

  // viewBox: leave room for labels on the right and the pillar cap on top
  const vbX = -W * COS30 - 12
  const vbY = pillarTop - 14
  const vbW = W * COS30 * 2 + 12 + 280
  const vbH = W + T + Math.abs(vbY) + 12

  return (
    <figure className={className} aria-labelledby="stack-visual-caption">
      <svg
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-describedby="stack-visual-caption"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        <defs>
          <style>{`
            .layer .lbl-name { fill: var(--fg-muted); transition: fill var(--dur-fast) var(--ease-standard); }
            .layer .lbl-detail { fill: var(--fg-subtle); }
            .layer .face-top { transition: stroke var(--dur-fast) var(--ease-standard); }
            @media (hover: hover) {
              .layer:hover .lbl-name { fill: var(--fg); }
              .layer:hover .face-top { stroke: var(--fg); }
            }
            .layer.is-db .lbl-name { fill: var(--accent); }
          `}</style>
        </defs>

        {/* Pillar, drawn first so the slabs occlude it where they pass through */}
        <line
          x1={0}
          y1={pillarTop}
          x2={0}
          y2={pillarBottom}
          stroke="var(--border-strong)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />

        {LAYERS.map((layer, i) => {
          const z = i * STEP
          const tf = topFace(z)
          const isDb = i === 0
          const labelY = W * 0.5 - z + T / 2
          return (
            <motion.g
              key={layer.id}
              className={`layer ${isDb ? 'is-db' : ''}`}
              initial={reduce ? false : { opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 + i * 0.09, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* side faces */}
              <polygon points={leftFace(z)} fill="var(--slab-side-b)" stroke="var(--border-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              <polygon points={rightFace(z)} fill="var(--slab-side-a)" stroke="var(--border-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              {/* top face */}
              <polygon
                className="face-top"
                points={tf.points}
                fill={isDb ? 'var(--accent-soft)' : 'var(--slab-top)'}
                stroke={isDb ? 'var(--accent)' : 'var(--border-strong)'}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
              {/* pillar segment rising from this slab to the next one, plus the junction node */}
              {i < lastIndex ? (
                <line x1={0} y1={topOf(i)} x2={0} y2={topOf(i) - GAP} stroke="var(--border-strong)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              ) : (
                <>
                  <line x1={0} y1={topOf(i)} x2={0} y2={topOf(i) - 34} stroke="var(--border-strong)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                  <circle cx={0} cy={topOf(i) - 34} r={3.5} fill="var(--bg)" stroke="var(--fg)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                </>
              )}
              <circle cx={0} cy={topOf(i)} r={3} fill={isDb ? 'var(--accent)' : 'var(--fg)'} />

              {/* leader + label (desktop only; a legend replaces them on small screens) */}
              <g className="hidden md:block">
                <line x1={tf.b[0]! + 6} y1={labelY} x2={LABEL_X - 8} y2={labelY} stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                <text x={LABEL_X} y={labelY - 4} className="lbl-name" fontSize={11.5} letterSpacing={1.4} style={{ textTransform: 'uppercase' }}>
                  {isDb ? (
                    reduce ? (
                      'DATABASE'
                    ) : (
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.tspan
                          key={DATABASES[dbIndex]}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          {DATABASES[dbIndex]!.toUpperCase()}
                        </motion.tspan>
                      </AnimatePresence>
                    )
                  ) : (
                    layer.name.toUpperCase()
                  )}
                </text>
                <text x={LABEL_X} y={labelY + 12} className="lbl-detail" fontSize={10.5}>
                  {isDb && reduce ? DATABASES.join(', ') : layer.detail}
                </text>
              </g>
            </motion.g>
          )
        })}
      </svg>

      {/* Mobile legend: same layers, top to bottom */}
      <ol className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-fg-muted md:hidden">
        {[...LAYERS].reverse().map((l) => (
          <li key={l.id} className={l.id === 'db' ? 'text-accent' : undefined}>
            {l.id === 'db' ? DATABASES[reduce ? 0 : dbIndex] : l.name}
          </li>
        ))}
      </ol>

      <figcaption id="stack-visual-caption" className="sr-only">
        The Payload Stack: a database of your choice (PostgreSQL, MongoDB, SQLite or Vercel Postgres),
        Payload CMS, Better Auth, organizations, Stripe billing, and a Next.js front end
        with shadcn/ui, connected by one configuration.
      </figcaption>
    </figure>
  )
}
