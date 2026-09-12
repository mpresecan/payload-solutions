import { SectionHead } from '@payload-solutions/brand/lattice'
import { Reveal } from '@/components/reveal'
import { RunLedger } from '@/components/run-ledger'

const POINTS: Array<{ title: string; body: string }> = [
  {
    title: 'It drains, it doesn’t just knock.',
    body: 'Payload returns how many jobs are left. Clock reads that and calls again in the same pass, up to five times, stopping the moment the queue is clear or the backlog stops shrinking.',
  },
  {
    title: 'History you can actually read.',
    body: 'Eleven thousand identical “nothing to do” runs collapse into one row with a count and a duration range. Failures never collapse. What is left on screen is only the part that changed.',
  },
  {
    title: 'Signed requests, no shared secret on the wire.',
    body: 'With the plugin installed, Clock sends a timestamped HMAC instead of a bearer token. Your secret never leaves your deployment, and a captured request is worthless five minutes later.',
  },
  {
    title: 'It knows when to stop.',
    body: 'Three consecutive failures send an email; twenty pause the monitor. Abandoned deployments cost you nothing and cost us nothing, which is the same sentence.',
  },
  {
    title: 'Per-queue when you need it.',
    body: 'Give a heavy queue its own cadence and its own job limit, and let one monitor carry Payload’s schedule handling for the rest.',
  },
  {
    title: 'Nothing of yours is stored.',
    body: 'Clock calls one URL and records a status code, a duration and an error string capped at two hundred characters. It never sees a job payload, and there is nowhere for one to land.',
  },
]

export function Inside() {
  return (
    <section
      id="inside"
      className="scroll-mt-header hairline-t py-section"
      aria-labelledby="inside-heading"
    >
      <div className="container-content">
        <Reveal>
          <SectionHead
            id="inside-heading"
            eyebrow="What you get"
            title="A trigger is easy. The six things around it are the product."
            lead="Anything can send an HTTP request on a timer. What makes a job queue trustworthy is what happens on the calls that go wrong, and on the ten thousand that go right and say nothing."
          />
        </Reveal>

        <dl className="list-grid mt-16 grid-cols-1 sm:grid-cols-2">
          {POINTS.map((p, i) => (
            <Reveal key={p.title} index={i} className="list-cell">
              <dt className="display-sm">{p.title}</dt>
              <dd className="mt-4 max-w-[44ch] text-pretty text-[0.9375rem] leading-relaxed text-fg-muted">
                {p.body}
              </dd>
            </Reveal>
          ))}
        </dl>

        <Reveal className="mt-16">
          <RunLedger />
          <p className="mt-5 max-w-[62ch] text-pretty text-[0.8125rem] leading-relaxed text-fg-subtle">
            One monitor, one week. The middle row is eleven thousand runs in which nothing
            happened, folded into a single line — and the two rows above it are the ninety
            seconds that mattered.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
