import { SectionHead } from '@payload-solutions/brand/lattice'
import { CliTranscript } from '@/components/cli-transcript'
import { Reveal } from '@/components/reveal'

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: 'Run the command',
    body: 'No global install. The CLI downloads the template and pins every Payload package to the same version.',
  },
  {
    title: 'Pick a database',
    body: 'PostgreSQL, MongoDB, SQLite or Vercel Postgres. The adapter and connection string are written into your config.',
  },
  {
    title: 'Choose sign-in methods, teams and billing',
    body: 'Turn organizations and Stripe on or off. Every screen, plugin and collection follows the flags in stack.config.ts.',
  },
  {
    title: 'Pick where uploads live',
    body: 'Skip for local disk, or Vercel Blob, S3, Cloudflare R2, Azure, Google Cloud Storage or Uploadthing, wired into payload.config.ts and switched on by environment variables.',
  },
  {
    title: 'Sign in at /admin',
    body: 'The first visit creates your admin account. From there, everything is a normal Payload project.',
  },
]


export function OneCommand() {
  return (
    <section
      id="how"
      className="scroll-mt-header hairline-t py-section"
      aria-labelledby="how-heading"
    >
      <div className="container-content col-grid gap-y-12">
        <div className="lg:col-span-2 lg:pr-12">
          <Reveal>
            <SectionHead
              id="how-heading"
              eyebrow="One command"
              title="From zero to a running product in seven prompts."
            />
          </Reveal>
          <ol className="mt-10 space-y-6">
            {STEPS.map((step, i) => (
              <Reveal
                as="li"
                key={step.title}
                index={i}
                className="border-t border-border pt-6 first:border-t-0 first:pt-0"
              >
                <div>
                  <h3 className="display-sm">{step.title}</h3>
                  <p className="mt-1.5 max-w-[46ch] text-pretty text-[0.9375rem] leading-relaxed text-fg-muted">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>

        <Reveal className="min-w-0 lg:col-span-2">
          <CliTranscript className="lg:p-8" />
        </Reveal>
      </div>
    </section>
  )
}
