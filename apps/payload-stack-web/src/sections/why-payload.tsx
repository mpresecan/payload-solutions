import { ActionRow, SectionHead } from '@payload-solutions/brand/lattice'
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
    <section
      id="why"
      className="scroll-mt-header hairline-t py-section"
      aria-labelledby="why-heading"
    >
      <div className="container-content">
        <Reveal>
          <SectionHead
            id="why-heading"
            eyebrow="The backbone"
            title="Why Payload CMS is the right backbone for a SaaS."
            lead="Most starters give you auth and a pricing page and leave the actual product to you. Payload gives you the product layer as well."
          />
        </Reveal>

        <dl className="cell-grid mt-16 grid-cols-1 sm:grid-cols-2">
          {POINTS.map((p, i) => (
            <Reveal key={p.title} index={i} className="cell-p bg-bg">
              <dt className="display-sm">{p.title}</dt>
              <dd className="mt-4 max-w-[48ch] text-pretty text-[0.9375rem] leading-relaxed text-fg-muted">
                {p.body}
              </dd>
            </Reveal>
          ))}
        </dl>

        <div className="mt-16 max-w-[38rem] border-t border-border">
          <ActionRow href="/when-to-choose" meta="2 min read">
            When to choose Payload Stack, and when not to
          </ActionRow>
        </div>
      </div>
    </section>
  )
}
