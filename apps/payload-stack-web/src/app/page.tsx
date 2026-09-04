import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { BuiltWith } from '@/sections/built-with'
import { Config } from '@/sections/config'
import { Hero } from '@/sections/hero'
import { Inside } from '@/sections/inside'
import { OneCommand } from '@/sections/one-command'
import { OpenSource } from '@/sections/open-source'
import { WhyPayload } from '@/sections/why-payload'

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero />
        <BuiltWith />
        <Inside />
        <OneCommand />
        <Config />
        <WhyPayload />
        <OpenSource />
      </main>
      <SiteFooter />
    </>
  )
}
