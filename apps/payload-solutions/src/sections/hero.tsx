import { LiquidMark } from '@payload-solutions/brand/liquid-mark'
import { Button } from '@/components/ui/button'

/**
 * The umbrella hero. No product visual on purpose: payload.solutions has a portfolio, not one
 * product, and the products sit directly underneath. The mark itself is the subject — an ink
 * field that the pointer tears apart and that reassembles into the silhouette.
 *
 * The IsoStack illustration stays with Payload Stack, whose identity it actually is.
 */
export function Hero() {
  return (
    <section className="relative isolate overflow-hidden" aria-labelledby="hero-heading">
      <LiquidMark className="absolute inset-0 -z-10">
        {/* Visible whenever WebGL2 is unavailable; the canvas paints over it otherwise. */}
        <div className="absolute inset-0 grid place-items-center lg:justify-items-end lg:pr-[18%]">
          <svg
            viewBox="0 0 20 26"
            className="h-[min(52vh,22rem)] w-auto text-fg"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M10.5 3.49976L0.713097 8.15257V20.4896L8.2737 25.1999V12.8629L18 7.99976L10.5 3.49976Z" />
            <path d="M11 23.5V15L18 19.5L11 23.5Z" />
          </svg>
        </div>
      </LiquidMark>

      {/* Scrim: keeps the copy at AA over the ink without dimming the mark. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 lg:hidden"
        style={{
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--bg) 90%, transparent) 0%, color-mix(in srgb, var(--bg) 72%, transparent) 42%, transparent 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 hidden lg:block"
        style={{
          background:
            'linear-gradient(100deg, color-mix(in srgb, var(--bg) 94%, transparent) 0%, color-mix(in srgb, var(--bg) 86%, transparent) 26%, color-mix(in srgb, var(--bg) 35%, transparent) 52%, transparent 72%)',
        }}
      />

      <div className="container-content relative flex min-h-[calc(100dvh-var(--header-height))] max-h-[54rem] flex-col justify-center py-16 lg:py-24">
        <p className="mb-6 flex items-center gap-3 font-mono text-xs font-medium uppercase tracking-[0.14em] text-fg-subtle">
          <span aria-hidden="true" className="h-px w-7 bg-border-strong" />
          Open source · MIT
        </p>
        <h1
          id="hero-heading"
          className="max-w-[20ch] text-balance text-[2.75rem] font-medium leading-[1.02] tracking-display sm:text-5xl lg:text-[3.5rem] xl:text-6xl"
        >
          Everything you need to ship SaaS on{' '}
          <a
            href="https://payloadcms.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-border-strong decoration-1 underline-offset-[0.15em] transition-colors hover:text-accent hover:decoration-accent"
          >
            Payload CMS
          </a>
          .
        </h1>
        <p className="mt-6 max-w-[34rem] text-pretty text-lg leading-relaxed text-fg-muted">
          Open-source boilerplate, plugins and the engineering team behind them. Built in the open,
          used in production, MIT licensed.
        </p>
        <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button href="/#contact" size="lg">
            Start a project
          </Button>
          <Button href="/docs" variant="secondary" size="lg" className="shrink-0" arrow>
            Explore the stack
          </Button>
        </div>
      </div>
    </section>
  )
}
