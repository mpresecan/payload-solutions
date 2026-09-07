import type { Metadata } from 'next'
import { LiquidMark } from '@payload-solutions/brand/liquid-mark'
import { ThemeBand } from '@payload-solutions/brand/theme-band'
import { Hero } from '@/sections/hero'

export const metadata: Metadata = {
  title: 'Hero lab',
  robots: { index: false, follow: false },
}

const VARIANTS = [
  {
    label: 'Shipped defaults',
    note: 'What the homepage renders.',
    props: {},
  },
  {
    label: 'Slower reform',
    note: 'Ink lingers; the mark takes its time coming back.',
    props: { reform: 0.6, viscosity: 0.985 },
  },
  {
    label: 'Tighter, faster',
    note: 'Small splat, quick settle — reads closer to a ripple than a smear.',
    props: { reform: 3.2, radius: 0.07, force: 1.1 },
  },
  {
    label: 'Idle only',
    note: 'No pointer force at all: what a touch device sees.',
    props: { force: 0, drift: 0.34 },
  },
  {
    label: 'No accent bleed',
    note: 'Monochrome ink, in case the orange is too much on the band.',
    props: { accentBleed: 0 },
  },
  {
    label: 'Centred mark',
    note: 'Alternative composition for a copy-light hero.',
    props: { origin: [0.5, 0.5] as [number, number], scale: 0.6 },
  },
]

/**
 * Internal comparison route: the real hero on top, then the same field under different
 * tunings. Not linked from anywhere and marked noindex.
 */
export default function HeroLabPage() {
  return (
    <main className="flex-1">
      <ThemeBand theme="dark" as="div">
        <Hero />
      </ThemeBand>

      <div className="relative z-10 bg-bg">
        <div className="container-content py-16">
          <h2 className="text-lg font-medium tracking-tight">Field tunings</h2>
          <p className="mt-2 max-w-[44rem] text-sm text-fg-muted">
            Same component, different <code className="font-mono text-xs">LiquidMarkOptions</code>.
            Move the pointer across each band.
          </p>
        </div>

        <div className="flex flex-col">
          {VARIANTS.map((v) => (
            <ThemeBand key={v.label} theme="dark" as="div" className="border-t border-border">
              <div className="relative isolate h-[22rem] overflow-hidden">
                <LiquidMark className="absolute inset-0 -z-10" {...v.props} />
                <div className="container-content flex h-full flex-col justify-end py-8">
                  <p className="font-mono text-xs uppercase tracking-[0.14em] text-fg-subtle">
                    {v.label}
                  </p>
                  <p className="mt-1 max-w-[32rem] text-sm text-fg-muted">{v.note}</p>
                </div>
              </div>
            </ThemeBand>
          ))}
        </div>
      </div>
    </main>
  )
}
