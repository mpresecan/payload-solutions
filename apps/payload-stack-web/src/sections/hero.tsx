import { brands } from '@payload-solutions/brand'
import { ActionRow } from '@payload-solutions/brand/lattice'
import { Parallax } from '@payload-solutions/brand/parallax'
import { CopyCommand } from '@/components/copy-command'
import { StackVisual } from '@/components/stack-visual'

const brand = brands.stack

/**
 * The hero. The headline is the only large thing on the page; everything you can do with it
 * is a row of the lattice under the headline rather than a cluster of buttons, which is what
 * gives payloadcms.com its document-like calm. The stack illustration keeps the right half
 * and now stands on true black — the isometric floor that used to sit behind it competed
 * with the isometry of the drawing itself.
 */
export function Hero() {
  return (
    <section className="relative" aria-labelledby="hero-heading">
      <div className="container-content relative grid min-h-[calc(100dvh-var(--header-height))] grid-cols-1 items-center gap-14 py-20 lg:grid-cols-12 lg:gap-10 lg:py-24">
        <div className="lg:col-span-6">
          <h1 id="hero-heading" className="display-xl max-w-[15ch]">
            The SaaS boilerplate for Payload CMS.
          </h1>
          <p className="lead mt-7 max-w-[34rem]">
            Better Auth, organizations, Stripe subscriptions and a shadcn dashboard, wired into
            Payload and Next.js. Open source, one command.
          </p>

          <div className="mt-11 max-w-[34rem] border-t border-border">
            <CopyCommand variant="row" />
            <ActionRow href={brand.docsUrl}>Documentation</ActionRow>
            <ActionRow href="/when-to-choose" meta="2 min read">
              When to choose Payload Stack
            </ActionRow>
          </div>
        </div>

        <Parallax speed={-0.08} className="min-w-0 lg:col-span-6 lg:pl-4">
          <StackVisual className="mx-auto w-full max-w-[20rem] sm:max-w-[26rem] md:max-w-[40rem] lg:max-w-none" />
        </Parallax>
      </div>
    </section>
  )
}
