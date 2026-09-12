import { SectionHead } from '@payload-solutions/brand/lattice'
import { Reveal } from '@/components/reveal'

/*
  The gap, stated as facts rather than as fear. Every line here is checkable, which is the
  point: a developer who has hit this already knows all four and needs to see that we do too;
  one who has not is about to.
*/
const FACTS: Array<{ title: string; body: string }> = [
  {
    title: 'Nothing runs between requests.',
    body: 'Payload’s autoRun needs a process that stays alive. On Vercel, Netlify, Cloudflare and every other serverless target there isn’t one, so queued tasks and scheduled workflows sit untouched until somebody happens to load a page.',
  },
  {
    title: 'Platform cron is rationed.',
    body: 'Vercel’s Hobby plan allows two cron jobs at a daily minimum. That is a nightly batch, not a job queue — and it is the wall most Payload projects hit first.',
  },
  {
    title: 'One call is not a drain.',
    body: 'A single request to the run endpoint processes up to its limit and returns. If four hundred jobs arrive at once, a plain cron leaves most of them for tomorrow and the backlog never clears.',
  },
  {
    title: 'A cron that stops is silent.',
    body: 'Nothing tells you the schedule stopped firing. You find out when a customer asks why their email never arrived, which is the worst possible monitoring system.',
  },
]

export function Problem() {
  return (
    <section
      id="problem"
      className="scroll-mt-header hairline-t py-section"
      aria-labelledby="problem-heading"
    >
      <div className="container-content">
        <Reveal>
          <SectionHead
            id="problem-heading"
            eyebrow="The gap"
            title="Payload has a job queue. Serverless has no hand to turn it."
            lead="The queue, the tasks, the workflows and the schedules are all already there and all work exactly as documented. The one missing piece is something outside the deployment that calls it."
          />
        </Reveal>

        <dl className="list-grid mt-16 grid-cols-1 sm:grid-cols-2">
          {FACTS.map((f, i) => (
            <Reveal key={f.title} index={i} className="list-cell">
              <dt className="display-sm">{f.title}</dt>
              <dd className="mt-4 max-w-[48ch] text-pretty text-[0.9375rem] leading-relaxed text-fg-muted">
                {f.body}
              </dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  )
}
