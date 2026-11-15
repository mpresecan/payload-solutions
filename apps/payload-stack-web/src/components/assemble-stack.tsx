'use client'

import { useReducedMotionSafe } from '@payload-solutions/brand/reduced-motion'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

/**
 * The hero illustration: `create-payload-stack` assembles the stack.
 *
 * Three beats, looped.
 *  1. ASSEMBLE. The command types itself, then the project name. After that the transcript
 *     answers its prompts one at a time and each answer drops the layer it creates into a dashed
 *     slot. The optional plugins land in their own entity accent, and a
 *     declined one stays an empty slot, so "optional" is visible rather than claimed.
 *  2. TOUR. Once the stack is built, each layer lifts in turn. One glow travels down the stack
 *     under whichever layer is lifted, taking that layer's accent,
 *     and the transcript line that created it lights up.
 *  3. SWAP. At the bottom of the tour the database slab slides out to the left and the next
 *     adapter slides in from the right, and the Database answer in the transcript changes with it.
 *
 * Hovering (or tapping) a layer lifts it and pauses the loop; the database can be stepped by
 * clicking its slab or picked with the adapter buttons under the caption.
 *
 * The prompts mirror packages/create-payload-stack/src/cli.ts — same labels, same order. Three
 * prompts with no layer of their own (connection string, media storage, coding agents) are left
 * out. Keep it in sync when the prompts change; components/cli-transcript.tsx carries the full flow.
 *
 * Motion is transform/opacity only. Under reduced motion the stack is shown built, nothing runs
 * on a timer, and hover and the adapter buttons still work as cuts.
 *
 * Geometry is IsoStack's: 30 degree isometric projection, sx = (x - y) cos30, sy = (x + y) sin30.
 */

const COS30 = Math.cos(Math.PI / 6)
const W = 170
const WC = W * COS30
/** Slab thickness. Deliberately thin: the stack reads as plates, not blocks. */
const T = 6
const STEP = 32
/** Corner radius of a slab, in user units. Softened, not round. */
const R = 5
const LIFT = 28
const LIFT_ABOVE = 48
const LIFT_ABOVE_BASE = 20
const DROP = 44
const SWAP_X = 62

const BEAT_MS = 550
const ASSEMBLE_BEATS = 2
const TOUR_BEATS = 4
/** How long a tap keeps a layer lifted before the loop resumes. A mouse holds for as long as it hovers. */
const TOUCH_HOLD_MS = 6000

const ADAPTERS = ['PostgreSQL', 'MongoDB', 'SQLite', 'Vercel Postgres'] as const

type Brand = 'emails' | 'consent'

interface Slot {
  id: string
  /** Lies flat on the slab's front edge, so it has to be short. */
  tag: string
  name: string
  detail: string
  /** The transcript step that lands this layer. */
  at: number
  /** Stagger within a step that lands more than one layer, in seconds. */
  delay?: number
  /** Entity accent for an optional plugin. */
  brand?: Brand
  /** Drawn in the accent even at rest. */
  toned?: boolean
  /** Declined in the transcript: the slot stays empty. */
  skipped?: boolean
}

/** Bottom to top. */
const SLOTS: Slot[] = [
  { id: 'db', tag: '', name: 'Database', detail: 'Chosen when you scaffold. Swap it here.', at: 2 },
  {
    id: 'payload',
    tag: 'Payload CMS',
    name: 'Payload CMS',
    detail: 'Collections, access control, jobs, admin',
    at: 2,
    delay: 0.16,
  },
  {
    id: 'auth',
    tag: 'Better Auth',
    name: 'Better Auth',
    detail: 'Sessions, passkeys, 2FA, social sign-in',
    at: 3,
  },
  {
    id: 'orgs',
    tag: 'Organizations',
    name: 'Organizations',
    detail: 'Multi-tenant scoping, roles, invitations',
    at: 4,
  },
  {
    id: 'billing',
    tag: 'Stripe billing',
    name: 'Stripe billing',
    detail: 'Plans, seats, trials, customer portal',
    at: 5,
  },
  {
    id: 'emails',
    tag: 'Emails',
    name: 'Transactional Emails',
    detail: 'Optional. Email copy editable in the admin',
    at: 6,
    brand: 'emails',
    toned: true,
  },
  {
    id: 'consent',
    tag: 'Consent',
    name: 'Cookie Consent',
    detail: 'Optional. Banner, consent records, legal pages',
    at: 7,
    brand: 'consent',
    toned: true,
  },
  {
    id: 'scheduler',
    tag: 'Scheduler: add later',
    name: 'Action Scheduler',
    detail: '',
    at: 8,
    skipped: true,
  },
  {
    id: 'ui',
    tag: 'Next.js + shadcn/ui',
    name: 'Next.js + shadcn/ui',
    detail: 'Dashboard, account, marketing pages',
    at: 9,
    toned: true,
  },
]
const DB = 0
/** The transcript line whose answer is typed rather than shown. */
const NAME_LINE = 1
const BUILT = 9
const PLACEABLE = SLOTS.filter((s) => !s.skipped).length

