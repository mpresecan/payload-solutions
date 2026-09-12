import { SectionHead } from '@payload-solutions/brand/lattice'
import { PingBeams } from '@/components/ping-beams'
import { Reveal } from '@/components/reveal'

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: 'Point Clock at your deployment',
    body: 'A URL and a secret. Clock proves you own the endpoint before it ever calls it — one click if you install the plugin, a DNS record if you would rather not.',
  },
  {
    title: 'Pick a cadence',
    body: 'Every five minutes by default. An interval from one minute to a day, or a cron expression with a time zone. One monitor per project is the whole setup for almost everyone: Payload’s own scheduler decides which jobs are due, Clock only has to knock.',
  },
  {
    title: 'Clock calls, and keeps calling until the queue is empty',
    body: 'Payload answers every call with how much work is left. When there is more, Clock goes straight round again rather than waiting for the next minute — so a four hundred job backlog clears in one pass instead of over an afternoon.',
  },
  {
    title: 'You get told when it breaks',
    body: 'Three failures in a row and you get an email naming the status code. Twenty and the monitor pauses itself, because at that point the deployment is gone and pinging it is noise.',
  },
]

export function How() {
  return (
    <section
      id="how"
      className="scroll-mt-header hairline-t py-section"
      aria-labelledby="how-heading"
    >
      <div className="container-content col-grid gap-y-14">
        <div className="lg:col-span-2 lg:pr-12">
          <Reveal>
            <SectionHead id="how-heading" eyebrow="How it works" title="One tick. One batch. Every project." />
          </Reveal>
          <ol className="mt-10 space-y-6">
            {STEPS.map((step, i) => (
              <Reveal
                as="li"
                key={step.title}
                index={i}
                className="border-t border-border pt-6 first:border-t-0 first:pt-0"
              >
                <h3 className="display-sm">{step.title}</h3>
                <p className="mt-1.5 max-w-[46ch] text-pretty text-[0.9375rem] leading-relaxed text-fg-muted">
                  {step.body}
                </p>
              </Reveal>
            ))}
          </ol>
        </div>

        <Reveal className="min-w-0 lg:col-span-2 lg:pt-6">
          <PingBeams className="mx-auto max-w-[22rem] lg:max-w-[27rem]" />
          <p className="mt-8 max-w-[38ch] text-pretty text-[0.8125rem] leading-relaxed text-fg-subtle">
            The minute&#8217;s work leaves as one batch rather than as one request per project.
            That is the whole reason this can be free: the bill is per batch, and a batch costs
            the same carrying fifty projects as carrying one.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
