import { Reveal } from '@/components/reveal'

const POINTS: Array<{ title: string; body: string }> = [
  {
    title: 'Your data model is code.',
    body: 'Collections, access control and hooks are TypeScript in your repo, versioned with the app and typed end to end. No dashboard-defined schema to drift.',
  },
  {
    title: 'The admin is already built.',
    body: 'Every collection gets a production admin with roles, versions, search and media. Your back office costs zero sprints, now and after launch.',
  },
  {
    title: 'It runs inside Next.js.',
    body: 'One deployment, one codebase. Server components call Payload’s local API directly, without an HTTP hop or a second service to keep up.',
  },
  {
    title: 'The database is your call.',
    body: 'PostgreSQL, MongoDB, SQLite or Vercel Postgres, chosen at scaffold time. Payload’s adapters handle schema and migrations.',
  },
]

export function WhyPayload() {
  return (
    <section id="why" className="scroll-mt-header hairline-t py-section" aria-labelledby="why-heading">
      <div className="container-content">
        <Reveal className="max-w-2xl">
          <h2 id="why-heading" className="text-balance text-3xl font-medium leading-[1.05] tracking-display sm:text-4xl lg:text-5xl">
            Why Payload CMS is the right backbone for a SaaS.
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-fg-muted">
            Most starters give you auth and a pricing page and leave the actual product to you.
            Payload gives you the product layer as well.
          </p>
        </Reveal>

        <dl className="mt-14 grid grid-cols-1 gap-x-12 gap-y-12 sm:grid-cols-2">
          {POINTS.map((p, i) => (
            <Reveal key={p.title} index={i} className="border-t border-border pt-6">
              <dt className="text-xl font-medium leading-snug tracking-tight">{p.title}</dt>
              <dd className="mt-3 max-w-[48ch] text-pretty text-[0.9375rem] leading-relaxed text-fg-muted">
                {p.body}
              </dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  )
}
