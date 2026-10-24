import { PAYLOAD_URL } from '@payload-solutions/brand'
import { ActionRow, Eyebrow, IndependenceNote, ProseLink } from '@payload-solutions/brand/lattice'
import { ConfigHero } from '@/components/config-hero'

/**
 * The umbrella hero. The visual is the product, not the mark: a payload.config.ts writes
 * itself, and each plugin line that lands flies its feature into place around the editor
 * (ConfigHero). Every SaaS feature is one line of config away, shown rather than claimed.
 *
 * It replaced PackageField (a floor of lid-and-base marks), which looked good but said
 * nothing about what payload.solutions does. PackageField and LiquidMark stay in the brand
 * package, unused here.
 */
export function Hero() {
  return (
    <section className="relative isolate overflow-hidden" aria-labelledby="hero-heading">
      <div className="container-content relative flex flex-col justify-center py-14 sm:py-16 lg:min-h-[calc(100dvh-var(--header-height))] lg:max-h-[54rem] lg:py-24">
        <Eyebrow className="mb-7">Open source · MIT</Eyebrow>
        <h1 id="hero-heading" className="display-xl max-w-[18ch]">
          The SaaS layer for <ProseLink href={PAYLOAD_URL}>Payload CMS</ProseLink>.
        </h1>
        <p className="lead mt-7 max-w-[30rem]">
          Boilerplate, plugins and the engineers who build them. Built in the open, used in
          production.
        </p>
        {/* The things you can do here, as rows of the lattice rather than a button cluster.
            Two of the four columns wide, so they close on the centre grid line. */}
        <div className="col-grid mt-11">
          <div className="border-t border-border lg:col-span-2">
            <ActionRow href="/#products">See the products</ActionRow>
            <ActionRow href="/docs">Read the documentation</ActionRow>
            <ActionRow href="/#contact">Start a project with us</ActionRow>
          </div>
        </div>
        <IndependenceNote className="mt-8" />
      </div>

      {/*
        From lg the visual owns the right of the hero, from just past the centre grid line to
        the viewport edge, and never sits behind the action rows, so no scrim is needed. It is
        positioned against a container-content frame so it lines up with the lattice at every
        width. Below lg it gets a band of its own beneath the copy (DOM order is phone order).
      */}
      <div className="pointer-events-none lg:absolute lg:inset-0">
        <div className="container-content relative h-full">
          <ConfigHero className="pointer-events-auto mx-auto aspect-square w-full max-w-[36rem] lg:absolute lg:inset-y-0 lg:left-[53%] lg:right-0 lg:aspect-auto lg:w-auto lg:max-w-none" />
        </div>
      </div>
    </section>
  )
}
