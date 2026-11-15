import { CrtGrain } from '@payload-solutions/brand/crt-grain'
import { GridColumns } from '@payload-solutions/brand/grid-columns'
import { HeroVideoBackdrop } from '@payload-solutions/brand/hero-video'
import { ThemeBand } from '@payload-solutions/brand/theme-band'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { BuiltWith } from '@/sections/built-with'
import { Config } from '@/sections/config'
import { Hero } from '@/sections/hero'
import { Inside } from '@/sections/inside'
import { OneCommand } from '@/sections/one-command'
import { OpenSource } from '@/sections/open-source'
import { SeeItRun } from '@/sections/see-it-run'
import { Showcase } from '@/sections/showcase'
import { WhyPayload } from '@/sections/why-payload'

/**
 * The opening band is always dark: hero, logo wall and the product showcase are transparent
 * and sit on the pinned hero video, shared with payload.solutions. Everything after it follows
 * the visitor's theme and slides over the video like a curtain (relative, z-10, opaque), the
 * way payloadcms.com runs its own background video. The hero copy sits in the first lattice
 * column, as on payload.solutions, so the copy scrim covers one. The hero visual carries a terminal transcript and hairline slabs on the
 * side the copy scrim leaves open, so the video is also dimmed evenly while the page is at the top
 * (`heroDim`) and returns to full strength as the hero scrolls away.
 */
export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <ThemeBand theme="dark" as="div" className="-mt-header pt-header">
          <HeroVideoBackdrop video="stack" heroDim={0.5} />
          <GridColumns fadeTop />
          <Hero />
          <BuiltWith />
          <Showcase />
        </ThemeBand>
        <div className="relative z-10 bg-bg">
          <CrtGrain />
          <GridColumns />
          <Inside />
          <SeeItRun />
          <OneCommand />
          <Config />
          <WhyPayload />
          <OpenSource />
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
