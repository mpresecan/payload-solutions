import { SectionHead } from '@payload-solutions/brand/lattice'
import { Globe } from '@/components/globe'
import { Reveal } from '@/components/reveal'

/*
  The old site's globe, kept — and given something to say. It was captioned "Powering Actions
  all over the world" under a product that had not shipped, which is a claim rather than an
  illustration. The claim here is about latency and regions, which is true on day one: the
  clock is in one place and your deployments are not, and for a job-queue ping that is fine.
*/
export function Everywhere() {
  return (
    <section className="hairline-t py-section" aria-labelledby="everywhere-heading">
      <div className="container-content col-grid items-center gap-y-12">
        <Reveal className="lg:col-span-2 lg:pr-12">
          <SectionHead
            id="everywhere-heading"
            eyebrow="Wherever you deploy"
            title="One clock, every region."
            lead="Payload Clock runs in one place and calls yours wherever it is — iad1, fra1, syd1, a container in your own cloud. A job-queue ping is not latency-sensitive: what matters is that it arrives, that it is retried when it doesn’t, and that you hear about it either way."
          />
        </Reveal>

        <Reveal className="min-w-0 lg:col-span-2">
          <div className="edge-fade mx-auto w-full max-w-[22rem] lg:max-w-[26rem]">
            <Globe />
          </div>
        </Reveal>
      </div>
    </section>
  )
}
