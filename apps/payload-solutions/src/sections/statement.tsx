import { GITHUB_REPO_URL } from '@payload-solutions/brand'
import { ActionRow } from '@payload-solutions/brand/lattice'
import { Reveal } from '@/components/reveal'

/**
 * The open-source statement: the claim, the way to check it, and nothing else.
 *
 * It used to carry a ledger of every published package opposite the claim. That worked while
 * there were four of them; at eight it had become a second directory competing with the plugin
 * table two sections below, and it grew with every release. The claim is "one repository, all
 * MIT" — a visitor verifies that by opening the repository, not by reading a list of its
 * contents, so the row underneath is the whole proof and the lattice keeps the rest of the
 * band. Same shape as the hero: copy, then actions on two columns.
 */
export function Statement() {
  return (
    <section className="hairline-t relative" aria-label="About Payload Solutions">
      <div className="container-content py-section">
        <Reveal>
          <p className="display-md max-w-[46rem]">
            Payload gave us the best backend we have ever shipped on. We give back: every product
            here is MIT licensed, developed in one public monorepo and documented on this site, by a
            team that builds client SaaS on Payload every week.
          </p>
        </Reveal>

        {/* Two of the four columns, so the row closes on the centre grid line like the hero's. */}
        <Reveal index={1} className="col-grid mt-12">
          <div className="border-t border-border lg:col-span-2">
            <ActionRow href={GITHUB_REPO_URL} meta="mpresecan/payload-solutions">
              Read the source on GitHub
            </ActionRow>
          </div>
        </Reveal>

        <Reveal index={2}>
          {/* The three facts the paragraph claims, in the smallest voice on the band. No counts:
              a number here would be stale the day a package is published. */}
          <p className="label-mono mt-8">
            MIT · One public repository · Published under @payload-solutions
          </p>
        </Reveal>
      </div>
    </section>
  )
}
