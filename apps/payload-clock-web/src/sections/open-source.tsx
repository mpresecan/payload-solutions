import { SOLUTIONS_URL, brands } from '@payload-solutions/brand'
import { ActionRow, SectionHead } from '@payload-solutions/brand/lattice'
import { Reveal } from '@/components/reveal'

const brand = brands.clock

export function OpenSource() {
  return (
    <section className="hairline-t py-section" aria-labelledby="oss-heading">
      <div className="container-content col-grid gap-y-14">
        <Reveal className="lg:col-span-2 lg:pr-12">
          <SectionHead
            id="oss-heading"
            eyebrow="MIT"
            title="Open source, built in the open."
            lead="Payload Clock is a payload.solutions project, and so is everything it is built on: the Stack boilerplate underneath it, the Action Scheduler beside it, the plugin that connects it. Follow the roadmap, open an issue, or hire the team behind it."
          />
        </Reveal>

        <Reveal className="min-w-0 lg:col-span-2 lg:pt-2">
          <div className="border-t border-border">
            <ActionRow href={`${SOLUTIONS_URL}/#contact`} meta="in development">
              Get early access
            </ActionRow>
            <ActionRow href={brand.github}>GitHub repository</ActionRow>
            <ActionRow href={brand.docsUrl}>Documentation</ActionRow>
            <ActionRow href={brands.stack.url}>Payload Stack</ActionRow>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
