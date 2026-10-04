import { PAYLOAD_URL } from '@payload-solutions/brand'
import { ActionRow, Eyebrow, IndependenceNote, ProseLink } from '@payload-solutions/brand/lattice'
import { PackageField } from '@payload-solutions/brand/package-field'

/**
 * The umbrella hero. No product visual on purpose: payload.solutions has a portfolio, not one
 * product, and the products sit directly underneath. The visual is the mark multiplied into
 * a floor of packages (PackageField): hover lights the boxes under the pointer in their
 * product colours, a click sends a ripple across the floor. It replaced the LiquidMark ink
 * field once the mark became the lid-and-base box, whose meaning lives in the gap and the
 * coloured lid — both of which the ink blur erased.
 *
 * The IsoStack illustration stays with Payload Stack, whose identity it actually is.
 */
export function Hero() {
  return (
    <section className="relative isolate overflow-hidden" aria-labelledby="hero-heading">
      {/* Scrim: keeps the copy at AA over the package field without dimming its centre. Only
          needed from lg, where the field sits behind the copy; below that it has a band of its own. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 hidden lg:block"
        style={{
          background:
            'linear-gradient(100deg, color-mix(in srgb, var(--bg) 94%, transparent) 0%, color-mix(in srgb, var(--bg) 86%, transparent) 26%, color-mix(in srgb, var(--bg) 35%, transparent) 52%, transparent 72%)',
        }}
      />

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
        The package field. From lg it is the hero's background, under the scrim (-z-20 against
        the scrim's -z-10) so the copy keeps its contrast. Below lg it gets a band of its own
        beneath the copy, for the same reason the old mark did: as a background on a phone it
        would sit directly behind the headline and the action rows. The band is 5:4 and
        capped at 26rem, which keeps it under PackageField's 1.35 threshold so the floor is
        centred there and pushed right from lg.

        It comes after the copy in the DOM so the phone order is right; from lg the absolute
        positioning makes DOM order irrelevant.
      */}
      <div className="edge-fade relative mx-auto aspect-[5/4] w-full max-w-[26rem] lg:absolute lg:inset-0 lg:-z-20 lg:aspect-auto lg:max-w-none">
        <PackageField className="absolute inset-0" />
      </div>
    </section>
  )
}
