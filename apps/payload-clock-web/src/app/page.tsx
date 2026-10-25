import { CrtGrain } from '@payload-solutions/brand/crt-grain'
import { GridColumns } from '@payload-solutions/brand/grid-columns'
import { HeroVideoBackdrop } from '@payload-solutions/brand/hero-video'
import { ThemeBand } from '@payload-solutions/brand/theme-band'
import { Particles } from '@/components/particles'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { Connect } from '@/sections/connect'
import { Everywhere } from '@/sections/everywhere'
import { Free } from '@/sections/free'
import { Hero } from '@/sections/hero'
import { How } from '@/sections/how'
import { Inside } from '@/sections/inside'
import { OpenSource } from '@/sections/open-source'
import { Problem } from '@/sections/problem'

/**
 * One theme switch per page, as on the sibling sites: the opening band is always dark and
 * carries the pinned hero video (the same VideoBackdrop as payload.solutions and
 * payloadstack.com, with this site's own loop), the particle field and the dial; everything
 * after it follows the visitor's theme and slides over the video, opaque and positioned. The
 * hero copy spans two columns, so the copy scrim does too.
 *
 * The particle field belongs inside the band rather than on the page, so it fades out with the
 * backdrop instead of drifting behind the copy all the way down.
 */
export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <ThemeBand theme="dark" as="div" className="-mt-header pt-header">
          <HeroVideoBackdrop video="clock" copyColumns={2} />
          <Particles />
          <GridColumns fadeTop />
          <Hero />
        </ThemeBand>
        <div className="relative z-10 bg-bg">
          <CrtGrain />
          <GridColumns />
          <Problem />
          <How />
          <Inside />
          <Everywhere />
          <Connect />
          <Free />
          <OpenSource />
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
