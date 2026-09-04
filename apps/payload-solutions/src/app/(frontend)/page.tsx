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
        <Hero />
        <Statement />
        <Products products={products.docs} />
        <Plugins plugins={plugins.docs} />
        <Roadmap items={roadmap.docs} />
        <Contact />
      </main>
      <SiteFooter />
    </>
  )
}
