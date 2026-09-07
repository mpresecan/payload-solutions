import { SOLUTIONS_URL, brands } from '@payload-solutions/brand'
import { ActionRow, SectionHead } from '@payload-solutions/brand/lattice'
import { CopyCommand } from '@/components/copy-command'
import { Reveal } from '@/components/reveal'

const brand = brands.stack

/**
 * The closing section. It used to be a filled panel floating inside the page; on true black
 * a panel reads as a box pasted on top, so this is now part of the lattice: headline on the
 * left, the things you can do as rows on the right.
 */
export function OpenSource() {
  return (
    <section className="hairline-t py-section" aria-labelledby="oss-heading">
      <div className="container-content grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-10">
        <Reveal className="lg:col-span-6">
          <SectionHead
            id="oss-heading"
            eyebrow="MIT"
            title="Open source, built in the open."
            lead="Payload Stack is a payload.solutions project. Follow the roadmap, open an issue, or hire the team behind it to build on your stack."
          />
        </Reveal>

        <Reveal className="min-w-0 lg:col-span-6 lg:pt-2">
          <div className="border-t border-border">
            <CopyCommand variant="row" />
            <ActionRow href={brand.github}>GitHub repository</ActionRow>
            <ActionRow href={brand.docsUrl}>Documentation</ActionRow>
            <ActionRow href={`${SOLUTIONS_URL}/#contact`}>Hire the team</ActionRow>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