interface Line {
  kind: 'cmd' | 'q' | 'done'
  label: string
  answer?: string
  /** Slots this line created; the line lights up while one of them is lifted. */
  slots: number[]
}

/** One line per step; `at` on a slot is an index into this list. */
function transcript(adapter: string): Line[] {
  return [
    { kind: 'cmd', label: 'npx create-payload-stack@latest', slots: [1] },
    { kind: 'q', label: 'Project name', answer: 'ridgeline', slots: [] },
    { kind: 'q', label: 'Database', answer: adapter, slots: [0] },
    {
      kind: 'q',
      label: 'Sign-in methods',
      answer: 'Email + password, Magic link, Passkeys',
      slots: [2],
    },
    { kind: 'q', label: 'Organizations (teams)', answer: 'Yes', slots: [3] },
    { kind: 'q', label: 'Billing', answer: 'Stripe subscriptions', slots: [4] },
    { kind: 'q', label: 'Transactional emails', answer: 'Yes', slots: [5] },
    { kind: 'q', label: 'Cookie consent and legal pages', answer: 'Yes', slots: [6] },
    { kind: 'q', label: 'Scheduled and recurring actions', answer: 'No', slots: [] },
    { kind: 'done', label: 'Done.', answer: 'pnpm dev', slots: [8] },
  ]
}

/** Top to bottom, then one swap per remaining adapter so a full tour shows every database. */
const TOUR: (number | 'swap')[] = [
  8,
  6,
  5,
  4,
  3,
  2,
  1,
  0,
  ...ADAPTERS.slice(1).map(() => 'swap' as const),
]

type Pt = [number, number]

/** A closed polygon with each corner cut back by `r` and bridged with a quadratic. */
function roundedPath(pts: Pt[], r: number) {
  const n = pts.length
  const f = (v: number) => v.toFixed(2)
  let d = ''
  for (let i = 0; i < n; i++) {
    const p = pts[i]!
    const toward = (q: Pt): Pt => {
      const dx = q[0] - p[0]
      const dy = q[1] - p[1]
      const len = Math.hypot(dx, dy)
      return [p[0] + (dx / len) * r, p[1] + (dy / len) * r]
    }
    const a = toward(pts[(i + n - 1) % n]!)
    const b = toward(pts[(i + 1) % n]!)
    d += `${i === 0 ? 'M' : 'L'}${f(a[0])} ${f(a[1])}Q${f(p[0])} ${f(p[1])} ${f(b[0])} ${f(b[1])}`
  }
  return `${d}Z`
}

/** A slab's top face at height 0. Every slot reuses it under a translate. */
const FACE = roundedPath(
  [
    [0, 0],
    [WC, W / 2],
    [0, W],
    [-WC, W / 2],
  ],
  R,
)
/** The same face stepped down fills the slab's thickness; the lowest copy carries the edge line. */
const SIDE_OFFSETS = [T, T - 2, T - 4].filter((o) => o > 0)
/** Lays text flat on a face: x runs along the front-left edge, towards the viewer. */
const FLAT = `matrix(${COS30.toFixed(4)} 0.5 ${(-COS30).toFixed(4)} 0.5 0 0)`

const VB_X = -WC - 12
const VB_Y = -(SLOTS.length - 1) * STEP - LIFT_ABOVE - 10
const VB_W = WC * 2 + 24
const VB_H = W + T + 14 - VB_Y

/**
 * Wall-clock time, read only from event handlers and the interval, never while rendering. It sits
 * behind a helper because the purity lint cannot tell a handler declared in a component body from
 * render-time code.
 */
const now = () => Date.now()

const EASE_LIFT = [0.65, 0, 0.25, 1] as const
const EASE_DROP = [0.2, 0.8, 0.2, 1] as const

