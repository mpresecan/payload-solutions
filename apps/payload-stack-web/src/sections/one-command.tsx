import { Reveal } from '@/components/reveal'

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: 'Run the command',
    body: 'No global install. The CLI downloads the template and pins every Payload package to the same version.',
  },
  {
    title: 'Pick a database',
    body: 'PostgreSQL, MongoDB, SQLite, Vercel Postgres or Cloudflare D1. The adapter and connection string are written into your config.',
  },
  {
    title: 'Choose sign-in methods, teams and billing',
    body: 'Turn organizations and Stripe on or off. What you turn off is not left in the code as dead weight.',
  },
  {
    title: 'Sign in at /admin',
    body: 'The first visit creates your admin account. From there, everything is a normal Payload project.',
  },
]

/* This transcript mirrors the real create-payload-stack prompt flow. Keep them in sync. */
const TRANSCRIPT = [
  { t: 'cmd', v: '$ npx create-payload-stack@latest' },
  { t: 'blank' },
  { t: 'ui', v: '┌  create-payload-stack' },
  { t: 'ui', v: '│' },
  { t: 'q', k: '◇  Project name', v: '│  ridgeline' },
  { t: 'ui', v: '│' },
  { t: 'q', k: '◇  Database', v: '│  PostgreSQL' },
  { t: 'ui', v: '│' },
  { t: 'q', k: '◇  Connection string', v: '│  postgres://postgres:<password>@127.0.0.1:5432/ridgeline' },
  { t: 'ui', v: '│' },
  { t: 'q', k: '◇  Sign-in methods', v: '│  Email + password, Magic link, Passkeys' },
  { t: 'ui', v: '│' },
  { t: 'q', k: '◇  Organizations (teams)', v: '│  Yes' },
  { t: 'ui', v: '│' },
  { t: 'q', k: '◇  Billing', v: '│  Stripe subscriptions, per organization' },
  { t: 'ui', v: '│' },
  { t: 'q', k: '◇  Installed dependencies with pnpm', v: null },
  { t: 'ui', v: '│' },
  { t: 'ui', v: '└  Done. Next steps:' },
  { t: 'blank' },
  { t: 'next', v: '   cd ridgeline' },
  { t: 'next', v: '   pnpm dev' },
  { t: 'next', v: '   open http://localhost:3000/admin' },
] as const

export function OneCommand() {
  return (
    <section id="how" className="scroll-mt-header hairline-t py-section" aria-labelledby="how-heading">
      <div className="container-content grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5">
          <Reveal>
            <h2 id="how-heading" className="text-balance text-3xl font-medium leading-[1.05] tracking-display sm:text-4xl lg:text-5xl">
              From zero to a running product in six prompts.
            </h2>
          </Reveal>
          <ol className="mt-10 space-y-6">
            {STEPS.map((step, i) => (
              <Reveal as="li" key={step.title} index={i} className="border-t border-border pt-6 first:border-t-0 first:pt-0">
                <div>
                  <h3 className="text-lg font-medium leading-snug tracking-tight">{step.title}</h3>
                  <p className="mt-1.5 max-w-[46ch] text-pretty text-[0.9375rem] leading-relaxed text-fg-muted">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>

        <Reveal className="min-w-0 lg:col-span-7">
          <pre className="code-block border border-border bg-surface p-6 lg:p-8" aria-label="Terminal transcript of create-payload-stack">
            <code>
              {TRANSCRIPT.map((line, i) => {
                if (line.t === 'blank') return <span key={i}>{'\n'}</span>
                if (line.t === 'cmd')
                  return (
                    <span key={i}>
                      <span className="tok-c">$ </span>
                      <span className="tok-s">{line.v.slice(2)}</span>
                      {'\n'}
                    </span>
                  )
                if (line.t === 'q')
                  return (
                    <span key={i}>
                      <span className="tok-p">{line.k}</span>
                      {'\n'}
                      {line.v ? (
                        <>
                          <span className="tok-c">{line.v.slice(0, 3)}</span>
                          <span className="tok-k">{line.v.slice(3)}</span>
                          {'\n'}
                        </>
                      ) : null}
                    </span>
                  )
                if (line.t === 'next')
                  return (
                    <span key={i}>
                      <span className="tok-s">{line.v}</span>
                      {'\n'}
                    </span>
                  )
                return (
                  <span key={i} className="tok-c">
                    {line.v}
                    {'\n'}
                  </span>
                )
              })}
            </code>
          </pre>
        </Reveal>
      </div>
    </section>
  )
}
