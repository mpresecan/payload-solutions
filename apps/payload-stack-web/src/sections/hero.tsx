import { brands } from '@payload-solutions/brand'
import { Parallax } from '@payload-solutions/brand/parallax'
import { CopyCommand } from '@/components/copy-command'
import { StackVisual } from '@/components/stack-visual'
import { Button } from '@/components/ui/button'

const brand = brands.stack

export function Hero() {
  return (
    <section className="relative" aria-labelledby="hero-heading">
      <div className="container-content relative grid min-h-[calc(100dvh-var(--header-height))] grid-cols-1 items-center gap-12 py-16 lg:grid-cols-12 lg:gap-8 lg:py-20">
        <div className="lg:col-span-6">
          <h1
            id="hero-heading"
            className="text-balance text-[2.75rem] font-medium leading-[1.02] tracking-display sm:text-5xl lg:text-[3.5rem] xl:text-6xl"
          >
            The SaaS boilerplate for Payload CMS.
          </h1>
          <p className="mt-6 max-w-[34rem] text-pretty text-lg leading-relaxed text-fg-muted">
            Better Auth, organizations, Stripe subscriptions and a shadcn dashboard, wired into
            Payload and Next.js. Open source, one command.
          </p>
          <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <CopyCommand size="lg" />
            <Button href={brand.docsUrl} variant="secondary" size="lg" className="shrink-0" arrow>
              Documentation
            </Button>
          </div>
        </div>

        <Parallax speed={-0.08} className="min-w-0 lg:col-span-6 lg:pl-4">
          <StackVisual className="mx-auto w-full max-w-[40rem] lg:max-w-none" />
        </Parallax>
      </div>
    </section>
  )
}
