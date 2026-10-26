import type { SimpleIcon } from 'simple-icons'
import type { CSSProperties } from 'react'
import {
  siBetterauth,
  siMongodb,
  siNextdotjs,
  siPayloadcms,
  siPostgresql,
  siResend,
  siShadcnui,
  siSqlite,
  siStripe,
  siTailwindcss,
  siTurborepo,
  siVercel,
} from 'simple-icons'
import { GridCross } from '@payload-solutions/brand/crosshairs'
import { BrandIcon } from '@/components/brand-icon'
import { Reveal } from '@/components/reveal'

type Logo = { icon: SimpleIcon; name: string; href: string }

/**
 * Six cells, two logos each. The first logo of every pair shows at rest (and is the only one
 * shown with reduced motion); the second takes its place on the swap.
 */
const CELLS: [Logo, Logo][] = [
  [
    { icon: siPayloadcms, name: 'Payload', href: 'https://payloadcms.com' },
    { icon: siPostgresql, name: 'PostgreSQL', href: 'https://www.postgresql.org' },
  ],
  [
    { icon: siNextdotjs, name: 'Next.js', href: 'https://nextjs.org' },
    { icon: siMongodb, name: 'MongoDB', href: 'https://www.mongodb.com' },
  ],
  [
    { icon: siBetterauth, name: 'Better Auth', href: 'https://better-auth.com' },
    { icon: siSqlite, name: 'SQLite', href: 'https://sqlite.org' },
  ],
  [
    { icon: siStripe, name: 'Stripe', href: 'https://stripe.com' },
    { icon: siResend, name: 'Resend', href: 'https://resend.com' },
  ],
  [
    { icon: siShadcnui, name: 'shadcn/ui', href: 'https://ui.shadcn.com' },
    { icon: siVercel, name: 'Vercel', href: 'https://vercel.com' },
  ],
  [
    { icon: siTailwindcss, name: 'Tailwind CSS', href: 'https://tailwindcss.com' },
    { icon: siTurborepo, name: 'Turborepo', href: 'https://turbo.build' },
  ],
]

/** Seconds one cross-fade takes. Must match the keyframe stops in globals.css. */
const SWAP_FADE_S = 1
/** Seconds the row rests after one cell has finished swapping, before the next cell starts. */
const SWAP_HOLD_S = 0.5
/** Seconds between one cell swapping and the next, so the row changes one cell at a time. */
const SWAP_STAGGER_S = SWAP_FADE_S + SWAP_HOLD_S
/**
 * Six cells swap out, then six swap back: twelve swaps per cycle, evenly spaced. Must match the
 * `logo-swap` animation duration in globals.css (18s).
 */
const SWAP_CYCLE_S = SWAP_STAGGER_S * CELLS.length * 2
/** Seconds after load before the first cell swaps. */
const FIRST_SWAP_S = 2.5
/** Where in the cycle the cross-fade is half done (the fade-out ends at 50% of the keyframes). */
const SWAP_MIDPOINT_S = SWAP_CYCLE_S / 2 - SWAP_FADE_S / 2

/**
 * Logo wall, set the way payloadcms.com sets its own: a sentence starting on the first grid
 * line, then a framed row of six square cells, each half a column wide, running from the
 * middle of the first column to the middle of the fourth — so every other cell divider lands
 * on a page grid line. Logos cross-fade through a blur, one cell at a time. CSS only, no JS.
 */
export function BuiltWith() {
  return (
    <section aria-labelledby="built-with-heading" className="relative py-14 lg:py-16">
      <div className="container-content">
        <div className="col-grid">
          <Reveal className="lg:col-span-2 lg:col-start-2">
            <p
              id="built-with-heading"
              className="text-base leading-snug tracking-[-0.01em] text-fg lg:text-lg"
            >
              Built on the tools SaaS teams already run in production.
            </p>
          </Reveal>
        </div>

        {/* Spans exactly the four columns, so the crosses can sit on grid lines 1 and 3. */}
        <Reveal variant="media" index={1} className="relative mt-6 lg:mt-8">
          <GridCross line={1} contained />
          <GridCross line={3} edge="bottom" contained />

          <div className="relative border-y border-border lg:mx-[12.5%]">
            {/* Desktop dividers, drawn with GridColumns' own formula so the ones on grid lines
                land on exactly the same pixel instead of doubling up beside them. */}
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <span
                key={i}
                aria-hidden
                className="pointer-events-none absolute inset-y-0 hidden w-px bg-border lg:block"
                style={{ left: `${(i / 6) * 100}%`, marginLeft: i === 6 ? '-1px' : undefined }}
              />
            ))}

            <ul className="grid grid-cols-3 max-lg:border-l max-lg:border-border md:grid-cols-6">
              {CELLS.map((pair, cell) => {
                const phase = mod(SWAP_MIDPOINT_S - FIRST_SWAP_S - cell * SWAP_STAGGER_S, SWAP_CYCLE_S)
                return (
                  <li
                    key={pair[0].icon.slug}
                    className="relative aspect-square bg-bg/50 lg:aspect-[3/2] max-lg:border-r max-lg:border-border max-md:[&:nth-child(-n+3)]:border-b"
                  >
                    {pair.map((logo, i) => (
                      <a
                        key={logo.icon.slug}
                        href={logo.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        aria-label={logo.name}
                        // Only the resting logo takes keyboard focus; an invisible focus target
                        // would strand the focus ring. Both stay in the list for screen readers.
                        tabIndex={i === 0 ? undefined : -1}
                        className={`logo-swap ${i === 1 ? 'logo-swap-alt' : ''} absolute inset-0 flex items-center justify-center gap-2.5 text-fg/80 transition-colors hover:text-fg`}
                        style={
                          {
                            animationDelay: `-${mod(phase + (i === 1 ? SWAP_CYCLE_S / 2 : 0), SWAP_CYCLE_S).toFixed(2)}s`,
                          } as CSSProperties
                        }
                      >
                        <BrandIcon icon={logo.icon} size={20} className="shrink-0" />
                        <span className="hidden text-sm font-medium tracking-[-0.01em] whitespace-nowrap lg:inline">
                          {logo.name}
                        </span>
                      </a>
                    ))}
                  </li>
                )
              })}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function mod(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor
}
