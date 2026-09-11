import { accentForSlug, brands, GITHUB_REPO_URL } from '@payload-solutions/brand'
import { ArrowGlyph } from '@payload-solutions/brand/lattice'
import { Reveal } from '@/components/reveal'

/**
 * The open-source statement. Two columns of the lattice: the claim on the left, and on the
 * right the ledger that settles it — every package published out of the repository, each row
 * linking to the folder it is built from, each marked MIT.
 *
 * The paragraph's three claims (MIT, one public monorepo, documented here) are otherwise
 * unverifiable prose sitting in an empty half of the page. A visitor can now click any row and
 * land on the source. Rows carry their own `data-brand`, like the product wall, so the consent
 * packages read emerald and the Stack packages violet on hover.
 *
 * Kept as a hand-written table rather than read from the workspace: it is the published
 * surface, which is an editorial choice (the two websites and the shared brand package are in
 * the same repo and deliberately not listed), and it changes about as often as this copy does.
 */
type PublishedPackage = {
  /** npm scope, drawn quiet so the eye lands on the package name. */
  scope?: string
  name: string
  /** Folder inside the monorepo — the row links there. */
  path: string
}

const PACKAGES: PublishedPackage[] = [
  { name: 'payload-stack', path: 'templates/payload-stack' },
  { name: 'create-payload-stack', path: 'packages/create-payload-stack' },
  { scope: '@payload-solutions/', name: 'plugin-emails', path: 'packages/plugin-emails' },
  { scope: '@payload-solutions/', name: 'plugin-consent', path: 'packages/plugin-consent' },
  { scope: '@payload-solutions/', name: 'consent-core', path: 'packages/consent-core' },
  { scope: '@payload-solutions/', name: 'consent-react', path: 'packages/consent-react' },
  { scope: '@payload-solutions/', name: 'plugin-vercel', path: 'packages/plugin-vercel' },
  {
    scope: '@payload-solutions/',
    name: 'plugin-action-scheduler',
    path: 'packages/plugin-action-scheduler',
  },
]

export function Statement() {
  return (
    <section className="hairline-t relative" aria-label="About Payload Solutions">
      <div className="container-content col-grid py-section">
        <Reveal className="lg:col-span-2 lg:pr-12">
          <p className="display-md">
            Payload gave us the best backend we have ever shipped on. We give back: every product
            here is MIT licensed, developed in one public monorepo and documented on this site, by a
            team that builds client SaaS on Payload every week.
          </p>
          <p className="mt-6 text-fg-muted">
            <a
              href={brands.solutions.github}
              target="_blank"
              rel="noreferrer noopener"
              className="text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
            >
              Read the source on GitHub
            </a>
          </p>
        </Reveal>

        <Reveal index={1} className="mt-16 lg:col-span-2 lg:mt-0 lg:pl-12">
          <p className="label-mono">Published from one repository</p>
          <ul className="list-grid mt-7">
            {PACKAGES.map((pkg) => (
              <li key={pkg.name} data-brand={accentForSlug(pkg.name)}>
                <a
                  href={`${GITHUB_REPO_URL}/tree/main/${pkg.path}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group flex items-baseline justify-between gap-6 border-b border-border py-4"
                >
                  <span className="min-w-0 truncate font-mono text-[0.9375rem]">
                    <span className="text-fg-subtle">{pkg.scope}</span>
                    <span className="text-fg transition-colors group-hover:text-accent">
                      {pkg.name}
                    </span>
                  </span>
                  {/* The licence column is the table's third field on a wide row; on a phone
                      there is only room for the package name, and the paragraph opposite has
                      already said every product here is MIT. */}
                  <span className="hidden shrink-0 items-center gap-2 label-mono sm:flex">
                    MIT
                    <ArrowGlyph
                      size={12}
                      className="text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
