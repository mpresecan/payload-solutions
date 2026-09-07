import {
  INDEPENDENCE_NOTICE,
  PAYLOAD_TRADEMARK_ATTRIBUTION,
  SOLUTIONS_URL,
  brands,
} from '@payload-solutions/brand'
import { FooterWordmark } from '@payload-solutions/brand/footer-wordmark'
import { GridColumns } from '@payload-solutions/brand/grid-columns'

import { ThemeToggle } from '@/components/theme-toggle'

const stack = brands.stack

/*
  Built to payloadcms.com's footer, measured at 1440: four equal columns starting exactly on
  the grid lines (no left padding — footer columns are flush, unlike cell content), the
  background lattice running the full height of the footer, headings at 12px/0.25em uppercase
  with a 72px drop to the first link, links at 16px in full --fg with 16px between them, and
  the oversized brand lockup closing the page. Their theme switcher lives in the last column,
  so ours does too.

  The one thing they do not have is a legal bar; ours must carry the Payload trademark
  attribution verbatim, so it sits under the columns as a quiet line rather than in a bordered
  strip of its own.
*/
interface FooterLink {
  label: string
  href: string
  soon?: boolean
}

const COLUMNS: Array<{ title: string; links: FooterLink[]; theme?: boolean }> = [
  {
    title: 'Payload Stack',
    links: [
      { label: 'Documentation', href: stack.docsUrl },
      { label: 'When to choose', href: '/when-to-choose' },
      { label: 'Roadmap', href: `${SOLUTIONS_URL}/#roadmap` },
      { label: 'MIT License', href: `${stack.github}/blob/main/LICENSE` },
    ],
  },
  {
    title: 'Ecosystem',
    links: [
      { label: 'Payload Solutions', href: SOLUTIONS_URL },
      { label: 'Payload Clock', href: brands.clock.url, soon: true },
      { label: 'Plugins', href: `${SOLUTIONS_URL}/#plugins` },
      { label: 'Hire us', href: `${SOLUTIONS_URL}/#contact` },
    ],
  },
  {
    title: 'Upstream',
    links: [
      { label: 'Payload CMS', href: 'https://payloadcms.com' },
      { label: 'Better Auth', href: 'https://better-auth.com' },
      { label: 'shadcn/ui', href: 'https://ui.shadcn.com' },
      { label: 'Next.js', href: 'https://nextjs.org' },
    ],
  },
  {
    title: 'Stay connected',
    links: [{ label: 'GitHub', href: stack.github }],
    theme: true,
  },
]

export function SiteFooter() {
  return (
    <footer className="relative isolate hairline-t pt-20 lg:pt-32">
      <GridColumns />

      <div className="container-content">
        <div className="grid grid-cols-1 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.title} className="lg:pr-8">
              <h2 className="footer-heading">{col.title}</h2>
              {/* 72px from heading to first link at desktop, measured off payloadcms.com;
                  tightened on phones, where four stacked columns would otherwise sprawl. */}
              <ul className="mt-6 flex flex-col items-start gap-3.5 text-base lg:mt-[4.5rem] lg:gap-4">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-fg transition-colors hover:text-accent"
                      {...(/^https?:/.test(l.href) && !l.href.startsWith(stack.url)
                        ? { target: '_blank', rel: 'noreferrer noopener' }
                        : {})}
                    >
                      {l.label}
                      {l.soon ? (
                        <span className="ml-2 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-fg-subtle">
                          soon
                        </span>
                      ) : null}
                    </a>
                  </li>
                ))}
                {col.theme ? (
                  <li>
                    <ThemeToggle variant="row" />
                  </li>
                ) : null}
              </ul>
            </div>
          ))}
        </div>

        {/* Two columns rather than three, so the attribution crosses one grid line instead of
            two; the copyright keeps the last column, under the theme control. */}
        <div className="grid grid-cols-1 gap-y-4 pb-16 pt-16 text-[0.8125rem] leading-relaxed text-fg-subtle sm:grid-cols-2 lg:grid-cols-4 lg:pt-20">
          <p className="lg:col-span-2 lg:pr-8">
            {PAYLOAD_TRADEMARK_ATTRIBUTION} {INDEPENDENCE_NOTICE}
          </p>
          <p className="lg:col-start-4">
            MIT licensed. Copyright {new Date().getFullYear()} Payload Solutions.
          </p>
        </div>
      </div>

      <FooterWordmark brand="stack" />
    </footer>
  )
}
