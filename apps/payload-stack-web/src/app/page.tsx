import { AmbientBackdrop } from '@payload-solutions/brand/ambient-backdrop'
import { GridColumns } from '@payload-solutions/brand/grid-columns'
import { ThemeBand } from '@payload-solutions/brand/theme-band'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { BuiltWith } from '@/sections/built-with'
import { Config } from '@/sections/config'
import { Hero } from '@/sections/hero'
import { Inside } from '@/sections/inside'
import { OneCommand } from '@/sections/one-command'
import { OpenSource } from '@/sections/open-source'
import { Showcase } from '@/sections/showcase'
import { WhyPayload } from '@/sections/why-payload'

/**
 * The opening band is always dark: hero, logo wall and the product showcase sit on the
 * pinned ambient backdrop. Everything after it follows the visitor's theme and slides over
 * the backdrop (relative, z-10, opaque), one deliberate switch per page.
 */
export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <ThemeBand theme="dark" as="div" className="-mt-header pt-header">
          <AmbientBackdrop />
          <GridColumns />
          <Hero />
          <BuiltWith />
          <Showcase />
        </ThemeBand>
        <div className="relative z-10 bg-bg">
          <GridColumns />
          <Inside />
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
