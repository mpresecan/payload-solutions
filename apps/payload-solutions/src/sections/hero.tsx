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
        {/*
          The payloadcms.com convention: from lg everything you read or press lives in the first
          of the four lattice columns, and the visual takes the other three. The headline steps
          down a size there so it sets in one column on four lines instead of spilling.
        */}
        <div className="lg:w-1/4">
          <Eyebrow className="mb-7">Open source · MIT</Eyebrow>
          <h1
            id="hero-heading"
            className="display-xl max-w-[18ch] lg:max-w-none lg:text-[length:clamp(2.25rem,3.6vw,3.75rem)]"
          >
            The SaaS layer for <ProseLink href={PAYLOAD_URL}>Payload CMS</ProseLink>.
          </h1>
          <p className="lead mt-7 max-w-[30rem]">
            Boilerplate, plugins and the engineers who build them. Built in the open, used in
            production.
          </p>
          {/* Rows of the lattice rather than a button cluster, one column wide from lg so they
              close on the first grid line. */}
          <div className="mt-11 border-t border-border">
            <ActionRow href="/#products">See the products</ActionRow>
            <ActionRow href="/docs">Read the documentation</ActionRow>
            <ActionRow href="/#contact">Start a project with us</ActionRow>
          </div>
          <IndependenceNote className="mt-8" />
        </div>
      </div>

      {/*
        Desktop (lg+): the visual owns columns two to four. It starts a gap past the first grid
        line (a quarter of the content width, plus clamp(1.5rem, 3vw, 3.5rem)), the
        breathing room payloadcms.com leaves between its copy and its imagery, and runs to the
        container edge, so it never sits behind the copy and needs no scrim.

        Tablet: a band beneath the copy, the full content width, at the scene's own 41:31
        aspect (ConfigHero fits an 820 x 620 frame), so the cards fill the band. Phone: a
        19:27 band for ConfigHero's compact scene (editor plus one card slot), which it
        switches to by itself under 560px of width. DOM order is phone order.
      */}
      <div className="pointer-events-none lg:absolute lg:inset-0">
        <div className="container-content relative h-full pb-12 sm:pb-16 lg:pb-0">
          <ConfigHero className="pointer-events-auto aspect-[19/27] w-full sm:aspect-[41/31] lg:absolute lg:inset-y-0 lg:left-[calc(var(--gutter)_+_(100%_-_2_*_var(--gutter))_/_4_+_clamp(1.5rem,3vw,3.5rem))] lg:right-0 lg:aspect-auto lg:w-auto" />
        </div>
      </div>
    </section>
  )
}
