import type { SimpleIcon } from 'simple-icons'
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
import { LogosCarousel } from '@/components/logos-carousel'
import { Reveal } from '@/components/reveal'

type Logo = { icon: SimpleIcon; name: string; href: string }

/**
 * Two groups of six, one logo per cell. The first group shows at rest (and is the only one shown
 * with reduced motion); the row then rotates whole groups, cell by cell, left to right.
 */
const GROUPS: Logo[][] = [
  [
    { icon: siPayloadcms, name: 'Payload', href: 'https://payloadcms.com' },
    { icon: siNextdotjs, name: 'Next.js', href: 'https://nextjs.org' },
    { icon: siBetterauth, name: 'Better Auth', href: 'https://better-auth.com' },
    { icon: siStripe, name: 'Stripe', href: 'https://stripe.com' },
    { icon: siShadcnui, name: 'shadcn/ui', href: 'https://ui.shadcn.com' },
    { icon: siTailwindcss, name: 'Tailwind CSS', href: 'https://tailwindcss.com' },
  ],
  [
    { icon: siPostgresql, name: 'PostgreSQL', href: 'https://www.postgresql.org' },
    { icon: siMongodb, name: 'MongoDB', href: 'https://www.mongodb.com' },
    { icon: siSqlite, name: 'SQLite', href: 'https://sqlite.org' },
    { icon: siResend, name: 'Resend', href: 'https://resend.com' },
    { icon: siVercel, name: 'Vercel', href: 'https://vercel.com' },
    { icon: siTurborepo, name: 'Turborepo', href: 'https://turbo.build' },
  ],
]

/**
 * Logo wall, set the way payloadcms.com sets its own: a sentence starting on the first grid
 * line, then a framed row of six square cells, each half a column wide, running from the
 * middle of the first column to the middle of the fourth — so every other cell divider lands
 * on a page grid line. Logos rotate a whole group at a time (LogosCarousel), staggered by cell.
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

            <LogosCarousel
              className="grid grid-cols-3 max-lg:border-l max-lg:border-border md:grid-cols-6"
              cellClassName="relative aspect-square bg-bg/50 lg:aspect-[3/2] max-lg:border-r max-lg:border-border max-md:[&:nth-child(-n+3)]:border-b"
              groups={GROUPS.map((group) =>
                group.map((logo) => (
                  <a
                    key={logo.icon.slug}
                    href={logo.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={logo.name}
                    className="absolute inset-0 flex items-center justify-center gap-2.5 text-fg/80 transition-colors hover:text-fg"
                  >
                    <BrandIcon icon={logo.icon} size={20} className="shrink-0" />
                    <span className="hidden text-sm font-medium tracking-[-0.01em] whitespace-nowrap lg:inline">
                      {logo.name}
                    </span>
                  </a>
                )),
              )}
            />
          </div>
        </Reveal>
      </div>
    </section>
  )
}
