import { PAYLOAD_URL, SOLUTIONS_URL, brands } from '@payload-solutions/brand'
import { ActionRow, IndependenceNote, ProseLink } from '@payload-solutions/brand/lattice'
import { ClockDial } from '@payload-solutions/brand/clock-dial'
import { Parallax } from '@payload-solutions/brand/parallax'
import { ShimmerNote } from '@/components/text-shimmer'

const brand = brands.clock

/**
 * The headline names the absence, not the category. "Scheduled job triggering for serverless
 * Payload deployments" is what this is; "the clock your app doesn't have" is why anyone
 * clicks. The category is carried by the lead, the title tag and brands.clock.tagline, so the
 * h1 is free to do the other job.
 *
 * Everything you can do sits under it as rows of the lattice rather than as a cluster of
 * buttons, exactly as on payloadstack.com. The dial takes the other two columns.
 */
export function Hero() {
  return (
    <section className="relative" aria-labelledby="hero-heading">
      <div className="container-content col-grid relative min-h-[calc(100dvh-var(--header-height))] items-center gap-y-14 py-20 lg:py-24">
        <div className="lg:col-span-2">
          <ShimmerNote href={SOLUTIONS_URL} className="mb-8">
            From the makers of Payload Stack
          </ShimmerNote>

          <h1 id="hero-heading" className="display-xl max-w-[16ch]">
            The clock your serverless <ProseLink href={PAYLOAD_URL}>Payload</ProseLink> app doesn’t
            have.
          </h1>
          <p className="lead mt-7 max-w-[31rem]">
            Nothing runs between requests on serverless, so queued jobs wait. Payload Clock calls
            your job queue on schedule, drains the backlog in one pass, keeps a history worth
            reading, and tells you the moment it stops.
          </p>

          <div className="mt-11 border-t border-border">
            <ActionRow href={`${SOLUTIONS_URL}/#contact`} meta="in development">
              Get early access
            </ActionRow>
            <ActionRow href="/#how" meta="1 min">
              How it works
            </ActionRow>
            <ActionRow href={brand.docsUrl}>Documentation</ActionRow>
          </div>

          <IndependenceNote className="mt-8" />
        </div>

        <Parallax speed={-0.08} className="min-w-0 lg:col-span-2 lg:pl-10">
          <ClockDial className="mx-auto w-full max-w-[20rem] sm:max-w-[26rem] md:max-w-[34rem] lg:max-w-none" />
        </Parallax>
      </div>
    </section>
  )
}
