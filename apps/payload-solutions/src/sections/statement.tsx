import { GITHUB_REPO_URL } from '@payload-solutions/brand'
import { ActionRow } from '@payload-solutions/brand/lattice'
import { ConfigPlate } from '@/components/config-plate'
import { Reveal } from '@/components/reveal'

/**
 * The open-source statement: the claim, the way to check it, and nothing else.
 *
 * It used to carry a ledger of every published package opposite the claim. That worked while
 * there were four of them; at eight it had become a second directory competing with the plugin
 * table two sections below, and it grew with every release. What sits there now is the config
 * plate: the same catalogue, but as the four lines a developer would actually write, which is
 * evidence rather than an inventory and stays one screen tall however many plugins ship.
 *
 * Two columns of copy, two of plate, the way payloadcms.com sets a claim against the product
 * beside it.
 */
export function Statement() {
  return (
    <section className="hairline-t relative" aria-label="About Payload Solutions">
      <div className="container-content col-grid py-section lg:items-center">
        <Reveal className="lg:col-span-2 lg:pr-12">
          <p className="display-md">
            Payload gave us the best backend we have ever shipped on. We give back: every product
            here is MIT licensed, developed in one public monorepo and documented on this site, by a
            team that builds client SaaS on Payload every week.
          </p>

          <div className="mt-10 border-t border-border">
            <ActionRow href={GITHUB_REPO_URL} meta="mpresecan/payload-solutions">
              Read the source on GitHub
            </ActionRow>
          </div>

          {/* The facts the paragraph claims, in the smallest voice on the band. No counts: a
              number here would be stale the day a package is published. */}
          <p className="label-mono mt-7">
            MIT · One public repository · Published under @payload-solutions
          </p>
        </Reveal>

        {/* The gutter is given back at lg so the plate reaches the edge of the viewport. */}
        <Reveal
          index={1}
          className="mt-14 min-w-0 lg:col-span-2 lg:mt-0 lg:pl-12 lg:[margin-right:calc(var(--gutter)*-1)]"
        >
          <ConfigPlate />
        </Reveal>
      </div>
    </section>
  )
}
