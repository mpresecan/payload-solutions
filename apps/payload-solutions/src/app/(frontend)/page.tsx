import type { Metadata } from 'next'
import { CrtGrain } from '@payload-solutions/brand/crt-grain'
import { GridColumns } from '@payload-solutions/brand/grid-columns'
import { HeroVideoBackdrop } from '@payload-solutions/brand/hero-video'
import { ThemeBand } from '@payload-solutions/brand/theme-band'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { getPayloadClient } from '@/lib/payload'
import { Contact } from '@/sections/contact'
import { Hero } from '@/sections/hero'
import { Plugins } from '@/sections/plugins'
import { Products } from '@/sections/products'
import { Roadmap } from '@/sections/roadmap'
import { Statement } from '@/sections/statement'

export const revalidate = 300

// Set per page, not in the root layout: a layout canonical is inherited by every child route.
export const metadata: Metadata = { alternates: { canonical: '/' } }

export default async function HomePage() {
  const payload = await getPayloadClient()
  const [products, plugins, roadmap] = await Promise.all([
    payload.find({ collection: 'products', sort: 'order', limit: 10, overrideAccess: true }),
    payload.find({ collection: 'plugins', sort: 'order', limit: 20, overrideAccess: true }),
    payload.find({ collection: 'roadmap-items', sort: 'order', limit: 50, overrideAccess: true }),
  ])

  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        {/* One dark band for the hero and the statement, pulled under the header so the header
            takes its colour. Both sections are transparent, so the pinned hero video runs behind
            them; the rest follows the visitor's theme and slides over it like a curtain, the
            way payloadcms.com runs its own background video. */}
        <ThemeBand theme="dark" as="div" className="-mt-header pt-header">
          <HeroVideoBackdrop />
          <GridColumns />
          <Hero />
          <Statement />
        </ThemeBand>
        <div className="relative z-10 bg-bg">
          <CrtGrain />
          <GridColumns />
          <Products products={products.docs} />
          <Plugins plugins={plugins.docs} />
          <Roadmap items={roadmap.docs} />
          <Contact />
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
