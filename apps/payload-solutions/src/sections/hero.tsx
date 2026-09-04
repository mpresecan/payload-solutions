import { Button } from '@/components/ui/button'
import { FamilyVisual } from '@/components/family-visual'

export function Hero() {
  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-heading">
      <div className="container-content grid min-h-[calc(100dvh-var(--header-height))] grid-cols-1 items-center gap-12 py-16 lg:grid-cols-12 lg:gap-8 lg:py-20">
        <div className="lg:col-span-6">
          <h1
            id="hero-heading"
            className="text-balance text-[2.75rem] font-medium leading-[1.02] tracking-display sm:text-5xl lg:text-[3.5rem] xl:text-6xl"
          >
            We build what the Payload community was missing.
          </h1>
          <p className="mt-6 max-w-[34rem] text-pretty text-lg leading-relaxed text-fg-muted">
            Open-source products, plugins and engineering for teams shipping SaaS on Payload CMS.
            Built in the open, MIT licensed.
          </p>
          <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button href="/#contact" size="lg">
              Start a project
            </Button>
            <Button href="/docs" variant="secondary" size="lg" className="shrink-0" arrow>
              Documentation
            </Button>
          </div>
        </div>
        <div className="min-w-0 lg:col-span-6 lg:pl-4">
          <FamilyVisual className="mx-auto w-full max-w-[40rem] lg:max-w-none" />
        </div>
      </div>
    </section>
  )
}