interface State {
  /** Transcript lines revealed so far, 0 to BUILT. */
  step: number
  /** Position in TOUR, or -1 while assembling. */
  p: number
  /** Index into ADAPTERS. */
  db: number
  /** A layer lifted by hand, or -1. */
  manual: number
  /** Counts builds. The typed lines are keyed by it, so every rebuild types them again. */
  run: number
}

/**
 * Text that types itself once, a character per tick, with a block caret while it runs. Remount
 * it (change its key) to type again. `instant` shows the whole text and reports done at once.
 */
function Typed({
  text,
  charMs,
  instant,
  onDone,
}: {
  text: string
  charMs: number
  instant: boolean
  onDone: () => void
}) {
  const [n, setN] = useState(0)
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    if (instant) {
      doneRef.current()
      return
    }
    let i = 0
    const id = setInterval(() => {
      i += 1
      setN(i)
      if (i >= text.length) {
        clearInterval(id)
        doneRef.current()
      }
    }, charMs)
    return () => clearInterval(id)
  }, [text, charMs, instant])

  const typing = !instant && n < text.length
  return (
    <>
      {instant ? text : text.slice(0, n)}
      {typing ? <span className="as-caret" /> : null}
    </>
  )
}

function SlabBody({ tag, tagClass = 'as-tag' }: { tag: string; tagClass?: string }) {
  return (
    <>
      {SIDE_OFFSETS.map((o, i) => (
        <path
          key={o}
          d={FACE}
          transform={`translate(0 ${o})`}
          className={i === 0 ? 'as-side as-side-edge' : 'as-side'}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <path d={FACE} className="as-top" vectorEffect="non-scaling-stroke" />
      <text
        transform={FLAT}
        x={12}
        y={W - 9}
        className={tagClass}
        fontSize={8.5}
        letterSpacing={1.1}
      >
        {tag.toUpperCase()}
      </text>
    </>
  )
}

export function AssembleStack({ className }: { className?: string }) {
  const reduce = useReducedMotionSafe()
  const uid = useId()
  const captionId = `${uid}-caption`
  const blurId = `${uid}-glow`

  const [s, setS] = useState<State>({ step: 0, p: -1, db: 0, manual: -1, run: 0 })
  /** The latest state for the timer and the handlers, which must not re-subscribe on every change. */
  const sRef = useRef(s)
  useEffect(() => {
    sRef.current = s
  }, [s])

  const figureRef = useRef<HTMLElement>(null)
  const beat = useRef(0)
  /** Which typed lines have finished; the transcript waits for each before moving on. */
  const typed = useRef({ cmd: false, name: false })
  const holdUntil = useRef(0)
  const onScreen = useRef(true)
  /** When a pointer last arrived on a layer, so the tap that lifts the database does not also swap it. */
  const enteredAt = useRef(0)

  useEffect(() => {
    const el = figureRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => {
      onScreen.current = entry?.isIntersecting ?? true
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (reduce) return
    const id = setInterval(() => {
      if (!onScreen.current || document.hidden) return
      if (holdUntil.current > now()) return
      const cur = sRef.current
      if (cur.manual >= 0) {
        // A tap's hold ran out: let go and carry on from where the tour was.
        setS({ ...cur, manual: -1 })
        return
      }
      if (cur.p < 0) {
        // The command and the project name are typed; nothing follows until each has landed.
        if (cur.step === 0 && !typed.current.cmd) return
        if (cur.step === 1 && !typed.current.name) return
      }
      beat.current += 1
      if (cur.p < 0) {
        if (beat.current % ASSEMBLE_BEATS) return
        if (cur.step < BUILT) setS({ ...cur, step: cur.step + 1 })
        else {
          beat.current = 0
          setS({ ...cur, p: 0 })
        }
        return
      }
      if (beat.current % TOUR_BEATS) return
      const np = cur.p + 1
      if (np >= TOUR.length) {
        beat.current = 0
        typed.current = { cmd: false, name: false }
        setS({ ...cur, p: -1, step: 0, run: cur.run + 1 })
        return
      }
      setS({ ...cur, p: np, db: TOUR[np] === 'swap' ? (cur.db + 1) % ADAPTERS.length : cur.db })
    }, BEAT_MS)
    return () => clearInterval(id)
  }, [reduce])

  // Reduced motion shows the finished stack and never tours; nothing is stored for it.
  const step = reduce ? BUILT : s.step
  const p = reduce ? -1 : s.p
  const built = step >= BUILT
  const tourSlot = p >= 0 ? (TOUR[p] === 'swap' ? DB : (TOUR[p] as number)) : -1
  const active = s.manual >= 0 ? s.manual : tourSlot
  const adapter = ADAPTERS[s.db]!
  const lines = transcript(adapter)
  const landedCount = SLOTS.filter((slot) => !slot.skipped && step >= slot.at).length

  const liftOf = (j: number) => {
    if (active < 0) return 0
    if (j > active) return active === DB ? -LIFT_ABOVE_BASE : -LIFT_ABOVE
    if (j === active) return active === DB ? 0 : -LIFT
    return 0
  }

  const hold = (e: ReactPointerEvent) => {
    holdUntil.current = e.pointerType === 'mouse' ? Number.POSITIVE_INFINITY : now() + TOUCH_HOLD_MS
  }
  const pick = (j: number, e: ReactPointerEvent) => {
    hold(e)
    if (sRef.current.manual === j) return
    enteredAt.current = now()
    setS({ ...sRef.current, manual: j })
  }
  const release = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return
    holdUntil.current = 0
    if (sRef.current.manual >= 0) setS({ ...sRef.current, manual: -1 })
  }
  const setAdapter = (i: number) => {
    if (holdUntil.current !== Number.POSITIVE_INFINITY) holdUntil.current = now() + TOUCH_HOLD_MS
    setS({ ...sRef.current, manual: DB, db: i })
  }
  const stepAdapter = () => {
    // The same press that lifted the layer must not also swap it.
    if (now() - enteredAt.current < 350) return
    setAdapter((sRef.current.db + 1) % ADAPTERS.length)
  }
  const replay = () => {
    holdUntil.current = 0
    beat.current = 0
    typed.current = { cmd: false, name: false }
    setS({ ...sRef.current, step: 0, p: -1, manual: -1, run: sRef.current.run + 1 })
  }

  const activeSlot = active >= 0 ? SLOTS[active]! : null
  const capName = activeSlot
    ? active === DB
      ? adapter
      : activeSlot.name
    : built
      ? 'Stack ready'
      : 'Assembling'
  const capDetail = activeSlot
    ? activeSlot.detail
    : built
      ? 'Hover a layer to lift it.'
      : `${landedCount} of ${PLACEABLE} layers placed`
  const glowSlot = Math.max(active, 0)
  const glowY = -glowSlot * STEP + (active < 0 ? 0 : liftOf(glowSlot)) + W / 2 + T + 20
  const touring = p >= 0 && s.manual < 0

  const liftT = reduce ? { duration: 0 } : { duration: 0.56, ease: EASE_LIFT }
  const dropT = (delay = 0) =>
    reduce ? { duration: 0 } : { duration: 0.52, ease: EASE_DROP, delay }

  return (
    <figure
      ref={figureRef}
      className={className}
      aria-labelledby={captionId}
      onPointerLeave={(e) => release(e)}
    >
      <div className="grid items-center gap-8 md:grid-cols-[minmax(0,17.5rem)_minmax(0,1fr)] md:gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-10">
        <div className="order-2 min-w-0 md:order-1">
          <div
            className="flex min-h-[16.5rem] flex-col gap-[0.5rem] font-mono text-[0.6875rem] leading-[1.35] lg:min-h-[18.5rem] lg:gap-[0.625rem] lg:text-[0.75rem]"
            aria-hidden="true"
          >
            {lines.map((line, i) => {
              const shown = step >= i
              const hot = active >= 0 && line.slots.includes(active)
              const dim = active >= 0 && !hot
              return (
                <div
                  key={line.label}
                  className="flex gap-2 whitespace-nowrap transition-[opacity,transform,color] duration-300"
                  style={{ opacity: shown ? 1 : 0, transform: shown ? 'none' : 'translateY(4px)' }}
                >
                  <span className={hot ? 'text-accent' : 'text-fg-subtle'}>
                    {line.kind === 'cmd' ? '$' : line.kind === 'done' ? '└' : '◇'}
                  </span>
                  <span
                    className={`shrink-0 ${hot ? 'text-accent' : dim ? 'text-fg-muted' : 'text-fg'}`}
                  >
                    {line.kind === 'cmd' ? (
                      <Typed
                        key={s.run}
                        text={line.label}
                        charMs={42}
                        instant={reduce}
                        onDone={() => {
                          typed.current.cmd = true
                        }}
                      />
                    ) : (
                      line.label
                    )}
                  </span>
                  {line.answer ? (
                    <span
                      className={`ml-auto min-w-0 truncate ${line.answer === 'No' ? 'text-fg-subtle' : 'text-accent'}`}
                    >
                      {i === NAME_LINE ? (
                        shown ? (
                          <Typed
                            key={s.run}
                            text={line.answer}
                            charMs={75}
                            instant={reduce}
                            onDone={() => {
                              typed.current.name = true
                            }}
                          />
                        ) : null
                      ) : (
                        line.answer
                      )}
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>

          <div className="mt-5 min-h-[7.5rem]" data-brand={activeSlot?.brand}>
            <div className="flex items-baseline justify-between gap-4">
              <p
                className={`font-mono text-[0.75rem] uppercase tracking-[0.14em] transition-colors duration-300 ${
                  activeSlot || built ? 'text-accent' : 'text-fg-subtle'
                }`}
              >
                {capName}
              </p>
              {reduce ? null : (
                <button
                  type="button"
                  onClick={() => replay()}
                  className="pointer-events-auto -my-2 min-h-9 shrink-0 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-fg-subtle transition-colors hover:text-fg"
                >
                  Replay
                </button>
              )}
            </div>
            <p className="mt-1.5 text-[0.8125rem] leading-snug text-fg-muted">{capDetail}</p>
            <div className="relative mt-3 h-px bg-border">
              {touring ? (
                <span
                  key={p}
                  className="as-progress absolute inset-y-0 left-0 bg-accent"
                  style={{ animationDuration: `${BEAT_MS * TOUR_BEATS}ms` }}
                />
              ) : null}
            </div>
            <div
              className="mt-3 flex flex-wrap gap-1 transition-opacity duration-300"
              style={{
                opacity: active === DB ? 1 : 0,
                pointerEvents: active === DB ? 'auto' : 'none',
              }}
            >
              {ADAPTERS.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  tabIndex={active === DB ? 0 : -1}
                  aria-pressed={i === s.db}
                  onClick={() => setAdapter(i)}
                  className={`min-h-9 border px-2 font-mono text-[0.625rem] uppercase tracking-[0.08em] transition-colors duration-300 ${
                    i === s.db
                      ? 'border-accent text-accent'
                      : 'border-border text-fg-muted hover:text-fg'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <svg
          viewBox={`${VB_X.toFixed(2)} ${VB_Y} ${VB_W.toFixed(2)} ${VB_H}`}
          className="order-1 mx-auto h-auto w-full overflow-visible md:order-2 lg:max-w-[26rem]"
          role="img"
          aria-describedby={captionId}
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          <defs>
            <filter id={blurId} x="-50%" y="-150%" width="200%" height="400%">
              <feGaussianBlur stdDeviation="11" />
            </filter>
            <style>{`
              .as-top { fill: var(--slab-top); stroke: var(--border-strong); stroke-width: 1; transition: fill 360ms var(--ease-standard), stroke 360ms var(--ease-standard); }
              .as-side { fill: var(--slab-side-a); transition: fill 360ms var(--ease-standard), stroke 360ms var(--ease-standard); }
              .as-side-edge { stroke: var(--border-strong); stroke-width: 1; }
              .as-tag { fill: var(--fg-subtle); transition: fill 360ms var(--ease-standard); }
              .as-ghost { fill: none; stroke: var(--border-strong); stroke-width: 1; stroke-dasharray: 4 4; }
              .as-ghost-tag { fill: var(--fg-subtle); }
              .as-glow { fill: var(--accent); transition: fill 420ms var(--ease-standard); }
              .as-slab.is-toned .as-top { fill: color-mix(in srgb, var(--accent) 13%, var(--bg)); stroke: var(--accent); }
              .as-slab.is-toned .as-side { fill: color-mix(in srgb, var(--accent) 42%, var(--bg)); }
              .as-slab.is-toned .as-side-edge { stroke: color-mix(in srgb, var(--accent) 42%, var(--bg)); }
              .as-slab.is-toned .as-tag { fill: var(--accent); }
              .as-slab.is-on .as-top { fill: color-mix(in srgb, var(--accent) 20%, var(--bg)); stroke: var(--accent); }
              .as-slab.is-on .as-side { fill: color-mix(in srgb, var(--accent) 56%, var(--bg)); }
              .as-slab.is-on .as-side-edge { stroke: color-mix(in srgb, var(--accent) 56%, var(--bg)); }
              .as-slab.is-on .as-tag { fill: var(--accent); }
              .as-hit { fill: transparent; cursor: pointer; touch-action: pan-y; }
              @keyframes as-progress { from { width: 0; } to { width: 100%; } }
              .as-progress { animation: as-progress linear both; }
              @keyframes as-caret { 50% { opacity: 0; } }
              .as-caret { display: inline-block; width: 0.55em; height: 1.05em; margin-left: 1px; vertical-align: text-bottom; background: currentColor; animation: as-caret 900ms steps(1) infinite; }
            `}</style>
          </defs>

          {SLOTS.flatMap((slot, j) => {
            const landed = !slot.skipped && step >= slot.at
            const on = j === active
            const declined = slot.skipped && step >= slot.at
            // ONE glow for the whole stack. It is painted just under the lifted layer, so it has
            // to sit between that layer and the one below in paint order; the key keeps it the
            // same element as it moves through the list, so it travels from layer to layer
            // instead of fading out in one place and in at another.
            const glow =
              j === glowSlot ? (
                <g key="glow" data-brand={activeSlot?.brand}>
                  <motion.ellipse
                    className="as-glow"
                    cx={0}
                    cy={0}
                    rx={118}
                    ry={30}
                    filter={`url(#${blurId})`}
                    initial={false}
                    animate={{ y: glowY, opacity: active >= 0 ? 0.5 : 0 }}
                    transition={
                      reduce
                        ? { duration: 0 }
                        : { y: { duration: 0.56, ease: EASE_LIFT }, opacity: { duration: 0.42 } }
                    }
                  />
                </g>
              ) : null
            return [
              glow,
              <g key={slot.id} transform={`translate(0 ${-j * STEP})`} data-brand={slot.brand}>
                <motion.g initial={false} animate={{ y: liftOf(j) }} transition={liftT}>
                  <motion.g
                    initial={false}
                    animate={{ opacity: landed ? 0 : declined ? 0.9 : 0.55 }}
                    transition={liftT}
                  >
                    <path d={FACE} className="as-ghost" vectorEffect="non-scaling-stroke" />
                    {slot.skipped ? (
                      <motion.text
                        transform={FLAT}
                        x={12}
                        y={W - 9}
                        className="as-ghost-tag"
                        fontSize={8.5}
                        letterSpacing={1.1}
                        initial={false}
                        animate={{ opacity: declined ? 1 : 0 }}
                        transition={liftT}
                      >
                        {slot.tag.toUpperCase()}
                      </motion.text>
                    ) : null}
                  </motion.g>

                  {slot.skipped ? null : (
                    <>
                      <motion.g
                        className={`as-slab${slot.toned ? ' is-toned' : ''}${on ? ' is-on' : ''}`}
                        initial={false}
                        animate={{
                          y: landed ? 0 : -DROP,
                          opacity: landed ? (active >= 0 && j > active ? 0.5 : 1) : 0,
                        }}
                        transition={dropT(landed && active < 0 ? slot.delay : 0)}
                      >
                        {j === DB ? (
                          <AnimatePresence initial={false}>
                            <motion.g
                              key={adapter}
                              initial={reduce ? false : { x: SWAP_X, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              exit={
                                reduce
                                  ? { opacity: 0, transition: { duration: 0 } }
                                  : { x: -SWAP_X, opacity: 0 }
                              }
                              transition={{ duration: 0.4, ease: EASE_LIFT }}
                            >
                              <SlabBody tag={adapter} />
                            </motion.g>
                          </AnimatePresence>
                        ) : (
                          <SlabBody tag={slot.tag} />
                        )}
                      </motion.g>
                    </>
                  )}
                </motion.g>
              </g>,
            ]
          })}

          {/* Hit areas stay where the layers rest. If they rode the lift, a slab would move out
              from under the pointer, the one below would take the hover, and the stack would chase
              itself. Painted bottom-up, so each one only answers on the band that is visible. */}
          {built
            ? SLOTS.map((slot, j) =>
                slot.skipped ? null : (
                  <path
                    key={slot.id}
                    d={FACE}
                    transform={`translate(0 ${-j * STEP})`}
                    className="as-hit"
                    onPointerEnter={(e) => pick(j, e)}
                    onPointerDown={(e) => pick(j, e)}
                    onClick={j === DB ? () => stepAdapter() : undefined}
                  />
                ),
              )
            : null}
        </svg>
      </div>

      <figcaption id={captionId} className="sr-only">
        The Payload Stack, assembled by one command: a database of your choice (
        {ADAPTERS.join(', ')}), Payload CMS, Better Auth, organizations, Stripe billing, optional
        transactional emails, cookie consent and scheduled actions, and a Next.js front end with
        shadcn/ui.
      </figcaption>
    </figure>
  )
}
