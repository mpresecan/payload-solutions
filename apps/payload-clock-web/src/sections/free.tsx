import { SectionHead } from '@payload-solutions/brand/lattice'
import { Reveal } from '@/components/reveal'

/*
  Not a pricing table. The old site had four demo tiers inherited from the template, priced
  from $10 to $80 for a product that is free — the single most misleading thing on the page.
  This says what the free plan is and, more usefully, why it can exist, because "free forever"
  from a one-person studio is a claim that has to be shown its working.
*/
const LIMITS: Array<{ label: string; value: string }> = [
  { label: 'Projects', value: '5' },
  { label: 'Monitors', value: '10' },
  { label: 'Shortest interval', value: '1 minute' },
  { label: 'Run history', value: '7 days, 30 on failure' },
  { label: 'Failure alerts', value: 'email and webhook' },
  { label: 'Price', value: 'none' },
]

export function Free() {
  return (
    <section
      id="free"
      className="scroll-mt-header hairline-t py-section"
      aria-labelledby="free-heading"
    >
      <div className="container-content col-grid gap-y-14">
        <Reveal className="lg:col-span-2 lg:pr-12">
          <SectionHead
            id="free-heading"
            eyebrow="Free"
            title="Free, and here is the arithmetic."
            lead="A free tier nobody can afford gets withdrawn, so it is worth showing the working. Payload Clock sends one batch a minute for every customer at once, and the metered service behind it bills per batch, not per ping. A million operations a month are free; a minute of batches costs two. That leaves room for thousands of monitors inside a free allowance — and past it, a million more operations costs forty cents."
          />
        </Reveal>

        <Reveal className="min-w-0 lg:col-span-2 lg:pt-2">
          <dl className="list-grid grid-cols-1">
            {LIMITS.map((l) => (
              <div
                key={l.label}
                className="list-cell flex items-baseline justify-between gap-6 py-5"
              >
                <dt className="text-[0.9375rem] text-fg-muted">{l.label}</dt>
                <dd className="text-right font-mono text-[0.9375rem] text-fg">{l.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 max-w-[46ch] text-pretty text-[0.8125rem] leading-relaxed text-fg-subtle">
            Limits for the free plan at launch, and they may move before it opens. A paid plan,
            if one arrives, will buy longer retention and more projects — never the right to be
            called on time.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
