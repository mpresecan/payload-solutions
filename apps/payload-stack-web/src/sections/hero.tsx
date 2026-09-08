import { PAYLOAD_URL, brands } from '@payload-solutions/brand'
import { ActionRow, IndependenceNote, ProseLink } from '@payload-solutions/brand/lattice'
import { Parallax } from '@payload-solutions/brand/parallax'
import { CopyCommand } from '@/components/copy-command'
import { StackVisual } from '@/components/stack-visual'

const brand = brands.stack

/**
 * The hero. The headline states the transformation rather than the category — the category
 * itself ("SaaS boilerplate") is carried by the lead, the title tag and brands.stack.tagline,
 * so the page answers "what is this?" without spending the h1 on it.
 * The headline is the only large thing on the page; everything you can do with it
 * is a row of the lattice under the headline rather than a cluster of buttons, which is what
 * gives payloadcms.com its document-like calm. The stack illustration keeps the right half
 * and now stands on true black — the isometric floor that used to sit behind it competed
 * with the isometry of the drawing itself.
 */
export function Hero() {
  return (
    <section className="relative" aria-labelledby="hero-heading">
      <div className="container-content col-grid relative min-h-[calc(100dvh-var(--header-height))] items-center gap-y-14 py-20 lg:py-24">
        {/* Two of the four columns. The copy is held back by its own measure; the action rows
            fill the cell, so they start on the left grid line and end on the centre one. */}
        <div className="lg:col-span-2">
          <h1 id="hero-heading" className="display-xl max-w-[15ch]">
            Turn <ProseLink href={PAYLOAD_URL}>Payload CMS</ProseLink> into a SaaS.
          </h1>
          <p className="lead mt-7 max-w-[30rem]">
            An open-source SaaS boilerplate: Better Auth, organizations, Stripe subscriptions and a
            shadcn dashboard, wired into Payload and Next.js. One command.
          </p>

          <div className="mt-11 border-t border-border">
            <CopyCommand variant="row" />
            <ActionRow href={brand.docsUrl}>Documentation</ActionRow>
            <ActionRow href="/when-to-choose" meta="2 min read">
              When to choose Payload Stack
            </ActionRow>
          </div>

          <IndependenceNote className="mt-8" />
        </div>

        <Parallax speed={-0.08} className="min-w-0 lg:col-span-2 lg:pl-10">
          <StackVisual className="mx-auto w-full max-w-[20rem] sm:max-w-[26rem] md:max-w-[40rem] lg:max-w-none" />
        </Parallax>
      </div>
    </section>
  )
}
