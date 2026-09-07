import { PAYLOAD_URL } from '@payload-solutions/brand'
import { ActionRow, Eyebrow, IndependenceNote, ProseLink } from '@payload-solutions/brand/lattice'
import { LiquidMark } from '@payload-solutions/brand/liquid-mark'

/**
 * The umbrella hero. No product visual on purpose: payload.solutions has a portfolio, not one
 * product, and the products sit directly underneath. The mark itself is the subject — an ink
 * field that the pointer tears apart and that reassembles into the silhouette.
 *
 * The IsoStack illustration stays with Payload Stack, whose identity it actually is.
 */
export function Hero() {
  return (
    <section className="relative isolate overflow-hidden" aria-labelledby="hero-heading">
      {/* Scrim: keeps the copy at AA over the ink without dimming the mark. Only needed from
          lg, where the mark sits behind the copy; below that it has a band of its own. */}
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
        The mark. From lg it is the hero's background, filling the section behind the copy —
        the composition this hero was designed around, and the one that works.

        Below lg it gets a band of its own beneath the copy. On a phone the mark is nearly as
        wide as the screen, so as a background it sat directly behind the headline and the
        action rows; once those rows became opaque it was sliced into stray wedges showing
        through the gaps and through the translucent hairlines. Given a band, it reads as a
        mark again and the copy sits on clean black.

        The band is 5:4 and capped at 26rem so it stays under LiquidMark's 1.35 aspect
        threshold at every width below lg — past that the component treats the element as a
        wide hero background and pushes the mark off to the right, which is correct there and
        wrong here. Full-bleed on a phone, a centred stage on a tablet.

        It comes after the copy in the DOM so the phone order is right; from lg the absolute
        positioning makes DOM order irrelevant.
      */}
      <div className="edge-fade relative mx-auto aspect-[5/4] w-full max-w-[26rem] lg:absolute lg:inset-0 lg:-z-10 lg:aspect-auto lg:max-w-none">
        <LiquidMark className="absolute inset-0">
          {/* Visible whenever WebGL2 is unavailable; the canvas paints over it otherwise. */}
          <div className="absolute inset-0 grid place-items-center lg:justify-items-end lg:pr-[18%]">
            <svg
              viewBox="0 0 20 26"
              className="h-[70%] w-auto text-fg lg:h-[min(52vh,22rem)]"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M10.5 3.49976L0.713097 8.15257V20.4896L8.2737 25.1999V12.8629L18 7.99976L10.5 3.49976Z" />
              <path d="M11 23.5V15L18 19.5L11 23.5Z" />
            </svg>
          </div>
        </LiquidMark>
      </div>
    </section>
  )
}
