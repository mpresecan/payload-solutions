import { brands } from '@payload-solutions/brand'
import { Reveal } from '@/components/reveal'

export function Statement() {
  return (
    <section className="hairline-t relative" aria-label="About Payload Solutions">
      <div className="container-content py-section">
        <Reveal className="mx-auto max-w-3xl">
          <p className="text-balance text-2xl font-medium leading-snug tracking-tight sm:text-3xl">
            Payload gave us the best backend we have ever shipped on. We give back: every product
            here is MIT licensed, developed in one public monorepo and documented on this site, by a
            team that builds client SaaS on Payload every week.
          </p>
          <p className="mt-6 text-fg-muted">
            <a
              href={brands.solutions.github}
              target="_blank"
              rel="noreferrer noopener"
              className="text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
            >
              Read the source on GitHub
            </a>
          </p>
        </Reveal>
      </div>
    </section>
  )
}
